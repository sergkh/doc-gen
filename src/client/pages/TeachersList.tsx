import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen } from "@fortawesome/free-solid-svg-icons";
import type { Teacher } from "@/stores/models";
import { loadAllTeachers, deleteTeacher } from "../teachers";

export default function TeachersList() {
  const navigate = useNavigate();

  const [items, setItems] = useState<Teacher[]>([]);

  useEffect(() => {
    loadAllTeachers().then(setItems).catch(console.error);
  }, []);

  const handleDelete = async (teacher: Teacher) => {
    if (!confirm(`Ви впевнені, що хочете видалити викладача "${teacher.name}"?`)) {
      return;
    }

    try {
      await deleteTeacher(teacher.id);
      setItems(items.filter(t => t.id !== teacher.id));
    } catch (error) {
      console.error("Error deleting teacher:", error);
      alert("Не вдалося видалити викладача");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        

        <div className="flex justify-between items-center">
          <h1 className="font-mono">Викладачі</h1>
          <button
            onClick={() => navigate("/teachers/new")}
            className="text-amber-50 hover:text-amber-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <div className="text-amber-50 font-mono">Немає викладачів</div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map(t => (
                <li key={t.id} className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-3 text-amber-50 font-mono flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-bold">{t.name}</div>
                    <div className="text-sm opacity-80">{t.email}</div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => navigate(`/teachers/${t.id}`)} 
                      className="text-amber-50 hover:text-amber-200 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Редагувати викладача"
                      title="Редагувати викладача"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button 
                      onClick={() => handleDelete(t)} 
                      className="text-amber-50 hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Видалити викладача"
                      title="Видалити викладача"
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

