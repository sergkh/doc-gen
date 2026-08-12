import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faExclamationTriangle, faCheck } from "@fortawesome/free-solid-svg-icons";
import type { Course, CourseResult, CourseTopic, Specialty } from "@/stores/models";
import { formatDisciplineCode, loadAllCoursesWithTopics, normalizeCourseName } from "../courses";
import { loadResultsBySpecialty } from "../results";
import { loadSpecialty } from "../specialties";
import {
  Title,
  Stack,
  Group,
  Paper,
  Text,
  TextInput,
  ActionIcon,
  Tooltip,
  Loader,
  Center,
  Button,
  Badge,
  List,
  Collapse,
  ThemeIcon,
  Alert,
} from "@mantine/core";

const RESULT_TYPES: Record<string, string> = {
  ЗК: "Загальні компетентності",
  СК: "Спеціальні компетентності",
  РН: "Результати навчання",
};

type ExtDependency = { name: string; type: "ok" | "unknown_course" | "not_added" };

type ExtendedCourse = {
  topics: CourseTopic[];
  ext_prerequisites: ExtDependency[];
  ext_postrequisites: ExtDependency[];
};

function formatResultCode(result: CourseResult): string {
  return `${result.type ?? ""}${result.no}`;
}

function courseMatch(course: Course & ExtendedCourse, searchText: string, results: Map<number, CourseResult>): boolean {
  const okNo = course.data.ok_no ? formatDisciplineCode(course.data.ok_no).toLowerCase() : "";
  const name = course.name.toLowerCase();
  const teacher = (course.teacher ?? String(course.teacher_id)).toLowerCase();
  const resultMatch = course.data.results?.some((id) => {
    const r = results.get(id);
    return r && (formatResultCode(r).toLowerCase().includes(searchText) || r.name.toLowerCase().includes(searchText));
  }) ?? false;
  if (okNo.includes(searchText) || name.includes(searchText) || teacher.includes(searchText) || resultMatch) return true;
  return course.topics.some((t) => t.name.toLowerCase().includes(searchText));
}

function findCourseByName(courses: (Course & ExtendedCourse)[], courseName: string) {
  if (!courseName) return null;
  const norm = normalizeCourseName(courseName);
  return courses.find((c) => normalizeCourseName(c.name) === norm) ?? null;
}

function validatePostPreRequisites(courses: (Course & { topics: CourseTopic[] })[]): (Course & ExtendedCourse)[] {
  const ext = courses.map((c) => {
    c.data.warnings = (c.data.warnings || []).filter((w) => !w.includes("literature") && !w.includes("inabscentia"));
    return { ...c, ext_prerequisites: [], ext_postrequisites: [] } as Course & ExtendedCourse;
  });

  ext.forEach((course) => {
    course.data.prerequisites?.forEach((prereqName) => {
      const other = findCourseByName(ext, prereqName);
      if (!other) {
        course.ext_prerequisites.push({ name: prereqName, type: "unknown_course" });
        course.data.warnings = [...(course.data.warnings || []), `Пререквізит "${prereqName}" не знайдено`];
      } else {
        course.ext_prerequisites.push({ name: prereqName, type: "ok" });
        if (!other.data.postrequisites?.map(normalizeCourseName).includes(normalizeCourseName(course.name))) {
          other.ext_postrequisites.push({ name: course.name, type: "not_added" });
          other.data.warnings = [...(other.data.warnings || []), `Дисципліна "${course.name}" не вказана як постреквізит, однак ссилається на цю`];
        }
      }
    });

    course.data.postrequisites?.forEach((postreqName) => {
      const other = findCourseByName(ext, postreqName);
      if (!other) {
        course.ext_postrequisites.push({ name: postreqName, type: "unknown_course" });
        course.data.warnings = [...(course.data.warnings || []), `Постреквізит "${postreqName}" не знайдено`];
      } else {
        course.ext_postrequisites.push({ name: postreqName, type: "ok" });
        if (!other.data.prerequisites?.map(normalizeCourseName).includes(normalizeCourseName(course.name))) {
          other.ext_prerequisites.push({ name: course.name, type: "not_added" });
          other.data.warnings = [...(other.data.warnings || []), `Дисципліна "${course.name}" не вказана як пререквізит, однак ссилається на цю`];
        }
      }
    });
  });

  return ext;
}

function DependencyIcon({ dep }: { dep: ExtDependency }) {
  if (dep.type === "ok") return <ThemeIcon size="xs" color="green" variant="transparent"><FontAwesomeIcon icon={faCheck} /></ThemeIcon>;
  const tip = dep.type === "unknown_course" ? "Дисципліна не знайдена в системі" : "У вказаній дисципліні не додано зворотне посилання";
  return <Tooltip label={tip}><ThemeIcon size="xs" color="yellow" variant="transparent"><FontAwesomeIcon icon={faExclamationTriangle} /></ThemeIcon></Tooltip>;
}

export default function CoursesWithResults() {
  const navigate = useNavigate();
  const { specialtyId } = useParams<{ specialtyId: string }>();

  const [courses, setCourses] = useState<(Course & ExtendedCourse)[]>([]);
  const [results, setResults] = useState<CourseResult[]>([]);
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [expandedWarnings, setExpandedWarnings] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!specialtyId) { setError("Не вказано спеціальність"); setIsLoading(false); return; }
    setIsLoading(true); setError(null);
    Promise.all([
      loadAllCoursesWithTopics(Number(specialtyId)),
      loadResultsBySpecialty(Number(specialtyId)),
      loadSpecialty(specialtyId),
    ])
      .then(([c, r, s]) => { setCourses(validatePostPreRequisites(c as (Course & { topics: CourseTopic[] })[])); setResults(r); setSpecialty(s); })
      .catch(() => setError("Не вдалося завантажити дані"))
      .finally(() => setIsLoading(false));
  }, [specialtyId]);

  const resultIdMap = useMemo(() => new Map(results.map((r) => [r.id, r])), [results]);

  const filteredCourses = useMemo(() => {
    if (!filterText.trim()) return courses;
    const q = filterText.toLowerCase();
    return courses.filter((c) => courseMatch(c, q, resultIdMap));
  }, [courses, filterText, resultIdMap]);

  if (isLoading) return <Center h={200}><Loader /></Center>;
  if (error) return (
    <Stack maw={900} mx="auto">
      <Text c="red">{error}</Text>
      <Button variant="default" onClick={() => navigate("/specialties")}>Повернутися до спеціальностей</Button>
    </Stack>
  );

  return (
    <Stack maw={1200} mx="auto">
      <Group justify="space-between" wrap="wrap">
        <Stack gap={2}>
          <Title order={2}>Дисципліни з результатами</Title>
          {specialty && <Text size="sm" c="dimmed">{specialty.code} — {specialty.name}</Text>}
        </Stack>
        <TextInput placeholder="Пошук..." value={filterText} onChange={(e) => setFilterText(e.currentTarget.value)} w={280} />
      </Group>

      {filteredCourses.length === 0 ? (
        <Text c="dimmed">{filterText ? "Не знайдено дисциплін, що відповідають фільтру" : "Немає дисциплін"}</Text>
      ) : (
        <Stack>
          {filteredCourses.map((course) => {
            const courseResults = course.data.results ?? [];
            const warnings = course.data.warnings ?? [];
            const hasWarnings = warnings.length > 0;

            return (
              <Paper key={course.id} withBorder p="md">
                <Stack gap="sm">
                  {/* Header */}
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs" wrap="wrap">
                        <Text fw={700}>{formatDisciplineCode(course.data.ok_no)}. {course.name}</Text>
                        {(course.data.attestations?.length ?? 0) > 0 && (
                          <Badge variant="light" size="sm">
                            {course.data.attestations?.map((a) => a.semester).filter((v, i, a) => a.indexOf(v) === i).sort().join(", ")} сем.
                          </Badge>
                        )}
                        {hasWarnings && (
                          <Tooltip label="Ця дисципліна має попередження">
                            <ThemeIcon size="sm" color="yellow" variant="transparent"><FontAwesomeIcon icon={faExclamationTriangle} /></ThemeIcon>
                          </Tooltip>
                        )}
                      </Group>
<Text size="sm" c="dimmed">Викладач: {course.teacher ?? course.teacher_id}</Text>
                      <Group gap="xs" wrap="wrap">
                        <Badge variant="outline" size="sm" color="violet">{course.data.credits} Кр</Badge>
                        {course.data.hours_detailed ? (
                          <>
                            <Badge variant="outline" size="sm" color="blue">Лек: {course.data.hours_detailed.fulltime.hours}</Badge>
                            {course.data.hours_detailed.fulltime.lab_hours > 0 ? (
                              <Badge variant="outline" size="sm" color="teal">Лаб: {course.data.hours_detailed.fulltime.lab_hours}</Badge>
                            ) : (
                              <Badge variant="outline" size="sm" color="teal">Прак: {course.data.hours_detailed.fulltime.practical_hours}</Badge>
                            )}
                            <Badge variant="outline" size="sm" color="orange">СРС: {course.data.hours_detailed.fulltime.srs_hours}</Badge>
                          </>
                        ) : (
                          <Badge variant="outline" size="sm" color="blue">{course.data.hours} год</Badge>
                        )}
                      </Group>
                     </Stack>
                    <Tooltip label="Редагувати">
                      <ActionIcon variant="subtle" onClick={() => navigate(`/courses/${course.id}`)}>
                        <FontAwesomeIcon icon={faPen} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>

                  {/* Results */}
                  {courseResults.length > 0 ? (
                    <Stack gap="xs">
                      {Object.entries(RESULT_TYPES).map(([type, typeName]) => {
                        const typeResults = courseResults.map((id) => resultIdMap.get(id)).filter((r): r is CourseResult => !!r && r.type === type);
                        if (typeResults.length === 0) return null;
                        return (
                          <Stack key={type} gap={2}>
                            <Text size="sm" fw={600}>{typeName}</Text>
                            <List size="sm" spacing={2}>
                              {typeResults.map((r) => (
                                <List.Item key={r.id}>
                                  <Text span fw={700} c="blue">{formatResultCode(r)}</Text> — {r.name}
                                </List.Item>
                              ))}
                            </List>
                          </Stack>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">Ця дисципліна не має пов'язаних результатів</Text>
                  )}

                  {/* Topics */}
                  {course.topics?.length > 0 && (
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>Теми дисципліни</Text>
                      <List size="sm" type="ordered" spacing={2}>
                        {course.topics.map((t, i) => <List.Item key={i}>{t.name}</List.Item>)}
                      </List>
                    </Stack>
                  )}

                  {/* Dependencies */}
                  {(course.ext_prerequisites.length > 0 || course.ext_postrequisites.length > 0) && (
                    <Paper withBorder p="sm">
                      <Stack gap="xs">
                        <Text size="sm" fw={600}>Залежності</Text>
                        {course.ext_prerequisites.length > 0 && (
                          <Stack gap={2}>
                            <Text size="xs" fw={600}>Пререквізити:</Text>
                            <List size="sm" spacing={2}>
                              {course.ext_prerequisites.map((dep, i) => (
                                <List.Item key={i}>
                                  <Group gap={4} wrap="nowrap">
                                    <Text size="sm" c={dep.type === "not_added" ? "red" : undefined}>{dep.name}</Text>
                                    <DependencyIcon dep={dep} />
                                  </Group>
                                </List.Item>
                              ))}
                            </List>
                          </Stack>
                        )}
                        {course.ext_postrequisites.length > 0 && (
                          <Stack gap={2}>
                            <Text size="xs" fw={600}>Постреквізити:</Text>
                            <List size="sm" spacing={2}>
                              {course.ext_postrequisites.map((dep, i) => (
                                <List.Item key={i}>
                                  <Group gap={4} wrap="nowrap">
                                    <Text size="sm" c={dep.type === "not_added" ? "red" : undefined}>{dep.name}</Text>
                                    <DependencyIcon dep={dep} />
                                  </Group>
                                </List.Item>
                              ))}
                            </List>
                          </Stack>
                        )}
                      </Stack>
                    </Paper>
                  )}

                  {/* Warnings */}
                  {hasWarnings && (
                    <Alert
                      color="yellow"
                      variant="light"
                      title={
                        <Group justify="space-between" style={{ cursor: "pointer" }} onClick={() => setExpandedWarnings((prev) => ({ ...prev, [course.id]: !prev[course.id] }))}>
                          <Group gap="xs">
                            <FontAwesomeIcon icon={faExclamationTriangle} />
                            <Text fw={600} size="sm">Можливі помилки</Text>
                          </Group>
                          <Text size="xs">{expandedWarnings[course.id] ? "Згорнути" : "Розгорнути"}</Text>
                        </Group>
                      }
                    >
                      <Collapse expanded={!!expandedWarnings[course.id]}>
                        <List size="sm" spacing={2} mt="xs">
                          {warnings.map((w, i) => <List.Item key={i}>{w}</List.Item>)}
                        </List>
                      </Collapse>
                    </Alert>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
