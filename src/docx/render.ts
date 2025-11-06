import { readFile } from "fs/promises";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import path from "path";
import expressionParser from "docxtemplater/expressions.js";
import type { Course, CourseGenerationData, CourseTopic } from "@/stores/models";
import { generateCourseInfo } from "@/ai/generator";

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

// Helper functions that can be used in templates like:
// { someArray | join }
const parser = expressionParser.configure({
  filters: {
      uppercase(input) {
          if (!input) return input;
          if (Array.isArray(input)) return input.map(i => i.toUpperCase());
          return input.toUpperCase();
      },
      join(input, separator = ", ") {
        if (!input || !Array.isArray(input)) return input;
        return input.join(separator)
      },
      len(input) {
        if (!input || !Array.isArray(input)) return 1;
        return input.length;
      },
      zero2dash(input) {
        if (!input) return input;
        if(input === 0 || input === "0") return "-";
        return input;
      },
      capitalize(input) {
        if (!input) return input;
        if (Array.isArray(input)) {
          return input.map(i => i.charAt(0).toUpperCase() + i.slice(1));
        }
        return input.charAt(0).toUpperCase() + input.slice(1);
      },
      shortName(input) {
        if (!input) return input;        
        if (Array.isArray(input)) return input.map(n => shortenName(n))
        return shortenName(input);
      }
  }
});

export async function renderDoc(templatePath: string, data: any): Promise<ArrayBuffer> {
  
  // write data to file for debugging
  try {
    await Bun.write(path.join(process.cwd(), "uploads", "data.json"), JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing data to file:", error);
  }

  const fullPath = path.resolve(process.cwd(), templatePath);
  const content = await readFile(fullPath, "binary");
  
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