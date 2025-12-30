import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Course, GeneratedCourseData, Prompt, QuizQuestion } from "@/stores/models";
import toast from "react-hot-toast";
import { dropEmpty } from "../util/util";
import { loadAllTemplates } from "../templates";
import GeneratedFieldEditor from "../components/GeneratedFieldEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTimes } from "@fortawesome/free-solid-svg-icons";

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

export default function CourseGeneratedDataEdit() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [generatedValues, setGeneratedValues] = useState<GeneratedCourseData>({} as GeneratedCourseData);
  const [coursePrompts, setCoursePrompts] = useState<Prompt[]>([]);
  const [isLoadingCourse, setIsLoadingCourse] = useState(true);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;

    const fetchCourse = async () => {
      setIsLoadingCourse(true);
      try {
        const response = await fetch(`/api/courses/${courseId}`);
        if (!response.ok) {
          throw new Error("Failed to load course");
        }
        const data = await response.json() as Course;
        setCourse(data);
        setGeneratedValues((data.generated || {}) as GeneratedCourseData);
      } catch (error) {
        console.error("Error fetching course:", error);
        toast.error("Помилка завантаження курсу");
      } finally {
        setIsLoadingCourse(false);
      }
    };

    void fetchCourse();
  }, [courseId]);

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
            if (prompt.type !== "course") return;
            if (!prompt.field) return;
            if (!map.has(prompt.field)) {
              map.set(prompt.field, prompt);
            }
          });
        });

        const promptList = Array.from(map.values()).sort((a, b) =>
          (a.name || a.field).localeCompare(b.name || b.field, "uk")
        );

        setCoursePrompts(promptList);
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

    coursePrompts.forEach((prompt) => {
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
  }, [coursePrompts, generatedValues]);

  const isLoading = isLoadingCourse || isLoadingPrompts;

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

  const handleSave = async () => {
    if (!course || !courseId) return;

    setIsSaving(true);

    try {
      const generated: GeneratedCourseData = dropEmpty({ ...generatedValues });
      const updatedCourse: Course = { ...course, generated };

      const response = await fetch(`/api/courses/${courseId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updatedCourse)
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      toast.success("Дані успішно збережено");
      navigate(`/courses/${courseId}`);
    } catch (error) {
      console.error("Error saving course:", error);
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

  if (!course) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-amber-50 font-mono">Курс не знайдено</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="font-mono">Редагувати згенеровані дані: {course.name}</h1>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="text-amber-50 hover:text-green-400 hover:opacity-100 transition-opacity p-1.5 rounded disabled:opacity-30 cursor-pointer"
            >
              <FontAwesomeIcon icon={faCheck} />
            </button>
            <button
              onClick={() => navigate(`/courses/${courseId}`)}
              className="text-amber-50 hover:text-red-400 cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>

        <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-3 font-mono flex flex-col gap-4">
          {templatesError && (
            <div className="text-red-400 text-sm">{templatesError}</div>
          )}

          {fieldDescriptors.length === 0 ? (
            <div className="text-amber-50/70 text-sm">
              Немає доступних згенерованих полів для редагування. Додайте промпти для дисципліни у шаблонах, щоб з'явилися поля.
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
                   courseId={courseId ? parseInt(courseId) : undefined}
                   prompt={prompt}
                 />
               ))}
            </div>
          )}         
        </div>
      </div>
    </div>
  );
}
