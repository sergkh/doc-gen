export function dropEmpty(obj: any) {
  Object.keys(obj).forEach(key => {
    if (obj[key] === null || obj[key] === "" || (Array.isArray(obj[key]) && obj[key].length === 0)) {
      delete obj[key];
    }
  });
  return obj;
}

export function formatPrompt(template: string, data: Record<string, any>): string {
  if (!template) return template;
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const result = data[key.trim()];
    if (result === undefined) throw new Error(`Missing dependency: ${key.trim()}`);
    return result;
  });
}