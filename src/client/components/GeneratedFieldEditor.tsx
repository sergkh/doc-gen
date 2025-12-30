import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faRotateRight, faWandMagicSparkles, faCircle, faCircleNotch, faSpinner } from "@fortawesome/free-solid-svg-icons";
import type { Prompt, QuizQuestion } from "@/stores/models";
import QuizEditor from "./QuizEditor";
import toast from "react-hot-toast";

const FORMAT_LABELS: Record<Prompt["format"], string> = {
  text: "Текст",
  list: "Список",
  quiz: "Тестові питання"
};

type GeneratedFieldEditorProps = {
  field: string;
  promptName?: string;
  format: Prompt["format"];
  value?: string | string[] | QuizQuestion[];
  onChange: (value: string | string[] | QuizQuestion[] | null) => void;
  courseId?: number;
  topicId?: number;
  prompt?: Prompt;
  apiKey?: string;
}

function GenerateItemButton({ prompt, handleGenerateMoreItems }: {
  prompt?: Prompt;
  handleGenerateMoreItems: () => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const onClick = async () => {
    if (isGenerating) return;
    setIsGenerating(true);    
    try {
      await handleGenerateMoreItems();
    } finally {
      setIsGenerating(false);
    }
  };

  return prompt ? (
    <button
      type="button"
      onClick={onClick}
      disabled={isGenerating}
      className={`text-amber-50 hover:text-amber-200 ${isGenerating ? "opacity-50 cursor-not-allowed" : ""}`}
      title="Згенерувати більше елементів"
      aria-label="Згенерувати більше елементів"
    >
      {isGenerating ? (
        <FontAwesomeIcon icon={faSpinner} />
      ) : (
        <FontAwesomeIcon icon={faWandMagicSparkles} />
      )}
    </button>
  ) : <></>;
}

export default function GeneratedFieldEditor({
  field,
  promptName,
  format,
  value,
  onChange,
  courseId,
  topicId,
  prompt,
  apiKey,
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

  const handleGenerateMoreItems = async () => {
    if (!courseId || !prompt) return;

    try {
      let endpoint = `/api/courses/${courseId}/run-prompt`;
      
      if (topicId) {
        endpoint = `/api/courses/${courseId}/topics/${topicId}/run-prompt`;
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: {
            ...prompt,
            type: topicId ? "topic" : "course",
          },
          ...(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });
      
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Не вдалося згенерувати елементи");
      }
      
      const data = await response.json();
      
      if (data.item && Array.isArray(data.item)) {
        if (format === "list") {
          const currentItems = listValue;
          const newItems = data.item.filter((item: any) => typeof item === "string");
          onChange([...currentItems, ...newItems]);
        } else if (format === "quiz") {
          const currentItems = quizValue;
          const newItems = data.item.filter((item: any) => 
            item && typeof item === "object" && 
            typeof item.question === "string" && 
            Array.isArray(item.options) && 
            typeof item.answerIndex === "number"
          );
          onChange([...currentItems, ...newItems]);
        }
      }
    } catch (error) {
      console.error("Error generating items:", error);
      toast.error(`Не вдалося згенерувати елементи: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
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
           <div className="flex flex-col gap-2">
             <QuizEditor
               quiz={quizValue}
               onQuizChange={(next) => onChange(next)}
             />

           </div>
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="text-amber-50 hover:text-yellow-300 hover:opacity-100 transition-opacity"
            aria-label="Скинути значення"
            title="Скинути значення"
          >
            <FontAwesomeIcon icon={faRotateRight} />
          </button>
          <GenerateItemButton 
            prompt={prompt}
            handleGenerateMoreItems={handleGenerateMoreItems}
          />
        </div>
      </div>
      {renderEditor()}
    </div>
  );
}
