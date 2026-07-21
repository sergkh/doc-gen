import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import type { CourseResult } from "@/stores/models";
import { Stack, Group, Text, Select, Badge, ActionIcon, Button, Tooltip } from "@mantine/core";

interface ResultsEditorProps {
  label: string;
  selectedResults: CourseResult[];
  availableResults: CourseResult[];
  onAdd: (resultId: string) => void;
  onRemove: (resultId: number) => void;
  onAutofill?: () => void;
  autofillLoading?: boolean;
}

export default function ResultsEditor({
  label,
  selectedResults,
  availableResults,
  onAdd,
  onRemove,
  onAutofill,
  autofillLoading,
}: ResultsEditorProps) {
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={500} size="sm">{label}</Text>
        {onAutofill && (
          <Tooltip label="Автозаповнення за допомогою AI">
            <Button
              variant="subtle"
              size="xs"
              leftSection={<FontAwesomeIcon icon={faWandMagicSparkles} />}
              onClick={onAutofill}
              loading={autofillLoading}
            >
              AI
            </Button>
          </Tooltip>
        )}
      </Group>

      {selectedResults.length > 0 && (
        <Group gap="xs" wrap="wrap">
          {selectedResults.map((result) => (
            <Badge
              key={result.id}
              variant="light"
              title={result.name}
              styles={{
                root: {
                  maxWidth: "100%",
                  height: "auto",
                },
                label: {
                  whiteSpace: "normal",
                  overflow: "visible",
                  textOverflow: "clip",
                  lineHeight: 1.25,
                  display: "block",
                  textAlign: "left",
                  paddingTop: 2,
                  paddingBottom: 2,
                },
              }}
              rightSection={
                <ActionIcon size="xs" variant="transparent" onClick={() => onRemove(result.id)}><FontAwesomeIcon icon={faTimes} size="xs" /></ActionIcon>
              }
            >
              {result.no}. {result.name}
            </Badge>
          ))}
        </Group>
      )}

      <Select
        placeholder={`-- Додати ${label} --`}
        data={availableResults.map((r) => ({ value: String(r.id), label: `${r.no}. ${r.name}` }))}
        value={null}
        onChange={(v) => { if (v) { onAdd(v); } }}
        searchable
        clearable={false}
      />
    </Stack>
  );
}
