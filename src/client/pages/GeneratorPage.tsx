import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { loadAllCoursesBrief } from "../courses";
import { loadAllTemplates } from "../templates";
import type { Course, KeyValue, Template } from "@/stores/models";
import toast from "react-hot-toast";

type JobStatus = "pending" | "generating" | "rendering" | "completed" | "error";

interface JobStatusResponse {
  id: string;
  status: JobStatus;
  progress: number;
  error?: string;
  filename?: string;
}

interface SavedJob {
  jobId: string;
  templateId: number;
}

const STORAGE_KEY = "generationJob";
const API_KEY_STORAGE_KEY = "openai_api_key";

export default function GeneratorPage() {
  const [courses, setCourses] = useState<KeyValue[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);

  const handleDownload = async (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearJobState = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentJobId(null);
    setProgress(0);
    setIsGenerating(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const pollJobStatus = (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch job status");
        }

        const status: JobStatusResponse = await response.json();
        setProgress(status.progress);

        if (status.status === "completed") {
          // Download the file
          const downloadResponse = await fetch(`/api/jobs/${jobId}/download`);
          
          if (!downloadResponse.ok) {
            throw new Error("Failed to download file");
          }

          const blob = await downloadResponse.blob();
          await handleDownload(blob, status.filename || "result.docx");

          // Cleanup
          clearJobState();
        } else if (status.status === "error") {
          // Error occurred
          clearJobState();
          toast.error(`Помилка генерації: ${status.error || "Невідома помилка"}`);
        }
      } catch (error) {
        console.error("Error polling job status:", error);
        toast.error("Помилка генерації: " + error);
        clearJobState();        
      }
    };

    poll();
    pollingIntervalRef.current = setInterval(poll, 2000) as unknown as number;
  };

  useEffect(() => {
    // Load API key from localStorage
    const savedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }

    async function fetchData() {
      try {
        const [allCourses, allTemplates] = await Promise.all([
          loadAllCoursesBrief(),
          loadAllTemplates()
        ]);
        setCourses(allCourses);
        setTemplates(allTemplates);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("Помилка завантаження даних");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Resume job from localStorage on mount
  useEffect(() => {
    const savedJobStr = localStorage.getItem(STORAGE_KEY);
    if (savedJobStr) {
      try {
        const savedJob: SavedJob = JSON.parse(savedJobStr);
        setCurrentJobId(savedJob.jobId);
        
        // Check if job still exists and is not completed
        async function resumeJob() {
          try {
            const response = await fetch(`/api/jobs/${savedJob.jobId}`);
            if (response.ok) {
              const status: JobStatusResponse = await response.json();
              setProgress(status.progress);
              
              if (status.status === "completed") {
                // Job already completed, download it
                const downloadResponse = await fetch(`/api/jobs/${savedJob.jobId}/download`);
                if (downloadResponse.ok) {
                  const blob = await downloadResponse.blob();
                  const filename = status.filename || "result.docx";
                  await handleDownload(blob, filename);
                }
                clearJobState();
              } else if (status.status === "error") {
                toast.error(`Помилка генерації: ${status.error || "Невідома помилка"}`);
                clearJobState();
              } else {
                // Job still in progress, resume polling
                setIsGenerating(true);
                pollJobStatus(savedJob.jobId);
              }
            } else {
              // Job not found, clear it
              clearJobState();
            }
          } catch (error) {
            console.error("Error resuming job:", error);
            clearJobState();
          }
        }
        resumeJob();
      } catch (error) {
        console.error("Failed to parse saved job:", error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (value) {
      localStorage.setItem(API_KEY_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  };

  const handleGenerate = async () => {
    if (!selectedCourseId) {
      toast.error("Будь ласка, оберіть дисципліну");
      return;
    }

    if (!selectedTemplateId) {
      toast.error("Будь ласка, оберіть шаблон");
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      const response = await fetch(`/api/courses/${selectedCourseId}/generate/${selectedTemplateId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiKey: apiKey || undefined
        })
      });

      if (!response.ok) {
        throw new Error("Failed to start generation");
      }

      const { jobId } = await response.json();
      setCurrentJobId(jobId);
      
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
        jobId, 
        templateId: Number(selectedTemplateId) 
      } as SavedJob));
      
      pollJobStatus(jobId);
    } catch (error) {
      console.error("Error starting generation:", error);
      toast.error("Помилка запуску генерації");
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <h1 className="font-mono">Генератор документів</h1>

        <div>
          <label className="text-[#fbf0df] font-bold mb-2">
            OpenAI API Key (опціонально):
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            disabled={isGenerating}
            placeholder="Ключ API OpenAI"
            className="w-2xl bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white disabled:opacity-50 placeholder:opacity-50"
          />
          <div className="text-sm text-[#fbf0df] opacity-70 mt-1">
            Зберігається локально в браузері. Якщо вказано, використовується замість серверного ключа.
          </div>
        </div>

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono flex flex-col gap-3">
          <div>
            <label className="block text-[#fbf0df] font-bold mb-2">Дисципліна:</label>
            {isLoading ? (
              <div className="text-[#fbf0df]">Завантаження...</div>
            ) : (
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={isGenerating}
                className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white disabled:opacity-50"
              >
                <option value="">-- Оберіть дисципліну --</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[#fbf0df] font-bold mb-2">Шаблон:</label>
            {isLoading ? (
              <div className="text-[#fbf0df]">Завантаження...</div>
            ) : (
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                disabled={isGenerating}
                className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white disabled:opacity-50"
              >
                <option value="">-- Оберіть шаблон --</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {isGenerating && (
          <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#fbf0df] font-bold">Генерація...</span>
              <span className="text-[#fbf0df]">{progress}%</span>
            </div>
            <div className="w-full bg-[#2a2a2a] rounded-full h-4 overflow-hidden">
              <div
                className="bg-green-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-4 items-center">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedCourseId || !selectedTemplateId}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white border-0 px-5 py-2 rounded-lg font-bold transition-all duration-100 hover:-translate-y-px cursor-pointer whitespace-nowrap flex items-center gap-2 font-mono"
          >
            <FontAwesomeIcon icon={faDownload} />
            {isGenerating ? "Генерую..." : "Згенерувати"}
          </button>
          {isGenerating && (
            <span className="text-[#fbf0df] font-mono">
              Генерація може зайняти близько 20 хв, в залежності від кількості матеріалу
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
