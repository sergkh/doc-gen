import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faGripVertical, faEdit, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { Reorder, useDragControls } from "motion/react";
import type { CourseTopic } from "@/stores/models";
import InPlaceEditor from "./InPlaceEditor";
import { generateCourseTopics, type AIGeneratedTopic } from "../courses";
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
  topics: CourseTopic[];
  onChange: (topics: CourseTopic[]) => void;
}

interface TopicItemProps {
  topic: CourseTopic;
  courseId: number;
  onEdit: (topic: CourseTopic) => void;
  onDelete: (id: number) => void;
  onUpdateAttestation: (topic: CourseTopic, v: number) => void;
  onUpdateFulltimeHours: (topic: CourseTopic, v: number) => void;
  onUpdatePracticalHours: (topic: CourseTopic, v: number) => void;
  onUpdateFulltimeSrsHours: (topic: CourseTopic, v: number) => void;
  onUpdateInabscentiaHours: (topic: CourseTopic, v: number) => void;
  onUpdateInabscentiaPracticalHours: (topic: CourseTopic, v: number) => void;
  onUpdateInabscentiaSrsHours: (topic: CourseTopic, v: number) => void;
}

const ATTESTATION_COLORS: Record<number, string> = {
  1: "var(--mantine-color-default)",
  2: "var(--mantine-color-blue-light)",
  3: "var(--mantine-color-red-light)",
  4: "var(--mantine-color-green-light)",
};

function TopicItem({
  topic, courseId,
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
        bg={ATTESTATION_COLORS[attestation] ?? ATTESTATION_COLORS[1]}
      >
        <Group align="flex-start" wrap="nowrap" gap="xs">
          <div
            style={{ cursor: "grab", paddingTop: 4, touchAction: "none", color: "var(--mantine-color-dimmed)" }}
            onPointerDown={(e) => dragControls.start(e)}
          >
            <FontAwesomeIcon icon={faGripVertical} />
          </div>

          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" wrap="wrap">
              <Text fw={700} size="sm">
                {topic.index}. {topic.name || `Тема ${topic.index}`}
              </Text>
              <Group gap={4} wrap="wrap">
                <InPlaceEditor value={hours} options={[2,4,6,8].map(v=>({value:v,label:`${v} год.`}))} displayText={`${hours} год.`} title="Години (денна)" onChange={(v)=>onUpdateFulltimeHours(topic,v)} />
                <InPlaceEditor value={practicalHours} options={[0,2,4,6,8].map(v=>({value:v,label:`${v} пр.`}))} displayText={`${practicalHours} пр.`} title="Практичні (денна)" onChange={(v)=>onUpdatePracticalHours(topic,v)} />
                <InPlaceEditor value={srsHours} options={[0,2,4,5,6,7,8,10,12,14,16,18].map(v=>({value:v,label:`${v} СРС`}))} displayText={`${srsHours} СРС`} title="СРС (денна)" onChange={(v)=>onUpdateFulltimeSrsHours(topic,v)} />
                <InPlaceEditor value={inabscentiaHours} options={[0,1,2,4,6,8].map(v=>({value:v,label:`${v} год.заоч.`}))} displayText={`${inabscentiaHours} год.заоч.`} title="Години (заочна)" onChange={(v)=>onUpdateInabscentiaHours(topic,v)} />
                <InPlaceEditor value={inabscentiaPracticalHours} options={[0,1,2,4,6,8].map(v=>({value:v,label:`${v} пр.заоч.`}))} displayText={`${inabscentiaPracticalHours} пр.заоч.`} title="Практичні (заочна)" onChange={(v)=>onUpdateInabscentiaPracticalHours(topic,v)} />
                <InPlaceEditor value={inabscentiaSrsHours} options={[0,2,4,6,8,10,12,14,16,18].map(v=>({value:v,label:`${v} СРС заоч.`}))} displayText={`${inabscentiaSrsHours} СРС заоч.`} title="СРС (заочна)" onChange={(v)=>onUpdateInabscentiaSrsHours(topic,v)} />
                <InPlaceEditor value={attestation} options={[1,2,3,4].map(v=>({value:v,label:`Атест. ${v}`}))} displayText={`Атест. ${attestation}`} title="Атестація" onChange={(v)=>onUpdateAttestation(topic,v)} />
              </Group>
            </Group>
            {topic.lection && (
              <Text size="sm" c="dimmed" lineClamp={3} style={{ whiteSpace: "pre-wrap" }}>{topic.lection}</Text>
            )}
          </Stack>

          <Group gap="xs" wrap="nowrap">
            {topic.generated && (
              <Tooltip label="Згенеровані дані">
                <ActionIcon variant="subtle" color="blue" onClick={() => navigate(`/courses/${courseId}/topics/${topic.id}/generated`)}>
                  <FontAwesomeIcon icon={faEdit} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label="Редагувати">
              <ActionIcon variant="subtle" onClick={() => onEdit(topic)}>
                <FontAwesomeIcon icon={faPen} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Видалити">
              <ActionIcon variant="subtle" color="red" onClick={() => onDelete(topic.id)}>
                <FontAwesomeIcon icon={faTrash} />
              </ActionIcon>
            </Tooltip>
          </Group>
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
const ATTESTATION_OPTS = [1, 2, 3, 4].map((v) => ({ value: String(v), label: String(v) }));

// ─── Topic form (shared for new & edit) ──────────────────────────────────────
interface TopicFormProps {
  title: string;
  topicName: string; setTopicName: (v: string) => void;
  topicSubtopics: string; setTopicSubtopics: (v: string) => void;
  topicLection: string; setTopicLection: (v: string) => void;
  topicHours: number; setTopicHours: (v: number) => void;
  topicPracticalHours: number; setTopicPracticalHours: (v: number) => void;
  topicSrsHours: number; setTopicSrsHours: (v: number) => void;
  topicInabscentiaHours: number; setTopicInabscentiaHours: (v: number) => void;
  topicInabscentiaPracticalHours: number; setTopicInabscentiaPracticalHours: (v: number) => void;
  topicInabscentiaSrsHours: number; setTopicInabscentiaSrsHours: (v: number) => void;
  topicAttestation: number; setTopicAttestation: (v: number) => void;
  isDragging: boolean; setIsDragging: (v: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
}

function TopicForm({
  title,
  topicName, setTopicName,
  topicSubtopics, setTopicSubtopics,
  topicLection, setTopicLection,
  topicHours, setTopicHours,
  topicPracticalHours, setTopicPracticalHours,
  topicSrsHours, setTopicSrsHours,
  topicInabscentiaHours, setTopicInabscentiaHours,
  topicInabscentiaPracticalHours, setTopicInabscentiaPracticalHours,
  topicInabscentiaSrsHours, setTopicInabscentiaSrsHours,
  topicAttestation, setTopicAttestation,
  isDragging, setIsDragging,
  onSave, onCancel,
}: TopicFormProps) {
  const handleFileDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const isText = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
    if (!isText) { alert("Будь ласка, перетягніть текстовий файл (.txt)"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setTopicLection(ev.target?.result as string);
    reader.readAsText(file);
  };

  return (
    <Paper withBorder p="md">
      <Stack>
        <Group justify="space-between">
          <Text fw={600}>{title}</Text>
          <Group gap="xs">
            <Button variant="default" onClick={onCancel}>Скасувати</Button>
            <Button onClick={onSave}>Зберегти</Button>
          </Group>
        </Group>

        <TextInput
          label="Назва теми"
          placeholder="Введіть назву теми"
          value={topicName}
          onChange={(e) => setTopicName(e.currentTarget.value)}
        />

        <Textarea
          label="Підтеми (по одній на рядок)"
          placeholder="Введіть підтеми, по одній на рядок"
          value={topicSubtopics}
          onChange={(e) => setTopicSubtopics(e.currentTarget.value)}
          autosize
          minRows={2}
        />

        <Divider label="Денна форма" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Select label="Години" data={FULLTIME_HOURS_OPTS} value={String(topicHours)} onChange={(v) => v && setTopicHours(Number(v))} />
          <Select label="Практичні" data={PRACTICAL_OPTS} value={String(topicPracticalHours)} onChange={(v) => v && setTopicPracticalHours(Number(v))} />
          <Select label="СРС" data={SRS_OPTS} value={String(topicSrsHours)} onChange={(v) => v && setTopicSrsHours(Number(v))} />
        </SimpleGrid>

        <Divider label="Заочна форма" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Select label="Години" data={INABS_HOURS_OPTS} value={String(topicInabscentiaHours)} onChange={(v) => v && setTopicInabscentiaHours(Number(v))} />
          <Select label="Практичні" data={PRACTICAL_OPTS} value={String(topicInabscentiaPracticalHours)} onChange={(v) => v && setTopicInabscentiaPracticalHours(Number(v))} />
          <Select label="СРС" data={SRS_OPTS} value={String(topicInabscentiaSrsHours)} onChange={(v) => v && setTopicInabscentiaSrsHours(Number(v))} />
        </SimpleGrid>

        <Select label="Атестація" data={ATTESTATION_OPTS} value={String(topicAttestation)} onChange={(v) => v && setTopicAttestation(Number(v))} w={120} />

        <Textarea
          label="Текст лекції"
          placeholder={isDragging ? "Відпустіть файл тут..." : "Введіть текст лекції (або перетягніть .txt файл)"}
          value={topicLection}
          onChange={(e) => setTopicLection(e.currentTarget.value)}
          autosize
          minRows={4}
          onDrop={handleFileDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          styles={isDragging ? { input: { borderStyle: "dashed", borderColor: "var(--mantine-color-blue-5)" } } : undefined}
        />
      </Stack>
    </Paper>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CourseTopicsEditor({ courseId, topics, onChange }: CourseTopicsEditorProps) {
  const [editingTopic, setEditingTopic] = useState<CourseTopic | null>(null);
  const [topicName, setTopicName] = useState("");
  const [topicSubtopics, setTopicSubtopics] = useState("");
  const [topicLection, setTopicLection] = useState("");
  const [topicHours, setTopicHours] = useState(2);
  const [topicAttestation, setTopicAttestation] = useState(1);
  const [topicPracticalHours, setTopicPracticalHours] = useState(0);
  const [topicInabscentiaHours, setTopicInabscentiaHours] = useState(0);
  const [topicInabscentiaPracticalHours, setTopicInabscentiaPracticalHours] = useState(0);
  const [topicSrsHours, setTopicSrsHours] = useState(0);
  const [topicInabscentiaSrsHours, setTopicInabscentiaSrsHours] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [aiTopicsLoading, setAiTopicsLoading] = useState(false);
  const [generatedTopics, setGeneratedTopics] = useState<AIGeneratedTopic[] | null>(null);

  const resetForm = () => {
    setEditingTopic(null);
    setTopicName(""); setTopicSubtopics(""); setTopicLection("");
    setTopicHours(2); setTopicAttestation(1); setTopicPracticalHours(0);
    setTopicInabscentiaHours(0); setTopicInabscentiaPracticalHours(0);
    setTopicSrsHours(0); setTopicInabscentiaSrsHours(0);
  };

  const handleAddTopic = () => {
    resetForm();
    setEditingTopic({ id: 0, course_id: courseId, index: topics.length + 1, name: "", lection: "", data: { attestation: 1, fulltime: { hours: 2, practical_hours: 0, lab_hours: 0, srs_hours: 0 }, inabscentia: { hours: 0, practical_hours: 0, lab_hours: 0, srs_hours: 0 } }, generated: {} });
  };

  const handleEditTopic = (topic: CourseTopic) => {
    setEditingTopic(topic);
    setTopicName(topic.name || "");
    setTopicSubtopics((topic.generated?.subtopics || []).join("\n"));
    setTopicLection(topic.lection || "");
    setTopicHours(topic.data?.fulltime?.hours || 2);
    setTopicAttestation(topic.data?.attestation || 1);
    setTopicPracticalHours(topic.data?.fulltime?.practical_hours || 0);
    setTopicInabscentiaHours(topic.data?.inabscentia?.hours || 0);
    setTopicInabscentiaPracticalHours(topic.data?.inabscentia?.practical_hours || 0);
    setTopicSrsHours(topic.data?.fulltime?.srs_hours || 0);
    setTopicInabscentiaSrsHours(topic.data?.inabscentia?.srs_hours || 0);
  };

  const handleSaveTopic = () => {
    if (!editingTopic) return;
    if (!topicName.trim()) { alert("Назва теми обов'язкова"); return; }

    const subtopicsArray = topicSubtopics.split("\n").map((s) => s.trim()).filter(Boolean);
    const existingGenerated = editingTopic.generated;
    const saved: CourseTopic = {
      ...editingTopic,
      name: topicName.trim(),
      lection: topicLection.trim(),
      data: {
        attestation: topicAttestation,
        fulltime: { hours: topicHours, practical_hours: topicPracticalHours, lab_hours: 0, srs_hours: topicSrsHours },
        inabscentia: { hours: topicInabscentiaHours, practical_hours: topicInabscentiaPracticalHours, lab_hours: 0, srs_hours: topicInabscentiaSrsHours },
      },
      generated: { subtopics: subtopicsArray, keywords: [], topics: [], referats: [], quiz: [], keyQuestions: [], ...(existingGenerated || {}) },
    };

    const updated = editingTopic.id === 0
      ? [...topics, saved]
      : topics.map((t) => (t.id === editingTopic.id ? saved : t));

    onChange(updated);
    resetForm();
  };

  const handleDeleteTopic = (topicId: number) => {
    if (!confirm("Ви впевнені, що хочете видалити цю тему?")) return;
    onChange(topics.filter((t) => t.id !== topicId));
  };

  const handleReorder = (newOrder: CourseTopic[]) => {
    onChange(newOrder.map((t, i) => ({ ...t, index: i + 1 })));
  };

  const patchTopic = (topic: CourseTopic, patch: Partial<CourseTopic["data"]>) => {
    const updated: CourseTopic = { ...topic, data: { ...topic.data, ...patch } };
    onChange(topics.map((t) => (t.id === topic.id ? updated : t)));
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

  const handleAddGeneratedTopic = (gen: AIGeneratedTopic) => {
    const topicData: CourseTopic = {
      id: 0, course_id: courseId, index: topics.length + 1, name: gen.name, lection: "",
      data: { attestation: 1, fulltime: { hours: 2, practical_hours: 0, lab_hours: 0, srs_hours: 0 }, inabscentia: { hours: 0, practical_hours: 0, lab_hours: 0, srs_hours: 0 } },
      generated: { subtopics: gen.subtopics, keywords: [], topics: [], referats: [], quiz: [], keyQuestions: [] },
    };
    onChange([...topics, topicData]);
    setGeneratedTopics((prev) => prev?.filter((t) => t.name !== gen.name) ?? null);
  };

  const formProps = {
    topicName, setTopicName, topicSubtopics, setTopicSubtopics, topicLection, setTopicLection,
    topicHours, setTopicHours, topicPracticalHours, setTopicPracticalHours, topicSrsHours, setTopicSrsHours,
    topicInabscentiaHours, setTopicInabscentiaHours, topicInabscentiaPracticalHours, setTopicInabscentiaPracticalHours,
    topicInabscentiaSrsHours, setTopicInabscentiaSrsHours, topicAttestation, setTopicAttestation,
    isDragging, setIsDragging, onSave: handleSaveTopic, onCancel: resetForm,
  };

  return (
    <Paper withBorder p="md">
      <Stack>
        <Group justify="space-between">
          <Text fw={700}>Теми курсу</Text>
          <Group gap="xs">
            <Tooltip label="Згенерувати теми AI">
              <ActionIcon variant="subtle" onClick={handleGenerateTopics} loading={aiTopicsLoading}>
                <FontAwesomeIcon icon={faWandMagicSparkles} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Додати тему">
              <ActionIcon variant="default" onClick={handleAddTopic}>
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
                <Button size="xs" color="green" onClick={() => generatedTopics.forEach(handleAddGeneratedTopic)}>
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
              if (editingTopic && editingTopic.id === topic.id) {
                return (
                  <div key={topic.id}>
                    <TopicForm title="Редагувати тему" {...formProps} />
                  </div>
                );
              }
              return (
                <TopicItem
                  key={topic.id}
                  topic={topic}
                  courseId={courseId}
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

        {editingTopic && editingTopic.id === 0 && (
          <TopicForm title="Додати тему" {...formProps} />
        )}
      </Stack>
    </Paper>
  );
}
