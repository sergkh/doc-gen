import type { Course, Teacher, ShortCourseInfo } from "@/stores/models";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { loadCourse, upsertCourse, loadAllCourses } from "../courses";
import { loadAllTeachers } from "../teachers";
import CourseTopicsEditor from "../components/CourseTopicsEditor";

export default function CourseEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Course | null>(null);
  const [teachers, setTeachers] = useState([] as Teacher[]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [prerequisiteInfos, setPrerequisiteInfos] = useState<ShortCourseInfo[]>([]);
  const [postrequisiteInfos, setPostrequisiteInfos] = useState<ShortCourseInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => { loadCourse(id || "new").then(setItem).catch(console.error); }, [id]);
  useEffect(() => { loadAllTeachers().then(setTeachers).catch(console.error); }, []);
  useEffect(() => { loadAllCourses().then(setAllCourses).catch(console.error); }, []);

  // Load prerequisite and postrequisite info when item or prerequisites/postrequisites change
  useEffect(() => {
    if (!item || !item.id || item.id < 0) {
      setPrerequisiteInfos([]);
      setPostrequisiteInfos([]);
      return;
    }

    // Since we have allCourses, we can filter them
    const prereqInfos = allCourses
      .filter(c => item.data.prerequisites.includes(c.id))
      .map(c => ({ id: c.id, name: c.name, teacher: c.teacher || "" }));
    setPrerequisiteInfos(prereqInfos);

    const postreqInfos = allCourses
      .filter(c => item.data.postrequisites.includes(c.id))
      .map(c => ({ id: c.id, name: c.name, teacher: c.teacher || "" }));
    setPostrequisiteInfos(postreqInfos);
  }, [item?.data.prerequisites, item?.data.postrequisites, allCourses, item?.id]);

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

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      const isDocxFile = 
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName.endsWith(".docx");

      if (isDocxFile) {
        await handleFileUpload(file);
      } else {
        alert("Будь ласка, перетягніть файл .docx");
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/courses/from-sylabus", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process syllabus");
      }

      const course = await response.json() as Course;
      setItem(course);
    } catch (error) {
      console.error("Error uploading syllabus:", error);
      alert("Не вдалося обробити файл syllabus");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleAddPrerequisite = (courseId: string) => {
    if (!item || !courseId) return;
    const id = Number(courseId);
    if (item.data.prerequisites.includes(id)) return;
    
    const newPrerequisites = [...item.data.prerequisites, id];
    updateData({ prerequisites: newPrerequisites });
  };

  const handleRemovePrerequisite = (courseId: number) => {
    if (!item) return;
    const newPrerequisites = item.data.prerequisites.filter(id => id !== courseId);
    updateData({ prerequisites: newPrerequisites });
  };

  const handleAddPostrequisite = (courseId: string) => {
    if (!item || !courseId) return;
    const id = Number(courseId);
    if (item.data.postrequisites.includes(id)) return;
    
    const newPostrequisites = [...item.data.postrequisites, id];
    updateData({ postrequisites: newPostrequisites });
  };

  const handleRemovePostrequisite = (courseId: number) => {
    if (!item) return;
    const newPostrequisites = item.data.postrequisites.filter(id => id !== courseId);
    updateData({ postrequisites: newPostrequisites });
  };

  // Get available courses for selection (exclude current course and already selected ones)
  const getAvailableCoursesForPrerequisites = () => {
    if (!item) return [];
    return allCourses.filter(c => 
      c.id !== item.id && 
      c.id >= 0 && 
      !item.data.prerequisites.includes(c.id)
    );
  };

  const getAvailableCoursesForPostrequisites = () => {
    if (!item) return [];
    return allCourses.filter(c => 
      c.id !== item.id && 
      c.id >= 0 && 
      !item.data.postrequisites.includes(c.id)
    );
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
                value={String(item.data.credits || "")} onChange={(e) => updateData({credits: Number(e.target.value) || 0})} />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Години:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={String(item.data.hours || "")} onChange={(e) => updateData({hours: Number(e.target.value) || 0})} />
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
              <label className="block text-[#fbf0df] font-bold mb-2">Передумови:</label>
              <div className="flex flex-col gap-2">
                {item.data.prerequisites.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {prerequisiteInfos.map((prereq) => (
                      <div
                        key={prereq.id}
                        className="bg-[#2a2a2a] border border-[#fbf0df] rounded-lg px-3 py-1.5 flex items-center gap-2"
                      >
                        <span className="text-[#fbf0df] font-mono text-sm">{prereq.name}</span>
                        <button
                          onClick={() => handleRemovePrerequisite(prereq.id)}
                          className="bg-gray-600 hover:bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
                          aria-label="Видалити передумову"
                        >
                          <FontAwesomeIcon icon={faTimes} size="xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <select
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddPrerequisite(e.target.value);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">-- Додати передумову --</option>
                  {getAvailableCoursesForPrerequisites().map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Залежні дисципліни:</label>
              <div className="flex flex-col gap-2">
                {item.data.postrequisites.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {postrequisiteInfos.map((postreq) => (
                      <div
                        key={postreq.id}
                        className="bg-[#2a2a2a] border border-[#fbf0df] rounded-lg px-3 py-1.5 flex items-center gap-2"
                      >
                        <span className="text-[#fbf0df] font-mono text-sm">{postreq.name}</span>
                        <button
                          onClick={() => handleRemovePostrequisite(postreq.id)}
                          className="bg-gray-600 hover:bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
                          aria-label="Видалити наступний курс"
                        >
                          <FontAwesomeIcon icon={faTimes} size="xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <select
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddPostrequisite(e.target.value);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">-- Додати наступний курс --</option>
                  {getAvailableCoursesForPostrequisites().map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
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

        {item?.id && <CourseTopicsEditor courseId={item.id} />}

        <div 
          onDrop={handleFileDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`bg-[#1a1a1a] border-2 ${isDragging ? "border-[#f3d5a3] border-dashed" : "border-[#fbf0df]"} rounded-xl p-3 font-mono transition-colors duration-200`}
        >
          <label className="block text-[#fbf0df] font-bold mb-2">Завантажити з Силабуса (.docx):</label>
          <div className={`border-2 ${isDragging ? "border-[#f3d5a3] border-dashed bg-[#2a2a2a]" : "border-transparent"} rounded-lg p-4 text-center transition-colors duration-200`}>
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileSelect}
              className="hidden"
              id="syllabus-upload"
              disabled={isUploading}
            />
            <label
              htmlFor="syllabus-upload"
              className={`cursor-pointer block ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isUploading ? (
                <span className="text-[#fbf0df]">Завантаження...</span>
              ) : (
                <span className="text-[#fbf0df]">
                  {isDragging ? "Відпустіть файл тут" : "Перетягніть файл .docx або натисніть для вибору"}
                </span>
              )}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
