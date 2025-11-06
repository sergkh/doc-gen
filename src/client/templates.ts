import type { Template } from "@/stores/models";

export async function loadAllTemplates() {
  const res = await fetch(`/api/templates`);

  if (!res.ok) {
    throw new Error(`Помилка завантаження шаблонів: ${res.status}`);
  }

  return await res.json() as Template[];
}

export async function loadTemplate(id: string): Promise<Template> {
  if (id === "new") {
    return {
      id: -1,
      name: "",
      file: ""
    };
  }

  const res = await fetch(`/api/templates/${id}`);

  if (!res.ok) {
    throw new Error(`Помилка завантаження шаблону: ${res.status}`);
  }

  return await res.json() as Template;
}

export async function upsertTemplate(template: Template, file?: File): Promise<void> {
  const method = template.id >= 0 ? "PUT" : "POST";
  const url = template.id >= 0 ? `/api/templates/${template.id}` : `/api/templates`;

  const formData = new FormData();
  formData.append("name", template.name);
  if (file) {
    formData.append("file", file);
  }

  const res = await fetch(url, {
    method,
    body: formData
  });

  if (!res.ok) {
    throw new Error(`Помилка збереження шаблону: ${res.status}`);
  }
}

export async function deleteTemplate(id: number): Promise<void> {
  const res = await fetch(`/api/templates/${id}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    throw new Error(`Помилка видалення шаблону: ${res.status}`);
  }
}

