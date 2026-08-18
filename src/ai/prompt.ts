function resolvePath(value: any, path: string, dependency: string): any {
  return path.split('.').reduce((current: any, field: string) => {
    const next = current?.[field];
    if (next === undefined) {
      const available = current && typeof current === "object" ? Object.keys(current).join(", ") : "";
      throw new Error(`Missing dependency: ${dependency}. Available: ${available}`);
    }
    return next;
  }, value);
}

function filterArgument(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function formatPrompt(template: string, data: Record<string, any>): string {
  if (!template) return template;

  return template.replace(/\{\{(.*?)\}\}/g, (_, expression) => {
    const [path, ...filters] = expression.split('|').map((part: string) => part.trim());
    let value = resolvePath(data, path, path);

    for (const filter of filters) {
      const separatorIndex = filter.indexOf(':');
      const name = (separatorIndex === -1 ? filter : filter.slice(0, separatorIndex)).trim();
      const argument = separatorIndex === -1 ? "" : filterArgument(filter.slice(separatorIndex + 1));

      if (name === "map") {
        if (!argument) throw new Error("The map filter requires a property path");
        if (!Array.isArray(value)) throw new Error(`The map filter requires an array: ${path}`);
        value = value.map((item) => resolvePath(item, argument, `${path} | map:${argument}`));
      } else if (name === "join") {
        if (!Array.isArray(value)) throw new Error(`The join filter requires an array: ${path}`);
        value = value.join(argument || ", ");
      } else {
        throw new Error(`Unknown prompt filter: ${name}`);
      }
    }

    if (Array.isArray(value)) {
      return '"' + value.join('", "') + '"';
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return value;
  });
}
