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

export type Course = {
  id: number,
  name: string,
  teacher_id: number,
  teacher?: string,
  data: CourseData
}

export type Teacher = {
  id: number,
  name: string,
  email: string
}

export type Lesson = {
  title: string;
  text: string;
}

export type DisciplineLessons = {
  discipline: string;
  authors: string[];
  lessons: Lesson[];
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

export type MethodGenerationData = {
  discipline: string,
  authors: string[],
  disciplineQuestions: string[],
  topics: Topic[]
}

export type ProgramGenerationData = {
  discipline: string,
  author: string,
  specialty: string,
  area: string
}
