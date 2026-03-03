import { readdir, writeFile, readFile } from 'fs/promises';
import { join, basename } from 'path';
import { parseSylabusOrProgram } from './parse';
import { verifyCourse } from './verification';

// Locally parses all docs from uploaded courses and prints parsing results to the console.
// Used to validate parsing logic during development.

const UPLOADS_COURSES_DIR = join(process.cwd(), 'uploads', 'courses');

const filter: string[] | null = null;

let limit = 2 // Infinity

const typesFilter: ('program' | 'syllabus')[] = [ 'syllabus' ]; // 'program', 

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function compareResults(actual: any, expected: any, path: string = ''): string[] {
  const errors: string[] = [];
  
  if (typeof actual !== typeof expected) {
    errors.push(`${path}: type mismatch - got ${typeof actual}, expected ${typeof expected}`);
    return errors;
  }
  
  if (actual === null || expected === null) {
    if (actual !== expected) {
      errors.push(`${path}: value mismatch - got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    }
    return errors;
  }
  
  if (typeof actual === 'object' && !Array.isArray(actual)) {
    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);
    
    const allKeys = new Set([...actualKeys, ...expectedKeys]);
    
    for (const key of allKeys) {
      if (!(key in expected)) {
        errors.push(`${path}${path ? '.' : ''}${key}: unexpected field`);
      } else if (!(key in actual)) {
        errors.push(`${path}${path ? '.' : ''}${key}: missing field`);
      } else {
        errors.push(...compareResults(actual[key], expected[key], `${path}${path ? '.' : ''}${key}`));
      }
    }
  } else if (Array.isArray(actual)) {
    if (!Array.isArray(expected)) {
      errors.push(`${path}: expected array but got ${typeof expected}`);
    } else if (actual.length !== expected.length) {
      errors.push(`${path}: array length mismatch - got ${actual.length}, expected ${expected.length}`);
    } else {
      for (let i = 0; i < actual.length; i++) {
        errors.push(...compareResults(actual[i], expected[i], `${path}[${i}]`));
      }
    }
  } else {
    if (actual !== expected) {
      errors.push(`${path}: value mismatch - got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    }
  }
  
  return errors;
}

// Test function for debuggint parsing of courses programs and syllabuses
async function main() {
  try {
    const files = await readdir(UPLOADS_COURSES_DIR, { recursive: true });
    
    const docxFiles = files.filter(file => 
      file.endsWith('.docx') && !file.startsWith('~$') && (!filter || filter.some(f => file.includes(f)))
    );
    
    console.log(`\n------------\n${colors.bold}${colors.cyan}Found ${colors.yellow}${docxFiles.length}${colors.cyan} .docx files to process${colors.reset}\n`);

    // Process each file
    for (const file of docxFiles) {
      const filepath = join(UPLOADS_COURSES_DIR, file);

      if (limit-- <= 0) break;
      
      try {
         const result = await parseSylabusOrProgram(filepath, true, undefined); // Use dryRun=true to avoid side effects

         if (result) {
           if (typesFilter && !typesFilter.includes(result.type)) continue;
           
           console.log(`${colors.green}✓ Successfully parsed ${colors.yellow}${file}${colors.reset} ${colors.cyan}${result.name}${colors.reset}`);

           const jsonPath = join(UPLOADS_COURSES_DIR, String(file).replace(/\.docx$/, '.json'));
           await writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
           console.log(`${colors.cyan}  → Saved to ${basename(jsonPath)}${colors.reset}`);

           const validatedPath = join(UPLOADS_COURSES_DIR, String(file).replace(/\.docx$/, '.validated.json'));
           try {
             const validatedContent = await readFile(validatedPath, 'utf-8');
             const expected = JSON.parse(validatedContent);
             const discrepancies = compareResults(result, expected);
             if (discrepancies.length > 0) {
               console.log(`\n${colors.bold}${colors.red}Validation errors:${colors.reset}`);
               discrepancies.forEach(msg => console.log(`${colors.red}✗ ${msg}${colors.reset}`));
             } else {
               console.log(`${colors.green}✓ Validation passed!${colors.reset}`);
             }
           } catch (e: any) {
             if (e.code !== 'ENOENT') {
               console.log(`${colors.yellow}Warning: Could not read validated file: ${e.message}${colors.reset}`);
             }
           }

          const { issues, successes } = verifyCourse(result);
          issues.push(...result.parse_warnings.map(w => `Parse warning: ${w}`));
          // Print verification results
          console.log(`\n${colors.bold}${colors.yellow}--- Verification Results ---${colors.reset}`);
          if (successes.length > 0) {
            successes.forEach(msg => console.log(msg));
          }
          if (issues.length > 0) {
            console.log(`\n${colors.bold}${colors.red}Issues found:${colors.reset}`);
            issues.forEach(msg => console.log('⚠️ ' + msg));
          } else {
            console.log(`\n${colors.green}${colors.bold}✓ All checks passed!${colors.reset}`);
          }

          console.log(`\n${colors.cyan}${'─'.repeat(32)}${colors.reset}\n`);
        } else {
          console.log(`${colors.red}✗ Failed to parse ${colors.yellow}${file}${colors.reset} (returned null)`);
        }
      } catch (error) {
        console.error(`${colors.red}✗ Error processing ${colors.yellow}${file}${colors.reset}:`, error);
      }
      
      console.log(''); // Empty line for readability
    }
  } catch (error) {
    console.error(`${colors.red}${colors.bold}Error reading directory:${colors.reset}`, error);
    process.exit(1);
  }
}

main();

