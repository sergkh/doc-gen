import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
import { loadAllCoursesBrief } from "../courses";
import { loadAllTemplates } from "../templates";
import type { Course, KeyValue, Template, TemplateParameter } from "@/stores/models";
import toast from "react-hot-toast";

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

export default function GeneratorPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<KeyValue[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  const [optionsCache, setOptionsCache] = useState<Record<string, Array<{ id: string | number; name: string }>>>({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});
  
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

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (value) {
      localStorage.setItem(API_KEY_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  };

  const selectedTemplate = templates.find(t => t.id.toString() === selectedTemplateId);
  const templateParameters = selectedTemplate?.data?.parameters || [];

  // Fetch options from URL when parameter with optionsUrl is selected
  useEffect(() => {
    const fetchOptions = async () => {
      for (const param of templateParameters) {
        if (param.optionsUrl && !optionsCache[param.optionsUrl] && !loadingOptions[param.optionsUrl]) {
          setLoadingOptions(prev => ({ ...prev, [param.optionsUrl!]: true }));
          try {
            const response = await fetch(param.optionsUrl);
            if (response.ok) {
              const data = await response.json();
              // For object types, preserve full objects; for others, ensure id/name format
              const options = Array.isArray(data) 
                ? data.map((item: any) => {
                    // If it's already an object with id/name, preserve it fully
                    if (typeof item === "object" && item !== null && (item.id !== undefined || item.name !== undefined)) {
                      return item;
                    }
                    // Otherwise, create id/name format
                    return {
                      id: item.id ?? item.value ?? item,
                      name: item.name ?? item.label ?? String(item)
                    };
                  })
                : [];
              setOptionsCache(prev => ({ ...prev, [param.optionsUrl!]: options }));
            } else {
              toast.error(`Помилка завантаження опцій для ${param.name}`);
            }
          } catch (error) {
            console.error(`Error fetching options for ${param.name}:`, error);
            toast.error(`Помилка завантаження опцій для ${param.name}`);
          } finally {
            setLoadingOptions(prev => ({ ...prev, [param.optionsUrl!]: false }));
          }
        }
      }
    };

    if (templateParameters.length > 0) {
      fetchOptions();
    }
  }, [selectedTemplateId, templates]);

  const updateParameterValue = (paramName: string, value: any) => {
    setParameterValues(prev => ({ ...prev, [paramName]: value }));
  };

  const renderParameterInput = (param: TemplateParameter) => {
    const paramValue = parameterValues[param.name] ?? (param.type === "boolean" ? false : param.type === "list" ? [] : "");
    const options = param.optionsUrl 
      ? optionsCache[param.optionsUrl] || []
      : param.dictionary
      ? (Array.isArray(param.dictionary)
          ? param.dictionary.map((item, idx) => ({ id: idx, name: String(item) }))
          : [{ id: 0, name: String(param.dictionary) }])
      : [];

    if (param.type === "boolean") {
      return (
        <div key={param.name}>
          <label className="block text-amber-50 font-bold mb-1 text-sm">
            {param.name}
            {param.description && (
              <span className="text-xs font-normal opacity-70 ml-2">({param.description})</span>
            )}
          </label>
          <select
            value={paramValue ? "true" : "false"}
            onChange={(e) => updateParameterValue(param.name, e.target.value === "true")}
            disabled={isGenerating}
            className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50"
          >
            <option value="false">Ні</option>
            <option value="true">Так</option>
          </select>
        </div>
      );
    }

    if (param.type === "object") {
      return (
        <div key={param.name}>
          <label className="block text-amber-50 font-bold mb-1 text-sm">
            {param.name}
            {param.description && (
              <span className="text-xs font-normal opacity-70 ml-2">({param.description})</span>
            )}
          </label>
          <select
            value={paramValue?.id ? String(paramValue.id) : ""}
            onChange={(e) => {
              if (e.target.value) {
                const option = options.find(opt => String(opt.id) === e.target.value);
                updateParameterValue(param.name, option || undefined);
              } else {
                updateParameterValue(param.name, undefined);
              }
            }}
            disabled={isGenerating || loadingOptions[param.optionsUrl || ""]}
            className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50"
          >
            <option value="">-- Оберіть --</option>
            {options.map((opt) => (
              <option key={opt.id} value={String(opt.id)}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (param.type === "number") {
      if (options.length > 0) {
        return (
          <div key={param.name}>
            <label className="block text-amber-50 font-bold mb-1 text-sm">
              {param.name}
              {param.description && (
                <span className="text-xs font-normal opacity-70 ml-2">({param.description})</span>
              )}
            </label>
            <select
              value={paramValue || ""}
              onChange={(e) => updateParameterValue(param.name, e.target.value ? Number(e.target.value) : undefined)}
              disabled={isGenerating || loadingOptions[param.optionsUrl || ""]}
              className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50"
            >
              <option value="">-- Оберіть --</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
        );
      }
      return (
        <div key={param.name}>
          <label className="block text-amber-50 font-bold mb-1 text-sm">
            {param.name}
            {param.description && (
              <span className="text-xs font-normal opacity-70 ml-2">({param.description})</span>
            )}
          </label>
          <input
            type="number"
            value={paramValue || ""}
            onChange={(e) => updateParameterValue(param.name, e.target.value ? Number(e.target.value) : undefined)}
            disabled={isGenerating}
            className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50"
            placeholder="Введіть число"
          />
        </div>
      );
    }

    if (param.type === "list") {
      const currentList = Array.isArray(paramValue) ? paramValue : [];
      const selectedIds = param.subtype === "object" 
        ? currentList.map((item: any) => String(item?.id ?? item))
        : currentList.map(String);
      
      const handleAddItem = (value: string) => {
        if (!value) return;
        
        // For object subtype, store the full object
        if (param.subtype === "object") {
          const option = options.find(opt => String(opt.id) === value);
          if (!option) return;
          
          // Check if already added
          if (selectedIds.includes(String(option.id))) return;
          
          updateParameterValue(param.name, [...currentList, option]);
        } else {
          const val = value;
          let convertedVal: any = val;
          if (param.subtype === "number") convertedVal = Number(val);
          else if (param.subtype === "boolean") convertedVal = val === "true";
          
          // Check if already added
          if (selectedIds.includes(String(val))) return;
          
          updateParameterValue(param.name, [...currentList, convertedVal]);
        }
      };
      
      const handleRemoveItem = (index: number) => {
        const newList = currentList.filter((_, i) => i !== index);
        updateParameterValue(param.name, newList.length > 0 ? newList : []);
      };
      
      const getItemDisplayName = (item: any) => {
        if (param.subtype === "object" && typeof item === "object" && item !== null) {
          return item.name ?? String(item.id ?? item);
        }
        const itemStr = String(item);
        const option = options.find(opt => String(opt.id) === itemStr);
        return option ? option.name : itemStr;
      };
      
      return (
        <div key={param.name} className="col-span-2">
          <label className="block text-amber-50 font-bold mb-1 text-sm">
            {param.name}
            {param.description && (
              <span className="text-xs font-normal opacity-70 ml-2">({param.description})</span>
            )}
          </label>
          <div className="flex gap-2 mb-2">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleAddItem(e.target.value);
                  e.target.value = ""; // Reset dropdown
                }
              }}
              disabled={isGenerating || (param.optionsUrl && loadingOptions[param.optionsUrl]) || options.length === 0}
              className="flex-1 bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50"
            >
              <option value="">-- Оберіть для додавання --</option>
              {options
                .filter(opt => !selectedIds.includes(String(opt.id)))
                .map((opt) => (
                  <option key={opt.id} value={String(opt.id)}>
                    {opt.name}
                  </option>
                ))}
            </select>
          </div>
          {currentList.length > 0 ? (
            <div className="flex flex-col gap-2">
              {currentList.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-zinc-800 border border-amber-50/30 rounded px-2 py-1"
                >
                  <span className="text-amber-50 font-mono text-sm">{getItemDisplayName(item)}</span>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    disabled={isGenerating}
                    className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-amber-50/50 italic py-2">
              Список порожній. Оберіть елемент зі списку вище та натисніть "Додати"
            </div>
          )}
        </div>
      );
    }

    // text type
    if (options.length > 0) {
      return (
        <div key={param.name}>
          <label className="block text-amber-50 font-bold mb-1 text-sm">
            {param.description && (
              <span className="text-xs font-normal opacity-70 ml-2">({param.description})</span>
            )}
          </label>
          <select
            value={paramValue || ""}
            onChange={(e) => updateParameterValue(param.name, e.target.value || undefined)}
            disabled={isGenerating || loadingOptions[param.optionsUrl || ""]}
            className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50"
          >
            <option value="">-- Оберіть --</option>
            {options.map((opt) => (
              <option key={opt.id} value={String(opt.id)}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={param.name}>
        <label className="block text-amber-50 font-bold mb-1 text-sm">
          {param.name}
          {param.description && (
            <span className="text-xs font-normal opacity-70 ml-2">({param.description})</span>
          )}
        </label>
        <input
          type="text"
          value={paramValue || ""}
          onChange={(e) => updateParameterValue(param.name, e.target.value || undefined)}
          disabled={isGenerating}
          className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50"
          placeholder="Введіть текст"
        />
      </div>
    );
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
            <label className="block text-amber-50 font-bold mb-2">Дисципліна:</label>
            {isLoading ? (
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
                    {course.name}
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

          {templateParameters.length > 0 && (
            <div className="border-t border-amber-50/30 pt-3 mt-3">
              <label className="block text-amber-50 font-bold mb-3">Параметри шаблону:</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templateParameters.map(renderParameterInput)}
              </div>
            </div>
          )}
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

        <div className="flex gap-4 items-center">
          <button
            onClick={() => handleGenerate(false)}
            disabled={isGenerating || !selectedCourseId || !selectedTemplateId}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white border-0 px-5 py-2 rounded-lg font-bold transition-all duration-100 hover:-translate-y-px cursor-pointer whitespace-nowrap flex items-center gap-2 font-mono"
          >
            <FontAwesomeIcon icon={faDownload} />
            {isGenerating && !navigateToEdit ? "Генерую..." : "Згенерувати"}
          </button>
          <button
            onClick={handleGenerateAndEdit}
            disabled={isGenerating || !selectedCourseId || !selectedTemplateId}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white border-0 px-5 py-2 rounded-lg font-bold transition-all duration-100 hover:-translate-y-px cursor-pointer whitespace-nowrap flex items-center gap-2 font-mono"
          >
            <FontAwesomeIcon icon={faEdit} />
            {isGenerating && navigateToEdit ? "Генерую..." : "Згенерувати і редагувати"}
          </button>
          {isGenerating && (
            <span className="text-amber-50 font-mono">
              Генерація може зайняти близько 20 хв, в залежності від кількості матеріалу
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
