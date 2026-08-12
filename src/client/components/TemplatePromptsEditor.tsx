import { useState } from "react";
import type { Prompt } from "@/stores/models";
import PromptEditor from "./PromptEditor";
import type { PromptVariable } from "../util/prompt-autocomplete";
import { Reorder, useDragControls } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faGripVertical, faPlus, faTrash, faPen } from "@fortawesome/free-solid-svg-icons";
import { DEFAULT_AGENT_MODEL } from "@/ai/models";
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

const COMMON_COURSE_VARIABLES: PromptVariable[] = [
  { value: "courseName", label: "Назва дисципліни", source: "course" },
  { value: "courseDescription", label: "Опис дисципліни", source: "course" },
  { value: "topics", label: "Назви тем", source: "course" },
  { value: "subtopics", label: "Підтеми", source: "course" },
  { value: "course.name", label: "Назва дисципліни", source: "course" },
  { value: "course.teacher", label: "Викладач", source: "course" },
  { value: "course.data.description", label: "Опис дисципліни", source: "course" },
  { value: "course.data.ok_no", label: "Номер ОК", source: "course" },
  { value: "course.data.credits", label: "Кредити", source: "course" },
  { value: "course.data.hours", label: "Години", source: "course" },
  { value: "course.data.control_type", label: "Форма контролю", source: "course" },
  { value: "course.data.practice_type", label: "Тип практичних занять", source: "course" },
  { value: "course.data.specialty", label: "Спеціальність", source: "course" },
  { value: "course.data.area", label: "Галузь знань", source: "course" },
  { value: "course.data.prerequisites", label: "Пререквізити", source: "course" },
  { value: "course.data.postrequisites", label: "Постреквізити", source: "course" },
  { value: "course.data.literature.main", label: "Основна література", source: "course" },
  { value: "course.data.literature.additional", label: "Додаткова література", source: "course" },
  { value: "course.data.literature.internet", label: "Інтернет-ресурси", source: "course" },
];

const COURSE_VARIABLES: PromptVariable[] = [
  ...COMMON_COURSE_VARIABLES,
  { value: "hours.total", label: "Загальна кількість годин", source: "course" },
  { value: "hours.fulltime.lectures", label: "Лекції, денна форма", source: "course" },
  { value: "hours.fulltime.practicals", label: "Практичні, денна форма", source: "course" },
  { value: "hours.fulltime.srs", label: "Самостійна робота, денна форма", source: "course" },
  { value: "hours.inabscentia.lectures", label: "Лекції, заочна форма", source: "course" },
  { value: "hours.inabscentia.practicals", label: "Практичні, заочна форма", source: "course" },
  { value: "hours.inabscentia.srs", label: "Самостійна робота, заочна форма", source: "course" },
];

const TOPIC_VARIABLES: PromptVariable[] = [
  { value: "name", label: "Назва теми", source: "topic" },
  { value: "lection", label: "Назва лекції", source: "topic" },
  ...COMMON_COURSE_VARIABLES,
];

function variablesForPrompt(prompts: Prompt[], index: number): PromptVariable[] {
  const current = prompts[index];
  const generated = prompts.slice(0, index)
    .filter((candidate) => candidate.field.trim())
    .map((candidate) => ({
      value: candidate.field,
      label: candidate.name || candidate.field,
      source: "ai" as const,
    }));
  return [
    ...generated,
    ...(current?.type === "topic" ? TOPIC_VARIABLES : COURSE_VARIABLES),
  ];
}

type PromptItemProps = {
  prompt: Prompt;
  index: number;
  dragDisabled: boolean;
  onEdit: (index: number) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
};

function PromptItem({ prompt, index, dragDisabled, onEdit, onDuplicate, onDelete }: PromptItemProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={prompt}
      dragListener={false}
      dragControls={dragControls}
      style={{ listStyle: "none", position: "relative" }}
      whileDrag={{ scale: 1.01, zIndex: 10 }}
    >
      <Paper withBorder p="sm" shadow="xs">
        <Group justify="space-between" wrap="nowrap">
          <Tooltip label={dragDisabled ? "Завершіть редагування перед перетягуванням" : "Перетягніть для зміни порядку"}>
            <div
              aria-label="Змінити порядок промпта"
              style={{
                cursor: dragDisabled ? "not-allowed" : "grab",
                touchAction: "none",
                color: "var(--mantine-color-dimmed)",
                padding: "4px 2px",
                opacity: dragDisabled ? 0.45 : 1,
              }}
              onPointerDown={(event) => {
                if (!dragDisabled) dragControls.start(event);
              }}
            >
              <FontAwesomeIcon icon={faGripVertical} />
            </div>
          </Tooltip>

          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} truncate>
              {prompt.field || "(Без назви)"}{" "}
              <Text span c="dimmed" size="sm">({prompt.type === "course" ? "Дисципліна" : "Тема"})</Text>
            </Text>
            <Text size="xs" c="dimmed">Модель: {prompt.model}</Text>
          </Stack>
          <Group gap="xs" wrap="nowrap">
            <Tooltip label="Редагувати">
              <ActionIcon variant="subtle" onClick={() => onEdit(index)}>
                <FontAwesomeIcon icon={faPen} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Дублювати">
              <ActionIcon variant="subtle" onClick={() => onDuplicate(index)}>
                <FontAwesomeIcon icon={faCopy} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Видалити">
              <ActionIcon variant="subtle" color="red" onClick={() => onDelete(index)}>
                <FontAwesomeIcon icon={faTrash} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Paper>
    </Reorder.Item>
  );
}

export default function TemplatePromptsEditor({ prompts, onChange }: TemplatePromptsEditorProps) {
  const [editingPromptIndex, setEditingPromptIndex] = useState<number | null>(null);
  const [selectedPromptType, setSelectedPromptType] = useState<"course" | "topic">("course");

  const handleAddPrompt = () => {
    const newPrompt: Prompt = {
      name: "",
      type: selectedPromptType,
      field: "",
      model: DEFAULT_AGENT_MODEL,
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

  const handleDuplicatePrompt = (index: number) => {
    const original = prompts[index];
    if (!original) return;

    const existingFields = new Set(prompts.map((candidate) => candidate.field));
    let duplicateNumber = 1;
    let field = `${original.field}_copy`;
    while (existingFields.has(field)) {
      duplicateNumber += 1;
      field = `${original.field}_copy_${duplicateNumber}`;
    }
    const duplicate: Prompt = {
      ...original,
      name: `${original.name} (копія${duplicateNumber > 1 ? ` ${duplicateNumber}` : ""})`,
      field,
    };
    const updated = [...prompts];
    updated.splice(index + 1, 0, duplicate);
    onChange(updated);
    setEditingPromptIndex(index + 1);
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
        <Reorder.Group
          axis="y"
          values={prompts}
          onReorder={onChange}
          style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}
        >
          {prompts.map((prompt, index) => (
            editingPromptIndex === index ? (
              <div key={`prompt-editor-${prompt.type}-${prompt.field || index}`}>
                <PromptEditor
                  prompt={prompt}
                  selectedType={prompt.type}
                  availableVariables={variablesForPrompt(prompts, index)}
                  onSave={handleSavePrompt}
                  onCancel={() => setEditingPromptIndex(null)}
                />
              </div>
            ) : (
              <PromptItem
                key={`prompt-item-${prompt.type}-${prompt.field || prompt.name || index}`}
                prompt={prompt}
                index={index}
                dragDisabled={editingPromptIndex !== null}
                onEdit={setEditingPromptIndex}
                onDuplicate={handleDuplicatePrompt}
                onDelete={handleDeletePrompt}
              />
            )
          ))}
        </Reorder.Group>
      )}
    </Stack>
  );
}
