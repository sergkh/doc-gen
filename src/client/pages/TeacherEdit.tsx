import type { Teacher, TeacherPosition, AcademicTitle, TeacherPublication, Course } from "@/stores/models";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadTeacher, upsertTeacher } from "../teachers";
import { loadAllCourses } from "../courses";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSyncAlt, faBook, faExternalLinkAlt, faGraduationCap } from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";
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
  Anchor,
  Loader,
  Center,
  Button,
  SimpleGrid,
} from "@mantine/core";

const POSITIONS: TeacherPosition[] = ["аспірант", "асистент", "старший викладач", "доцент", "професор"];
const ACADEMIC_TITLES: AcademicTitle[] = [
  "кандидат технічних наук",
  "кандидат економічних наук",
  "PhD економічних наук",
  "доктор економічних наук",
  "доктор технічних наук",
];

export default function TeacherEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Teacher | null>(null);
  const [altNamesInput, setAltNamesInput] = useState<string>("");
  const [publications, setPublications] = useState<TeacherPublication[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingPublications, setIsLoadingPublications] = useState(false);

  useEffect(() => {
    loadTeacher(id || "new")
      .then((teacher) => {
        setItem(teacher);
        setAltNamesInput(teacher.alt_names?.join(", ") || "");
      })
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    if (!item?.id || item.id < 0) return;
    loadAllCourses()
      .then((all) => setCourses(all.filter((c) => c.teacher_id === item.id)))
      .catch(console.error);
  }, [item?.id]);

  useEffect(() => {
    if (!item?.id) return;
    setIsLoadingPublications(true);
    fetch(`/api/teachers/${item.id}/publications`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then(setPublications)
      .catch(console.error)
      .finally(() => setIsLoadingPublications(false));
  }, [item?.id]);

  const update = (json: Partial<Teacher>) => {
    if (!item) return;
    setItem({ ...item, ...json } as Teacher);
  };

  const handleAltNamesChange = (value: string) => {
    setAltNamesInput(value);
    update({ alt_names: value.split(",").map((n) => n.trim()).filter((n) => n.length > 0) });
  };

  const handleSave = async () => {
    if (!item || !isValid) return;
    try {
      await upsertTeacher(item);
      navigate("/teachers");
    } catch (error) {
      console.error("Error saving teacher:", error);
      toast.error("Не вдалося зберегти викладача");
    }
  };

  const handleRefreshPublications = async () => {
    if (!item?.id) return;
    try {
      const response = await fetch(`/api/teachers/${item.id}/refresh-publications`, { method: "POST" });
      if (!response.ok) throw new Error((await response.text()) || "Не вдалося оновити публікації");
      const data = await response.json();
      toast.success(`Успішно оновлено ${data.count} публікацій`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Сталася помилка при оновленні публікацій");
    }
  };

  const isValid = useMemo(() => {
    if (!item) return false;
    return item.name.trim() !== "" && (!item.email || item.email.trim() === "" || item.email.includes("@"));
  }, [item]);

  if (!item) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  return (
    <Stack maw={900} mx="auto">
      <Group justify="space-between">
        <Title order={2}>{item.id >= 0 ? "Редагувати викладача" : "Додати викладача"}</Title>
        <Group gap="xs">
          <Button variant="default" onClick={() => navigate("/teachers")}>Скасувати</Button>
          {item.id > 0 && (
            <Tooltip label="Оновити публікації з репозиторію">
              <ActionIcon variant="default" onClick={handleRefreshPublications}>
                <FontAwesomeIcon icon={faSyncAlt} />
              </ActionIcon>
            </Tooltip>
          )}
          <Button onClick={handleSave} disabled={!isValid}>Зберегти</Button>
        </Group>
      </Group>

      <Paper withBorder p="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Ім'я"
            value={item.name}
            onChange={(e) => update({ name: e.currentTarget.value })}
            style={{ gridColumn: "span 2" }}
          />
          <TextInput
            label="Email"
            type="email"
            value={item.email ?? ""}
            onChange={(e) => update({ email: e.currentTarget.value || null })}
            style={{ gridColumn: "span 2" }}
          />
          <Select
            label="Посада"
            placeholder="Не вказано"
            data={POSITIONS.map((p) => ({ value: p, label: p }))}
            value={item.position ?? null}
            onChange={(v) => update({ position: v as TeacherPosition | null })}
            clearable
            style={{ gridColumn: "span 2" }}
          />
          <Select
            label="Вчене звання"
            placeholder="Не вказано"
            data={ACADEMIC_TITLES.map((t) => ({ value: t, label: t }))}
            value={item.academic_title ?? null}
            onChange={(v) => update({ academic_title: v as AcademicTitle | null })}
            clearable
            style={{ gridColumn: "span 2" }}
          />
          <TextInput
            label="Варіанти імені для пошуку літератури (через кому)"
            placeholder="Прізвище І.Б., Прізвище І. Б."
            value={altNamesInput}
            onChange={(e) => handleAltNamesChange(e.currentTarget.value)}
            style={{ gridColumn: "span 2" }}
          />
        </SimpleGrid>
      </Paper>

      {item.id > 0 && courses.length > 0 && (
        <Paper withBorder p="md">
          <Stack gap="xs">
            <Group gap="xs">
              <FontAwesomeIcon icon={faGraduationCap} />
              <Text fw={600}>Дисципліни</Text>
            </Group>
            {courses.map((course) => (
              <Anchor key={course.id} href={`/courses/${course.id}`} size="sm">
                {course.data.ok_no ? `ОК${course.data.ok_no}. ` : ""}{course.name}
              </Anchor>
            ))}
          </Stack>
        </Paper>
      )}

      {item.id > 0 && (
        <Paper withBorder p="md">
          <Stack gap="xs">
            <Group gap="xs">
              <FontAwesomeIcon icon={faBook} />
              <Text fw={600}>Публікації</Text>
            </Group>
            {isLoadingPublications ? (
              <Loader size="sm" />
            ) : publications.length === 0 ? (
              <Text size="sm" c="dimmed">
                Немає публікацій. Натисніть кнопку оновлення, щоб завантажити публікації з репозиторію.
              </Text>
            ) : (
              <Stack gap="xs" mah={400} style={{ overflowY: "auto" }}>
                {publications.map((pub) => (
                  <Paper key={pub.id} withBorder p="sm">
                    <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={600} size="sm" truncate>{pub.title}</Text>
                        <Text size="xs" c="dimmed">
                          {[pub.year, pub.publication_type, pub.journal].filter(Boolean).join(" • ")}
                        </Text>
                        {pub.data?.authors && (
                          <Text size="xs" c="dimmed">Автори: {pub.data.authors.join(", ")}</Text>
                        )}
                      </Stack>
                      {pub.data?.link && (
                        <Tooltip label="Відкрити публікацію">
                          <ActionIcon component="a" href={pub.data.link} target="_blank" rel="noopener noreferrer" variant="subtle">
                            <FontAwesomeIcon icon={faExternalLinkAlt} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
