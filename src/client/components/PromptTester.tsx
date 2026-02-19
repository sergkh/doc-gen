import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp, faSpinner, faSave } from "@fortawesome/free-solid-svg-icons";
import type { Prompt, KeyValue, CourseTopic, PromptResult } from "@/stores/models";
import { loadAllCoursesBrief } from "@/client/courses";

interface PromptTesterProps {
  prompt: Prompt;
  promptType: "course" | "topic";
  field: string;
  model: string;
  format: Prompt["format"];
  systemPrompt: string;
  userPrompt: string;
}

function formatResult({ item }: PromptResult): string {
  if (typeof item === "string") {
    return item;
  }

  if (Array.isArray(item)) {
    return item.map((i) => JSON.stringify(i, null, 2)).join("\n\n");
  }

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

  const [isTesterOpen, setIsTesterOpen] = useState(false);
  const [courses, setCourses] = useState<KeyValue[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [hasRequestedCourses, setHasRequestedCourses] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [topics, setTopics] = useState<CourseTopic[]>([]);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");

  const [testApiKey, setTestApiKey] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<PromptResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const savedApiKey = localStorage.getItem("openai_api_key");
    if (savedApiKey) setTestApiKey(savedApiKey);
  }, []);

  useEffect(() => {
    setTestResult(null);
    setTestError(null);
    setSaveSuccess(false);
  }, [prompt]);

  const courseOptions = useMemo(() => {
    const items = [...courses];
    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [courses]);

  const fetchCourses = useCallback(async () => {
    setIsLoadingCourses(true);
    setCoursesError(null);
    try {
      const data = await loadAllCoursesBrief();
      setCourses(data);
      setSelectedCourseId((prev) => {
        if (prev) {
          return prev;
        }
        const firstCourse = data[0];
        return firstCourse ? String(firstCourse.id) : "";
      });
    } catch (error) {
      setCoursesError(error instanceof Error ? error.message : "Не вдалося завантажити список дисциплін");
    } finally {
      setIsLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    if (!isTesterOpen) {
      return;
    }
    if (hasRequestedCourses) {
      return;
    }
    setHasRequestedCourses(true);
    void fetchCourses();
  }, [isTesterOpen, hasRequestedCourses, fetchCourses]);

  useEffect(() => {
    if (!isTesterOpen) {
      return;
    }
    if (promptType !== "topic") {
      setTopics([]);
      setSelectedTopicId("");
      setTopicsError(null);
      return;
    }
    if (!selectedCourseId) {
      setTopics([]);
      setSelectedTopicId("");
      setTopicsError(null);
      return;
    }

    let aborted = false;
    const courseId = Number.parseInt(selectedCourseId, 10);
    if (Number.isNaN(courseId)) {
      setTopics([]);
      setSelectedTopicId("");
      setTopicsError("ID дисципліни має бути числом");
      return;
    }

    setIsLoadingTopics(true);
    setTopicsError(null);

    fetch(`/api/courses/${courseId}/topics`)
      .then(async (response) => {
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Не вдалося завантажити теми");
        }
        return await response.json() as CourseTopic[];
      })
      .then((data) => {
        if (aborted) return;
        setTopics(data);
        setSelectedTopicId((prev) => {
          if (prev && data.some((topic) => topic.id === Number(prev))) {
            return prev;
          }
          const firstTopic = data[0];
          return firstTopic ? String(firstTopic.id) : "";
        });
      })
      .catch((error) => {
        if (aborted) return;
        setTopics([]);
        setSelectedTopicId("");
        setTopicsError(error instanceof Error ? error.message : "Не вдалося завантажити теми");
      })
      .finally(() => {
        if (aborted) return;
        setIsLoadingTopics(false);
      });

    return () => {
      aborted = true;
    };
  }, [isTesterOpen, promptType, selectedCourseId]);

  const handleTestPrompt = async () => {
    const normalizedField = field.trim();
    const normalizedSystemPrompt = systemPrompt.trim();
    const normalizedUserPrompt = userPrompt.trim();

    if (!normalizedField || !normalizedSystemPrompt || !normalizedUserPrompt) {
      setTestError("Заповніть поле, системний та користувацький промпт перед тестуванням");
      return;
    }

    if (!selectedCourseId) {
      setTestError("Оберіть дисципліну для тестування");
      return;
    }

    const courseId = Number.parseInt(selectedCourseId, 10);
    if (Number.isNaN(courseId)) {
      setTestError("ID дисципліни має бути числом");
      return;
    }

    let endpoint = `/api/courses/${courseId}/run-prompt`;

    if (promptType === "topic") {
      if (!selectedTopicId) {
        setTestError("Оберіть тему для тестування");
        return;
      }
      const topicId = Number.parseInt(selectedTopicId, 10);
      if (Number.isNaN(topicId)) {
        setTestError("ID теми має бути числом");
        return;
      }
      endpoint = `/api/courses/${courseId}/topics/${topicId}/run-prompt`;
    }

    const payload: Prompt = {
      ...prompt,
      type: promptType,
      field: normalizedField,
      model: model || "gpt-4o",
      format: format || "text",
      system_prompt: normalizedSystemPrompt,
      prompt: normalizedUserPrompt,
    };

    setIsTesting(true);
    setTestError(null);
    setTestResult(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: payload,
          ...(testApiKey.trim() ? { apiKey: testApiKey.trim() } : {}),
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Не вдалося протестувати промпт");
      }

      const data = await response.json() as PromptResult;
      setTestResult(data);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Сталася невідома помилка");
    } finally {
      setIsTesting(false);
    }
  };

  const canTest = useMemo(() => {
    if (isTesting) return false;
    if (!selectedCourseId) return false;
    if (promptType === "topic" && !selectedTopicId) return false;
    if (!field.trim() || !systemPrompt.trim() || !userPrompt.trim()) return false;
    return true;
  }, [isTesting, selectedCourseId, selectedTopicId, promptType, field, systemPrompt, userPrompt]);

  const handleSaveResult = async () => {
    if (!testResult || !selectedCourseId) return;

    const courseId = Number.parseInt(selectedCourseId, 10);
    if (Number.isNaN(courseId)) return;

    let endpoint = `/api/courses/${courseId}/save-prompt-result`;

    if (promptType === "topic") {
      if (!selectedTopicId) return;
      const topicId = Number.parseInt(selectedTopicId, 10);
      if (Number.isNaN(topicId)) return;
      endpoint = `/api/courses/${courseId}/topics/${topicId}/save-prompt-result`;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          field: testResult.field,
          item: testResult.item,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Не вдалося зберегти результат");
      }

      setSaveSuccess(true);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Сталася невідома помилка при збереженні");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border-t border-amber-50/20 pt-3">
      <button
        type="button"
        onClick={() => setIsTesterOpen((prev) => !prev)}
        className="w-full flex items-center justify-between text-left text-amber-50 font-bold px-3 py-2 bg-zinc-900/40 hover:bg-zinc-900/60 rounded-lg transition-colors"
      >
        <span>Протестувати промпт</span>
        <FontAwesomeIcon icon={isTesterOpen ? faChevronUp : faChevronDown} />
      </button>
      {isTesterOpen && (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <label className="block text-amber-50 font-bold mb-2">Дисципліна:</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full bg-transparent border border-amber-50/40 text-amber-50 font-mono text-sm py-1.5 px-2 rounded outline-none focus:border-amber-200"
              disabled={isLoadingCourses}
            >
              <option value="">Оберіть дисципліну</option>
              {courseOptions.map((course) => (
                <option key={course.id} value={course.id} className="bg-zinc-800 text-amber-50">
                  {course.name}
                </option>
              ))}
            </select>
            {isLoadingCourses && (
              <div className="text-amber-50/60 text-xs mt-1">Завантаження дисциплін...</div>
            )}
            {coursesError && (
              <div className="text-red-400 text-xs mt-1 flex items-center justify-between gap-2">
                <span>{coursesError}</span>
                <button
                  type="button"
                  onClick={() => {
                    setCoursesError(null);
                    void fetchCourses();
                  }}
                  className="text-amber-300 underline text-xs"
                >
                  Спробувати знову
                </button>
              </div>
            )}
          </div>

          {promptType === "topic" && (
            <div>
              <label className="block text-amber-50 font-bold mb-2">Тема дисципліни:</label>
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="w-full bg-transparent border border-amber-50/40 text-amber-50 font-mono text-sm py-1.5 px-2 rounded outline-none focus:border-amber-200"
                disabled={isLoadingTopics || !selectedCourseId}
              >
                <option value="">Оберіть тему</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id} className="bg-zinc-800 text-amber-50">
                    {topic.name}
                  </option>
                ))}
              </select>
              {isLoadingTopics && (
                <div className="text-amber-50/60 text-xs mt-1">Завантаження тем...</div>
              )}
              {topicsError && (
                <div className="text-red-400 text-xs mt-1">{topicsError}</div>
              )}
              {!isLoadingTopics && !topicsError && selectedCourseId && topics.length === 0 && (
                <div className="text-amber-50/60 text-xs mt-1">Для цієї дисципліни немає тем.</div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <button
              type="button"
              onClick={handleTestPrompt}
              disabled={!canTest}
              className="bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-zinc-900 font-bold px-4 py-2 rounded-lg transition-colors"
            >
              {isTesting ? "Обробка..." : "Протестувати"}
            </button>

            {isTesting && (
              <span className="ml-2 animate-spin">
                <FontAwesomeIcon icon={faSpinner} />
              </span>
            )}

            {testError && <div className="text-red-400 text-sm">{testError}</div>}
          </div>

          {testResult && (
            <div className="bg-zinc-900 border border-amber-50/30 rounded-lg p-3 text-left">
              <div className="flex items-center justify-between mb-2">
                <div className="text-amber-50 font-bold text-sm">Результат</div>
                <button
                  type="button"
                  onClick={handleSaveResult}
                  disabled={isSaving || saveSuccess}
                  className={`flex items-center gap-2 px-3 py-1 rounded text-sm font-semibold transition-colors ${
                    saveSuccess
                      ? "text-green-600 cursor-default"
                      : "text-amber-50 hover:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                  }`}
                  title={saveSuccess ? "Збережено" : "Зберегти результат до дисципліни/теми"}
                >
                  <FontAwesomeIcon icon={isSaving ? faSpinner : faSave } />
                </button>
              </div>
              <pre className="text-amber-50 text-xs whitespace-pre-wrap wrap-break-words max-h-64 overflow-auto mb-4">
                {formatResult(testResult)}
              </pre>

              <div className="text-amber-50 font-bold text-sm mb-2">Системний промпт</div>
              <pre className="text-amber-50 text-xs whitespace-pre-wrap wrap-break-words max-h-64 overflow-auto">
                {testResult.system_prompt || "Немає"}
              </pre>

              <div className="text-amber-50 font-bold text-sm mb-2">Промпт</div>
              <pre className="text-amber-50 text-xs whitespace-pre-wrap wrap-break-words max-h-64 overflow-auto">
                {testResult.prompt || "Немає"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
