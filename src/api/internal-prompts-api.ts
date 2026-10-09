import type { BunRequest } from "bun";
import { internalPrompts } from "@/stores/db";
import { ALL_INTERNAL_PROMPT_DEFAULTS, INTERNAL_PROMPT_DEFAULT_BY_KEY, type InternalPromptKey } from "@/ai/internal-prompts-defaults";

function promptList(stored: Awaited<ReturnType<typeof internalPrompts.all>>) {
  const byKey = new Map(stored.map((prompt) => [prompt.key, prompt]));
  return ALL_INTERNAL_PROMPT_DEFAULTS.map((definition) => {
    const prompt = byKey.get(definition.key);
    return {
      key: definition.key,
      title: definition.title,
      text: prompt?.text ?? definition.text,
      model: prompt?.model ?? definition.model ?? null,
      modelConfigurable: definition.model !== undefined,
    };
  });
}

const internalPromptsApi = {
  "/api/internal-prompts": {
    async GET() {
      return Response.json(promptList(await internalPrompts.all()));
    },
  },
  "/api/internal-prompts/:key": {
    async PUT(req: BunRequest) {
      const { key } = req.params as { key: string };
      const definition = INTERNAL_PROMPT_DEFAULT_BY_KEY.get(key as InternalPromptKey);
      if (!definition) return Response.json({ error: "Промпт не знайдено" }, { status: 404 });

      let body: { text?: unknown; model?: unknown };
      try { body = await req.json(); } catch { return Response.json({ error: "Некоректний JSON" }, { status: 400 }); }
      if (typeof body.text !== "string" || !body.text.trim()) {
        return Response.json({ error: "Текст промпту обов'язковий" }, { status: 400 });
      }
      if (body.model !== undefined && body.model !== null && typeof body.model !== "string") {
        return Response.json({ error: "Модель має бути рядком або null" }, { status: 400 });
      }
      const model = definition.model !== undefined ? (typeof body.model === "string" ? body.model.trim() || null : null) : null;
      const updated = await internalPrompts.update(key, body.text.trim(), model);
      return Response.json(updated);
    },
  },
};

export default internalPromptsApi;
