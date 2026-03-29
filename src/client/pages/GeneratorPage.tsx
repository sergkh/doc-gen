import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { loadCoursesBySpecialty, formatDisciplineCode } from "../courses";
import { loadAllTemplates } from "../templates";
import { loadAllSpecialties } from "../specialties";
import type { Course, Template, Specialty } from "@/stores/models";
import toast from "react-hot-toast";
import TemplateParametersInput from "../components/TemplateParametersInput";
import {
  Title,
  Stack,
  Select,
  PasswordInput,
  Text,
  Button,
  Group,
  Progress,
  Paper,
  Anchor,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faEdit } from "@fortawesome/free-solid-svg-icons";

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
const SELECTED_SPECIALTY_KEY = "generator_selectedSpecialty";

export default function GeneratorPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [navigateToEdit, setNavigateToEdit] = useState(false);
  const pollingIntervalRef = useRef<number | null>(null);
  const pollingRunning = useRef<boolean | null>(false);

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
    pollingRunning.current = false;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const pollJobStatus = (jobId: string, shouldNavigateToEdit: boolean = false, courseId?: string) => {
    const poll = async () => {      
      try {
        if (pollingRunning.current) return ;
        pollingRunning.current = true;
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) throw new Error("Failed to fetch job status");

        const status: JobStatusResponse = await response.json();
        setProgress(status.progress);

        if (status.status === "completed") {
          if (shouldNavigateToEdit && courseId) {
            toast.success("Генерацію завершено, перехід до редагування");
            clearJobState();
            navigate(`/courses/${courseId}`);
          } else {
            const downloadResponse = await fetch(`/api/jobs/${jobId}/download`);
            if (!downloadResponse.ok) throw new Error("Failed to download file");
            const blob = await downloadResponse.blob();
            await handleDownload(blob, status.filename);
            clearJobState();
          }
        } else if (status.status === "error") {
          clearJobState();
          toast.error(`Помилка генерації: ${status.error || "Невідома помилка"}`);
        }
      } catch (error) {
        console.error("Error polling job status:", error);
        toast.error("Помилка генерації: " + error);
        clearJobState();
      } finally {
        pollingRunning.current = false;
      }
    };

    poll();
    pollingIntervalRef.current = setInterval(poll, 2000) as unknown as number;
  };

  useEffect(() => {
    const savedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedApiKey) setApiKey(savedApiKey);

    async function fetchData() {
      try {
        const [allTemplates, allSpecialties] = await Promise.all([
          loadAllTemplates(),
          loadAllSpecialties(),
        ]);
        setTemplates(allTemplates);
        setSpecialties(allSpecialties);

        const savedTemplateId = localStorage.getItem(SELECTED_TEMPLATE_KEY);
        const savedSpecialtyId = localStorage.getItem(SELECTED_SPECIALTY_KEY);

        if (savedTemplateId && allTemplates.some((t) => t.id.toString() === savedTemplateId))
          setSelectedTemplateId(savedTemplateId);
        if (savedSpecialtyId && allSpecialties.some((s) => s.id.toString() === savedSpecialtyId))
          setSelectedSpecialtyId(savedSpecialtyId);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("Помилка завантаження даних");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

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

  useEffect(() => {
    const savedJobStr = localStorage.getItem(STORAGE_KEY);
    if (!savedJobStr) return;
    try {
      const savedJob: SavedJob = JSON.parse(savedJobStr);
      setCurrentJobId(savedJob.jobId);
      setNavigateToEdit(savedJob.navigateToEdit || false);

      async function resumeJob() {
        try {
          const response = await fetch(`/api/jobs/${savedJob.jobId}`);
          if (response.ok) {
            const status: JobStatusResponse = await response.json();
            setProgress(status.progress);
            if (status.status === "completed") {
              if (savedJob.navigateToEdit && savedJob.courseId) {
                toast.success("Генерацію завершено, перехід до редагування");
                clearJobState();
                navigate(`/courses/${savedJob.courseId}`);
              } else {
                const downloadResponse = await fetch(`/api/jobs/${savedJob.jobId}/download`);
                if (downloadResponse.ok) {
                  const blob = await downloadResponse.blob();
                  await handleDownload(blob, status.filename);
                }
                clearJobState();
              }
            } else if (status.status === "error") {
              toast.error(`Помилка генерації: ${status.error || "Невідома помилка"}`);
              clearJobState();
            } else {
              setIsGenerating(true);
              pollJobStatus(savedJob.jobId, savedJob.navigateToEdit || false, savedJob.courseId);
            }
          } else {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedSpecialtyId) localStorage.setItem(SELECTED_SPECIALTY_KEY, selectedSpecialtyId);
  }, [selectedSpecialtyId]);

  useEffect(() => {
    if (selectedCourseId) localStorage.setItem(SELECTED_COURSE_KEY, selectedCourseId);
  }, [selectedCourseId]);

  useEffect(() => {
    if (selectedTemplateId) localStorage.setItem(SELECTED_TEMPLATE_KEY, selectedTemplateId);
  }, [selectedTemplateId]);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (value) localStorage.setItem(API_KEY_STORAGE_KEY, value);
    else localStorage.removeItem(API_KEY_STORAGE_KEY);
  };

  const selectedTemplate = templates.find((t) => t.id.toString() === selectedTemplateId);
  const templateParameters = selectedTemplate?.data?.parameters || [];

  const handleSpecialtyChange = (value: string | null) => {
    setSelectedSpecialtyId(value);
    setSelectedCourseId(null);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey || undefined, parameters: parameterValues }),
      });

      if (!response.ok) throw new Error("Failed to start generation");

      const { jobId } = await response.json();
      setCurrentJobId(jobId);

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          jobId,
          templateId: Number(selectedTemplateId),
          navigateToEdit: navigateAfterCompletion,
          courseId: navigateAfterCompletion ? selectedCourseId : undefined,
        } as SavedJob)
      );

      pollJobStatus(jobId, navigateAfterCompletion, navigateAfterCompletion ? selectedCourseId : undefined);
    } catch (error) {
      console.error("Error starting generation:", error);
      toast.error("Помилка запуску генерації");
      setIsGenerating(false);
      setProgress(0);
      setNavigateToEdit(false);
    }
  };

  const specialtyOptions = specialties.map((s) => ({
    value: s.id.toString(),
    label: `${s.code} ${s.name}`,
  }));

  const courseOptions = courses.map((c) => ({
    value: c.id.toString(),
    label: `${formatDisciplineCode(c.data.ok_no)} ${c.name}`,
  }));

  const templateOptions = templates.map((t) => ({
    value: t.id.toString(),
    label: t.name,
  }));

  return (
    <Stack maw={900} mx="auto">
      <Title order={2}>Генератор документів</Title>

      <Stack gap="xs">
        <Text fw={500}>
          <Anchor href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener noreferrer">
            OpenAI API Key
          </Anchor>{" "}
          (опціонально):
        </Text>
        <PasswordInput
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.currentTarget.value)}
          disabled={isGenerating}
          placeholder="Ключ API OpenAI"
          maw={480}
        />
        <Text size="sm" c="dimmed">
          Зберігається локально в браузері. Якщо вказано, використовується замість серверного ключа.
          <br />
          Краще брати свій ключ, оскільки серверний ключ має обмежену кількість запитів на годину.
        </Text>
      </Stack>

      <Paper withBorder p="md">
        <Stack>
          <Select
            label="Спеціальність"
            placeholder="-- Всі спеціальності --"
            data={specialtyOptions}
            value={selectedSpecialtyId}
            onChange={handleSpecialtyChange}
            disabled={isGenerating || isLoading}
            searchable
            clearable
          />

          <Select
            label="Дисципліна"
            placeholder={!selectedSpecialtyId ? "Спочатку оберіть спеціальність" : "-- Оберіть дисципліну --"}
            data={courseOptions}
            value={selectedCourseId}
            onChange={setSelectedCourseId}
            disabled={isGenerating || !selectedSpecialtyId || isLoadingCourses}
            searchable
            clearable
          />

          <Select
            label="Шаблон"
            placeholder="-- Оберіть шаблон --"
            data={templateOptions}
            value={selectedTemplateId}
            onChange={(value) => {
              setSelectedTemplateId(value);
              setParameterValues({});
            }}
            disabled={isGenerating || isLoading}
            searchable
            clearable
          />

          <TemplateParametersInput
            parameters={templateParameters}
            values={parameterValues}
            disabled={isGenerating}
            courseId={selectedCourseId ? Number(selectedCourseId) : undefined}
            onChange={setParameterValues}
          />
        </Stack>
      </Paper>

      {isGenerating && (
        <Paper withBorder p="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={500}>Генерація...</Text>
              <Text>{progress}%</Text>
            </Group>
            <Progress value={progress} animated />
          </Stack>
        </Paper>
      )}

      <Group align="center">
        <Button
          leftSection={<FontAwesomeIcon icon={faDownload} />}
          onClick={() => handleGenerate(false)}
          disabled={isGenerating || !selectedCourseId || !selectedTemplateId}
          loading={isGenerating && !navigateToEdit}
          color="green"
        >
          Згенерувати
        </Button>
        <Button
          leftSection={<FontAwesomeIcon icon={faEdit} />}
          onClick={() => handleGenerate(true)}
          disabled={isGenerating || !selectedCourseId || !selectedTemplateId}
          loading={isGenerating && navigateToEdit}
          color="blue"
        >
          Згенерувати і редагувати
        </Button>
        {isGenerating && (
          <Text size="sm" c="dimmed">
            Генерація може зайняти близько 20 хв, в залежності від кількості матеріалу
          </Text>
        )}
      </Group>
    </Stack>
  );
}
