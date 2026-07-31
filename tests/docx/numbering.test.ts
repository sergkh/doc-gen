import { describe, expect, it } from "bun:test";
import { DOMParser } from "@xmldom/xmldom";
import PizZip from "pizzip";
import { resetListNumbering } from "@/docx/numbering";

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>First</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>Nested</w:t></w:r></w:p>
    <w:p><w:r><w:t>Separator</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>Restarted</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>Second</w:t></w:r></w:p>
  </w:body>
</w:document>`;

const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="3">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2)"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="7"><w:abstractNumId w:val="3"/></w:num>
</w:numbering>`;

function getNumberingIds(zip: PizZip): string[] {
  const xml = zip.file("word/document.xml")!.asText();
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return Array.from(doc.getElementsByTagName("w:numId"))
    .map((element) => element.getAttribute("w:val"))
    .filter((id): id is string => id !== null);
}

describe("resetListNumbering", () => {
  it("assigns a new numbering instance to each contiguous list block", () => {
    const zip = new PizZip();
    zip.file("word/document.xml", documentXml);
    zip.file("word/numbering.xml", numberingXml);

    resetListNumbering(zip);

    const numberingIds = getNumberingIds(zip);
    expect(numberingIds[0]).toBe(numberingIds[1]);
    expect(numberingIds[2]).toBe(numberingIds[3]);
    expect(numberingIds[0]).not.toBe(numberingIds[2]);
    expect(numberingIds).not.toContain("7");

    const xml = zip.file("word/numbering.xml")!.asText();
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const instances = Array.from(doc.getElementsByTagName("w:num"));
    expect(instances).toHaveLength(3);

    const generatedInstances = instances.slice(1);
    expect(generatedInstances.map((instance) =>
      instance.getElementsByTagName("w:abstractNumId")[0]?.getAttribute("w:val")
    )).toEqual(["3", "3"]);
    expect(generatedInstances[0]!.getElementsByTagName("w:startOverride")).toHaveLength(2);
    expect(generatedInstances[1]!.getElementsByTagName("w:startOverride")).toHaveLength(1);
    for (const instance of generatedInstances) {
      for (const start of Array.from(instance.getElementsByTagName("w:startOverride"))) {
        expect(start.getAttribute("w:val")).toBe("1");
      }
    }
  });

  it("does nothing when the document has no numbering definitions", () => {
    const zip = new PizZip();
    zip.file("word/document.xml", documentXml);

    expect(() => resetListNumbering(zip)).not.toThrow();
    expect(getNumberingIds(zip)).toEqual(["7", "7", "7", "7"]);
  });
});
