export type CourseResult = {
  id: number,
  no: number,
  type: string,
  name: string
}

export type ShortCourseInfo = {
  id: number,
  name: string,
  teacher: string
}

export type CourseData = {
  hours: number,
  credits: number,
  specialty: string,
  area: string,
  description: string,
  prerequisites: number[],
  postrequisites: number[],
  results: number[],
  attestations: {
    name: string,
    semester: number
  }[],
  fulltime: {
    semesters: number[],
    study_year: number
  },
  inabscentia: {
    semesters: number[],
    study_year: number
  }
}

export type GeneratedCourseData = {
  disciplineQuestions: string[]
}

export type Course = {
  id: number,
  name: string,
  teacher_id: number,
  teacher?: string,
  data: CourseData,
  generated: GeneratedCourseData | null  
}

export type Teacher = {
  id: number,
  name: string,
  email: string
}

export type GeneratedTopicData = {
  subtopics: string[],
  keywords: string[],
  topics: string[],
  referats: string[],
  quiz: QuizQuestion[],
  keyQuestions: string[]
} & Record<string, any>;

export type CourseTopicData = {
  attestation: number,
  fulltime: {
    hours: number,
    practical_hours: number,
  },
  inabscentia: {
    hours: number,
    practical_hours: number
  }
}

export type CourseTopic = {
  id: number,
  course_id: number,
  index: number,
  name: string,
  lection: string,
  data: CourseTopicData,
  generated: GeneratedTopicData | null
}

export type QuizQuestion = {
  question: string,
  index: number,
  options: string[]
}

export type CourseAttestation = {
  no: number,
  name: string,
  topics: CourseTopic[]
}

export type CourseGenerationData = {
  course: Course,
  topics: CourseTopic[],
  prerequisites: ShortCourseInfo[],
  postrequisites: ShortCourseInfo[],
  generalResults:CourseResult[],
  specialResults:CourseResult[],
  programResults:CourseResult[],
  attestations: CourseAttestation[]
}
