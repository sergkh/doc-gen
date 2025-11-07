import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen } from "@fortawesome/free-solid-svg-icons";
import type { Template } from "@/stores/models";
import { loadAllTemplates, deleteTemplate } from "../templates";

export default function TemplatesList() {
  const navigate = useNavigate();

  const [items, setItems] = useState<Template[]>([]);

  useEffect(() => {
    loadAllTemplates().then(setItems).catch(console.error);
  }, []);

  const handleDelete = async (template: Template) => {
    if (!confirm(`Ви впевнені, що хочете видалити шаблон "${template.name}"?`)) {
      return;
    }

    try {
      await deleteTemplate(template.id);
      setItems(items.filter(t => t.id !== template.id));
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Не вдалося видалити шаблон");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h1 className="font-mono">Шаблони</h1>
          <button
            onClick={() => navigate("/templates/new")}
            className="text-[#fbf0df] hover:text-[#f3d5a3] px-4 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <div className="text-[#fbf0df] font-mono">Немає шаблонів</div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map(t => (
                <li key={t.id} className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-bold">{t.name}</div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => navigate(`/templates/${t.id}`)} 
                      className="text-[#fbf0df] hover:text-[#f3d5a3] opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Редагувати шаблон"
                      title="Редагувати шаблон"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button 
                      onClick={() => handleDelete(t)} 
                      className="text-[#fbf0df] hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Видалити шаблон"
                      title="Видалити шаблон"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

