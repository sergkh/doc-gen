import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faUpload } from "@fortawesome/free-solid-svg-icons";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import type { Specialty } from "@/stores/models";
import { loadAllSpecialties, deleteSpecialty } from "../specialties";
import { uploadResultsFromDocx } from "../results";

export default function SpecialtiesList() {
  const navigate = useNavigate();

  const [items, setItems] = useState<Specialty[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadAllSpecialties().then(setItems).catch(console.error);
  }, []);

   const handleDelete = async (specialty: Specialty) => {
    if (!confirm(`Ви впевнені, що хочете видалити спеціальність "${specialty.code} ${specialty.name}"?`)) {
      return;
    }

    try {
      await deleteSpecialty(specialty.id);
      setItems(items.filter(s => s.id !== specialty.id));
    } catch (error) {
      console.error("Error deleting specialty:", error);
      alert("Не вдалося видалити спеціальність");
    }
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    const uploadPromise = (async () => {
      const uploadedResults = await uploadResultsFromDocx(file);
      toast.success(`Успішно завантажено ${uploadedResults.length} результатів`);
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
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: isUploading,
    onDropRejected: () => {
      toast.error("Будь ласка, виберіть файл .docx або .pdf");
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        
        <div className="flex justify-between items-center">
          <h1 className="font-mono">Спеціальності</h1>
          <button
            onClick={() => navigate("/specialties/new")}
            className="text-amber-50 hover:text-amber-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors mb-6 ${
            isDragActive
              ? "border-blue-500 bg-blue-500/10"
              : "border-amber-50 bg-zinc-900"
          } ${isUploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">            
            {isUploading ? (
              <p className="text-amber-50 font-mono font-bold">
                <FontAwesomeIcon icon={faUpload} className={isDragActive ? "text-blue-500" : "text-amber-50"}/> Завантаження...
              </p>
            ) : (
              <p className="text-amber-50 font-mono font-bold text-lg">
                <FontAwesomeIcon icon={faUpload} className={isDragActive ? "text-blue-500" : "text-amber-50"}/> Перетягніть файл OПП в форматі .docx сюди або натисніть для вибору
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <div className="text-amber-50 font-mono">Немає спеціальностей</div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map(s => (
                <li key={s.id} className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-3 text-amber-50 font-mono flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-bold">{s.code} {s.name}</div>
                    <div className="text-sm opacity-80">{s.area} ({s.qualification})</div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => navigate(`/specialties/${s.id}`)} 
                      className="text-amber-50 hover:text-amber-200 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Редагувати спеціальність"
                      title="Редагувати спеціальність"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button 
                      onClick={() => handleDelete(s)} 
                      className="text-amber-50 hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Видалити спеціальність"
                      title="Видалити спеціальність"
                    >
                      <FontAwesomeIcon icon={faTrash} />
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