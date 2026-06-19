import mammoth from 'mammoth';
import fs from 'fs/promises';
import { PDFParse } from 'pdf-parse';

export async function docx2text<T>(filepath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filepath);
  const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
  return value;
}

export async function pdf2text(filepath: string): Promise<string> {
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