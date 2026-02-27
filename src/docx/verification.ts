import type { Course, ParsedData } from "@/stores/models";

// Internal verification of the parsed course data that provides warnings on missing or inconsistent data
export function verifyCourse(course: Course & ParsedData): { issues: string[], successes: string[] } {
  const issues: string[] = [];
  const successes: string[] = [];
  
  if(course.name.length < 5) {
    issues.push(`Назва дисципліни занадто коротка: "${course.name}"`);
  } else if (course.name.length > 150) {
    issues.push(`Назва дисципліни виглядає занадто довгою: "${course.name}"`);
  } else {
    successes.push(`Назва дисципліни: "${course.name}"`);
  }

  // Check 1: Course has a list of results
  if (!course.data?.results || !Array.isArray(course.data.results) || course.data.results.length === 0) {
    issues.push(`Не вдалось розібрати результати навчання для цієї дисципліни`);
  } else {
    successes.push(`Дисципліна має ${course.data.results.length} результат(ів) навчання`);
  }
  
  // Check 2: Course has a teacher
  if (!course.teacher_id && !course.parsed_teacher) {
    issues.push(`Відсутній викладач (немає teacher_id або parsed_teacher)`);
  } else {
    const teacherName = course.parsed_teacher?.name || course.teacher || 'Unknown';
    successes.push(`Дисципліна має викладача: ${teacherName}`);
  }
  
  // Check 3: Course has a list of attestations
  if (!course.data?.attestations || !Array.isArray(course.data.attestations) || course.data.attestations.length === 0) {
    issues.push(`Відсутній список атестацій або список атестацій порожній`);
  } else {
    successes.push(`Дисципліна має ${course.data.attestations.length} атестацій(ю)`);
  }
  
  // Check 4: Course has semesters and years set for fulltime
  if (!course.data?.fulltime?.semesters || !Array.isArray(course.data.fulltime.semesters) || course.data.fulltime.semesters.length === 0) {
    issues.push(`Відсутні семестри для денної форми навчання або список семестрів порожній`);
  } else {
    successes.push(`Course has fulltime semesters: ${course.data.fulltime.semesters.join(', ')}`);
  }
  
  if (!course.data?.fulltime?.study_year || typeof course.data.fulltime.study_year !== 'number') {
    issues.push(`Відсутній рік навчання для денної форми навчання або рік навчання не є числом`);
  } else {
    successes.push(`Дисципліна має рік навчання для денної форми: ${course.data.fulltime.study_year}`);
  }
  
  // Check 5: Course has semesters and years set for inabscentia (if applicable)
  if (course.data?.inabscentia && course.type === 'program') {
    if (!course.data.inabscentia.semesters || !Array.isArray(course.data.inabscentia.semesters) || course.data.inabscentia.semesters.length === 0) {
      issues.push(`Відсутні семестри для заочної форми навчання або список семестрів порожній`);
    } else {
      successes.push(`Дисципліна має семестри для заочної форми: ${course.data.inabscentia.semesters.join(', ')}`);
    }
    
    if (!course.data.inabscentia.study_year || typeof course.data.inabscentia.study_year !== 'number') {
      issues.push(`Відсутній рік навчання для заочної форми навчання або рік навчання не є числом`);
    } else {
      successes.push(`Дисципліна має рік навчання для заочної форми: ${course.data.inabscentia.study_year}`);
    }
  }

  // Pre and post requisites
  if (!course.data?.prerequisites || course.data.prerequisites.length === 0) {
    issues.push(`Відсутній список дисциплін пререквізитів`);
  } else {
    successes.push(`Дисципліна має пререквізити: ${course.data.prerequisites.join(', ')}`);
  }

  if (!course.data?.postrequisites || course.data.postrequisites.length === 0) {
    issues.push(`Відсутній список постреквізитів`);
  } else {
    successes.push(`Дисципліна має постреквізити: ${course.data.postrequisites.join(', ')} `);
  }

  if (course.data?.hours_detailed) {
    if (course.data?.hours_detailed.fulltime.hours > 0 && course.data?.hours_detailed.fulltime.srs_hours / course.data?.hours_detailed.fulltime.hours > 0.666) {
      issues.push(`Співвідношення годин самостійної роботи до загальної кількості годин перевищує 66.6%`);
    }
  } else {
    issues.push(`Відсутній детальний розподіл годин`);
  }
  
  // Check 6: Course has topics
  if (course.type === 'program' && (!course.topics || !Array.isArray(course.topics) || course.topics.length === 0)) {
    issues.push(`Відсутній список тем або список тем порожній`);
  } else {
    successes.push(`Дисципліна має ${course.topics.length} тему(и)`);
    
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
      issues.push(` ${topicsWithoutHours.length} тема(и) не мають встановлених годин: ${topicsWithoutHours.map(t => t.name).join(', ')}`);
    } else if (course.topics.length > 0) {
      successes.push(`Всі теми мають встановлені години`);
    }
    // Additional check: show hours summary
    const topicsWithHours = course.topics.filter(topic => {
      const fulltimeHours = topic.data?.fulltime?.hours || 0;
      const inabscentiaHours = topic.data?.inabscentia?.hours || 0;
      return fulltimeHours > 0 || inabscentiaHours > 0;
    });
    if (topicsWithHours.length > 0) {
      successes.push(` ${topicsWithHours.length} тема(и) мають встановлені години`);
    }
  }

  // Check 7: Course has a list of prerequisites
  if (!course.data?.prerequisites || course.data.prerequisites.length === 0) {
    issues.push(`Відсутній список передумов`);
  } else {
    successes.push(`Дисципліна має ${course.data.prerequisites.join(', ')} передумову(и)`);
  }

  // Check 8: Course has a list of postrequisites
  if (!course.data?.postrequisites || course.data.postrequisites.length === 0) {
    issues.push(`Відсутній список постреквізитів`);
  } else {
    successes.push(`Дисципліна має ${course.data.postrequisites.join(', ')} постреквізитів`);
  }

  // Check 8. Literature
  if (!course.data?.literature?.main || course.data.literature.main.length === 0) {
    issues.push(`Не вдалось розібрати список основної літератури`);
  } else {
    successes.push(`Дисципліна має ${course.data.literature.main.length} основний(их) літературний(их) джерело(ів)`);
  }

  if (!course.data?.literature?.additional || course.data.literature.additional.length === 0) {
    issues.push(`Не вдалось розібрати список додаткової літератури`);
  } else {
    successes.push(`Дисципліна має ${course.data.literature.additional.length} додатковий(их) літературний(их) джерело(ів)`);
  }

  if (!course.data?.literature?.internet || course.data.literature.internet.length === 0) {
    issues.push(`Не вдалось розібрати список інтернет-літератури`);
  } else {
    successes.push(`Дисципліна має ${course.data.literature.internet.length} інтернет-літературний(их) джерело(ів)`);
  }

  return { issues, successes };
}