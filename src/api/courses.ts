import { parseSylabusOrProgram } from "@/docx/parse";
import { courses, courseTopics } from "@/stores/db";
import type { Course, CourseTopic } from "@/stores/models";
import type { BunRequest } from "bun";
import path from "path";
import { computeFileHash } from "@/api/utils/files";

const coursesApi = {
  "/api/courses": {
      async GET(req: BunRequest) {
        const brief = new URL(req.url).searchParams.get("brief") === "true";
        console.log(`Fetching all courses ${brief ? "brief" : ""}`);
        return Response.json(brief ? await courses.brief() : await courses.all());
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
      await courses.update(course);
      return Response.json({ success: true });
    },
    async DELETE(req: BunRequest) {
      try {
        const { id } = req.params as { id: string };
        const courseId = Number(id);
        console.log("Deleting course with ID:", id);
        await courses.delete(courseId);
        return Response.json({ success: true });
      } catch (error) {
        console.error("Error deleting course:", error);
        return new Response(
          `Error deleting course: ${error instanceof Error ? error.message : "Unknown error"}`,
          { status: 500 }
        );
      }
    }
  },
  "/api/courses/parse-docx": {
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

        // Generate unique filename using hash
        const hash = await computeFileHash(file);
        const fileExtension = path.extname(file.name);
        const uploadFileName = `${hash}${fileExtension}`;
        const uploadsDir = path.join(process.cwd(), "uploads", "courses");
        const uploadPath = path.join(uploadsDir, uploadFileName);

        await Bun.write(uploadPath, file);
        console.log("Saving uploaded file to:", uploadPath);

        const course = await parseSylabusOrProgram(uploadPath);        
        
        if (!course) {
          return new Response("Не вдалось розібрати файл", { status: 400 });
        }

        const dbCourse = await courses.findByName(course.name);
        
        const updated = dbCourse ? { ...dbCourse, ...course, id: dbCourse.id } : course;
      
        console.log(dbCourse ? "Updating course:" : "Adding new course:", updated);
        
        // TODO: properly merge course and topics from update
        if(dbCourse) {
          await courses.update(updated) }
        else {
          const id = (await courses.add(updated))[0].id;
          course.id = id;

          await Promise.all(
            course.topics
              .map(c => Object.assign(c, { course_id: course.id }))
              .map(c => courseTopics.add(c))
          )
        }

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
  },
  "/api/courses/:courseId/topics/order": {
    async PUT(req: BunRequest) {
      const { courseId } = req.params as { courseId: string };
      const topicIds = await req.json() as number[];
      
      if (!Array.isArray(topicIds)) {
        return new Response("Invalid request body. Expected array of topic IDs", { status: 400 });
      }

      if (topicIds.length === 0) {
        return new Response("Topic IDs array cannot be empty", { status: 400 });
      }

      console.log("Reordering topics for course ID:", courseId, "with IDs:", topicIds);
      
      try {
        await courseTopics.updateOrdering(Number(courseId), topicIds);
        return Response.json({ success: true });
      } catch (error) {
        console.error("Error reordering topics:", error);
        return new Response(`Error reordering topics: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
      }
    }
  }
}

export default coursesApi;