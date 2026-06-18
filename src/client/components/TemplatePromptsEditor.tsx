import { useState } from "react";
import type { Prompt } from "@/stores/models";
import PromptEditor from "./PromptEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen } from "@fortawesome/free-solid-svg-icons";
import {
  Stack,
  Group,
  Text,
  Select,
  Button,
  Paper,
  ActionIcon,
  Tooltip,
  Divider,
} from "@mantine/core";

interface TemplatePromptsEditorProps {
  prompts: Prompt[];
  onChange: (prompts: Prompt[]) => void;
}

export default function TemplatePromptsEditor({ prompts, onChange }: TemplatePromptsEditorProps) {
  const [editingPromptIndex, setEditingPromptIndex] = useState<number | null>(null);
  const [selectedPromptType, setSelectedPromptType] = useState<"course" | "topic">("course");

  const handleAddPrompt = () => {
    const newPrompt: Prompt = {
      name: "",
      type: selectedPromptType,
      field: "",
      model: "gpt-4o",
      format: "text",
      system_prompt: 'Ти асистент викладача з дисципліни "{{courseName}}". Опис: {{courseDescription}}',
      prompt: "",
    };
    onChange([...prompts, newPrompt]);
    setEditingPromptIndex(prompts.length);
  };

  const handleSavePrompt = async (prompt: Prompt) => {
    const updated = [...prompts];
    if (editingPromptIndex !== null) updated[editingPromptIndex] = prompt;
    onChange(updated);
    setEditingPromptIndex(null);
  };

  const handleDeletePrompt = (index: number) => {
    const updated = [...prompts];
    updated.splice(index, 1);
    onChange(updated);
    if (editingPromptIndex === index) {
      setEditingPromptIndex(null);
    } else if (editingPromptIndex !== null && editingPromptIndex > index) {
      setEditingPromptIndex(editingPromptIndex - 1);
    }
  };

  return (
    <Stack gap="sm">
      <Divider label="Промпти шаблону" labelPosition="left" />

      <Group justify="space-between">
        <Select
          data={[
            { value: "course", label: "Дисципліна" },
            { value: "topic", label: "Тема" },
          ]}
          value={selectedPromptType}
          onChange={(v) => v && setSelectedPromptType(v as "course" | "topic")}
          w={160}
        />
        <Button leftSection={<FontAwesomeIcon icon={faPlus} />} variant="default" onClick={handleAddPrompt}>
          Додати промпт
        </Button>
      </Group>

      {prompts.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          Немає промптів. Промпти використовуються для генерації контенту за допомогою AI й результати можуть
          бути використані в шаблоні як параметри. Наприклад, промпт з назвою 'selfMethodGoal' для дисципліни
          буде доступний в шаблоні як 'course.generated.selfMethodGoal'.
        </Text>
      ) : (
        <Stack gap="xs">
          {prompts.map((prompt, index) => (
            <Paper key={index} withBorder p="sm">
              {editingPromptIndex === index ? (
                <PromptEditor
                  prompt={prompt}
                  selectedType={prompt.type}
                  onSave={handleSavePrompt}
                  onCancel={() => setEditingPromptIndex(null)}
                />
              ) : (
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={600} truncate>
                      {prompt.field || "(Без назви)"}{" "}
                      <Text span c="dimmed" size="sm">({prompt.type === "course" ? "Дисципліна" : "Тема"})</Text>
                    </Text>
                    <Text size="xs" c="dimmed">Модель: {prompt.model}</Text>
                  </Stack>
                  <Group gap="xs" wrap="nowrap">
                    <Tooltip label="Редагувати">
                      <ActionIcon variant="subtle" onClick={() => setEditingPromptIndex(index)}>
                        <FontAwesomeIcon icon={faPen} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Видалити">
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDeletePrompt(index)}>
                        <FontAwesomeIcon icon={faTrash} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
