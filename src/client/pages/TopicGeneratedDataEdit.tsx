import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CourseTopic, GeneratedTopicData, Prompt, QuizQuestion } from "@/stores/models";
import toast from "react-hot-toast";
import { dropEmpty } from "../util/util";
import GeneratedFieldEditor from "../components/GeneratedFieldEditor";
import { loadAllTemplates } from "../templates";

interface FieldDescriptor {
  field: string;
  prompt?: Prompt;
  format: Prompt["format"];
  value: unknown;
}

const inferFormat = (value: unknown): Prompt["format"] => {
  if (Array.isArray(value)) {
    if (value.some((item) => typeof item === "object" && item !== null)) {
      return "quiz";
    }
    return "list";
  }

  return "text";
};

export default function TopicGeneratedDataEdit() {
  const { courseId, topicId } = useParams<{ courseId: string; topicId: string }>();
  const navigate = useNavigate();

  const [topic, setTopic] = useState<CourseTopic | null>(null);
  const [generatedValues, setGeneratedValues] = useState<GeneratedTopicData>({} as GeneratedTopicData);
  const [topicPrompts, setTopicPrompts] = useState<Prompt[]>([]);
  const [isLoadingTopic, setIsLoadingTopic] = useState(true);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId || !topicId) return;
    let cancelled = false;

    const fetchTopic = async () => {
      setIsLoadingTopic(true);
      try {
        const response = await fetch(`/api/courses/${courseId}/topics/${topicId}`);
        if (!response.ok) {
          throw new Error("Failed to load topic");
        }
        const data = await response.json() as CourseTopic;
        if (cancelled) return;
        setTopic(data);
        setGeneratedValues((data.generated || {}) as GeneratedTopicData);
      } catch (error) {
        if (cancelled) return;
        console.error("Error fetching topic:", error);
        toast.error("Помилка завантаження теми");
        setTopic(null);
      } finally {
        if (!cancelled) {
          setIsLoadingTopic(false);
        }
      }
    };

    void fetchTopic();

    return () => {
      cancelled = true;
    };
  }, [courseId, topicId]);

  useEffect(() => {
    let cancelled = false;

    const fetchTemplates = async () => {
      setIsLoadingPrompts(true);
      try {
        const templates = await loadAllTemplates();
        if (cancelled) return;

        const map = new Map<string, Prompt>();
        templates.forEach((template) => {
          (template.prompts || []).forEach((prompt) => {
            if (prompt.type !== "topic") return;
            if (!prompt.field) return;
            if (!map.has(prompt.field)) {
              map.set(prompt.field, prompt);
            }
          });
        });

        const promptList = Array.from(map.values()).sort((a, b) =>
          (a.name || a.field).localeCompare(b.name || b.field, "uk")
        );

        setTopicPrompts(promptList);
        setTemplatesError(null);
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading templates:", error);
        setTemplatesError("Не вдалося завантажити шаблони");
        toast.error("Не вдалося завантажити шаблони");
      } finally {
        if (!cancelled) {
          setIsLoadingPrompts(false);
        }
      }
    };

    void fetchTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  const fieldDescriptors = useMemo<FieldDescriptor[]>(() => {
    const descriptors: FieldDescriptor[] = [];
    const seen = new Set<string>();

    topicPrompts.forEach((prompt) => {
      if (!prompt.field) return;
      descriptors.push({
        field: prompt.field,
        prompt,
        format: prompt.format || "text",
        value: generatedValues?.[prompt.field]
      });
      seen.add(prompt.field);
    });

    Object.keys(generatedValues || {}).forEach((field) => {
      if (seen.has(field)) return;
      descriptors.push({
        field,
        format: inferFormat(generatedValues[field]),
        value: generatedValues[field]
      });
      seen.add(field);
    });

    return descriptors;
  }, [topicPrompts, generatedValues]);

  const isLoading = isLoadingTopic || isLoadingPrompts;

  const handleFieldChange = (field: string, value: string | string[] | QuizQuestion[] | null) => {
    setGeneratedValues((prev) => {
      if (value === null || value === undefined) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const buildGeneratedPayload = (): GeneratedTopicData => {
    const cleanedEntries = {} as GeneratedTopicData;
    Object.entries(generatedValues || {}).forEach(([key, val]) => {
      if (val === undefined || val === null) {
        return;
      }
      (cleanedEntries as Record<string, unknown>)[key] = val;
    });

    return dropEmpty({ ...cleanedEntries }) as GeneratedTopicData;
  };

  const saveTopicData = async (): Promise<boolean> => {
    if (!topic || !courseId || !topicId) return false;

    const generated = buildGeneratedPayload();
    const updatedTopic: CourseTopic = { ...topic, generated };

    const response = await fetch(`/api/courses/${courseId}/topics/${topicId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updatedTopic)
    });

    if (!response.ok) {
      throw new Error("Failed to save");
    }

    setTopic(updatedTopic);
    setGeneratedValues((updatedTopic.generated || {}) as GeneratedTopicData);
    return true;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveTopicData();
      toast.success("Дані успішно збережено");
      navigate(`/courses/${courseId}`);
    } catch (error) {
      console.error("Error saving topic:", error);
      toast.error("Помилка збереження даних");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndNext = async () => {
    if (!topic) return;

    setIsSaving(true);

    try {
      await saveTopicData();

      const topicsResponse = await fetch(`/api/courses/${courseId}/topics`);
      if (!topicsResponse.ok) {
        throw new Error("Failed to fetch topics");
      }
      const allTopics = await topicsResponse.json() as CourseTopic[];
      const nextTopic = allTopics.find((t) => t.index === topic.index + 1);

      if (nextTopic) {
        toast.success("Дані збережено, перехід до наступної теми");
        navigate(`/courses/${courseId}/topics/${nextTopic.id}/generated`);
      } else {
        toast.success("Дані збережено. Це остання тема");
        navigate(`/courses/${courseId}`);
      }
    } catch (error) {
      console.error("Error saving and moving to next topic:", error);
      toast.error("Помилка збереження даних");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-amber-50 font-mono">Завантаження...</div>
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-amber-50 font-mono">Тема не знайдена</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <h1 className="font-mono">Редагувати згенеровані дані: {topic.name}</h1>

        <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-3 font-mono flex flex-col gap-4">
          {templatesError && (
            <div className="text-red-400 text-sm">{templatesError}</div>
          )}

          {fieldDescriptors.length === 0 ? (
            <div className="text-amber-50/70 text-sm">
              Немає доступних згенерованих полів для редагування. Додайте промпти для тем у шаблонах, щоб з'явилися поля.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {fieldDescriptors.map(({ field, prompt, format, value }) => (
                <GeneratedFieldEditor
                  key={field}
                  field={field}
                  promptName={prompt?.name}
                  format={format}
                  value={value as string | string[] | QuizQuestion[] | undefined}
                  onChange={(val) => handleFieldChange(field, val)}
                />
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2 flex-wrap">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
            >
              {isSaving ? "Збереження..." : "Зберегти"}
            </button>
            <button
              onClick={handleSaveAndNext}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
            >
              {isSaving ? "Збереження..." : "Зберегти >>"}
            </button>
            <button
              onClick={() => navigate(`/courses/${courseId}`)}
              className="bg-gray-600 hover:bg-gray-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
            >
              Скасувати
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
