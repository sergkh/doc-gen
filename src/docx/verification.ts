import type { Course, ParsedData } from "@/stores/models";

// Internal verification of the parsed course data that provides warnings on missing or inconsistent data
export function verifyCourse(course: Course & ParsedData): { issues: string[], successes: string[] } {
  const issues: string[] = [];
  const successes: string[] = [];
  
  // Check 1: Course has a list of results
  if (!course.data?.results || !Array.isArray(course.data.results) || course.data.results.length === 0) {
    issues.push(`Course missing results list or results list is empty`);
  } else {
    successes.push(`Course has ${course.data.results.length} result(s)`);
  }
  
  // Check 2: Course has a teacher
  if (!course.teacher_id && !course.parsed_teacher) {
    issues.push(`Course missing teacher (no teacher_id or parsed_teacher)`);
  } else {
    const teacherName = course.parsed_teacher?.name || course.teacher || 'Unknown';
    successes.push(`Course has teacher: ${teacherName}`);
  }
  
  // Check 3: Course has a list of attestations
  if (!course.data?.attestations || !Array.isArray(course.data.attestations) || course.data.attestations.length === 0) {
    issues.push(`Course missing attestations list or attestations list is empty`);
  } else {
    successes.push(`Course has ${course.data.attestations.length} attestation(s)`);
  }
  
  // Check 4: Course has semesters and years set for fulltime
  if (!course.data?.fulltime?.semesters || !Array.isArray(course.data.fulltime.semesters) || course.data.fulltime.semesters.length === 0) {
    issues.push(`Course missing fulltime semesters or semesters list is empty`);
  } else {
    successes.push(`Course has fulltime semesters: ${course.data.fulltime.semesters.join(', ')}`);
  }
  
  if (!course.data?.fulltime?.study_year || typeof course.data.fulltime.study_year !== 'number') {
    issues.push(`Course missing fulltime study_year or study_year is not a number`);
  } else {
    successes.push(`Course has fulltime study year: ${course.data.fulltime.study_year}`);
  }
  
  // Check 5: Course has semesters and years set for inabscentia (if applicable)
  if (course.data?.inabscentia) {
    if (!course.data.inabscentia.semesters || !Array.isArray(course.data.inabscentia.semesters) || course.data.inabscentia.semesters.length === 0) {
      issues.push(`Course missing inabscentia semesters or semesters list is empty`);
    } else {
      successes.push(`Course has inabscentia semesters: ${course.data.inabscentia.semesters.join(', ')}`);
    }
    
    if (!course.data.inabscentia.study_year || typeof course.data.inabscentia.study_year !== 'number') {
      issues.push(`Course missing inabscentia study_year or study_year is not a number`);
    } else {
      successes.push(`Course has inabscentia study year: ${course.data.inabscentia.study_year}`);
    }
  }
  
  // Check 6: Course has topics
  if (course.type === 'program' && (!course.topics || !Array.isArray(course.topics) || course.topics.length === 0)) {
    issues.push(`Course missing topics list or topics list is empty`);
  } else {
    successes.push(`Course has ${course.topics.length} topic(s)`);
    
    // Check 7: Topics have some hours set
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
      issues.push(` ${topicsWithoutHours.length} topic(s) have no hours set: ${topicsWithoutHours.map(t => t.name).join(', ')}`);
    } else {
      successes.push(`All topics have hours set`);
    }
    // Additional check: show hours summary
    const topicsWithHours = course.topics.filter(topic => {
      const fulltimeHours = topic.data?.fulltime?.hours || 0;
      const inabscentiaHours = topic.data?.inabscentia?.hours || 0;
      return fulltimeHours > 0 || inabscentiaHours > 0;
    });
    if (topicsWithHours.length > 0) {
      successes.push(` ${topicsWithHours.length} topic(s) have hours configured`);
    }
  }

  // Check 7: Course has a list of prerequisites
  if (!course.data?.prerequisites || course.data.prerequisites.length === 0) {
    issues.push(`Course missing prerequisites list or prerequisites is not an array`);
  } else {
    successes.push(`Course has ${course.data.prerequisites.join(', ')} prerequisite(s)`);
  }

  // Check 8: Course has a list of postrequisites
  if (!course.data?.postrequisites || course.data.prerequisites.length === 0) {
    issues.push(`Course missing postrequisites list or postrequisites is not an array`);
  } else {
    successes.push(`Course has ${course.data.postrequisites.join(', ')} postrequisite(s)`);
  }

  // Check 8. Literature
  if (!course.data?.literature?.main || course.data.literature.main.length === 0) {
    issues.push(`Course missing main literature list or literature is not an array`);
  } else {
    successes.push(`Course has ${course.data.literature.main.length} main literature item(s)`);
  }

  if (!course.data?.literature?.additional || course.data.literature.additional.length === 0) {
    issues.push(`Course missing additional literature list or literature is not an array`);
  } else {
    successes.push(`Course has ${course.data.literature.additional.length} additional literature item(s)`);
  }

  if (!course.data?.literature?.internet || course.data.literature.internet.length === 0) {
    issues.push(`Course missing internet literature list or literature is not an array`);
  } else {
    successes.push(`Course has ${course.data.literature.internet.length} internet literature item(s)`);
  }

  return { issues, successes };
}