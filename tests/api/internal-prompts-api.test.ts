import { describe, expect, it, mock } from "bun:test";

const all = mock(async () => []);
const update = mock(async (key: string, text: string, model: string | null) => ({ key, text, model }));

mock.module("@/stores/db", () => ({ internalPrompts: { all, update } }));

const { default: api } = await import("@/api/internal-prompts-api");

describe("internal prompts API", () => {
  it("returns code defaults when no configuration rows exist", async () => {
    const response = await api["/api/internal-prompts"].GET();
    const prompts = await response.json() as Array<{ key: string; text: string }>;

    expect(response.status).toBe(200);
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts[0]).toMatchObject({ key: expect.any(String), text: expect.any(String) });
  });

  it("persists a prompt configuration and returns the saved row", async () => {
    const request = {
      params: { key: "ai.course_topics" },
      json: async () => ({ text: "Оновлений промпт", model: "gpt-5" }),
    } as any;

    const response = await api["/api/internal-prompts/:key"].PUT(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ key: "ai.course_topics", text: "Оновлений промпт", model: "gpt-5" });
    expect(update).toHaveBeenCalledWith("ai.course_topics", "Оновлений промпт", "gpt-5");
  });
});
