import { useState } from "react";

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

export default function InPlaceEditor({
  value,
  options,
  displayText,
  title,
  onChange,
}: InPlaceEditorProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = Number(e.target.value);
    onChange(newValue);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <select
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        autoFocus
        className="bg-zinc-900 border border-amber-50 text-amber-50 font-mono text-xs px-2 py-0.5 rounded outline-none focus:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className="bg-zinc-900 px-2 py-0.5 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
      title={title}
    >
      {displayText}
    </button>
  );
}

