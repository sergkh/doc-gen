import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen } from "@fortawesome/free-solid-svg-icons";
import type { Course } from "./courses";
import { loadCourses, saveCourses, deleteCourse } from "./courses";

export default function CoursesList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Course[]>([]);
  const [title, setTitle] = useState("");
  const [credits, setCredits] = useState("");
  const [hours, setHours] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [author, setAuthor] = useState("");

  useEffect(() => {
    setItems(loadCourses());
  }, []);

  useEffect(() => {
    saveCourses(items);
  }, [items]);

  const isValid = useMemo(() => {
    return (
      title.trim() &&
      author.trim() &&
      specialty.trim() &&
      Number.isFinite(Number(credits)) &&
      Number.isFinite(Number(hours))
    );
  }, [title, author, specialty, credits, hours]);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    const id = crypto.randomUUID();
    const item: Course = {
      id,
      title: title.trim(),
      credits: Number(credits),
      hours: Number(hours),
      specialty: specialty.trim(),
      author: author.trim(),
    };
    setItems([...
      items,
      item
    ]);
    setTitle("");
    setCredits("");
    setHours("");
    setSpecialty("");
    setAuthor("");
  };

  const handleDelete = (id: string) => {
    const updated = deleteCourse(id);
    setItems(updated);
  };

  return (
    <div className="max-w-7xl mx-auto text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        <h1 className="font-mono">Курси</h1>

        <form onSubmit={handleAdd} className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Назва:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Введіть назву" />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Кредити:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="к-ть кредитів" />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Години:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={hours} onChange={(e) => setHours(e.target.value)} placeholder="к-ть годин" />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Спеціальність:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Введіть спеціальність" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Автор:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Введіть автора" />
            </div>
          </div>
          <button type="submit" disabled={!isValid}
            className="self-start bg-[#fbf0df] text-[#1a1a1a] border-0 px-4 py-1.5 rounded-lg font-bold transition-all duration-100 disabled:bg-gray-500">
            <FontAwesomeIcon icon={faPlus} /> Додати
          </button>
        </form>

        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <div className="text-[#fbf0df] font-mono">Немає курсів</div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map(d => (
                <li key={d.id} className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-bold">{d.title}</div>
                    <div className="text-sm opacity-80">Кредити: {d.credits}, Години: {d.hours}, Спец.: {d.specialty}, Автор: {d.author}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/courses/${d.id}`)} className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-3 py-1 rounded-lg font-bold">
                      <FontAwesomeIcon icon={faPen} /> Редагувати
                    </button>
                    <button onClick={() => handleDelete(d.id)} className="bg-red-600 hover:bg-red-700 text-white border-0 px-3 py-1 rounded-lg font-bold">
                      <FontAwesomeIcon icon={faTrash} /> Видалити
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


