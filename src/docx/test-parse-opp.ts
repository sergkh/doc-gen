import { readdir } from 'fs/promises';
import { join } from 'path';
import { parseOPP, type OPP } from './opp-results';
import type { CourseResult, SpecialtyDisciplineConfig } from '@/stores/models';

const UPLOADS_OPP_DIR = join(process.cwd(), 'uploads', 'opps');
const filter: string[] | null = null; // ['example.docx']

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function checkResults(label: string, results: CourseResult[] | null | undefined, issues: string[], successes: string[], required = true) {
  if (!results || results.length === 0) {
    if (required) {
      issues.push(`${colors.red}✗${colors.reset} ${label} results missing or empty`);
    } else {
      successes.push(`${colors.yellow}!${colors.reset} ${label} results not detected (optional)`);
    }
    return;
  }

  successes.push(`${colors.green}✓${colors.reset} ${label} has ${colors.cyan}${results.length}${colors.reset} entries`);

  const unnamed = results.filter(result => !result.name?.trim());
  if (unnamed.length > 0) {
    issues.push(`${colors.red}✗${colors.reset} ${label} has ${colors.cyan}${unnamed.length}${colors.reset} entries without names`);
  }
}

function verifyDisciplines(disciplines: SpecialtyDisciplineConfig[] | null | undefined, issues: string[], successes: string[]) {
  if (!disciplines || disciplines.length === 0) {
    issues.push(`${colors.red}✗${colors.reset} Disciplines list missing or empty`);
    return;
  }

  successes.push(`${colors.green}✓${colors.reset} Disciplines catalog has ${colors.cyan}${disciplines.length}${colors.reset} records`);

  const zeroCredits = disciplines.filter(d => !Number.isFinite(d.credits) || d.credits <= 0);
  if (zeroCredits.length > 0) {
    issues.push(`${colors.red}✗${colors.reset} ${colors.cyan}${zeroCredits.length}${colors.reset} discipline(s) have no credit value: ${colors.cyan}${zeroCredits.map(d => d.name).join(', ')}${colors.reset}`);
  }
}

function verifySpecialty(specialty: OPP['specialty'], issues: string[], successes: string[]) {
  if (!specialty) {
    issues.push(`${colors.red}✗${colors.reset} Specialty information missing from parsed data`);
    return;
  }

  const missingFields = ['name', 'code', 'qualification'].filter(field => !(specialty as any)[field]?.toString().trim());

  if (missingFields.length === 0) {
    successes.push(`${colors.green}✓${colors.reset} Specialty detected: ${colors.cyan}${specialty.code} ${specialty.name}${colors.reset}`);
  } else {
    issues.push(`${colors.red}✗${colors.reset} Specialty missing fields: ${colors.cyan}${missingFields.join(', ')}${colors.reset}`);
  }
}

function verifyOPP(opp: OPP) {
  const issues: string[] = [];
  const successes: string[] = [];

  verifySpecialty(opp.specialty, issues, successes);
  verifyDisciplines(opp.disciplines, issues, successes);

  checkResults('Integral', opp.integralResults, issues, successes, false);
  checkResults('General (ЗК)', opp.generalResults, issues, successes);
  checkResults('Special (СК)', opp.specialResults, issues, successes);
  checkResults('Program (РН)', opp.programResults, issues, successes);

  console.log(`\n${colors.bold}${colors.yellow}--- Verification Results ---${colors.reset}`);
  successes.forEach(msg => console.log(msg));

  if (issues.length > 0) {
    console.log(`\n${colors.bold}${colors.red}Issues found:${colors.reset}`);
    issues.forEach(msg => console.log('⚠️ ' + msg));
  } else {
    console.log(`\n${colors.green}${colors.bold}✓ All checks passed!${colors.reset}`);
  }
}

async function main() {
  try {
    const files = await readdir(UPLOADS_OPP_DIR);
    const docxFiles = files.filter(file =>
      file.endsWith('.docx') &&
      !file.startsWith('~$') &&
      (!filter || filter.some(f => file.includes(f)))
    );

    console.log(`${colors.bold}${colors.cyan}Found ${colors.yellow}${docxFiles.length}${colors.cyan} OPP .docx files to process${colors.reset}\n`);

    for (const file of docxFiles) {
      const filepath = join(UPLOADS_OPP_DIR, file);
      console.log(`${colors.cyan}Processing: ${colors.yellow}${file}${colors.reset}...`);

      try {
        const opp = await parseOPP(filepath);
        if (!opp) {
          console.log(`${colors.red}✗ Failed to parse ${colors.yellow}${file}${colors.reset} (returned null)`);
        } else {
          console.log(`${colors.green}✓ Parsed ${colors.yellow}${file}${colors.reset}`);
          verifyOPP(opp);
        }
      } catch (error) {
        console.error(`${colors.red}✗ Error processing ${colors.yellow}${file}${colors.reset}:`, error);
      }

      console.log('');
    }
  } catch (error) {
    console.error(`${colors.red}${colors.bold}Error reading uploads/opp directory:${colors.reset}`, error);
    process.exit(1);
  }
}

main();
