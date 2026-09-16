import { renderDoc, renderHandlebarsText } from "@/docx/render";
import { courses, specialties, templates } from "@/stores/db";
import type { Course, GeneratedTopicData, Prompt, PromptResult, Template, CourseTopic } from "@/stores/models";
import type { BunRequest } from "bun";
import { loadFullCourseInfo } from "@/docx/transformations";
import { coursesService } from "@/services/courses-service";
import { pollPromptResponse, startCoursePrompt, startTopicPrompt } from "@/ai/background-prompt";

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

type PromptGenerationJobStatus = "queued" | "generating" | "completed" | "error";

interface PromptGenerationJob {
  id: string;
  courseId: number;
  topicIndex: number | null;
  field: string;
  format: Prompt["format"];
  model: string;
  openaiResponseId: string;
  systemPrompt: string;
  userPrompt: string;
  status: PromptGenerationJobStatus;
  result?: PromptResult["item"];
  error?: string;
  finishedAt?: number;
}

const promptGenerationJobs = new Map<string, PromptGenerationJob>();
const PROMPT_JOB_TTL_MS = 5 * 60 * 1000;

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

function requestApiKey(req: Request): string | undefined {
  return req.headers?.get("X-OpenAI-Api-Key")?.trim() || undefined;
}

function recoverPromptJob(req: Request, jobId: string): PromptGenerationJob | null {
  const responseId = req.headers.get("X-Prompt-Response-Id")?.trim();
  const format = req.headers.get("X-Prompt-Format");
  const field = req.headers.get("X-Prompt-Field")?.trim();
  if (!responseId || !field || (format !== "text" && format !== "list" && format !== "quiz")) return null;

  return {
    id: jobId,
    courseId: 0,
    topicIndex: null,
    field,
    format,
    model: "",
    openaiResponseId: responseId,
    systemPrompt: "",
    userPrompt: "",
    status: "generating",
  };
}

function isCompletePromptJob(job: PromptGenerationJob): boolean {
  return job.status === "completed" || job.status === "error";
}

function pruneExpiredPromptJobs(): void {
  const oldestAllowed = Date.now() - PROMPT_JOB_TTL_MS;
  for (const [id, job] of promptGenerationJobs) {
    if (job.finishedAt !== undefined && job.finishedAt < oldestAllowed) promptGenerationJobs.delete(id);
  }
}

function rememberPromptJob(job: PromptGenerationJob): void {
  pruneExpiredPromptJobs();
  promptGenerationJobs.set(job.id, job);
}

function promptJobResponse(job: PromptGenerationJob): Response {
  return Response.json({
    id: job.id,
    status: job.status,
    field: job.field,
    system_prompt: job.systemPrompt,
    prompt: job.userPrompt,
    result: job.result ?? null,
    error: job.error ?? null,
  });
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

      const course = await coursesService.getCourseById(Number(courseId));
      if (!course) return jsonError("Дисципліну не знайдено", 404);
      const topics = course.topics ?? [];
      if (topics.length === 0) return jsonError("У дисципліни немає тем", 404);

      try {
        const started = await startCoursePrompt(prompt, course, topics, apiKey ?? requestApiKey(req));
        const job: PromptGenerationJob = {
          id: crypto.randomUUID(),
          courseId: course.id,
          topicIndex: null,
          field: prompt.field,
          format: prompt.format,
          model: prompt.model,
          openaiResponseId: started.responseId,
          systemPrompt: started.systemPrompt,
          userPrompt: started.userPrompt,
          status: started.status,
        };
        rememberPromptJob(job);
        return Response.json({
          jobId: job.id,
          status: job.status,
          responseId: job.openaiResponseId,
          field: job.field,
          format: job.format,
          system_prompt: job.systemPrompt,
          prompt: job.userPrompt,
        }, { status: 202 });
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Не вдалося запустити генерацію", 500);
      }
    }
  },
  "/api/courses/:courseId/topics/:topicId/run-prompt": {
    async POST(req: BunRequest) {
      const { courseId, topicId, topicIndex } = req.params as { courseId: string, topicId?: string, topicIndex?: string };
      const resolvedTopicIndex = topicIndex ?? topicId;
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
      const topic = allTopics.find((t) => {
        const numericIdentifier = Number(resolvedTopicIndex);
        if (!Number.isNaN(numericIdentifier)) {
          return t.index === numericIdentifier || ((t as CourseTopic & { id?: number }).id === numericIdentifier);
        }
        return false;
      });
      if (!topic) {
        return jsonError("Тему не знайдено", 404);
      }

      try {
        const started = await startTopicPrompt(prompt, course, topic, allTopics, apiKey ?? requestApiKey(req));
        const job: PromptGenerationJob = {
          id: crypto.randomUUID(),
          courseId: course.id,
          topicIndex: topic.index,
          field: prompt.field,
          format: prompt.format,
          model: prompt.model,
          openaiResponseId: started.responseId,
          systemPrompt: started.systemPrompt,
          userPrompt: started.userPrompt,
          status: started.status,
        };
        rememberPromptJob(job);
        return Response.json({
          jobId: job.id,
          status: job.status,
          responseId: job.openaiResponseId,
          field: job.field,
          format: job.format,
          system_prompt: job.systemPrompt,
          prompt: job.userPrompt,
        }, { status: 202 });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Не вдалося запустити генерацію";
        console.error("Start topic prompt error:", error);
        return jsonError(message, 500);
      }
    }
  },
  "/api/prompt-generation-jobs/:jobId": {
    async GET(req: BunRequest) {
      const { jobId } = req.params as { jobId: string };
      pruneExpiredPromptJobs();
      const job = promptGenerationJobs.get(jobId) ?? recoverPromptJob(req, jobId);
      if (!job) return jsonError("Завдання генерації не знайдено", 404);
      rememberPromptJob(job);
      if (isCompletePromptJob(job)) return promptJobResponse(job);

      try {
        const result = await pollPromptResponse(job.openaiResponseId, job.format, requestApiKey(req));
        if (result.status === "completed") {
          job.status = "completed";
          job.result = result.item;
          job.finishedAt = Date.now();
          return promptJobResponse(job);
        }
        if (result.status === "error") {
          job.status = "error";
          job.error = result.error;
          job.finishedAt = Date.now();
          return promptJobResponse(job);
        }
        if (result.status === "generating") job.status = "generating";
        return Response.json({
          id: job.id,
          status: result.status,
          field: job.field,
          system_prompt: job.systemPrompt,
          prompt: job.userPrompt,
          result: null,
          error: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Не вдалося перевірити стан генерації";
        job.status = "error";
        job.error = message;
        job.finishedAt = Date.now();
        return promptJobResponse(job);
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
      const { courseId, topicIndex, topicId } = req.params as { courseId: string, topicIndex?: string, topicId?: string };
      const resolvedTopicIndex = topicIndex ?? topicId;
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
      const topic = allTopics.find((t) => {
        const numericIdentifier = Number(resolvedTopicIndex);
        
        if (!Number.isNaN(numericIdentifier)) {
          return t.index === numericIdentifier || ((t as CourseTopic & { id?: number }).id === numericIdentifier);
        }
        return false;
      });
      if (!topic) {
        return jsonError("Тему не знайдено", 404);
      }

      const generated: GeneratedTopicData = {
        ...(topic.generated || {}),
        [body.field]: body.item
      };

      course.topics = allTopics.map((t) => (t.index === topic.index ? { ...t, generated } : t));
      await courses.update(course);

      return Response.json({ success: true, field: body.field });
    }
  },
  "/api/courses/:courseId/generate/:templateId/data": {
    async GET(req: BunRequest) {
      const { courseId, templateId } = req.params as unknown as { courseId: number; templateId: number };

      const course = await courses.get(courseId);
      if (!course) {
        return jsonError("Дисципліну не знайдено", 404);
      }

      const template = await templates.get(templateId);
      if (!template) {
        return jsonError("Шаблон не знайдено", 404);
      }

      const topics = course.topics ?? [];
      if (topics.length === 0) {
        return jsonError("У дисципліни немає тем", 404);
      }

      const specialty = await specialties.get(course.specialty_id);
      if (!specialty) {
        return jsonError("Спеціальність не знайдено", 404);
      }

      try {
        const queryParameters = Object.fromEntries(new URL(req.url).searchParams.entries());
        const renderData = await loadFullCourseInfo(template, course, specialty, topics, queryParameters);
        return Response.json(renderData);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Невідома помилка";
        return jsonError(message, 500);
      }
    }
  },
  "/api/courses/:courseId/generate/:templateId/download": {
    async GET(req: BunRequest) {
      const { courseId, templateId } = req.params as unknown as { courseId: number; templateId: number };

      const course = await courses.get(courseId);
      if (!course) {
        return jsonError("Дисципліну не знайдено", 404);
      }

      const template = await templates.get(templateId);
      if (!template) {
        return jsonError("Шаблон не знайдено", 404);
      }

      const topics = course.topics ?? [];
      if (topics.length === 0) {
        return jsonError("У дисципліни немає тем", 404);
      }

      const specialty = await specialties.get(course.specialty_id);
      if (!specialty) {
        return jsonError("Спеціальність не знайдено", 404);
      }

      try {
        console.log(`Synchronously generating template ${template.name} for ${course.name}`);
        const queryParameters = Object.fromEntries(new URL(req.url).searchParams.entries());
        const renderData = await loadFullCourseInfo(template, course, specialty, topics, queryParameters);
        const ext = template.file.split(".").pop() ?? "docx";
        const filename = `${template.name}.${ext}`;

        if (template.file.endsWith(".docx")) {
          const result = await renderDoc(template.file, renderData);
          return wordResp(result);
        } else {
          const result = await renderHandlebarsText(template.file, renderData);
          return wordResp(result);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Невідома помилка";
        return jsonError(message, 500);
      }
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
