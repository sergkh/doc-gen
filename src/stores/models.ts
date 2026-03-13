export type CourseResult = {
  id: number,
  no: number,
  specialty_id: number | null,
  type: "ЗК" | "СК" | "РН" | "ІК",
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

export type CourseSemesters = {
  semesters: number[],
  study_year: number
}

export type HoursStruct = {
  fulltime: {    
    hours: number,
    practical_hours: number,
    lab_hours: number,
    srs_hours: number
  },
  inabscentia?: {
    hours: number,
    practical_hours: number,
    lab_hours: number,
    srs_hours: number
  }
}

export type CourseData = {
  ok_no: string | null, // numbers like '1' or '1.1' but stored as string to preserve formatting
  practice?: boolean, 
  optional: boolean,
  type?: "lesson" | "practice",
  control_type: "exam" | "credit" | "both",
  hours: number,
  hours_detailed?: HoursStruct,
  credits: number,
  specialty_mode: 'new_only' | 'old_only' | 'both' | 'unknown',
  specialty: string,
  area: string,
  description: string,
  prerequisites: string[],
  postrequisites: string[],
  results: number[],
  attestations: {
    name: string,
    semester: number
  }[],
  fulltime: CourseSemesters,
  inabscentia: CourseSemesters,
  literature: {
    main: string[],
    additional: string[],
    internet: string[]
  },
  warnings?: string[]
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
  specialty_id: number,
  teacher?: string,
  data: CourseData,
  generated: GeneratedCourseData | null  
};

export type TeacherPosition = "аспірант" | "асистент" | "старший викладач" | "доцент" | "професор";
export type AcademicTitle = "кандидат технічних наук" | "кандидат економічних наук" | "кандидат педагогічних наук" | "PhD економічних наук" | "доктор економічних наук" | "доктор технічних наук";

export type Teacher = {
  id: number,
  name: string,
  email: string | null,
  position: TeacherPosition | null,
  academic_title: AcademicTitle | null,
  alt_names: string[]
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

export type CourseTopicData = { attestation: number } & HoursStruct;

export type CourseTopic = {
  id: number,
  course_id: number,
  index: number,
  name: string,
  lection: string,
  data: CourseTopicData,
  generated: GeneratedTopicData
}

export type QuizQuestion = {
  question: string,
  options: string[],
  answerIndex: number
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
} & Record<string, any>; // parameters input by the user for the template

export type TemplateParameter = {
  name: string,
  description?: string,
  type: "text" | "number" | "boolean" | "list" | "object", 
  subtype?: "text" | "number" | "boolean" | "object",
  dictionary?: string | string[],
  optionsUrl?: string
}

export type Template = {
  id: number,
  name: string,
  file: string,
  data: {
    parameters?: TemplateParameter[]
  },
  prompts: Prompt[]
}

export type Prompt = {
  name: string,
  type: "course" | "topic",
  field: string,
  model: string,
  system_prompt: string,
  prompt: string,
  format: "text" | "list" | "quiz",
}

export type ParsedData = {
  type: 'syllabus' | 'program';
  topics: CourseTopic[],
  parsed_teacher: Teacher,
  parse_warnings: string[]
}

export type SpecialtyDisciplineConfig = {
  ok_no: string,
  name: string,
  credits: number,
  control_type: "exam" | "credit" | "both"
}
export type SpecialtyData = {
  disciplines: SpecialtyDisciplineConfig[]
}

export type Specialty = {
  id: number,
  code: string,
  name: string,
  old_code: string,
  old_name: string,
  area_code: string,
  area: string,
  qualification: string;
  data: SpecialtyData
}

export type PromptResult = {
  field: string;
  system_prompt: string;
  prompt: string;
  item: any;
};

export type TeacherPublicationType = "Scopus" | "Article" | "Methodical work" | "Unknown";

export type TeacherPublication = {
  id: number;
  repo_id?: string | null;
  teacher_id: number;
  title: string;
  year: number | null;
  journal: string | null;
  publication_type: TeacherPublicationType;
  data?: Record<string, any>;
};

export type DocObjectType = "teacher" | "course" | "specialty" | "template" | "topic";

// Used for document versioning
export type DocVersionRecord = {
  id: number;
  object_id: number;
  object_type: DocObjectType;
  type: "snapshot" | "patch";
  stamp: string;
  comment: string;
  data: any;
};