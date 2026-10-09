import { INTERNAL_PROMPT_DEFAULT_BY_KEY, type InternalPromptKey } from "./internal-prompts-defaults";

export type ResolvedInternalPrompt = {
  key: InternalPromptKey;
  text: string;
  model: string | null;
};

/**
 * Prompt text and optional model are editable data. Output schemas, call flow,
 * and MCP tool contracts deliberately remain code-owned.
 */
export async function getInternalPrompt(key: InternalPromptKey): Promise<ResolvedInternalPrompt> {
  const fallback = INTERNAL_PROMPT_DEFAULT_BY_KEY.get(key);
  if (!fallback) throw new Error(`Unknown internal prompt: ${key}`);

  if (process.env.NODE_ENV === "test") {
    return { key, text: fallback.text, model: fallback.model ?? null };
  }

  // Load lazily so code paths that do not use an internal prompt do not need a database.
  const { internalPrompts } = await import("@/stores/db");
  // Unit-test and maintenance callers may provide a reduced store mock.
  const stored = internalPrompts ? await internalPrompts.get(key) : null;
  return {
    key,
    text: stored?.text ?? fallback.text,
    model: stored?.model ?? fallback.model ?? null,
  };
}

export async function getInternalPrompts(keys: InternalPromptKey[]): Promise<Map<string, ResolvedInternalPrompt>> {
  const values = await Promise.all(keys.map((key) => getInternalPrompt(key)));
  return new Map(values.map((prompt) => [prompt.key, prompt]));
}
