import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { Stack, Group, Text, TextInput, Select, Badge, ActionIcon, Button, Divider, Box } from "@mantine/core";

export type Attestation = {
  name: string;
  semester: number;
};

interface AttestationsEditorProps {
  attestations: Attestation[];
  onAdd: (name: string, semester: number) => void;
  onUpdateSemester: (index: number, semester: number) => void;
  onRemove: (index: number) => void;
}

const SEMESTER_OPTIONS = [
  { value: "1", label: "1 семестр" },
  { value: "2", label: "2 семестр" },
];

export default function AttestationsEditor({
  attestations,
  onAdd,
  onUpdateSemester,
  onRemove,
}: AttestationsEditorProps) {
  const [inputValue, setInputValue] = useState("");
  const [semester, setSemester] = useState<string>("1");

  const handleAdd = () => {
    if (!inputValue.trim()) return;
    onAdd(inputValue.trim(), Number(semester));
    setInputValue("");
    setSemester("1");
  };

  return (
    <Stack gap="xs">
      <Divider label="Атестації" labelPosition="left" />

      {attestations.length > 0 && (
        <Group gap="xs" wrap="wrap">
          {attestations.map((att, index) => (
            <Box
              style={(theme) => ({
                display: 'inline-block',
                padding: '10px 16px',
                backgroundColor: theme.colors.blue[0],
                borderRadius: '0.5em'
              })}
              key={index}
              variant="outline"              
            >
              {att.name}{" "}
              <Select
                data={SEMESTER_OPTIONS}
                value={String(att.semester || 1)}
                onChange={(v) => v && onUpdateSemester(index, Number(v))}
                size="xs"
                w={100}
                styles={{ input: { border: "none", background: "transparent", padding: 0, fontSize: "inherit", color: "inherit", display: "inline-block" } }}
                withCheckIcon={false}
              />
            </Box>
          ))}
        </Group>
      )}

      <Group gap="xs">
        <TextInput
          style={{ flex: 1 }}
          placeholder="Назва атестації"
          value={inputValue}
          onChange={(e) => setInputValue(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        <Select
          data={SEMESTER_OPTIONS}
          value={semester}
          onChange={(v) => v && setSemester(v)}
          w={140}
        />
        <Button
          variant="default"
          leftSection={<FontAwesomeIcon icon={faPlus} />}
          onClick={handleAdd}
          disabled={!inputValue.trim()}
        >
          Додати
        </Button>
      </Group>
    </Stack>
  );
}
