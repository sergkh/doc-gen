import { readFile } from "fs/promises";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import path from "path";
import expressionParser from "docxtemplater/expressions.js";
import type { AcademicTitle } from "@/stores/models";
import Handlebars from "handlebars";
import { resetListNumbering } from "@/docx/numbering";

const helpers = {
  pageBreak: `<w:p><w:br w:type="page" /></w:p>`
}

// shorten name from LastName FirstName MiddleName to LastName F. M.
const shortenName = (input: string | {name?: string}) => {
  // if we get the full Teacher object, get the name
  if (typeof input === "object" && input.name) return shortenName(input.name);
  
  if (typeof input === "string") {
    const parts = input.split(" ");
    return parts[0] + " " + parts.slice(1).map(b => b.slice(0, 1).toUpperCase() + ".").join(" ");
  }  
  return input;
}

// shorten name from FirstName LASTNAME
const shortenNameAsSignature = (input: string | {name?: string}) => {
  // if we get the full Teacher object, get the name
  if (typeof input === "object" && input.name) return shortenNameAsSignature(input.name);
  
  if (typeof input === "string") {
    const parts = input.split(" ");
    return `${parts[1]} ${parts[0]?.toUpperCase()}`;
  }

  return input;
}

const shortenAcademicTitle = (str: string) => {
  switch(str as AcademicTitle) {
    case 'доктор економічних наук': return 'д.е.н';
    case 'доктор технічних наук': return 'д.т.н';
    case 'кандидат економічних наук': return 'к.е.н';
    case 'кандидат педагогічних наук': return 'к.пед.н';
    case 'кандидат технічних наук': return 'к.т.н';
    case 'кандидат сільськогосподарських наук': return 'к.с.-г.н';
    case 'кандидат філологічних наук': return 'к.філос.н';
    case 'кандидат філософських наук': return 'к.філол.н';
    case 'кандидат юридичних наук': return 'к.ю.н';
    case 'професор': return 'проф.';
    case 'кандидат історичних наук': return 'к.і.н';
    default:
      return str;
  }
}

// Helper functions that can be used in templates like:
// { someArray | join }
const parser = expressionParser.configure({
  filters: {
      iterate(input) {
        const num = Number(input);
        if (isNaN(num)) return input;
        return Array.from({ length: num }, (_, i) => i + 1);
      },
      at(array, index) {
        if (!Array.isArray(array)) return undefined;
        return array[index];
      },
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
      uncapitalize(input) {
        if (!input) return input;
        if (Array.isArray(input)) {
          return input.map(i => i.charAt(0).toLowerCase() + i.slice(1));
        }
        return input.charAt(0).toLowerCase() + input.slice(1);
      },
      endWithDot(input) {
        if (!input) return input;
        if(typeof input !== "string") return input;
        const trimmed = input.trim();
        if(trimmed.endsWith(".")) return trimmed;
        return trimmed + ".";
      },
      shortName(input) {
        if (!input) return input;
        if (Array.isArray(input)) return input.map(n => shortenName(n))
        return shortenName(input);
      },
      signName(input) {
        if (!input) return input;
        if (Array.isArray(input)) return input.map(n => shortenName(n))
        return shortenNameAsSignature(input);
      },
      shortenAcademicTitle(input) {
        if (!input) return input;
        if (Array.isArray(input)) return input.map(n => shortenAcademicTitle(n))
        return shortenAcademicTitle(input);
      }
  }
});

export async function renderDoc(
  templatePath: string, 
  data: any
): Promise<ArrayBuffer> {
  
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

  resetListNumbering(doc.getZip());

  return doc.toArrayBuffer()
}

/** Render any Handlebars template to text */
export async function renderHandlebarsText(templatePath: string, data: any): Promise<ArrayBuffer> {
  const template = await readFile(templatePath, "utf8");

  // Helper: strict equality (coerces numbers if needed)
  Handlebars.registerHelper('ifEquals', function(this: any, a: any, b: any, opts: any) {
    return (String(a) === String(b)) ? opts.fn(this) : opts.inverse(this);
  });

  const hb = Handlebars.compile(template);
  const result = hb(data);
  return new TextEncoder().encode(result).buffer;
}
