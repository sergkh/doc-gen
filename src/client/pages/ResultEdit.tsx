import type { CourseResult, ResultType } from "@/stores/models";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadResult, upsertResult } from "../results";
import {
  Title,
  Stack,
  Group,
  Paper,
  Select,
  NumberInput,
  Textarea,
  Button,
  Loader,
  Center,
} from "@mantine/core";

export default function ResultEdit() {
  const { id, specialtyId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<CourseResult | null>(null);

  useEffect(() => {
    loadResult(id || "new")
      .then((loaded) => {
        if (id === "new" && specialtyId && loaded.specialty_id === null) {
          loaded.specialty_id = Number(specialtyId);
        }
        setItem(loaded);
      })
      .catch(console.error);
  }, [id, specialtyId]);

  const update = (json: Partial<CourseResult>) => {
    if (!item) return;
    setItem({ ...item, ...json } as CourseResult);
  };

  const handleSave = async () => {
    if (!item || !isValid) return;
    try {
      await upsertResult(item);
      navigate("/specialties/" + specialtyId);
    } catch (error) {
      console.error("Error saving result:", error);
      alert("Не вдалося зберегти результат");
    }
  };

  const isValid = useMemo(
    () => !!item && item.name.trim() !== "" && !!item.type && item.no > 0,
    [item]
  );

  if (!item) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  return (
    <Stack maw={800} mx="auto">
      <Title order={2}>{item.id >= 0 ? "Редагувати результат" : "Додати результат"}</Title>

      <Paper withBorder p="md">
        <Stack>
          <Group grow align="flex-start">
            <Select
              label="Тип"
              data={[
                { value: "ЗК", label: "ЗК — Загальні компетентності" },
                { value: "СК", label: "СК — Спеціальні компетентності" },
                { value: "РН", label: "РН — Результати навчання" },
              ]}
              value={item.type}
              onChange={(v) => v && update({ type: v as ResultType })}
            />
            <NumberInput
              label="Номер"
              min={1}
              value={item.no || ""}
              onChange={(v) => update({ no: Number(v) || 0 })}
            />
          </Group>

          <Textarea
            label="Назва"
            placeholder="Введіть назву результату"
            value={item.name}
            onChange={(e) => update({ name: e.currentTarget.value })}
            autosize
            minRows={4}
          />

          <Group>
            <Button onClick={handleSave} disabled={!isValid}>Зберегти</Button>
            <Button variant="default" onClick={() => navigate("/specialties/" + specialtyId)}>Скасувати</Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
