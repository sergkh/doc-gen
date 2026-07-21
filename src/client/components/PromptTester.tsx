import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave } from "@fortawesome/free-solid-svg-icons";
import type { Prompt, KeyValue, CourseTopic, PromptResult, Specialty } from "@/stores/models";
import { loadCoursesBySpecialty } from "@/client/courses";
import { loadAllSpecialties } from "@/client/specialties";
import {
  Stack,
  Group,
  Text,
  Select,
  Button,
  Paper,
  ActionIcon,
  Tooltip,
  Collapse,
  Loader,
  Anchor,
  Code,
  Divider,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

interface PromptTesterProps {
  prompt: Prompt;
  promptType: "course" | "topic";
  field: string;
  model: string;
  format: Prompt["format"];
  systemPrompt: string;
  userPrompt: string;
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const json = JSON.parse(text);
    if (json.error) return json.error;
    if (json.message) return json.message;
    return text;
  } catch {
    if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
      const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
      return titleMatch?.[1] ?? fallback;
    }
    return text.length > 200 ? text.slice(0, 200) + "..." : text;
  }
}

function formatResult({ item }: PromptResult): string {
  if (typeof item === "string") return item;
  if (Array.isArray(item)) return item.map((i) => JSON.stringify(i, null, 2)).join("\n\n");
  return JSON.stringify(item, null, 2);
}

export default function PromptTester({
  prompt,
  promptType,
  field,
  model,
  format,
  systemPrompt,
  userPrompt,
}: PromptTesterProps) {
  const [opened, { toggle }] = useDisclosure(false);

  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [specialtiesError, setSpecialtiesError] = useState<string | null>(null);
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(false);
  const [hasRequestedSpecialties, setHasRequestedSpecialties] = useState(false);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>("");

  const [courses, setCourses] = useState<KeyValue[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [topics, setTopics] = useState<CourseTopic[]>([]);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [selectedTopicIndex, setSelectedTopicIndex] = useState<string>("");

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<PromptResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const savedSpecialtyId = localStorage.getItem("prompt_tester_specialty_id");
    if (savedSpecialtyId) setSelectedSpecialtyId(savedSpecialtyId);
    const savedCourseId = localStorage.getItem("prompt_tester_course_id");
    if (savedCourseId) setSelectedCourseId(savedCourseId);
    const savedTopicIndex = localStorage.getItem("prompt_tester_topic_index");
    if (savedTopicIndex) setSelectedTopicIndex(savedTopicIndex);
  }, []);

  useEffect(() => {
    if (selectedSpecialtyId) localStorage.setItem("prompt_tester_specialty_id", selectedSpecialtyId);
  }, [selectedSpecialtyId]);

  useEffect(() => {
    if (selectedCourseId) localStorage.setItem("prompt_tester_course_id", selectedCourseId);
  }, [selectedCourseId]);

  useEffect(() => {
    if (selectedTopicIndex) localStorage.setItem("prompt_tester_topic_index", selectedTopicIndex);
  }, [selectedTopicIndex]);

  useEffect(() => {
    setTestResult(null);
    setTestError(null);
    setSaveSuccess(false);
  }, [prompt]);

  const courseOptions = useMemo(
    () => [...courses].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: String(c.id), label: c.name })),
    [courses]
  );

  const specialtyOptions = useMemo(
    () => specialties.map((s) => ({
      value: String(s.id),
      label: `${s.code} ${s.name} (${s.degree === "master" ? "маг" : "бак"})`,
    })),
    [specialties]
  );

  const fetchSpecialties = useCallback(async () => {
    setIsLoadingSpecialties(true);
    setSpecialtiesError(null);
    try {
      const data = await loadAllSpecialties();
      setSpecialties(data);
      setSelectedSpecialtyId((prev) => {
        if (prev && data.some((s) => String(s.id) === prev)) return prev;
        return data[0] ? String(data[0].id) : "";
      });
    } catch (error) {
      setSpecialtiesError(error instanceof Error ? error.message : "Не вдалося завантажити список спеціальностей");
    } finally {
      setIsLoadingSpecialties(false);
    }
  }, []);

  const fetchCourses = useCallback(async (specialtyId: string) => {
    const parsedSpecialtyId = Number.parseInt(specialtyId, 10);
    if (Number.isNaN(parsedSpecialtyId)) {
      setCourses([]);
      setSelectedCourseId("");
      setCoursesError("ID спеціальності має бути числом");
      return;
    }

    setIsLoadingCourses(true);
    setCoursesError(null);
    try {
      const data = await loadCoursesBySpecialty(parsedSpecialtyId);
      const brief = data.map((c) => ({ id: c.id, name: c.name }));
      setCourses(brief);
      setSelectedCourseId((prev) => {
        if (prev && brief.some((c) => String(c.id) === prev)) return prev;
        return brief[0] ? String(brief[0].id) : "";
      });
    } catch (error) {
      setCoursesError(error instanceof Error ? error.message : "Не вдалося завантажити список дисциплін");
      setCourses([]);
      setSelectedCourseId("");
    } finally {
      setIsLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    if (!opened || hasRequestedSpecialties) return;
    setHasRequestedSpecialties(true);
    void fetchSpecialties();
  }, [opened, hasRequestedSpecialties, fetchSpecialties]);

  useEffect(() => {
    if (!opened || !selectedSpecialtyId) {
      setCourses([]);
      setSelectedCourseId("");
      return;
    }
    void fetchCourses(selectedSpecialtyId);
  }, [opened, selectedSpecialtyId, fetchCourses]);

  useEffect(() => {
    if (!opened) return;
    if (promptType !== "topic") {
      setTopics([]);
      setSelectedTopicIndex("");
      setTopicsError(null);
      return;
    }
    if (!selectedCourseId) {
      setTopics([]);
      setSelectedTopicIndex("");
      setTopicsError(null);
      return;
    }

    const courseId = Number.parseInt(selectedCourseId, 10);
    if (Number.isNaN(courseId)) {
      setTopicsError("ID дисципліни має бути числом");
      return;
    }

    let aborted = false;
    setIsLoadingTopics(true);
    setTopicsError(null);

    fetch(`/api/courses/${courseId}/topics`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await extractErrorMessage(r, "Не вдалося завантажити теми"));
        return r.json() as Promise<CourseTopic[]>;
      })
      .then((data) => {
        if (aborted) return;
        setTopics(data);
        setSelectedTopicIndex((prev) => {
          if (prev && data.some((t) => t.index === Number(prev))) return prev;
          return data[0] ? String(data[0].index) : "";
        });
      })
      .catch((error) => {
        if (aborted) return;
        setTopics([]);
        setSelectedTopicIndex("");
        setTopicsError(error instanceof Error ? error.message : "Не вдалося завантажити теми");
      })
      .finally(() => { if (!aborted) setIsLoadingTopics(false); });

    return () => { aborted = true; };
  }, [opened, promptType, selectedCourseId]);

  const canTest = useMemo(() => {
    if (isTesting || !selectedCourseId) return false;
    if (promptType === "topic" && !selectedTopicIndex) return false;
    return !!(field.trim() && systemPrompt.trim() && userPrompt.trim());
  }, [isTesting, selectedCourseId, selectedTopicIndex, promptType, field, systemPrompt, userPrompt]);

  const handleTestPrompt = async () => {
    const courseId = Number.parseInt(selectedCourseId, 10);
    if (Number.isNaN(courseId)) { setTestError("ID дисципліни має бути числом"); return; }

    let endpoint = `/api/courses/${courseId}/run-prompt`;
    if (promptType === "topic") {
      if (!selectedTopicIndex) { setTestError("Оберіть тему для тестування"); return; }
      const topicIndex = Number.parseInt(selectedTopicIndex, 10);
      if (Number.isNaN(topicIndex)) { setTestError("Індекс теми має бути числом"); return; }
      endpoint = `/api/courses/${courseId}/topics/${topicIndex}/run-prompt`;
    }

    const payload: Prompt = {
      ...prompt,
      type: promptType,
      field: field.trim(),
      model: model || "gpt-4o",
      format: format || "text",
      system_prompt: systemPrompt.trim(),
      prompt: userPrompt.trim(),
    };

    const savedApiKey = localStorage.getItem("openai_api_key");

    setIsTesting(true);
    setTestError(null);
    setTestResult(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: payload, ...(savedApiKey ? { apiKey: savedApiKey } : {}) }),
      });
      if (!response.ok) throw new Error(await extractErrorMessage(response, "Не вдалося протестувати промпт"));
      setTestResult(await response.json() as PromptResult);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Сталася невідома помилка");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveResult = async () => {
    if (!testResult || !selectedCourseId) return;
    const courseId = Number.parseInt(selectedCourseId, 10);
    if (Number.isNaN(courseId)) return;

    let endpoint = `/api/courses/${courseId}/save-prompt-result`;
    if (promptType === "topic") {
      if (!selectedTopicIndex) return;
      const topicIndex = Number.parseInt(selectedTopicIndex, 10);
      if (Number.isNaN(topicIndex)) return;
      endpoint = `/api/courses/${courseId}/topics/${topicIndex}/save-prompt-result`;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: testResult.field, item: testResult.item }),
      });
      if (!response.ok) throw new Error(await extractErrorMessage(response, "Не вдалося зберегти результат"));
      setSaveSuccess(true);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Сталася невідома помилка при збереженні");
    } finally {
      setIsSaving(false);
    }
  };

  const topicOptions = topics.map((t) => ({ value: String(t.index), label: t.name }));

  return (
    <Stack gap="xs">
      <Divider />
      <Button variant="subtle" onClick={toggle} justify="space-between" fullWidth>
        Протестувати промпт
      </Button>

      <Collapse in={opened}>
        <Stack gap="sm">
          <Select
            label="Спеціальність"
            placeholder="Оберіть спеціальність"
            data={specialtyOptions}
            value={selectedSpecialtyId || null}
            onChange={(v) => {
              setSelectedSpecialtyId(v ?? "");
              setSelectedCourseId("");
              setTopics([]);
              setSelectedTopicIndex("");
              setTopicsError(null);
            }}
            disabled={isLoadingSpecialties}
            searchable
            rightSection={isLoadingSpecialties ? <Loader size="xs" /> : undefined}
          />
          {specialtiesError && (
            <Group gap="xs">
              <Text size="xs" c="red">{specialtiesError}</Text>
              <Anchor size="xs" onClick={() => { setSpecialtiesError(null); void fetchSpecialties(); }}>
                Спробувати знову
              </Anchor>
            </Group>
          )}

          <Select
            label="Дисципліна"
            placeholder={!selectedSpecialtyId ? "Спочатку оберіть спеціальність" : "Оберіть дисципліну"}
            data={courseOptions}
            value={selectedCourseId || null}
            onChange={(v) => setSelectedCourseId(v ?? "")}
            disabled={isLoadingCourses || !selectedSpecialtyId}
            searchable
            rightSection={isLoadingCourses ? <Loader size="xs" /> : undefined}
          />
          {coursesError && (
            <Group gap="xs">
              <Text size="xs" c="red">{coursesError}</Text>
              <Anchor
                size="xs"
                onClick={() => {
                  setCoursesError(null);
                  if (selectedSpecialtyId) void fetchCourses(selectedSpecialtyId);
                }}
              >
                Спробувати знову
              </Anchor>
            </Group>
          )}

          {promptType === "topic" && (
            <>
              <Select
                label="Тема дисципліни"
                placeholder="Оберіть тему"
                data={topicOptions}
                value={selectedTopicIndex || null}
                onChange={(v) => setSelectedTopicIndex(v ?? "")}
                disabled={isLoadingTopics || !selectedCourseId}
                searchable
                rightSection={isLoadingTopics ? <Loader size="xs" /> : undefined}
              />
              {topicsError && <Text size="xs" c="red">{topicsError}</Text>}
              {!isLoadingTopics && !topicsError && selectedCourseId && topics.length === 0 && (
                <Text size="xs" c="dimmed">Для цієї дисципліни немає тем.</Text>
              )}
            </>
          )}

          <Group>
            <Button onClick={handleTestPrompt} disabled={!canTest} loading={isTesting}>
              Протестувати
            </Button>
            {testError && <Text size="sm" c="red">{testError}</Text>}
          </Group>

          {testResult && (
            <Paper withBorder p="sm">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={600} size="sm">Результат</Text>
                  <Tooltip label={saveSuccess ? "Збережено" : "Зберегти результат до дисципліни/теми"}>
                    <ActionIcon
                      variant={saveSuccess ? "filled" : "subtle"}
                      color={saveSuccess ? "green" : undefined}
                      onClick={handleSaveResult}
                      disabled={isSaving || saveSuccess}
                      loading={isSaving}
                    >
                      <FontAwesomeIcon icon={faSave} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <Code block mah={256} style={{ overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {formatResult(testResult)}
                </Code>

                <Text fw={600} size="sm">Системний промпт</Text>
                <Code block mah={256} style={{ overflowY: "auto", whiteSpace: "pre-wrap" }}>
                  {testResult.system_prompt || "Немає"}
                </Code>

                <Text fw={600} size="sm">Промпт</Text>
                <Code block mah={256} style={{ overflowY: "auto", whiteSpace: "pre-wrap" }}>
                  {testResult.prompt || "Немає"}
                </Code>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Collapse>
    </Stack>
  );
}
