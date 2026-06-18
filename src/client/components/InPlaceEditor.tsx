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
}

export default function InPlaceEditor({ value, options, title, onChange }: InPlaceEditorProps) {
  return (
    <Select
      data={options.map((o) => ({ value: String(o.value), label: o.label }))}
      value={String(value)}
      onChange={(v) => { if (v) onChange(Number(v)); }}
      title={title}
      size="xs"
      w="auto"
      styles={{ input: { minWidth: 80 } }}
      withCheckIcon={false}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
