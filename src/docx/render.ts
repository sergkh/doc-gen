import { readFile } from "fs/promises";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import path from "path";
import expressionParser from "docxtemplater/expressions.js";
import type { Course, CourseGenerationData, CourseTopic } from "@/stores/models";
import { generateCourseInfo } from "@/ai/generator";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const helpers = {
  pageBreak: `<w:p><w:br w:type="page" /></w:p>`
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
      }
  }
});

/**
 * Post-processor to reset list numbering so each list starts from 1
 * Processes the document after Docxtemplater rendering
 */
function resetListNumbering(zip: PizZip): void {
  const documentXml = zip.files["word/document.xml"];
  if (!documentXml) return;
  const xmlContent = documentXml.asText();
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(xmlContent, "text/xml");

  // Find all paragraphs
  const paragraphs = doc.getElementsByTagName("w:p");
  if (!paragraphs || paragraphs.length === 0) return;
  console.log("paragraphs", paragraphs.length);
  let currentListKey: string | null = null;
  let listStartIndex: number | null = null;

  // Process each paragraph
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    if (!para) continue;

    // Find pPr (paragraph properties)
    const pPrElements = para.getElementsByTagName("w:pPr");
    if (!pPrElements || pPrElements.length === 0) {
      // No paragraph properties - reset list tracking
      currentListKey = null;
      listStartIndex = null;
      continue;
    }

    const pPr = pPrElements[0];
    if (!pPr) {
      currentListKey = null;
      listStartIndex = null;
      continue;
    }
    
    // Find numPr (numbering properties)
    const numPrElements = pPr.getElementsByTagName("w:numPr");
    if (!numPrElements || numPrElements.length === 0) {
      // No numbering - reset list tracking
      currentListKey = null;
      listStartIndex = null;
      continue;
    }

    const numPr = numPrElements[0];
    if (!numPr) {
      currentListKey = null;
      listStartIndex = null;
      continue;
    }
    
    // Extract numId and ilvl to create a unique key for this list
    const numIdElements = numPr.getElementsByTagName("w:numId");
    const ilvlElements = numPr.getElementsByTagName("w:ilvl");
    
    const numId = numIdElements && numIdElements.length > 0 && numIdElements[0]
      ? numIdElements[0].getAttribute("w:val") 
      : null;
    const ilvl = ilvlElements && ilvlElements.length > 0 && ilvlElements[0]
      ? ilvlElements[0].getAttribute("w:val") 
      : null;
    
    const listKey = `${numId || ""}_${ilvl || ""}`;
    
    // Check if this is the start of a new list
    const prevPara = i > 0 ? paragraphs[i - 1] : null;
    const prevHasNumPr = prevPara ? prevPara.getElementsByTagName("w:numPr").length > 0 : false;
    
    const isNewList = 
      currentListKey === null || // First numbered paragraph
      currentListKey !== listKey || // Different list (different numId or ilvl)
      !prevHasNumPr; // Previous paragraph had no numbering

    if (isNewList) {
      // This is the start of a new list
      currentListKey = listKey;
      listStartIndex = i;
      
      // Check if numRestart already exists
      const numRestartElements = numPr.getElementsByTagName("w:numRestart");
      if (!numRestartElements || numRestartElements.length === 0) {
        // Create numRestart element
        const numRestart = doc.createElement("w:numRestart");
        numRestart.setAttribute("w:val", "1");
        
        // Insert numRestart into numPr (after numId or ilvl if they exist)
        if (numIdElements && numIdElements.length > 0 && numIdElements[0]) {
          const nextSibling = numIdElements[0].nextSibling;
          numPr.insertBefore(numRestart, nextSibling);
        } else if (ilvlElements && ilvlElements.length > 0 && ilvlElements[0]) {
          const nextSibling = ilvlElements[0].nextSibling;
          numPr.insertBefore(numRestart, nextSibling);
        } else {
          // No numId or ilvl, just append
          numPr.appendChild(numRestart);
        }
      }
    }
  }

  // Serialize back to XML
  const serializer = new XMLSerializer();
  const updatedXml = serializer.serializeToString(doc);
  
  // Update the zip file
  zip.file("word/document.xml", updatedXml);
}

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

  // Post-process: reset list numbering, doesn't work yet
  //resetListNumbering(doc.getZip());

  return doc.toArrayBuffer()
}