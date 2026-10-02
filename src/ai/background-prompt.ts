import type { Course, CoursePractice, CourseTopic, Prompt, PromptResult } from "@/stores/models";
import { runCoursePrompts, runPracticePrompts, runTopicPrompts } from "./generator";

export type PromptJobStatus = "queued" | "generating" | "completed" | "error";

export type StartedPrompt = {
  jobId: string;
  status: "queued";
  systemPrompt: string;
  userPrompt: string;
};

export type PolledPrompt = {
  jobId: string;
  status: PromptJobStatus;
  field: string;
  system_prompt: string;
  prompt: string;
  item?: PromptResult["item"];
  error?: string;
};

type PromptJob = PolledPrompt & {
  format: Prompt["format"];
  createdAt: number;
  finishedAt?: number;
};

const promptJobs = new Map<string, PromptJob>();
const PROMPT_JOB_TTL_MS = 5 * 60 * 1000;

function prunePromptJobs(): void {
  const oldestAllowed = Date.now() - PROMPT_JOB_TTL_MS;
  for (const [jobId, job] of promptJobs) {
    const timestamp = job.finishedAt ?? job.createdAt;
    if (timestamp < oldestAllowed) promptJobs.delete(jobId);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function enqueuePrompt(prompt: Prompt, run: () => Promise<PromptResult[]>, scope: string): StartedPrompt {
  prunePromptJobs();
  const jobId = crypto.randomUUID();
  const job: PromptJob = {
    jobId,
    status: "queued",
    field: prompt.field,
    format: prompt.format,
    system_prompt: "",
    prompt: "",
    createdAt: Date.now(),
  };
  promptJobs.set(jobId, job);

  void (async () => {
    job.status = "generating";

    try {
      const results = await run();
      const result = results.find((item) => item.field === prompt.field) ?? results.at(-1);
      if (!result) throw new Error(`Промпт ${prompt.field} не повернув результат`);
      job.status = "completed";
      job.system_prompt = result.system_prompt;
      job.prompt = result.prompt;
      job.item = result.item;
      job.finishedAt = Date.now();
      console.info(`[prompt-job ${jobId}] completed`, { scope, field: prompt.field, durationMs: job.finishedAt - job.createdAt });
    } catch (error) {
      job.status = "error";
      job.error = errorMessage(error);
      job.finishedAt = Date.now();
      console.error(`[prompt-job ${jobId}] failed`, { scope, field: prompt.field, durationMs: job.finishedAt - job.createdAt, error: job.error });
    }
  })();

  return { jobId, status: "queued", systemPrompt: job.system_prompt, userPrompt: job.prompt };
}

export function startCoursePrompt(prompt: Prompt, course: Course, topics: CourseTopic[], apiKey?: string | null): StartedPrompt {
  return enqueuePrompt(prompt, () => runCoursePrompts([prompt], course, topics, apiKey ?? null, true), "course");
}

export function startTopicPrompt(prompt: Prompt, course: Course, topic: CourseTopic, allTopics: CourseTopic[], apiKey?: string | null): StartedPrompt {
  return enqueuePrompt(prompt, () => runTopicPrompts([prompt], course, topic, allTopics, apiKey ?? null, true), `topic:${topic.index}`);
}

export function startPracticePrompt(prompt: Prompt, course: Course, topic: CourseTopic, practice: CoursePractice, allTopics: CourseTopic[], apiKey?: string | null): StartedPrompt {
  return enqueuePrompt(prompt, () => runPracticePrompts([prompt], course, topic, practice, allTopics, apiKey ?? null, true), `practice:${topic.index}:${practice.index}`);
}

export function pollPromptResponse(jobId: string): PolledPrompt | null {
  prunePromptJobs();
  const job = promptJobs.get(jobId);
  if (!job) {
    console.warn(`[prompt-job ${jobId}] poll missed`, { knownJobs: promptJobs.size });
    return null;
  }  
  return {
    jobId: job.jobId,
    status: job.status,
    field: job.field,
    system_prompt: job.system_prompt,
    prompt: job.prompt,
    ...(job.item !== undefined ? { item: job.item } : {}),
    ...(job.error ? { error: job.error } : {}),
  };
}
