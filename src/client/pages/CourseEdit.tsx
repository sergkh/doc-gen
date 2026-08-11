import type { Course, Teacher, ShortCourseInfo, CourseResult, Specialty } from "@/stores/models";
import { useEffect, useMemo, useState } from "react";
import { Link,  useLocation, useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faEdit, faClockRotateLeft, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import {
  loadCourse, upsertCourse, loadAllCourses, normalizeCourseName,
  formatDisciplineCode, autofillCourseResults
} from "../courses";
import { loadAllTeachers } from "../teachers";
import { loadResultsBySpecialty } from "../results";
import { loadAllSpecialties } from "../specialties";
import CourseTopicsEditor from "../components/CourseTopicsEditor";
import AttestationsEditor from "../components/AttestationsEditor";
import ResultsEditor from "../components/ResultsEditor";
import {
  Title,
  Stack,
  Group,
  Paper,
  TextInput,
  NumberInput,
  Select,
  Checkbox,
  Textarea,
  Button,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  SimpleGrid,
  Divider,
  Loader,
  Center,
  Anchor,
  ThemeIcon,
} from "@mantine/core";

const RESULT_TYPES = {
  ЗК: "Загальні компетентності",
  СК: "Спеціальні компетентності",
  РН: "Результати навчання",
  ІК: "Інтегральна компетентність",
};

type ResultType = "ЗК" | "СК" | "РН" | "ІК";
type AutofillResultType = Exclude<ResultType, "ІК">;
type DependencyField = "prerequisites" | "postrequisites";

const LITERATURE_TYPES = [
  ["main", "основна література"],
  ["additional", "додаткова література"],
  ["internet", "інтернет-ресурси"],
] as const;

const REQUIRED_RESULT_TYPES: ResultType[] = ["ЗК", "СК", "РН", "ІК"];

function extractRawCourseName(displayName: string): string {
  return displayName.replace(/^(ОК\d+(?:\.\d+)?|ВК\d+(?:\.\d+)?)\s+/i, "").trim();
}

function stripNumbering(text: string): string {
  return text.replace(/^\d+[\.\)\-\s]+\s*/gm, "").trim();
}

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({
  value: String(s),
  label: `${s} семестр`,
}));

export default function CourseEdit() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [item, setItem] = useState<Course | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [allResults, setAllResults] = useState<CourseResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<CourseResult[]>([]);
  const [autofillLoading, setAutofillLoading] = useState<Record<AutofillResultType, boolean>>({
    ЗК: false, СК: false, РН: false,
  });
  const [dependencyInputs, setDependencyInputs] = useState<Record<DependencyField, string>>({
    prerequisites: "",
    postrequisites: "",
  });

  type CourseWithOk = ShortCourseInfo & { okNo: string | null; displayName: string };
  const [allCoursesList, setAllCoursesList] = useState<CourseWithOk[]>([]);

  const locationState = location.state as { clonedCourse?: Course; specialtyId?: string } | null;
  const clonedCourse = locationState?.clonedCourse;

  useEffect(() => {
    if (clonedCourse) {
      setItem({
        ...clonedCourse,
        id: -1,
        version: 0,
        name: `${clonedCourse.name} (копія)`
      });
      return;
    }

    loadCourse(id || "new").then(c => {
      if (id === 'new' && locationState?.specialtyId) {
        c.specialty_id = Number(locationState.specialtyId);
      }
      setItem(c);
    }).catch(console.error);
  }, [id, clonedCourse]);
  useEffect(() => {
    loadAllTeachers().then(setTeachers).catch(console.error);
    loadAllSpecialties().then(setSpecialties).catch(console.error);
  }, []);
  useEffect(() => {
    if (!item?.specialty_id) {
      setAllResults([]);
      return;
    }
    loadResultsBySpecialty(item.specialty_id).then(setAllResults).catch(console.error);
  }, [item?.specialty_id]);
  useEffect(() => {
    loadAllCourses()
      .then((courses) =>
        setAllCoursesList(courses.map((c) => ({
          id: c.id,
          name: c.name,
          teacher: c.teacher || "",
          okNo: c.data.ok_no ?? null,
          displayName: `${formatDisciplineCode(c.data.ok_no)} ${c.name}`,
        })))
      )
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!item) {
      setSelectedResults([]);
      return;
    }

    // Load selected results
    const selected = allResults.filter(r => item.data.results.includes(r.id));
    setSelectedResults(selected);
  }, [item?.data?.results, allResults, item?.id]);

  const update = (json: any) => { if (!item) return; setItem({ ...item, ...json } as Course); };
  const updateData = (json: any) => {
    if (!item) return;
    setItem({ ...item, data: { ...item.data, ...json } } as Course);
  };

  const handleSave = async () => {
    if (!item || !isValid) return;
    await upsertCourse(item);
    navigate("/courses");
  };

  const handleClone = () => {
    if (!item || item.id < 0) return;
    navigate("/courses/new", {
      state: {
        clonedCourse: item
      }
    });
  };

  const handleAddResult = (resultId: string) => {
    if (!item || !resultId) return;
    const rid = Number(resultId);
    if (item.data.results.includes(rid)) return;
    updateData({ results: [...item.data.results, rid] });
  };

  const handleRemoveResult = (resultId: number) => {
    if (!item) return;
    updateData({ results: item.data.results.filter((id) => id !== resultId) });
  };

  const handleAutofillResults = async (type: AutofillResultType) => {
    if (!item || item.id < 0) return;
    setAutofillLoading((prev) => ({ ...prev, [type]: true }));
    try {
      const matched = await autofillCourseResults(item.id, type);
      const newIds = matched.map((r) => r.id).filter((id) => !item.data.results.includes(id));
      if (newIds.length > 0) updateData({ results: [...item.data.results, ...newIds] });
    } catch (error) {
      console.error("Error autofilling results:", error);
    } finally {
      setAutofillLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const getAvailableResultsForType = (type: ResultType) =>
    allResults.filter((r) => r.type === type && !item?.data.results.includes(r.id));

  const getSelectedResultsForType = (type: ResultType) =>
    selectedResults.filter((r) => r.type === type);

  const dependencyCourseOptions = useMemo(() => {
    const excludeName = item ? normalizeCourseName(item.name) : null;
    const seen = new Set<string>();
    const deduped: CourseWithOk[] = [];
    allCoursesList.forEach((course) => {
      const name = course.name?.trim();
      if (!name) return;
      const normalized = normalizeCourseName(name);
      if (excludeName && normalized === excludeName) return;
      if (seen.has(normalized)) return;
      seen.add(normalized);
      deduped.push(course);
    });
    return deduped.sort((a, b) => {
      const cA = a.okNo, cB = b.okNo;
      if (cA === cB) return a.name.localeCompare(b.name, "uk");
      if (!cA) return 1;
      if (!cB) return -1;
      const isOkA = /^\d{1,2}$/.test(cA), isOkB = /^\d{1,2}$/.test(cB);
      if (isOkA && isOkB) return Number(cA) - Number(cB);
      if (isOkA) return -1;
      if (isOkB) return 1;
      return cA.localeCompare(cB);
    });
  }, [allCoursesList, item?.name]);

  const handleAddDependency = (field: DependencyField) => {
    if (!item) return;
    const value = dependencyInputs[field].trim();
    if (!value) return;
    const normalizedNew = normalizeCourseName(extractRawCourseName(value));
    const current = item.data[field] || [];
    if (current.some((e) => normalizeCourseName(e) === normalizedNew)) {
      setDependencyInputs((prev) => ({ ...prev, [field]: "" }));
      return;
    }
    updateData({ [field]: [...current, extractRawCourseName(value)] });
    setDependencyInputs((prev) => ({ ...prev, [field]: "" }));
  };

  const handleRemoveDependency = (field: DependencyField, index: number) => {
    if (!item) return;
    updateData({ [field]: (item.data[field] || []).filter((_, i) => i !== index) });
  };

  const handleAddSemester = (form: "fulltime" | "inabscentia", semester: number) => {
    if (!item) return;
    const current = item.data[form] || { semesters: [], study_year: 1 };
    if ((current.semesters || []).includes(semester)) return;
    updateData({ [form]: { ...current, semesters: [...(current.semesters || []), semester].sort((a, b) => a - b) } });
  };

  const handleRemoveSemester = (form: "fulltime" | "inabscentia", semester: number) => {
    if (!item) return;
    const current = item.data[form] || { semesters: [], study_year: 1 };
    updateData({ [form]: { ...current, semesters: (current.semesters || []).filter((s) => s !== semester) } });
  };

  const handleAddAttestation = (name: string, semester: number = 1) => {
    if (!item || !name.trim()) return;
    const trimmed = name.trim();
    if (item.data.attestations.some((a) => a.name === trimmed)) return;
    updateData({ attestations: [...item.data.attestations, { name: trimmed, semester }] });
  };

  const handleUpdateAttestationName = (index: number, name: string) => {
    if (!item) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const duplicate = item.data.attestations.find((a, i) => i !== index && a.name === trimmed);
    if (duplicate) return;
    updateData({ attestations: item.data.attestations.map((a, i) => i === index ? { ...a, name: trimmed } : a) });
  };

  const handleUpdateAttestationSemester = (index: number, semester: number) => {
    if (!item) return;
    updateData({ attestations: item.data.attestations.map((a, i) => i === index ? { ...a, semester } : a) });
  };

  const handleRemoveAttestation = (index: number) => {
    if (!item) return;
    updateData({ attestations: item.data.attestations.filter((_, i) => i !== index) });
  };

  const isValid = useMemo(
    () => !!item && item.name.trim() !== "" && item.data.credits > 0 && item.data.hours > 0 && item.specialty_id > 0,
    [item]
  );

  const validationWarnings = useMemo(() => {
    if (!item) return [];

    const topicHours = (item.topics || []).reduce((total, topic) => {
      const hours = topic.data?.fulltime;
      return total + (hours?.hours ?? 0) + (hours?.practical_hours ?? 0) + (hours?.lab_hours ?? 0) + (hours?.srs_hours ?? 0);
    }, 0);
    const missingLiterature = LITERATURE_TYPES
      .filter(([key]) => !(item.data.literature?.[key] || []).some((entry) => entry.trim()))
      .map(([, label]) => label);
    const selectedTypes = new Set(selectedResults.map((result) => result.type));
    const missingResultTypes = REQUIRED_RESULT_TYPES.filter((type) => !selectedTypes.has(type));
    const placeholderAttestations = item.data.attestations.filter((attestation) => /^атестація\s+\d+$/i.test(attestation.name.trim()));

    return [
      ...(item.data.hours > 0 && topicHours !== item.data.hours ? [{
        key: "topic-hours",
        label: "Години тем",
        tooltip: `Сума годин усіх тем (${topicHours}) не дорівнює загальній кількості годин курсу (${item.data.hours}).`,
      }] : []),
      ...(missingLiterature.length > 0 ? [{
        key: "literature",
        label: "Література",
        tooltip: `Не заповнено: ${missingLiterature.join(", ")}.`,
      }] : []),
      ...(missingResultTypes.length > 0 ? [{
        key: "results",
        label: "Результати",
        tooltip: `Відсутні типи результатів: ${missingResultTypes.join(", ")}. Курс має містити ЗК, СК, РН та ІК.`,
      }] : []),
      ...(placeholderAttestations.length > 0 ? [{
        key: "attestations",
        label: "Атестації",
        tooltip: `Перейменуйте шаблонні атестації: ${placeholderAttestations.map((attestation) => attestation.name).join(", ")}.`,
      }] : []),
      ...(item.data.credits > 0 && item.data.hours > 0 && item.data.hours !== item.data.credits * 30 ? [{
        key: "credits",
        label: "Кредити",
        tooltip: `Загальна кількість годин (${item.data.hours}) має дорівнювати ${item.data.credits * 30} (${item.data.credits} кредитів × 30).`,
      }] : []),
    ];
  }, [item, selectedResults]);

  if (!item) {
    return <Center h={200}><Loader /></Center>;
  }

  const renderDependencyEditor = (field: DependencyField, label: string) => {
    const dependencies = item.data[field] || [];
    const datalistId = `${field}-courses`;
    return (
      <Stack gap="xs">
        <Text fw={500} size="sm">{label}</Text>
        {dependencies.length > 0 && (
          <Group gap="xs" wrap="wrap">
            {dependencies.map((name, index) => (
              <Badge
                key={`${field}-${name}-${index}`}
                variant="outline"
                rightSection={
                  <ActionIcon size="xs" variant="transparent" onClick={() => handleRemoveDependency(field, index)}>
                    <FontAwesomeIcon icon={faTimes} size="xs" />
                  </ActionIcon>
                }
              >
                {name}
              </Badge>
            ))}
          </Group>
        )}
        <Group gap="xs">
          <TextInput
            style={{ flex: 1 }}
            list={datalistId}
            value={dependencyInputs[field]}
            onChange={(e) => setDependencyInputs((prev) => ({ ...prev, [field]: e.currentTarget.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddDependency(field); } }}
            placeholder="Почніть вводити назву дисципліни"
          />
          <Button variant="default" onClick={() => handleAddDependency(field)} disabled={!dependencyInputs[field].trim()}>
            Додати
          </Button>
        </Group>
        <datalist id={datalistId}>
          {dependencyCourseOptions.map((c) => (
            <option key={`${field}-${c.id}`} value={c.displayName} />
          ))}
        </datalist>
        <Text size="xs" c="dimmed">Можна додати будь-яку назву; підказки показують наявні дисципліни.</Text>
      </Stack>
    );
  };

  const renderSemesterEditor = (form: "fulltime" | "inabscentia", label: string) => {
    const semesters = item.data[form]?.semesters || [];
    return (
      <Stack gap="xs">
        <Text fw={500} size="sm">{label}</Text>
        {semesters.length > 0 && (
          <Group gap="xs" wrap="wrap">
            {semesters.map((s) => (
              <Badge
                key={s}
                variant="outline"
                rightSection={
                  <ActionIcon size="xs" variant="transparent" onClick={() => handleRemoveSemester(form, s)}><FontAwesomeIcon icon={faTimes} size="xs" /></ActionIcon>
                }
              >
                {s} семестр
              </Badge>
            ))}
          </Group>
        )}
        <Select
          placeholder="-- Додати семестр --"
          data={SEMESTER_OPTIONS.filter((o) => !semesters.includes(Number(o.value)))}
          value={null}
          onChange={(v) => { if (v) handleAddSemester(form, Number(v)); }}
          w={200}
        />
      </Stack>
    );
  };

  return (
    <Stack maw={1100} mx="auto">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={2}>Редагувати курс</Title>
          {item.id > 0 && (
            <>
              <Anchor component={Link} to={`/courses/${item.id}/generated`} size="sm">
                <FontAwesomeIcon icon={faEdit} /> Згенеровані дані
              </Anchor>
              <Anchor component={Link} to={`/courses/${item.id}/history`} size="sm">
                <FontAwesomeIcon icon={faClockRotateLeft} /> Історія
              </Anchor>
            </>
          )}
        </Group>
        <Group gap="xs">
          <Button variant="default" onClick={() => navigate("/courses")}>Скасувати</Button>
          <Button onClick={handleSave} disabled={!isValid}>Зберегти</Button>
        </Group>
      </Group>

      {validationWarnings.length > 0 && (
        <Group gap="xs" wrap="wrap">
          <Text size="sm" c="yellow.8" fw={500}>Потребує уваги:</Text>
          {validationWarnings.map((warning) => (
            <Tooltip key={warning.key} label={warning.tooltip} multiline w={320} withArrow>
              <Badge color="yellow" variant="light" leftSection={<FontAwesomeIcon icon={faExclamationTriangle} size="xs" />} style={{ cursor: "help" }}>
                {warning.label}
              </Badge>
            </Tooltip>
          ))}
        </Group>
      )}

      <Paper withBorder p="md">
        <Stack>
          <TextInput
            label="Назва"
            value={item.name}
            onChange={(e) => update({ name: e.currentTarget.value })}
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <NumberInput
              label="Кредити"
              min={0}
              value={item.data.credits || ""}
              onChange={(v) => updateData({ credits: Number(v) || 0 })}
            />
            <Group gap={4} align="flex-end">
              <NumberInput
                label="Години"
                min={0}
                value={item.data.hours || ""}
                onChange={(v) => updateData({ hours: Number(v) || 0 })}
                style={{ flex: 1 }}
              />
              {item.data.credits > 0 && item.data.hours > 0 && item.data.hours !== item.data.credits * 30 && (
                <Tooltip label={`Очікувано ${item.data.credits * 30} годин (${item.data.credits} кредитів × 30)`}>
                  <ThemeIcon color="yellow" variant="light" size="sm" style={{ marginBottom: 2 }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} size="xs" />
                  </ThemeIcon>
                </Tooltip>
              )}
            </Group>
            <TextInput
              label={"Номер " + (item.data.optional ? "ВК" : "ОК")}
              placeholder="Наприклад 1 або 1.3"
              value={item.data.ok_no ?? ""}
              onChange={(e) => {
                const raw = e.currentTarget.value.replace(/,/g, ".").trim();
                updateData({ ok_no: raw === "" ? null : raw });
              }}
            />
            <Select
              label="Спеціальність"
              placeholder="-- Виберіть спеціальність --"
              data={specialties.map((s) => ({
                value: String(s.id),
                label: `${s.code} ${s.name} (${s.degree === "master" ? "маг" : "бак"})`,
              }))}
              value={item.specialty_id ? String(item.specialty_id) : null}
              onChange={(v) => update({ specialty_id: Number(v) })}
              searchable
            />
            <Select
              label="Форма контролю"
              data={[
                { value: "credit", label: "Залік" },
                { value: "exam", label: "Іспит" },
                { value: "both", label: "Залік та іспит" },
              ]}
              value={item.data.control_type || "credit"}
              onChange={(v) => updateData({ control_type: v as "exam" | "credit" | "both" })}
            />
            <Select
              label="Тип занять"
              data={[
                { value: "practice", label: "Практичні" },
                { value: "lab", label: "Лабораторні" },
              ]}
              value={item.data.practice_type ?? null}
              onChange={(v) => updateData({ practice_type: (v as "practice" | "lab" | null) ?? undefined })}
              searchable={false}
              allowDeselect={false}
            />
            <NumberInput
              label="Рік навчання (денна)"
              min={1} max={6}
              value={item.data.fulltime?.study_year || 1}
              onChange={(v) => updateData({ fulltime: { ...item.data.fulltime, study_year: Number(v) || 1 } })}
            />
            <NumberInput
              label="Рік навчання (заочна)"
              min={1} max={6}
              value={item.data.inabscentia?.study_year || 1}
              onChange={(v) => updateData({ inabscentia: { ...item.data.inabscentia, study_year: Number(v) || 1 } })}
            />
            <Select
              label="Викладач"
              placeholder="-- Виберіть викладача --"
              data={teachers.map((t) => ({ value: String(t.id), label: t.name }))}
              value={item.teacher_id ? String(item.teacher_id) : null}
              onChange={(v) => update({ teacher_id: v })}
              searchable
              clearable
              style={{ gridColumn: "span 2" }}
            />
          </SimpleGrid>

          <Checkbox
            label="Вибіркова дисципліна"
            checked={item.data.optional}
            onChange={(e) => updateData({ optional: e.currentTarget.checked })}
          />

          <Textarea
            label="Додатковий опис"
            value={item.data.description}
            onChange={(e) => updateData({ description: e.currentTarget.value })}
            autosize
            minRows={3}
          />

          <Divider label="Результати навчання" labelPosition="left" />
          {(["ЗК", "СК", "РН", "ІК"] as const).map((type) => (
            <ResultsEditor
              key={type}
              label={RESULT_TYPES[type]}
              selectedResults={getSelectedResultsForType(type)}
              availableResults={getAvailableResultsForType(type)}
              onAdd={handleAddResult}
              onRemove={handleRemoveResult}
              onAutofill={type !== "ІК" && item.id > 0 ? () => handleAutofillResults(type) : undefined}
              autofillLoading={type === "ІК" ? false : autofillLoading[type]}
            />
          ))}

          <Divider label="Залежності" labelPosition="left" />
          {renderDependencyEditor("prerequisites", "Пререквізити")}
          {renderDependencyEditor("postrequisites", "Постреквізити")}

          <Divider label="Семестри" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {renderSemesterEditor("fulltime", "Денна форма")}
            {renderSemesterEditor("inabscentia", "Заочна форма")}
          </SimpleGrid>

          <AttestationsEditor
            courseId={item.id}
            topics={item.topics ?? []}
            attestations={item.data.attestations}
            onAdd={handleAddAttestation}
            onUpdateName={handleUpdateAttestationName}
            onUpdateSemester={handleUpdateAttestationSemester}
            onRemove={handleRemoveAttestation}
          />
        </Stack>
      </Paper>

      <CourseTopicsEditor
        courseId={item.id}
        coursePractType={item.data.practice_type ?? 'practice'}
        courseTotalHours={item.data.hours}
        topics={item.topics ?? []}
        onChange={(topics) => setItem({ ...item, topics })}
      />

      <Paper withBorder p="md">
        <Stack>
          <Divider label="Література" labelPosition="left" />
          <Textarea
            label="Основна (одна на рядок)"
            placeholder="Література"
            value={(item.data.literature?.main || []).join("\n")}
            onChange={(e) => updateData({ literature: { ...item.data.literature, main: e.currentTarget.value.split("\n").map(stripNumbering).filter((l) => l.trim()) } })}
            autosize
            minRows={4}
          />
          <Textarea
            label="Додаткова (одна на рядок)"
            placeholder="Література"
            value={(item.data.literature?.additional || []).join("\n")}
            onChange={(e) => updateData({ literature: { ...item.data.literature, additional: e.currentTarget.value.split("\n").map(stripNumbering).filter((l) => l.trim()) } })}
            autosize
            minRows={4}
          />
          <Textarea
            label="Інтернет-ресурси (одна на рядок)"
            placeholder="http://interesting-site.com"
            value={(item.data.literature?.internet || []).join("\n")}
            onChange={(e) => updateData({ literature: { ...item.data.literature, internet: e.currentTarget.value.split("\n").map(stripNumbering).filter((l) => l.trim()) } })}
            autosize
            minRows={4}
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
