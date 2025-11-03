import { useState, useEffect, type FormEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faDownload } from "@fortawesome/free-solid-svg-icons";
import type { DisciplineLessons } from "@/stores/models";

interface LessonItem {
  title: string;
  text: string;
}

interface SavedState {
  discipline: string;
  authors: string[];
  lessons: LessonItem[];
}

const STORAGE_KEY = "methodGeneratorState";

export default function MethodGenerator() {
  const [discipline, setDiscipline] = useState<string>("");
  const [authors, setAuthors] = useState<string[]>([]);
  const [authorInput, setAuthorInput] = useState<string>("");
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lessonTitle, setLessonTitle] = useState<string>("");
  const [lessonText, setLessonText] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SavedState = JSON.parse(saved);
        setDiscipline(parsed.discipline || "");
        setAuthors(parsed.authors || []);
        setLessons(parsed.lessons || []);
      }
    } catch (error) {
      console.error("Failed to load state from localStorage:", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save state to localStorage whenever it changes (but only after initial load)
  useEffect(() => {
    if (!isLoaded) return;
    
    try {
      const stateToSave: SavedState = {
        discipline,
        authors,
        lessons,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error("Failed to save state to localStorage:", error);
    }
  }, [discipline, authors, lessons, isLoaded]);

  const handleAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (lessonTitle.trim() && lessonText.trim()) {
      setLessons([...lessons, { title: lessonTitle, text: lessonText }]);
      setLessonTitle("");
      setLessonText("");
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      const isTextFile = 
        file.type === "text/plain" || 
        fileName.endsWith(".txt") || 
        fileName.endsWith(".text") ||
        file.type.startsWith("text/");

      if (isTextFile) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          setLessonText(content);
        };
        reader.onerror = () => {
          alert("Error reading file. Please try again.");
        };
        reader.readAsText(file);
      } else {
        alert("Please drop a text file (.txt)");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemove = (index: number) => setLessons(lessons.filter((_, i) => i !== index));

  const handleAddAuthor = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (authorInput.trim()) {
      setAuthors([...authors, authorInput.trim()]);
      setAuthorInput("");
    }
  };

  const handleRemoveAuthor = (index: number) => setAuthors(authors.filter((_, i) => i !== index));

  const handleGenerateAndDownload = async () => {
    if (lessons.length === 0 || !discipline.trim()) return;

    setIsGenerating(true);

    try {
      const disciplineLessons: DisciplineLessons = { discipline, authors, lessons};

      const response = await fetch("/api/generate/self-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(disciplineLessons),
      });

      if (!response.ok) {
        throw new Error("Failed to generate");
      }

      // Get the PDF blob from response
      const blob = await response.blob();
      
      // Extract filename from Content-Disposition header, or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `method-generator-results-${Date.now()}.pdf`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, "");
        }
      }
      
      // Create download link and trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating and downloading:", error);
      alert("Failed to generate and download results");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <h1 className="font-mono">Генератор методички з самостійної роботи</h1>

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono">
          <label className="block text-[#fbf0df] font-bold mb-2">Назва предмету:</label>
          <input
            type="text"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
            className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40"
            placeholder="Введіть назву предмету"
          />
        </div>
        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono">
          <label className="block text-[#fbf0df] font-bold mb-2">Автори:</label>
          {authors.length > 0 && (
            <ul className="flex flex-col gap-2 mb-2">
              {authors.map((author, index) => (
                <li
                  key={index}
                  className="relative bg-[#2a2a2a] border border-[#fbf0df] rounded-lg p-2 text-[#fbf0df] font-mono flex items-center justify-between"
                >
                  <span>{author}</span>
                  <button
                    onClick={() => handleRemoveAuthor(index)}
                    className="bg-gray-600 hover:bg-gray-700 text-white rounded-full w-6 h-6 flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
                    aria-label="Видалити автора"
                  >
                    <FontAwesomeIcon icon={faTimes} size="xs" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={handleAddAuthor} className="flex gap-2">
            <input
              type="text"
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              className="flex-1 bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40"
              placeholder="Введіть імʼя автора"
            />
            <button
              type="submit"
              className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-4 py-1.5 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap"
            >
              Додати автора
            </button>
          </form>
        </div>
        {lessons.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[#fbf0df] font-mono text-lg font-bold">Лекції:</h2>
              <button
                onClick={handleGenerateAndDownload}
                disabled={isGenerating || !discipline.trim()}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white border-0 px-5 py-1.5 rounded-lg font-bold transition-all duration-100 hover:-translate-y-px cursor-pointer whitespace-nowrap flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faDownload} />
                {isGenerating ? "Генерую..." : "Згенерувати"}
              </button>
            </div>
            {discipline && (
              <div className="text-[#fbf0df] font-mono font-bold mb-2">Предмет: {discipline}</div>
            )}
            <ul className="flex flex-col gap-3">
              {lessons.map((item, index) => (
                <li
                  key={index}
                  className="relative bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 text-[#fbf0df] font-mono"
                >
                  <button
                    onClick={() => handleRemove(index)}
                    className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-700 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer shadow-lg"
                    aria-label="Remove item"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                  <div className="font-bold text-[#f3d5a3] mb-2 pr-10">{item.title}</div>
                  <div className="whitespace-pre-wrap">{item.text}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 bg-[#1a1a1a] p-3 rounded-xl font-mono border-2 border-[#fbf0df] transition-colors duration-300 focus-within:border-[#f3d5a3] w-full"
        >
          <input
            type="text"
            name="lessonTitle"
            value={lessonTitle}
            onChange={(e) => setLessonTitle(e.target.value)}
            className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40"
            placeholder="Назва теми"
            required
          />
          <textarea
            name="lessonText"
            value={lessonText}
            onChange={(e) => setLessonText(e.target.value)}
            onDrop={handleFileDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`w-full min-h-[100px] bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40 resize-y transition-colors duration-200 ${
              isDragging ? "bg-[#2a2a2a] border-2 border-[#f3d5a3] border-dashed rounded-lg" : ""
            }`}
            placeholder={isDragging ? "Drop text file here..." : "Текст лекції (або перетягніть .txt файл)"}
            required
          />
          <button
            type="submit"
            className="bg-[#fbf0df] text-[#1a1a1a] border-0 px-5 py-1.5 rounded-lg font-bold transition-all duration-100 hover:bg-[#f3d5a3] hover:-translate-y-px cursor-pointer whitespace-nowrap self-start"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
