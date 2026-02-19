import type { BunRequest } from "bun";
import type { ChatToolData, DisciplineContext } from "@/ai/chat";
import { runChatToolsConversation } from "@/ai/chat";

const CLARIFICATION_MESSAGE =
  "Я можу: (1) знайти дисципліни за СК (наприклад: СК-5), " +
  "(2) знайти дисципліни за ЗК (наприклад: ЗК-3), " +
  "(3) знайти дисципліни за ПР (наприклад: ПР-7), " +
  "(4) знайти дисципліни за темою, (5) підсумувати практичні години, " +
  "(6) встановити контекст дисципліни та додавати теми. Сформулюйте запит трохи точніше.";

const DEFAULT_DATA: ChatToolData = { action: "clarify" };

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
        };

        const specialtyId = Number(body?.specialtyId);
        const message = body?.message?.toString() ?? "";
        const apiKey = body?.apiKey?.toString() || null;
        const sessionId = getOrCreateSessionId(req);

        if (!Number.isFinite(specialtyId) || specialtyId <= 0) {
          return new Response("Missing or invalid specialtyId", { status: 400 });
        }

        if (!message.trim()) {
          return new Response("Missing message", { status: 400 });
        }

        let conversation;
        try {
          conversation = await runChatToolsConversation({ specialtyId, sessionId, message, apiKey });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.toLowerCase().includes("api key")) {
            return new Response("OpenAI API key is required", { status: 400 });
          }
          throw error;
        }

        const reply = conversation.reply?.trim() || CLARIFICATION_MESSAGE;
        const data = conversation.data ?? DEFAULT_DATA;
        const toolHistory = conversation.toolHistory ?? [];
        const context: DisciplineContext = conversation.context;

        const headers = new Headers();
        headers.set("Content-Type", "application/json");
        if (!req.headers.has("x-session-id")) {
          headers.set("x-session-id", sessionId);
        }

        return new Response(JSON.stringify({ reply, data, toolHistory, context }), { headers });
      } catch (error) {
        console.error("Chat API error:", error);
        return new Response(`Chat error: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
      }
    },
  },
};

export default chatApi;
