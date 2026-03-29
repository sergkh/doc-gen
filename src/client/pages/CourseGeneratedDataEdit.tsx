import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Course, GeneratedCourseData, Prompt, QuizQuestion } from "@/stores/models";
import toast from "react-hot-toast";
import { dropEmpty } from "../util/util";
import { loadAllTemplates } from "../templates";
import GeneratedFieldEditor from "../components/GeneratedFieldEditor";
import { Title, Stack, Group, Paper, Text, Button, Loader, Center } from "@mantine/core";

interface FieldDescriptor {
  field: string;
  prompt?: Prompt;
  format: Prompt["format"];
  value: unknown;
}

const inferFormat = (value: unknown): Prompt["format"] => {
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === "object" && item !== null) ? "quiz" : "list";
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
    setIsLoadingCourse(true);
    fetch(`/api/courses/${courseId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() as Promise<Course>; })
      .then((data) => { setCourse(data); setGeneratedValues((data.generated || {}) as GeneratedCourseData); })
      .catch(() => toast.error("Помилка завантаження курсу"))
      .finally(() => setIsLoadingCourse(false));
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingPrompts(true);
    loadAllTemplates()
      .then((templates) => {
        if (cancelled) return;
        const map = new Map<string, Prompt>();
        templates.forEach((t) => (t.prompts || []).forEach((p) => { if (p.type === "course" && p.field && !map.has(p.field)) map.set(p.field, p); }));
        setCoursePrompts(Array.from(map.values()).sort((a, b) => (a.name || a.field).localeCompare(b.name || b.field, "uk")));
        setTemplatesError(null);
      })
      .catch(() => { if (!cancelled) { setTemplatesError("Не вдалося завантажити шаблони"); toast.error("Не вдалося завантажити шаблони"); } })
      .finally(() => { if (!cancelled) setIsLoadingPrompts(false); });
    return () => { cancelled = true; };
  }, []);

  const fieldDescriptors = useMemo<FieldDescriptor[]>(() => {
    const descriptors: FieldDescriptor[] = [];
    const seen = new Set<string>();
    coursePrompts.forEach((p) => { if (!p.field) return; descriptors.push({ field: p.field, prompt: p, format: p.format || "text", value: generatedValues?.[p.field] }); seen.add(p.field); });
    Object.keys(generatedValues || {}).forEach((f) => { if (seen.has(f)) return; descriptors.push({ field: f, format: inferFormat(generatedValues[f]), value: generatedValues[f] }); seen.add(f); });
    return descriptors;
  }, [coursePrompts, generatedValues]);

  const handleFieldChange = (field: string, value: string | string[] | QuizQuestion[] | null) => {
    setGeneratedValues((prev) => {
      if (value === null || value === undefined) { const next = { ...prev }; delete next[field]; return next; }
      return { ...prev, [field]: value };
    });
  };

  const handleSave = async () => {
    if (!course || !courseId) return;
    setIsSaving(true);
    try {
      const r = await fetch(`/api/courses/${courseId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...course, generated: dropEmpty({ ...generatedValues }) }) });
      if (!r.ok) throw new Error();
      toast.success("Дані успішно збережено");
      navigate(`/courses/${courseId}`);
    } catch { toast.error("Помилка збереження даних"); }
    finally { setIsSaving(false); }
  };

  if (isLoadingCourse || isLoadingPrompts) return <Center h={200}><Loader /></Center>;
  if (!course) return <Center h={200}><Text c="dimmed">Курс не знайдено</Text></Center>;

  return (
    <Stack maw={1000} mx="auto">
      <Group justify="space-between">
        <Title order={2}>Згенеровані дані: {course.name}</Title>
        <Group gap="xs">
          <Button variant="default" onClick={() => navigate(`/courses/${courseId}`)}>Скасувати</Button>
          <Button onClick={handleSave} loading={isSaving}>Зберегти</Button>
        </Group>
      </Group>

      <Paper withBorder p="md">
        <Stack>
          {templatesError && <Text c="red" size="sm">{templatesError}</Text>}
          {fieldDescriptors.length === 0 ? (
            <Text size="sm" c="dimmed">
              Немає доступних згенерованих полів для редагування. Додайте промпти для дисципліни у шаблонах, щоб з'явилися поля.
            </Text>
          ) : (
            fieldDescriptors.map(({ field, prompt, format, value }) => (
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
            ))
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
