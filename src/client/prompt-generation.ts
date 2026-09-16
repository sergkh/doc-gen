import type { Prompt, PromptResult } from "@/stores/models";

type PromptGenerationJobStatus = "queued" | "generating" | "completed" | "error";
type PendingJob = Pick<PromptResult, "field" | "system_prompt" | "prompt"> & {
  id: string;
  status: PromptGenerationJobStatus;
  responseId: string;
  format: Prompt["format"];
};
type StartedJobResponse = Omit<PendingJob, "id"> & { jobId: string };
type FinishedJob = PendingJob & Pick<PromptResult, "field" | "system_prompt" | "prompt"> & { result?: PromptResult["item"] | null; error?: string | null };

async function responseError(response: Response, fallback: string): Promise<Error> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as { error?: string };
    return new Error(body.error || fallback);
  } catch {
    return new Error(text || fallback);
  }
}

function apiKeyHeaders(apiKey?: string): HeadersInit {
  const key = apiKey?.trim() || localStorage.getItem("openai_api_key")?.trim();
  return key ? { "X-OpenAI-Api-Key": key } : {};
}

function jobRecoveryHeaders(job: PendingJob): HeadersInit {
  return {
    "X-Prompt-Response-Id": job.responseId,
    "X-Prompt-Format": job.format,
    "X-Prompt-Field": job.field,
  };
}

export async function startPromptGeneration(endpoint: string, prompt: Prompt, apiKey?: string): Promise<PendingJob> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, ...(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}) }),
  });
  if (!response.ok) throw await responseError(response, "Не вдалося запустити генерацію");
  const body = await response.json() as StartedJobResponse;
  return { ...body, id: body.jobId };
}

export async function waitForPromptGeneration(
  pendingJob: PendingJob,
  onStatus?: (status: PromptGenerationJobStatus) => void,
  apiKey?: string,
): Promise<PromptResult> {
  while (true) {
    const response = await fetch(`/api/prompt-generation-jobs/${pendingJob.id}`, {
      headers: { ...apiKeyHeaders(apiKey), ...jobRecoveryHeaders(pendingJob) },
    });
    if (!response.ok) throw await responseError(response, "Не вдалося отримати стан генерації");
    const job = await response.json() as FinishedJob;
    onStatus?.(job.status);
    if (job.status === "completed") {
      return {
        field: job.field || pendingJob.field,
        system_prompt: job.system_prompt || pendingJob.system_prompt,
        prompt: job.prompt || pendingJob.prompt,
        item: job.result,
      };
    }
    if (job.status === "error") throw new Error(job.error || "Генерація завершилася з помилкою");
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
}
