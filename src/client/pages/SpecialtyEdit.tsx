import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen } from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";
import type { CourseResult, Specialty } from "@/stores/models";
import { deleteResult, loadResultsBySpecialty } from "../results";
import { loadSpecialty, upsertSpecialty } from "../specialties";
import {
  Title,
  Stack,
  Group,
  Paper,
  TextInput,
  Text,
  ActionIcon,
  Tooltip,
  Button,
  SimpleGrid,
  Loader,
  Center,
  Divider,
} from "@mantine/core";

const RESULT_TYPES: Record<string, string> = {
  ЗК: "Загальні компетентності",
  СК: "Спеціальні компетентності",
  РН: "Результати навчання",
};

export default function SpecialtyEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [items, setItems] = useState<CourseResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadSpecialty(id)
        .then((s) => {
          setSpecialty(s);
          setIsLoading(true);
          loadResultsBySpecialty(s.id)
            .then(setItems)
            .catch(() => {
              toast.error("Не вдалося завантажити результати");
              setItems([]);
            })
            .finally(() => setIsLoading(false));
        })
        .catch(console.error);
    } else {
      setSpecialty({ id: -1, code: "", name: "", old_code: "", old_name: "", area_code: "", area: "", qualification: "", data: { disciplines: [] } });
    }
  }, [id]);

  const groupedResults = useMemo(() => {
    const grouped: Record<string, CourseResult[]> = { ЗК: [], СК: [], РН: [] };
    items.forEach((r) => grouped[r.type]?.push(r));
    Object.values(grouped).forEach((g) => g.sort((a, b) => a.no - b.no));
    return grouped;
  }, [items]);

  const update = (json: Partial<Specialty>) => {
    if (!specialty) return;
    setSpecialty({ ...specialty, ...json } as Specialty);
  };

  const handleDelete = async (result: CourseResult) => {
    if (!confirm(`Ви впевнені, що хочете видалити результат "${result.name}"?`)) return;
    try {
      await deleteResult(result.id);
      if (specialty?.id) setItems(await loadResultsBySpecialty(specialty.id));
      toast.success("Результат успішно видалено");
    } catch {
      toast.error("Не вдалося видалити результат");
    }
  };

  const handleSave = async () => {
    if (!specialty) return;
    try {
      const saved = await upsertSpecialty(specialty);
      toast.success("Спеціальність успішно збережена");
      navigate(`/specialties`);      
    } catch {
      toast.error("Не вдалося зберегти спеціальність");
    }
  };

  const isValid = useMemo(
    () => !!specialty && specialty.code.trim() !== "" && specialty.name.trim() !== "" && specialty.area.trim() !== "",
    [specialty]
  );

  if (!specialty) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  return (
    <Stack maw={1200} mx="auto">
      <Group justify="space-between">
        <Title order={2}>{specialty.id >= 0 ? "Редагувати спеціальність" : "Додати спеціальність"}</Title>
        <Group gap="xs">
          <Button variant="default" onClick={() => navigate("/specialties")}>Скасувати</Button>
          <Button onClick={handleSave} disabled={!isValid}>Зберегти</Button>
        </Group>
      </Group>

      <Paper withBorder p="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput label="Код" value={specialty.code} onChange={(e) => update({ code: e.currentTarget.value })} />
          <TextInput label="Стара назва коду" value={specialty.old_code} onChange={(e) => update({ old_code: e.currentTarget.value })} />
          <TextInput label="Назва" value={specialty.name} onChange={(e) => update({ name: e.currentTarget.value })} style={{ gridColumn: "span 2" }} />
          <TextInput label="Стара назва" value={specialty.old_name} onChange={(e) => update({ old_name: e.currentTarget.value })} style={{ gridColumn: "span 2" }} />
          <TextInput label="Код галузі" value={specialty.area_code} onChange={(e) => update({ area_code: e.currentTarget.value })} />
          <TextInput label="Галузь" value={specialty.area} onChange={(e) => update({ area: e.currentTarget.value })} />
          <TextInput label="Кваліфікація" value={specialty.qualification} onChange={(e) => update({ qualification: e.currentTarget.value })} style={{ gridColumn: "span 2" }} />
        </SimpleGrid>
      </Paper>

      <Group justify="space-between">
        <Title order={3}>Результати навчання</Title>
        {specialty.id >= 0 && (
          <Tooltip label="Додати результат">
            <ActionIcon variant="default" onClick={() => navigate(`/specialties/${specialty.id}/results/new`)}>
              <FontAwesomeIcon icon={faPlus} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {isLoading ? (
        <Loader size="sm" />
      ) : items.length === 0 ? (
        <Text c="dimmed">Немає результатів для цієї спеціальності</Text>
      ) : (
        <Stack gap="lg">
          <Text fw={600}>
            {specialty.code ? `${specialty.code} — ` : ""}{specialty.name} ({specialty.area})
          </Text>
          {(["ЗК", "СК", "РН"] as const).map((type) => {
            const results = groupedResults[type];
            if (!results?.length) return null;
            return (
              <Stack key={type} gap="xs">
                <Divider label={RESULT_TYPES[type]} labelPosition="left" />
                {results.map((result) => (
                  <Paper key={result.id} withBorder p="sm">
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={700} c="blue" size="sm">{result.no}.</Text>
                        <Text size="sm" truncate>{result.name}</Text>
                      </Group>
                      <Group gap="xs" wrap="nowrap">
                        <Tooltip label="Редагувати">
                          <ActionIcon variant="subtle" onClick={() => navigate(`/specialties/${specialty.id}/results/${result.id}`)}>
                            <FontAwesomeIcon icon={faPen} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Видалити">
                          <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(result)}>
                            <FontAwesomeIcon icon={faTrash} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
