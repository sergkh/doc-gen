import { readdir } from 'fs/promises';
import { join } from 'path';
import { parseSylabusOrProgram } from './parse';
import { verifyCourse } from './verification';

// Locally parses all docs from uploaded courses and prints parsing results to the console.
// Used to validate parsing logic during development.

const UPLOADS_COURSES_DIR = join(process.cwd(), 'uploads', 'courses');

const filter: string[] | null = ['e1523909f484e6ebc3e3b8a83c8ec73cfc01623f06da736197230bb6c224cbcd'];

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
      
      try {
         const result = await parseSylabusOrProgram(filepath, true, undefined); // Use dryRun=true to avoid side effects

        if (result) {
          if (typesFilter && !typesFilter.includes(result.type)) continue;
          
          console.log(`${colors.green}✓ Successfully parsed ${colors.yellow}${file}${colors.reset} ${colors.cyan}${result.name}${colors.reset}`);

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

