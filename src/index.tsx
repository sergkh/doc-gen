import { serve, type BunRequest } from "bun";
import index from "./index.html";
import { generateAll } from "./generator";
import { renderProgram, renderSelfMethod } from "./docx/docx";
import { MethodTestData } from "./stores/test-data";
import type { Course, DisciplineLessons, ProgramGenerationData } from "./stores/models";
import { teachers } from "./stores/db";
const { courses } = await import("./stores/db");

function wordResp(file: ArrayBuffer, name: string): Response {
  return new Response(file, { 
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `inline; filename=\"${name}\"`,
    }
  });
}

const teachersApi = {
  "/api/teachers": {
      async GET() {
        console.log("Fetching all teachers");
        return Response.json(await teachers.all());
      }
  }
};

const coursesApi = {
  "/api/courses": {
      async GET() {
        console.log("Fetching all courses");
        return Response.json(await courses.all());
      },
      async POST(req: BunRequest) {
        const course = await req.json() as Course;
        console.log("Adding new course", course);
        await courses.add(course);
        return Response.json({ success: true });
      }
  },
  "/api/courses/:id": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Fetching course with ID:", id);
      const course = await courses.get(Number(id));
      if (!course) {
        return new Response("Course not found", { status: 404 });
      }
      return Response.json(course);
    },
    async PUT(req: BunRequest) {
      const { id } = req.params as { id: string };
      const course = await req.json() as Course;
      console.log("Updating course with ID:", id, course);
      await courses.add(course); // Assuming add works for both insert and update
      return Response.json({ success: true });
    }
  }
};

const server = serve({
  routes: {    
    "/*": index, // Serve index.html for all unmatched routes.    
    
    "/api/generate/self-method": {
      async POST(req) {
        const discipline = await req.json() as DisciplineLessons;
        // const data = await generateAll(discipline);

        const doc = await renderSelfMethod(MethodTestData)
        return wordResp(doc, "method-sam.docx")
      }
    },
    "/api/generate/program": {
      async POST(req) {
        const program = await req.json() as ProgramGenerationData;
        const doc = await renderProgram(program)
        return wordResp(doc, "program.docx")
      }
    },
    ...coursesApi,
    ...teachersApi
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true, // Enable browser hot reloading in development
    console: true, // Echo console logs from the browser to the server
  }
});

console.log(`🚀 Server running at ${server.url}`);
