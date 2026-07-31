import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Document as XmlDocument, Element as XmlElement } from "@xmldom/xmldom";
import PizZip from "pizzip";

function getDirectChild(element: XmlElement, tagName: string): XmlElement | null {
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child?.nodeType === 1 && (child as XmlElement).tagName === tagName) {
      return child as XmlElement;
    }
  }

  return null;
}

function ensureStartOverride(
  numberingDoc: XmlDocument,
  numberingInstance: XmlElement,
  level: string
): void {
  let levelOverride: XmlElement | null = null;

  for (let i = 0; i < numberingInstance.childNodes.length; i++) {
    const child = numberingInstance.childNodes[i];
    if (
      child?.nodeType === 1 &&
      (child as XmlElement).tagName === "w:lvlOverride" &&
      (child as XmlElement).getAttribute("w:ilvl") === level
    ) {
      levelOverride = child as XmlElement;
      break;
    }
  }

  if (!levelOverride) {
    levelOverride = numberingDoc.createElement("w:lvlOverride");
    levelOverride.setAttribute("w:ilvl", level);
    numberingInstance.appendChild(levelOverride);
  }

  let startOverride = getDirectChild(levelOverride, "w:startOverride");
  if (!startOverride) {
    startOverride = numberingDoc.createElement("w:startOverride");
    const levelDefinition = getDirectChild(levelOverride, "w:lvl");
    levelOverride.insertBefore(startOverride, levelDefinition);
  }

  startOverride.setAttribute("w:val", "1");
}

/**
 * Give every contiguous list block its own numbering instance.
 *
 * Docxtemplater duplicates a template paragraph's w:numId when it expands a
 * loop. Word then sees list paragraphs in separate generated sections as the
 * same list and continues their counters. In WordprocessingML, restarting is
 * expressed in word/numbering.xml with a new w:num plus w:lvlOverride /
 * w:startOverride, not with a paragraph-level w:numRestart element.
 */
export function resetListNumbering(zip: PizZip): void {
  const documentXml = zip.files["word/document.xml"];
  const numberingXml = zip.files["word/numbering.xml"];
  if (!documentXml || !numberingXml) return;

  const domParser = new DOMParser();
  const documentDoc = domParser.parseFromString(documentXml.asText(), "text/xml");
  const numberingDoc = domParser.parseFromString(numberingXml.asText(), "text/xml");
  const numberingRoot = numberingDoc.documentElement;
  if (!numberingRoot) return;

  const numberingInstances = Array.from(numberingDoc.getElementsByTagName("w:num"));
  const numberingById = new Map<string, XmlElement>();
  let nextNumberingId = 1;

  for (const numberingInstance of numberingInstances) {
    const id = numberingInstance.getAttribute("w:numId");
    if (!id) continue;

    numberingById.set(id, numberingInstance);
    const numericId = Number.parseInt(id, 10);
    if (Number.isFinite(numericId)) {
      nextNumberingId = Math.max(nextNumberingId, numericId + 1);
    }
  }

  const paragraphs = Array.from(documentDoc.getElementsByTagName("w:p"));
  if (paragraphs.length === 0) return;

  let currentSourceNumberingId: string | null = null;
  let currentNumberingInstance: XmlElement | null = null;
  let changed = false;

  for (const paragraph of paragraphs) {
    const pPr = getDirectChild(paragraph, "w:pPr");
    if (!pPr) {
      currentSourceNumberingId = null;
      currentNumberingInstance = null;
      continue;
    }

    const numPr = getDirectChild(pPr, "w:numPr");
    if (!numPr) {
      currentSourceNumberingId = null;
      currentNumberingInstance = null;
      continue;
    }

    const numIdElement = getDirectChild(numPr, "w:numId");
    const sourceNumberingId = numIdElement?.getAttribute("w:val");
    if (!numIdElement || !sourceNumberingId) {
      currentSourceNumberingId = null;
      currentNumberingInstance = null;
      continue;
    }

    if (sourceNumberingId !== currentSourceNumberingId || !currentNumberingInstance) {
      const sourceNumberingInstance = numberingById.get(sourceNumberingId);
      if (!sourceNumberingInstance) {
        currentSourceNumberingId = null;
        currentNumberingInstance = null;
        continue;
      }

      currentSourceNumberingId = sourceNumberingId;
      currentNumberingInstance = sourceNumberingInstance.cloneNode(true) as XmlElement;
      currentNumberingInstance.setAttribute("w:numId", String(nextNumberingId++));

      const cleanupMarker = getDirectChild(numberingRoot, "w:numIdMacAtCleanup");
      numberingRoot.insertBefore(currentNumberingInstance, cleanupMarker);
    }

    const level = getDirectChild(numPr, "w:ilvl")?.getAttribute("w:val") ?? "0";
    ensureStartOverride(numberingDoc, currentNumberingInstance, level);
    numIdElement.setAttribute("w:val", currentNumberingInstance.getAttribute("w:numId")!);
    changed = true;
  }

  if (!changed) return;

  const serializer = new XMLSerializer();
  zip.file("word/document.xml", serializer.serializeToString(documentDoc));
  zip.file("word/numbering.xml", serializer.serializeToString(numberingDoc));
}
