import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Paper, Portal, Stack, Text, Textarea } from "@mantine/core";
import {
  filterPromptVariables,
  findOpenPlaceholder,
  insertPromptVariable,
  type PromptVariable,
} from "../util/prompt-autocomplete";

type PromptTemplateTextareaProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  variables: PromptVariable[];
  minRows: number;
  maxRows: number;
};

const SOURCE_LABELS: Record<PromptVariable["source"], string> = {
  course: "Дисципліна",
  topic: "Тема",
  ai: "AI-поле",
};

type DropdownPosition = { left: number; top: number; width: number };

function caretDropdownPosition(textarea: HTMLTextAreaElement, cursor: number): DropdownPosition {
  const style = window.getComputedStyle(textarea);
  const rect = textarea.getBoundingClientRect();
  const mirror = document.createElement("div");
  const properties = [
    "boxSizing", "width", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "fontFamily", "fontSize", "fontWeight",
    "fontStyle", "letterSpacing", "lineHeight", "textTransform", "textAlign", "textIndent", "wordSpacing",
  ] as const;

  mirror.style.position = "fixed";
  mirror.style.left = "-10000px";
  mirror.style.top = "0";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  for (const property of properties) mirror.style[property] = style[property];
  mirror.textContent = textarea.value.slice(0, cursor);

  const marker = document.createElement("span");
  marker.textContent = textarea.value.slice(cursor, cursor + 1) || "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2;
  const caretLeft = rect.left + (markerRect.left - mirrorRect.left) - textarea.scrollLeft;
  const caretTop = rect.top + (markerRect.top - mirrorRect.top) - textarea.scrollTop;
  mirror.remove();

  const viewportPadding = 8;
  const dropdownWidth = Math.min(Math.max(rect.width * 0.75, 320), 520, window.innerWidth - viewportPadding * 2);
  const estimatedHeight = 280;
  const below = caretTop + lineHeight + 6;
  const top = below + estimatedHeight <= window.innerHeight - viewportPadding
    ? below
    : Math.max(viewportPadding, caretTop - estimatedHeight - 6);
  const left = Math.min(
    Math.max(viewportPadding, caretLeft),
    window.innerWidth - dropdownWidth - viewportPadding,
  );
  return { left, top, width: dropdownWidth };
}

export default function PromptTemplateTextarea({
  label,
  placeholder,
  value,
  onChange,
  variables,
  minRows,
  maxRows,
}: PromptTemplateTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draftValue, setDraftValue] = useState(value);
  const [cursor, setCursor] = useState(value.length);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ left: 8, top: 8, width: 320 });
  const match = useMemo(() => findOpenPlaceholder(draftValue, cursor), [draftValue, cursor]);
  const suggestions = useMemo(
    () => isOpen && match ? filterPromptVariables(variables, match.query).slice(0, 12) : [],
    [isOpen, match, variables],
  );

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const updateAutocomplete = (
    nextValue: string,
    nextCursor: number | null,
    element?: HTMLTextAreaElement,
  ) => {
    const resolvedCursor = nextCursor ?? nextValue.length;
    const nextMatch = findOpenPlaceholder(nextValue, resolvedCursor);
    setCursor(resolvedCursor);
    setIsOpen(Boolean(nextMatch));
    setActiveIndex(0);
    if (nextMatch && element) setDropdownPosition(caretDropdownPosition(element, resolvedCursor));
  };

  const selectVariable = (variable: PromptVariable) => {
    if (!match) return;
    const inserted = insertPromptVariable(draftValue, match, variable.value);
    setDraftValue(inserted.value);
    onChange(inserted.value);
    setCursor(inserted.cursor);
    setIsOpen(false);
    queueMicrotask(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(inserted.cursor, inserted.cursor);
    });
  };

  return (
    <div>
      <Textarea
        ref={textareaRef}
        label={label}
        description="Введіть {{, щоб вибрати доступне поле"
        placeholder={placeholder}
        value={draftValue}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          setDraftValue(nextValue);
          onChange(nextValue);
          updateAutocomplete(nextValue, event.currentTarget.selectionStart, event.currentTarget);
        }}
        onClick={(event) => updateAutocomplete(event.currentTarget.value, event.currentTarget.selectionStart, event.currentTarget)}
        onKeyUp={(event) => {
          if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) {
            updateAutocomplete(event.currentTarget.value, event.currentTarget.selectionStart, event.currentTarget);
          }
        }}
        onKeyDown={(event) => {
          if (!match || suggestions.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            selectVariable(suggestions[activeIndex] ?? suggestions[0]!);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setIsOpen(false);
          }
        }}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        autosize
        minRows={minRows}
        maxRows={maxRows}
      />

      {isOpen && match && suggestions.length > 0 && (
        <Portal>
          <Paper
            data-testid="prompt-variable-suggestions"
            withBorder
            shadow="md"
            p={4}
            style={{
              position: "fixed",
              left: dropdownPosition.left,
              top: dropdownPosition.top,
              width: dropdownPosition.width,
              zIndex: 1000,
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            <Stack gap={2}>
              {suggestions.map((variable, index) => (
                <Button
                  key={variable.value}
                  variant={index === activeIndex ? "light" : "subtle"}
                  color="gray"
                  fullWidth
                  justify="space-between"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectVariable(variable)}
                >
                  <Text span ff="monospace" size="sm">{`{{${variable.value}}}`}</Text>
                  <Text span size="xs" c="dimmed">
                    {variable.label ? `${variable.label} · ` : ""}{SOURCE_LABELS[variable.source]}
                  </Text>
                </Button>
              ))}
            </Stack>
          </Paper>
        </Portal>
      )}
    </div>
  );
}
