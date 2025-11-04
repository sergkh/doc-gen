import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen } from "@fortawesome/free-solid-svg-icons";
import type { Course } from "@/stores/models";
import { loadAllCourses } from "../courses";

export default function CoursesList() {
  const navigate = useNavigate();

  const [items, setItems] = useState<Course[]>([]);

  useEffect(() => {
    loadAllCourses().then(setItems).catch(console.error);
  }, []);


  const handleDelete = (course: Course) => {
    // const updated = deleteCourse(id);
    // setItems(updated);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        <h1 className="font-mono">Дисципліни</h1>

        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate("/courses/new")}
            className="bg-green-600 hover:bg-green-700 text-white border-0 px-4 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} /> Додати дисципліну
          </button>
        </div>


        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <div className="text-[#fbf0df] font-mono">Немає дисциплін</div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map(d => (
                <li key={d.id} className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-bold">{d.name}</div>
                    <div className="text-sm opacity-80">Автор: {d.teacher ?? d.teacher_id}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/courses/${d.id}`)} className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-3 py-1 rounded-lg font-bold">
                      <FontAwesomeIcon icon={faPen} /> Редагувати
                    </button>
                    <button onClick={() => handleDelete(d)} className="bg-red-600 hover:bg-red-700 text-white border-0 px-3 py-1 rounded-lg font-bold">
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


