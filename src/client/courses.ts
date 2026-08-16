import type { Course, CourseTopic, KeyValue } from "@/stores/models";

export const ATTESTATION_COLORS = [
  "var(--mantine-color-blue-light)",
  "var(--mantine-color-teal-light)",
  "var(--mantine-color-green-light)",
  "var(--mantine-color-yellow-light)",
  "var(--mantine-color-orange-light)",
  "var(--mantine-color-red-light)",
  "var(--mantine-color-pink-light)",
  "var(--mantine-color-violet-light)",
] as const;

export function getAttestationColor(attestationIndex: number): string {
  const zeroBasedIndex = Number.isFinite(attestationIndex) && attestationIndex > 0
    ? Math.floor(attestationIndex) - 1
    : 0;

  return ATTESTATION_COLORS[zeroBasedIndex % ATTESTATION_COLORS.length]!;
}

export function formatDisciplineCode(okNo: string | null): string {
  if (!okNo) return "??";
  if(/^\d{1,2}$/.test(okNo)) return `ОК${okNo}`;
  return `ВК${okNo}`;
}

export function normalizeCourseName(name: string): string {
  return name.toLowerCase().trim().replaceAll("'", "ʼ"); // fix apostrophe variations
}

export function compareOks(codeA: string | null, codeB: string | null): number {
  if (codeA === codeB) return 0;
  if (codeA === null) return -1;
  if (codeB === null) return 1;

  if (/^\d{1,2}$/.test(codeA)) {
    if(/^\d{1,2}$/.test(codeB)) {
      return Number(codeA) - Number(codeB);
    } else {
      return -1;
    }
  } else {
    if(/^\d{1,2}$/.test(codeB)) {
      return 1;
    }
  }

  return codeA.localeCompare(codeB);
}

export async function loadAllCourses() {
  const res = await fetch(`/api/courses`)

  if (!res.ok) {
    throw new Error(`Помилка завантаження дисциплін: ${res.status}`);
  }

  const courses = await res.json() as Course[];

  courses.sort((a, b) => compareOks(a.data.ok_no, b.data.ok_no));

  return courses;
}

export async function loadCoursesBySpecialty(specialtyId: number) {
  const url = `/api/courses?specialtyId=${specialtyId}`;

  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`Помилка завантаження дисциплін: ${res.status}`);
  }

  const courses = await res.json() as Course[];

  courses.sort((a, b) => compareOks(a.data.ok_no, b.data.ok_no));

  return courses;
}

export async function loadAllCoursesWithTopics(specialtyId: number) {
  const res = await fetch(`/api/courses?specialtyId=${specialtyId}&topics=true`)

  if (!res.ok) {
    throw new Error(`Помилка завантаження дисциплін: ${res.status}`);
  }

  const courses = await res.json() as (Course & { topics: CourseTopic[] })[];

  courses.sort((a, b) => compareOks(a.data.ok_no, b.data.ok_no));

  return courses;
}

export async function loadAllCoursesBrief() {
  const res = await fetch(`/api/courses?brief=true`)

  if (!res.ok) {
    throw new Error(`Помилка завантаження дисциплін: ${res.status}`);
  }

  return await res.json() as KeyValue[];
}

export async function loadCourse(id: string): Promise<Course> {
  if (id === "new") {
    return {
      id: -1,
      name: "",
      teacher_id: 0,
      specialty_id: 1,
      generated: null,
      data: {
        ok_no: null,
        hours: 0,
        control_type: "exam",
        optional: false,
        credits: 0,
        specialty: "122 – Компʼютерні науки",
        specialty_mode: 'old_only',
        area: "Компʼютерні науки",
        description: "",
        prerequisites: [],
        postrequisites: [],
        results: [],
        attestations: [],
        fulltime: {
          semesters: [],
          study_year: 1
        },
        inabscentia: {
          semesters: [],
          study_year: 1
        },
        literature: {
          main: [],
          additional: [],
          internet: []
        },
      },
      version: 1
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

export async function uploadMultipleCourses(files: File[]): Promise<any[]> {
  const formData = new FormData();
  files.forEach(file => formData.append("files", file));

  const res = await fetch(`/api/courses/parse-docx`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    throw new Error(`Помилка завантаження файлів: ${res.status}`);
  }

  return await res.json();
}

export async function deleteCourse(id: number): Promise<void> {
  const res = await fetch(`/api/courses/${id}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    throw new Error(`Помилка видалення дисципліни: ${res.status}`);
  }
}

export async function autofillCourseResults(courseId: number, type: "ЗК" | "СК" | "РН"): Promise<{ id: number; reason: string }[]> {
  const res = await fetch(`/api/courses/${courseId}/results/autofill`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ type })
  });

  if (!res.ok) {
    throw new Error(`Помилка автозаповнення результатів: ${res.status}`);
  }

  return await res.json();
}

export async function renameAttestation(courseId: number, attestationIndex: number, topics: CourseTopic[]): Promise<string> {
  const res = await fetch(`/api/courses/${courseId}/attestations/${attestationIndex}/ai-rename`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ attestationIndex, topics })
  });

  if (!res.ok) {
    throw new Error(`Помилка перейменування атестації: ${res.status}`);
  }

  const body = await res.json() as { name: string };
  return body.name;
}

export async function generateTopicSubtopics(
  courseId: number,
  topic: Pick<CourseTopic, "name" | "lection">,
): Promise<string[]> {
  const res = await fetch(`/api/courses/${courseId}/topics/subtopics/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(topic),
  });

  if (!res.ok) {
    throw new Error(`Помилка генерації підтеми: ${res.status}`);
  }

  const body = await res.json() as { subtopics: string[] };
  return body.subtopics;
}

export type AIGeneratedTopic = {
  name: string;
  subtopics: string[];
};

export async function loadCourseHistory(courseId: number): Promise<any[]> {
  const res = await fetch(`/api/courses/${courseId}/history`);

  if (!res.ok) {
    throw new Error(`Помилка завантаження історії: ${res.status}`);
  }

  return await res.json();
}

export async function revertCourseToHistory(courseId: number, historyId: number): Promise<any> {
  const res = await fetch(`/api/courses/${courseId}/history/${historyId}/revert`, {
    method: "POST",
  });

  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error || `Помилка відновлення: ${res.status}`);
  }

  return await res.json();
}

export async function resetCourseHistory(courseId: number): Promise<void> {
  const res = await fetch(`/api/courses/${courseId}/history/reset`, {
    method: "POST",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Помилка скидання історії: ${res.status}`);
  }
}

export async function generateCourseTopics(courseId: number): Promise<AIGeneratedTopic[]> {
  const res = await fetch(`/api/courses/${courseId}/topics/generate`, {
    method: "POST"
  });

  if (!res.ok) {
    throw new Error(`Помилка генерації тем: ${res.status}`);
  }

  return await res.json();
}
