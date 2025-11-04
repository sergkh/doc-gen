import type { Teacher } from "@/stores/models";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadTeacher, upsertTeacher } from "../teachers";

export default function TeacherEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Teacher | null>(null);

  useEffect(() => {
    loadTeacher(id || "new").then(setItem).catch(console.error);
  }, [id]);

  const update = (json: Partial<Teacher>) => {
    if (!item) return;
    setItem({ ...item, ...json } as Teacher);
  };

  const handleSave = async () => {
    if (!item || !isValid) return;
    try {
      await upsertTeacher(item);
      navigate("/teachers");
    } catch (error) {
      console.error("Error saving teacher:", error);
      alert("Не вдалося зберегти викладача");
    }
  };

  const isValid = useMemo(() => {
    if (!item) return false;
    return item.name.trim() !== "" && item.email.trim() !== "" && item.email.includes("@");
  }, [item]);

  if (!item) {
    return (
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-[#fbf0df] font-mono">Викладач не знайдено</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <h1 className="font-mono">{item.id >= 0 ? "Редагувати викладача" : "Додати викладача"}</h1>

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Ім'я:</label>
              <input
                className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Email:</label>
              <input
                type="email"
                className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.email}
                onChange={(e) => update({ email: e.target.value })}
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
              onClick={() => navigate("/teachers")}
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

