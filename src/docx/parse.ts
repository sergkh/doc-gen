import mammoth from 'mammoth';
import fs from 'fs/promises';
import { z } from "zod";
import type { Course, CourseSemesters, CourseTopic, ParsedData, Teacher } from '@/stores/models';
import { PDFParse } from 'pdf-parse';
import path, { parse } from 'path';
import { courseResults, specialties, teachers } from '@/stores/db';
import { createHash } from 'crypto';
import { extractDocTables, findFirstTable, findNextTable, findTableRow, findTableRowIndex, type DocTable } from './structured-parser';
import { extractInformationAI } from "@/ai/extractor";
import { dropDot, normalizeWhitespaces } from '@/parsing/utils';

// Methods to parse syllabuses and programs from .docx and .pdf files

type CourseInitialInfo = {
  okNo?: string | null;
}

type SpecialtyInfo = {
  specialtyId: number | null,
  specialtyName: string | null, 
  specialtyCode: string | null, 
  specialtyOldCode: string | null, 
  specialtyOldName: string | null, 
  specialtyMode: 'new_only' | 'old_only' | 'both' | 'unknown',
  specialtyFormatted: string,
  area: string | null,
  warnings: string[]
}

function validateInitialInfo(initialInfo: CourseInitialInfo | null) {
  if(!initialInfo) return;
  // verify that okNo is a number or 1.1 format
  if(initialInfo.okNo && !/^\d+(\.\d+)?$/.test(initialInfo.okNo.toString())) {
    throw new Error("Invalid okNo format: " + initialInfo.okNo + " Expected number or decimal format like 1.1");
  }
}

function normalizeLiterature(text: string): string[] {
  return text.split(/\n/).map(l => dropDot(l)).map(l => l.replace(/^\d+\./, '').trim()).filter(l => l && l.length > 10).sort();
}

function filterAbsent(...arr: number[]): number[] {
  return arr.filter(n => isFinite(n) && n > 0);
}

const prepostRequisitesPrompt = `
  З переданого тексту вибери дисципліни знання з яких використовуються в даній (prerequisites), та дисципліни знання які використовують дану (postrequisites). Якщо щось не вказане, поверни пустий масив.
`;

const PrepostRequisitesExtraction = z.object({
  prerequisites: z.array(z.string()),
  postrequisites: z.array(z.string())
});

export async function parseSylabusOrProgram(filepath: string, dryRun: boolean = false, initialInfo: CourseInitialInfo | null = null): Promise<Course & ParsedData | null> {
  try {
    validateInitialInfo(initialInfo);

    const text = (await docx2text(filepath)).trim();
    if (/СИЛАБУС/g.test(text.substring(0, 200))) {
      return await parseSylabus(filepath, text, dryRun, initialInfo);
    } else if (/РОБОЧА ПРОГРАМА/g.test(text.substring(0, 400))) {
      return await parseProgram(filepath, text, dryRun, initialInfo);
    }

    return null;
  } catch (error) {
    console.error("Error parsing Sylabus:", error);
    return null;
  }
}

export function fillTopicHours(topic: CourseTopic, table: DocTable | null): CourseTopic {
  if (!table) return topic;
  // can contain spaces, be empty or have a '-' instead of a number
  const parseColumn = (s: string | undefined) => {
    const cleaned = s?.trim();
    if (cleaned && cleaned.length > 0) {
      return parseInt(cleaned) || 0;
    }
    return 0;
  }

  const topicRow = findTableRow(table, `Тема ${topic.index}`, `Тема${topic.index}`);

  if (topicRow) {
    // Example of the row:
    // [ "Тема 1. Організація мережі World Wide Web. Мова розміткигіпертекстів HTML", "10", "2", "2", "", "", "6", "15", "1", "", "", "", "14"], 
    topic.data.fulltime.hours = parseColumn(topicRow[2]);
    topic.data.fulltime.practical_hours = parseColumn(topicRow[3]);
    topic.data.fulltime.srs_hours = parseColumn(topicRow[6]);
    
    topic.data.inabscentia.hours = parseColumn(topicRow[8]);
    topic.data.inabscentia.practical_hours = parseColumn(topicRow[9]);
    topic.data.inabscentia.srs_hours = parseColumn(topicRow[12]);
  }
  return topic;
}

function parseDescriptionTable(table: DocTable | null): {fulltime: CourseSemesters, inabscentia: CourseSemesters} {
  const result = {
    fulltime: { semesters: [], study_year: 0 },
    inabscentia: { semesters: [], study_year: 0 }
  } as {fulltime: CourseSemesters, inabscentia: CourseSemesters};

  if (!table) return result;

  const yearsRowIdx = findTableRowIndex(table, "Рік");
  
  const years = yearsRowIdx != -1 ? table[yearsRowIdx + 1] : null;
  
  if (years) {
    result.fulltime.study_year = parseInt(years[2]?.trim() || "0");
    result.inabscentia.study_year = parseInt(years[3]?.trim() || "0");
  }

  const semestersRowIdx = findTableRowIndex(table, "Семестр");
  const semesters = semestersRowIdx != -1 ? table[semestersRowIdx + 1] : null;
  
  if (semesters) {    
    result.fulltime.semesters = (semesters[2]?.split('').map(d => parseInt(d)).filter(n => isFinite(n)) ?? []) as number[];
    result.inabscentia.semesters = (semesters[3]?.split('').map(d => parseInt(d)).filter(n => isFinite(n)) ?? []) as number[];    
  }

  return result;
}

async function parsePreAndPostRequisites(text: string): Promise<{prerequisites: string[], postrequisites: string[]}> {
  const parseResult = await extractInformationAI(prepostRequisitesPrompt, text, PrepostRequisitesExtraction);
  
  if (!parseResult) {
    throw Error("Failed to extract prerequisites and postrequisites");
  }

  return parseResult;
}

// Best effort parsing of syllabus
async function parseSylabus(filepath: string, text: string, dryRun: boolean = false, initialInfo: CourseInitialInfo | null = null): Promise<Course & ParsedData | null> {
  try {
    // save for debugging
    const hash = createHash("sha256").update(text).digest("hex");
    Bun.write(path.join(process.cwd(), "uploads", "courses", `syllabus_${hash}.txt`), text);

    console.log("Parsing syllabus:");
    const warnings: string[] = [];
    // approx first 800 characters of the text
    const header = text.substring(0, 800);

    const nameMatch = header.match(/«([^»]+)»/);
    const parsedName = (nameMatch?.[1]?.trim() || "");
    // some syllabuses have all caps names, or names that span multiple lines
    const name = normalizeWhitespaces(parsedName.charAt(0).toUpperCase() + parsedName.slice(1).toLowerCase());

    if (!name) {
      console.error("Could not find course name");
      return null;
    }

    const specInfo = await parseSpecialtyAndArea(header);
    warnings.push(...specInfo.warnings);

    // Extract credits
    const creditsMatch = header.match(/Кількість кредитів ECTS:\s*(\d+)/i);
    const credits = creditsMatch?.[1] ? parseInt(creditsMatch[1], 10) : 0;

    // Extract hours
    const hoursMatch = text.match(/Загальний обсяг дисципліни\s+(\d+)\s+год/i);
    const hours = hoursMatch?.[1] ? parseInt(hoursMatch[1], 10) : 0;

    // Extract year and semester
    const yearSemesterMatch = text.match(/Рік навчання:\s*(\d+)-й[,\s]*семестр\s*(\d+)-й/i);
    const studyYear = yearSemesterMatch?.[1] ? parseInt(yearSemesterMatch[1], 10) : 1;
    const semester = yearSemesterMatch?.[2] ? parseInt(yearSemesterMatch[2], 10) : 1;

    // Extract control type
    let controlType: "exam" | "credit" | "both" = "credit";
    if (/іспит/i.test(text)) {
      controlType = /залік/i.test(text) ? "both" : "exam";
    }

    // Extract optional flag (check if it's mentioned as optional)
    const optional = /вибірков/i.test(text) || /факультатив/i.test(header);

    // Extract lecturer name and email
    let lecturerMatch = text.match(/Лектор курсу\s+([^\n]+)/i);
    if (!lecturerMatch?.[1]) {
      lecturerMatch = text.match(/Розробник курсу\s+([^\n]+)/i);
    }
    const lecturer = lecturerMatch?.[1]?.trim() || "";

    // stupid, but works: take last 3 words
    const lecturerName = lecturer.split(' ').slice(-3).join(' ');
    
    const emailMatch = text.match(/e-mail[\)]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const email = emailMatch?.[1]?.trim() || null;

    // TODO: might not always work
    let teacher = await teachers.findByName(lecturerName);    
    
    if (!teacher) {
      // Create new teacher
      teacher = { id: -1, name: lecturerName, email, position: null, academic_title: null, alt_names: [] } as Teacher;
    }

    const descrStart = Math.max(0, text.search(/ОПИС (НАВЧАЛЬНОЇ )?ДИСЦИПЛІНИ/i));
    const descrEnd   = Math.min(descrStart + 3000, ...filterAbsent(text.search(/Призначення (навчальної )?дисципліни/i), text.search(/Мета вивчення/i)));
    
    const description = text.substring(descrStart, descrEnd);

    const {prerequisites, postrequisites} = await parsePreAndPostRequisites(description);

    const results = await parseSylabusOrProgramResults(text);
    warnings.push(...results.warnings);

    // Parse topics from "ПЛАН ВИВЧЕННЯ НАВЧАЛЬНОЇ ДИСЦИПЛІНИ"
    const topics: { name: string; index: number }[] = [];
    const planMatch = text.match(/ПЛАН ВИВЧЕННЯ НАВЧАЛЬНОЇ ДИСЦИПЛІНИ[\s\S]*?№\s*з\/п[\s\S]*?Назви теми([\s\S]*?)(?=Самостійна робота|РЕКОМЕНДОВАНІ|СИСТЕМА)/i);
    if (planMatch?.[1]) {
      const topicsText = planMatch[1];
      const topicLines = topicsText.split(/\n/);
      let currentIndex = 0;
      
      for (let i = 0; i < topicLines.length; i++) {
        const line = topicLines[i]?.trim();
        if (!line) continue;
        // Look for lines that start with a number (topic index)
        const indexMatch = line.match(/^(\d+)$/);
        if (indexMatch?.[1]) {
          currentIndex = parseInt(indexMatch[1], 10);
          // Next non-empty line should be the topic name
          for (let j = i + 1; j < topicLines.length; j++) {
            const nameLine = topicLines[j]?.trim();
            if (nameLine && !/^\d+$/.test(nameLine) && !/год/i.test(nameLine)) {
              topics.push({ name: nameLine, index: currentIndex });
              break;
            }
          }
        }
      }
    }

    const literatureText = text.substring(Math.min(text.lastIndexOf("РЕКОМЕНДОВАНІ ДЖЕРЕЛА ІНФОРМАЦІЇ"), text.lastIndexOf("ЛІТЕРАТУРА")));

    // Extract main literature
    const mainLitMatch = literatureText.match(/Основна література\s+([\s\S]*?)(?=Додаткова література|Інтернет|СИСТЕМА)/i);
    const addLitMatch = literatureText.match(/Додаткова література\s+([\s\S]*?)(?=Інтернет|СИСТЕМА)/i);
    const internetMatch = literatureText.match(/Інтернет\s+ресурси?\s+([\s\S]*?)(?=СИСТЕМА|$)/i);
    
    const literature = {
      main: mainLitMatch?.[1] ? normalizeLiterature(mainLitMatch[1]) : [],
      additional: addLitMatch?.[1] ? normalizeLiterature(addLitMatch[1]) : [],
      internet: internetMatch?.[1] ? normalizeLiterature(internetMatch[1]) : []
    };

    // Parse attestations from "Розподіл балів за видами навчальної діяльності"
    const attestations: { name: string; semester: number }[] = [];
    const attestationMatch = text.match(/Атестація\s+(\d+)[\s\S]*?Всього за атестацію\s+\d+/gi);
    if (attestationMatch) {
      attestationMatch.forEach((match) => {
        const semesterMatch = match.match(/Атестація\s+(\d+)/i);
        if (semesterMatch?.[1]) {
          const semester = parseInt(semesterMatch[1], 10);
          attestations.push({ name: `Атестація ${semester}`, semester });
        }
      });
    }

    // Create Course object
      const course: Course & ParsedData = {
        id: -1,        
        name,
        teacher_id: teacher.id,
        specialty_id: specInfo.specialtyId,
        data: {
          ok_no: initialInfo?.okNo ?? null,
          optional,
          control_type: controlType,
          hours,
          credits,
          specialty: specInfo.specialtyFormatted,
          specialty_mode: specInfo.specialtyMode,
          area: specInfo.area ?? "",
          description: "",
          prerequisites,
          postrequisites,
          results: results.ids,
          attestations,
          fulltime: {
            semesters: [semester],
            study_year: studyYear
          },
          inabscentia: {
            semesters: [],
            study_year: 1
          },
          literature,
          warnings
        },
        generated: null,
        type: 'syllabus',
        topics: [],
        parsed_teacher: teacher,
        parse_warnings: warnings
      };

    return course;
  } catch (error) {
    console.error("Error parsing syllabus:", error);
    return null;
  }
}

async function parseProgram(filepath: string, text: string, dryRun: boolean = false, initialInfo: CourseInitialInfo | null = null): Promise<Course & ParsedData | null> {
  try {
    console.log("Parsing program:");
    // save for debugging
    const hash = createHash("sha256").update(text).digest("hex");
    Bun.write(path.join(process.cwd(), "uploads", "courses", `program_${hash}.txt`), text);
    
    const warnings: string[] = [];
    
    // approx first 500 characters of the text
    const header = text.substring(0, 500);

    // Extract course name (after "РОБОЧА ПРОГРАМА НАВЧАЛЬНОЇ ДИСЦИПЛІНИ")
    const nameMatch = header.match(/РОБОЧА ПРОГРАМА НАВЧАЛЬНОЇ ДИСЦИПЛІНИ\s+([^\n]+)/i);
    const parsedName = (nameMatch?.[1]?.trim() || "");
    const name = parsedName.charAt(0).toUpperCase() + parsedName.slice(1).toLowerCase();

    if (!name) {
      console.error("Could not find course name");
      return null;
    }

    const specInfo = await parseSpecialtyAndArea(header);
    warnings.push(...specInfo.warnings);

    const opysIndex = Math.max(text.indexOf("Опис навчальної дисципліни"), 500);
    const tableArea = text.substring(opysIndex, opysIndex + 1000);

    // Extract credits
    const creditsMatch = tableArea.match(/Кількість кредитів\s*[–-]\s*(\d+)/i);
    const credits = creditsMatch?.[1] ? parseInt(creditsMatch[1], 10) : 0;

    // Extract hours
    const hoursMatch = tableArea.match(/Загальна кількість годин\s*[–-]\s*(\d+)/i);
    const hours = hoursMatch?.[1] ? parseInt(hoursMatch[1], 10) : 0;
    
    // Extract control type
    let controlType: "exam" | "credit" | "both" = "credit";
    if (/екзамен/i.test(tableArea)) {
      controlType = /залік/i.test(text) ? "both" : "exam";
    }

    // Extract optional flag (check if it's mentioned as optional)
    const optional = /вибірков/i.test(text) || /факультатив/i.test(text);

    // Extract teacher name (from "Викладач:" or "Розробник:")
    const teacherMatch = text.match(/(?:Викладач|Розробник):\s*([^\n]+)/i);
    const teacherFull = teacherMatch?.[1]?.trim() || "";
    // Extract just the name part (before comma or first few words)
    const teacherName = teacherFull.split(',')[0]?.trim() || teacherFull.split(' ').slice(0, 3).join(' ').trim() || "";
    
    // Extract email if available
    const emailMatch = text.match(/e-mail[\)]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const email = emailMatch?.[1]?.trim() || null;

    // Find or create teacher
    let teacher: Teacher | null = teacherName ? await teachers.findByName(teacherName) : null;
    
    if (!teacher && teacherName) {
      // Create new teacher
      teacher = { id: -1, name: teacherName, email: email, position: null, academic_title: null, alt_names: [] } as Teacher;
    }

    if (!teacher) {
      console.error("Could not find a teacher");
      return null;
    }

    // TODO: match prerequisites and postrequisites by name
    const prerequisites: string[] = [];
    const postrequisites: string[] = [];

    const results = await parseSylabusOrProgramResults(text);
    warnings.push(...results.warnings);

    const programPart = text.substring(
      Math.max(text.indexOf("Програма навчальної дисципліни"), text.indexOf("5. Програма")), 
      text.indexOf("Структура навчальної дисципліни")
    );
    
    const docTables = await extractDocTables(filepath);
    // We can't use order here as sometimes signatures are set as tables
    const descrTable = findFirstTable(docTables, "Характеристика навчальної дисципліни", "Галузь знань");
    
    const semesters = parseDescriptionTable(descrTable);

    const structureTable = findNextTable(docTables, descrTable, "Теми");

    // Parse attestations and topics from the program section
    const attestations: { name: string; semester: number }[] = [];
    const topics: CourseTopic[] = [];
    
    // Split the program part into lines for easier processing
    const lines = programPart.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
    
    let currentAttestation: { number: number; name: string; semester: number } | null = null;
    let currentTopic: { index: number; name: string; subtopics: string[] } | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      // Check for attestation: "Атестація 1. Основні підходи до аналізу даних"
      const attestationMatch = line.match(/Атестація\s+(\d+)\.?\s*(.+)/i);
      const topicMatch = line.match(/Тема\s+(\d+)\.\s+(.+)/i);
      
      if (attestationMatch?.[1] && attestationMatch[2]) {
        // Save previous topic if exists
        if (currentTopic) {
          const topic = {
            id: -1,
            course_id: -1,
            index: currentTopic.index,
            name: currentTopic.name,
            lection: '',
            data: {
              attestation: currentAttestation?.number || 1,
              fulltime: { hours: 0, practical_hours: 0, srs_hours: 0 },
              inabscentia: { hours: 0, practical_hours: 0, srs_hours: 0 },              
            },
            generated: {
              subtopics: currentTopic.subtopics.map(s => s.trim()).map(s => s.endsWith('.') ? s.substring(0, s.length - 1) : s)
            }            
          };
          topics.push(fillTopicHours(topic, structureTable));
          currentTopic = null;
        }
        
        const attestationNumber = parseInt(attestationMatch[1], 10);
        const attestationName = dropDot(attestationMatch[2].trim());

        // Determine semester based on attestation number (usually 1 or 2)
        const semester = attestationNumber > 2 ? 2 : 1;
        
        currentAttestation = { number: attestationNumber, name: attestationName, semester };
        attestations.push({ name: attestationName, semester });
        continue;
      }
      
      // Check for topic: "Тема 1. Вступ до аналізу даних..."
      if (topicMatch?.[1] && topicMatch[2] && line) {

        // Save previous topic if exists
        if (currentTopic) {
          const topic = {
            id: -1,
            course_id: -1,
            index: currentTopic.index,
            name: currentTopic.name,
            lection: '',
            data: {
              attestation: currentAttestation?.number || 1,
              fulltime: { hours: 0, practical_hours: 0, srs_hours: 0 },
              inabscentia: { hours: 0, practical_hours: 0, srs_hours: 0 }
            },
            generated: { 
              subtopics: currentTopic.subtopics.map(s => s.trim()).map(s => s.endsWith('.') ? s.substring(0, s.length - 1) : s) 
            }
          };

          topics.push(fillTopicHours(topic, structureTable));
        }
        
        const topicNumber = parseInt(topicMatch[1], 10);
        const topicName = dropDot(topicMatch[2]);
        currentTopic = { index: topicNumber, name: topicName, subtopics: [] };
        continue;
      }
      
      // If we have a current topic and the line doesn't match attestation or topic pattern,
      // it's likely content for the current topic
      if (currentTopic && !attestationMatch && !topicMatch && line) {
        line.split('.').map(s => s.trim()).forEach(s => {
          if (s.length > 0) currentTopic?.subtopics.push(s)
        });
      }
    }
    
    // Save the last topic if exists
    if (currentTopic) {
      topics.push(fillTopicHours({
        id: -1,
        course_id: -1,
        index: currentTopic.index,
        name: currentTopic.name,
        lection: '',
        data: {
          attestation: currentAttestation?.number || 1,
          fulltime: { hours: 0, practical_hours: 0, srs_hours: 0 },
          inabscentia: { hours: 0, practical_hours: 0, srs_hours: 0 }
        },
        generated: {
          subtopics: currentTopic.subtopics.map(s => s.trim()).map(s => s.endsWith('.') ? s.substring(0, s.length - 1) : s)
        }
      }, structureTable));
    }

    // search джерела or література from the end of the text
    const literatureStart = Math.max(text.lastIndexOf("джерела"), text.lastIndexOf("літерат"));
    const literaturePart = text.substring(literatureStart);

    const mainLitMatch = literaturePart.match(/Основні+([\s\S]*?)(?=Додаткові|Інформаційні\.)/i);
    const addLitMatch = literaturePart.match(/Додаткові\s+([\s\S]*?)(?=Інформаційні|$)/i);
    const internetMatch = literaturePart.match(/Інформаційні\s+ресурси?\s+([\s\S]*?)$/i);

    const literature = {
      main: mainLitMatch?.[1] ? normalizeLiterature(mainLitMatch[1]) : [],
      additional: addLitMatch?.[1] ? normalizeLiterature(addLitMatch[1]) : [],
      internet: internetMatch?.[1] ? normalizeLiterature(internetMatch[1]) : []
    };

    // Create Course object
    const course: Course & ParsedData = {
      id: -1,      
      name,
      teacher_id: teacher.id,
      specialty_id: specInfo.specialtyId,
      data: {
        ok_no: initialInfo?.okNo ?? null,
        optional,
        control_type: controlType,
        hours,
        credits,
        specialty: specInfo.specialtyFormatted,
        specialty_mode: specInfo.specialtyMode,
        area: specInfo.area ?? "",
        description: "",
        prerequisites,
        postrequisites,
        results: results.ids,
        attestations,
        fulltime: semesters.fulltime,
        inabscentia: semesters.inabscentia,
        literature
      },
      generated: null,
      type: 'program',
      topics: topics,
      parsed_teacher: teacher,
      parse_warnings: warnings
    };

    return course;
  } catch (error) {
    console.error("Error parsing program:", error);
    return null;
  }
}

async function docx2text<T>(filepath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filepath);
  const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
  return value;
}

async function pdf2text(filepath: string): Promise<string> {
  try {
  const fileBuffer = await fs.readFile(filepath);
  const pdf = new PDFParse({ data: fileBuffer });
    const text = await pdf.getText();
    return text.text || "";
  } catch (error) {
    console.error("Error parsing PDF:", error);
    return "";
  }
}

export async function file2text(filepath: string): Promise<string> {
  if (filepath.endsWith(".pdf")) {
    return await pdf2text(filepath);
  } else {
    return await docx2text(filepath);
  }
}


async function parseSylabusOrProgramResults(text: string): Promise<{ ids: number[], warnings: string[] }> {
  const allResults = await courseResults.all();
  const warnings: string[] = [];
    
  const ids = Array.from(text.matchAll(/(ЗК|СК|РН|ПРН|ПР)\s?(\d+)\.?\s(.*)[\.\n]/g)).map(m => {
    const type = m[1] === "ПРН" || m[1] === "ПР" ? "РН" : m[1];
    const no = parseInt(m[2] || "-1");
    const result = allResults.find(r => r.type === type && r.no === no);
    const nameNormalized = normalizeWhitespaces(dropDot(m[3] ?? 'failed to parse')).toLowerCase().replace(';', '');

    if (result && result?.name?.toLowerCase() !== nameNormalized) {
      warnings.push(`Результат навчання не співпадає з базою: "${nameNormalized}" vs "${result?.name}"`);
    }

    return result?.id;      
  }).filter(r => r !== undefined) || [] as number[];

  return { ids, warnings };
}

export async function parseSpecialtyAndArea(text: string): Promise<SpecialtyInfo> {
  let specialtyName: string | null = null;
  let specialtyCode: string | null = null;
  let oldCode: string | null = null;
  let oldSpecialtyName: string | null = null;
  let area: string | null = null;
  let warnings: string[] = [];

  const areaMatch = text.match(/Галузь\s+знань\s+([^\n]+)/i);

  if (areaMatch?.[1]) {
    let areaText = areaMatch[1].trim();    
    if (areaText.includes('/')) {
      area = areaText;
    } else {
      const areaCodeMatch = areaText.match(/^(\d+|F)\s+(.+)$/);
      if (areaCodeMatch && areaCodeMatch[1] && areaCodeMatch[2]) {
        const code = areaCodeMatch[1];
        const name = areaCodeMatch[2].trim();
        area = `${code} – ${name}`;
      } else {
        area = areaText;
      }
    }
  }

  const specialtyMatch = text.match(/Спеціальність:?\s+([^\n]+)/i);
  const isNewCode = (code: string) => /^[A-Z]\d{1,2}$/i.test(code);

  if (specialtyMatch?.[1]) {
    let specialtyText = specialtyMatch[1].trim();

    const specRegex = /(\d{2,3}|\w\d{1,2})\s?[«"]?([А-Яа-я'’іїєґ\s]+)[»"]?(\s?\/\s?(\d{2,3}|\w\d{1,2}) [«"]?([А-Яа-я'’іїєґ\s]+)[»"]?)?/i;
    const specMatch = specialtyText.match(specRegex);
    

    if (specMatch) {
      const code1 = specMatch[1] ?? null;
      const name1 = specMatch[2]?.trim()  ?? null;
      
      const code2 = specMatch[4] ?? null;
      const name2 = specMatch[5]?.trim() ?? null;


      specialtyName = name1;
      specialtyCode = code1;

      // has both old and new specialty
      if (code1 && code2 && name2) {
        
        if (!isNewCode(code1)) { // numbers only code is an old format
          oldCode = code1;
          oldSpecialtyName = name1;
          specialtyName = name2;
          specialtyCode = code2;
        } else {
          oldCode = code2;
          oldSpecialtyName = name2;
        }        
      }
    }    
  }

  let spec = specialtyCode ? await specialties.findByCode(specialtyCode) : null;
  if (!spec && oldCode) spec = await specialties.findByCode(oldCode);

  if (!spec) {
    warnings.push(`Спеціальність не знайдена: ${specialtyCode || '???'} ${specialtyName || ''}`.trim());
  } else {
    // Some people using ' instead of apostrophe
    if (spec.name.replaceAll("’", "'") !== specialtyName?.replaceAll("’", "'")) {
      warnings.push(`Назва спеціальності не співпадає з базою: "${specialtyName}" vs "${spec.name}"`);
    }
  }

  const specialtyMode = (specialtyCode && oldCode) ? 'both' : 
    specialtyCode ? (isNewCode(specialtyCode) ? 'new_only' : 'old_only') : 'unknown';

  const formatted = (oldCode && oldSpecialtyName)
    ? `${oldCode} – ${oldSpecialtyName} / ${specialtyCode} – ${specialtyName}`
    : (specialtyCode && specialtyName) ? `${specialtyCode} – ${specialtyName}` : '';

  const data = {
    specialtyName, 
    area, 
    specialtyCode, 
    specialtyOldCode: oldCode, 
    specialtyOldName: oldSpecialtyName, 
    specialtyId: spec?.id ?? null,
    specialtyMode,
    specialtyFormatted: formatted,
    warnings
  } as SpecialtyInfo;

  return data;
}