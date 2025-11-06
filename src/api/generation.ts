import { generateCourseInfo } from "@/ai/generator";
import { renderDoc } from "@/docx/render";
import { courseResults, courses, courseTopics, templates } from "@/stores/db";
import type { Course, CourseAttestation, CourseGenerationData, CourseTopic, Template } from "@/stores/models";
import type { BunRequest } from "bun";

type JobStatus = "pending" | "generating" | "rendering" | "completed" | "error";

interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  error?: string;
  result?: ArrayBuffer;
  filename?: string;
}

const jobs = new Map<string, Job>();

function generateJobId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function wordResp(file: ArrayBuffer, name: string): Response {
  return new Response(file, { 
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `inline; filename=\"${name}\"`,
    }
  });
}

async function loadFullCourseInfo(
  course: Course, 
  topics: CourseTopic[],
  onProgress?: (progress: number) => void,
  apiKey?: string
): Promise<CourseGenerationData> {
  onProgress?.(5);
  
  // Generate course info - this is the slow part (AI generation)
  // Progress from 5% to 70% (65% for AI generation)
  const { course: updatedCourse, topics: updatedTopics } = await generateCourseInfo(course, topics, (progress: number) => {
    onProgress?.(5 + progress * 0.65); // Scale progress to 65%
  }, apiKey);
  
  // Estimate progress: if we have N topics, each topic is roughly 65% / N
  // For now, we'll report 70% after generation completes
  onProgress?.(70);

  const prerequisites = await courses.getShortInfos(course.data.prerequisites);
  onProgress?.(80);
  const postrequisites = await courses.getShortInfos(course.data.postrequisites);
  onProgress?.(85);

  const results = await courseResults.list(course.data.results);
  onProgress?.(90);

  // group topics by attestation
  const attestations = course.data.attestations.map((a, index) => ({
    no: index+1,
    name: a.name,
    topics: updatedTopics.filter(t => t.data?.attestation === index + 1)
  } as CourseAttestation));

  onProgress?.(95);
  
  return {
    course: updatedCourse,
    topics: updatedTopics,
    prerequisites,
    postrequisites,
    generalResults: results.filter(r => r.type === "ЗК").sort((a, b) => a.no - b.no),
    specialResults: results.filter(r => r.type === "СК").sort((a, b) => a.no - b.no),
    programResults: results.filter(r => r.type === "РН").sort((a, b) => a.no - b.no),
    attestations  
  } as CourseGenerationData
}

async function runGenerationJob(job: Job, course: Course, template: Template, apiKey?: string) {
  try {
    job.status = "generating";
    job.progress = 5;

    const topics = await courseTopics.all(course.id);
    if (topics.length === 0) {
      throw new Error("No topics found");
    }

    const renderData = await loadFullCourseInfo(course, topics, (progress) => {
      job.progress = progress;
    }, apiKey);

    job.status = "rendering";
    job.progress = 95;

    // Add authors to render data
    const renderDataWithAuthors = {
      ...renderData,
      authors: [renderData.course.teacher]
    };

    const doc = await renderDoc(template.file, renderDataWithAuthors);
    
    job.result = doc;
    job.filename = `generated_${new Date().toISOString().split('T')[0]}.docx`;
    job.status = "completed";
    job.progress = 100;
  } catch (error) {
    job.status = "error";
    job.error = error instanceof Error ? error.message : "Unknown error";
    console.error("Generation job error:", error);
  }
}

const generationApi = {
  "/api/courses/:courseId/generate/:templateId": {
    async POST(req: BunRequest) {
      const { courseId, templateId } = req.params as { courseId: number; templateId: number };
      const body = await req.json().catch(() => ({})) as { apiKey?: string };
      
      const course = await courses.get(courseId);
      if (!course) {
        return new Response("Course not found", { status: 404 });
      }

      const template = await templates.get(templateId);
      if (!template) {
        return new Response("Template not found", { status: 404 });
      }

      const topics = await courseTopics.all(courseId);
      if (topics.length === 0) {
        return new Response("No topics found", { status: 404 });
      }

      const jobId = generateJobId();
      const job: Job = { id: jobId, status: "pending", progress: 0 };
      jobs.set(jobId, job);

      // Start generation in background
      runGenerationJob(job, course, template, body.apiKey).catch((error) => {
        job.status = "error";
        job.error = error instanceof Error ? error.message : "Unknown error";
      });

      return Response.json({ jobId });
    }
  },
  "/api/jobs/:jobId": {
    async GET(req: BunRequest) {
      const { jobId } = req.params as { jobId: string };
      const job = jobs.get(jobId);
      
      if (!job) {
        return new Response("Job not found", { status: 404 });
      }

      return Response.json({
        id: job.id,
        status: job.status,
        progress: job.progress,
        error: job.error,
        filename: job.filename,
      });
    }
  },
  "/api/jobs/:jobId/download": {
    async GET(req: BunRequest) {
      const { jobId } = req.params as { jobId: string };
      const job = jobs.get(jobId);
      
      if (!job) {
        return new Response("Job not found", { status: 404 });
      }

      if (job.status !== "completed" || !job.result || !job.filename) {
        return new Response("Job not completed", { status: 400 });
      }

      jobs.delete(jobId);

      return wordResp(job.result, job.filename);
    }
  }
};

export default generationApi