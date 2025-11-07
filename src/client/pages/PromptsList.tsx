import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faGripVertical } from "@fortawesome/free-solid-svg-icons";
import { Reorder } from "motion/react";
import toast from "react-hot-toast";
import type { Prompt } from "@/stores/models";
import PromptEditor from "@/client/components/PromptEditor";

const PROMPT_TYPES = {
  "course": "Дисципліна",
  "topic": "Тема дисципліни"
};

export default function PromptsList() {
  const [selectedType, setSelectedType] = useState<"course" | "topic">("course");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null);

  useEffect(() => {
    fetchPrompts();
  }, [selectedType]);

  const fetchPrompts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/prompts/${selectedType}`);
      if (response.ok) {
        const data = await response.json() as Prompt[];
        setPrompts(data);
      } else {
        throw new Error("Failed to fetch prompts");
      }
    } catch (error) {
      console.error("Error fetching prompts:", error);
      toast.error("Помилка завантаження промптів");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPrompt = () => {
    const newPrompt: Prompt = {
      id: 0,
      index: prompts.length + 1,
      type: selectedType,
      field: "",
      system_prompt: "Ти асистент викладача з дисципліни \"{{courseName}}\". Опис: {{courseDescription}}, який видає відповіді тільки в форматі JSON об'єктів",
      prompt: ""
    };
    setPrompts([newPrompt, ...prompts]);
    setEditingPromptId(0);
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPromptId(prompt.id);
  };

  const handleCancelEdit = () => {
    const wasNewPrompt = editingPromptId === 0;
    setEditingPromptId(null);
    // Remove the new prompt if it wasn't saved
    if (wasNewPrompt) {
      setPrompts(prompts.filter(p => p.id !== 0));
    }
  };

  const handleSavePrompt = async (promptData: Prompt) => {
    try {
      let response;
      if (promptData.id === 0) {
        // Create new prompt
        response = await fetch(`/api/prompts/${selectedType}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            index: promptData.index,
            field: promptData.field,
            system_prompt: promptData.system_prompt,
            prompt: promptData.prompt
          }),
        });
      } else {
        // Update existing prompt
        response = await fetch(`/api/prompts/${promptData.type}/${promptData.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            index: promptData.index,
            type: promptData.type,
            field: promptData.field,
            system_prompt: promptData.system_prompt,
            prompt: promptData.prompt
          }),
        });
      }

      if (response.ok) {
        toast.success("Промпт успішно збережено");
        await fetchPrompts();
        setEditingPromptId(null);
      } else {
        throw new Error("Failed to save prompt");
      }
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error("Не вдалося зберегти промпт");
      throw error;
    }
  };

  const handleDeletePrompt = async (prompt: Prompt) => {
    if (!confirm(`Ви впевнені, що хочете видалити промпт "${prompt.field}"?`)) return;

    try {
      const response = await fetch(`/api/prompts/${prompt.type}/${prompt.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Промпт успішно видалено");
        await fetchPrompts();
      } else {
        throw new Error("Failed to delete prompt");
      }
    } catch (error) {
      console.error("Error deleting prompt:", error);
      toast.error("Не вдалося видалити промпт");
    }
  };

  const handleReorder = async (newOrder: Prompt[]) => {
    // Update local state immediately for responsive UI
    setPrompts(newOrder);
    
    // Extract prompt IDs in the new order
    const promptIds = newOrder.map(prompt => prompt.id);
    
    // Send reorder request to server
    try {
      const response = await fetch(`/api/prompts/${selectedType}/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promptIds),
      });

      if (!response.ok) {
        throw new Error("Failed to reorder prompts");
      }
      
      // Refresh prompts to ensure sync with server
      await fetchPrompts();
    } catch (error) {
      console.error("Error reordering prompts:", error);
      // Revert to previous order on error
      await fetchPrompts();
      toast.error("Не вдалося зберегти порядок промптів");
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-[#fbf0df] font-mono">Завантаження...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="font-mono">Промпти</h1>
          <div className="flex items-center gap-3">
            <select
              className="bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-3 rounded outline-none focus:text-white"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as "course" | "topic")}
            >
              <option value="course">Дисципліна</option>
              <option value="topic">Тема дисципліни</option>
            </select>
            <button
              onClick={handleAddPrompt}
              className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-3 py-1.5 rounded-lg font-bold flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faPlus} /> Додати промпт
            </button>
          </div>
        </div>

        {prompts.length === 0 && editingPromptId === null ? (
          <div className="text-[#fbf0df] opacity-60">Немає промптів</div>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="text-[#f3d5a3] font-bold text-lg font-mono">
              {PROMPT_TYPES[selectedType]}
            </h2>
            <Reorder.Group
              axis="y"
              values={prompts}
              onReorder={handleReorder}
              className="flex flex-col gap-3"
            >
              {prompts.map((prompt) => {
                // If this prompt is being edited, show the editor instead
                if (editingPromptId === prompt.id) {
                  return (
                    <div key={prompt.id} className="flex flex-col gap-3">
                      <PromptEditor
                        prompt={prompt}
                        selectedType={selectedType}
                        onSave={handleSavePrompt}
                        onCancel={handleCancelEdit}
                      />
                    </div>
                  );
                }

                // Otherwise show the normal prompt item
                return (
                  <Reorder.Item
                    key={prompt.id}
                    value={prompt}
                    className="bg-[#1a1a1a] border border-[#fbf0df] rounded-lg p-3 flex items-start justify-between cursor-grab active:cursor-grabbing transition-colors"
                  >
                    <div className="flex items-start gap-2 flex-1">
                      <div className="mt-1 text-[#fbf0df] opacity-60 cursor-grab active:cursor-grabbing">
                        <FontAwesomeIcon icon={faGripVertical} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-[#f3d5a3]">
                            {prompt.index}. {prompt.field}
                          </span>
                        </div>
                        <div className="text-sm text-[#fbf0df] opacity-80 line-clamp-2 overflow-hidden">
                          <div>
                            <span className="font-bold">Промпт:</span> {prompt.prompt.substring(0, 100)}...
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEditPrompt(prompt)}
                        className="text-[#fbf0df] hover:text-[#f3d5a3] opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                        aria-label="Редагувати промпт"
                        title="Редагувати промпт"
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button
                        onClick={() => handleDeletePrompt(prompt)}
                        className="text-[#fbf0df] hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                        aria-label="Видалити промпт"
                        title="Видалити промпт"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          </div>
        )}
      </div>
    </div>
  );
}

