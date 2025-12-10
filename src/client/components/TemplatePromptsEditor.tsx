import { useState } from "react";
import type { Prompt } from "@/stores/models";
import PromptEditor from "./PromptEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen } from "@fortawesome/free-solid-svg-icons";

interface TemplatePromptsEditorProps {
  prompts: Prompt[];
  onChange: (prompts: Prompt[]) => void;
}

export default function TemplatePromptsEditor({
  prompts,
  onChange
}: TemplatePromptsEditorProps) {
  const [editingPromptIndex, setEditingPromptIndex] = useState<number | null>(null);
  const [selectedPromptType, setSelectedPromptType] = useState<"course" | "topic">("course");

  const handleAddPrompt = () => {
    const newPrompt: Prompt = {
      name: "",
      type: selectedPromptType,
      field: "",
      model: "gpt-4o",
      format: "text",
      system_prompt: "Ти асистент викладача з дисципліни \"{{courseName}}\". Опис: {{courseDescription}}",
      prompt: ""
    };
    onChange([...prompts, newPrompt]);
    setEditingPromptIndex(prompts.length);
  };

  const handleEditPrompt = (index: number) => {
    setEditingPromptIndex(index);
  };

  const handleSavePrompt = async (prompt: Prompt) => {
    const updatedPrompts = [...prompts];
    if (editingPromptIndex !== null) {
      updatedPrompts[editingPromptIndex] = prompt;
    }
    onChange(updatedPrompts);
    setEditingPromptIndex(null);
  };

  const handleCancelEditPrompt = () => {
    setEditingPromptIndex(null);
  };

  const handleDeletePrompt = (index: number) => {
    const updatedPrompts = [...prompts];
    updatedPrompts.splice(index, 1);
    onChange(updatedPrompts);
    if (editingPromptIndex === index) {
      setEditingPromptIndex(null);
    } else if (editingPromptIndex !== null && editingPromptIndex > index) {
      setEditingPromptIndex(editingPromptIndex - 1);
    }
  };

  return (
    <div className="col-span-2 border-t border-amber-50/30 pt-3 mt-3">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-amber-50 font-bold">Промпти шаблону:</label>
        <div className="flex gap-2 items-center">
          <select
            value={selectedPromptType}
            onChange={(e) => setSelectedPromptType(e.target.value as "course" | "topic")}
            className="bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200"
          >
            <option value="course">Дисципліна</option>
            <option value="topic">Тема</option>
          </select>
          <button
            onClick={handleAddPrompt}
            className="text-amber-50 hover:text-amber-200 cursor-pointer px-3 py-1 rounded-lg font-bold text-sm"
          >
            <FontAwesomeIcon icon={faPlus} /> Додати промпт
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {prompts.map((prompt, index) => (
          <div key={index} className="bg-zinc-800 border border-amber-50/30 rounded-lg p-3">
            {editingPromptIndex === index ? (
              <PromptEditor
                prompt={prompt}
                selectedType={prompt.type}
                onSave={handleSavePrompt}
                onCancel={handleCancelEditPrompt}
              />
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-amber-50 font-bold">
                    {prompt.field || "(Без назви)"} ({prompt.type === "course" ? "Дисципліна" : "Тема"})
                  </div>
                  <div className="text-sm text-amber-50/70 mt-1">Модель: {prompt.model}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditPrompt(index)}
                    className="text-amber-50 hover:text-amber-200 px-2 py-1"
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </button>
                  <button
                    onClick={() => handleDeletePrompt(index)}
                    className="text-amber-50 hover:text-red-400 px-2 py-1"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {prompts.length === 0 && (
          <div className="text-amber-50/50 text-sm text-center py-4">
            Немає промптів. Промпти використовуються для генерації контенту за допомогою AI й результати можуть бути використані в шаблоні як параметри.
            Наприклад, промпт з назвою 'selfMethodGoal' для дисципліни буде доступний в шаблоні як 'course.generated.selfMethodGoal'.
          </div>
        )}
      </div>
    </div>
  );
}

