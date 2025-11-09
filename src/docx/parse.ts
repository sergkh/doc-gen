import mammoth from 'mammoth';
import fs from 'fs/promises';
import type { Course, CourseResult, CourseTopic, GeneratedTopicData, ParsedData } from '@/stores/models';
// @ts-ignore
import docx4js from "docx4js";
import path from 'path';
import { courseResults, teachers } from '@/stores/db';

export type OPPCourse = {
  name: string;
  ok: number;
}

export type OPP ={
  specialResults: CourseResult[];
  generalResults: CourseResult[];
  programResults: CourseResult[];
}

export async function parseOPP(filepath: string): Promise<OPP | null> {
  try {
    const text = await docx2text(filepath);
    
    const generalResults = parseResults(text, 'ЗК');
    const specialResults = parseResults(text, 'СК');
    const programResults = parseResults(text, 'РН');
    
    return { generalResults, specialResults, programResults } as OPP;
  } catch (error) {
    console.error("Error parsing OPP:", error);
    return null;
  }
}

export async function parseSylabusOrProgram(filepath: string): Promise<Course & ParsedData | null> {
  try {
    const text = (await docx2text(filepath)).trim();
    if (/СИЛАБУС/g.test(text.substring(0, 200))) {
      return await parseSylabus(text);
    } else if (/РОБОЧА ПРОГРАМА/g.test(text.substring(0, 400))) {
      return await parseProgram(text);
    }

    return null;
  } catch (error) {
    console.error("Error parsing Sylabus:", error);
    return null;
  }
}

export function parseResults(text: string, type: 'ЗК' | 'СК' | 'РН'): CourseResult[] {
  const results: CourseResult[] = [];

  // They all ends with a dot or a newline.
  const pattern = new RegExp(`${type}(\\d+)\\*?\\.?\\s{0,2}([ʼ\\s\\S]*?)(\\.|\\n)`, 'gs');
  
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (!match[1] || !match[2]) continue;
    
    const no = parseInt(match[1], 10);
    let name = match[2].trim();
    
    name = name.replace(/\s*(ЗК|СК|РН)\s*\d+\.?\s*$/, '').trim();    
    name = name.replace(/\s+/g, ' ').trim();
    
    if (name) {
      results.push({ id: -1, no, type, name });
    }
  }
  
  results.sort((a, b) => a.no - b.no);
  
  return results;
}


// Best effort parsing of syllabus
async function parseSylabus(text: string): Promise<Course & ParsedData | null> {
  try {
    console.log("Parsing syllabus:");
    // approx first 500 characters of the text
    const header = text.substring(0, 500);

    const nameMatch = header.match(/«([^»]+)»/);
    const parsedName = (nameMatch?.[1]?.trim() || "");
    const name = parsedName.charAt(0).toUpperCase() + parsedName.slice(1).toLowerCase();

    if (!name) {
      console.error("Could not find course name");
      return null;
    }

    // Extract specialty
    const specialtyMatch = header.match(/Спеціальність:\s*(\d+\s+[^\n]+)/i);
    const specialty = specialtyMatch?.[1]?.trim() || "";

    const area = (specialty.includes("122") ? "12" : "F") +  " – «Інформаційні технології»";

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
    const optional = /вибірков/i.test(text) || /факультатив/i.test(text);

    // Extract lecturer name and email
    const lecturerMatch = text.match(/Лектор курсу\s+([^\n]+)/i);
    const lecturer = lecturerMatch?.[1]?.trim() || "";
    
    // stupid, but works: take last 3 words
    const lecturerName = lecturer.split(' ').slice(-3).join(' ');
    
    const emailMatch = text.match(/e-mail[\)]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const email = emailMatch?.[1]?.trim() || "";

    // TODO: might not always work
    let teacher = await teachers.findByName(lecturerName);    
    
    if (!teacher) {
      // Create new teacher
      teacher = { id: 0, name: lecturerName, email }
      console.log("Creating new teacher:", teacher);
      const id = (await teachers.add(teacher))[0].id;
      teacher.id = id;
    }

    // Extract prerequisites (from "При вивченні даної дисципліни використовуються знання, отримані з таких дисциплін")
    // Note: We can't match prerequisites by name alone, so we'll leave this empty
    const prerequisites: number[] = [];

    // Extract postrequisites (from "Основні положення навчальної дисципліни можуть застосовуватися при вивченні дисципліни")
    // Note: We can't match postrequisites by name alone, so we'll leave this empty
    const postrequisites: number[] = [];

    // Parse results (ЗК, СК, РН)
    const resultsPart = text.substring(text.indexOf("КОМПЕТЕНТН"), text.indexOf("ПЛАН"));
    const allResults = await courseResults.all();
    
    const results: number[] = Array.from(resultsPart.matchAll(/(ЗК|СК|П?РН)\s?(\d+)\.?\s/g)).map(m => {
      const type = m[1] === "ПРН" ? "РН" : m[1];
      const no = parseInt(m[2] || "-1");
      const result = allResults.find(r => r.type === type && r.no === no);
      return result?.id;      
    }).filter(r => r !== undefined) || [];

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

    // Parse literature
    const literature = {
      main: [] as string[],
      additional: [] as string[],
      internet: [] as string[]
    };

    // Extract main literature
    const mainLitMatch = text.match(/Основна література\s+([\s\S]*?)(?=Додаткова література|Інтернет|СИСТЕМА)/i);
    if (mainLitMatch?.[1]) {
      const mainLitText = mainLitMatch[1];
      const mainLines = mainLitText.split(/\n/).map(l => l.trim()).filter(l => l && !/^\d+\./.test(l));
      literature.main = mainLines.filter(l => l.length > 10); // Filter out very short lines
    }

    // Extract additional literature
    const addLitMatch = text.match(/Додаткова література\s+([\s\S]*?)(?=Інтернет|СИСТЕМА)/i);
    if (addLitMatch?.[1]) {
      const addLitText = addLitMatch[1];
      const addLines = addLitText.split(/\n/).map(l => l.trim()).filter(l => l && !/^\d+\./.test(l));
      literature.additional = addLines.filter(l => l.length > 10);
    }

    // Extract internet resources
    const internetMatch = text.match(/Інтернет\s+ресурси?\s+([\s\S]*?)(?=СИСТЕМА|$)/i);
    if (internetMatch?.[1]) {
      const internetText = internetMatch[1];
      const internetLines = internetText.split(/\n/).map(l => l.trim()).filter(l => l && l.length > 5);
      literature.internet = internetLines.filter(l => /http/i.test(l) || l.length > 10);
    }

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
      data: {
        optional,
        control_type: controlType,
        hours,
        credits,
        specialty,
        area,
        description: "",
        prerequisites,
        postrequisites,
        results,
        attestations,
        fulltime: {
          semesters: [semester],
          study_year: studyYear
        },
        inabscentia: {
          semesters: [],
          study_year: 1
        },
        literature
      },
      generated: null,
      type: 'syllabus',
      topics: []
    };


    console.log("Parsed syllabus:", course);

    return course;
  } catch (error) {
    console.error("Error parsing syllabus:", error);
    return null;
  }
}

async function parseProgram(text: string): Promise<Course & ParsedData | null> {
  try {
    console.log("Parsing program:");
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

    // Extract specialty
    const specialtyMatch = header.match(/Спеціальність\s+(\d+)\s*«([^»]+)»/i);
    const specialty = specialtyMatch ? `${specialtyMatch[1]} – «${specialtyMatch[2]}»` : "";

    // Extract area/direction (from "Галузь знань")
    const areaMatch = header.match(/Галузь знань\s+(\d+)\s+([^\n]+)/i);
    const area = areaMatch?.[1] && areaMatch[2] ? `${areaMatch[1]} – «${areaMatch[2].trim()}»` : "";

    // Extract credits
    const creditsMatch = text.match(/Кількість кредитів\s*[–-]\s*(\d+)/i);
    const credits = creditsMatch?.[1] ? parseInt(creditsMatch[1], 10) : 0;

    // Extract hours
    const hoursMatch = text.match(/Загальна кількість годин\s*[–-]\s*(\d+)/i);
    const hours = hoursMatch?.[1] ? parseInt(hoursMatch[1], 10) : 0;

    // Extract year and semesters (different for fulltime and inabscentia)
    const yearMatch = text.match(/Рік підготовки:\s*(\d+)-й\s*(\d+)-й/i);
    const studyYear = yearMatch?.[1] ? parseInt(yearMatch[1], 10) : 1;

    const semesterMatch = text.match(/Семестр\s*(\d+)-й\s*(\d+)-й/i);
    const fulltimeSemester = semesterMatch?.[1] ? parseInt(semesterMatch[1], 10) : 1;
    const inabscentiaSemester = semesterMatch?.[2] ? parseInt(semesterMatch[2], 10) : 1;

    // Extract control type
    let controlType: "exam" | "credit" | "both" = "credit";
    if (/екзамен/i.test(text)) {
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
    const email = emailMatch?.[1]?.trim() || "";

    // Find or create teacher
    let teacher = teacherName ? await teachers.findByName(teacherName) : null;
    
    if (!teacher && teacherName) {
      // Create new teacher
      teacher = { id: 0, name: teacherName, email: email || "" };
      console.log("Creating new teacher:", teacher);
      const result = await teachers.add(teacher);
      teacher.id = result[0].id;
    }

    if (!teacher) {
      console.error("Could not find or create teacher");
      return null;
    }

    // Extract prerequisites (from "Передумови для вивчення дисципліни")
    // Note: We can't match prerequisites by name alone, so we'll leave this empty
    const prerequisites: number[] = [];

    // Extract postrequisites (if mentioned)
    // Note: We can't match postrequisites by name alone, so we'll leave this empty
    const postrequisites: number[] = [];

    // Parse results (ЗК, СК, РН)
    const allResults = await courseResults.all();
    
    const results = Array.from(text.matchAll(/(ЗК|СК|П?РН)\s?(\d+)\.?\s/g)).map(m => {
      const type = m[1] === "ПРН" ? "РН" : m[1];
      const no = parseInt(m[2] || "-1");
      const result = allResults.find(r => r.type === type && r.no === no);
      return result?.id;      
    }).filter(r => r !== undefined) || [];    

    const programPart = text.substring(text.indexOf("5. Програма"), text.indexOf("6. Структура навчальної дисципліни"));
    console.log("programPart", programPart);
    
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
      const attestationMatch = line.match(/Атестація\s+(\d+)\.?\s+(.+)/i);
      const topicMatch = line.match(/Тема\s+(\d+)\.\s+(.+)/i);
      
      if (attestationMatch?.[1] && attestationMatch[2]) {
        // Save previous topic if exists
        if (currentTopic) {
          topics.push({
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
          });
          currentTopic = null;
        }
        
        const attestationNumber = parseInt(attestationMatch[1], 10);
        const attestationName = attestationMatch[2].trim();

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
          topics.push({
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
          });
        }
        
        const topicNumber = parseInt(topicMatch[1], 10);
        const topicName = topicMatch[2].trim();
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
      topics.push({
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
      });
    }
    
    console.log("Parsed topics:", topics);

    // Parse literature
    const literature = {
      main: [] as string[],
      additional: [] as string[],
      internet: [] as string[]
    };

    const literaturePart = text.substring(Math.min(text.indexOf("джерела"), text.indexOf("літерат")));

    // Extract main literature
    const mainLitMatch = literaturePart.match(/Основні+([\s\S]*?)(?=Додаткові|Інформаційні\.)/i);
    if (mainLitMatch?.[1]) {
      const mainLitText = mainLitMatch[1];
      const mainLines = mainLitText.split(/\n/).map(l => l.trim()).filter(l => l && l.length > 10);
      literature.main = mainLines.sort();
    }

    // Extract additional literature
    const addLitMatch = literaturePart.match(/Додаткові\s+([\s\S]*?)(?=Інформаційні|$)/i);
    if (addLitMatch?.[1]) {
      const addLitText = addLitMatch[1];
      const addLines = addLitText.split(/\n/).map(l => l.trim()).filter(l => l && l.length > 10);
      literature.additional = addLines.sort();
    }

    // Extract internet resources
    const internetMatch = literaturePart.match(/Інформаційні\s+ресурси?\s+([\s\S]*?)$/i);
    if (internetMatch?.[1]) {
      const internetText = internetMatch[1];
      const internetLines = internetText.split(/\n/).map(l => l.trim()).filter(l => l && l.length > 5);
      literature.internet = internetLines.sort();
    }

    // Create Course object
    const course: Course & ParsedData = {
      id: -1,
      name,
      teacher_id: teacher.id,
      data: {
        optional,
        control_type: controlType,
        hours,
        credits,
        specialty,
        area,
        description: "",
        prerequisites,
        postrequisites,
        results,
        attestations,
        fulltime: {
          semesters: [fulltimeSemester],
          study_year: studyYear
        },
        inabscentia: {
          semesters: [inabscentiaSemester],
          study_year: studyYear
        },
        literature
      },
      generated: null,
      type: 'program',
      topics: topics
    };

    console.log("Parsed program:", course);

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
