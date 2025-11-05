import type { CourseResult } from "@/stores/models";

export async function loadAllResults() {
  const res = await fetch(`/api/results`)

  if (!res.ok) {
    throw new Error(`Помилка завантаження результатів: ${res.status}`);
  }

  return await res.json() as CourseResult[];
}

export async function loadResult(id: string): Promise<CourseResult> {
  if (id === "new") {
    return {
      id: -1,
      no: 0,
      type: "ЗК",
      name: ""
    };
  }

  const res = await fetch(`/api/results/${id}`);

  if (!res.ok) {
    throw new Error(`Помилка завантаження результату: ${res.status}`);
  }

  return await res.json() as CourseResult;
}

export async function upsertResult(result: CourseResult): Promise<void> {
  const method = result.id >= 0 ? "PUT" : "POST";
  const url = result.id >= 0 ? `/api/results/${result.id}` : `/api/results`;

  const resultData = result.id >= 0 ? result : { id: result.id, no: result.no, type: result.type, name: result.name };

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(resultData)
  });

  if (!res.ok) {
    throw new Error(`Помилка збереження результату: ${res.status}`);
  }
}

export async function deleteResult(id: number): Promise<void> {
  const res = await fetch(`/api/results/${id}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    throw new Error(`Помилка видалення результату: ${res.status}`);
  }
}

export async function uploadResultsFromDocx(file: File): Promise<CourseResult[]> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/results/from-docx", {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Помилка завантаження файлу: ${res.status} - ${errorText}`);
  }

  return await res.json() as CourseResult[];
}


