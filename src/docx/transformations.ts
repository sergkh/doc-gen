import { generateCourseInfo } from "@/ai/generator";
import { courseResults, courses, teachers, templates } from "@/stores/db";
import type { Course, CourseAttestation, CourseGenerationData, CourseSemester, CourseTopic, DisciplineReference, GenerationPractice, HoursStruct, QuizQuestion, Specialty, Template } from "@/stores/models";

declare global {
  interface Array<T> {
    sum(this: Array<number>): number;
  }
}

Array.prototype.sum = function (this: number[]): number {
  return this.reduce((acc, val) => acc + val, 0);
};

function randomizeQuestion(question: QuizQuestion, index: number): QuizQuestion {  
  const options = [...question.options].sort(() => Math.random() - 0.5);
  return {
    index: index,
    question: question.question,
    options,
    answerIndex: options.indexOf(question.options[question.answerIndex]!)
  } as QuizQuestion;
}

type Hours = {    
  hours: number,
  practical_hours: number,
  lab_hours: number,
  srs_hours: number,
  total_hours?: number
};

function computeHours(h: Hours | undefined, practices: boolean): Hours {
  
  if (!h) {
    return { hours: 0, practical_hours: 0, lab_hours: 0, srs_hours: 0, total_hours: 0 };
  }

  const firstNonZero = (values: (number | null)[]) => {
    return values.find(v => v !== null && v !== undefined && v !== 0) ?? 0;
  };

  const hours = h.hours;
  // in old UI we don't set lab_hours correctly and might set them as practical hours this choses whatever is present
  const practical_hours = practices ? firstNonZero([h.practical_hours, h.lab_hours]) : 0;
  const lab_hours = practices ? 0 : firstNonZero([h.lab_hours, h.practical_hours]);
  const srs_hours = h.srs_hours ?? 0;
  const total_hours = hours + practical_hours + lab_hours + srs_hours;

  return { hours, practical_hours, lab_hours, srs_hours, total_hours };
}

function buildTopicHours(course: Course, allTopics: CourseTopic[]): CourseTopic[] {
  const practices = course.data.practice_type === "practice";
  
  return allTopics.map((t) => {
    return {
      ...t, 
      data: {
        ...t.data,
        fulltime: computeHours(t.data.fulltime, practices),
        inabscentia: computeHours(t.data.inabscentia, practices)
      }
    }
  });
}

function buildAttestations(course: Course, allTopics: CourseTopic[]): CourseAttestation[] {
  let practicesCounter = 0;
  // group topics by attestation
  return course.data.attestations.map((a, index) => {
    
    const topics = allTopics.filter(t => t.data?.attestation === index + 1);

    const practices = buildPracticalLessons(topics, practicesCounter + 1);
    practicesCounter += practices.length;

    let attestation: CourseAttestation = {
      no: index+1,
      name: a.name,
      semester: a.semester,
      topics,
      practices,
      fulltime: {
        hours: topics.map(t => t.data.fulltime.hours).sum(),
        practical_hours: topics.map(t => t.data.fulltime.practical_hours).sum(),
        lab_hours: topics.map(t => t.data.fulltime.lab_hours).sum(),
        srs_hours: topics.map(t => t.data.fulltime.srs_hours).sum(),
        total_hours: topics.map(t => t.data.fulltime.total_hours ?? 0).sum()
      },
      inabscentia: {
        hours: topics.map(t => t.data.inabscentia?.hours ?? 0).sum(),
        practical_hours: topics.map(t => t.data.inabscentia?.practical_hours ?? 0).sum(),
        lab_hours: topics.map(t => t.data.inabscentia?.lab_hours ?? 0).sum(),
        srs_hours: topics.map(t => t.data.inabscentia?.srs_hours ?? 0).sum(),
        total_hours: topics.map(t => t.data.inabscentia?.total_hours ?? 0).sum()
      }
    }

    return attestation;
  });  
}

function buildSemesters(attestations: CourseAttestation[]): CourseSemester[] {
  const semesters: CourseSemester[] = [];

  for (const a of attestations) {
    const semester = a.semester;
    if (!semesters[semester]) {
      semesters[semester] = { 
        attestations: [], 
        semester, 
        fulltime: { hours: 0, practical_hours: 0, lab_hours: 0, srs_hours: 0, total_hours: 0 }, 
        inabscentia: { hours: 0, practical_hours: 0, lab_hours: 0, srs_hours: 0, total_hours: 0 } 
      };
    }
    semesters[semester].attestations.push(a);
    semesters[semester].fulltime.hours += a.fulltime.hours;
    semesters[semester].fulltime.practical_hours += a.fulltime.practical_hours;
    semesters[semester].fulltime.lab_hours += a.fulltime.lab_hours;
    semesters[semester].fulltime.srs_hours += a.fulltime.srs_hours;
    semesters[semester].fulltime.total_hours! += a.fulltime.total_hours;
    semesters[semester].inabscentia!.hours += a.inabscentia.hours;
    semesters[semester].inabscentia!.practical_hours += a.inabscentia.practical_hours;
    semesters[semester].inabscentia!.lab_hours += a.inabscentia.lab_hours;
    semesters[semester].inabscentia!.srs_hours += a.inabscentia.srs_hours;
    semesters[semester].inabscentia!.total_hours! += a.inabscentia.total_hours;
  }

  return semesters;
}

function buildPracticalLessons(topics: CourseTopic[], startIndexAt: number): GenerationPractice[] {
  const practices: GenerationPractice[] = [];

  let index = startIndexAt;
  for (const topic of topics) {
    if (topic.data.practices) {
      let inAbscHours = topic.data.inabscentia?.practical_hours ?? 0;
      
      for (const practice of topic.data.practices) {
        
        practices.push({ 
          ...practice, 
          no: index++,
          fulltime: {
            hours: 2
          },
          inabscentia: {
            hours: (inAbscHours > 0 ? 2 : 0)
          }
        });
        
        inAbscHours-=2;
      }
    } else if (topic.data.fulltime?.practical_hours) {
      practices.push({ 
        name: topic.name,
        description: "",
        fulltime: { hours: topic.data.fulltime?.practical_hours },
        inabscentia: { hours: topic.data.inabscentia?.practical_hours ?? 0 },
        no: index++ 
      });
    }
  }

  return practices;
}

async function normalizeRequisiteCourses(names: string[]): Promise<DisciplineReference[]> {
  return Promise.all(names.map(async (id) => {
    
    if (typeof id === 'number') {
      const result = await courses.getShortInfos([id]);
      return result[0] as DisciplineReference;
    } else {
      return { id: undefined, name: id } as DisciplineReference;
    }
  }));
}

function templateDependencyIds(template: Template): number[] {
  return [...new Set((template.data?.dependencies || []).filter(Number.isInteger))];
}

/**
 * Returns nested dependencies first and the requested template last. The cycle
 * check keeps generation safe if legacy or manually edited data bypassed the UI.
 */
async function templatesInGenerationOrder(template: Template): Promise<Template[]> {
  const ordered: Template[] = [];
  const resolved = new Set<number>();
  const visiting = new Set<number>();

  const visit = async (current: Template): Promise<void> => {
    if (resolved.has(current.id)) return;
    if (visiting.has(current.id)) {
      throw new Error(`Template dependency cycle detected at "${current.name}"`);
    }

    visiting.add(current.id);
    for (const dependencyId of templateDependencyIds(current)) {
      const dependency = await templates.get(dependencyId);
      if (!dependency) {
        throw new Error(`Dependent template ${dependencyId} for "${current.name}" was not found`);
      }
      await visit(dependency);
    }
    visiting.delete(current.id);
    resolved.add(current.id);
    ordered.push(current);
  };

  await visit(template);
  return ordered;
}

/*
 * Loads all possible course information into a single JS object for rendering.
 * Some fields are duplicated to simplify rendering.
 * One can find plain topics list, list grouped by attestations and 
 * list of attestations grouped by semesters.
 * 
 * Hours are mostly calculated from the hours set in course topics data.
 */
export async function loadFullCourseInfo(
  template: Template | null,
  course: Course, 
  specialty: Specialty,
  topics: CourseTopic[],
  params: Record<string, any>,
  onProgress?: (progress: number) => void,
  apiKey?: string
): Promise<CourseGenerationData> {
  onProgress?.(1);

  // update course specialty and area strings
  if (course.data.specialty_mode === 'both') {
    course.data.specialty = `${specialty.old_code} ${specialty.old_name} / ${specialty.code} ${specialty.name}`;  
  } else if (course.data.specialty_mode === 'old_only' && specialty.old_code && specialty.old_name) {
    course.data.specialty = `${specialty.old_code} ${specialty.old_name}`;  
  } else {
    course.data.specialty = `${specialty.code} ${specialty.name}`;
  }

  course.data.area = `${specialty.area_code} ${specialty.area}`;
  course.data.practice_type = course.data.practice_type ?? "practice";
  course.data.specialty_full = specialty;
  
  // normalize as this field is optional
  course.data.literature.method = course.data.literature.method ?? [];
  
  // Generate course info - this is the slowest part (as might use AI)
  // Progress from 5% to 70% (65% for AI generation)
  let updatedCourse = course;
  let updatedTopics = topics;
  if (template) {
    const generationTemplates = await templatesInGenerationOrder(template);
    const totalPrompts = generationTemplates.reduce((count, current) => count + current.prompts.length, 0);
    let completedPrompts = 0;

    for (const currentTemplate of generationTemplates) {
      const promptCount = currentTemplate.prompts.length;
      const result = await generateCourseInfo(currentTemplate, updatedCourse, updatedTopics, (progress: number) => {
        const completed = completedPrompts + (promptCount * progress / 100);
        onProgress?.(5 + (totalPrompts === 0 ? 65 : completed / totalPrompts * 65));
      }, apiKey);
      updatedCourse = result.course;
      updatedTopics = result.topics;
      completedPrompts += promptCount;
    }
  }
  
  // Estimate progress: if we have N topics, each topic is roughly 65% / N
  // For now, we'll report 70% after generation completes
  onProgress?.(90);
  
  const prerequisites = await normalizeRequisiteCourses(course.data.prerequisites);
  onProgress?.(93);

  const postrequisites = await normalizeRequisiteCourses(course.data.postrequisites);
  onProgress?.(95);

  const teacher = await teachers.get(course.teacher_id);

  const results = await courseResults.list(course.data.results);
  onProgress?.(97);

  const countedTopics = buildTopicHours(course, updatedTopics);

  const attestations = buildAttestations(course, countedTopics);
  const semesters: CourseSemester[] = buildSemesters(attestations);
  
  const oneSemesterOnly = course.data.attestations.every(a => a.semester === 1);

  onProgress?.(99);

  const hours = {
    total: course.data.hours,
    fulltime: {
      // legacy format
      lectures: countedTopics.map(t => t.data.fulltime.hours).sum(),
      practicals: countedTopics.map(t => t.data.fulltime.practical_hours).sum(),
      srs: countedTopics.map(t => t.data.fulltime.srs_hours).sum(),

      // newer format to conform to HoursStruct
      hours: countedTopics.map(t => t.data.fulltime.hours).sum(),
      practical_hours: countedTopics.map(t => t.data.fulltime.practical_hours).sum(),
      lab_hours: countedTopics.map(t => t.data.fulltime.lab_hours).sum(),
      srs_hours: countedTopics.map(t => t.data.fulltime.srs_hours).sum(),
      total_hours: countedTopics.map(t => t.data.fulltime.total_hours ?? 0).sum()
    },
    inabscentia: {
      // legacy format
      lectures: countedTopics.map(t => t.data.inabscentia?.hours ?? 0).sum(),
      practicals: countedTopics.map(t => t.data.inabscentia?.practical_hours ?? 0).sum(),
      srs: countedTopics.map(t => t.data.inabscentia?.srs_hours ?? 0).sum(),
      // newer format to conform to HoursStruct
      hours: countedTopics.map(t => t.data.inabscentia?.hours ?? 0).sum(),
      practical_hours: countedTopics.map(t => t.data.inabscentia?.practical_hours ?? 0).sum(),
      lab_hours: countedTopics.map(t => t.data.inabscentia?.lab_hours ?? 0).sum(),
      srs_hours: countedTopics.map(t => t.data.inabscentia?.srs_hours ?? 0).sum(),
      total_hours: countedTopics.map(t => t.data.inabscentia?.total_hours ?? 0).sum()
    }
  };

  return {
    course: updatedCourse,
    topics: countedTopics,
    integralResult: results.find(r => r.type === "ІК")!,
    generalResults: results.filter(r => r.type === "ЗК").sort((a, b) => a.no - b.no),
    specialResults: results.filter(r => r.type === "СК").sort((a, b) => a.no - b.no),
    programResults: results.filter(r => r.type === "РН").sort((a, b) => a.no - b.no),
    attestations,
    oneSemesterOnly,
    semesters,
    teacher,
    prerequisites,
    postrequisites,
    degree: specialty.degree,
    hours,
    ...params, // parameters input by the user for the template

    // -- helper functions

    // generates N random quizzes from the course topics quiz pool, note: topics might be redefined in params
    randomQuizes(count: number, questionsPerPaper: number) {
      return Array.from({ length: count }, (_, paperIdx) => {
        const questionsPool = this.topics.flatMap(t => t.generated?.quiz || []);
        
        const selectedQuestions = questionsPool
          .sort(() => Math.random() - 0.5)
          .slice(0, questionsPerPaper)
          .map((q, idx) => randomizeQuestion(q, idx+1));
        
        return {
          index: paperIdx + 1,
          questions: selectedQuestions
        };
      });
    }
  } as CourseGenerationData
}
