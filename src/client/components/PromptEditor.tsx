import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { Prompt } from "@/stores/models";
import PromptTester from "./PromptTester";
import PromptTemplateTextarea from "./PromptTemplateTextarea";
import type { PromptVariable } from "../util/prompt-autocomplete";
import { AVAILABLE_MODELS, DEFAULT_AGENT_MODEL } from "@/ai/models";
import {
  Stack,
  Group,
  Text,
  TextInput,
  Select,
  Button,
} from "@mantine/core";

const AVAILABLE_FORMATS: Array<{ value: Prompt["format"]; label: string }> = [
  { value: "text", label: "Текст" },
  { value: "list", label: "Список" },
  { value: "quiz", label: "Тестові питання" },
];

interface PromptEditorProps {
  prompt: Prompt;
  selectedType: "course" | "topic";
  onSave: (prompt: Prompt) => Promise<void>;
  onCancel: () => void;
  availableVariables?: PromptVariable[];
}

export default function PromptEditor({ prompt, selectedType, onSave, onCancel, availableVariables = [] }: PromptEditorProps) {
  const promptType = selectedType ?? prompt.type;

  const [name, setName] = useState(prompt.name || "");
  const [field, setField] = useState(prompt.field);
  const [model, setModel] = useState(prompt.model || DEFAULT_AGENT_MODEL);
  const [format, setFormat] = useState<Prompt["format"]>(prompt.format || "text");
  const [systemPrompt, setSystemPrompt] = useState(prompt.system_prompt);
  const [userPrompt, setUserPrompt] = useState(prompt.prompt);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(prompt.name || "");
    setField(prompt.field);
    setModel(prompt.model || DEFAULT_AGENT_MODEL);
    setFormat(prompt.format || "text");
    setSystemPrompt(prompt.system_prompt);
    setUserPrompt(prompt.prompt);
  }, [prompt]);

  const handleSave = async () => {
    if (!name.trim() || !field.trim() || !systemPrompt.trim() || !userPrompt.trim()) {
      toast.error("Всі поля обов'язкові");
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        ...prompt,
        name: name.trim(),
        type: promptType,
        field: field.trim(),
        model: model || "gpt-5.6-luna",
        format: format || "text",
        system_prompt: systemPrompt.trim(),
        prompt: userPrompt.trim(),
      });
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error("Не вдалося зберегти промпт");
    } finally {
      setIsSaving(false);
    }
  };

  const isExistingPrompt = Boolean((prompt.name || "").trim() || (prompt.field || "").trim());

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={600}>{isExistingPrompt ? "Редагувати промпт" : "Додати промпт"}</Text>
        <Group gap="xs">
          <Button variant="default" onClick={onCancel} disabled={isSaving}>Скасувати</Button>
          <Button onClick={handleSave} loading={isSaving}>Оновити</Button>
        </Group>
      </Group>

      <TextInput
        label="Назва промпта"
        placeholder="Наприклад: Self Method Goal"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
      />
      <TextInput
        label="Поле"
        placeholder="Назва поля (наприклад: subtopics, keywords)"
        value={field}
        onChange={(e) => setField(e.currentTarget.value)}
      />
      <Group grow>
        <Select
          label="Модель"
          data={AVAILABLE_MODELS.map((m) => ({ value: m.id, label: m.name }))}
          value={model}
          onChange={(v) => v && setModel(v)}
        />
        <Select
          label="Формат відповіді"
          data={AVAILABLE_FORMATS.map((f) => ({ value: f.value as string, label: f.label }))}
          value={format}
          onChange={(v) => v && setFormat(v as Prompt["format"])}
        />
      </Group>
      <PromptTemplateTextarea
        label="Системний промпт"
        placeholder="Системний промпт"
        value={systemPrompt}
        onChange={setSystemPrompt}
        variables={availableVariables}
        minRows={2}
        maxRows={6}
      />
      <PromptTemplateTextarea
        label="Промпт"
        placeholder="Промпт користувача"
        value={userPrompt}
        onChange={setUserPrompt}
        variables={availableVariables}
        minRows={6}
        maxRows={20}
      />

      <PromptTester
        prompt={prompt}
        promptType={promptType}
        field={field}
        model={model}
        format={format}
        systemPrompt={systemPrompt}
        userPrompt={userPrompt}
      />
    </Stack>
  );
}
