import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Center, Group, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import toast from "react-hot-toast";
import type { CoursePractice, Prompt, QuizQuestion } from "@/stores/models";
import { loadAllTemplates } from "../templates";
import GeneratedFieldEditor from "../components/GeneratedFieldEditor";

function inferFormat(value: unknown): Prompt["format"] {
  if (!Array.isArray(value)) return "text";
  return value.some((item) => item && typeof item === "object") ? "quiz" : "list";
}

export default function PracticeGeneratedDataEdit() {
  const { courseId, topicIndex, practiceIndex } = useParams<{
    courseId: string; topicIndex: string; practiceIndex: string;
  }>();
  const navigate = useNavigate();
  const [practice, setPractice] = useState<CoursePractice | null>(null);
  const [values, setValues] = useState<NonNullable<CoursePractice["generated"]>>({});
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const endpoint = `/api/courses/${courseId}/topics/${topicIndex}/practices/${practiceIndex}/generated`;

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetch(endpoint).then((response) => {
        if (!response.ok) throw new Error("Заняття не знайдено");
        return response.json() as Promise<CoursePractice>;
      }),
      loadAllTemplates(),
    ]).then(([practiceResult, templatesResult]) => {
      if (cancelled) return;
      if (practiceResult.status === "fulfilled") {
        setPractice(practiceResult.value);
        setValues(practiceResult.value.generated ?? {});
      } else {
        toast.error("Не вдалося завантажити дані заняття");
      }
      if (templatesResult.status === "fulfilled") {
        const byField = new Map<string, Prompt>();
        templatesResult.value.forEach((template) => template.prompts.forEach((prompt) => {
          if (prompt.type === "practice" && prompt.field && !byField.has(prompt.field)) byField.set(prompt.field, prompt);
        }));
        setPrompts([...byField.values()].sort((left, right) =>
          (left.name || left.field).localeCompare(right.name || right.field, "uk")));
      } else {
        toast.error("Не вдалося завантажити промпти шаблонів");
      }
    })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [endpoint]);

  const fields = useMemo(() => {
    const known = new Set(prompts.map((prompt) => prompt.field));
    return [
      ...prompts.map((prompt) => ({ field: prompt.field, prompt, format: prompt.format })),
      ...Object.keys(values).filter((field) => !known.has(field)).map((field) => ({
        field, prompt: undefined, format: inferFormat(values[field]),
      })),
    ];
  }, [prompts, values]);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated: values }),
      });
      if (!response.ok) throw new Error();
      toast.success("Дані заняття збережено");
      navigate(`/courses/${courseId}`);
    } catch {
      toast.error("Не вдалося зберегти дані заняття");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Center h={200}><Loader /></Center>;
  if (!practice) return <Center h={200}><Text c="dimmed">Заняття не знайдено</Text></Center>;

  return (
    <Stack maw={1000} mx="auto">
      <Title order={2}>Згенеровані дані: {practice.name}</Title>
      <Paper withBorder p="md">
        <Stack>
          {fields.length === 0 && <Text c="dimmed">У шаблонах немає промптів для занять.</Text>}
          {fields.map(({ field, prompt, format }) => (
            <GeneratedFieldEditor
              key={field} field={field} promptName={prompt?.name} format={format}
              value={values[field] as string | string[] | QuizQuestion[] | undefined}
              onChange={(value) => setValues((current) => {
                if (value === null) {
                  const next = { ...current }; delete next[field]; return next;
                }
                return { ...current, [field]: value };
              })}
              courseId={Number(courseId)} topicId={Number(topicIndex)} practiceId={Number(practiceIndex)} prompt={prompt}
            />
          ))}
          <Group>
            <Button onClick={save} loading={saving}>Зберегти</Button>
            <Button variant="default" onClick={() => navigate(`/courses/${courseId}`)}>Скасувати</Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
