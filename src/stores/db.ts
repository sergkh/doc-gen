import path from "path";
import { sql } from "bun";
import type { Course } from "./models";

// Initialize the database connection
await sql.file(path.resolve(__dirname, "schema.sql"));

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
};

const teachers = {
  all: async () => await sql`SELECT * FROM teachers ORDER BY name`,
};

export { courses, teachers };
