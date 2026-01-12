import type { Specialty } from "@/stores/models";

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
      qualification: "",
      data: { disciplines: [] }
    };
  }

  const res = await fetch(`/api/specialties/${id}`);

  if (!res.ok) {
    throw new Error(`Помилка завантаження спеціальності: ${res.status}`);
  }

  return await res.json() as Specialty;
}

export async function upsertSpecialty(specialty: Specialty): Promise<void> {
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
}

export async function deleteSpecialty(id: number): Promise<void> {
  const res = await fetch(`/api/specialties/${id}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    throw new Error(`Помилка видалення спеціальності: ${res.status}`);
  }
}

