import { afterEach, describe, expect, it } from "bun:test";
import { startPromptGeneration } from "@/client/prompt-generation";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("startPromptGeneration", () => {
  it("maps the API jobId to the ID used by subsequent polls", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      jobId: "a4c4b97e-a8e0-4276-ae16-f3c7f7077907",
      status: "queued",
      responseId: "resp_123",
      field: "description",
      format: "text",
      system_prompt: "System",
      prompt: "Prompt",
    }), { status: 202 });

    const job = await startPromptGeneration("/api/courses/1/run-prompt", {
      name: "Description",
      type: "topic",
      field: "description",
      model: "gpt-4o",
      system_prompt: "System",
      prompt: "Prompt",
      format: "text",
    });

    expect(job.id).toBe("a4c4b97e-a8e0-4276-ae16-f3c7f7077907");
    expect(job.id).not.toBeUndefined();
  });
});
