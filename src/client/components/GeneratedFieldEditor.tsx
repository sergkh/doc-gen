import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faRotateRight, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import type { Prompt, QuizQuestion } from "@/stores/models";
import QuizEditor from "./QuizEditor";
import toast from "react-hot-toast";
import {
  Stack,
  Group,
  Paper,
  Text,
  TextInput,
  Textarea,
  ActionIcon,
  Tooltip,
  Button,
} from "@mantine/core";

type GeneratedFieldEditorProps = {
  field: string;
  promptName?: string;
  format: Prompt["format"];
  value?: string | string[] | QuizQuestion[];
  onChange: (value: string | string[] | QuizQuestion[] | null) => void;
  courseId?: number;
  topicId?: number;
  prompt?: Prompt;
  apiKey?: string;
};

function GenerateItemButton({ prompt, onGenerate }: { prompt?: Prompt; onGenerate: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  if (!prompt) return null;
  return (
    <Tooltip label="Згенерувати більше елементів">
      <ActionIcon
        variant="subtle"
        onClick={async () => { setLoading(true); try { await onGenerate(); } finally { setLoading(false); } }}
        loading={loading}
      >
        <FontAwesomeIcon icon={faWandMagicSparkles} />
      </ActionIcon>
    </Tooltip>
  );
}

export default function GeneratedFieldEditor({
  field, promptName, format, value, onChange, courseId, topicId, prompt, apiKey,
}: GeneratedFieldEditorProps) {
  const [newListItem, setNewListItem] = useState("");

  const textValue = typeof value === "string" ? value : "";
  const listValue = format === "list" && Array.isArray(value) ? (value as string[]) : [];
  const quizValue = format === "quiz" && Array.isArray(value) ? (value as QuizQuestion[]) : [];

  const handleReset = () => { onChange(null); setNewListItem(""); };

  const handleAddListItem = () => {
    if (!newListItem.trim()) return;
    onChange([...listValue, newListItem.trim()]);
    setNewListItem("");
  };

  const handleGenerateMoreItems = async () => {
    if (!courseId || !prompt) return;
    try {
      let endpoint = `/api/courses/${courseId}/run-prompt`;
      if (topicId) endpoint = `/api/courses/${courseId}/topics/${topicId}/run-prompt`;
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: { ...prompt, type: topicId ? "topic" : "course" }, ...(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}) }),
      });
      if (!r.ok) throw new Error((await r.text()) || "Не вдалося згенерувати елементи");
      const data = await r.json();
      if (data.item && Array.isArray(data.item)) {
        if (format === "list") onChange([...listValue, ...data.item.filter((i: any) => typeof i === "string")]);
        else if (format === "quiz") onChange([...quizValue, ...data.item.filter((i: any) => i?.question && Array.isArray(i.options) && typeof i.answerIndex === "number")]);
      }
    } catch (error) {
      toast.error(`Не вдалося згенерувати: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const renderEditor = () => {
    switch (format) {
      case "list":
        return (
          <Stack gap="xs">
            {listValue.map((item, index) => (
              <Group key={`${field}-item-${index}`} gap="xs" wrap="nowrap">
                <TextInput
                  style={{ flex: 1 }}
                  value={item}
                  onChange={(e) => { const next = [...listValue]; next[index] = e.currentTarget.value; onChange(next); }}
                  placeholder={`Елемент ${index + 1}`}
                />
                <ActionIcon variant="subtle" color="red" onClick={() => onChange(listValue.filter((_, i) => i !== index))}>
                  <FontAwesomeIcon icon={faTrash} />
                </ActionIcon>
              </Group>
            ))}
            <Group gap="xs" wrap="nowrap">
              <TextInput
                style={{ flex: 1 }}
                value={newListItem}
                onChange={(e) => setNewListItem(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddListItem(); } }}
                placeholder="Додати значення"
              />
              <ActionIcon variant="subtle" onClick={handleAddListItem}>
                <FontAwesomeIcon icon={faPlus} />
              </ActionIcon>
            </Group>
          </Stack>
        );
      case "quiz":
        return <QuizEditor quiz={quizValue} onQuizChange={(next) => onChange(next)} />;
      default:
        return (
          <Textarea
            value={textValue}
            onChange={(e) => onChange(e.currentTarget.value)}
            placeholder="Введіть значення"
            autosize
            minRows={4}
          />
        );
    }
  };

  return (
    <Paper withBorder p="sm">
      <Stack gap="sm">
        <Group justify="space-between">
          <Stack gap={2}>
            <Text fw={600}>{promptName || field}</Text>
            <Text size="xs" c="dimmed">{field}</Text>
          </Stack>
          <Group gap="xs">
            <Tooltip label="Скинути значення">
              <ActionIcon variant="subtle" onClick={handleReset}>
                <FontAwesomeIcon icon={faRotateRight} />
              </ActionIcon>
            </Tooltip>
            <GenerateItemButton prompt={prompt} onGenerate={handleGenerateMoreItems} />
          </Group>
        </Group>
        {renderEditor()}
      </Stack>
    </Paper>
  );
}
