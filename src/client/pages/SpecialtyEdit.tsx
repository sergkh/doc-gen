import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faCheck, faTimes } from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";
import type { CourseResult, Specialty } from "@/stores/models";
import { deleteResult, loadResultsBySpecialty } from "../results";
import { loadSpecialty, upsertSpecialty } from "../specialties";

const RESULT_TYPES = {
  "ЗК": "Загальні компетентності",
  "СК": "Спеціальні компетентності",
  "РН": "Результати навчання"
};

export default function SpecialtyEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [items, setItems] = useState<CourseResult[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadSpecialty(id).then(specialty => {
        setSpecialty(specialty);
        // Load results for this specialty
        setIsLoading(true);
        loadResultsBySpecialty(specialty.id)
          .then((results) => {
            setItems(results);
          })
          .catch((error) => {
            console.error("Error loading results:", error);
            toast.error("Не вдалося завантажити результати");
            setItems([]);
          })
          .finally(() => {
            setIsLoading(false);
          });
      }).catch(console.error);
    } else {
      // New specialty
      setSpecialty({
        id: -1,
        code: "",
        name: "",
        old_code: "",
        old_name: "",
        area_code: "",
        area: "",
        qualification: "",
        data: { disciplines: [] }
      });
    }
  }, [id]);

  const groupedResults = useMemo(() => {
    const grouped: Record<string, CourseResult[]> = {
      "ЗК": [],
      "СК": [],
      "РН": []
    };

    items.forEach(result => {
      const typeGroup = grouped[result.type];
      if (typeGroup) {
        typeGroup.push(result);
      }
    });

    // Sort each group by 'no'
    Object.keys(grouped).forEach(type => {
      const typeGroup = grouped[type];
      if (typeGroup) {
        typeGroup.sort((a, b) => a.no - b.no);
      }
    });

    return grouped;
  }, [items]);

  const updateSpecialty = (json: Partial<Specialty>) => {
    if (!specialty) return;
    setSpecialty({ ...specialty, ...json } as Specialty);
  };

  const handleDelete = async (result: CourseResult) => {
    if (!confirm(`Ви впевнені, що хочете видалити результат "${result.name}"?`)) {
      return;
    }

    try {
      await deleteResult(result.id);
      if (specialty?.id) {
        const results = await loadResultsBySpecialty(specialty.id);
        setItems(results);
      }
      toast.success("Результат успішно видалено");
    } catch (error) {
      toast.error("Не вдалося видалити результат");
    }
  };



  const handleSaveSpecialty = async () => {
    if (!specialty) return;
    try {
      await upsertSpecialty(specialty);
      toast.success("Спеціальність успішно збережена");
      // Reload the specialty to get the updated data
      loadSpecialty(specialty.id.toString()).then(updatedSpecialty => {
        setSpecialty(updatedSpecialty);
      });
    } catch (error) {
      console.error("Error saving specialty:", error);
      toast.error("Не вдалося зберегти спеціальність");
    }
  };

  const isValid = useMemo(() => {
    if (!specialty) return false;
    return specialty.code.trim() !== "" && specialty.name.trim() !== "" && specialty.area.trim() !== "";
  }, [specialty]);

  if (!specialty) {
    return (
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-amber-50 font-mono">Спеціальність не знайдено</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="font-mono">{specialty.id >= 0 ? "Редагувати спеціальність" : "Додати спеціальність"}</h1>
          <div className="flex gap-2">
            <button
              onClick={handleSaveSpecialty}
              disabled={!isValid}
              className="text-amber-50 hover:text-green-400 hover:opacity-100 transition-opacity p-1.5 rounded disabled:opacity-30 cursor-pointer"
            >
              <FontAwesomeIcon icon={faCheck} />
            </button>
            <button
              onClick={() => navigate("/specialties")}
              className="text-amber-50 hover:text-red-400 cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>

        {/* Specialty Fields Section */}
        <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-3 font-mono flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="col-span-1">
              <label className="block text-amber-50 font-bold mb-2">Код:</label>
              <input
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={specialty.code}
                onChange={(e) => updateSpecialty({ code: e.target.value })}
              />
            </div>
            <div className="col-span-1">
              <label className="block text-amber-50 font-bold mb-2">Стара назва коду:</label>
              <input
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={specialty.old_code}
                onChange={(e) => updateSpecialty({ old_code: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-amber-50 font-bold mb-2">Назва:</label>
              <input
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={specialty.name}
                onChange={(e) => updateSpecialty({ name: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-amber-50 font-bold mb-2">Стара назва:</label>
              <input
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={specialty.old_name}
                onChange={(e) => updateSpecialty({ old_name: e.target.value })}
              />
            </div>
            <div className="col-span-1">
              <label className="block text-amber-50 font-bold mb-2">Код галузі:</label>
              <input
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={specialty.area_code}
                onChange={(e) => updateSpecialty({ area_code: e.target.value })}
              />
            </div>
            <div className="col-span-1">
              <label className="block text-amber-50 font-bold mb-2">Галузь:</label>
              <input
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={specialty.area}
                onChange={(e) => updateSpecialty({ area: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-amber-50 font-bold mb-2">Кваліфікація:</label>
              <input
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={specialty.qualification}
                onChange={(e) => updateSpecialty({ qualification: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <h2 className="font-mono">Результати навчання</h2>
          <div className="flex items-center gap-3">
            {specialty.id >= 0 && <button
              onClick={() => navigate(`/specialties/${specialty.id}/results/new`)}
              className="text-amber-50 hover:text-amber-200 cursor-pointer px-2 py-2 rounded-lg font-bold flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>}
          </div>
        </div>



        {isLoading ? (
          <div className="text-amber-50 font-mono">Завантаження...</div>
        ) : items.length === 0 ? (
          <div className="text-amber-50 font-mono">Немає результатів для цієї спеціальності</div>
        ) : (
          <div className="flex flex-col gap-6">
            <h2 className="text-amber-200 font-bold text-xl font-mono border-b-2 border-amber-50 pb-2">
              {specialty.code ? `${specialty.code} - ` : ""}{specialty.name} ({specialty.area})
            </h2>
            {(["ЗК", "СК", "РН"] as const).map(type => {
              const results = groupedResults[type];
              if (!results || results.length === 0) return null;

              return (
                <div key={type} className="flex flex-col gap-3">
                  <h3 className="text-amber-200 font-bold text-lg font-mono">
                    {RESULT_TYPES[type]}
                  </h3>
                  <ul className="flex flex-col gap-3">
                    {results.map(result => (
                      <li key={result.id} className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-3 text-amber-50 font-mono flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-amber-200">{result.no}.</span>
                            <span className="font-bold">{result.name}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
            <button 
                              onClick={() => navigate(`/specialties/${specialty.id}/results/${result.id}`)} 
                              className="text-amber-50 hover:text-amber-200 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                              aria-label="Редагувати результат"
                              title="Редагувати результат"
                            >
                             <FontAwesomeIcon icon={faPen} />
                           </button>
                          <button 
                            onClick={() => handleDelete(result)} 
                            className="text-amber-50 hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                            aria-label="Видалити результат"
                            title="Видалити результат"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}