import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CourseTopic, GeneratedTopicData, Prompt, QuizQuestion } from "@/stores/models";
import toast from "react-hot-toast";
import { dropEmpty } from "../util/util";
import GeneratedFieldEditor from "../components/GeneratedFieldEditor";
import { loadAllTemplates } from "../templates";
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

export default function TopicGeneratedDataEdit() {
  const { courseId, topicIndex } = useParams<{ courseId: string; topicIndex: string }>();
  const navigate = useNavigate();

  const [topic, setTopic] = useState<CourseTopic | null>(null);
  const [generatedValues, setGeneratedValues] = useState<GeneratedTopicData>({} as GeneratedTopicData);
  const [topicPrompts, setTopicPrompts] = useState<Prompt[]>([]);
  const [isLoadingTopic, setIsLoadingTopic] = useState(true);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId || !topicIndex) return;
    let cancelled = false;
    setIsLoadingTopic(true);
    fetch(`/api/courses/${courseId}/topics/${topicIndex}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() as Promise<CourseTopic>; })
      .then((data) => { if (!cancelled) { setTopic(data); setGeneratedValues((data.generated || {}) as GeneratedTopicData); } })
      .catch(() => { if (!cancelled) { toast.error("Помилка завантаження теми"); setTopic(null); } })
      .finally(() => { if (!cancelled) setIsLoadingTopic(false); });
    return () => { cancelled = true; };
  }, [courseId, topicIndex]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingPrompts(true);
    loadAllTemplates()
      .then((templates) => {
        if (cancelled) return;
        const map = new Map<string, Prompt>();
        templates.forEach((t) => (t.prompts || []).forEach((p) => { if (p.type === "topic" && p.field && !map.has(p.field)) map.set(p.field, p); }));
        setTopicPrompts(Array.from(map.values()).sort((a, b) => (a.name || a.field).localeCompare(b.name || b.field, "uk")));
        setTemplatesError(null);
      })
      .catch(() => { if (!cancelled) { setTemplatesError("Не вдалося завантажити шаблони"); toast.error("Не вдалося завантажити шаблони"); } })
      .finally(() => { if (!cancelled) setIsLoadingPrompts(false); });
    return () => { cancelled = true; };
  }, []);

  const fieldDescriptors = useMemo<FieldDescriptor[]>(() => {
    const descriptors: FieldDescriptor[] = [];
    const seen = new Set<string>();
    topicPrompts.forEach((p) => { if (!p.field) return; descriptors.push({ field: p.field, prompt: p, format: p.format || "text", value: generatedValues?.[p.field] }); seen.add(p.field); });
    Object.keys(generatedValues || {}).forEach((f) => { if (seen.has(f)) return; descriptors.push({ field: f, format: inferFormat(generatedValues[f]), value: generatedValues[f] }); seen.add(f); });
    return descriptors;
  }, [topicPrompts, generatedValues]);

  const handleFieldChange = (field: string, value: string | string[] | QuizQuestion[] | null) => {
    setGeneratedValues((prev) => {
      if (value === null || value === undefined) { const next = { ...prev }; delete next[field]; return next; }
      return { ...prev, [field]: value };
    });
  };

  const buildPayload = (): GeneratedTopicData => {
    const cleaned = {} as GeneratedTopicData;
    Object.entries(generatedValues || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) (cleaned as Record<string, unknown>)[k] = v; });
    return dropEmpty({ ...cleaned }) as GeneratedTopicData;
  };

  const saveTopicData = async (): Promise<boolean> => {
    if (!topic || !courseId || !topicIndex) return false;
    const updated: CourseTopic = { ...topic, generated: buildPayload() };
    const r = await fetch(`/api/courses/${courseId}/topics/${topicIndex}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
    if (!r.ok) throw new Error("Failed to save");
    setTopic(updated);
    setGeneratedValues((updated.generated || {}) as GeneratedTopicData);
    return true;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try { await saveTopicData(); toast.success("Дані успішно збережено"); navigate(`/courses/${courseId}`); }
    catch { toast.error("Помилка збереження даних"); }
    finally { setIsSaving(false); }
  };

  const handleSaveAndNext = async () => {
    if (!topic) return;
    setIsSaving(true);
    try {
      await saveTopicData();
      const r = await fetch(`/api/courses/${courseId}/topics`);
      if (!r.ok) throw new Error();
      const all = await r.json() as CourseTopic[];
      const next = all.find((t) => t.index === topic.index + 1);
      if (next) { toast.success("Дані збережено, перехід до наступної теми"); navigate(`/courses/${courseId}/topics/${next.index}/generated`); }
      else { toast.success("Дані збережено. Це остання тема"); navigate(`/courses/${courseId}`); }
    } catch { toast.error("Помилка збереження даних"); }
    finally { setIsSaving(false); }
  };

  if (isLoadingTopic || isLoadingPrompts) return <Center h={200}><Loader /></Center>;
  if (!topic) return <Center h={200}><Text c="dimmed">Тема не знайдена</Text></Center>;

  return (
    <Stack maw={1200} mx="auto">
      <Title order={2}>Згенеровані дані: {topic.name}</Title>

      <Paper withBorder p="md">
        <Stack>
          {templatesError && <Text c="red" size="sm">{templatesError}</Text>}
          {fieldDescriptors.length === 0 ? (
            <Text size="sm" c="dimmed">
              Немає доступних згенерованих полів для редагування. Додайте промпти для тем у шаблонах, щоб з'явилися поля.
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
                topicId={topicIndex ? parseInt(topicIndex) : undefined}
                prompt={prompt}
              />
            ))
          )}

          <Group>
            <Button onClick={handleSave} loading={isSaving}>Зберегти</Button>
            <Button color="blue" onClick={handleSaveAndNext} loading={isSaving}>Зберегти &gt;&gt;</Button>
            <Button variant="default" onClick={() => navigate(`/courses/${courseId}`)}>Скасувати</Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
