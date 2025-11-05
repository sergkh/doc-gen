import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faUpload } from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";
import type { CourseResult } from "@/stores/models";
import { loadAllResults, deleteResult, uploadResultsFromDocx } from "../results";

const RESULT_TYPES = {
  "ЗК": "Загальні компетентності",
  "СК": "Спеціальні компетентності",
  "РН": "Результати навчання"
};

export default function ResultsList() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<CourseResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadAllResults().then(setItems).catch(console.error);
  }, []);

  const groupedResults = useMemo(() => {
    const grouped: Record<string, CourseResult[]> = {
      "ЗК": [],
      "СК": [],
      "РН": []
    };

    items.forEach(result => {
      const group = grouped[result.type];
      if (group) {
        group.push(result);
      }
    });

    // Sort each group by 'no'
    Object.keys(grouped).forEach(type => {
      const group = grouped[type];
      if (group) {
        group.sort((a, b) => a.no - b.no);
      }
    });

    return grouped;
  }, [items]);

  const handleDelete = async (result: CourseResult) => {
    if (!confirm(`Ви впевнені, що хочете видалити результат "${result.name}"?`)) {
      return;
    }

    toast.promise(deleteResult(result.id), {
      loading: "Видалення результату...",
      success: () => {
        setItems(items.filter(r => r.id !== result.id));
        return "Результат успішно видалено";
      },
      error: "Не вдалося видалити результат",
    });
  };

  const processFile = async (file: File) => {
    // Validate file type
    if (!file.name.toLowerCase().endsWith(".docx")) {
      toast.error("Будь ласка, виберіть файл .docx");
      return;
    }

    setIsUploading(true);
    const uploadPromise = (async () => {
      const uploadedResults = await uploadResultsFromDocx(file);
      // Reload all results to show the newly uploaded ones
      const allResults = await loadAllResults();
      setItems(allResults);
      return uploadedResults;
    })();

    toast.promise(uploadPromise, {
      loading: "Завантаження та обробка файлу...",
      success: (uploadedResults) => `Успішно завантажено ${uploadedResults.length} результатів`,
      error: "Не вдалося завантажити файл. Спробуйте ще раз.",
    });

    try {
      await uploadPromise;
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h1 className="font-mono">Результати навчання</h1>
          <button
            onClick={() => navigate("/results/new")}
            className="bg-green-600 hover:bg-green-700 text-white border-0 px-4 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} /> Додати результат
          </button>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-500/10"
              : "border-[#fbf0df] bg-[#1a1a1a]"
          } ${isUploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isUploading}
          />
          <div className="flex flex-col items-center gap-3">            
            {isUploading ? (
              <p className="text-[#fbf0df] font-mono font-bold">
                <FontAwesomeIcon icon={faUpload} className={`${isDragging ? "text-blue-500" : "text-[#fbf0df]"}`}/> Завантаження...
              </p>
            ) : (
              <p className="text-[#fbf0df] font-mono font-bold text-lg">
                <FontAwesomeIcon icon={faUpload} className={`${isDragging ? "text-blue-500" : "text-[#fbf0df]"}`}/> Перетягніть файл .docx сюди або натисніть для вибору
              </p>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-[#fbf0df] font-mono">Немає результатів</div>
        ) : (
          <div className="flex flex-col gap-6">
            {(["ЗК", "СК", "РН"] as const).map(type => {
              const results = groupedResults[type];
              if (!results || results.length === 0) return null;

              return (
                <div key={type} className="flex flex-col gap-3">
                  <h2 className="text-[#f3d5a3] font-bold text-lg font-mono">
                    {RESULT_TYPES[type]}
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {results.map(result => (
                      <li key={result.id} className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-[#f3d5a3]">{result.no}.</span>
                            <span className="font-bold">{result.name}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => navigate(`/results/${result.id}`)} className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-3 py-1 rounded-lg font-bold">
                            <FontAwesomeIcon icon={faPen} /> Редагувати
                          </button>
                          <button onClick={() => handleDelete(result)} className="bg-red-600 hover:bg-red-700 text-white border-0 px-3 py-1 rounded-lg font-bold">
                            <FontAwesomeIcon icon={faTrash} /> Видалити
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


