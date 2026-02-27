import { parseSylabusOrProgram } from "@/docx/parse";
import { courses, courseTopics, teachers, courseResults, specialties } from "@/stores/db";
import type { Course, CourseTopic, GeneratedCourseData, ParsedData } from "@/stores/models";
import type { BunRequest } from "bun";
import path from "path";
import { computeFileHash } from "@/api/utils/files";
import { dropEmpty } from "@/client/util/util";
import { verifyCourse } from "@/docx/verification";
import { autofillCourseResults, generateCourseTopics } from "@/ai/autofill";

function mergeCourseData(original: Course, parsed: Course & ParsedData): Course {
  const generated = original.generated ?? parsed.generated ?? {} as GeneratedCourseData;
  // IF course is lacking subtopics but we just parsed them – add them to the generated data
  if (parsed.generated?.subtopics && (generated.subtopics?.length ?? 0) === 0) {
    generated.subtopics = parsed.generated.subtopics;
  };

  const data = {
    ...original.data,
    ...dropEmpty(parsed.data, { 
      blacklist: ['prerequisites', 'postrequisites'] // those might become empty
    })
  }

  return {
    ...original,
    teacher_id: parsed.teacher_id || original.teacher_id,
    specialty_id: parsed.specialty_id || original.specialty_id,
    teacher: parsed.teacher || original.teacher,
    generated,
    data
  } as Course;
}

async function mergeCourseTopics(courseId: number, parsedTopics: CourseTopic[]) {
  if (parsedTopics.length === 0) return ;
  const existingTopics = await courseTopics.all(courseId);
  const existingTopicsMap = new Map(existingTopics.map(t => [t.index, t]));

  if (existingTopics.length === 0) {
    // No existing topics, just add all parsed
    await Promise.all(
      parsedTopics
        .map(c => Object.assign(c, { course_id: courseId }))
        .map(c => courseTopics.add(c))
    );
    return;
  } else {    
    // implement merging of topics based on name matching
    for (const parsedTopic of parsedTopics) {
      const existingTopic = existingTopicsMap.get(parsedTopic.index);
      if (existingTopic) {
        // Update existing topic with parsed data
        await courseTopics.update(mergeCourseTopic(existingTopic, parsedTopic));
      } else {
        // Add new topic
        await courseTopics.add(Object.assign(parsedTopic, { course_id: courseId }));
      }
    }
  }
}

function mergeCourseTopic(existing: CourseTopic, parsed: CourseTopic) {
  // pick whatever is not 0
  const mergedData = {
    attestation: parsed.data?.attestation ?? existing.data?.attestation,
    fulltime: {    
      hours: parsed.data?.fulltime?.hours ?? existing.data?.fulltime?.hours,
      practical_hours: parsed.data?.fulltime?.practical_hours ?? existing.data?.fulltime?.practical_hours,
      srs_hours: parsed.data?.fulltime?.srs_hours ?? existing.data?.fulltime?.srs_hours,
    },
    inabscentia: {
      hours: parsed.data?.inabscentia?.hours ?? existing.data?.inabscentia?.hours,
      practical_hours: parsed.data?.inabscentia?.practical_hours ?? existing.data?.inabscentia?.practical_hours,
      srs_hours: parsed.data?.inabscentia?.srs_hours ?? existing.data?.inabscentia?.srs_hours
    }
  }

  return {
    id: existing.id,
    course_id: existing.course_id,
    index: existing.index,
    name: parsed.name ?? existing.name,
    lection: parsed.lection ?? existing.lection,
    data: mergedData,
    generated: existing.generated
  } as CourseTopic;
}

const coursesApi = {
  "/api/courses": {
      async GET(req: BunRequest) {
        const brief = new URL(req.url).searchParams.get("brief") === "true";
        const topics = new URL(req.url).searchParams.get("topics") === "true";
        const specialtyId = new URL(req.url).searchParams.get("specialtyId");
        console.log(`Fetching all courses ${brief ? "brief" : ""}. ${topics ? "with topics" : ""}. specialtyId: ${specialtyId || "all"}`);
        
        let loadedCourses: Course[];
        if (specialtyId) {
          loadedCourses = await courses.bySpecialty(Number(specialtyId));
        } else {
          loadedCourses = brief ? await courses.brief() as unknown as Course[] : await courses.all();
        }
        
        // not nice, but works for now
        if (topics) {
          await Promise.all(
            loadedCourses.map(async (course) => {
              const courseTopicsList = await courseTopics.all(course.id);
              (course as Course & { topics: CourseTopic[] }).topics = courseTopicsList;
            })
          );
        }

        return Response.json(loadedCourses);
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
                    position: course.parsed_teacher.position ?? dbTeacher.position,
                    email: course.parsed_teacher.email ?? dbTeacher.email,
                    academic_title: course.parsed_teacher.academic_title ?? dbTeacher.academic_title
                  };
                  await teachers.update(updatedTeacher);                  
                }
                
                await teachers.update(course.parsed_teacher);

                course.teacher_id = course.parsed_teacher.id;
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
              mergeCourseTopics(dbCourse.id, course.topics);
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

        const topics = await courseTopics.all(courseId);
        const topicNames = topics.map(t => t.name);

        console.log(`Autofilling ${resultType} from (${filteredResults.length}) results for course ID:`, courseId);

        const matchedResults = await autofillCourseResults(
          filteredResults,
          course.name,
          course.data.description || "",
          topicNames,
          "gpt-4o",
          null
        );

        return Response.json(matchedResults);
      } catch (error) {
        console.error("Error autofilling results:", error);
        return new Response(`Error autofilling results: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
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
  }
}

export default coursesApi;