import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCheck } from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";
import type { Prompt } from "@/stores/models";
import PromptTester from "./PromptTester";

const AVAILABLE_MODELS = [
  "gpt-4o",
  "gpt-5-2025-08-07",
  "gpt-5-mini-2025-08-07",
  "gpt-4.1-2025-04-14"
];

const AVAILABLE_FORMATS: Array<{ value: Prompt["format"]; label: string }> = [
  { value: "text", label: "Текст" },
  { value: "list", label: "Список" },
  { value: "quiz", label: "Тестові питання" },
];

interface PromptEditorProps {
  prompt: Prompt;
  selectedType: "course" | "topic";
  onSave: (prompt: Prompt) => Promise<void>;
  onCancel: () => void;
}

type PromptType = "course" | "topic";

export default function PromptEditor({
  prompt,
  selectedType,
  onSave,
  onCancel,
}: PromptEditorProps) {
  const promptType: PromptType = selectedType ?? prompt.type;

  const [field, setField] = useState(prompt.field);
  const [model, setModel] = useState(prompt.model || "gpt-4o");
  const [format, setFormat] = useState<Prompt["format"]>(prompt.format || "text");
  const [systemPrompt, setSystemPrompt] = useState(prompt.system_prompt);
  const [userPrompt, setUserPrompt] = useState(prompt.prompt);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setField(prompt.field);
    setModel(prompt.model || "gpt-4o");
    setFormat(prompt.format || "text");
    setSystemPrompt(prompt.system_prompt);
    setUserPrompt(prompt.prompt);
  }, [prompt]);

  const handleSave = async () => {
    if (!field.trim() || !systemPrompt.trim() || !userPrompt.trim()) {
      toast.error("Всі поля обов'язкові");
      return;
    }

    setIsSaving(true);
    try {
      const updatedPrompt: Prompt = {
        ...prompt,
        type: promptType,
        field: field.trim(),
        model: model || "gpt-4o",
        format: format || "text",
        system_prompt: systemPrompt.trim(),
        prompt: userPrompt.trim(),
      };
      await onSave(updatedPrompt);
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error("Не вдалося зберегти промпт");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-zinc-800 border-2 border-amber-200 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-amber-50 font-bold">
          {prompt.id === 0 ? "Додати промпт" : "Редагувати промпт"}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="text-amber-50 hover:text-green-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded disabled:opacity-30 cursor-pointer"
            aria-label="Зберегти"
            title="Зберегти"
          >
            <FontAwesomeIcon icon={faCheck} />
          </button>
          <button
            onClick={onCancel}
            className="text-amber-50 hover:text-white hover:bg-gray-700 cursor-pointer"
            aria-label="Скасувати"
            title="Скасувати"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      </div>
      <div>
        <label className="block text-amber-50 font-bold mb-2">Поле:</label>
        <input
          className="w-full bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
          value={field}
          onChange={(e) => setField(e.target.value)}
          placeholder="Назва поля (наприклад: subtopics, keywords)"
        />
      </div>
      <div>
        <label className="block text-amber-50 font-bold mb-2">Модель:</label>
        <select
          className="w-full bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m} value={m} className="bg-zinc-800 text-amber-50">
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-amber-50 font-bold mb-2">Формат відповіді:</label>
        <select
          className="w-full bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
          value={format}
          onChange={(e) => setFormat(e.target.value as Prompt["format"])}
        >
          {AVAILABLE_FORMATS.map(({ value, label }) => (
            <option key={value} value={value} className="bg-zinc-800 text-amber-50">
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-amber-50 font-bold mb-2">Системний промпт:</label>
        <textarea
          rows={2}
          className="w-full bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Системний промпт"
        />
      </div>
      <div>
        <label className="block text-amber-50 font-bold mb-2">Промпт:</label>
        <textarea
          rows={15}
          className="w-full bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="Промпт користувача"
        />
      </div>

      <PromptTester
        prompt={prompt}
        promptType={promptType}
        field={field}
        model={model}
        format={format}
        systemPrompt={systemPrompt}
        userPrompt={userPrompt}
      />
    </div>
  );
}
