import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faUpload } from "@fortawesome/free-solid-svg-icons";
import { useDropzone } from "react-dropzone";
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

  const [items, setItems] = useState<CourseResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);

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
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        processFile(file);
      }
    },
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    disabled: isUploading,
    onDropRejected: () => {
      toast.error("Будь ласка, виберіть файл .docx");
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h1 className="font-mono">Результати навчання</h1>
          <button
            onClick={() => navigate("/results/new")}
            className="text-[#fbf0df] hover:text-[#f3d5a3] px-2 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
            isDragActive
              ? "border-blue-500 bg-blue-500/10"
              : "border-[#fbf0df] bg-[#1a1a1a]"
          } ${isUploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">            
            {isUploading ? (
              <p className="text-[#fbf0df] font-mono font-bold">
                <FontAwesomeIcon icon={faUpload} className={isDragActive ? "text-blue-500" : "text-[#fbf0df]"}/> Завантаження...
              </p>
            ) : (
              <p className="text-[#fbf0df] font-mono font-bold text-lg">
                <FontAwesomeIcon icon={faUpload} className={isDragActive ? "text-blue-500" : "text-[#fbf0df]"}/> Перетягніть файл OПП в форматі .docx сюди або натисніть для вибору
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
                          <button 
                            onClick={() => navigate(`/results/${result.id}`)} 
                            className="text-[#fbf0df] hover:text-[#f3d5a3] opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                            aria-label="Редагувати результат"
                            title="Редагувати результат"
                          >
                            <FontAwesomeIcon icon={faPen} />
                          </button>
                          <button 
                            onClick={() => handleDelete(result)} 
                            className="text-[#fbf0df] hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                            aria-label="Видалити результат"
                            title="Видалити результат"
                          >
                            <FontAwesomeIcon icon={faTrash} />
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


