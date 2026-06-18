import type { Template, TemplateParameter, Prompt } from "@/stores/models";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { loadTemplate, upsertTemplate } from "../templates";
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
} from "@mantine/core";

export default function TemplateEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Template | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadTemplate(id || "new")
      .then((template) => {
        if (!template.prompts) template.prompts = [];
        setItem(template);
      })
      .catch(console.error);
  }, [id]);

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
