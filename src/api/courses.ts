import { parseSylabusOrProgram } from "@/docx/parse";
import { courses, courseTopics, teachers } from "@/stores/db";
import type { Course, CourseTopic, GeneratedCourseData, ParsedData } from "@/stores/models";
import type { BunRequest } from "bun";
import path from "path";
import { computeFileHash } from "@/api/utils/files";
import { dropEmpty } from "@/client/util/util";
import { verifyCourse } from "@/docx/verification";

function mergeCourseData(original: Course, parsed: Course & ParsedData): Course {
  const generated = original.generated ?? parsed.generated ?? {} as GeneratedCourseData;
  // IF course is lacking subtopics but we just parsed them – add them to the generated data
  if (parsed.generated?.subtopics && (generated.subtopics?.length ?? 0) === 0) {
    generated.subtopics = parsed.generated.subtopics;
  };

  const data = {
    ...original.data,
    ...dropEmpty(parsed.data)
  }

  return {
    ...original,
    generated,
    data
  } as Course;
}

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
        const files = formData.getAll("files") as File[];
        
        if (!files || files.length === 0) {
          return new Response("No files provided", { status: 400 });
        }

        const results = [];
        const okNo = formData.get("ok_no") as string | null;

        for (const file of files) {
          // Validate file type
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
            // Generate unique filename using hash
            const hash = await computeFileHash(file);
            const fileExtension = path.extname(file.name);
            const uploadFileName = `${hash}${fileExtension}`;
            const uploadsDir = path.join(process.cwd(), "uploads", "courses");
            const uploadPath = path.join(uploadsDir, uploadFileName);

            await Bun.write(uploadPath, file);
            console.log("Saving uploaded file to:", uploadPath);

            const course = await parseSylabusOrProgram(uploadPath, true, { okNo });
            
            if (!course) {
              results.push({
                file: file.name,
                error: "Не вдалось розібрати файл",
                success: false
              });
              continue;
            }

            const dbCourse = await courses.findByName(course.name);
            console.log("Searching by name:", course.name, "Found in DB:", dbCourse);

            if (course.parsed_teacher) {
              // new teacher 
              if (course.parsed_teacher.id === -1) {
                const id = (await teachers.add(course.parsed_teacher))[0].id;
                course.teacher_id = id;
              } else if (course.type === "syllabus") {
                
                const dbTeacher = await teachers.get(course.parsed_teacher.id);

                if (dbTeacher) {
                  console.log("Updating existing teacher with parsed syllabus data:", dbTeacher, course.parsed_teacher);
                  
                  const updatedTeacher = { 
                    ...dbTeacher, 
                    // Syllabus has full teacher name, while program has only short one, so update it
                    name: dbTeacher.name.length < course.parsed_teacher.name.length ? course.parsed_teacher.name : dbTeacher.name,
                    position: course.parsed_teacher.position || dbTeacher.position,
                    email: course.parsed_teacher.email || dbTeacher.email,
                    academic_title: course.parsed_teacher.academic_title || dbTeacher.academic_title
                  };
                  await teachers.update(updatedTeacher);
                }
                await teachers.update(course.parsed_teacher);
              }
            }

            const { issues } = verifyCourse(course);
            const warnings = [...course.parse_warnings, ...issues];        
            course.data.warnings = warnings;

            let updated = dbCourse ? mergeCourseData(dbCourse, course) : course;
          
            console.log(dbCourse ? "Updating course:" : "Adding new course:", updated);        
            
            if (dbCourse) {
              console.log("Existing course found in DB, updating:", dbCourse);
              await courses.update(updated) 
            } else {
              const id = (await courses.add(updated))[0].id;
              course.id = id;

              await Promise.all(
                course.topics
                  .map(c => Object.assign(c, { course_id: course.id }))
                  .map(c => courseTopics.add(c))
              )
            }

            results.push({
              file: file.name,
              course: { ...course, warnings },
              success: true
            });
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