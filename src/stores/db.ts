import path from "path";
import { sql } from "bun";
import type { Course, CourseResult, CourseTopic, KeyValue, ShortCourseInfo, Teacher, Template } from "./models";

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
      (name, teacher_id, data) VALUES (${c.name}, ${c.teacher_id}, ${c.data})`;
  },
  
  get: async (id: number): Promise<Course | null> => {
    const result = await sql`SELECT c.*, t.name as teacher FROM courses c INNER JOIN teachers t ON c.teacher_id = t.id WHERE c.id = ${id}`;
    return result[0] || null;
  },

  getShortInfos: async(list: number[]): Promise<ShortCourseInfo[]> => {
    if (list.length === 0) return []; // sending empty array returns an error
    return await sql`SELECT c.id, c.name, t.name as teacher FROM courses c INNER JOIN teachers t ON c.teacher_id = t.id WHERE c.id IN ${sql(list)}` as ShortCourseInfo[];
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
};

const teachers = {
  all: async (): Promise<Teacher[]> => {
    return await sql`SELECT * FROM teachers ORDER BY name`;
  },

  get: async (id: number): Promise<Teacher | null> => {
    const result = await sql`SELECT * FROM teachers WHERE id = ${id}`;
    return result[0] || null;
  },

  add: async (teacher: Teacher) => {
    return await sql`INSERT INTO teachers (name, email) VALUES (${teacher.name}, ${teacher.email})`;
  },

  update: async (teacher: Teacher) => {
    return await sql`UPDATE teachers 
      SET name = ${teacher.name}, 
          email = ${teacher.email}, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${teacher.id}
      RETURNING *`;
  },

  delete: async (id: number) => {
    return await sql`DELETE FROM teachers WHERE id = ${id}`;
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
    return await sql`SELECT * FROM course_results ORDER BY type, no` as CourseResult[];
  },

  list: async (ids: number[]): Promise<CourseResult[]> => {
    if (ids.length === 0) return []; // sending empty array returns an error
    return await sql`SELECT * FROM course_results WHERE id IN ${sql(ids)} ORDER BY type, no` as CourseResult[];
  },

  get: async (id: number): Promise<CourseResult | null> => {
    const result = await sql`SELECT * FROM course_results WHERE id = ${id}`;
    return result[0] || null;
  },

  add: async (result: CourseResult) : Promise<number> => {
    return (await sql`INSERT INTO course_results (no, type, name) VALUES (${result.no}, ${result.type}, ${result.name}) RETURNING *`)[0].id;
  },

  update: async (result: CourseResult) => {
    return await sql`UPDATE course_results 
      SET no = ${result.no}, 
          type = ${result.type}, 
          name = ${result.name}, 
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
    return await sql`INSERT INTO templates (name, file) VALUES (${template.name}, ${template.file}) RETURNING *`;
  },

  update: async (template: Template) => {
    return await sql`UPDATE templates 
      SET name = ${template.name}, 
          file = ${template.file}, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${template.id}
      RETURNING *`;
  },

  delete: async (id: number) => {
    return await sql`DELETE FROM templates WHERE id = ${id}`;
  },
};

export { courses, teachers, courseTopics , courseResults, templates };
