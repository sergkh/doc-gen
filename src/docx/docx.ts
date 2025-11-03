import { readFile } from "fs/promises";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import path from "path";
import type { MethodData, ProgramData } from "@/generator";
import expressionParser from "docxtemplater/expressions.js";

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

// shorten name from LastName FirstName MiddleName to LastName F. M.
const shortenName = (name: string) => {
  const parts = name.split(" ");
  return parts[0] + " " + parts.slice(1).map(b => b.slice(0, 1).toUpperCase() + ".").join(" ")
}

const parser = expressionParser.configure({
  filters: {
      uppercase(input) {
          if (!input) return input;
          return input.toUpperCase();
      },
      join(input) {
        console.log("join", input);
        if (!input || !Array.isArray(input)) return input;
        return input.join(", ")
      },
      shortName(input) {
        if (!input) return input;
        
        if (Array.isArray(input)) {
          console.log("Short name arr", input)
          return input.map(n => shortenName(n))
        }

        console.log("Short name not arr:", input)
        return shortenName(input);
      }
  },
});

async function renderDoc(template: string, data: any): Promise<ArrayBuffer> {  
  const content = await readFile(
    path.resolve(__dirname, "templates", template),
    "binary"
  );
  
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    parser,
    paragraphLoop: true,
    linebreaks: true
  });

  const extra = {    
    year: new Date().getFullYear()
  }

  await doc.renderAsync(Object.assign(data, extra, helpers));

  return doc.toArrayBuffer()
}

export function renderSelfMethod(data: MethodData): Promise<ArrayBuffer> {
  return renderDoc("method.docx", data);
}

export function renderProgram(data: ProgramData): Promise<ArrayBuffer> {
  return renderDoc("program.docx", data);
}