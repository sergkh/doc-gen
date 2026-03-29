import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { Specialty } from "@/stores/models";
import { loadAllSpecialties } from "../specialties";
import Markdown from 'react-markdown';
import { AVAILABLE_MODELS, DEFAULT_AGENT_MODEL, type ChatMessage, type DisciplineContext, type UserInputRequest } from "../../ai/models";

const API_KEY_STORAGE_KEY = "openai_api_key";

type ChatWsStreamStart = {
  type: "chat_stream_start";
  requestId?: string;
};

type ChatWsStreamChunk = {
  type: "chat_stream_chunk";
  requestId?: string;
  payload: {
    delta: string;
  };
};

type ChatWsStreamEnd = {
  type: "chat_stream_end";
  requestId?: string;
  payload: {
    reply: string;
    tools: unknown[];
    requiresUserInput?: UserInputRequest | null;
    context: {
      sessionId: string;
      discipline: DisciplineContext | null;
    };
  };
};

type ChatWsError = {
  type: "error";
  requestId?: string;
  error: string;
};

type PendingRequest = {
  id: string;
  resolve: (value: ChatWsStreamEnd) => void;
  reject: (reason?: unknown) => void;
  onChunk: (delta: string) => void;
};

type PendingApprovalAction = {
  approvalId: string;
  decision: "approve" | "reject";
};

function buildChatWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/api/chat`;
}

function parseWsMessage(
  data: unknown
): ChatWsStreamStart | ChatWsStreamChunk | ChatWsStreamEnd | ChatWsError | null {
  if (typeof data !== "string") return null;

  try {
    const parsed = JSON.parse(data) as
      | ChatWsStreamStart
      | ChatWsStreamChunk
      | ChatWsStreamEnd
      | ChatWsError;
    if (
      parsed?.type === "chat_stream_start" ||
      parsed?.type === "chat_stream_chunk" ||
      parsed?.type === "chat_stream_end" ||
      parsed?.type === "error"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}


export default function ChatPage() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [specialtyId, setSpecialtyId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [disciplineContext, setDisciplineContext] = useState<DisciplineContext | null >(null);
  const [pendingInputRequest, setPendingInputRequest] = useState<UserInputRequest | null>(null);
  const [model, setModel] = useState<string>(DEFAULT_AGENT_MODEL);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [message]);

  useEffect(() => {
    const savedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedApiKey) setApiKey(savedApiKey);

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const allSpecialties = await loadAllSpecialties();
        setSpecialties(allSpecialties);
        if (allSpecialties.length > 0) setSpecialtyId(String(allSpecialties[0]!.id));
      } catch (error) {
        console.error("Failed to load specialties:", error);
        toast.error("Помилка завантаження спеціальностей");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const socket = new WebSocket(buildChatWsUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      setIsSocketConnected(true);
    };

    socket.onclose = () => {
      setIsSocketConnected(false);
      for (const pending of pendingRef.current.values()) {
        pending.reject(new Error("WebSocket disconnected"));
      }
      pendingRef.current.clear();
    };

    socket.onerror = () => {
      setIsSocketConnected(false);
    };

    socket.onmessage = (event) => {
      const parsed = parseWsMessage(event.data);
      if (!parsed) return;

      if (parsed.type === "error") {
        if (parsed.requestId) {
          const pending = pendingRef.current.get(parsed.requestId);
          if (pending) {
            pendingRef.current.delete(parsed.requestId);
            pending.reject(new Error(parsed.error));
            return;
          }
        }

        toast.error(`Помилка чату: ${parsed.error}`);
        setIsSending(false);
        return;
      }

      if (parsed.type === "chat_stream_start") {
        return;
      }

      if (parsed.type === "chat_stream_chunk") {
        if (!parsed.requestId) return;

        const pending = pendingRef.current.get(parsed.requestId);
        if (!pending) return;
        pending.onChunk(parsed.payload.delta);
        return;
      }

      if (parsed.type === "chat_stream_end") {
        if (!parsed.requestId) return;

        const pending = pendingRef.current.get(parsed.requestId);
        if (!pending) return;
        pendingRef.current.delete(parsed.requestId);
        pending.resolve(parsed);
        return;
      }

    };

    return () => {
      for (const pending of pendingRef.current.values()) {
        pending.reject(new Error("WebSocket closed"));
      }
      pendingRef.current.clear();
      socket.close();
      socketRef.current = null;
      setIsSocketConnected(false);
    };
  }, []);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (value) localStorage.setItem(API_KEY_STORAGE_KEY, value);
    else localStorage.removeItem(API_KEY_STORAGE_KEY);
  };

  const send = async (providedMessage?: string, approvalAction?: PendingApprovalAction) => {
    if (isSending) return;

    const trimmed = (providedMessage ?? message).trim();
    if (!approvalAction && !trimmed) return;

    if (!specialtyId) {
      toast.error("Оберіть спеціальність");
      return;
    }

    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      text: approvalAction
        ? approvalAction.decision === "approve"
          ? "Підтверджую"
          : "Відхиляю"
        : trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setMessage("");
    setIsSending(true);

    try {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket not connected");
      }

      const requestId = crypto.randomUUID();
      const assistantMessageId = `${Date.now()}-a`;

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          text: "",
        },
      ]);

      const responsePromise = new Promise<ChatWsStreamEnd>((resolve, reject) => {
        pendingRef.current.set(requestId, {
          id: requestId,
          resolve,
          reject,
          onChunk: (delta) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, text: `${msg.text}${delta}` }
                  : msg
              )
            );
          },
        });
      });

      socket.send(
        JSON.stringify({
          type: "chat",
          payload: {
            requestId,
            specialtyId,
            message: trimmed || undefined,
            approvalId: approvalAction?.approvalId,
            approvalDecision: approvalAction?.decision,
            sessionId: sessionId || undefined,
            apiKey: apiKey || undefined,
            model: model || undefined,
          },
        })
      );

      const data = await responsePromise;

      const responseSessionId = data.payload.context.sessionId;
      if (responseSessionId && responseSessionId !== sessionId) {
        setSessionId(responseSessionId);
      }

      if (data.payload.context.discipline) {
        setDisciplineContext(data.payload.context.discipline);
      }

      setPendingInputRequest(data.payload.requiresUserInput ?? null);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, text: data.payload.reply } : msg
        )
      );
    } catch (error) {
      console.error("Chat send error:", error);
      toast.error(`Помилка чату: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const answerInputRequest = (decision: "approve" | "reject") => {
    if (!pendingInputRequest || pendingInputRequest.kind !== "approval") return;

    const approvalId = pendingInputRequest.approvalId;
    setPendingInputRequest(null);
    void send(undefined, { approvalId, decision });
  };

  if (isLoading) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  const specialtyOptions = specialties.map((s) => ({ value: String(s.id), label: `${s.code} ${s.name}` }));
  const modelOptions = AVAILABLE_MODELS.map((m) => ({ value: m.id, label: m.name }));

  return (
    <div className="max-w-7xl mx-auto px-4 pb-4 text-center relative z-10 h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
      <div className="mt-8 mx-auto w-full text-left flex flex-col flex-1 gap-4 min-h-0 overflow-hidden">
        <div className="flex justify-between items-center shrink-0">
          <h1 className="font-mono">Чат</h1>
          <div className="flex items-center gap-3">
            
            {disciplineContext && (
              <div className="text-xs text-amber-200 bg-zinc-800 px-2 py-1 rounded border border-amber-300/30">
                Дисципліна: {disciplineContext.okNo ? `ОК${disciplineContext.okNo} ` : ""}{disciplineContext.courseName}
              </div>
            )}
            
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isSending}
              className="bg-zinc-950 border border-amber-50 rounded-lg px-3 py-2"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <select
              value={specialtyId}
              onChange={(e) => setSpecialtyId(Number(e.target.value))}
              disabled={isSending}
              className="bg-zinc-950 border border-amber-50 rounded-lg px-3 py-2"
            >
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          ref={listRef}
          className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-4 text-amber-50 font-mono flex-1 overflow-y-auto flex flex-col gap-3 min-h-0"
        >
          {!isSocketConnected ? (
            <div className="text-amber-300 text-sm mb-2">Підключення до WebSocket чату...</div>
          ) : null}

          {messages.length === 0 ? (
            <div className="text-amber-200 text-sm">
              Приклади:
              <div className="mt-2">
                <div>- Які дисципліни покривають СК-5?</div>
                <div>- Покажи дисципліни для ЗК-3.</div>
                <div>- Які курси відповідають ПР-2?</div>
                <div>- Де зустрічається тема "SQL JOIN"?</div>
                <div>- Скільки практичних годин загалом?</div>
              </div>
            </div>
          ) : null}

          {messages.map((m) => {
            return (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "bg-zinc-950 border border-zinc-700 rounded-lg p-3"
                    : "bg-zinc-800 border border-amber-300/40 rounded-lg p-3"
                }
              >
                <div className="text-xs opacity-70 mb-1">{m.role === "user" ? "Ви" : "Асистент"}</div>
                <div className="whitespace-pre-wrap text-sm"><Markdown>{m.text}</Markdown></div>
              </div>
            );
          })}

        </div>

        <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-4 text-amber-50 font-mono flex flex-col gap-2 shrink-0">
          {pendingInputRequest && (
            <div className="w-full mb-3 rounded-lg border border-amber-300/40 bg-zinc-800 p-3 text-sm">
              <div className="mb-2 text-amber-200">Потрібна ваша відповідь: {pendingInputRequest.question}</div>
              {pendingInputRequest.kind === "approval" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => answerInputRequest("approve")}
                    disabled={isSending || !isSocketConnected}
                    className="bg-zinc-950 border border-amber-50 rounded-lg px-3 py-1.5 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                  >
                    Підтвердити
                  </button>
                  <button
                    onClick={() => answerInputRequest("reject")}
                    disabled={isSending || !isSocketConnected}
                    className="bg-zinc-950 border border-amber-50 rounded-lg px-3 py-1.5 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                  >
                    Відхилити
                  </button>
                </div>
              ) : null}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isSocketConnected || isSending}
              rows={1}
              className="flex-1 bg-zinc-950 border border-amber-50 rounded-lg px-3 py-2 resize-none overflow-hidden"
              style={{ minHeight: "42px", maxHeight: "150px" }}
            />
            <button
              onClick={() => void send()}
              disabled={isSending || !isSocketConnected}
              className="bg-zinc-950 border border-amber-50 rounded-lg px-4 py-2 hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {isSending ? "..." : "Надіслати"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
