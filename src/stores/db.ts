import path from "path";
import { sql } from "bun";
import type { Course, CourseResult, CourseTopic, ShortCourseInfo } from "./models";

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

  add: async (c: Course) => {
    return await sql`INSERT INTO courses 
      (name, teacher_id, data) VALUES (${c.name}, ${c.teacher_id}, ${c.data})`;
  },
  
  get: async (id: number): Promise<Course | null> => {
    const result = await sql`SELECT c.*, t.name as teacher FROM courses c INNER JOIN teachers t ON c.teacher_id = t.id WHERE c.id = ${id}`;
    return result[0] || null;
  },

  getShortInfos: async(list: number[]): Promise<ShortCourseInfo[]> => {
    const result = await sql`SELECT c.id, c.name, t.name as teacher FROM courses c INNER JOIN teachers t ON c.teacher_id = t.id WHERE c.id IN (${list})`;
    return result as ShortCourseInfo[];
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
  all: async () => await sql`SELECT * FROM teachers ORDER BY name`,
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
      (course_id, index, name, lection, generated) 
      VALUES (${topic.course_id}, ${topic.index}, ${topic.name}, ${topic.lection}, ${topic.generated}) RETURNING *`;
  },

  update: async (topic: CourseTopic) => {
    return await sql`UPDATE course_topics 
      SET index = ${topic.index}, 
          name = ${topic.name},
          lection = ${topic.lection}, 
          generated = ${topic.generated},
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
  list: async (ids: number[]): Promise<CourseResult[]> => {
    return await sql`SELECT * FROM course_results WHERE id IN (${ids}) ORDER BY type, no` as CourseResult[];
  },
};

export { courses, teachers, courseTopics , courseResults };
