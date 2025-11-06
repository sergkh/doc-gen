import type { CourseResult } from "@/stores/models";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadResult, upsertResult } from "../results";

export default function ResultEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<CourseResult | null>(null);

  useEffect(() => {
    loadResult(id || "new").then(setItem).catch(console.error);
  }, [id]);

  const update = (json: Partial<CourseResult>) => {
    if (!item) return;
    setItem({ ...item, ...json } as CourseResult);
  };

  const handleSave = async () => {
    if (!item || !isValid) return;
    try {
      await upsertResult(item);
      navigate("/results");
    } catch (error) {
      console.error("Error saving result:", error);
      alert("Не вдалося зберегти результат");
    }
  };

  const isValid = useMemo(() => {
    if (!item) return false;
    return item.name.trim() !== "" && item.type !== "" && item.no > 0;
  }, [item]);

  if (!item) {
    return (
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-[#fbf0df] font-mono">Результат не знайдено</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <h1 className="font-mono">{item.id >= 0 ? "Редагувати результат" : "Додати результат"}</h1>

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Тип:</label>
              <select
                className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.type}
                onChange={(e) => update({ type: e.target.value })}
              >
                <option value="ЗК">ЗК - Загальні компетентності</option>
                <option value="СК">СК - Спеціальні компетентності</option>
                <option value="РН">РН - Результати навчання</option>
              </select>
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Номер:</label>
              <input
                type="number"
                min="1"
                className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.no || ""}
                onChange={(e) => update({ no: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Назва:</label>
              <textarea
                rows={4}
                className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white resize-y"
                value={item.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="Введіть назву результату"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!isValid}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
            >
              Зберегти
            </button>
            <button
              onClick={() => navigate("/results")}
              className="bg-gray-600 hover:bg-gray-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
            >
              Скасувати
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}




