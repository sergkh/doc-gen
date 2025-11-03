import type { Course, Teacher } from "@/stores/models";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadCourse, upsertCourse } from "../courses";
import { loadAllTeachers } from "../teachers";

export default function CourseEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Course | null>(null);
  const [teachers, setTeachers] = useState([] as Teacher[]);

  useEffect(() => { loadCourse(id || "new").then(setItem).catch(console.error); }, [id]);
  useEffect(() => { loadAllTeachers().then(setTeachers).catch(console.error); }, []);

  const update = (json: any) => {
    if (!item) return;
    setItem({ ...item, ...json } as Course);
  }

  const updateData = (json: any) => {
    if (!item) return;
    const data = { ...item.data, ...json };
    setItem({ ...item, data } as Course);
  }

  const handleSave = async () => {
    if (!item || !isValid) return;
    await upsertCourse(item);
    navigate("/courses");
  };

  const isValid = useMemo(() => {
    if (!item) return false;
    return item.name.trim() !== "" && item.data.credits > 0 && item.data.hours > 0 && item.data.specialty.trim() !== "";
  }, [item]);

  if (!item) {
    return (
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-[#fbf0df] font-mono">Курс не знайдено</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <h1 className="font-mono">Редагувати курс</h1>

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Назва:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.name} onChange={(e) => update({name: e.target.value})} />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Кредити:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={String(item.data.credits)} onChange={(e) => updateData({credits: e.target.value})} />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Години:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={String(item.data.hours)} onChange={(e) => updateData({hours: e.target.value})} />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Спеціальність:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.data.specialty} onChange={(e) => updateData({specialty: e.target.value})} />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Напрям:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.data.area} onChange={(e) => updateData({area: e.target.value})} />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Викладач:</label>
              <select
                className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.teacher_id}
                onChange={e => update({teacher_id: e.target.value})}
              >
                <option value="">-- Виберіть викладача --</option>
                { teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>) }
              </select>              
            </div>
            <div className="col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Додатковий опис:</label>
              <textarea rows={5} className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.data.description} onChange={(e) => updateData({description: e.target.value})} />
            </div>            
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!isValid}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white border-0 px-4 py-1.5 rounded-lg font-bold">
              Зберегти
            </button>
            <button onClick={() => navigate("/courses")}
              className="bg-gray-600 hover:bg-gray-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold">
              Скасувати
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
