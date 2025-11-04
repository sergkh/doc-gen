import { courses, courseTopics } from "@/stores/db";
import type { Course, CourseTopic } from "@/stores/models";
import type { BunRequest } from "bun";
import path from "path";

async function parseSylabus(filePath: string): Promise<Course> {
  // TODO: Implement syllabus parsing logic
  throw new Error("parseSylabus not implemented");
}


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
  },
  "/api/courses/from-sylabus": {
    async POST(req: BunRequest) {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        
        if (!file) {
          return new Response("No file provided", { status: 400 });
        }

        // Validate file type
        const fileName = file.name.toLowerCase();
        const isDocxFile = 
          file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          fileName.endsWith(".docx");
        
        if (!isDocxFile) {
          return new Response("Invalid file type. Expected .docx file", { status: 400 });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedFileName = fileName.replace(/[^a-z0-9.-]/gi, "_");
        const uploadFileName = `${timestamp}_${sanitizedFileName}`;
        const uploadsDir = path.join(process.cwd(), "uploads");
        const uploadPath = path.join(uploadsDir, uploadFileName);

        // Save the file (Bun.write will create directories if needed)
        await Bun.write(uploadPath, file);
        console.log("Saving uploaded file to:", uploadPath);

        // Parse the syllabus file
        const course = await parseSylabus(uploadPath);
        
        return Response.json(course);
      } catch (error) {
        console.error("Error processing syllabus:", error);
        return new Response(`Error processing syllabus: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
      }
    }
  },
  "/api/courses/:courseId/topics": {
    async GET(req: BunRequest) {
      const { courseId } = req.params as { courseId: string };
      console.log("Fetching topics for course ID:", courseId);
      const topics = await courseTopics.all(Number(courseId));
      return Response.json(topics);
    },
    async POST(req: BunRequest) {
      const { courseId } = req.params as { courseId: string };
      const topic = await req.json() as CourseTopic;
      topic.course_id = Number(courseId);
      console.log("Adding new topic for course ID:", courseId, topic);
      const result = await courseTopics.add(topic);
      return Response.json(result[0]);
    }
  },
  "/api/courses/:courseId/topics/:id": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Fetching topic with ID:", id);
      const topic = await courseTopics.get(Number(id));
      if (!topic) {
        return new Response("Topic not found", { status: 404 });
      }
      return Response.json(topic);
    },
    async PUT(req: BunRequest) {
      const { courseId, id } = req.params as { courseId: string; id: string };
      const topic = await req.json() as CourseTopic;
      topic.id = Number(id);
      topic.course_id = Number(courseId);
      console.log("Updating topic with ID:", id, topic);
      const result = await courseTopics.update(topic);
      return Response.json(result[0]);
    },
    async DELETE(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Deleting topic with ID:", id);
      await courseTopics.delete(Number(id));
      return Response.json({ success: true });
    }
  }
};

export default coursesApi;