import type { TemplateParameter } from "@/stores/models";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
import {
  Stack,
  Group,
  Text,
  TextInput,
  Select,
  Textarea,
  ActionIcon,
  Tooltip,
  Button,
  Paper,
  Divider,
} from "@mantine/core";

interface TemplateParametersEditorProps {
  parameters: TemplateParameter[];
  onChange: (parameters: TemplateParameter[]) => void;
}

const ObjectTypes = [
  { name: "Викладач", url: "/api/teachers" },
  { name: "Спеціальність", url: "/api/specialties" },
  { name: "Тема дисципліни", url: "/api/courses/{{courseId}}/topics" },
];

const TYPE_OPTIONS = [
  { value: "text", label: "Текст" },
  { value: "number", label: "Число" },
  { value: "boolean", label: "Булеве значення" },
  { value: "list", label: "Список" },
  { value: "object", label: "Об'єкт" },
];

const SUBTYPE_OPTIONS = [
  { value: "text", label: "Текст" },
  { value: "number", label: "Число" },
  { value: "boolean", label: "Булеве значення" },
  { value: "object", label: "Об'єкт" },
];

const OBJECT_TYPE_OPTIONS = [
  { value: "", label: "-- Виберіть тип об'єкта --" },
  ...ObjectTypes.map((t) => ({ value: t.url, label: t.name })),
];

export default function TemplateParametersEditor({ parameters, onChange }: TemplateParametersEditorProps) {
  const addParameter = () => onChange([...parameters, { name: "", type: "text" }]);

  const updateParameter = (index: number, param: Partial<TemplateParameter>) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], ...param } as TemplateParameter;
    onChange(updated);
  };

  const removeParameter = (index: number) => onChange(parameters.filter((_, i) => i !== index));

  const handleTypeChange = (newType: TemplateParameter["type"], index: number, param: TemplateParameter) => {
    const updates: Partial<TemplateParameter> = { type: newType };
    updates.subtype = newType === "list" ? (param.subtype ?? "text") : undefined;
    if (newType === "object") {
      updates.optionsUrl = param.optionsUrl ?? "";
      updates.dictionary = undefined;
    } else {
      updates.optionsUrl = undefined;
    }
    updateParameter(index, updates);
  };

  return (
    <Stack gap="sm">
      <Divider
        label={
          <Tooltip label="Параметри шаблону, які користувач має ввести при генерації документа й можна використати в тексті шаблону">
            <Text size="sm" fw={500} style={{ cursor: "default" }}>Параметри шаблону</Text>
          </Tooltip>
        }
        labelPosition="left"
      />

      {parameters.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="xs">
          Немає параметрів. Параметри дозволяють запитати в користувача дані, які будуть використані в тексті шаблону.
        </Text>
      ) : (
        <Stack gap="xs">
          {parameters.map((param, index) => (
            <Paper key={index} withBorder p="sm">
              <Stack gap="sm">
                <Group justify="flex-end">
                  <Tooltip label="Видалити параметр">
                    <ActionIcon variant="subtle" color="red" onClick={() => removeParameter(index)}>
                      <FontAwesomeIcon icon={faTrash} />
                    </ActionIcon>
                  </Tooltip>
                </Group>

                <Group grow align="flex-start">
                  <TextInput
                    label="Назва параметра"
                    placeholder="Назва параметра"
                    value={param.name}
                    onChange={(e) => updateParameter(index, { name: e.currentTarget.value })}
                  />
                  <Select
                    label="Тип"
                    data={TYPE_OPTIONS}
                    value={param.type}
                    onChange={(v) => v && handleTypeChange(v as TemplateParameter["type"], index, param)}
                  />
                </Group>

                <TextInput
                  label="Опис"
                  placeholder="Опис параметра (необов'язково)"
                  value={param.description || ""}
                  onChange={(e) => updateParameter(index, { description: e.currentTarget.value || undefined })}
                />

                {param.type === "list" && (
                  <Select
                    label="Тип елементів списку"
                    data={SUBTYPE_OPTIONS}
                    value={param.subtype || "text"}
                    onChange={(v) => {
                      const newSubtype = v as TemplateParameter["subtype"];
                      const updates: Partial<TemplateParameter> = { subtype: newSubtype };
                      if (newSubtype === "object") {
                        updates.optionsUrl = param.optionsUrl ?? "";
                        updates.dictionary = undefined;
                      } else {
                        updates.optionsUrl = undefined;
                      }
                      updateParameter(index, updates);
                    }}
                  />
                )}

                {(param.type === "object" || param.subtype === "object") && (
                  <Select
                    label="API для завантаження опцій"
                    data={OBJECT_TYPE_OPTIONS}
                    value={param.optionsUrl || ""}
                    onChange={(v) => updateParameter(index, { optionsUrl: v || undefined })}
                  />
                )}

                {param.type !== "object" && param.subtype !== "object" && (
                  <Textarea
                    label="Список опцій"
                    placeholder="Кожна опція на новому рядку (залиште порожнім, якщо опції не потрібні)"
                    value={Array.isArray(param.dictionary) ? param.dictionary.join("\n") : ""}
                    onChange={(e) => {
                      const values = e.currentTarget.value.split("\n").filter((v) => v.trim() !== "");
                      updateParameter(index, { dictionary: values.length > 0 ? values : undefined });
                    }}
                    autosize
                    minRows={2}
                  />
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Button
        variant="default"
        leftSection={<FontAwesomeIcon icon={faPlus} />}
        onClick={addParameter}
        w="fit-content"
      >
        Додати параметр
      </Button>
    </Stack>
  );
}
