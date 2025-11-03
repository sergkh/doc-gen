import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload } from "@fortawesome/free-solid-svg-icons";

interface SavedState {
  discipline: string;
  author: string;
  specialty: string;
  area: string;
}

const STORAGE_KEY = "programGeneratorState";

export default function ProgramGenerator() {
  const [discipline, setDiscipline] = useState<string>("");
  const [author, setAuthor] = useState<string>("");
  const [specialty, setSpecialty] = useState<string>("");
  const [area, setArea] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SavedState = JSON.parse(saved);
        setDiscipline(parsed.discipline || "");
        setAuthor(parsed.author || "");
        setSpecialty(parsed.specialty || "");
        setArea(parsed.area || "");
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
        author,
        specialty,
        area,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error("Failed to save state to localStorage:", error);
    }
  }, [discipline, author, specialty, area, isLoaded]);

  const handleGenerateAndDownload = async () => {
    if (!discipline.trim() || !author.trim()) return;

    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discipline, author, specialty, area }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate");
      }

      // Get the document blob from response
      const blob = await response.blob();
      
      // Extract filename from Content-Disposition header, or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `program-${Date.now()}.docx`;
      
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
      alert("Не вдалося згенерувати та завантажити документ");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <h1 className="font-mono">Генератор програми дисципліни</h1>
        
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
          <label className="block text-[#fbf0df] font-bold mb-2">Автор:</label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40"
            placeholder="Введіть імʼя автора"
          />
        </div>

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono">
          <label className="block text-[#fbf0df] font-bold mb-2">Спеціальність:</label>
          <input
            type="text"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40"
            placeholder="Введіть спеціальність"
          />
        </div>

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono">
          <label className="block text-[#fbf0df] font-bold mb-2">Галузь:</label>
          <input
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white placeholder-[#fbf0df]/40"
            placeholder="Введіть галузь"
          />
        </div>

        <button
          onClick={handleGenerateAndDownload}
          disabled={isGenerating || !discipline.trim() || !author.trim()}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white border-0 px-5 py-2 rounded-lg font-bold transition-all duration-100 hover:-translate-y-px cursor-pointer whitespace-nowrap flex items-center gap-2 self-start"
        >
          <FontAwesomeIcon icon={faDownload} />
          {isGenerating ? "Генерую..." : "Згенерувати"}
        </button>
      </div>
    </div>
  );
}
