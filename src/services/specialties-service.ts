import { specialties, courseResults } from "@/stores/db";
import type { Specialty } from "@/stores/models";

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
  const specialtyId = (await specialties.add(specialtyData))[0].id;
  return { ...specialtyData, id: specialtyId };
}

async function updateSpecialty(id: number, specialty: Specialty): Promise<Specialty> {
  console.log("Updating specialty with ID:", id, specialty);
  specialty.id = id;
  await specialties.update(specialty);
  return specialty;
}

async function deleteSpecialty(id: number): Promise<void> {
  console.log("Deleting specialty with ID:", id);
  await specialties.delete(Number(id));
}

async function getSpecialtyResults(specialtyId: number) {
  console.log("Fetching results for specialty ID:", specialtyId);
  return courseResults.bySpecialty(Number(specialtyId));
}

export const specialtiesService = {
  getAllSpecialties,
  getSpecialtyById,
  createSpecialty,
  updateSpecialty,
  deleteSpecialty,
  getSpecialtyResults
};
