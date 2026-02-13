import type { BunRequest } from "bun";
import type { ChatToolData } from "@/ai/chat";
import { runChatToolsConversation } from "@/ai/chat";

const CLARIFICATION_MESSAGE =
  "Я можу: (1) знайти дисципліни за СК (наприклад: СК-5), " +
  "(2) знайти дисципліни за ЗК (наприклад: ЗК-3), " +
  "(3) знайти дисципліни за ПР (наприклад: ПР-7), " +
  "(4) знайти дисципліни за темою, (5) підсумувати практичні години. Сформулюйте запит трохи точніше.";

const DEFAULT_DATA: ChatToolData = { action: "clarify" };

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

        if (!Number.isFinite(specialtyId) || specialtyId <= 0) {
          return new Response("Missing or invalid specialtyId", { status: 400 });
        }

        if (!message.trim()) {
          return new Response("Missing message", { status: 400 });
        }

        let conversation;
        try {
          conversation = await runChatToolsConversation({ specialtyId, message, apiKey });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.toLowerCase().includes("api key")) {
            return new Response("OpenAI API key is required", { status: 400 });
          }
          throw error;
        }

        const reply = conversation.reply?.trim() || CLARIFICATION_MESSAGE;
        const data = conversation.data ?? DEFAULT_DATA;

        return Response.json({ reply, data });
      } catch (error) {
        console.error("Chat API error:", error);
        return new Response(`Chat error: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
      }
    },
  },
};

export default chatApi;
