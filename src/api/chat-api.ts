import type { BunRequest } from "bun";
import { runAgent } from "@/ai/agent";
import { AVAILABLE_MODELS } from "@/ai/models";

const DEFAULT_MODEL = "gpt-4o-mini";

const CLARIFICATION_MESSAGE =
  "Я можу: (1) знайти дисципліни за СК (наприклад: СК-5), " +
  "(2) знайти дисципліни за ЗК (наприклад: ЗК-3), " +
  "(3) знайти дисципліни за ПР (наприклад: ПР-7), " +
  "(4) знайти дисципліни за темою, (5) підсумувати практичні години, " +
  "(6) встановити контекст дисципліни та додавати теми. Сформулюйте запит трохи точніше.";

function getOrCreateSessionId(req: BunRequest): string {
  const existing = req.headers.get("x-session-id");
  if (existing) return existing;
  
  return crypto.randomUUID();
}

const chatApi = {
  "/api/chat": {
    async POST(req: BunRequest) {
      try {
        const body = (await req.json().catch(() => null)) as null | {
          specialtyId?: number;
          message?: string;
          apiKey?: string;
          model?: string;
        };

        const specialtyId = Number(body?.specialtyId);
        const message = body?.message?.toString() ?? "";
        const apiKey = body?.apiKey?.toString() || null;
        const model = body?.model && AVAILABLE_MODELS.some(m => m.id === body.model) ? body.model : DEFAULT_MODEL;
        const sessionId = getOrCreateSessionId(req);

        if (!Number.isFinite(specialtyId) || specialtyId <= 0) {
          return new Response("Missing or invalid specialtyId", { status: 400 });
        }

        if (!message.trim()) {
          return new Response("Missing message", { status: 400 });
        }

        const result = await runAgent({ specialtyId, sessionId, message, apiKey, model });        

        const headers = new Headers();
        headers.set("Content-Type", "application/json");

        if (!req.headers.has("x-session-id")) {
          headers.set("x-session-id", sessionId);
        }

        return new Response(JSON.stringify(result), { headers });
      } catch (error) {
        console.error("Chat API error:", error);
        return new Response(`Chat error: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
      }
    },
  },
};

export default chatApi;
