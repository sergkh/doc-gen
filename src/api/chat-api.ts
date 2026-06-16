import type { BunRequest, ServerWebSocket } from "bun";
import { runAgentStream } from "@/ai/agent";
import { AVAILABLE_MODELS, type AgentReply } from "@/ai/models";

const DEFAULT_MODEL = "gpt-4o-mini";

type ChatWebSocketData = {
  sessionId?: string;
};

type ChatWsRequest = {
  type: "chat";
  payload: {
    requestId?: string;
    specialtyId?: number;
    message?: string;
    approvalId?: string;
    approvalDecision?: "approve" | "reject";
    apiKey?: string;
    model?: string;
    sessionId?: string;
  };
};

function normalizeWsMessage(message: string | Buffer | ArrayBuffer | Uint8Array): string {
  if (typeof message === "string") return message;
  if (message instanceof ArrayBuffer) return Buffer.from(message).toString("utf-8");
  return Buffer.from(message).toString("utf-8");
}

function tryParseRequest(message: string | Buffer | ArrayBuffer | Uint8Array): ChatWsRequest | null {
  const raw = normalizeWsMessage(message);

  try {
    const parsed = JSON.parse(raw) as ChatWsRequest;
    if (parsed?.type === "chat" && parsed?.payload) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function sendWs(ws: ServerWebSocket<ChatWebSocketData>, payload: unknown): void {
  ws.send(JSON.stringify(payload));
}

function toWsStreamStart(requestId?: string) {
  return {
    type: "chat_stream_start",
    requestId,
  };
}

function toWsStreamChunk(delta: string, requestId?: string) {
  return {
    type: "chat_stream_chunk",
    requestId,
    payload: {
      delta,
    },
  };
}

function toWsStreamEnd(result: AgentReply, sessionId: string, requestId?: string) {
  return {
    type: "chat_stream_end",
    requestId,
    payload: {
      context: {
        ...result.context,
        sessionId,
      },
      tools: result.tools,
      reply: result.reply,
      requiresUserInput: result.requiresUserInput ?? null,
    },
  };
}

const chatApi = {
  "/api/chat": {
    GET(req: BunRequest, server: Bun.Server<ChatWebSocketData>) {
      const sessionId = req.headers.get("x-session-id") ?? undefined;
      const upgraded = server.upgrade(req, {
        data: { sessionId },
      });

      if (upgraded) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    },
  },
};

export const chatWebsocket = {
  async message(ws: ServerWebSocket<ChatWebSocketData>, message: string | Buffer | ArrayBuffer | Uint8Array) {
    const request = tryParseRequest(message);

    if (!request) {
      sendWs(ws, { type: "error", error: "Invalid WebSocket payload" });
      return;
    }

    try {
      const specialtyId = Number(request.payload.specialtyId);
      const userMessage = request.payload.message?.toString() ?? "";
      const approvalId = request.payload.approvalId?.toString();
      const approvalDecision = request.payload.approvalDecision;
      const apiKey = request.payload.apiKey?.toString() || null;
      const model =
        request.payload.model && AVAILABLE_MODELS.some((m) => m.id === request.payload.model)
          ? request.payload.model
          : DEFAULT_MODEL;

      const incomingSessionId = request.payload.sessionId?.toString().trim();
      const sessionId = incomingSessionId || ws.data.sessionId || crypto.randomUUID();
      ws.data.sessionId = sessionId;

      if (!Number.isFinite(specialtyId) || specialtyId <= 0) {
        sendWs(ws, { type: "error", error: "Missing or invalid specialtyId" });
        return;
      }

      if (!approvalId && !userMessage.trim()) {
        sendWs(ws, { type: "error", error: "Missing message" });
        return;
      }

      const requestId = request.payload.requestId;

      sendWs(ws, toWsStreamStart(requestId));

      const result = await runAgentStream({
        specialtyId,
        sessionId,
        message: userMessage,
        approvalId,
        approvalDecision,
        apiKey,
        model,
        onTextDelta: (delta) => {
          sendWs(ws, toWsStreamChunk(delta, requestId));
        },
      });

      sendWs(ws, toWsStreamEnd(result, sessionId, requestId));
    } catch (error) {
      console.error("Chat WebSocket error:", error);
      sendWs(ws, {
        type: "error",
        requestId: request.payload.requestId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
} as const;

export default chatApi;
