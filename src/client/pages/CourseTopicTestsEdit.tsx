import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Accordion, Button, Center, Group, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import toast from "react-hot-toast";
import type { Course, CourseTopic, Prompt, QuizQuestion } from "@/stores/models";
import GeneratedFieldEditor from "../components/GeneratedFieldEditor";
import { loadAllTemplates } from "../templates";

const isQuizValue = (value: unknown): value is QuizQuestion[] =>
  Array.isArray(value) && value.some((item) => typeof item === "object" && item !== null && "question" in item && "options" in item);

export default function CourseTopicTestsEdit() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<CourseTopic[]>([]);
  const [quizPrompts, setQuizPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openedTopic, setOpenedTopic] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/courses/${courseId}`).then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<Course>;
      }),
      loadAllTemplates(),
    ])
      .then(([loadedCourse, templates]) => {
        if (cancelled) return;
        const prompts = new Map<string, Prompt>();
        templates.forEach((template) => template.prompts?.forEach((prompt) => {
          if (prompt.type === "topic" && prompt.format === "quiz" && prompt.field && !prompts.has(prompt.field)) {
            prompts.set(prompt.field, prompt);
          }
        }));
        setCourse(loadedCourse);
        setTopics(loadedCourse.topics ?? []);
        setQuizPrompts(Array.from(prompts.values()).sort((a, b) => (a.name || a.field).localeCompare(b.name || b.field, "uk")));
      })
      .catch(() => toast.error("Не вдалося завантажити тести дисципліни"))
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  const topicTestFields = useMemo(() => topics.map((topic) => {
    const fields = new Map<string, Prompt | undefined>();
    quizPrompts.forEach((prompt) => fields.set(prompt.field, prompt));
    Object.entries(topic.generated ?? {}).forEach(([field, value]) => {
      if (isQuizValue(value)) fields.set(field, fields.get(field));
    });
    return { topic, fields: Array.from(fields.entries()) };
  }), [topics, quizPrompts]);

  const changeTest = (topicIndex: number, field: string, value: QuizQuestion[] | null) => {
    setTopics((current) => current.map((topic) => {
      if (topic.index !== topicIndex) return topic;
      const generated = { ...(topic.generated ?? {}) };
      if (value === null) delete generated[field];
      else generated[field] = value;
      return { ...topic, generated };
    }));
  };

  const handleSave = async () => {
    if (!courseId) return;
    setIsSaving(true);
    try {
      // Each topic update saves the containing course. Keep these requests ordered so
      // one save cannot overwrite another topic's just-saved tests.
      for (const topic of topics) {
        const response = await fetch(`/api/courses/${courseId}/topics/${topic.index}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(topic),
        });
        if (!response.ok) throw new Error();
      }
      toast.success("Тести збережено");
      navigate(`/courses/${courseId}/generated`);
    } catch {
      toast.error("Не вдалося зберегти тести");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <Center h={200}><Loader /></Center>;
  if (!course) return <Center h={200}><Text c="dimmed">Дисципліну не знайдено</Text></Center>;

  const hasTests = topicTestFields.some(({ fields }) => fields.length > 0);

  return (
    <Stack maw={1200} mx="auto">
      <Group justify="space-between">
        <div>
          <Title order={2}>Тести за темами: {course.name}</Title>
          <Text size="sm" c="dimmed">Редагування тестових питань для всіх тем дисципліни</Text>
        </div>
        <Group gap="xs">
          <Button variant="default" onClick={() => navigate(`/courses/${courseId}/generated`)}>Назад</Button>
          <Button onClick={handleSave} loading={isSaving} disabled={!hasTests}>Зберегти всі тести</Button>
        </Group>
      </Group>

      {!hasTests ? (
        <Paper withBorder p="md"><Text c="dimmed">У темах ще немає тестів. Додайте промпт теми у форматі «Тестові питання» або згенеруйте тести для тем.</Text></Paper>
      ) : (
        <Accordion value={openedTopic} onChange={setOpenedTopic} variant="contained">
          {topicTestFields.map(({ topic, fields }) => {
            const topicValue = String(topic.index);
            const testCount = fields.reduce((count, [field]) => count + ((topic.generated?.[field] as QuizQuestion[] | undefined)?.length ?? 0), 0);
            return <Accordion.Item key={topic.index} value={topicValue}>
              <Accordion.Control>
                <Group justify="space-between" gap="sm" wrap="nowrap" pr="sm">
                  <Text fw={600}>Тема {topic.index}. {topic.name}</Text>
                  <Text size="sm" c="dimmed">{testCount} питань</Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                {openedTopic === topicValue && (
                  <Stack>
                    {fields.length === 0 ? (
                      <Text size="sm" c="dimmed">Тестів для цієї теми немає.</Text>
                    ) : fields.map(([field, prompt]) => (
                      <GeneratedFieldEditor
                        key={field}
                        field={field}
                        promptName={prompt?.name}
                        format="quiz"
                        value={topic.generated?.[field] as QuizQuestion[] | undefined}
                        onChange={(value) => changeTest(topic.index, field, value as QuizQuestion[] | null)}
                        courseId={Number(courseId)}
                        topicId={topic.index}
                        prompt={prompt}
                        quizQuestionAutosize={false}
                      />
                    ))}
                  </Stack>
                )}
              </Accordion.Panel>
            </Accordion.Item>;
          })}
        </Accordion>
      )}
    </Stack>
  );
}
