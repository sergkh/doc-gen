import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCheck } from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";
import type { Prompt } from "@/stores/models";

interface PromptEditorProps {
  prompt: Prompt;
  selectedType: "course" | "topic";
  onSave: (prompt: Prompt) => Promise<void>;
  onCancel: () => void;
}

export default function PromptEditor({
  prompt,
  selectedType,
  onSave,
  onCancel,
}: PromptEditorProps) {
  const [field, setField] = useState(prompt.field);
  const [systemPrompt, setSystemPrompt] = useState(prompt.system_prompt);
  const [userPrompt, setUserPrompt] = useState(prompt.prompt);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setField(prompt.field);
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
        field: field.trim(),
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
    <div className="bg-[#2a2a2a] border-2 border-[#f3d5a3] rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[#fbf0df] font-bold">
          {prompt.id === 0 ? "Додати промпт" : "Редагувати промпт"}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="text-[#fbf0df] hover:text-green-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded disabled:opacity-30"
            aria-label="Зберегти"
            title="Зберегти"
          >
            <FontAwesomeIcon icon={faCheck} />
          </button>
          <button
            onClick={onCancel}
            className="text-[#fbf0df] hover:text-white"
            aria-label="Скасувати"
            title="Скасувати"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      </div>
      <div>
        <label className="block text-[#fbf0df] font-bold mb-2">Поле:</label>
        <input
          className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
          value={field}
          onChange={(e) => setField(e.target.value)}
          placeholder="Назва поля (наприклад: subtopics, keywords)"
        />
      </div>
      <div>
        <label className="block text-[#fbf0df] font-bold mb-2">Системний промпт:</label>
        <textarea
          rows={1}
          className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Системний промпт"
        />
      </div>
      <div>
        <label className="block text-[#fbf0df] font-bold mb-2">Промпт:</label>
        <textarea
          rows={15}
          className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="Промпт користувача"
        />
      </div>
    </div>
  );
}

