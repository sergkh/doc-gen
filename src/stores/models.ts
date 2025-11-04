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
  results: number[]
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

export type GenerateTopicData = {
  subtopics: string[],
  keywords: string[],
  topics: string[],
  referats: string[],
  quiz: QuizQuestion[],
  keyQuestions: string[]
}

export type CourseTopic = {
  id: number,
  course_id: number,
  index: number,
  name: string,
  lection: string,
  generated: GenerateTopicData | null
}

export type QuizQuestion = {
  question: string,
  index: number,
  option1: string,
  option2: string,
  option3: string,
  option4: string
}

export type Topic = {
  title: string,
  index: number,
  keywords: string[],
  selfQuestions: string[],
  referats: string[],
  quiz: QuizQuestion[]
  keyQuestions: string[]
}

export type CourseGenerationData = {
  course: Course,
  topics: CourseTopic[],
  prerequisites: ShortCourseInfo[],
  postrequisites: ShortCourseInfo[],
  generalResults:CourseResult[],
  specialResults:CourseResult[],
  programResults:CourseResult[]
}
