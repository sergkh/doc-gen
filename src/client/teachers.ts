import type { Teacher } from "@/stores/models";

export async function loadAllTeachers() {
  const res = await fetch(`/api/teachers`)

  if (!res.ok) {
    throw new Error(`Помилка завантаження викладачів: ${res.status}`);
  }

  return await res.json() as Teacher[];
}

export async function loadTeacher(id: string): Promise<Teacher> {
  if (id === "new") {
    return {
      id: -1,
      name: "",
      email: ""
    };
  }

  const res = await fetch(`/api/teachers/${id}`);

  if (!res.ok) {
    throw new Error(`Помилка завантаження викладача: ${res.status}`);
  }

  return await res.json() as Teacher;
}

export async function upsertTeacher(teacher: Teacher): Promise<void> {
  const method = teacher.id >= 0 ? "PUT" : "POST";
  const url = teacher.id >= 0 ? `/api/teachers/${teacher.id}` : `/api/teachers`;

  const teacherData = teacher.id >= 0 ? teacher : { name: teacher.name, email: teacher.email };

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(teacherData)
  });

  if (!res.ok) {
    throw new Error(`Помилка збереження викладача: ${res.status}`);
  }
}

export async function deleteTeacher(id: number): Promise<void> {
  const res = await fetch(`/api/teachers/${id}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    throw new Error(`Помилка видалення викладача: ${res.status}`);
  }
}
