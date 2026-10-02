import type { Prompt, PromptResult } from "@/stores/models";

type PromptGenerationJobStatus = "queued" | "generating" | "completed" | "error";
type PendingJob = Pick<PromptResult, "field" | "system_prompt" | "prompt"> & {
  id: string;
  status: PromptGenerationJobStatus;
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

export async function startPromptGeneration(endpoint: string, prompt: Prompt, apiKey?: string): Promise<PendingJob> {
  console.info("[prompt-client] starting prompt job", { endpoint, field: prompt.field, type: prompt.type, format: prompt.format, model: prompt.model });
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ...(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}) }),
    });
    if (!response.ok) {
      const error = await responseError(response, "Не вдалося запустити генерацію");
      console.error("[prompt-client] prompt job start failed", { endpoint, field: prompt.field, status: response.status, error: error.message });
      throw error;
    }
    const body = await response.json() as StartedJobResponse;
    if (!body.jobId) throw new Error("Сервер не повернув ідентифікатор завдання генерації");
    console.info("[prompt-client] prompt job accepted", { jobId: body.jobId, status: body.status, field: body.field });
    return { ...body, id: body.jobId };
  } catch (error) {
    console.error("[prompt-client] prompt job start exception", { endpoint, field: prompt.field, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function waitForPromptGeneration(
  pendingJob: PendingJob,
  onStatus?: (status: PromptGenerationJobStatus) => void,
): Promise<PromptResult> {
  let pollCount = 0;
  while (true) {
    pollCount += 1;

    try {
      const response = await fetch(`/api/prompt-generation-jobs/${pendingJob.id}`);
      if (!response.ok) {
        const error = await responseError(response, "Не вдалося отримати стан генерації");
        console.error("[prompt-client] prompt job poll failed", { jobId: pendingJob.id, pollCount, status: response.status, error: error.message });
        throw error;
      }
      const job = await response.json() as FinishedJob;
      onStatus?.(job.status);
      if (job.status === "completed") {
        console.info("Prompt job completed", { jobId: pendingJob.id, pollCount, field: job.field || pendingJob.field });
        return {
          field: job.field || pendingJob.field,
          system_prompt: job.system_prompt || pendingJob.system_prompt,
          prompt: job.prompt || pendingJob.prompt,
          item: job.result,
        };
      }
      if (job.status === "error") {
        const error = new Error(job.error || "Генерація завершилася з помилкою");
        console.error("Prompt job completed with error", { jobId: pendingJob.id, pollCount, error: error.message });
        throw error;
      }
    } catch (error) {
      console.error("Prompt job poll exception", { jobId: pendingJob.id, pollCount, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
}
