export type PromptVariable = {
  value: string;
  label?: string;
  source: "course" | "topic" | "ai";
};

export type PlaceholderMatch = {
  start: number;
  end: number;
  query: string;
};

export function findOpenPlaceholder(value: string, cursor: number): PlaceholderMatch | null {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/\{\{\s*([\p{L}\p{N}_.]*)$/u);
  if (!match || match.index === undefined) return null;
  return {
    start: match.index,
    end: cursor,
    query: match[1] ?? "",
  };
}

export function insertPromptVariable(
  value: string,
  match: PlaceholderMatch,
  variable: string,
): { value: string; cursor: number } {
  const inserted = `{{${variable}}}`;
  const nextValue = value.slice(0, match.start) + inserted + value.slice(match.end);
  return { value: nextValue, cursor: match.start + inserted.length };
}

export function filterPromptVariables(variables: PromptVariable[], query: string): PromptVariable[] {
  const normalized = query.trim().toLocaleLowerCase();
  const unique = new Map<string, PromptVariable>();
  for (const variable of variables) {
    if (!unique.has(variable.value)) unique.set(variable.value, variable);
  }
  return [...unique.values()]
    .filter((variable) => !normalized
      || variable.value.toLocaleLowerCase().includes(normalized)
      || variable.label?.toLocaleLowerCase().includes(normalized))
    .sort((left, right) => {
      const leftStarts = left.value.toLocaleLowerCase().startsWith(normalized) ? 0 : 1;
      const rightStarts = right.value.toLocaleLowerCase().startsWith(normalized) ? 0 : 1;
      return leftStarts - rightStarts || left.value.localeCompare(right.value);
    });
}
