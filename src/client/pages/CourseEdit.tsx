import type { Course, Teacher, CourseTopic } from "@/stores/models";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faTimes } from "@fortawesome/free-solid-svg-icons";
import { loadCourse, upsertCourse } from "../courses";
import { loadAllTeachers } from "../teachers";

export default function CourseEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Course | null>(null);
  const [teachers, setTeachers] = useState([] as Teacher[]);
  const [topics, setTopics] = useState<CourseTopic[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingTopic, setEditingTopic] = useState<CourseTopic | null>(null);
  const [topicName, setTopicName] = useState("");
  const [topicLection, setTopicLection] = useState("");

  useEffect(() => { loadCourse(id || "new").then(setItem).catch(console.error); }, [id]);
  useEffect(() => { loadAllTeachers().then(setTeachers).catch(console.error); }, []);

  useEffect(() => {
    if (item?.id) fetchTopics(item.id);
  }, [item?.id]);

  const fetchTopics = async (courseId: number) => {
    try {
      const response = await fetch(`/api/courses/${courseId}/topics`);
      if (response.ok) {
        const data = await response.json() as CourseTopic[];
        setTopics(data);
      }
    } catch (error) {
      console.error("Error fetching topics:", error);
    }
  };

  const handleAddTopic = () => {
    if (!item?.id) return;
    setEditingTopic({
      id: 0,
      course_id: item.id,
      index: topics.length + 1,
      name: "",
      lection: "",
      generated: null
    });
    setTopicName("");
    setTopicLection("");
  };

  const handleEditTopic = (topic: CourseTopic) => {
    setEditingTopic(topic);
    setTopicName(topic.name || "");
    setTopicLection(topic.lection || "");
  };

  const handleCancelEdit = () => {
    setEditingTopic(null);
    setTopicName("");
    setTopicLection("");
  };

  const handleSaveTopic = async () => {
    if (!item?.id || !editingTopic) return;
    if (!topicName.trim() || !topicLection.trim()) {
      alert("Назва та текст лекції обов'язкові");
      return;
    }

    try {
      const topicData: CourseTopic = {
        ...editingTopic,
        name: topicName.trim(),
        lection: topicLection.trim(),
      };

      let response;
      if (editingTopic.id === 0) {
        // Create new topic
        response = await fetch(`/api/courses/${item.id}/topics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(topicData),
        });
      } else {
        // Update existing topic
        response = await fetch(`/api/courses/${item.id}/topics/${editingTopic.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(topicData),
        });
      }

      if (response.ok) {
        await fetchTopics(item.id);
        handleCancelEdit();
      } else {
        throw new Error("Failed to save topic");
      }
    } catch (error) {
      console.error("Error saving topic:", error);
      alert("Не вдалося зберегти тему");
    }
  };

  const handleDeleteTopic = async (topicId: number) => {
    if (!item?.id) return;
    if (!confirm("Ви впевнені, що хочете видалити цю тему?")) return;

    try {
      const response = await fetch(`/api/courses/${item.id}/topics/${topicId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchTopics(item.id);
      } else {
        throw new Error("Failed to delete topic");
      }
    } catch (error) {
      console.error("Error deleting topic:", error);
      alert("Не вдалося видалити тему");
    }
  };

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

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[#fbf0df] font-bold text-lg">Теми курсу:</h2>
            <button
              onClick={handleAddTopic}
              className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-3 py-1.5 rounded-lg font-bold flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faPlus} /> Додати тему
            </button>
          </div>

          {topics.length === 0 ? (
            <div className="text-[#fbf0df] opacity-60">Немає тем</div>
          ) : (
            <ul className="flex flex-col gap-3">
              {topics.map((topic) => (
                <li
                  key={topic.id}
                  className="bg-[#2a2a2a] border border-[#fbf0df] rounded-lg p-3 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-bold text-[#f3d5a3] mb-1">
                        {topic.index}. {topic.name || `Тема ${topic.index}`}
                      </div>
                      <div className="text-sm text-[#fbf0df] opacity-80 whitespace-pre-wrap">
                        {topic.lection}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEditTopic(topic)}
                        className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-3 py-1 rounded-lg font-bold flex items-center gap-1"
                      >
                        <FontAwesomeIcon icon={faPen} size="xs" /> Редагувати
                      </button>
                      <button
                        onClick={() => handleDeleteTopic(topic.id)}
                        className="bg-red-600 hover:bg-red-700 text-white border-0 px-3 py-1 rounded-lg font-bold flex items-center gap-1"
                      >
                        <FontAwesomeIcon icon={faTrash} size="xs" /> Видалити
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {editingTopic && (
            <div className="bg-[#2a2a2a] border-2 border-[#f3d5a3] rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[#fbf0df] font-bold">
                  {editingTopic.id === 0 ? "Додати тему" : "Редагувати тему"}
                </h3>
                <button
                  onClick={handleCancelEdit}
                  className="text-[#fbf0df] hover:text-white"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div>
                <label className="block text-[#fbf0df] font-bold mb-2">Назва теми:</label>
                <input
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  placeholder="Введіть назву теми"
                />
              </div>
              <div>
                <label className="block text-[#fbf0df] font-bold mb-2">Текст лекції:</label>
                <textarea
                  rows={5}
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
                  value={topicLection}
                  onChange={(e) => setTopicLection(e.target.value)}
                  placeholder="Введіть текст лекції"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveTopic}
                  className="bg-green-600 hover:bg-green-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
                >
                  Зберегти
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="bg-gray-600 hover:bg-gray-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
                >
                  Скасувати
                </button>
              </div>
            </div>
          )}
        </div>

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
