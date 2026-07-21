import { Select } from "@mantine/core";

interface Option {
  value: number;
  label: string;
}

interface InPlaceEditorProps {
  value: number;
  options: Option[];
  displayText: string;
  title?: string;
  onChange: (newValue: number) => void;
  compact?: boolean;
}

export default function InPlaceEditor({ value, options, title, onChange, compact }: InPlaceEditorProps) {
  return (
    <Select
      data={options.map((o) => ({ value: String(o.value), label: o.label }))}
      value={String(value)}
      onChange={(v) => { if (v) onChange(Number(v)); }}
      title={title}
      size="xs"
      w={compact ? 76 : "auto"}
      styles={{ input: { minWidth: compact ? 76 : 80, fontSize: 12, padding: compact ? "0 8px" : undefined } }}
      withCheckIcon={false}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
