import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen } from "@fortawesome/free-solid-svg-icons";
import type { Teacher } from "@/stores/models";
import { loadAllTeachers, deleteTeacher } from "../teachers";
import { Title, Stack, Group, Paper, Text, ActionIcon, Tooltip, Box } from "@mantine/core";

export default function TeachersList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Teacher[]>([]);

  useEffect(() => {
    loadAllTeachers().then(setItems).catch(console.error);
  }, []);

  const handleDelete = async (teacher: Teacher) => {
    if (!confirm(`Ви впевнені, що хочете видалити викладача "${teacher.name}"?`)) return;
    try {
      await deleteTeacher(teacher.id);
      setItems(items.filter((t) => t.id !== teacher.id));
    } catch (error) {
      console.error("Error deleting teacher:", error);
      alert("Не вдалося видалити викладача");
    }
  };

  return (
    <Stack maw={1200} mx="auto">
      <Group justify="space-between">
        <Title order={2}>Викладачі</Title>
        <Tooltip label="Новий викладач">
          <ActionIcon variant="default" onClick={() => navigate("/teachers/new")}>
            <FontAwesomeIcon icon={faPlus} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Stack gap="xs">
        {items.length === 0 ? (
          <Text c="dimmed">Немає викладачів</Text>
        ) : (
          items.map((t) => (
            <Paper key={t.id} withBorder p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={600} truncate>{t.name}</Text>
                  <Text size="sm" c="dimmed" truncate>{t.email}</Text>
                </Box>
                <Group gap="xs" wrap="nowrap">
                  <Tooltip label="Редагувати">
                    <ActionIcon variant="subtle" onClick={() => navigate(`/teachers/${t.id}`)}>
                      <FontAwesomeIcon icon={faPen} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Видалити">
                    <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(t)}>
                      <FontAwesomeIcon icon={faTrash} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Paper>
          ))
        )}
      </Stack>
    </Stack>
  );
}
