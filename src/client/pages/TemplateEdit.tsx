import type { Template } from "@/stores/models";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { loadTemplate, upsertTemplate } from "../templates";
import toast from "react-hot-toast";

export default function TemplateEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Template | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadTemplate(id || "new").then(setItem).catch(console.error);
  }, [id]);

  const update = (json: Partial<Template>) => {
    if (!item) return;
    setItem({ ...item, ...json } as Template);
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        handleFileSelect(file);
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

  const handleSave = async () => {
    if (!item || !isValid) return;
    
    setIsUploading(true);
    try {
      // For new templates, file is required
      if (item.id < 0 && !selectedFile) {
        alert("Будь ласка, виберіть файл");
        setIsUploading(false);
        return;
      }

      await upsertTemplate(item, selectedFile || undefined);
      navigate("/templates");
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Не вдалося зберегти шаблон");
    } finally {
      setIsUploading(false);
    }
  };

  const isValid = useMemo(() => {
    if (!item) return false;
    const hasName = item.name.trim() !== "";
    // For new templates, file is required. For existing ones, file is optional (can update name only)
    const hasFile = item.id < 0 ? selectedFile !== null : true;
    return hasName && hasFile;
  }, [item, selectedFile]);

  if (!item) {
    return (
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-[#fbf0df] font-mono">Шаблон не знайдено</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <h1 className="font-mono">{item.id >= 0 ? "Редагувати шаблон" : "Додати шаблон"}</h1>

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Назва:</label>
              <input
                className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">
                Файл {item.id < 0 ? "(обов'язково)" : "(за бажанням)"}:
              </label>
              <div
                {...getRootProps()}
                className={`border-2 ${isDragActive ? "border-[#f3d5a3] border-dashed bg-[#2a2a2a]" : "border-[#fbf0df]"} rounded-lg p-4 text-center transition-colors duration-200 ${isUploading ? "opacity-50 pointer-events-none" : "cursor-pointer hover:border-[#f3d5a3]"}`}
              >
                <input {...getInputProps()} />
                {isUploading ? (
                  <span className="text-[#fbf0df]">Завантаження...</span>
                ) : (
                  <div className="flex flex-col gap-2">
                    <span className="text-[#fbf0df]">
                      {isDragActive ? "Відпустіть файл тут" : "Перетягніть файл .docx або натисніть для вибору"}
                    </span>
                    {selectedFile && (
                      <div className="text-sm text-[#fbf0df] opacity-80 mt-2">
                        Вибрано: {selectedFile.name}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!isValid || isUploading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
            >
              {isUploading ? "Збереження..." : "Зберегти"}
            </button>
            <button
              onClick={() => navigate("/templates")}
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

