import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import type { Prompt, QuizQuestion } from "@/stores/models";
import QuizEditor from "./QuizEditor";

const FORMAT_LABELS: Record<Prompt["format"], string> = {
  text: "Текст",
  list: "Список",
  quiz: "Тестові питання"
};

interface GeneratedFieldEditorProps {
  field: string;
  promptName?: string;
  format: Prompt["format"];
  value?: string | string[] | QuizQuestion[];
  onChange: (value: string | string[] | QuizQuestion[] | null) => void;
}

export default function GeneratedFieldEditor({
  field,
  promptName,
  format,
  value,
  onChange,
}: GeneratedFieldEditorProps) {
  const [newListItem, setNewListItem] = useState("");

  const textValue = typeof value === "string" ? value : "";
  const listValue = format === "list" && Array.isArray(value) ? (value as string[]) : [];
  const quizValue = format === "quiz" && Array.isArray(value) ? (value as QuizQuestion[]) : [];

  const handleReset = () => {
    onChange(null);
    setNewListItem("");
  };

  const handleAddListItem = () => {
    if (!newListItem.trim()) return;
    onChange([...listValue, newListItem.trim()]);
    setNewListItem("");
  };

  const handleRemoveListItem = (index: number) => {
    const next = listValue.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleUpdateListItem = (index: number, nextValue: string) => {
    const next = [...listValue];
    next[index] = nextValue;
    onChange(next);
  };

  const renderEditor = () => {
    switch (format) {
      case "list":
        return (
          <div className="flex flex-col gap-2">
            {listValue.length > 0 && (
              <div className="flex flex-col gap-2">
                {listValue.map((item, index) => (
                  <div key={`${field}-item-${index}`} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleUpdateListItem(index, e.target.value)}
                      className="flex-1 bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white placeholder:text-zinc-600"
                      placeholder={`Елемент ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveListItem(index)}
                      className="text-red-400 hover:text-red-300"
                      aria-label="Видалити елемент"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newListItem}
                onChange={(e) => setNewListItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddListItem();
                  }
                }}
                className="flex-1 bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white placeholder:text-zinc-600"
                placeholder="Додати значення"
              />
              <button
                type="button"
                onClick={handleAddListItem}
                className="text-amber-50 hover:text-amber-200"
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>
          </div>
        );
      case "quiz":
        return (
          <QuizEditor
            quiz={quizValue}
            onQuizChange={(next) => onChange(next)}
          />
        );
      case "text":
      default:
        return (
          <textarea
            rows={format === "text" ? 6 : 10}
            value={textValue}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y placeholder:text-zinc-600"
            placeholder="Введіть значення"
          />
        );
    }
  };

  return (
    <div className="bg-zinc-800 border border-amber-50 rounded-lg p-3 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-amber-50 font-bold text-base">{promptName || field}</div>
          <div className="text-xs text-amber-50/70 font-mono">{field}</div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-amber-50 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Скинути значення"
          title="Скинути значення"
        >
          <FontAwesomeIcon icon={faRotateRight} />
        </button>
      </div>
      {renderEditor()}
    </div>
  );
}
