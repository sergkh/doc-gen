import { renderDoc, renderHandlebarsText } from "@/docx/render";
import { courses, specialties, templates } from "@/stores/db";
import type { Course, GeneratedTopicData, Prompt, Template } from "@/stores/models";
import type { BunRequest } from "bun";
import { loadFullCourseInfo } from "@/docx/transformations";
import { runCoursePrompts, runTopicPrompts } from "@/ai/generator";
import { coursesService } from "@/services/courses-service";

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

function jsonError(message: string, status: number = 400): Response {
  return Response.json({ error: message }, { status });
}

async function runGenerationJob(job: Job, course: Course, template: Template, apiKey?: string, parameters?: Record<string, any>) {
  try {
    job.status = "generating";
    job.progress = 1;

    const topics = course.topics ?? [];
    if (topics.length === 0) {
      throw new Error("No topics found");
    }

    const specialty =  await specialties.get(course.specialty_id);
    if (!specialty) {
      throw new Error("Specialty not found");
    }

    const renderData = await loadFullCourseInfo(template, course, specialty, topics, parameters ?? {}, (progress) => {
      job.progress = progress;
    }, apiKey);

    job.status = "rendering";
    job.progress = 95;

    if (template.file.endsWith(".docx")) {
      job.result = await renderDoc(template.file, renderData);
    } else {
      job.result = await renderHandlebarsText(template.file, renderData);
    }

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
      const { courseId, templateId } = req.params as unknown as { courseId: number; templateId: number };
      let body;
      try {
        body = await req.json() as { apiKey?: string; parameters?: Record<string, any> };
      } catch {
        return jsonError("Невалідний JSON у запиті", 400);
      }
      
      const course = await courses.get(courseId);
      if (!course) {
        return jsonError("Дисципліну не знайдено", 404);
      }

      const template = await templates.get(templateId);
      if (!template) {
        return jsonError("Шаблон не знайдено", 404);
      }

      const topics = course?.topics ?? [];
      if (topics.length === 0) {
        return jsonError("У дисципліни немає тем", 404);
      }

      const jobId = generateJobId();

      const ext = template.file.split(".").pop();
      
      const job: Job = { 
        id: jobId, 
        status: "pending", 
        progress: 0,
        filename: `${template.name}.${ext}`,
      };
      jobs.set(jobId, job);

      runGenerationJob(job, course, template, body?.apiKey, body?.parameters).catch((error) => {
        job.status = "error";
        job.error = error instanceof Error ? error.message : "Unknown error";
      });

      return Response.json({ jobId });
    }
  },
  "/api/courses/:courseId/run-prompt": {
    async POST(req: BunRequest) {
      const { courseId } = req.params as { courseId: string };
      let rawBody;
      try {
        rawBody = await req.json() as { prompt: Prompt; apiKey?: string };
      } catch {
        return jsonError("Невалідний JSON у запиті", 400);
      }

      const { prompt, apiKey } = rawBody || {};

      if (!prompt?.field?.trim() || !prompt?.system_prompt?.trim() || !prompt?.prompt?.trim()) {
        return jsonError("Промпт не містить обов'язкових полів (field, system_prompt, prompt)", 400);
      }

      const results = await coursesService.runPrompt(Number(courseId), prompt, apiKey);
      return Response.json(results[0] ?? { error: "Не вдалося згенерувати результат" });
    }
  },
  "/api/courses/:courseId/topics/:topicId/run-prompt": {
    async POST(req: BunRequest) {
      const { courseId, topicId } = req.params as { courseId: string, topicId: string };
      let rawBody;
      try {
        rawBody = await req.json() as { prompt: Prompt; apiKey?: string };
      } catch {
        return jsonError("Невалідний JSON у запиті", 400);
      }

      const { prompt, apiKey } = rawBody || {};

      if (!prompt?.field?.trim() || !prompt?.system_prompt?.trim() || !prompt?.prompt?.trim()) {
        return jsonError("Промпт не містить обов'язкових полів (field, system_prompt, prompt)", 400);
      }

      const course = await coursesService.getCourseById(Number(courseId));
      if (!course) {
        return jsonError("Дисципліну не знайдено", 404);
      }

      const allTopics = course.topics ?? [];
      const topic = allTopics.find(t => t.id === Number(topicId));
      if (!topic) {
        return jsonError("Тему не знайдено", 404);
      }

      console.log(`Running prompt for topic: ${topic.name}, with prompt:`, prompt);

      try {
        const results = await runTopicPrompts([prompt], course, topic, allTopics, apiKey ?? null, true);
        console.log(`Prompt results for topic ${topic.name}:`, results);
        return Response.json(results[0] ?? { error: "Не вдалося згенерувати результат" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Невідома помилка при виконанні промпту";
        console.error("Run topic prompt error:", error);
        return jsonError(message, 500);
      }
    }
  },
  "/api/courses/:courseId/save-prompt-result": {
    async POST(req: BunRequest) {
      const { courseId } = req.params as { courseId: string };
      let body;
      try {
        body = await req.json() as { field: string; item: any };
      } catch {
        return jsonError("Невалідний JSON у запиті", 400);
      }

      if (!body?.field?.trim()) {
        return jsonError("Поле field є обов'язковим", 400);
      }

      await coursesService.savePromptResult(Number(courseId), body.field, body.item);

      return Response.json({ success: true, field: body.field });
    }
  },
  "/api/courses/:courseId/topics/:topicId/save-prompt-result": {
    async POST(req: BunRequest) {
      const { courseId, topicId } = req.params as { courseId: string, topicId: string };
      let body;
      try {
        body = await req.json() as { field: string; item: any };
      } catch {
        return jsonError("Невалідний JSON у запиті", 400);
      }

      if (!body?.field?.trim()) {
        return jsonError("Поле field є обов'язковим", 400);
      }

      const course = await coursesService.getCourseById(Number(courseId));
      if (!course) {
        return jsonError("Дисципліну не знайдено", 404);
      }

      const allTopics = course.topics ?? [];
      const topic = allTopics.find(t => t.id === Number(topicId));
      if (!topic) {
        return jsonError("Тему не знайдено", 404);
      }

      const generated: GeneratedTopicData = {
        ...(topic.generated || {}),
        [body.field]: body.item
      };

      course.topics = allTopics.map(t => t.id === topic.id ? { ...t, generated } : t);
      await courses.update(course);

      return Response.json({ success: true, field: body.field });
    }
  },
  "/api/jobs/:jobId": {
    async GET(req: BunRequest) {
      const { jobId } = req.params as { jobId: string };
      const job = jobs.get(jobId);
      
      if (!job) {
        return jsonError("Завдання не знайдено", 404);
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
        return jsonError("Завдання не знайдено", 404);
      }

      if (job.status !== "completed" || !job.result || !job.filename) {
        return jsonError("Завдання ще не завершено", 400);
      }

      jobs.delete(jobId);

      return wordResp(job.result);
    }
  }
};

export default generationApi