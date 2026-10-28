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
  return await renderDoc("src/assets/tabel.docx", data);
}

/** Fills the supplied 30-day Word form with the already calculated page data. */
export async function renderTimesheetAdditionDoc(data: TimesheetPrintData): Promise<ArrayBuffer> {
  return await renderDoc("src/assets/tabel-addition.docx", data);
}