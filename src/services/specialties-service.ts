import { create } from "jsondiffpatch";
import { specialties, courseResults, history } from "@/stores/db";
import type { DocVersionRecord, Specialty } from "@/stores/models";

async function getAllSpecialties(): Promise<Specialty[]> {
  console.log("Fetching all specialties");
  return specialties.all();
}

async function getSpecialtyById(id: number): Promise<Specialty | null> {
  console.log("Fetching specialty with ID:", id);
  return specialties.get(Number(id));
}

async function createSpecialty(specialtyData: Omit<Specialty, "id">): Promise<Specialty> {
  console.log("Adding new specialty", specialtyData);
  const created = (await specialties.add(specialtyData))[0] as Specialty;
  await history.save({
    object_id: created.id,
    object_type: "specialty",
    type: "snapshot",
    stamp: new Date(),
    comment: "Created new specialty by user",
    data: created,
  } as Partial<DocVersionRecord>);

  return created;
}

async function updateSpecialty(id: number, specialty: Specialty): Promise<Specialty> {
  console.log("Updating specialty with ID:", id, specialty);
  const oldSpecialty = await specialties.get(Number(id));
  if (!oldSpecialty) {
    throw new Error("Specialty not found");
  }

  specialty.id = id;
  await specialties.update(specialty);

  const updatedSpecialty = await specialties.get(Number(id));
  if (!updatedSpecialty) {
    throw new Error("Failed to load updated specialty");
  }

  await history.saveHistory(oldSpecialty, updatedSpecialty, "Updated specialty by user", "specialty");
  return updatedSpecialty;
}

async function deleteSpecialty(id: number): Promise<void> {
  console.log("Deleting specialty with ID:", id);
  const specialty = await specialties.get(Number(id));
  if (specialty) {
    await history.createTombstone("specialty", specialty, "Deleted by user");
  }
  await specialties.delete(Number(id));
}

async function getSpecialtyResults(specialtyId: number) {
  console.log("Fetching results for specialty ID:", specialtyId);
  return courseResults.bySpecialty(Number(specialtyId));
}

async function getSpecialtyHistory(specialtyId: number) {
  return history.forObject("specialty", specialtyId);
}

async function revertToHistory(specialtyId: number, historyId: number): Promise<Specialty> {
  const records = await history.forObject("specialty", specialtyId);

  if (records.length === 0) {
    throw new Error("Немає записів історії для цієї спеціальності");
  }

  const current = await specialties.get(specialtyId);
  if (!current) {
    throw new Error("Спеціальність не знайдено");
  }

  const ordered = [...records].sort(
    (a, b) => new Date(a.stamp).getTime() - new Date(b.stamp).getTime()
  );

  const targetIdx = ordered.findIndex((r) => r.id === historyId);
  if (targetIdx === -1) {
    throw new Error("Запис історії не знайдено");
  }

  const diffpatcher = create();
  const targetRecord = ordered[targetIdx]!;

  const getSnapshotState = (record: DocVersionRecord): Specialty => {
    if (!record.data) throw new Error("Снапшот не містить даних");
    return record.data as Specialty;
  };

  let restoredState: Specialty;

  if (targetRecord.type === "snapshot") {
    restoredState = getSnapshotState(targetRecord);
  } else if (targetRecord.type === "patch") {
    let snapshotIdx = -1;

    for (let i = targetIdx - 1; i >= 0; i--) {
      if (ordered[i]!.type === "snapshot") {
        snapshotIdx = i;
        break;
      }
    }

    if (snapshotIdx === -1) {
      throw new Error("Не знайдено попередній snapshot для цього запису");
    }

    let state = getSnapshotState(ordered[snapshotIdx]!);

    for (let i = snapshotIdx + 1; i <= targetIdx; i++) {
      const entry = ordered[i]!;

      if (entry.type === "patch") {
        if (!entry.data) {
          throw new Error(`Патч #${entry.id} не містить даних`);
        }
        state = diffpatcher.patch(state, entry.data) as Specialty;
      }
    }

    restoredState = state;
  } else {
    throw new Error(`Відновлення підтримується лише для snapshot або patch записів. Знайдено: ${targetRecord.type}`);
  }

  const specialtyToSave: Specialty = {
    ...current,
    ...restoredState,
    id: specialtyId,
  };

  await specialties.update(specialtyToSave);

  const persisted = await specialties.get(specialtyId);
  if (!persisted) {
    throw new Error("Не вдалося оновити спеціальність після відновлення");
  }

  await history.save({
    object_id: specialtyId,
    object_type: "specialty",
    type: "snapshot",
    stamp: new Date(),
    comment: `Відновлено до запису історії #${historyId}`,
    data: persisted,
  } as Partial<DocVersionRecord>);

  return persisted;
}

export const specialtiesService = {
  getAllSpecialties,
  getSpecialtyById,
  createSpecialty,
  updateSpecialty,
  deleteSpecialty,
  getSpecialtyResults,
  getSpecialtyHistory,
  revertToHistory,
};
