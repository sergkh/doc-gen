import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { loadAllCourses } from "../courses";
import type { Course } from "@/stores/models";

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
  type: "method" | "program";
}

const STORAGE_KEY = "generationJob";

export default function GeneratorPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [isGeneratingMethod, setIsGeneratingMethod] = useState(false);
  const [isGeneratingProgram, setIsGeneratingProgram] = useState(false);
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
    setIsGeneratingMethod(false);
    setIsGeneratingProgram(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const pollJobStatus = (jobId: string, type: "method" | "program") => {
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
          const filename = status.filename || (type === "method" ? "method-sam.docx" : "program.docx");
          await handleDownload(blob, filename);

          // Cleanup
          clearJobState();
        } else if (status.status === "error") {
          // Error occurred
          clearJobState();
          alert(`Помилка генерації: ${status.error || "Невідома помилка"}`);
        }
      } catch (error) {
        console.error("Error polling job status:", error);
        clearJobState();        
      }
    };

    // Initial poll
    poll();
    // Poll every 2 seconds
    pollingIntervalRef.current = setInterval(poll, 2000) as unknown as number;
  };

  useEffect(() => {
    async function fetchCourses() {
      try {
        const allCourses = await loadAllCourses();
        setCourses(allCourses);
      } catch (error) {
        console.error("Failed to load courses:", error);
        alert("Помилка завантаження дисциплін");
      } finally {
        setIsLoading(false);
      }
    }
    fetchCourses();
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
                  const filename = status.filename || (savedJob.type === "method" ? "method-sam.docx" : "program.docx");
                  await handleDownload(blob, filename);
                }
                clearJobState();
              } else if (status.status === "error") {
                alert(`Помилка генерації: ${status.error || "Невідома помилка"}`);
                clearJobState();
              } else {
                // Job still in progress, resume polling
                if (savedJob.type === "method") {
                  setIsGeneratingMethod(true);
                } else {
                  setIsGeneratingProgram(true);
                }
                pollJobStatus(savedJob.jobId, savedJob.type);
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

  const handleGenerateMethod = async () => {
    if (!selectedCourseId) {
      alert("Будь ласка, оберіть дисципліну");
      return;
    }

    setIsGeneratingMethod(true);
    setProgress(0);

    try {
      const response = await fetch(`/api/courses/${selectedCourseId}/generated/self-method`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to start generation");
      }

      const { jobId } = await response.json();
      setCurrentJobId(jobId);
      
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ jobId, type: "method" } as SavedJob));
      
      pollJobStatus(jobId, "method");
    } catch (error) {
      console.error("Error starting generation:", error);
      alert("Помилка запуску генерації методички");
      setIsGeneratingMethod(false);
      setProgress(0);
    }
  };

  const handleGenerateProgram = async () => {
    if (!selectedCourseId) {
      alert("Будь ласка, оберіть дисципліну");
      return;
    }

    setIsGeneratingProgram(true);
    setProgress(0);

    try {
      const response = await fetch(`/api/courses/${selectedCourseId}/generated/program`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to start generation");
      }

      const { jobId } = await response.json();
      setCurrentJobId(jobId);
      
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ jobId, type: "program" } as SavedJob));
      
      pollJobStatus(jobId, "program");
    } catch (error) {
      console.error("Error starting generation:", error);
      alert("Помилка запуску генерації програми");
      setIsGeneratingProgram(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-7xl mx-auto text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <h1 className="font-mono">Генератор документів</h1>

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono">
          <label className="block text-[#fbf0df] font-bold mb-2">Дисципліна:</label>
          {isLoading ? (
            <div className="text-[#fbf0df]">Завантаження...</div>
          ) : (
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
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

        {(isGeneratingMethod || isGeneratingProgram) && (
          <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#fbf0df] font-bold">
                {isGeneratingMethod ? "Генерація методички..." : "Генерація програми..."}
              </span>
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

        <div className="flex gap-4">
          <button
            onClick={handleGenerateMethod}
            disabled={isGeneratingMethod || isGeneratingProgram || !selectedCourseId}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white border-0 px-5 py-2 rounded-lg font-bold transition-all duration-100 hover:-translate-y-px cursor-pointer whitespace-nowrap flex items-center gap-2 font-mono"
          >
            <FontAwesomeIcon icon={faDownload} />
            {isGeneratingMethod ? "Генерую..." : "Згенерувати методичку"}
          </button>

          <button
            onClick={handleGenerateProgram}
            disabled={isGeneratingMethod || isGeneratingProgram || !selectedCourseId}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white border-0 px-5 py-2 rounded-lg font-bold transition-all duration-100 hover:-translate-y-px cursor-pointer whitespace-nowrap flex items-center gap-2 font-mono"
          >
            <FontAwesomeIcon icon={faDownload} />
            {isGeneratingProgram ? "Генерую..." : "Згенерувати програму"}
          </button>
        </div>
      </div>
    </div>
  );
}
