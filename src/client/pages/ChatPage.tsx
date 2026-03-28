import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { Specialty } from "@/stores/models";
import { loadAllSpecialties } from "../specialties";
import Markdown from 'react-markdown';
import { AVAILABLE_MODELS, DEFAULT_AGENT_MODEL, type ChatMessage, type DisciplineContext } from "../../ai/models";
import { callAgentApi } from "../chat";

const API_KEY_STORAGE_KEY = "openai_api_key";


export default function ChatPage() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [specialtyId, setSpecialtyId] = useState<number>();

  const [apiKey, setApiKey] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [expandedToolHistory, setExpandedToolHistory] = useState<Record<string, boolean>>({});
  const [sessionId, setSessionId] = useState<string>("");
  const [disciplineContext, setDisciplineContext] = useState<DisciplineContext | null >(null);
  const [model, setModel] = useState<string>(DEFAULT_AGENT_MODEL);

  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
        if (allSpecialties.length > 0) {
          setSpecialtyId(allSpecialties[0]!.id);
        }
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
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (value) localStorage.setItem(API_KEY_STORAGE_KEY, value);
    else localStorage.removeItem(API_KEY_STORAGE_KEY);
  };

  const send = async () => {
    if (isSending) return;

    const trimmed = message.trim();
    if (!trimmed) return;

    if (!specialtyId) {
      toast.error("Оберіть спеціальність");
      return;
    }

    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setMessage("");
    setIsSending(true);

    try {
      const data = await callAgentApi(specialtyId, trimmed, sessionId, apiKey, model);

      const sessionIdHeader = data.context.sessionId;
      if (sessionIdHeader && sessionIdHeader !== sessionId) {
        setSessionId(sessionIdHeader);
      }

      if (data.context.discipline) {
        setDisciplineContext(data.context.discipline);
      }

      const assistantMsg: ChatMessage = {
        id: `${Date.now()}-a`,
        role: "assistant",
        text: data.reply
      };

      setMessages((prev) => [...prev, assistantMsg]);
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

  const toggleToolHistory = (messageId: string) => {
    setExpandedToolHistory((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left">
          <div className="text-amber-50 font-mono">Завантаження чату...</div>
        </div>
      </div>
    );
  }

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

        <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-4 text-amber-50 font-mono flex gap-2 items-end shrink-0">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 bg-zinc-950 border border-amber-50 rounded-lg px-3 py-2 resize-none overflow-hidden"
            style={{ minHeight: "42px", maxHeight: "150px" }}
          />
          <button
            onClick={send}
            disabled={isSending}
            className="bg-zinc-950 border border-amber-50 rounded-lg px-4 py-2 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {isSending ? "..." : "Надіслати"}
          </button>
        </div>
      </div>
    </div>
  );
}
