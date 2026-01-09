import type { CourseResult, Specialty, SpecialtyDisciplineConfig } from "@/stores/models";
import { z } from "zod";
import { file2text } from "./parse";
import { extractInformationAI } from "@/ai/extractor";
import { specialties } from "@/stores/db";
import { extractDocTables, findFirstTable, findNextTable, findNextTableRow, findTableRow, type DocTable } from "./structured-parser";
import { find } from "node_modules/cheerio/dist/esm/api/traversing";
import { dropDot, normalizeWhitespaces } from "@/parsing/utils";

export type OPPCourse = {
  name: string;
  ok: number;
}

export type OPP ={
  integralResults: CourseResult[];
  specialResults: CourseResult[];
  generalResults: CourseResult[];
  programResults: CourseResult[];
  disciplines: SpecialtyDisciplineConfig[];
  specialty: Specialty;
}

const specialtyPrompt = `
  З переданого тексту вибери спеціальність (specialty), її код (code), галузь знань (area) та її код (area_code) та кваліфікацію (qualification). Якщо щось не вказане, поверни null.
`;

const SpecialtyExtraction = z.object({
  specialty: z.string().nullable(),
  code: z.string().nullable(),
  area_code: z.string().nullable(),
  area: z.string().nullable(),
  qualification: z.string().nullable()
});

function parseDisciplinesTable(table: DocTable | null): SpecialtyDisciplineConfig[] {
  if (!table) return [];

  let disciplineRow = findTableRow(table, "ОК 1");  
  let disciplines: SpecialtyDisciplineConfig[] = [];

  while (disciplineRow) {
    const numRow = disciplineRow[0]?.replace(/\D+\.?/, '').trim();
    const nameRow = disciplineRow[1]?.trim();
    const creditsRow = disciplineRow[2]?.trim().replace(/^\d+\./, '').trim();
    const controlTypeRow = disciplineRow[3]?.trim().toLowerCase() ?? "";

    const controlType = controlTypeRow.includes("екз") ? 
      (controlTypeRow.includes("зал") ? "both" : "exam") : "credit";

    disciplines.push({
      no: numRow ?? '-',
      name: nameRow ?? "",
      credits: parseInt(creditsRow ?? '0'),
      control_type: controlType
    });

    disciplineRow = findNextTableRow(table, disciplineRow, "ОК");
  }

  return disciplines;
}

export function parseOPPResults(text: string, type: 'ЗК' | 'СК' | 'РН'): CourseResult[] {
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
      results.push({ id: -1, no, type, name: normalizeWhitespaces(dropDot(name)), specialty_id: 0 });
    }
  }
  results.sort((a, b) => a.no - b.no);
  
  return results;
}

export function parseOPPIntegralResult(table: DocTable | null): CourseResult[] {
  if (!table) return [];
  
  const ikRow = findTableRow(table, "Інтегральна компетентність");

  if (!ikRow) return [];

  if (ikRow[1]) return [ {
    id: -1,
    no: 1,
    type: "ІК",
    name: normalizeWhitespaces(dropDot(ikRow[1])),
    specialty_id: 0
  }];

  return [];
}

export async function parseOPP(filepath: string): Promise<OPP | null> {
  try {    
    const text = await file2text(filepath);
    
    const header = text.substring(0, 1000);
    const extractedSpecialty = await extractInformationAI(specialtyPrompt, header, SpecialtyExtraction);

    if (!extractedSpecialty) {
      throw Error("Failed to extract specialty from header");
    }
    
    console.log("Extracted specialty:", extractedSpecialty);

    const docTables = await extractDocTables(filepath);

    const disciplinesTable = findFirstTable(docTables, "Компоненти освітньої програми", "Обов’язкові компоненти");
    const disciplinesTablePt2 = findNextTable(docTables, disciplinesTable, "Компоненти освітньої програми", "Обов’язкові компоненти");

    const disciplines = parseDisciplinesTable(disciplinesTable).concat(parseDisciplinesTable(disciplinesTablePt2));

    const specialty = {
      id: -1,
      name: extractedSpecialty.specialty || "",
      code: extractedSpecialty.code || "",
      area_code: extractedSpecialty.area_code || "",
      area: extractedSpecialty.area || "",
      qualification: extractedSpecialty.qualification || "",
      data: { disciplines }
    } as Specialty

    const resultsTable = findFirstTable(docTables, "Програмні компетентності");

    const integralResults = parseOPPIntegralResult(resultsTable);
    const generalResults  = parseOPPResults(text, 'ЗК');
    const specialResults  = parseOPPResults(text, 'СК');
    const programResults  = parseOPPResults(text, 'РН');

    return { generalResults, specialResults, programResults, integralResults, disciplines, specialty } as OPP;
  } catch (error) {
    console.error("Error parsing OPP:", error);
    return null;
  }
}