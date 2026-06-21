import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faUpload, faBook } from "@fortawesome/free-solid-svg-icons";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import type { Specialty } from "@/stores/models";
import { loadAllSpecialties, deleteSpecialty } from "../specialties";
import { uploadResultsFromDocx } from "../results";
import { Title, Stack, Group, Paper, Text, ActionIcon, Tooltip, Box } from "@mantine/core";

export default function SpecialtiesList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Specialty[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadAllSpecialties().then(setItems).catch(console.error);
  }, []);

  const handleDelete = async (specialty: Specialty) => {
    if (!confirm(`Ви впевнені, що хочете видалити спеціальність "${specialty.code} ${specialty.name}"?`)) return;
    try {
      await deleteSpecialty(specialty.id);
      setItems(items.filter((s) => s.id !== specialty.id));
    } catch (error) {
      console.error("Error deleting specialty:", error);
      alert("Не вдалося видалити спеціальність");
    }
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    const uploadPromise = (async () => {
      const uploadedResults = await uploadResultsFromDocx(file);
      return uploadedResults;
    })();

    toast.promise(uploadPromise, {
      loading: "Завантаження та обробка файлу...",
      success: (r) => `Успішно завантажено ${r.length} результатів`,
      error: "Не вдалося завантажити файл. Спробуйте ще раз.",
    });

    try {
      await uploadPromise;
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles[0]) processFile(acceptedFiles[0]);
    },
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    disabled: isUploading,
    onDropRejected: () => toast.error("Будь ласка, виберіть файл .docx або .pdf"),
  });

  return (
    <Stack maw={1200} mx="auto">
      <Group justify="space-between">
        <Title order={2}>Спеціальності</Title>
        <Tooltip label="Нова спеціальність">
          <ActionIcon variant="default" onClick={() => navigate("/specialties/new")}>
            <FontAwesomeIcon icon={faPlus} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Stack gap="xs">
        {items.length === 0 ? (
          <Text c="dimmed">Немає спеціальностей</Text>
        ) : (
          items.map((s) => (
            <Paper key={s.id} withBorder p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {s.code} {s.name}
                  </Text>
                  <Text size="sm" c="dimmed" truncate>
                    {s.area} ({s.qualification})
                  </Text>
                </Box>
                <Group gap="xs" wrap="nowrap">
                  <Tooltip label="Дисципліни">
                    <ActionIcon variant="subtle" onClick={() => navigate(`/specialties/${s.id}/courses`)}>
                      <FontAwesomeIcon icon={faBook} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Редагувати">
                    <ActionIcon variant="subtle" onClick={() => navigate(`/specialties/${s.id}`)}>
                      <FontAwesomeIcon icon={faPen} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Видалити">
                    <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(s)}>
                      <FontAwesomeIcon icon={faTrash} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Paper>
          ))
        )}
      </Stack>

            <Box
        {...getRootProps()}
        p="xl"
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
        <Stack align="center" gap="xs">
          <FontAwesomeIcon icon={faUpload} size="lg" />
          <Text fw={500}>
            {isUploading
              ? "Завантаження..."
              : isDragActive
              ? "Відпустіть файл тут"
              : "Перетягніть файл ОПП у форматі .docx сюди або натисніть для вибору"}
          </Text>
        </Stack>
      </Box>
    </Stack>
  );
}
