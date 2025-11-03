import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Course } from "./courses";
import { loadCourses, upsertCourse } from "./courses";

export default function CourseEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Course | null>(null);

  useEffect(() => {
    const items = loadCourses();
    const found = items.find(d => d.id === id);
    if (found) setItem(found);
  }, [id]);

  const isValid = useMemo(() => {
    if (!item) return false;
    return (
      item.title.trim() &&
      item.author.trim() &&
      item.specialty.trim() &&
      Number.isFinite(Number(item.credits)) &&
      Number.isFinite(Number(item.hours))
    );
  }, [item]);

  const handleChange = (key: keyof Course, value: string) => {
    if (!item) return;
    if (key === "credits" || key === "hours") {
      setItem({ ...item, [key]: Number(value) as any });
    } else {
      setItem({ ...item, [key]: value } as Course);
    }
  };

  const handleSave = () => {
    if (!item || !isValid) return;
    upsertCourse(item);
    navigate("/courses");
  };

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
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Назва:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.title} onChange={(e) => handleChange("title", e.target.value)} />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Кредити:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={String(item.credits)} onChange={(e) => handleChange("credits", e.target.value)} />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Години:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={String(item.hours)} onChange={(e) => handleChange("hours", e.target.value)} />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Спеціальність:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.specialty} onChange={(e) => handleChange("specialty", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Автор:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.author} onChange={(e) => handleChange("author", e.target.value)} />
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


