import type { Teacher, TeacherPosition, AcademicTitle, TeacherPublication, Course } from "@/stores/models";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadTeacher, upsertTeacher } from "../teachers";
import { loadAllCourses } from "../courses";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTimes, faSyncAlt, faBook, faExternalLinkAlt, faGraduationCap } from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";

const POSITIONS: TeacherPosition[] = ["аспірант", "асистент", "старший викладач", "доцент", "професор"];
const ACADEMIC_TITLES: (AcademicTitle)[] = ["кандидат технічних наук", "кандидат економічних наук", "PhD економічних наук", "доктор економічних наук", "доктор технічних наук"];

export default function TeacherEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Teacher | null>(null);
  const [altNamesInput, setAltNamesInput] = useState<string>("");
  const [publications, setPublications] = useState<TeacherPublication[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingPublications, setIsLoadingPublications] = useState(false);

  useEffect(() => {
    loadTeacher(id || "new").then(teacher => {
      setItem(teacher);
      setAltNamesInput(teacher.alt_names?.join(", ") || "");
    }).catch(console.error);
  }, [id]);

  useEffect(() => {
    if (!item?.id || item.id < 0) return;
    
    const fetchCourses = async () => {
      try {
        const allCourses = await loadAllCourses();
        const teacherCourses = allCourses.filter(c => c.teacher_id === item.id);
        setCourses(teacherCourses);
      } catch (error) {
        console.error("Error fetching courses:", error);
      }
    };
    
    fetchCourses();
  }, [item?.id]);

  useEffect(() => {
    if (!item?.id) return;
    
    const fetchPublications = async () => {
      setIsLoadingPublications(true);
      try {
        const response = await fetch(`/api/teachers/${item.id}/publications`);
        if (response.ok) {
          const data = await response.json();
          setPublications(data);
        }
      } catch (error) {
        console.error("Error fetching publications:", error);
      } finally {
        setIsLoadingPublications(false);
      }
    };
    
    fetchPublications();
  }, [item?.id]);

  const update = (json: Partial<Teacher>) => {
    if (!item) return;
    setItem({ ...item, ...json } as Teacher);
  };

  const handleAltNamesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAltNamesInput(value);
    update({ alt_names: value.split(",").map(name => name.trim()).filter(name => name.length > 0) });
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

  const handleRefreshPublications = async () => {
    if (!item || !item.id) return;
    
    try {
      const response = await fetch(`/api/teachers/${item.id}/refresh-publications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Не вдалося оновити публікації");
      }
      
      const data = await response.json();
      toast.success(`Успішно оновлено ${data.count} публікацій`);
    } catch (error) {
      console.error("Error refreshing publications:", error);
      toast.error(error instanceof Error ? error.message : "Сталася помилка при оновленні публікацій");
    }
  };

  const isValid = useMemo(() => {
    if (!item) return false;
    return item.name.trim() !== "" && (item.email === null || item.email?.trim() === "" || item.email?.includes("@"));
  }, [item]);

  if (!item) {
    return (
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-amber-50 font-mono">Викладач не знайдено</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="font-mono">{item.id >= 0 ? "Редагувати викладача" : "Додати викладача"}</h1>

           <div className="flex gap-2">
             <button
               onClick={handleSave}
               disabled={!isValid}
               className="text-amber-50 hover:text-green-400 hover:opacity-100 transition-opacity p-1.5 rounded disabled:opacity-30 cursor-pointer"
             >
               <FontAwesomeIcon icon={faCheck} />
             </button>
             <button
               onClick={() => navigate("/teachers")}
               className="text-amber-50 hover:text-red-400 cursor-pointer"
             >
               <FontAwesomeIcon icon={faTimes} />
             </button>
             {item.id && (
               <button
                 onClick={handleRefreshPublications}
                 className="text-amber-50 hover:text-blue-400 cursor-pointer p-1.5 rounded"
                 title="Оновити публікації з репозиторію"
               >
                 <FontAwesomeIcon icon={faSyncAlt} />
               </button>
             )}
           </div>
        </div>

        <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-3 font-mono flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-amber-50 font-bold mb-2">Ім'я:</label>
              <input
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-amber-50 font-bold mb-2">Email:</label>
              <input
                type="email"
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.email ?? ""}
                onChange={(e) => update({ email: e.target.value || null })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-amber-50 font-bold mb-2">Посада:</label>
              <select
                className="w-full bg-zinc-900 border-2 border-amber-50 rounded-lg px-3 py-2 text-amber-50 font-mono focus:outline-none focus:ring-2 focus:ring-amber-200"
                value={item.position ?? ""}
                onChange={(e) => update({ position: e.target.value === "" ? null : e.target.value as TeacherPosition })}
              >
                <option value="">Не вказано</option>
                {POSITIONS.map(position => (
                  <option key={position} value={position}>{position}</option>
                ))}
              </select>
            </div>
             <div className="col-span-2">
               <label className="block text-amber-50 font-bold mb-2">Вчене звання:</label>
               <select
                 className="w-full bg-zinc-900 border-2 border-amber-50 rounded-lg px-3 py-2 text-amber-50 font-mono focus:outline-none focus:ring-2 focus:ring-amber-200"
                 value={item.academic_title ?? ""}
                 onChange={(e) => update({ academic_title: e.target.value === "" ? null : e.target.value as AcademicTitle })}
               >
                 <option value="">Не вказано</option>
                 {ACADEMIC_TITLES.filter(title => title !== null).map(title => (
                   <option key={title} value={title}>{title}</option>
                 ))}
               </select>
             </div>
              <div className="col-span-2">
                <label className="block text-amber-50 font-bold mb-2">Варіанти імені для пошуку літератури (через кому):</label>
                <input
                  className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder:text-zinc-600"
                  value={altNamesInput}
                  onChange={handleAltNamesChange}
                  placeholder="Прізвище І.Б., Прізвище І. Б., Прізвище Ініціали"
                />
               </div>
          </div>
        </div>
        
        {item.id && courses.length > 0 && (
          <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-3 font-mono flex flex-col gap-3 mt-4">
            <h2 className="text-amber-50 font-bold text-lg flex items-center gap-2">
              <FontAwesomeIcon icon={faGraduationCap} />
              Дисципліни
            </h2>
            <div className="flex flex-col gap-2">
              {courses.map((course) => (
                <a
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="text-amber-50 hover:text-amber-300 text-sm flex items-center gap-2"
                >
                  <span>{course.data.ok_no ? `ОК${course.data.ok_no}. ` : ''}{course.name}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {item.id && (
          <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-3 font-mono flex flex-col gap-3 mt-4">
            <h2 className="text-amber-50 font-bold text-lg flex items-center gap-2">
              <FontAwesomeIcon icon={faBook} />
              Публікації
            </h2>
            
            {isLoadingPublications ? (
              <div className="text-amber-50/70 text-sm">Завантаження публікацій...</div>
            ) : publications.length === 0 ? (
              <div className="text-amber-50/70 text-sm">
                Немає публікацій. Натисніть кнопку оновлення, щоб завантажити публікації з репозиторію.
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
                {publications.map((pub) => (
                  <div key={pub.id} className="bg-zinc-800 border border-amber-50/20 rounded-lg p-3 flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="text-amber-50 font-bold text-sm">{pub.title}</div>
                        <div className="text-amber-50/70 text-xs mt-1">
                          {pub.year && <span>{pub.year} • </span>}
                          {pub.publication_type && <span>{pub.publication_type}</span>}
                          {pub.journal && <span> • {pub.journal}</span>}
                        </div>
                        {pub.data?.authors && (
                          <div className="text-amber-50/60 text-xs mt-1">
                            Автори: {pub.data.authors.join(", ")}
                          </div>
                        )}
                      </div>
                      {pub.link && (
                        <a
                          href={pub.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-50 hover:text-amber-300 text-lg"
                          title="Відкрити публікацію"
                        >
                          <FontAwesomeIcon icon={faExternalLinkAlt} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
