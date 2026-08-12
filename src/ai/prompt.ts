export function formatPrompt(template: string, data: Record<string, any>): string {
  if (!template) return template;

  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const path = key.trim().split('.'); // JSON path    

    const value = path.reduce((o: Record<string, any>, fld: string) => {
      // For arrays map subsequent fields
      if (Array.isArray(o)) return o.map((item: any) => item[fld]);
      const v = o[fld];
      if (v === undefined) throw new Error(`Missing dependency: ${key.trim()}. Available: ${Object.keys(o).join(", ")}`);
      return v;
    }, data);

    if (Array.isArray(value)) {
      return value.join('", "');
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return value;
  });
}