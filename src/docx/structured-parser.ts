// @ts-ignore
import docx4js from "docx4js";

// Parses DOCX documents using docx4js, mainly used for parsing tables by converting them into arrays of strings.
export type DocTable = string[][];

function deepFindNodes(node: any, type: string): any[] {
  if (node.type === type) return [node];
  if (node.children) {
    return node.children.flatMap((c: any) => deepFindNodes(c, type));
  }
  return [];
}

function extractText(node: any): string {
  if (typeof node === "string") {
    return node;
  }
  if (!node) {
    return "";
  }
  if (node.type === "text" || node.text) {
    return node.text || node.value || "";
  }
  if (node.children) {
    return node.children.map((child: any) => extractText(child)).join("");
  }
  return "";
}

function extractTableData(table: any): DocTable {
  if (table.children) {
    return table.children.map((row: any) => row.children.map((cell: any) => extractText(cell)));
  }
  return [];
}

// Searches a row in a table that contains any of the given texts.
export function findTableRow(table: DocTable, ...texts: string[]): string[] | null {
  for (const row of table) {
    if (row.some(cell => texts.some(text => cell.toLowerCase().includes(text.toLowerCase())))) {
      return row;
    }
  }
  return null;
}

export function findTableRowIndex(table: DocTable, ...texts: string[]): number {
  for (let i = 0; i < table.length; i++) {
    const row = table[i];
    if (row?.some(cell => texts.some(text => cell.toLowerCase().includes(text.toLowerCase())))) {
      return i;
    }
  }
  return -1;
}

export function findFirstTable(tables: DocTable[], ...texts: string[]): DocTable | null {
  return findNextTable(tables, null, ...texts);
}

export function findNextTable(tables: DocTable[], previousTable: DocTable | null, ...texts: string[]): DocTable | null {
  const index = previousTable ? tables.indexOf(previousTable) : -1;
  
  for (let i = index + 1; i < tables.length; i++) {
    const table = tables[i];
    if (table && findTableRow(table, ...texts)) {
      return table;
    }
  }
  return null;
}


// Returns an array of all document tables. 
// Each table is an array of rows, each row is an array of cells.
export async function extractDocTables(path: string): Promise<any> {
  const docx = await docx4js.load(path);
  
  const rendered = docx.render(function createElement(type: any, props: any, children: any){
    return {type,props, children}
  });

  const tables = deepFindNodes(rendered, "tbl");

  return tables.map(extractTableData);
}
