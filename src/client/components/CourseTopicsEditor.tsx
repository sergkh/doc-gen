import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faGripVertical, faEdit, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { Reorder, useDragControls } from "motion/react";
import type { CoursePractice, CourseTopic } from "@/stores/models";
import InPlaceEditor from "./InPlaceEditor";
import { generateCourseTopics, generateTopicSubtopics, getAttestationColor, type AIGeneratedTopic } from "../courses";
import { addGeneratedTopicsToCourseTopics, normalizeCoursePractices } from "./courseTopicsEditor.utils";
import {
  Stack,
  Group,
  Paper,
  Text,
  TextInput,
  Textarea,
  Select,
  Button,
  ActionIcon,
  Tooltip,
  SimpleGrid,
  Divider,
} from "@mantine/core";

interface CourseTopicsEditorProps {
  courseId: number;
  courseTotalHours: number;
  coursePractType: "practice" | "lab",
  topics: CourseTopic[];
  onChange: (topics: CourseTopic[]) => void;
}

type TopicFormState = {
  name: string;
  subtopics: string;
  lection: string;
  hours: number;
  attestation: number;
  practicalHours: number;
  srsHours: number;
  inabscentiaHours: number;
  inabscentiaPracticalHours: number;
  inabscentiaSrsHours: number;
  practices: CoursePractice[];
};

const createTopicFormState = (): TopicFormState => ({
  name: "",
  subtopics: "",
  lection: "",
  hours: 2,
  attestation: 1,
  practicalHours: 0,
  srsHours: 0,
  inabscentiaHours: 0,
  inabscentiaPracticalHours: 0,
  inabscentiaSrsHours: 0,
  practices: [],
});

interface TopicItemProps {
  topic: CourseTopic;
  courseId: number;
  coursePractType: "practice" | "lab";
  onEdit: (topic: CourseTopic) => void;
  onDelete: (topic: CourseTopic) => void;
  onUpdateAttestation: (topic: CourseTopic, v: number) => void;
  onUpdateFulltimeHours: (topic: CourseTopic, v: number) => void;
  onUpdatePracticalHours: (topic: CourseTopic, v: number) => void;
  onUpdateFulltimeSrsHours: (topic: CourseTopic, v: number) => void;
  onUpdateInabscentiaHours: (topic: CourseTopic, v: number) => void;
  onUpdateInabscentiaPracticalHours: (topic: CourseTopic, v: number) => void;
  onUpdateInabscentiaSrsHours: (topic: CourseTopic, v: number) => void;
}

function TopicItem({
  topic, courseId,
  coursePractType,
  onEdit, onDelete,
  onUpdateAttestation, onUpdateFulltimeHours, onUpdatePracticalHours,
  onUpdateFulltimeSrsHours, onUpdateInabscentiaHours,
  onUpdateInabscentiaPracticalHours, onUpdateInabscentiaSrsHours,
}: TopicItemProps) {
  const navigate = useNavigate();
  const dragControls = useDragControls();

  const attestation = topic.data?.attestation || 1;
  const hours = topic.data?.fulltime?.hours || 2;
  const practicalHours = topic.data?.fulltime?.practical_hours || 0;
  const srsHours = topic.data?.fulltime?.srs_hours || 0;
  const inabscentiaHours = topic.data?.inabscentia?.hours || 0;
  const inabscentiaPracticalHours = topic.data?.inabscentia?.practical_hours || 0;
  const inabscentiaSrsHours = topic.data?.inabscentia?.srs_hours || 0;
  const practices = normalizeCoursePractices(topic.data?.practices);

  return (
    <Reorder.Item
      value={topic}
      style={{ cursor: "default", listStyle: "none" }}
      dragListener={false}
      dragControls={dragControls}
    >
      <Paper
        withBorder
        p="sm"
        bg={getAttestationColor(attestation)}
      >
        <Group align="flex-start" wrap="nowrap" gap="xs">
          <div
            style={{ cursor: "grab", paddingTop: 4, touchAction: "none", color: "var(--mantine-color-dimmed)" }}
            onPointerDown={(e) => dragControls.start(e)}
          >
            <FontAwesomeIcon icon={faGripVertical} />
          </div>

          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Group justify="space-between" align="flex-start" gap="xs" wrap="wrap">
              <Text fw={700} size="sm">
                {topic.index}. {topic.name || `Тема ${topic.index}`}
              </Text>
              <Group gap="xs" wrap="nowrap">
                <InPlaceEditor value={attestation} options={ATTESTATION_INDEXES.map(v=>({value:v,label:`Атест. ${v}`}))} displayText={`Атест. ${attestation}`} title="Атестація" onChange={(v)=>onUpdateAttestation(topic,v)} compact />
                {topic.generated && (
                  <Tooltip label="Згенеровані дані">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      aria-label={`Згенеровані дані теми ${topic.index}`}
                      onClick={() => navigate(`/courses/${courseId}/topics/${topic.index}/generated`)}
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Tooltip label="Редагувати">
                  <ActionIcon variant="subtle" aria-label={`Редагувати тему ${topic.index}`} onClick={() => onEdit(topic)}>
                    <FontAwesomeIcon icon={faPen} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Видалити">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={`Видалити тему ${topic.index}`}
                    onClick={() => onDelete(topic)}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
            <SimpleGrid cols={3} spacing={4}>
              <InPlaceEditor value={hours} options={[2,4,6,8].map(v=>({value:v,label:`${v} год.`}))} displayText={`${hours} год.`} title="Години (денна)" onChange={(v)=>onUpdateFulltimeHours(topic,v)} />
              <InPlaceEditor value={practicalHours} options={[0,2,4,6,8].map(v=>({value:v,label:`${v} ${coursePractType === "practice" ? "пр." : "лаб."}`}))} displayText={`${practicalHours} ${coursePractType === "practice" ? "пр." : "лаб."}`} title={coursePractType === "practice" ? "Практичні (денна)" : "Лабораторні (денна)"} onChange={(v)=>onUpdatePracticalHours(topic,v)} />
              <InPlaceEditor value={srsHours} options={[0,2,4,5,6,7,8,10,12,14,16,18].map(v=>({value:v,label:`${v} СРС`}))} displayText={`${srsHours} СРС`} title="СРС (денна)" onChange={(v)=>onUpdateFulltimeSrsHours(topic,v)} />
            </SimpleGrid>
            <SimpleGrid cols={3} spacing={4}>
              <InPlaceEditor value={inabscentiaHours} options={[0,1,2,4,6,8].map(v=>({value:v,label:`${v} год.заоч.`}))} displayText={`${inabscentiaHours} год.заоч.`} title="Години (заочна)" onChange={(v)=>onUpdateInabscentiaHours(topic,v)} />
              <InPlaceEditor value={inabscentiaPracticalHours} options={[0,1,2,4,6,8].map(v=>({value:v,label:`${v} ${coursePractType === "practice" ? "пр.заоч." : "лаб.заоч."}`}))} displayText={`${inabscentiaPracticalHours} ${coursePractType === "practice" ? "пр.заоч." : "лаб.заоч."}`} title={coursePractType === "practice" ? "Практичні (заочна)" : "Лабораторні (заочна)"} onChange={(v)=>onUpdateInabscentiaPracticalHours(topic,v)} />
              <InPlaceEditor value={inabscentiaSrsHours} options={[0,2,4,6,8,10,12,14,16,18].map(v=>({value:v,label:`${v} СРС заоч.`}))} displayText={`${inabscentiaSrsHours} СРС заоч.`} title="СРС (заочна)" onChange={(v)=>onUpdateInabscentiaSrsHours(topic,v)} />
            </SimpleGrid>
            {topic.lection && (
              <Text size="sm" c="dimmed" lineClamp={3} style={{ whiteSpace: "pre-wrap" }}>{topic.lection}</Text>
            )}
            {practices.length > 0 && (
              <Stack gap={2} mt={2}>
                <Text size="xs" fw={600}>
                  {coursePractType === "practice" ? "Практичні заняття" : "Лабораторні заняття"}
                </Text>
                {practices.map((practice, index) => (
                  <Text key={`${practice.name}-${index}`} size="xs" c="dimmed">
                    {index + 1}. <Text component="span" inherit fw={500}>{practice.name}</Text>
                    {practice.description ? ` — ${practice.description}` : ""}
                  </Text>
                ))}
              </Stack>
            )}
          </Stack>
        </Group>
      </Paper>
    </Reorder.Item>
  );
}

// ─── hours options helpers ────────────────────────────────────────────────────
const hoursOptions = (vals: number[], suffix: string) =>
  vals.map((v) => ({ value: String(v), label: `${v} ${suffix}` }));

const FULLTIME_HOURS_OPTS = hoursOptions([2, 4, 6, 8], "год.");
const PRACTICAL_OPTS = hoursOptions([0, 2, 4, 6, 8], "год.");
const SRS_OPTS = hoursOptions([0, 2, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18], "год.");
const INABS_HOURS_OPTS = hoursOptions([0, 1, 2, 4, 6, 8], "год.");
const ATTESTATION_INDEXES = Array.from({ length: 8 }, (_, index) => index + 1);
const ATTESTATION_OPTS = ATTESTATION_INDEXES
  .map((value) => ({ value: String(value), label: String(value) }));

// ─── Topic form (shared for new & edit) ──────────────────────────────────────
interface TopicFormProps {
  title: string;
  coursePractType: "practice" | "lab";
  form: TopicFormState;
  setForm: (patch: Partial<TopicFormState>) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  canGenerateSubtopics: boolean;
  generatingSubtopics: boolean;
  onGenerateSubtopics: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function TopicForm({ title, coursePractType, form, setForm, isDragging, setIsDragging, canGenerateSubtopics, generatingSubtopics, onGenerateSubtopics, onSave, onCancel }: TopicFormProps) {
  const handleFileDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const isText = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
    if (!isText) { alert("Будь ласка, перетягніть текстовий файл (.txt)"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setForm({ lection: ev.target?.result as string });
    reader.readAsText(file);
  };

  const addPractice = () => {
    setForm({
      practices: [...form.practices, { name: "", description: "" }],
    });
  };

  const updatePractice = (index: number, patch: Partial<CoursePractice>) => {
    setForm({
      practices: form.practices.map((practice, practiceIndex) =>
        practiceIndex === index ? { ...practice, ...patch } : practice
      ),
    });
  };

  const removePractice = (index: number) => {
    setForm({
      practices: form.practices.filter((_, practiceIndex) => practiceIndex !== index),
    });
  };

  const practiceLabel = coursePractType === "practice" ? "практичне заняття" : "лабораторне заняття";
  const practiceLabelGenitive = coursePractType === "practice" ? "практичного заняття" : "лабораторного заняття";
  const practicesLabel = coursePractType === "practice" ? "Практичні заняття" : "Лабораторні заняття";

  return (
    <Paper withBorder p="md" bg={getAttestationColor(form.attestation)}>
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>{title}</Text>
          <Group gap="xs">
            <Button variant="default" aria-label="Скасувати редагування теми" onClick={onCancel}>Скасувати</Button>
            <Button aria-label="Зберегти тему" onClick={onSave}>Зберегти</Button>
          </Group>
        </Group>

        <TextInput label="Назва теми" placeholder="Введіть назву теми" value={form.name} onChange={(e) => setForm({ name: e.currentTarget.value })} />
        <Stack gap={4}>
          <Group justify="space-between" gap="xs">
            <Text size="sm" fw={500}>Підтеми (по одній на рядок)</Text>
            <Tooltip label="Згенерувати підтеми за допомогою AI">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="blue"
                aria-label="Згенерувати підтеми за допомогою AI"
                loading={generatingSubtopics}
                disabled={!canGenerateSubtopics || !form.name.trim()}
                onClick={onGenerateSubtopics}
              >
                <FontAwesomeIcon icon={faWandMagicSparkles} size="xs" />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Textarea aria-label="Підтеми (по одній на рядок)" placeholder="Введіть підтеми, по одній на рядок" value={form.subtopics} onChange={(e) => setForm({ subtopics: e.currentTarget.value })} autosize minRows={2} />
        </Stack>

        <Divider label="Денна форма" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Select label="Години" data={FULLTIME_HOURS_OPTS} value={String(form.hours)} onChange={(v) => v && setForm({ hours: Number(v) })} />
          <Select label="Практичні" data={PRACTICAL_OPTS} value={String(form.practicalHours)} onChange={(v) => v && setForm({ practicalHours: Number(v) })} />
          <Select label="СРС" data={SRS_OPTS} value={String(form.srsHours)} onChange={(v) => v && setForm({ srsHours: Number(v) })} />
        </SimpleGrid>

        <Divider label="Заочна форма" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Select label="Години" data={INABS_HOURS_OPTS} value={String(form.inabscentiaHours)} onChange={(v) => v && setForm({ inabscentiaHours: Number(v) })} />
          <Select label="Практичні" data={PRACTICAL_OPTS} value={String(form.inabscentiaPracticalHours)} onChange={(v) => v && setForm({ inabscentiaPracticalHours: Number(v) })} />
          <Select label="СРС" data={SRS_OPTS} value={String(form.inabscentiaSrsHours)} onChange={(v) => v && setForm({ inabscentiaSrsHours: Number(v) })} />
        </SimpleGrid>

        <Select label="Атестація" data={ATTESTATION_OPTS} value={String(form.attestation)} onChange={(v) => v && setForm({ attestation: Number(v) })} w={120} />

        <Divider label={practicesLabel} labelPosition="left" />
        <Stack gap="sm">
          {form.practices.length === 0 && (
            <Text size="sm" c="dimmed">Заняття ще не додані</Text>
          )}
          {form.practices.map((practice, index) => (
            <Paper key={index} withBorder p="sm">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={600}>
                    {coursePractType === "practice" ? "Практична робота" : "Лабораторна робота"} {index + 1}
                  </Text>
                  <Tooltip label="Видалити заняття">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Видалити ${practiceLabel} ${index + 1}`}
                      onClick={() => removePractice(index)}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <TextInput
                  label="Назва"
                  placeholder={`Введіть назву ${practiceLabelGenitive}`}
                  value={practice.name}
                  onChange={(event) => updatePractice(index, { name: event.currentTarget.value })}
                />
                <Textarea
                  label="Короткий опис"
                  placeholder="Стисло опишіть завдання та очікуваний результат"
                  value={practice.description}
                  onChange={(event) => updatePractice(index, { description: event.currentTarget.value })}
                  autosize
                  minRows={2}
                />
              </Stack>
            </Paper>
          ))}
          <Button variant="light" leftSection={<FontAwesomeIcon icon={faPlus} />} onClick={addPractice}>
            Додати {practiceLabel}
          </Button>
          <Text size="xs" c="dimmed">Одне заняття зазвичай відповідає 2 годинам.</Text>
        </Stack>

        <Textarea label="Текст лекції" placeholder={isDragging ? "Відпустіть файл тут..." : "Введіть текст лекції (або перетягніть .txt файл)"} value={form.lection} onChange={(e) => setForm({ lection: e.currentTarget.value })} autosize minRows={4} onDrop={handleFileDrop} onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }} styles={isDragging ? { input: { borderStyle: "dashed", borderColor: "var(--mantine-color-blue-5)" } } : undefined} />
      </Stack>
    </Paper>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CourseTopicsEditor({ courseId, courseTotalHours, topics, onChange, coursePractType }: CourseTopicsEditorProps) {
  // Topic position is mutable. Keep the drag identity in a WeakMap so it is
  // never attached to, or persisted with, the course topic data.
  const clientIds = useRef(new WeakMap<CourseTopic, number>());
  const nextClientId = useRef(1);
  const getClientId = (topic: CourseTopic): number => {
    let clientId = clientIds.current.get(topic);
    if (clientId === undefined) {
      clientId = nextClientId.current++;
      clientIds.current.set(topic, clientId);
    }
    return clientId;
  };
  const getTopicIdentifier = (topic: CourseTopic): string => {
    return `client_id:${getClientId(topic)}`;
  };
  const preserveTopicIdentifier = (source: CourseTopic, copy: CourseTopic): CourseTopic => {
    clientIds.current.set(copy, getClientId(source));
    return copy;
  };
  const [editingTopic, setEditingTopic] = useState<CourseTopic | null>(null);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [form, setFormState] = useState<TopicFormState>(createTopicFormState);
  const [isDragging, setIsDragging] = useState(false);
  const [aiTopicsLoading, setAiTopicsLoading] = useState(false);
  const [subtopicsLoading, setSubtopicsLoading] = useState(false);
  const [generatedTopics, setGeneratedTopics] = useState<AIGeneratedTopic[] | null>(null);

  const resetForm = () => {
    setEditingTopic(null);
    setIsAddingTopic(false);
    setFormState(createTopicFormState());
  };

  const setForm = (patch: Partial<TopicFormState>) => setFormState((prev) => ({ ...prev, ...patch }));

  const fillFormFromTopic = (topic: CourseTopic) => {
    setFormState({
      ...createTopicFormState(),
      name: topic.name || "",
      subtopics: (topic.generated?.subtopics || []).join("\n"),
      lection: topic.lection || "",
      hours: topic.data?.fulltime?.hours || 2,
      attestation: topic.data?.attestation || 1,
      practicalHours: topic.data?.fulltime?.practical_hours || 0,
      inabscentiaHours: topic.data?.inabscentia?.hours || 0,
      inabscentiaPracticalHours: topic.data?.inabscentia?.practical_hours || 0,
      srsHours: topic.data?.fulltime?.srs_hours || 0,
      inabscentiaSrsHours: topic.data?.inabscentia?.srs_hours || 0,
      practices: normalizeCoursePractices(topic.data?.practices),
    });
  };

  const handleAddTopic = () => {
    resetForm();
    const newTopic = {
      course_id: courseId,
      index: topics.length + 1,
      name: "",
      lection: "",
      data: { attestation: 1, practices: [], fulltime: { hours: 2, practical_hours: 0, lab_hours: 0, srs_hours: 0 }, inabscentia: { hours: 0, practical_hours: 0, lab_hours: 0, srs_hours: 0 } },
      generated: {},
    } as CourseTopic;
    setEditingTopic(newTopic);
    setIsAddingTopic(true);
  };

  const handleEditTopic = (topic: CourseTopic) => {
    setEditingTopic(topic);
    setIsAddingTopic(false);
    fillFormFromTopic(topic);
  };

  const handleSaveTopic = () => {
    if (!editingTopic) return;
    if (!form.name.trim()) { alert("Назва теми обов'язкова"); return; }
    const practices = form.practices.map((practice) => ({
      name: practice.name.trim(),
      description: practice.description.trim(),
    }));
    if (practices.some((practice) => !practice.name || !practice.description)) {
      alert("Для кожного заняття вкажіть назву та короткий опис");
      return;
    }

    const saved: CourseTopic = {
      ...editingTopic,
      name: form.name.trim(),
      lection: form.lection.trim(),
      data: {
        ...editingTopic.data,
        attestation: form.attestation,
        practices,
        fulltime: { hours: form.hours, practical_hours: form.practicalHours, lab_hours: 0, srs_hours: form.srsHours },
        inabscentia: { hours: form.inabscentiaHours, practical_hours: form.inabscentiaPracticalHours, lab_hours: 0, srs_hours: form.inabscentiaSrsHours },
      },
      generated: { subtopics: form.subtopics.split("\n").map((s) => s.trim()).filter(Boolean), keywords: [], topics: [], referats: [], quiz: [], keyQuestions: [], ...(editingTopic.generated || {}) },
    };

    if (isAddingTopic) {
      getTopicIdentifier(saved);
      onChange([...topics, saved]);
      resetForm();
      return;
    }

    const editingKey = getTopicIdentifier(editingTopic);
    onChange(topics.map((t) => (
      getTopicIdentifier(t) === editingKey ? preserveTopicIdentifier(t, saved) : t
    )));
    resetForm();
  };

  const handleDeleteTopic = (topic: CourseTopic) => {
    if (!confirm("Ви впевнені, що хочете видалити цю тему?")) return;
    onChange(topics.filter((t) => getTopicIdentifier(t) !== getTopicIdentifier(topic)));
  };

  const handleReorder = (newOrder: CourseTopic[]) => onChange(
    newOrder.map((topic, index) => preserveTopicIdentifier(topic, {
      ...topic,
      // Reorder.Item and its React key must retain the same identity while
      // `index` changes, otherwise a drag is remounted on every movement.
      index: index + 1,
    })),
  );

  const patchTopic = (topic: CourseTopic, patch: Partial<CourseTopic["data"]>) => {
    const key = getTopicIdentifier(topic);
    onChange(topics.map((t) => (
      getTopicIdentifier(t) === key
        ? preserveTopicIdentifier(t, { ...t, data: { ...t.data, ...patch } })
        : t
    )));
  };

  const handleUpdateAttestation = (topic: CourseTopic, v: number) => patchTopic(topic, { attestation: v });
  const handleUpdateFulltimeHours = (topic: CourseTopic, v: number) => patchTopic(topic, { fulltime: { ...topic.data?.fulltime, hours: v, practical_hours: topic.data?.fulltime?.practical_hours ?? 0, lab_hours: topic.data?.fulltime?.lab_hours ?? 0, srs_hours: topic.data?.fulltime?.srs_hours ?? 0 } });
  const handleUpdatePracticalHours = (topic: CourseTopic, v: number) => patchTopic(topic, { fulltime: { ...topic.data?.fulltime, hours: topic.data?.fulltime?.hours ?? 2, practical_hours: v, lab_hours: topic.data?.fulltime?.lab_hours ?? 0, srs_hours: topic.data?.fulltime?.srs_hours ?? 0 } });
  const handleUpdateFulltimeSrsHours = (topic: CourseTopic, v: number) => patchTopic(topic, { fulltime: { ...topic.data?.fulltime, hours: topic.data?.fulltime?.hours ?? 2, practical_hours: topic.data?.fulltime?.practical_hours ?? 0, lab_hours: topic.data?.fulltime?.lab_hours ?? 0, srs_hours: v } });
  const handleUpdateInabscentiaHours = (topic: CourseTopic, v: number) => patchTopic(topic, { inabscentia: { ...topic.data?.inabscentia, hours: v, practical_hours: topic.data?.inabscentia?.practical_hours ?? 0, lab_hours: topic.data?.inabscentia?.lab_hours ?? 0, srs_hours: topic.data?.inabscentia?.srs_hours ?? 0 } });
  const handleUpdateInabscentiaPracticalHours = (topic: CourseTopic, v: number) => patchTopic(topic, { inabscentia: { ...topic.data?.inabscentia, hours: topic.data?.inabscentia?.hours ?? 0, practical_hours: v, lab_hours: topic.data?.inabscentia?.lab_hours ?? 0, srs_hours: topic.data?.inabscentia?.srs_hours ?? 0 } });
  const handleUpdateInabscentiaSrsHours = (topic: CourseTopic, v: number) => patchTopic(topic, { inabscentia: { ...topic.data?.inabscentia, hours: topic.data?.inabscentia?.hours ?? 0, practical_hours: topic.data?.inabscentia?.practical_hours ?? 0, lab_hours: topic.data?.inabscentia?.lab_hours ?? 0, srs_hours: v } });

  const handleGenerateTopics = async () => {
    setAiTopicsLoading(true);
    try { setGeneratedTopics(await generateCourseTopics(courseId)); }
    catch { alert("Не вдалося згенерувати теми"); }
    finally { setAiTopicsLoading(false); }
  };

  const handleGenerateSubtopics = async () => {
    if (courseId <= 0 || !form.name.trim()) return;
    setSubtopicsLoading(true);
    try {
      const subtopics = await generateTopicSubtopics(courseId, {
        name: form.name.trim(),
        lection: form.lection.trim(),
      });
      if (subtopics.length === 0) {
        alert("AI не згенерував підтеми");
        return;
      }
      setForm({ subtopics: subtopics.join("\n") });
    } catch (error) {
      console.error("Error generating topic subtopics via AI:", error);
      alert("Не вдалося згенерувати підтеми");
    } finally {
      setSubtopicsLoading(false);
    }
  };

  const handleAddGeneratedTopic = (gen: AIGeneratedTopic) => {
    const result = addGeneratedTopicsToCourseTopics({
      topics,
      generatedTopics: [gen],
      courseId,
    });
    onChange(result.topics);
    setGeneratedTopics((prev) => prev?.filter((t) => t.name !== gen.name) ?? null);
  };

  const handleAddAllGeneratedTopics = () => {
    if (!generatedTopics?.length) return;

    const result = addGeneratedTopicsToCourseTopics({
      topics,
      generatedTopics,
      courseId,
    });
    onChange(result.topics);
    setGeneratedTopics(null);
  };

  const formProps = {
    coursePractType,
    form,
    setForm,
    isDragging,
    setIsDragging,
    canGenerateSubtopics: courseId > 0,
    generatingSubtopics: subtopicsLoading,
    onGenerateSubtopics: handleGenerateSubtopics,
    onSave: handleSaveTopic,
    onCancel: resetForm,
  };

  const summary = useMemo(() => {
    const collectTotals = (mode: "fulltime" | "inabscentia") => {
      const totals = topics.reduce(
        (acc, topic) => {
          const data = mode === "fulltime" ? topic.data?.fulltime : topic.data?.inabscentia;
          acc.hours += data?.hours ?? 0;
          acc.practical += data?.practical_hours ?? 0;
          acc.srs += data?.srs_hours ?? 0;
          return acc;
        },
        { hours: 0, practical: 0, srs: 0 },
      );

      return {
        ...totals,
        total: totals.hours + totals.practical + totals.srs,
        isBalanced: totals.hours + totals.practical + totals.srs === courseTotalHours,
      };
    };

    return {
      fulltime: collectTotals("fulltime"),
      inabscentia: collectTotals("inabscentia"),
    };
  }, [topics, courseTotalHours]);

  return (
    <Paper withBorder p="md">
      <Stack>
        <Group justify="space-between">
          <Text fw={700}>Теми курсу</Text>
          <Group gap="xs">
            <Tooltip label="Згенерувати теми AI">
              <ActionIcon
                variant="subtle"
                aria-label="Згенерувати теми AI"
                onClick={handleGenerateTopics}
                loading={aiTopicsLoading}
              >
                <FontAwesomeIcon icon={faWandMagicSparkles} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Додати тему">
              <ActionIcon variant="default" aria-label="Додати тему" onClick={handleAddTopic}>
                <FontAwesomeIcon icon={faPlus} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {generatedTopics && generatedTopics.length > 0 && (
          <Paper withBorder p="sm">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600} size="sm">Згенеровані теми</Text>
                <Button size="xs" color="green" onClick={handleAddAllGeneratedTopics}>
                  Додати всі
                </Button>
              </Group>
              {generatedTopics.map((gen, i) => (
                <Paper key={i} withBorder p="xs">
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={600} size="sm" truncate>{gen.name}</Text>
                      {gen.subtopics.length > 0 && (
                        <Text size="xs" c="dimmed" truncate>{gen.subtopics.join(", ")}</Text>
                      )}
                    </Stack>
                    <Button size="xs" variant="default" onClick={() => handleAddGeneratedTopic(gen)}>Додати</Button>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Paper>
        )}

        {topics.length === 0 && !editingTopic ? (
          <Text c="dimmed" size="sm">Немає тем</Text>
        ) : (
          <Reorder.Group axis="y" values={topics} onReorder={handleReorder} style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {topics.map((topic) => {
              const topicKey = getTopicIdentifier(topic);
              const editingKey = editingTopic ? getTopicIdentifier(editingTopic) : null;
              if (editingKey && editingKey === topicKey) {
                return (
                  <div key={`topic-editor-${topicKey}`}>
                    <TopicForm title="Редагувати тему" {...formProps} />
                  </div>
                );
              }
              return (
                <TopicItem
                  key={`topic-item-${topicKey}`}
                  topic={topic}
                  courseId={courseId}
                  coursePractType={coursePractType}
                  onEdit={handleEditTopic}
                  onDelete={handleDeleteTopic}
                  onUpdateAttestation={handleUpdateAttestation}
                  onUpdateFulltimeHours={handleUpdateFulltimeHours}
                  onUpdatePracticalHours={handleUpdatePracticalHours}
                  onUpdateFulltimeSrsHours={handleUpdateFulltimeSrsHours}
                  onUpdateInabscentiaHours={handleUpdateInabscentiaHours}
                  onUpdateInabscentiaPracticalHours={handleUpdateInabscentiaPracticalHours}
                  onUpdateInabscentiaSrsHours={handleUpdateInabscentiaSrsHours}
                />
              );
            })}
          </Reorder.Group>
        )}

        {editingTopic && isAddingTopic && (
          <TopicForm title="Додати тему" {...formProps} />
        )}

        <Paper withBorder p="sm">
          <Stack gap={4}>
            <Text fw={600} size="sm">Сумарно годин</Text>
            <Group justify="space-between" wrap="wrap" gap="md">
              <Stack gap={2}>
                <Text size="xs" c="dimmed">Денна</Text>
                <Text size="sm" c={summary.fulltime.isBalanced ? undefined : "red"}>
                  Лекції: {summary.fulltime.hours} · {coursePractType === "practice" ? "Практичні" : "Лаборатор`ні"}: {summary.fulltime.practical} · СРС: {summary.fulltime.srs} · Разом: {summary.fulltime.total}
                </Text>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" c="dimmed">Заочна</Text>
                <Text size="sm" c={summary.inabscentia.isBalanced ? undefined : "red"}>
                  Лекції: {summary.inabscentia.hours} · {coursePractType === "practice" ? "Практичні" : "Лабораторні"}: {summary.inabscentia.practical} · СРС: {summary.inabscentia.srs} · Разом: {summary.inabscentia.total}
                </Text>
              </Stack>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Paper>
  );
}
