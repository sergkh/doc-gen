import type { Template, TemplateParameter, Prompt } from "@/stores/models";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { loadAllTemplates, loadTemplate, upsertTemplate } from "../templates";
import toast from "react-hot-toast";
import TemplateParametersEditor from "../components/TemplateParametersEditor";
import TemplatePromptsEditor from "../components/TemplatePromptsEditor";
import {
  Title,
  Stack,
  Group,
  Paper,
  TextInput,
  Text,
  Button,
  Box,
  Loader,
  Center,
  Code,
  MultiSelect,
} from "@mantine/core";

export default function TemplateEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Template | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    loadTemplate(id || "new")
      .then((template) => {
        if (!template.prompts) template.prompts = [];
        setItem(template);
      })
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    loadAllTemplates().then(setTemplates).catch(console.error);
  }, []);

  const update = (json: Partial<Template>) => {
    if (!item) return;
    setItem({ ...item, ...json } as Template);
  };

  const handleParametersChange = (parameters: TemplateParameter[]) => {
    if (!item) return;
    setItem({ ...item, data: { ...item.data, parameters } } as Template);
  };

  const handlePromptsChange = (prompts: Prompt[]) => {
    if (!item) return;
    setItem({ ...item, prompts } as Template);
  };

  const handleDependenciesChange = (dependencyIds: string[]) => {
    if (!item) return;
    setItem({
      ...item,
      data: { ...item.data, dependencies: dependencyIds.map(Number) }
    } as Template);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles[0]) setSelectedFile(acceptedFiles[0]);
    },
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "text/html": [".html"],
      "text/xml": [".xml"],
    },
    maxFiles: 1,
    disabled: isUploading,
    onDropRejected: () => toast.error("Будь ласка, перетягніть файл .docx, .txt, .html або .xml"),
  });

  const handleSave = async () => {
    if (!item || !isValid) return;
    setIsUploading(true);
    try {
      if (item.id < 0 && !selectedFile) {
        toast.error("Будь ласка, виберіть файл");
        return;
      }
      await upsertTemplate(item, selectedFile || undefined);
      navigate("/templates");
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Не вдалося зберегти шаблон");
    } finally {
      setIsUploading(false);
    }
  };

  const isValid = useMemo(() => {
    if (!item) return false;
    return item.name.trim() !== "" && (item.id >= 0 || selectedFile !== null);
  }, [item, selectedFile]);

  const dependencyTemplates = useMemo(() => {
    const templatesById = new Map(templates.map((template) => [template.id, template]));
    const ordered: Template[] = [];
    const resolved = new Set<number>();
    const visiting = new Set<number>();

    const visit = (templateId: number) => {
      if (resolved.has(templateId) || visiting.has(templateId)) return;
      const template = templatesById.get(templateId);
      if (!template) return;

      visiting.add(templateId);
      for (const dependencyId of template.data?.dependencies || []) visit(dependencyId);
      visiting.delete(templateId);
      resolved.add(templateId);
      ordered.push(template);
    };

    for (const dependencyId of item?.data?.dependencies || []) visit(dependencyId);
    return ordered;
  }, [item?.data?.dependencies, templates]);

  if (!item) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  return (
    <Stack maw={1200} mx="auto">
      <Group justify="space-between">
        <Title order={2}>{item.id >= 0 ? "Редагувати шаблон" : "Додати шаблон"}</Title>
        <Group gap="xs">
          <Button variant="default" onClick={() => navigate("/templates")}>Скасувати</Button>
          <Button onClick={handleSave} disabled={!isValid} loading={isUploading}>Зберегти</Button>
        </Group>
      </Group>

      <Paper withBorder p="md">
        <Stack>
          <TextInput
            label="Назва"
            value={item.name}
            onChange={(e) => update({ name: e.currentTarget.value })}
          />

          <MultiSelect
            label="Залежить від шаблонів"
            description="Їхні дані буде згенеровано перед даними цього шаблону."
            data={templates
              .filter((template) => template.id !== item.id)
              .map((template) => ({ value: String(template.id), label: template.name }))}
            value={(item.data?.dependencies || []).map(String)}
            onChange={handleDependenciesChange}
            searchable
            clearable
            placeholder="Оберіть шаблони"
          />

          {dependencyTemplates.length > 0 && (
            <Stack gap="xs">
              <Text fw={500} size="sm">Поля із залежних шаблонів (у порядку генерації)</Text>
              {dependencyTemplates.map((template) => (
                <Box key={template.id}>
                  <Text size="sm" fw={500}>{template.name}</Text>
                  {template.prompts.length > 0 ? (
                    <Group gap="xs" mt={4}>
                      {template.prompts.map((prompt, index) => (
                        <Code key={`${prompt.field}-${index}`}>{prompt.field}</Code>
                      ))}
                    </Group>
                  ) : (
                    <Text size="sm" c="dimmed">Немає налаштованих полів</Text>
                  )}
                </Box>
              ))}
            </Stack>
          )}

          <Stack gap="xs">
            <Text fw={500} size="sm">
              Файл {item.id < 0 ? "(обов'язково)" : "(за бажанням)"}
            </Text>
            <Box
              {...getRootProps()}
              p="md"
              style={{
                border: `2px dashed var(--mantine-color-${isDragActive ? "blue-5" : "default-border"})`,
                borderRadius: "var(--mantine-radius-sm)",
                textAlign: "center",
                cursor: isUploading ? "not-allowed" : "pointer",
                opacity: isUploading ? 0.5 : 1,
                backgroundColor: isDragActive ? "var(--mantine-color-blue-light)" : undefined,
                transition: "all 150ms ease",
              }}
            >
              <input {...getInputProps()} />
              <Text c="dimmed" size="sm">
                {isUploading
                  ? "Завантаження..."
                  : isDragActive
                  ? "Відпустіть файл тут"
                  : "Перетягніть файл шаблону (.docx, .txt, .html або .xml) або натисніть для вибору"}
              </Text>
              {selectedFile && (
                <Text size="sm" mt="xs">Вибрано: {selectedFile.name}</Text>
              )}
            </Box>
          </Stack>

          <TemplateParametersEditor
            parameters={item.data?.parameters || []}
            onChange={handleParametersChange}
          />

          <TemplatePromptsEditor
            prompts={item.prompts || []}
            onChange={handlePromptsChange}
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
