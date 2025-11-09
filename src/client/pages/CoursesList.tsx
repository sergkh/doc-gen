import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen } from "@fortawesome/free-solid-svg-icons";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import type { Course, ParsingType } from "@/stores/models";
import { loadAllCourses, deleteCourse } from "../courses";

export default function CoursesList() {
  const navigate = useNavigate();

  const [items, setItems] = useState<Course[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadAllCourses().then(setItems).catch(console.error);
  }, []);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    const uploadPromise = (async () => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/courses/parse-docx", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process syllabus");
      }

      const course = await response.json() as Course & ParsingType;

      toast.success(`Файл ${course.type === 'syllabus' ? "cилабуса" : "програми"} успішно оброблено`);

      return course;
    })();

    toast.promise(uploadPromise, {
      loading: "Завантаження та обробка файлу...",
      error: "Не вдалося обробити файл syllabus",
    });

    try {
      const course = await uploadPromise;
      // Navigate to edit page after successful upload
      if (course.id) {
        navigate(`/courses/${course.id}`);
      }
    } catch (error) {
      console.error("Error uploading syllabus:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    disabled: isUploading,
    onDropRejected: () => {
      toast.error("Будь ласка, перетягніть файл .docx");
    }
  });


  const handleDelete = async (course: Course) => {
    if (!confirm(`Ви впевнені, що хочете видалити дисципліну "${course.name}"?`)) {
      return;
    }

    try {
      await deleteCourse(course.id);
      setItems(items.filter(c => c.id !== course.id));
      toast.success("Дисципліну успішно видалено");
    } catch (error) {
      console.error("Error deleting course:", error);
      toast.error("Не вдалося видалити дисципліну");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h1 className="font-mono">Дисципліни</h1>
          <button
            onClick={() => navigate("/courses/new")}
            className="text-[#fbf0df] hover:text-[#f3d5a3] px-4 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} />
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
                    <button 
                      onClick={() => navigate(`/courses/${d.id}`)} 
                      className="text-[#fbf0df] hover:text-[#f3d5a3] opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Редагувати дисципліну"
                      title="Редагувати дисципліну"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button 
                      onClick={() => handleDelete(d)} 
                      className="text-[#fbf0df] hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Видалити дисципліну"
                      title="Видалити дисципліну"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono">
          <label className="block text-[#fbf0df] font-bold mb-2">Створити з Силабуса чи Робочої програми (.docx):</label>
          <div
            {...getRootProps()}
            className={`border-2 ${isDragActive ? "border-[#f3d5a3] border-dashed bg-[#2a2a2a]" : "border-transparent"} rounded-lg p-4 text-center transition-colors duration-200 ${isUploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
          >
            <input {...getInputProps()} />
            {isUploading ? (<span className="text-[#fbf0df]">Завантаження...</span>) : (
              <span className="text-[#fbf0df]">
                {isDragActive ? "Відпустіть файл тут" : "Перетягніть файл .docx або натисніть для вибору"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


