import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faClockRotateLeft } from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";
import type { CourseResult, ResultType, Specialty, SpecialtyDegree } from "@/stores/models";
import { deleteResult, loadResultsBySpecialty, upsertResult } from "../results";
import { loadSpecialty, upsertSpecialty } from "../specialties";
import {
  Title,
  Stack,
  Group,
  Paper,
  TextInput,
  Select,
  Text,
  ActionIcon,
  Tooltip,
  Button,
  SimpleGrid,
  Loader,
  Center,
  Divider,
  Modal,
  NumberInput,
  Textarea,
} from "@mantine/core";

const RESULT_TYPES: Record<string, string> = {
  ЗК: "Загальні компетентності",
  СК: "Спеціальні компетентності",
  РН: "Результати навчання",
};

const DEGREE_LABELS: Record<SpecialtyDegree, string> = {
  bachelor: "Бакалавр",
  master: "Магістр",
};

export default function SpecialtyEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [items, setItems] = useState<CourseResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingResult, setEditingResult] = useState<CourseResult | null>(null);
  const [isSavingResult, setIsSavingResult] = useState(false);

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
      setSpecialty({ id: -1, code: "", name: "", old_code: "", old_name: "", area_code: "", area: "", degree: "bachelor", qualification: "", data: { disciplines: [] } });
    }
  }, [id]);

  const groupedResults = useMemo(() => {
    const grouped: Record<string, CourseResult[]> = { ЗК: [], СК: [], РН: [] };
    items.forEach((r) => grouped[r.type]?.push(r));
    Object.values(grouped).forEach((g) => g.sort((a, b) => a.no - b.no));
    return grouped;
  }, [items]);

  const integralResult = useMemo(
    () => items.find((result) => result.type === "ІК") ?? null,
    [items]
  );
  const regularResultCount = (groupedResults.ЗК?.length ?? 0) + (groupedResults.СК?.length ?? 0) + (groupedResults.РН?.length ?? 0);

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

  const openNewResult = () => {
    if (!specialty || specialty.id < 0) return;
    const type: ResultType = "ЗК";
    const nextNo = Math.max(0, ...items.filter((item) => item.type === type).map((item) => item.no)) + 1;
    setEditingResult({ id: -1, specialty_id: specialty.id, type, no: nextNo, name: "" });
  };

  const openIntegralResult = () => {
    if (!specialty || specialty.id < 0 || integralResult) return;
    setEditingResult({ id: -1, specialty_id: specialty.id, type: "ІК", no: 1, name: "" });
  };

  const openResultEditor = (result: CourseResult) => {
    setEditingResult({ ...result });
  };

  const updateResult = (changes: Partial<CourseResult>) => {
    setEditingResult((current) => current ? { ...current, ...changes } : current);
  };

  const handleResultTypeChange = (type: ResultType) => {
    if (!editingResult) return;
    const nextNo = editingResult.id >= 0
      ? editingResult.no
      : Math.max(0, ...items.filter((item) => item.type === type).map((item) => item.no)) + 1;
    updateResult({ type, no: nextNo });
  };

  const handleSaveResult = async () => {
    if (!specialty || !editingResult || editingResult.name.trim() === "" || editingResult.no < 1) return;
    if (editingResult.type === "ІК" && editingResult.id < 0 && integralResult) {
      toast.error("Для спеціальності можна додати лише одну інтегральну компетентність");
      return;
    }
    setIsSavingResult(true);
    try {
      await upsertResult({ ...editingResult, name: editingResult.name.trim() });
      setItems(await loadResultsBySpecialty(specialty.id));
      setEditingResult(null);
      toast.success(editingResult.id >= 0 ? "Результат успішно оновлено" : "Результат успішно додано");
    } catch {
      toast.error("Не вдалося зберегти результат");
    } finally {
      setIsSavingResult(false);
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
          {specialty.id >= 0 && (
            <Button
              size="compact-sm"
              variant="subtle"
              leftSection={<FontAwesomeIcon icon={faClockRotateLeft} />}
              onClick={() => navigate(`/specialties/${specialty.id}/history`)}
            >
              Історія
            </Button>
          )}
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
          <Select
            label="Рівень освіти"
            data={[
              { value: "bachelor", label: DEGREE_LABELS.bachelor },
              { value: "master", label: DEGREE_LABELS.master },
            ]}
            value={specialty.degree}
            onChange={(value) => update({ degree: (value as SpecialtyDegree | null) ?? "bachelor" })}
            allowDeselect={false}
          />
          <TextInput label="Кваліфікація" value={specialty.qualification} onChange={(e) => update({ qualification: e.currentTarget.value })} style={{ gridColumn: "span 2" }} />
        </SimpleGrid>
      </Paper>

      <Group justify="space-between">
        <Title order={3}>Інтегральна компетентність (ІК)</Title>
        {specialty.id >= 0 && !integralResult && (
          <Tooltip label="Додати інтегральну компетентність">
            <ActionIcon variant="default" onClick={openIntegralResult}>
              <FontAwesomeIcon icon={faPlus} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {isLoading ? (
        <Loader size="sm" />
      ) : integralResult ? (
        <Paper withBorder p="sm">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
              {integralResult.name}
            </Text>
            <Group gap="xs" wrap="nowrap">
              <Tooltip label="Редагувати">
                <ActionIcon variant="subtle" onClick={() => openResultEditor(integralResult)}>
                  <FontAwesomeIcon icon={faPen} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Видалити">
                <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(integralResult)}>
                  <FontAwesomeIcon icon={faTrash} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Paper>
      ) : (
        <Text c="dimmed">
          {specialty.id >= 0
            ? "Інтегральну компетентність ще не додано"
            : "Спочатку збережіть спеціальність, щоб додати інтегральну компетентність"}
        </Text>
      )}

      <Group justify="space-between">
        <Title order={3}>Результати навчання</Title>
        {specialty.id >= 0 && (
          <Tooltip label="Додати результат">
            <ActionIcon variant="default" onClick={openNewResult}>
              <FontAwesomeIcon icon={faPlus} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {isLoading ? (
        <Loader size="sm" />
      ) : regularResultCount === 0 ? (
        <Text c="dimmed">Немає результатів для цієї спеціальності</Text>
      ) : (
        <Stack gap="lg">
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
                        <Text size="sm" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                          {result.name}
                        </Text>
                      </Group>
                      <Group gap="xs" wrap="nowrap">
                        <Tooltip label="Редагувати">
                          <ActionIcon variant="subtle" onClick={() => openResultEditor(result)}>
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

      <Modal
        opened={editingResult !== null}
        onClose={() => setEditingResult(null)}
        title={editingResult?.id && editingResult.id >= 0 ? "Редагувати результат" : "Додати результат"}
        centered
      >
        {editingResult && (
          <Stack>
            <Group grow align="flex-start">
              <Select
                label="Тип"
                data={editingResult.type === "ІК"
                  ? [{ value: "ІК", label: "ІК — Інтегральна компетентність" }]
                  : [
                      { value: "ЗК", label: "ЗК — Загальні компетентності" },
                      { value: "СК", label: "СК — Спеціальні компетентності" },
                      { value: "РН", label: "РН — Результати навчання" },
                    ]}
                value={editingResult.type}
                onChange={(value) => value && handleResultTypeChange(value as ResultType)}
                allowDeselect={false}
                disabled={editingResult.type === "ІК"}
              />
              <NumberInput
                label="Номер"
                min={1}
                value={editingResult.no || ""}
                onChange={(value) => updateResult({ no: Number(value) || 0 })}
                disabled={editingResult.type === "ІК"}
              />
            </Group>
            <Textarea
              label="Назва"
              placeholder="Введіть назву результату"
              value={editingResult.name}
              onChange={(event) => updateResult({ name: event.currentTarget.value })}
              autosize
              minRows={4}
              autoFocus
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditingResult(null)} disabled={isSavingResult}>
                Скасувати
              </Button>
              <Button
                onClick={handleSaveResult}
                loading={isSavingResult}
                disabled={editingResult.name.trim() === "" || editingResult.no < 1}
              >
                Зберегти
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
