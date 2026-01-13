import path from "path";
import { sql } from "bun";
import type { Course, CourseResult, CourseTopic, KeyValue, ShortCourseInfo, Specialty, Teacher, TeacherPublication, Template } from "./models";

// Initialize the database connection
try {
  await sql.file(path.resolve(__dirname, "schema.sql"));
} catch (error) {
  console.error("Failed to initialize database schema. Check if PostgreSQL connection set using DATABASE_URL env variable\n\n", error);
  process.exit(1);
}

const courses = {
  all: async (): Promise<Course[]> => {
    return await sql`SELECT c.*, t.name as teacher FROM courses c INNER JOIN teachers t ON c.teacher_id = t.id ORDER BY name`;
  },

  brief: async (): Promise<KeyValue[]> => {
    return await sql`SELECT c.id, c.name FROM courses c ORDER BY name`;
  },

  add: async (c: Course) => {
    return await sql`INSERT INTO courses 
      (name, teacher_id, data, generated) VALUES (${c.name}, ${c.teacher_id}, ${c.data}, ${c.generated}) RETURNING *`;
  },
  
  get: async (id: number): Promise<Course | null> => {
    const result = await sql`SELECT c.*, t.name as teacher FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id WHERE c.id = ${id}`;
    return result[0] || null;
  },

  findByName: async (name: string): Promise<Course | null> => {
    const result = await sql`SELECT c.*, t.name as teacher FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id WHERE c.name = ${name}`;
    return result[0] || null;
  },

  getShortInfos: async(list: number[]): Promise<ShortCourseInfo[]> => {
    if (list.length === 0) return []; // sending empty array returns an error
    return await sql`SELECT c.id, c.name, t.name as teacher FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id WHERE c.id IN ${sql(list)}` as ShortCourseInfo[];
  },

  update: async (course: Course) => {
    return await sql`UPDATE courses 
      SET name = ${course.name}, 
          teacher_id = ${course.teacher_id}, 
          data = ${course.data}, 
          generated = ${course.generated},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${course.id}`;
  },

  delete: async (id: number) => {
    // Delete course topics first (no foreign key cascade)
    await sql`DELETE FROM course_topics WHERE course_id = ${id}`;
    // Then delete the course
    return await sql`DELETE FROM courses WHERE id = ${id}`;
  },
};

const teachers = {
  all: async (): Promise<Teacher[]> => {
    return await sql`SELECT * FROM teachers ORDER BY name`;
  },

  get: async (id: number): Promise<Teacher | null> => {
    const result = await sql`SELECT * FROM teachers WHERE id = ${id}`;
    return result[0] || null;
  },

  findByName: async (name: string): Promise<Teacher | null> => {
    const nameParts = name.split(/[\.\s]+/).map(n => n.trim().endsWith(".") ? n.trim().slice(0, -1) : n.trim()).filter(n => n.length > 0);
    const likePattern = nameParts[0] + " " + nameParts.slice(1).map(n => `${n}%`).join(" ");
    const result = await sql`SELECT * FROM teachers WHERE name LIKE ${likePattern}`;
    return result[0] || null;
  },
  
   add: async (teacher: Teacher) => {
    return await sql`INSERT INTO teachers (name, email, position, academic_title, alt_names) VALUES (${teacher.name}, ${teacher.email}, ${teacher.position}, ${teacher.academic_title}, ${teacher.alt_names}) RETURNING *`;
  },

   update: async (teacher: Teacher) => {
    return await sql`UPDATE teachers 
      SET name = ${teacher.name}, 
          email = ${teacher.email}, 
          position = ${teacher.position},
          academic_title = ${teacher.academic_title},
          alt_names = ${teacher.alt_names},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${teacher.id}
      RETURNING *`;
  },

   delete: async (id: number) => {
     return await sql`DELETE FROM teachers WHERE id = ${id}`;
   },
};

const teacherPublications = {
  all: async (): Promise<TeacherPublication[]> => {
    return await sql`SELECT * FROM teacher_publications ORDER BY year DESC, title` as TeacherPublication[];
  },

  byTeacher: async (teacherId: number): Promise<TeacherPublication[]> => {
    return await sql`SELECT * FROM teacher_publications WHERE teacher_id = ${teacherId} ORDER BY year DESC, title` as TeacherPublication[];
  },

  get: async (id: number): Promise<TeacherPublication | null> => {
    const result = await sql`SELECT * FROM teacher_publications WHERE id = ${id}`;
    return result[0] || null;
  },

  add: async (publication: Omit<TeacherPublication, "id">) => {
    return await sql`INSERT INTO teacher_publications 
      (teacher_id, title, year, journal, publication_type, repo_id, data) 
      VALUES (${publication.teacher_id}, ${publication.title}, ${publication.year}, ${publication.journal}, ${publication.publication_type}, ${publication.repo_id}, ${publication.data}) 
      RETURNING *`;
  },

  update: async (publication: TeacherPublication) => {
    return await sql`UPDATE teacher_publications 
      SET teacher_id = ${publication.teacher_id},
          title = ${publication.title},
          year = ${publication.year},
          journal = ${publication.journal},
          publication_type = ${publication.publication_type},
          repo_id = ${publication.repo_id},
          data = ${publication.data},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${publication.id}
      RETURNING *`;
  },

  delete: async (id: number) => {
    return await sql`DELETE FROM teacher_publications WHERE id = ${id}`;
  },

  deleteByTeacher: async (teacherId: number) => {
    return await sql`DELETE FROM teacher_publications WHERE teacher_id = ${teacherId}`;
  },
};

const courseTopics = {
  all: async (courseId: number): Promise<CourseTopic[]> => {
    return await sql`SELECT * FROM course_topics WHERE course_id = ${courseId} ORDER BY index`;
  },

  get: async (id: number): Promise<CourseTopic | null> => {
    const result = await sql`SELECT * FROM course_topics WHERE id = ${id}`;
    return result[0] || null;
  },

  add: async (topic: CourseTopic) => {
    return await sql`INSERT INTO course_topics 
      (course_id, index, name, lection, generated, data) 
      VALUES (${topic.course_id}, ${topic.index}, ${topic.name}, ${topic.lection}, ${topic.generated}, ${topic.data}) RETURNING *`;
  },

  update: async (topic: CourseTopic) => {
    return await sql`UPDATE course_topics 
      SET index = ${topic.index}, 
          name = ${topic.name},
          lection = ${topic.lection}, 
          generated = ${topic.generated},
          data = ${topic.data},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${topic.id}
      RETURNING *`;
  },

  updateOrdering: async (courseId: number, topics: number[]) => {    
    await Promise.all(
      topics.map(async (topicId, index) => 
        await sql`UPDATE course_topics SET index=${index+1} WHERE id=${topicId} AND course_id=${courseId}`
      )
    );
  },

  delete: async (id: number) => {
    return await sql`DELETE FROM course_topics WHERE id = ${id}`;
  },
};

const courseResults = {
  all: async (): Promise<CourseResult[]> => {
    return await sql`
      SELECT 
        cr.id,
        cr.no,
        cr.specialty_id,
        cr.type,
        cr.name,
        s.code as specialty_code,
        s.name as specialty_name,
        s.area_code as specialty_area_code,
        s.area as specialty_area
      FROM course_results cr
      LEFT JOIN specialties s ON cr.specialty_id = s.id
      ORDER BY cr.specialty_id, cr.type, cr.no
    ` as CourseResult[];
  },

  list: async (ids: number[]): Promise<CourseResult[]> => {
    if (ids.length === 0) return []; // sending empty array returns an error
    return await sql`SELECT * FROM course_results WHERE id IN ${sql(ids)} ORDER BY type, no` as CourseResult[];
  },

  bySpecialty: async (specialtyId: number): Promise<CourseResult[]> => {
    return await sql`
      SELECT *
      FROM course_results cr      
      WHERE cr.specialty_id = ${specialtyId} ORDER BY cr.type, cr.no` as CourseResult[];
  },

  get: async (id: number): Promise<CourseResult | null> => {
    const result = await sql`
      SELECT * FROM course_results cr WHERE cr.id = ${id}
    `;
    return result[0] || null;
  },

  add: async (result: CourseResult) : Promise<number> => {
    return (await sql`INSERT INTO course_results (no, type, name, specialty_id) 
      VALUES (${result.no}, ${result.type}, ${result.name}, ${result.specialty_id}) 
      ON CONFLICT (no, type, specialty_id) DO UPDATE SET name = EXCLUDED.name RETURNING *`)[0].id;
  },

  update: async (result: CourseResult) => {
    return await sql`UPDATE course_results 
      SET no = ${result.no}, 
          type = ${result.type}, 
          name = ${result.name}, 
          specialty_id = ${result.specialty_id},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${result.id}
      RETURNING *`;
  },

  delete: async (id: number) => {
    return await sql`DELETE FROM course_results WHERE id = ${id}`;
  },
};

const templates = {
  all: async (): Promise<Template[]> => {
    return await sql`SELECT * FROM templates ORDER BY name` as Template[];
  },

  get: async (id: number): Promise<Template | null> => {
    const result = await sql`SELECT * FROM templates WHERE id = ${id}`;
    return result[0] || null;
  },

  add: async (template: Template) => {
    return await sql`INSERT INTO templates (name, file, data, prompts) VALUES (${template.name}, ${template.file}, ${template.data}, ${template.prompts}) RETURNING *`;
  },

  update: async (template: Template) => {
    return await sql`UPDATE templates 
      SET name = ${template.name}, 
          file = ${template.file}, 
          data = ${template.data},
          prompts = ${template.prompts},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${template.id}
      RETURNING *`;
  },

  delete: async (id: number) => {
    return await sql`DELETE FROM templates WHERE id = ${id}`;
  },
};

const specialties = {
  all: async (): Promise<Specialty[]> => {
    return await sql`SELECT * FROM specialties ORDER BY code, name` as Specialty[];
  },

  get: async (id: number): Promise<Specialty | null> => {
    const result = await sql`SELECT * FROM specialties WHERE id=${id}`;
    return result[0] || null;
  },

  findByName: async (name: string): Promise<Specialty | null> => {
    const result = await sql`SELECT * FROM specialties WHERE name=${name} or old_name=${name}`;
    return result[0] || null;
  },

  findByCode: async (code: string): Promise<Specialty | null> => {
    console.log("Searching specialty by code:", code);
    const result = await sql`SELECT * FROM specialties WHERE code=${code} or old_code=${code}`;
    return result[0] || null;
  },
  
  add: async (specialty: Specialty) => {
    return await sql`INSERT INTO specialties (code, name, old_code, old_name, area_code, area, qualification, data) 
      VALUES (${specialty.code}, ${specialty.name}, ${specialty.old_code}, ${specialty.old_name}, ${specialty.area_code}, ${specialty.area}, ${specialty.qualification}, ${specialty.data}) 
      RETURNING *`;
  },

  update: async (specialty: Specialty) => {
    return await sql`UPDATE specialties 
      SET name = ${specialty.name}, 
          code = ${specialty.code},
          old_code = ${specialty.old_code},
          old_name = ${specialty.old_name},
          area_code = ${specialty.area_code},
          area = ${specialty.area}, 
          qualification = ${specialty.qualification},
          data = ${specialty.data},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${specialty.id}
      RETURNING *`;
  },

  delete: async (id: number) => {
    return await sql`DELETE FROM specialties WHERE id = ${id}`;
  },
};

export { courses, teachers, courseTopics , courseResults, templates, specialties, teacherPublications };
