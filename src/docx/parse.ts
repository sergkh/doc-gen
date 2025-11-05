import mammoth from 'mammoth';
import fs from 'fs/promises';
import type { CourseResult } from '@/stores/models';
// @ts-ignore
import docx4js from "docx4js";

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


async function docx2text<T>(filepath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filepath);
  const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
  return value;
}
