export type CourseResult = {
  id: number,
  no: number,
  type: string,
  name: string
}

export type KeyValue = {
  id: number,
  name: string
}

export type ShortCourseInfo = {
  id: number,
  name: string,
  teacher: string
}

export type CourseData = {
  optional: boolean,
  control_type: "exam" | "credit" | "both",
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
  },
  literature: {
    main: string[],
    additional: string[],
    internet: string[]
  }
}

export type GeneratedCourseData = {
  disciplineQuestions?: string[]
  selfMethodGoal?: string,
  selfMethodTask?: string,
  selfMethodGeneral?: string,
  selfMethodIndividualTopics?: string[],
  programGoal?: string
  programTask?: string
  programSubject: string 
  programOrientation?: string,
  programBriefResults?: string,
  programBriefSkills?: string,
  programIntro?: string,
  programBriefIntro?: string
} & Record<string, any>;

export type Course = {
  id: number,
  name: string,
  teacher_id: number,
  teacher?: string,
  data: CourseData,
  generated: GeneratedCourseData | null  
};

export type Teacher = {
  id: number,
  name: string,
  email: string
}

export type GeneratedTopicData = {
  subtopics?: string[],
  keywords?: string[],
  selfQuestions?: string[],
  selfQuestionsShort?: string[],
  referats?: string[],
  quiz?: QuizQuestion[],
  keyQuestions?: string[]
} & Record<string, any>;

export type CourseTopicData = {
  attestation: number,
  fulltime: {    
    hours: number,
    practical_hours: number,
    srs_hours: number
  },
  inabscentia: {
    hours: number,
    practical_hours: number,
    srs_hours: number
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
  semester: number
  topics: CourseTopic[],
  fulltime: {    
    hours: number,
    practical_hours: number,
    srs_hours: number
    total_hours: number
  },
  inabscentia: {
    hours: number,
    practical_hours: number,
    srs_hours: number
    total_hours: number
  }
}

export type CourseSemester = {
  attestations: CourseAttestation[],
  semester: number
  fulltime: {    
    hours: number,
    practical_hours: number,
    srs_hours: number
    total_hours: number
  },
  inabscentia: {
    hours: number,
    practical_hours: number,
    srs_hours: number
    total_hours: number
  }
}

export type CourseGenerationData = {
  course: Course,
  topics: CourseTopic[],
  prerequisites: ShortCourseInfo[],
  postrequisites: ShortCourseInfo[],
  generalResults:CourseResult[],
  specialResults:CourseResult[],
  programResults:CourseResult[],
  // same data grouped by semester or plain attestations for easy access
  semesters: CourseSemester[],
  attestations: CourseAttestation[],
  oneSemesterOnly: boolean,
  hours: {
    total: number,
    fulltime: {
      lectures: number,
      practicals: number,
      srs: number
    },
    inabscentia: {
      lectures: number,
      practicals: number,
      srs: number
    }
  }
}

export type Template = {
  id: number,
  name: string,
  file: string
}

export type Prompt = {
  id: number,
  index: number,
  type: "course" | "topic",
  field: string,
  model: string,
  system_prompt: string,
  prompt: string
}

export type ParsedData = {
  type: 'syllabus' | 'program';
  topics: CourseTopic[]
}
