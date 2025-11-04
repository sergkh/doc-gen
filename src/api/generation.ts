import { generateCourseInfo } from "@/ai/generator";
import { renderProgram, renderSelfMethod } from "@/docx/docx";
import { courseResults, courses, courseTopics } from "@/stores/db";
import type { Course, CourseGenerationData, CourseTopic } from "@/stores/models";
import type { BunRequest } from "bun";

function wordResp(file: ArrayBuffer, name: string): Response {
  return new Response(file, { 
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `inline; filename=\"${name}\"`,
    }
  });
}

async function loadFullCourseInfo(course: Course, topics: CourseTopic[]): Promise<CourseGenerationData> {
  const { course: updatedCourse, topics: updatedTopics } = await generateCourseInfo(course, topics);

  const prerequisites = await courses.getShortInfos(course.data.prerequisites);
  const postrequisites = await courses.getShortInfos(course.data.postrequisites);
  const results = await courseResults.list(course.data.results);

  return {
    course: updatedCourse,
    topics: updatedTopics,
    prerequisites,
    postrequisites,
    generalResults: results.filter(r => r.type === "ЗК").sort((a, b) => a.no - b.no),
    specialResults: results.filter(r => r.type === "СК").sort((a, b) => a.no - b.no),
    programResults: results.filter(r => r.type === "РН").sort((a, b) => a.no - b.no),
  } as CourseGenerationData
}

const generationApi = {
  "/api/courses/:id/generated/self-method": {
    async POST(req: BunRequest) {
      const { id } = req.params as { id: string };
      const course = await courses.get(Number(id));
      
      if (!course) {
        return new Response("Course not found", { status: 404 });
      }

      const topics = await courseTopics.all(Number(id));
      if (topics.length === 0) {
        return new Response("No topics found", { status: 404 });
      }

      const renderData = await loadFullCourseInfo(course, topics);
    
      const doc = await renderSelfMethod(renderData)
      return wordResp(doc, "method-sam.docx")
    }
  },
  "/api/courses/:id/generated/program": {
    async POST(req: BunRequest) {
      const { id } = req.params as { id: string };
      const course = await courses.get(Number(id));
      
      if (!course) {
        return new Response("Course not found", { status: 404 });
      }

      const topics = await courseTopics.all(Number(id));
      if (topics.length === 0) {
        return new Response("No topics found", { status: 404 });
      }

      const renderData = await loadFullCourseInfo(course, topics);
      const doc = await renderProgram(renderData)
      return wordResp(doc, "program.docx")
    }
  }
};

export default generationApi