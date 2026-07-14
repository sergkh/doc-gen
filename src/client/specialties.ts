import type { DocVersionRecord, Specialty } from "@/stores/models";

export async function loadAllSpecialties() {
  const res = await fetch(`/api/specialties`);

  if (!res.ok) {
    throw new Error(`Помилка завантаження спеціальностей: ${res.status}`);
  }

  return await res.json() as Specialty[];
}

export async function loadSpecialty(id: string): Promise<Specialty> {
  if (id === "new") {
    return {
      id: -1,
      code: "",
      name: "",
      old_code: "",
      old_name: "",
      area_code: "",
      area: "",
      degree: "bachelor",
      qualification: "",
      data: { disciplines: [] }
    };
  }

  const res = await fetch(`/api/specialties/${id}`);

  if (!res.ok) {
    throw new Error(`Помилка завантаження спеціальності ${id}: ${res.status}`);
  }

  return await res.json() as Specialty;
}

export async function upsertSpecialty(specialty: Specialty): Promise<Specialty> {
  const method = specialty.id >= 0 ? "PUT" : "POST";
  const url = specialty.id >= 0 ? `/api/specialties/${specialty.id}` : `/api/specialties`;

  const specialtyData = specialty.id >= 0 ? specialty : { 
    id: specialty.id, 
    code: specialty.code, 
    name: specialty.name, 
    old_code: specialty.old_code,
    old_name: specialty.old_name,
    area_code: specialty.area_code,
    area: specialty.area,
    degree: specialty.degree,
    qualification: specialty.qualification,
    data: specialty.data
  };

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(specialtyData)
  });

  if (!res.ok) {
    throw new Error(`Помилка збереження спеціальності: ${res.status}`);
  }

  return await res.json() as Specialty;
}

export async function deleteSpecialty(id: number): Promise<void> {
  const res = await fetch(`/api/specialties/${id}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    throw new Error(`Помилка видалення спеціальності: ${res.status}`);
  }
}

export async function loadSpecialtyHistory(id: number): Promise<DocVersionRecord[]> {
  const res = await fetch(`/api/specialties/${id}/history`);

  if (!res.ok) {
    throw new Error(`Помилка завантаження історії спеціальності: ${res.status}`);
  }

  return await res.json() as DocVersionRecord[];
}

export async function revertSpecialtyToHistory(id: number, historyId: number): Promise<Specialty> {
  const res = await fetch(`/api/specialties/${id}/history/${historyId}/revert`, {
    method: "POST",
  });

  if (!res.ok) {
    let message = `Помилка відновлення спеціальності: ${res.status}`;
    try {
      const body = await res.json() as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await res.json() as { specialty: Specialty };
  return data.specialty;
}
