import { readdir } from 'fs/promises';
import { join } from 'path';
import { parseSylabusOrProgram } from './parse';
import type { Course, ParsedData } from '@/stores/models';


const UPLOADS_COURSES_DIR = join(process.cwd(), 'uploads', 'courses');

const filter: string[] | null = null // ['1f19a2381f552d97ab417d18626d013897eee0bc0dd8574683eef062d3e87f31'] //['29d900826bc8952eeb8986f887c8423a9b334e911cfaf258cb8348c2789fa748'];

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

async function verifyCourse(course: Course & ParsedData) {
  const issues: string[] = [];
  const successes: string[] = [];
  
  // Check 1: Course has a list of results
  if (!course.data?.results || !Array.isArray(course.data.results) || course.data.results.length === 0) {
    issues.push(`${colors.red}✗${colors.reset} Course missing results list or results list is empty`);
  } else {
    successes.push(`${colors.green}✓${colors.reset} Course has ${colors.cyan}${course.data.results.length}${colors.reset} result(s)`);
  }
  
  // Check 2: Course has a teacher
  if (!course.teacher_id && !course.parsed_teacher) {
    issues.push(`${colors.red}✗${colors.reset} Course missing teacher (no teacher_id or parsed_teacher)`);
  } else {
    const teacherName = course.parsed_teacher?.name || course.teacher || 'Unknown';
    successes.push(`${colors.green}✓${colors.reset} Course has teacher: ${colors.cyan}${teacherName}${colors.reset}`);
  }
  
  // Check 3: Course has a list of attestations
  if (!course.data?.attestations || !Array.isArray(course.data.attestations) || course.data.attestations.length === 0) {
    issues.push(`${colors.red}✗${colors.reset} Course missing attestations list or attestations list is empty`);
  } else {
    successes.push(`${colors.green}✓${colors.reset} Course has ${colors.cyan}${course.data.attestations.length}${colors.reset} attestation(s)`);
  }
  
  // Check 4: Course has topics
  if (!course.topics || !Array.isArray(course.topics) || course.topics.length === 0) {
    issues.push(`${colors.red}✗${colors.reset} Course missing topics list or topics list is empty`);
  } else {
    successes.push(`${colors.green}✓${colors.reset} Course has ${colors.cyan}${course.topics.length}${colors.reset} topic(s)`);
    
    // Check 5: Topics have some hours set
    const topicsWithoutHours = course.topics.filter(topic => {
      const fulltimeHours = topic.data?.fulltime?.hours || 0;
      const inabscentiaHours = topic.data?.inabscentia?.hours || 0;
      const fulltimePractical = topic.data?.fulltime?.practical_hours || 0;
      const inabscentiaPractical = topic.data?.inabscentia?.practical_hours || 0;
      const fulltimeSrs = topic.data?.fulltime?.srs_hours || 0;
      const inabscentiaSrs = topic.data?.inabscentia?.srs_hours || 0;
      
      return fulltimeHours === 0 && inabscentiaHours === 0 && 
             fulltimePractical === 0 && inabscentiaPractical === 0 &&
             fulltimeSrs === 0 && inabscentiaSrs === 0;
    });
    
    if (topicsWithoutHours.length > 0) {
      issues.push(`${colors.red}✗${colors.reset} ${colors.yellow}${topicsWithoutHours.length}${colors.reset} topic(s) have no hours set: ${colors.cyan}${topicsWithoutHours.map(t => t.name).join(', ')}${colors.reset}`);
    } else {
      successes.push(`${colors.green}✓${colors.reset} All topics have hours set`);
    }
    
    // Additional check: show hours summary
    const topicsWithHours = course.topics.filter(topic => {
      const fulltimeHours = topic.data?.fulltime?.hours || 0;
      const inabscentiaHours = topic.data?.inabscentia?.hours || 0;
      return fulltimeHours > 0 || inabscentiaHours > 0;
    });
    if (topicsWithHours.length > 0) {
      successes.push(`${colors.green}✓${colors.reset} ${colors.cyan}${topicsWithHours.length}${colors.reset} topic(s) have hours configured`);
    }
  }
  
  // Print results
  console.log(`\n${colors.bold}${colors.yellow}--- Verification Results ---${colors.reset}`);
  if (successes.length > 0) {
    successes.forEach(msg => console.log(msg));
  }
  if (issues.length > 0) {
    console.log(`\n${colors.bold}${colors.red}Issues found:${colors.reset}`);
    issues.forEach(msg => console.log(msg));
  } else {
    console.log(`\n${colors.green}${colors.bold}✓ All checks passed!${colors.reset}`);
  }
}

// Test function for debuggint parsing of courses programs and syllabuses
async function main() {
  try {
    const files = await readdir(UPLOADS_COURSES_DIR);
    
    const docxFiles = files.filter(file => 
      file.endsWith('.docx') && !file.startsWith('~$') && (!filter || filter.some(f => file.includes(f)))
    );
    
    console.log(`${colors.bold}${colors.cyan}Found ${colors.yellow}${docxFiles.length}${colors.cyan} .docx files to process${colors.reset}\n`);
    
    const results: Array<{ file: string; result: any; error?: string }> = [];
    
    // Process each file
    for (const file of docxFiles) {
      const filepath = join(UPLOADS_COURSES_DIR, file);
      
      console.log(`${colors.cyan}Processing: ${colors.yellow}${file}${colors.reset}...`);
      
      try {
        const result = await parseSylabusOrProgram(filepath, true); // Use dryRun=true to avoid side effects
        results.push({
          file,
          result
        });
        
        if (result) {
          console.log(`${colors.green}✓ Successfully parsed ${colors.yellow}${file}${colors.reset} ${colors.cyan}${result.name}${colors.reset}`);
           ///console.log(JSON.stringify(results, null, 2));

          verifyCourse(result);

          console.log(`\n${colors.cyan}${'─'.repeat(32)}${colors.reset}\n`);
        } else {
          console.log(`${colors.red}✗ Failed to parse ${colors.yellow}${file}${colors.reset} (returned null)`);
        }
      } catch (error) {
        console.error(`${colors.red}✗ Error processing ${colors.yellow}${file}${colors.reset}:`, error);
        results.push({
          file,
          result: null,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      console.log(''); // Empty line for readability
    }
  } catch (error) {
    console.error(`${colors.red}${colors.bold}Error reading directory:${colors.reset}`, error);
    process.exit(1);
  }
}

main();

