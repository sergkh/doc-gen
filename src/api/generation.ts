import { renderDoc } from "@/docx/render";
import { courses, courseTopics, templates } from "@/stores/db";
import type { Course, Template } from "@/stores/models";
import type { BunRequest } from "bun";
import { loadFullCourseInfo } from "@/docx/transformations";

type JobStatus = "pending" | "generating" | "rendering" | "completed" | "error";

interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  error?: string;
  result?: ArrayBuffer;
  filename: string;
}

const jobs = new Map<string, Job>();

function generateJobId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function wordResp(file: ArrayBuffer, name: string = "result.docx"): Response {
  return new Response(file, { 
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `inline; filename=\"${name}\"`,
    }
  });
}

async function runGenerationJob(job: Job, course: Course, template: Template, apiKey?: string, parameters?: Record<string, any>) {
  try {
    job.status = "generating";
    job.progress = 5;

    const topics = await courseTopics.all(course.id);
    if (topics.length === 0) {
      throw new Error("No topics found");
    }

    const renderData = await loadFullCourseInfo(course, topics, parameters ?? {}, (progress) => {
      job.progress = progress;
    }, apiKey);

    job.status = "rendering";
    job.progress = 95;

    const doc = await renderDoc(template.file, renderData);
    
    job.result = doc;
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
      const body = await req.json().catch(() => ({})) as { apiKey?: string; parameters?: Record<string, any> };
      
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
      const job: Job = { 
        id: jobId, 
        status: "pending", 
        progress: 0,
        filename: `${template.name}.docx`,
      };
      jobs.set(jobId, job);

      // Start generation in background
      runGenerationJob(job, course, template, body.apiKey, body.parameters).catch((error) => {
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
        progress: Math.round(job.progress),
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

      return wordResp(job.result);
    }
  }
};

export default generationApi