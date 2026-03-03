import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faEdit } from "@fortawesome/free-solid-svg-icons";
import { loadCoursesBySpecialty, formatDisciplineCode } from "../courses";
import { loadAllTemplates } from "../templates";
import { loadAllSpecialties } from "../specialties";
import type { Course, Template, Specialty } from "@/stores/models";
import toast from "react-hot-toast";
import TemplateParametersInput from "../components/TemplateParametersInput";

type JobStatus = "pending" | "generating" | "rendering" | "completed" | "error";

interface JobStatusResponse {
  id: string;
  status: JobStatus;
  progress: number;
  error?: string;
  filename: string;
}

interface SavedJob {
  jobId: string;
  templateId: number;
  navigateToEdit?: boolean;
  courseId?: string;
}

const STORAGE_KEY = "generationJob";
const API_KEY_STORAGE_KEY = "openai_api_key";
const SELECTED_COURSE_KEY = "generator_selectedCourse";
const SELECTED_TEMPLATE_KEY = "generator_selectedTemplate";

export default function GeneratorPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [navigateToEdit, setNavigateToEdit] = useState(false);
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
    setNavigateToEdit(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const pollJobStatus = (jobId: string, shouldNavigateToEdit: boolean = false, courseId?: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch job status");
        }

        const status: JobStatusResponse = await response.json();
        setProgress(status.progress);

        if (status.status === "completed") {
          if (shouldNavigateToEdit && courseId) {
            // Navigate to course edit page instead of downloading
            toast.success("Генерацію завершено, перехід до редагування");
            clearJobState();
            navigate(`/courses/${courseId}`);
          } else {
            // Download the file
            const downloadResponse = await fetch(`/api/jobs/${jobId}/download`);
            
            if (!downloadResponse.ok) {
              throw new Error("Failed to download file");
            }

            const blob = await downloadResponse.blob();
            await handleDownload(blob, status.filename);

            // Cleanup
            clearJobState();
          }
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
        const [allTemplates, allSpecialties] = await Promise.all([
          loadAllTemplates(),
          loadAllSpecialties()
        ]);
        setTemplates(allTemplates);
        setSpecialties(allSpecialties);

        const savedTemplateId = localStorage.getItem(SELECTED_TEMPLATE_KEY);

        if (savedTemplateId && allTemplates.some(t => t.id.toString() === savedTemplateId)) {
          setSelectedTemplateId(savedTemplateId);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("Помилка завантаження даних");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Load courses when specialty is selected
  useEffect(() => {
    if (!selectedSpecialtyId) {
      setCourses([]);
      return;
    }

    async function fetchCourses() {
      setIsLoadingCourses(true);
      try {
        const coursesData = await loadCoursesBySpecialty(Number(selectedSpecialtyId));
        setCourses(coursesData);
      } catch (error) {
        console.error("Failed to load courses:", error);
        toast.error("Помилка завантаження дисциплін");
      } finally {
        setIsLoadingCourses(false);
      }
    }
    fetchCourses();
  }, [selectedSpecialtyId]);

  // Resume job from localStorage on mount
  useEffect(() => {
    const savedJobStr = localStorage.getItem(STORAGE_KEY);
    if (savedJobStr) {
      try {
        const savedJob: SavedJob = JSON.parse(savedJobStr);
        setCurrentJobId(savedJob.jobId);
        setNavigateToEdit(savedJob.navigateToEdit || false);
        
        // Check if job still exists and is not completed
        async function resumeJob() {
          try {
            const response = await fetch(`/api/jobs/${savedJob.jobId}`);
            if (response.ok) {
              const status: JobStatusResponse = await response.json();
              setProgress(status.progress);
              
              if (status.status === "completed") {
                if (savedJob.navigateToEdit && savedJob.courseId) {
                  // Navigate to course edit page
                  toast.success("Генерацію завершено, перехід до редагування");
                  clearJobState();
                  navigate(`/courses/${savedJob.courseId}`);
                } else {
                  // Job already completed, download it
                  const downloadResponse = await fetch(`/api/jobs/${savedJob.jobId}/download`);
                  if (downloadResponse.ok) {
                    const blob = await downloadResponse.blob();
                    const filename = status.filename;
                    await handleDownload(blob, filename);
                  }
                  clearJobState();
                }
              } else if (status.status === "error") {
                toast.error(`Помилка генерації: ${status.error || "Невідома помилка"}`);
                clearJobState();
              } else {
                // Job still in progress, resume polling
                setIsGenerating(true);
                pollJobStatus(savedJob.jobId, savedJob.navigateToEdit || false,  savedJob.courseId);
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

  useEffect(() => {
    if (selectedCourseId) {
      localStorage.setItem(SELECTED_COURSE_KEY, selectedCourseId);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    if (selectedTemplateId) {
      localStorage.setItem(SELECTED_TEMPLATE_KEY, selectedTemplateId);
    }
  }, [selectedTemplateId]);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (value) {
      localStorage.setItem(API_KEY_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  };

  const selectedTemplate = templates.find((t) => t.id.toString() === selectedTemplateId);
  const templateParameters = selectedTemplate?.data?.parameters || [];

  const handleSpecialtyChange = (value: string) => {
    setSelectedSpecialtyId(value);
    setSelectedCourseId("");
  };

  const handleGenerate = async (navigateAfterCompletion: boolean = false) => {
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
    setNavigateToEdit(navigateAfterCompletion);

    try {
      const response = await fetch(`/api/courses/${selectedCourseId}/generate/${selectedTemplateId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          parameters: parameterValues
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
        templateId: Number(selectedTemplateId),
        navigateToEdit: navigateAfterCompletion,
        courseId: navigateAfterCompletion ? selectedCourseId : undefined
      } as SavedJob));
      
      pollJobStatus(jobId, navigateAfterCompletion, navigateAfterCompletion ? selectedCourseId : undefined);
    } catch (error) {
      console.error("Error starting generation:", error);
      toast.error("Помилка запуску генерації");
      setIsGenerating(false);
      setProgress(0);
      setNavigateToEdit(false);
    }
  };

  const handleGenerateAndEdit = async () => {
    await handleGenerate(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <h1 className="font-mono">Генератор документів</h1>

        <div>
          <label className="text-amber-50 font-bold mb-2">
            <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener noreferrer">OpenAI API Key</a> (опціонально):
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            disabled={isGenerating}
            placeholder="Ключ API OpenAI"
            className="w-2xl bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white disabled:opacity-50 placeholder:opacity-50"
          />
          <div className="text-sm text-amber-50 opacity-70 mt-1">
            Зберігається локально в браузері. Якщо вказано, використовується замість серверного ключа.<br/>
            Краще брати свій ключ, оскільки серверний ключ має обмежену кількість запитів на годину.
          </div>
        </div>

        <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-3 font-mono flex flex-col gap-3">
          <div>
            <label className="block text-amber-50 font-bold mb-2">Спеціальність:</label>
            {isLoading ? (
              <div className="text-amber-50">Завантаження...</div>
            ) : (
              <select
                value={selectedSpecialtyId}
                onChange={(e) => handleSpecialtyChange(e.target.value)}
                disabled={isGenerating}
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white disabled:opacity-50"
              >
                <option value="">-- Всі спеціальності --</option>
                {specialties.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>
                    {specialty.code} {specialty.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-amber-50 font-bold mb-2">Дисципліна:</label>
            {!selectedSpecialtyId ? (
              <div className="text-amber-50 opacity-70">Спочатку оберіть спеціальність</div>
            ) : isLoadingCourses ? (
              <div className="text-amber-50">Завантаження...</div>
            ) : (
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={isGenerating}
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white disabled:opacity-50"
              >
                <option value="">-- Оберіть дисципліну --</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {formatDisciplineCode(course.data.ok_no)} {course.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-amber-50 font-bold mb-2">Шаблон:</label>
            {isLoading ? (
              <div className="text-amber-50">Завантаження...</div>
            ) : (
              <select
                value={selectedTemplateId}
                onChange={(e) => {
                  setSelectedTemplateId(e.target.value);
                  setParameterValues({}); // Clear parameter values when template changes
                }}
                disabled={isGenerating}
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white disabled:opacity-50"
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

          <TemplateParametersInput
            parameters={templateParameters}
            values={parameterValues}
            disabled={isGenerating}
            courseId={selectedCourseId ? Number(selectedCourseId) : undefined}
            onChange={setParameterValues}
          />
        </div>

        {isGenerating && (
          <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-3 font-mono">
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-50 font-bold">Генерація...</span>
              <span className="text-amber-50">{progress}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden">
              <div
                className="bg-green-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <button
            onClick={() => handleGenerate(false)}
            disabled={isGenerating || !selectedCourseId || !selectedTemplateId}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white border-0 px-5 py-2 rounded-lg font-bold transition-all duration-100 hover:-translate-y-px cursor-pointer whitespace-nowrap flex items-center gap-2 font-mono justify-center"
          >
            <FontAwesomeIcon icon={faDownload} />
            {isGenerating && !navigateToEdit ? "Генерую..." : "Згенерувати"}
          </button>
          <button
            onClick={handleGenerateAndEdit}
            disabled={isGenerating || !selectedCourseId || !selectedTemplateId}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white border-0 px-5 py-2 rounded-lg font-bold transition-all duration-100 hover:-translate-y-px cursor-pointer whitespace-nowrap flex items-center gap-2 font-mono justify-center"
          >
            <FontAwesomeIcon icon={faEdit} />
            {isGenerating && navigateToEdit ? "Генерую..." : "Згенерувати і редагувати"}
          </button>
          {isGenerating && (
            <span className="text-amber-50 font-mono text-center md:text-left">
              Генерація може зайняти близько 20 хв, в залежності від кількості матеріалу
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
