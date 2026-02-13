import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { Specialty } from "@/stores/models";
import { loadAllSpecialties } from "../specialties";
import { formatDisciplineCode } from "../courses";

type ChatAction =
  | "disciplines_by_sk"
  | "disciplines_by_zk"
  | "disciplines_by_pr"
  | "disciplines_by_topic"
  | "sum_practical_hours"
  | "clarify";

type DisciplineItem = {
  ok_no: string | null;
  name: string;
};

type TopicMatchItem = DisciplineItem & {
  matchedTopics: string[];
};

type ChatResponse = {
  reply: string;
  data?:
    | { action: "disciplines_by_sk"; items: DisciplineItem[] }
    | { action: "disciplines_by_zk"; items: DisciplineItem[] }
    | { action: "disciplines_by_pr"; items: DisciplineItem[] }
    | { action: "disciplines_by_topic"; items: TopicMatchItem[] }
    | { action: "sum_practical_hours"; totalPracticalHours: number; byDiscipline: Array<DisciplineItem & { practicalHours: number }> }
    | { action: "clarify" };
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  data?: ChatResponse["data"];
};

const API_KEY_STORAGE_KEY = "openai_api_key";

function formatDisciplineLabel(item: DisciplineItem): string {
  return `${formatDisciplineCode(item.ok_no)} — ${item.name}`;
}

type DisciplineListAction = "disciplines_by_sk" | "disciplines_by_zk" | "disciplines_by_pr";

function isDisciplineListAction(action: ChatAction | undefined): action is DisciplineListAction {
  return action === "disciplines_by_sk" || action === "disciplines_by_zk" || action === "disciplines_by_pr";
}

function isDisciplineListData(
  data: ChatResponse["data"] | undefined,
): data is { action: DisciplineListAction; items: DisciplineItem[] } {
  return !!data && isDisciplineListAction(data.action);
}

export default function ChatPage() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [specialtyId, setSpecialtyId] = useState<string>("");

  const [apiKey, setApiKey] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const savedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedApiKey) setApiKey(savedApiKey);

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const allSpecialties = await loadAllSpecialties();
        setSpecialties(allSpecialties);
        if (allSpecialties.length > 0) {
          setSpecialtyId(String(allSpecialties[0]?.id ?? ""));
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

  const selectedSpecialty = useMemo(() => specialties.find((s) => String(s.id) === specialtyId) ?? null, [specialties, specialtyId]);

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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialtyId: Number(specialtyId),
          message: trimmed,
          apiKey: apiKey || undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as ChatResponse;

      const assistantMsg: ChatMessage = {
        id: `${Date.now()}-a`,
        role: "assistant",
        text: data.reply,
        data: data.data,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("Chat send error:", error);
      toast.error(`Помилка чату: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
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
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-mono text-2xl">Чат</h1>
          <p className="text-amber-100 font-mono text-sm">
            Питання по навчальному плану (тільки в межах обраної спеціальності).
          </p>
        </div>

        <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-4 text-amber-50 font-mono flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-amber-200">Спеціальність</span>
              <select
                value={specialtyId}
                onChange={(e) => setSpecialtyId(e.target.value)}
                className="bg-zinc-950 border border-amber-50 rounded-lg px-3 py-2"
              >
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-amber-200">OpenAI API key</span>
              <input
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="sk-..."
                className="bg-zinc-950 border border-amber-50 rounded-lg px-3 py-2"
              />
            </label>
          </div>

          <div className="text-xs text-amber-200">
            Обрано: {selectedSpecialty ? `${selectedSpecialty.code} ${selectedSpecialty.name}` : "—"}
          </div>
        </div>

        <div
          ref={listRef}
          className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-4 text-amber-50 font-mono h-[420px] overflow-y-auto flex flex-col gap-3"
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
            const topicData = m.data?.action === "disciplines_by_topic" ? m.data : null;
            const disciplineData = isDisciplineListData(m.data) ? m.data : null;
            const practicalData = m.data?.action === "sum_practical_hours" ? m.data : null;

            return (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "bg-zinc-950 border border-zinc-700 rounded-lg p-3"
                    : "bg-zinc-950 border border-amber-300/40 rounded-lg p-3"
                }
              >
                <div className="text-xs opacity-70 mb-1">{m.role === "user" ? "Ви" : "Асистент"}</div>
                <div className="whitespace-pre-wrap text-sm">{m.text}</div>

                {m.role === "assistant" && topicData ? (
                  <div className="mt-3 text-sm">
                    <div className="text-xs text-amber-200 mb-1">Збіги по темах</div>
                    <div className="flex flex-col gap-2">
                      {topicData.items.map((item) => (
                        <div key={`${item.ok_no}-${item.name}`} className="border-t border-zinc-800 pt-2">
                          <div>{formatDisciplineLabel(item)}</div>
                          {item.matchedTopics.length > 0 ? (
                            <div className="text-xs text-amber-200 mt-1">Теми: {item.matchedTopics.join(", ")}</div>
                          ) : (
                            <div className="text-xs text-amber-200 mt-1">Збіг у назві/описі дисципліни</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {m.role === "assistant" && disciplineData ? (
                  <div className="mt-3 text-sm">
                    <div className="text-xs text-amber-200 mb-1">Дисципліни</div>
                    <div className="flex flex-col gap-1">
                      {disciplineData.items.map((item) => (
                        <div key={`${item.ok_no}-${item.name}`}>{formatDisciplineLabel(item)}</div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {m.role === "assistant" && practicalData ? (
                  <div className="mt-3 text-sm">
                    <div className="text-xs text-amber-200 mb-1">Практичні години (денна форма)</div>
                    <div className="text-amber-50">Разом: {practicalData.totalPracticalHours} год.</div>
                  </div>
                ) : null}
              </div>
            );
          })}

        </div>

        <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-4 text-amber-50 font-mono flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишіть запит..."
            className="flex-1 bg-zinc-950 border border-amber-50 rounded-lg px-3 py-2"
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
