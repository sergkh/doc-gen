import { parseSylabusOrProgram } from "@/docx/parse";
import { courses, courseTopics, teachers, courseResults, specialties } from "@/stores/db";
import type { Course, CourseTopic, GeneratedCourseData, ParsedData } from "@/stores/models";
import type { BunRequest } from "bun";
import path from "path";
import { computeFileHash } from "@/api/utils/files";
import { autofillCourseResults, generateCourseTopics, renameAttestationName } from "@/ai/autofill";
import { coursesService } from "@/services/courses-service";

let _nextTopicId = -1;

// Migration helper: ensure course has topics, falling back to old table if needed
async function getCourseTopics(courseId: number): Promise<CourseTopic[]> {
  const course = await courses.get(courseId);
  if (!course) return [];

  if (!course.topics || course.topics.length === 0) {
    const oldTopics = await courseTopics.all(courseId);
    if (oldTopics.length > 0) {
      course.topics = oldTopics;
      await courses.update(course);
      return oldTopics;
    }
    course.topics = [];
    return [];
  }

  return course.topics;
}

// Helper: add a new topic inline without going through the old table
async function addTopicToCourse(courseId: number, topic: CourseTopic): Promise<CourseTopic> {
  const course = await courses.get(courseId);
  if (!course) throw new Error("Course not found");

  if (!course.topics) {
    course.topics = [];
  }

  const stored: CourseTopic = {
    ...topic,
    course_id: courseId,
    index: course.topics.length + 1,
  };

  course.topics.push(stored);
  await courses.update(course);
  return stored;
}

const coursesApi = {
  "/api/courses": {
      async GET(req: BunRequest) {
        const brief = new URL(req.url).searchParams.get("brief") === "true";
        const topics = new URL(req.url).searchParams.get("topics") === "true";
        const specialtyId = new URL(req.url).searchParams.get("specialtyId");

        console.log(`Fetching all courses ${brief ? "brief" : ""}. ${topics ? "with topics" : ""}. specialtyId: ${specialtyId || "all"}`);
        
        const loadedCourses = await coursesService.getCourses(specialtyId ? Number(specialtyId) : undefined, brief, topics);

        return Response.json(loadedCourses);
      },
      async POST(req: BunRequest) {
        const course = await req.json() as Course;
        await coursesService.createCourse(course);
        return Response.json({ success: true });
      }
  },
  "/api/courses/:id": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Fetching course with ID:", id);
      const course = await coursesService.getCourseById(Number(id));
      if (!course) {
        return new Response("Course not found", { status: 404 });
      }
      return Response.json(course);
    },
    async PUT(req: BunRequest) {
      const { id } = req.params as { id: string };
      const course = await req.json() as Course;

      const updatedCourse = await coursesService.updateCourse(Number(id), course, "Updated by user");
      return Response.json({ success: true, course: updatedCourse });
    },
    async DELETE(req: BunRequest) {
      const { id } = req.params as { id: string };      
      await coursesService.deleteCourse(Number(id));      
      return Response.json({ success: true });
    }
  },
  "/api/courses/parse-docx": {
    async POST(req: BunRequest) {
      try {
        const formData = await req.formData();
        const files = formData.getAll("files") as File[];
        
        if (!files || files.length === 0) {
          return new Response("No files provided", { status: 400 });
        }

        const results = [];
        const okNo = formData.get("ok_no") as string | null;

        for (const file of files) {
          const fileName = file.name.toLowerCase();
          const isDocxFile = 
            file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            fileName.endsWith(".docx");
          
          if (!isDocxFile) {
            results.push({
              file: file.name,
              error: "Invalid file type. Expected .docx file",
              success: false
            });
            continue;
          }

          try {
            const hash = await computeFileHash(file);
            const fileExtension = path.extname(file.name);
            const uploadFileName = `${hash}${fileExtension}`;
            const uploadsDir = path.join(process.cwd(), "uploads", "courses");
            const uploadPath = path.join(uploadsDir, uploadFileName);

            await Bun.write(uploadPath, file);
            console.log("Saving uploaded file to:", uploadPath);

            const res = coursesService.parseCourseDataUpload(uploadPath, okNo);
            if (!res) {
              results.push({file: file.name, error: "Не вдалось розібрати файл", success: false});
            } else {
              results.push({file: file.name, course: res, success: true});
            }
          } catch (error) {
            console.error("Error processing file " + file.name + ":", error);
            results.push({
              file: file.name,
              error: error instanceof Error ? error.message : "Unknown error",
              success: false
            });
          }
        }

        return Response.json(results);
      } catch (error) {
        console.error("Error processing files:", error);
        return new Response(`Error processing files: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
      }
    }
  },
  "/api/courses/:courseId/topics": {
    async GET(req: BunRequest) {
      const { courseId } = req.params as { courseId: string };
      console.log("Fetching topics for course ID:", courseId);
      const topics = await getCourseTopics(Number(courseId));
      return Response.json(topics);
    },
    async POST(req: BunRequest) {
      const { courseId } = req.params as { courseId: string };
      const topic = await req.json() as CourseTopic;
      topic.course_id = Number(courseId);
      console.log("Adding new topic for course ID:", courseId, topic);
      const stored = await addTopicToCourse(Number(courseId), topic);
      return Response.json(stored);
    }
  },
  "/api/courses/:courseId/topics/:index": {
    async GET(req: BunRequest) {
      const { courseId, index } = req.params as { courseId: string; index: string };
      console.log("Fetching topic with index:", index);
      const topics = await getCourseTopics(Number(courseId));
      const topic = topics.find((t) => t.index === Number(index));
      if (!topic) {
        return new Response("Topic not found", { status: 404 });
      }
      return Response.json(topic);
    },
    async PUT(req: BunRequest) {
      const { courseId, index } = req.params as { courseId: string; index: string };
      const updatedTopic = await req.json() as CourseTopic;
      const course = await courses.get(Number(courseId));
      if (!course) {
        return new Response("Course not found", { status: 404 });
      }
      const topics = course.topics ?? [];
      const idx = topics.findIndex((t) => t.index === Number(index));
      if (idx === -1) {
        return new Response("Topic not found", { status: 404 });
      }
      topics[idx] = { ...topics[idx], ...updatedTopic, index: Number(index), course_id: Number(courseId) };
      course.topics = topics;
      console.log("Updating topic with index:", index, updatedTopic);
      await courses.update(course);
      return Response.json(topics[idx]);
    },
    async DELETE(req: BunRequest) {
      const { courseId, index } = req.params as { courseId: string; index: string };
      console.log("Deleting topic with index:", index);
      const course = await courses.get(Number(courseId));
      if (!course) {
        return new Response("Course not found", { status: 404 });
      }
      course.topics = (course.topics ?? []).filter((t) => t.index !== Number(index));
      await courses.update(course);
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
      
      const course = await courses.get(Number(courseId));
      if (!course) {
        return new Response("Course not found", { status: 404 });
      }

      const topics = course.topics ?? [];
      const ordered = topicIds
        .map((id, index) => {
          const t = topics.find((topic) => topic.index === id);
          if (t) return { ...t, index: index + 1 };
          return null;
        })
        .filter((t): t is CourseTopic => t !== null);

      course.topics = ordered;
      await courses.update(course);
      return Response.json({ success: true });
    }
  },
  "/api/courses/:id/results/autofill": {
    async POST(req: BunRequest) {
      const { id } = req.params as { id: string };
      const courseId = Number(id);
      
      const body = await req.json() as { type: string };
      const resultType = body.type;

      if (!resultType || !["ЗК", "СК", "РН"].includes(resultType)) {
        return new Response("Invalid result type. Expected 'ЗК', 'СК', or 'РН'", { status: 400 });
      }     

      try {
        const course = await courses.get(courseId);
        if (!course) {
          return new Response("Course not found", { status: 404 });
        }

        const results = await courseResults.bySpecialty(course.specialty_id);
        const filteredResults = results.filter(r => r.type === resultType);

        if (filteredResults.length === 0) {
          return Response.json([]);
        }

        console.log(`Autofilling ${resultType} from (${filteredResults.length}) results for course ID:`, courseId);

        const matchedResults = await autofillCourseResults(filteredResults, course, "gpt-5-2025-08-07");

        return Response.json(matchedResults);
      } catch (error) {
        console.error("Error autofilling results:", error);
        return new Response(`Error autofilling results: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
      }
    }
  },
  "/api/courses/:id/attestations/:index/ai-rename": {
    async POST(req: BunRequest) {
      const { id, index } = req.params as { id: string; index: string };
      const courseId = Number(id);
      const attestationIndex = Number(index);
      const body = await req.json() as { topics: CourseTopic[] };

      if (!Number.isInteger(attestationIndex) || attestationIndex < 1) {
        return new Response("Invalid attestation index", { status: 400 });
      }

      try {
        const course = await courses.get(courseId);
        if (!course) {
          return new Response("Course not found", { status: 404 });
        }

        const name = await renameAttestationName(course, attestationIndex, body.topics ?? [], "gpt-5-2025-08-07");
        return Response.json({ name });
      } catch (error) {
        console.error("Error renaming attestation:", error);
        return new Response(`Error renaming attestation: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
      }
    }
  },
  "/api/courses/:id/topics/generate": {
    async POST(req: BunRequest) {
      const { id } = req.params as { id: string };
      const courseId = Number(id);

      try {
        const course = await courses.get(courseId);
        if (!course) {
          return new Response("Course not found", { status: 404 });
        }

        const specialty = await specialties.get(course.specialty_id);
        if (!specialty) {
          return new Response("Specialty not found", { status: 404 });
        }

        console.log(`Generating topics for course ID:`, courseId);

        const generatedTopics = await generateCourseTopics(
          course.name,
          course.data.description || "",
          `${specialty.code} ${specialty.name}`,
          course.data.credits,
          "gpt-4o-mini",
          null
        );

        return Response.json(generatedTopics);
      } catch (error) {
        console.error("Error generating topics:", error);
        return new Response(`Error generating topics: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
      }
    }
  },
  "/api/courses/:id/history": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Fetching history for course ID:", id);
      const history = await coursesService.getCourseHistory(Number(id));
      return Response.json(history);
    }
  },
  "/api/courses/:id/history/:historyId/revert": {
    async POST(req: BunRequest) {
      const { id, historyId } = req.params as { id: string; historyId: string };
      console.log("Reverting course ID:", id, "to history entry:", historyId);
      try {
        const course = await coursesService.revertToHistory(Number(id), Number(historyId));
        return Response.json({ success: true, course });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Невідома помилка";
        return new Response(JSON.stringify({ error: message }), { status: 400 });
      }
    }
  }
};

export default coursesApi;