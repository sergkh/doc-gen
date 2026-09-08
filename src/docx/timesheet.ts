import { renderDoc } from "@/docx/render";
import type { Teacher } from "@/stores/models";

export type TimesheetPrintDay = {
  no: string;
  //lessons
  l1: string; 
  l2: string; 
  l3: string; 
  l4: string; 
  l5: string; 
  teaching: string;
  science: string;
  method: string;
  org: string;
  total: string;
  explanation: string;
};

export type TimesheetPrintData = {
  teacher: Teacher;
  month: string;
  year: string;
  first: TimesheetPrintDay[];
  second: TimesheetPrintDay[];
  firstHalfTotal: TimesheetPrintDay;
  secondHalfTotal: TimesheetPrintDay;
  total: TimesheetPrintDay;
};


/** Fills the supplied 30-day Word form with the already calculated page data. */
export async function renderTimesheetDoc(data: TimesheetPrintData): Promise<ArrayBuffer> {
  //const printedDayCount = data.days.length;

  // const emptyDay: TimesheetPrintDay = {
  //   no: "",
  //   slots: ["", "", "", "", ""],
  //   teaching: "",
  //   science: "",
  //   methodical: "",
  //   organizational: "",
  //   total: "",
  //   explanation: "",
  // };

  const renderData: TimesheetPrintData = {
    ...data,
   // days: [...data.days, ...Array.from({ length: 31 - printedDayCount }, () => emptyDay)],
  };

  // const content = await readFile("src/assets/tabel.docx", "binary");
  // const zip = new PizZip(content);
  // let xml = zip.file("word/document.xml")!.asText();

  // let dailyRows = 0;
  // xml = xml.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, (row) => {
  //   const cells = row.match(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g) ?? [];
  //   const firstCell = textInCell(cells[0] ?? "");

  //   if (
  //     /^\d+$/.test(firstCell)
  //     && cells.length === 15
  //     && cells.slice(1).every((cell) => !textInCell(cell))
  //     && dailyRows < 30
  //   ) {
  //     const rowIndex = dailyRows++;
  //     const rendered = replaceRow(row, `days[${rowIndex}]`, true);
  //     // The supplied form has 30 rows. Duplicate its final data row for day 31.
  //     return rowIndex === 29 && printedDayCount === 31
  //       ? `${rendered}${replaceRow(row, "days[30]", true)}`
  //       : rendered;
  //   }

  //   if (firstCell === "Всього" && cells.length === 10) {
  //     const prefix = dailyRows <= 15 ? "firstHalf" : "secondHalf";
  //     return replaceSummaryRow(row, prefix);
  //   }
  //   if (firstCell === "Разом" && cells.length === 10) {
  //     return replaceSummaryRow(row, "total");
  //   }
  //   return row;
  // });

  // if (printedDayCount < 1 || printedDayCount > 31 || dailyRows !== 30) {
  //   throw new Error(`Шаблон табеля має ${dailyRows} рядків для днів, але потрібно ${printedDayCount}`);
  // }

  // xml = xml.replace(/<w:t>За [^<]* року ПІП<\/w:t>/g, `<w:t xml:space="preserve">{periodLabel} {teacherName}</w:t>`);
  // xml = xml.replace(/(<w:t[^>]*>[^<]*)ПІП(<\/w:t>)/g, `$1{teacherName}$2`);
  // zip.file("word/document.xml", xml);

  // const doc = new Docxtemplater(zip, { parser: docxExpressionParser, paragraphLoop: true, linebreaks: true });
  // await doc.renderAsync(renderData);

  return await renderDoc("src/assets/tabel.docx", renderData);
}
