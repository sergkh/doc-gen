import type { Teacher } from "@/stores/models";

export async function loadAllTeachers() {
  const res = await fetch(`/api/teachers`)

  if (!res.ok) {
    throw new Error(`Помилка завантаження викладачів: ${res.status}`);
  }

  return await res.json() as Teacher[];
}
