import type { Course, KeyValue } from "@/stores/models";

export function formatDisciplineCode(okNo: string | null): string {
  if (!okNo) return "??";
  if(/^\d{1,2}$/.test(okNo)) return `ОК${okNo}`;
  return `ВК${okNo}`;
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
      generated: null,
      data: {
        ok_no: null,
        hours: 0,
        control_type: "exam",
        optional: false,
        credits: 0,
        specialty: "122 – Компʼютерні науки",
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
        }
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

export async function deleteCourse(id: number): Promise<void> {
  const res = await fetch(`/api/courses/${id}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    throw new Error(`Помилка видалення дисципліни: ${res.status}`);
  }
}