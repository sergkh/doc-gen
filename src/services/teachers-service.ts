import { teachers, teacherPublications } from "@/stores/db";
import type { Teacher, TeacherPublication } from "@/stores/models";
import { fetchTeacherPublications } from "@/parsing/lit-parser";

async function getAllTeachers(): Promise<Teacher[]> {
  return teachers.all();
}

async function getTeacherById(id: number): Promise<Teacher | null> {
  return teachers.get(Number(id));
}

async function createTeacher(teacherData: Omit<Teacher, "id">): Promise<Teacher> {
  const teacher = { ...teacherData, id: 0 } as Teacher;
  await teachers.add(teacher);
  return teacher;
}

async function updateTeacher(id: number, teacher: Teacher): Promise<Teacher> {
  teacher.id = Number(id);
  await teachers.update(teacher);
  return teacher;
}

async function deleteTeacher(id: number): Promise<void> {
  await teachers.delete(Number(id));
}

async function getTeacherPublications(teacherId: number): Promise<TeacherPublication[]> {
  return teacherPublications.byTeacher(teacherId);
}

async function refreshTeacherPublications(teacherId: number): Promise<number> {
  const teacher = await teachers.get(teacherId);
  if (!teacher) {
    throw new Error("Teacher not found");
  }

  const publications = await fetchTeacherPublications(teacher);
  await teacherPublications.deleteByTeacher(teacherId);

  const addedPublications: TeacherPublication[] = [];
  for (const pub of publications) {
    addedPublications.push(await teacherPublications.add(pub));
  }

  return addedPublications.length;
}

export const teachersService = {
  getAllTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getTeacherPublications,
  refreshTeacherPublications
};
