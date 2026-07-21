import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faPen, faTimes, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { Stack, Group, Text, TextInput, Select, ActionIcon, Divider, Box, Tooltip } from "@mantine/core";
import type { CourseTopic } from "@/stores/models";
import { renameAttestation } from "../courses";

export type Attestation = {
  name: string;
  semester: number;
};

interface AttestationsEditorProps {
  attestations: Attestation[];
  topics: CourseTopic[];
  courseId: number;
  onAdd: (name: string, semester: number) => void;
  onUpdateName: (index: number, name: string) => void;
  onUpdateSemester: (index: number, semester: number) => void;
  onRemove: (index: number) => void;
}

const SEMESTER_OPTIONS = [
  { value: "1", label: "1 семестр" },
  { value: "2", label: "2 семестр" },
];

export default function AttestationsEditor({
  attestations,
  topics,
  courseId,
  onAdd,
  onUpdateName,
  onUpdateSemester,
  onRemove,
}: AttestationsEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);

  const handleAdd = () => {
    const defaultName = `Атестація ${attestations.length + 1}`;
    onAdd(defaultName, 1);
  };

  const commitRename = (index: number) => {
    const nextName = draftName.trim();
    if (nextName) onUpdateName(index, nextName);
    setEditingIndex(null);
    setDraftName("");
  };

  const handleAiRename = async (index: number) => {
    if (courseId <= 0) return;
    setRenamingIndex(index);
    try {
      const attestationTopics = topics.filter((topic) => (topic.data?.attestation ?? 1) === index + 1);
      const suggestedName = await renameAttestation(courseId, index + 1, attestationTopics);
      if (suggestedName.trim()) {
        onUpdateName(index, suggestedName.trim());
      }
    } catch (error) {
      console.error("Error renaming attestation via AI:", error);
      alert("Не вдалося згенерувати назву атестації");
    } finally {
      setRenamingIndex(null);
    }
  };

  return (
    <Stack gap="xs">
      <Divider label="Атестації" labelPosition="left" />

      <Group gap="xs" wrap="wrap">
        {attestations.map((att, index) => (
          <Box
            style={(theme) => ({
              display: "inline-block",
              padding: "10px 16px",
              backgroundColor: theme.colors.blue[0],
              borderRadius: "0.5em",
            })}
            key={index}
          >
            <Group gap={6} wrap="nowrap">
              {editingIndex === index ? (
                <TextInput
                  size="xs"
                  value={draftName}
                  autoFocus
                  onChange={(e) => setDraftName(e.currentTarget.value)}
                  onBlur={() => commitRename(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename(index);
                    }
                    if (e.key === "Escape") {
                      setEditingIndex(null);
                      setDraftName("");
                    }
                  }}
                  styles={{ input: { minWidth: 140, padding: "0 6px", height: 24 } }}
                />
              ) : (
                <Text size="sm" fw={500} onClick={() => { setEditingIndex(index); setDraftName(att.name); }} style={{ cursor: "pointer" }}>
                  {att.name}
                </Text>
              )}
              <Tooltip label="AI-перейменувати">
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="blue"
                  loading={renamingIndex === index}
                  disabled={courseId <= 0}
                  onClick={() => handleAiRename(index)}
                >
                  <FontAwesomeIcon icon={faWandMagicSparkles} size="xs" />
                </ActionIcon>
              </Tooltip>
              <ActionIcon size="xs" variant="subtle" onClick={() => { setEditingIndex(index); setDraftName(att.name); }}>
                <FontAwesomeIcon icon={faPen} size="xs" />
              </ActionIcon>
              <Tooltip label="Видалити атестацію">
                <ActionIcon size="xs" variant="subtle" color="red" onClick={() => {
                  if (confirm("Видалити атестацію?")) onRemove(index);
                }}>
                  <FontAwesomeIcon icon={faTimes} size="xs" />
                </ActionIcon>
              </Tooltip>
              <Select
                data={SEMESTER_OPTIONS}
                value={String(att.semester || 1)}
                onChange={(v) => v && onUpdateSemester(index, Number(v))}
                size="xs"
                w={100}
                styles={{ input: { border: "none", background: "transparent", padding: 0, fontSize: "inherit", color: "inherit", display: "inline-block" } }}
                withCheckIcon={false}
              />
            </Group>
          </Box>
        ))}
        <Tooltip label="Додати атестацію">
          <ActionIcon variant="default" onClick={handleAdd}>
            <FontAwesomeIcon icon={faPlus} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Stack>
  );
}
