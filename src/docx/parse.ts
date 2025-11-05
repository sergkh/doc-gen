import mammoth from 'mammoth';
import fs from 'fs/promises';

export interface DocParser<T> {
  parse: (text: string) => T;
}

export async function parseDocx<T>(filepath: string, parser: DocParser<T>): Promise<T> {
    const fileBuffer = await fs.readFile(filepath);
    const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
    return parser.parse(value);
}