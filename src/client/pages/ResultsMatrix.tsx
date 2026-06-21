import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle, faCircleCheck } from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";
import type { Course, CourseResult, Specialty, SpecialtyDisciplineConfig } from "@/stores/models";
import { loadAllSpecialties, loadSpecialty } from "../specialties";
import { loadResultsBySpecialty } from "../results";
import { formatDisciplineCode, loadAllCourses } from "../courses";
import {
  Title,
  Stack,
  Group,
  Select,
  Paper,
  Text,
  Table,
  ScrollArea,
  Loader,
  Center,
  Divider,
  List,
  ThemeIcon,
} from "@mantine/core";

const RESULT_TYPES = {
  ЗК: "Загальні компетентності",
  СК: "Спеціальні компетентності",
  РН: "Результати навчання",
} as const;

type ResultType = keyof typeof RESULT_TYPES;
const RESULT_TYPE_ORDER: ResultType[] = ["ЗК", "СК", "РН"];

type MatrixRow = {
  discipline: SpecialtyDisciplineConfig;
  normalizedOkNo: string | null;
  displayCode: string;
  course: Course | null;
};

function formatResultCode(result: CourseResult): string {
  return `${result.type ?? ""}${result.no}`;
}

export default function ResultsMatrix() {
  const navigate = useNavigate();
  const { specialtyId: urlSpecialtyId } = useParams<{ specialtyId: string }>();

  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [results, setResults] = useState<CourseResult[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingSpecialty, setIsLoadingSpecialty] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  useEffect(() => {
    loadAllSpecialties()
      .then((list) => {
        setSpecialties(list);
        if (!list[0]) return;

        const idFromUrl = urlSpecialtyId && list.some((s) => String(s.id) === urlSpecialtyId)
          ? urlSpecialtyId
          : null;

        setSelectedSpecialtyId(idFromUrl ?? String(list[0].id));
      })
      .catch(() => toast.error("Не вдалося завантажити спеціальності"));
  }, []);

  useEffect(() => {
    setIsLoadingCourses(true);
    loadAllCourses()
      .then(setCourses)
      .catch(() => toast.error("Не вдалося завантажити дисципліни"))
      .finally(() => setIsLoadingCourses(false));
  }, []);

  useEffect(() => {
    if (!selectedSpecialtyId) {
      setSelectedSpecialty(null);
      setResults([]);
      return;
    }
    setIsLoadingSpecialty(true);
    Promise.all([loadSpecialty(selectedSpecialtyId), loadResultsBySpecialty(Number(selectedSpecialtyId))])
      .then(([specialty, specialtyResults]) => {
        setSelectedSpecialty(specialty);
        setResults(specialtyResults);
      })
      .catch(() => {
        toast.error("Не вдалося завантажити дані спеціальності");
        setSelectedSpecialty(null);
        setResults([]);
      })
      .finally(() => setIsLoadingSpecialty(false));
  }, [selectedSpecialtyId]);

  const disciplineRows: MatrixRow[] = useMemo(() => {
    const specialtyDisciplines = (selectedSpecialty?.data?.disciplines ?? []) as SpecialtyDisciplineConfig[];
    const coursesByOkNo = new Map<string, Course>();
    courses.forEach((course) => {
      if (course.data?.ok_no) coursesByOkNo.set(course.data.ok_no, course);
    });
    return specialtyDisciplines.map((discipline) => {
      const okNo = discipline.ok_no ?? "";
      return {
        discipline,
        normalizedOkNo: okNo,
        displayCode: formatDisciplineCode(discipline.ok_no),
        course: okNo ? (coursesByOkNo.get(okNo) ?? null) : null,
      };
    });
  }, [selectedSpecialty?.data?.disciplines, courses]);

  const resultsByType = useMemo(() => {
    const grouped: Record<ResultType, CourseResult[]> = { ЗК: [], СК: [], РН: [] };
    results.forEach((r) => {
      if (r.type === "ЗК" || r.type === "СК" || r.type === "РН") grouped[r.type].push(r);
    });
    RESULT_TYPE_ORDER.forEach((type) => grouped[type].sort((a, b) => a.no - b.no));
    return grouped;
  }, [results]);

  const uncoveredResultsByType = useMemo(() => {
    const uncovered: Record<ResultType, CourseResult[]> = { ЗК: [], СК: [], РН: [] };
    const coveredIds = new Set<number>();
    courses.forEach((c) => (c.data?.results ?? []).forEach((id) => coveredIds.add(id)));
    results.forEach((r) => {
      if ((r.type === "ЗК" || r.type === "СК" || r.type === "РН") && !coveredIds.has(r.id))
        uncovered[r.type].push(r);
    });
    return uncovered;
  }, [results, courses]);

  const hasUncoveredResults = useMemo(
    () => RESULT_TYPE_ORDER.some((type) => uncoveredResultsByType[type].length > 0),
    [uncoveredResultsByType]
  );

  const isBusy = isLoadingSpecialty || isLoadingCourses;

  const specialtyOptions = specialties.map((s) => ({
    value: String(s.id),
    label: `${s.code ? `${s.code} — ` : ""}${s.name} (${s.area})`,
  }));

  return (
    <Stack maw={1200} mx="auto">
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>Матриця результатів</Title>
        <Select
          data={specialtyOptions}
          value={selectedSpecialtyId}
          onChange={(value) => {
            setSelectedSpecialtyId(value);
            if (value) navigate(`/specialties/${value}/results/matrix`);
          }}
          placeholder="Виберіть спеціальність"
          searchable
          w={360}
        />
      </Group>

      {selectedSpecialty && (
        <Paper withBorder p="sm">
          <Text fw={700}>{selectedSpecialty.code ? `${selectedSpecialty.code} — ` : ""}{selectedSpecialty.name}</Text>
          <Text size="sm" c="dimmed">{selectedSpecialty.area}</Text>
        </Paper>
      )}

      {!selectedSpecialtyId ? (
        <Text c="dimmed">Виберіть спеціальність для побудови матриці</Text>
      ) : isBusy ? (
        <Center h={120}><Loader /></Center>
      ) : disciplineRows.length === 0 ? (
        <Text c="dimmed">Для цієї спеціальності немає переліку дисциплін</Text>
      ) : (
        <Stack gap="xl">
          {RESULT_TYPE_ORDER.map((type) => {
            const resultsForType = resultsByType[type];
            return (
              <Stack key={type} gap="xs">
                <Divider label={<Text fw={700}>{RESULT_TYPES[type]}</Text>} labelPosition="left" />
                {resultsForType.length === 0 ? (
                  <Text size="sm" c="dimmed">Немає результатів типу {type}</Text>
                ) : (
                  <ScrollArea>
                    <Table withTableBorder withColumnBorders highlightOnHover style={{ whiteSpace: "nowrap" }}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>ОК</Table.Th>
                          {resultsForType.map((result) => (
                            <Table.Th key={result.id} ta="center" title={result.name} style={{ minWidth: 48 }}>
                              {formatResultCode(result)}
                            </Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {disciplineRows.map((row) => (
                          <Table.Tr
                            key={`${row.displayCode}-${row.discipline.name}`}
                            bg={!row.course ? "var(--mantine-color-red-light)" : undefined}
                          >
                            <Table.Th style={{ verticalAlign: "top", minWidth: 180 }}>
                              <Text fw={700} size="sm">{row.normalizedOkNo || row.displayCode}</Text>
                              <Text size="xs" c="dimmed">{row.discipline.name}</Text>
                              {row.course && <Text size="xs" c="blue">{row.course.name}</Text>}
                              {!row.course && <Text size="xs" c="red">Дисципліну не знайдено</Text>}
                            </Table.Th>
                            {resultsForType.map((result) => {
                              const hasResult = (row.course?.data?.results ?? []).includes(result.id);
                              return (
                                <Table.Td key={`${row.displayCode}-${result.id}`} ta="center" fw={700}>
                                  {hasResult ? "+" : ""}
                                </Table.Td>
                              );
                            })}
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                )}
              </Stack>
            );
          })}
        </Stack>
      )}

      {selectedSpecialtyId && !isBusy && (
        <Paper withBorder p="md" style={{ borderColor: hasUncoveredResults ? "var(--mantine-color-red-5)" : "var(--mantine-color-green-5)" }}>
          <Stack gap="md">
            <Group gap="xs">
              <ThemeIcon color={hasUncoveredResults ? "red" : "green"} variant="light">
                <FontAwesomeIcon icon={hasUncoveredResults ? faExclamationTriangle : faCircleCheck} />
              </ThemeIcon>
              <Text fw={700}>
                {hasUncoveredResults ? "Результати, які не покриті жодною дисципліною" : "Всі результати покриті"}
              </Text>
            </Group>

            {RESULT_TYPE_ORDER.map((type) => {
              const uncovered = uncoveredResultsByType[type];
              return (
                <Stack key={type} gap="xs">
                  <Text fw={600} size="sm">{RESULT_TYPES[type]}</Text>
                  {uncovered.length === 0 ? (
                    <Text size="sm" c="green">Всі результати типу {type} покриті</Text>
                  ) : (
                    <List size="sm" spacing={2}>
                      {uncovered.map((result) => (
                        <List.Item key={result.id}>
                          {formatResultCode(result)} — {result.name}
                        </List.Item>
                      ))}
                    </List>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
