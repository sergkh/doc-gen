import type { CourseResult, Specialty } from "@/stores/models";
import { file2text } from "./parse";
import { extractInformationAI } from "@/ai/extractor";
import { specialties } from "@/stores/db";

export type OPPCourse = {
  name: string;
  ok: number;
}

export type OPP ={
  specialResults: CourseResult[];
  generalResults: CourseResult[];
  programResults: CourseResult[];
}

const specialtyPrompt = `
  З переданого тексту вибери спеціальність, її код, галузь знань та її код та кваліфікацію.
  Якщо щось не вказане, поверни null. Результат поверни у вигляді JSON: { specialty: string, code: string, area_code: string, area: string, qualification: string }.
  Текст:"{{text}}"
`;

type SpecialtyExtraction = {
  specialty: string | null;
  code: string | null;
  area_code: string | null;
  area: string | null;
  qualification: string | null;
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
      results.push({ id: -1, no, type, name, specialty_id: 0 });
    }
  }
  
  results.sort((a, b) => a.no - b.no);
  
  return results;
}

export async function parseOPP(filepath: string): Promise<OPP | null> {
  try {    
    const text = await file2text(filepath);
    
    const header = text.substring(0, 1000);
    const extractedSpecialty = await extractInformationAI<SpecialtyExtraction>(header, specialtyPrompt);
    
    console.log("Extracted specialty:", extractedSpecialty);

    let specialty = extractedSpecialty.code ? await specialties.findByCode(extractedSpecialty.code) : extractedSpecialty.specialty ? await specialties.findByName(extractedSpecialty.specialty) : null;

    if (!specialty) {
      console.error("Adding new specialty:", extractedSpecialty);

      specialty = {
        id: 0,
        name: extractedSpecialty.specialty || "",
        code: extractedSpecialty.code || "",
        area_code: extractedSpecialty.area_code || "",
        area: extractedSpecialty.area || "",
        qualification: extractedSpecialty.qualification || "",
      } as Specialty

      const addResult = await specialties.add(specialty);
      
      specialty.id = addResult[0].id;
    }

    const generalResults = parseOPPResults(text, 'ЗК');
    const specialResults = parseOPPResults(text, 'СК');
    const programResults = parseOPPResults(text, 'РН');

    [...generalResults, ...specialResults, ...programResults].forEach(result => {
      result.specialty_id = specialty.id;
    });

    return { generalResults, specialResults, programResults } as OPP;
  } catch (error) {
    console.error("Error parsing OPP:", error);
    return null;
  }
}