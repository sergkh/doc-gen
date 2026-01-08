import { readdir, stat } from "fs/promises";
import path from "path";

/// Mass uploads all .docx files from subfolders of a specified root folder to the API endpoint.
/// Used to bulk upload course syllabuses and programs during initial data population.

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

const DOCSETS_ROOT = '/Users/sergeykhruschak/workspace/Univer/doc-gen/uploads/plan'

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";

const API_PATH = "/api/courses/parse-docx";

const ALLOWED_EXTENSIONS = new Set([".docx"]);

const OK_NO_PATTERN = /^(ОК|ВК)(\d{1,2}(\.\d{1,2})?).*/i;

function extractOkNo(folderName: string): string | null {
  const match = folderName.match(OK_NO_PATTERN);
  return match?.[1] ?? null;
}

interface FolderSummary {
  name: string;
  path: string;
  files: string[];
  successes: string[];
  warnings: string[];
  failures: { file: string; status: number | "network"; message: string }[];
}

function formatFolderList(label: string, folders: FolderSummary[]) {
  if (folders.length === 0) {
    console.log(`${COLORS.yellow}${label}:${COLORS.reset} none`);
    return;
  }

  console.log(`${COLORS.bold}${label}:${COLORS.reset}`);
  for (const folder of folders) {
    const files = folder.files.length ? folder.files.join(", ") : "no files";
    console.log(`  • ${folder.name} (${files})`);
    if (folder.warnings.length > 0) {
      for (const warning of folder.warnings) {
        console.log(`      ${COLORS.yellow}!${COLORS.reset} Warning: ${warning}`);
      }
    }
    if (folder.failures.length > 0) {
      for (const failure of folder.failures) {
        console.log(`      ${COLORS.red}×${COLORS.reset} ${failure.file} -> ${failure.status}: ${failure.message}`);
      }
    }
  }
}

async function ensureRootExists(rootPath: string) {
  try {
    const stats = await stat(rootPath);
    if (!stats.isDirectory()) {
      throw new Error("Configured root is not a directory");
    }
  } catch (error) {
    throw new Error(`Failed to access configured root "${rootPath}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function loadSubfolders(rootPath: string) {
  const entries = await readdir(rootPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, path: path.join(rootPath, entry.name) }));
}

async function loadDocxFiles(folderPath: string) {
  const entries = await readdir(folderPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(folderPath, entry.name))
    .filter((file) => {
      const ext = path.extname(file).toLowerCase();
      const base = path.basename(file);
      return ALLOWED_EXTENSIONS.has(ext) && !base.startsWith("~$");
    });
}

async function uploadDocx(filePath: string, okNo: string | null = null) {
  const file = Bun.file(filePath);
  const formData = new FormData();
  formData.append("file", file, path.basename(filePath));
  if (okNo) {
    formData.append("ok_no", okNo);
  }

  return fetch(`${API_BASE_URL}${API_PATH}`, { method: "POST", body: formData });
}

async function processFolder(folderName: string, folderPath: string): Promise<FolderSummary> {
  const docxFiles = await loadDocxFiles(folderPath);
  const summary: FolderSummary = {
    name: folderName,
    path: folderPath,
    files: docxFiles.map((file) => path.basename(file)),
    successes: [],
    failures: [],
    warnings: []
  };

  if (docxFiles.length === 0) {
    return summary;
  }

  const okNo = extractOkNo(folderName);
  if (!okNo) {
    summary.warnings.push("Не вдалося визначити номер ОК з назви папки; параметр ok_no не буде надіслано.");
  }

  for (const filePath of docxFiles) {
    try {
      const response = await uploadDocx(filePath, okNo);
      if (!response || !response.ok) {
        const status = response?.status ?? "network";
        const message = response ? await response.text() : "No response";
        summary.failures.push({ file: path.basename(filePath), status: status || "network", message });
      } else {
        summary.successes.push(path.basename(filePath));
        const data = await response.json();
        
        if (data.warnings && Array.isArray(data.warnings) && data.warnings.length > 0) {
          summary.warnings.push(...data.warnings.map((msg: string) => `${path.basename(filePath)}: ${msg}`));
        }
        
        console.log(`${COLORS.green}✓${COLORS.reset} Uploaded ${path.basename(filePath)} from ${folderName}`);
      }
    } catch (error) {
      summary.failures.push({
        file: path.basename(filePath),
        status: "network",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}

async function main() {
  console.log(`${COLORS.bold}${COLORS.cyan}Mass upload from${COLORS.reset} ${DOCSETS_ROOT}`);
  await ensureRootExists(DOCSETS_ROOT);

  const subfolders = await loadSubfolders(DOCSETS_ROOT);
  if (subfolders.length === 0) {
    console.log(`${COLORS.yellow}No subfolders found; nothing to upload.${COLORS.reset}`);
    return;
  }

  const results: FolderSummary[] = [];
  for (const folder of subfolders) {
    console.log(`\n${COLORS.cyan}Processing folder:${COLORS.reset} ${folder.name}`);
    const summary = await processFolder(folder.name, folder.path);
    results.push(summary);
  }

  const successfulFolders = results.filter((r) => r.successes.length > 0 && r.failures.length === 0);
  const emptyFolders = results.filter((r) => r.files.length === 0);
  const problematicFolders = results.filter((r) => r.failures.length > 0);

  console.log(`\n${COLORS.bold}${COLORS.yellow}===== Upload report =====${COLORS.reset}`);
  formatFolderList("Successful folders", successfulFolders);
  console.log("");
  formatFolderList("Empty folders", emptyFolders);
  console.log("");
  formatFolderList("Folders with errors", problematicFolders);

  console.log(`\n${COLORS.bold}Summary:${COLORS.reset}`);
  console.log(`  Processed folders: ${results.length}`);
  console.log(`  Successful: ${successfulFolders.length}`);
  console.log(`  Empty: ${emptyFolders.length}`);
  console.log(`  With errors: ${problematicFolders.length}`);
}

main().catch((error) => {
  console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
  process.exit(1);
});
