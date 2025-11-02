import { readFile } from "fs/promises";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import fs from "fs";
import path from "path";
import type { MethodData } from "@/generator";

const helpers = {
  pageBreak: `<w:p><w:br w:type="page" /></w:p>`,
  sectionBreak: `<w:p>
  <w:pPr>
    <w:sectPr>
      <w:type w:val="nextPage"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
      <w:cols w:num="1"/>
    </w:sectPr>
  </w:pPr>
</w:p>`
}

export async function renderMethodDoc(data: MethodData): Promise<ArrayBuffer> {  
  const content = await readFile(
    path.resolve(__dirname, "templates", "method.docx"),
    "binary"
  );
  
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  });

  // Docxtemplater doen't have any functions or similar, so we have to manually add extra params
  const extra = {
    disciplineCaps: data.discipline.toUpperCase(),
    year: new Date().getFullYear()
  }

  await doc.renderAsync(Object.assign(data, extra, helpers));

  return doc.toArrayBuffer()
}