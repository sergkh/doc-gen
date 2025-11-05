import type { Course } from "@/stores/models";

export async function loadAllCourses() {
  const res = await fetch(`/api/courses`)

  if (!res.ok) {
    throw new Error(`Помилка завантаження дисциплін: ${res.status}`);
  }

  return await res.json() as Course[];
}

export async function loadCourse(id: string): Promise<Course> {
  if (id === "new") {
    return {
      id: -1,
      name: "",
      teacher_id: 0,
      generated: null,
      data: {
        hours: 0,
        credits: 0,
        specialty: "122 – Компʼютерні науки",
        area: "Компʼютерні науки",
        description: "",
        prerequisites: [],
        postrequisites: [],
        results: []
      }
    };
  }

  const res = await fetch(`/api/courses/${id}`);

  if (!res.ok) {
    throw new Error(`Помилка завантаження дисциплін: ${res.status}`);
  }

  return await res.json() as Course;
}

export async function upsertCourse(course: Course): Promise<Course> {
  const method = course.id >= 0 ? "PUT" : "POST";
  const url = course.id >= 0 ? `/api/courses/${course.id}` : `/api/courses`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(course)
  });

  if (!res.ok) {
    throw new Error(`Помилка збереження дисципліни: ${res.status}`);
  }

  return await res.json() as Course;
}