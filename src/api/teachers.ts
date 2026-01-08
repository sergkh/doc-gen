import { teachers, teacherPublications } from "@/stores/db";
import type { Teacher, TeacherPublication } from "@/stores/models";
import type { BunRequest } from "bun";
import { fetchTeacherPublications } from "@/parsing/lit-parser";

const teachersApi = {
  "/api/teachers": {
    async GET() {
      console.log("Fetching all teachers");
      return Response.json(await teachers.all());
    },
    async POST(req: BunRequest) {
      const teacherData = await req.json() as Omit<Teacher, "id">;
      console.log("Adding new teacher", teacherData);
      const teacher = { ...teacherData, id: 0 } as Teacher;
      await teachers.add(teacher);
      return Response.json({ success: true });
    }
  },
  "/api/teachers/:id": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Fetching teacher with ID:", id);
      const teacher = await teachers.get(Number(id));
      if (!teacher) {
        return new Response("Teacher not found", { status: 404 });
      }
      return Response.json(teacher);
    },
    async PUT(req: BunRequest) {
      const { id } = req.params as { id: string };
      const teacher = await req.json() as Teacher;
      teacher.id = Number(id);
      console.log("Updating teacher with ID:", id, teacher);
      await teachers.update(teacher);
      return Response.json({ success: true });
    },
    async DELETE(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Deleting teacher with ID:", id);
      await teachers.delete(Number(id));
      return Response.json({ success: true });
    }
  },
  "/api/teachers/:id/publications": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      const teacherId = Number(id);
      
      console.log("Fetching publications for teacher with ID:", teacherId);
      
      // Get publications for this teacher
      const publications = await teacherPublications.byTeacher(teacherId);
      
      return Response.json(publications);
    }
  },
  "/api/teachers/:id/refresh-publications": {
    async POST(req: BunRequest) {
      const { id } = req.params as { id: string };
      const teacherId = Number(id);
      
      console.log("Refreshing publications for teacher with ID:", teacherId);
      
      // Get the teacher
      const teacher = await teachers.get(teacherId);
      
      if (!teacher) {
        return new Response("Teacher not found", { status: 404 });
      }
      
      try {
        // Fetch publications from external source
        const publications = await fetchTeacherPublications(teacher);
        
        // Clear existing publications for this teacher
        await teacherPublications.deleteByTeacher(teacherId);

        const addedPublications: TeacherPublication[] = [];
        for (const pub of publications) {
          addedPublications.push(await teacherPublications.add(pub));
        }
        
        console.log(`Added ${addedPublications.length} publications for teacher ${teacherId}`);
        return Response.json({ success: true, count: addedPublications.length });
      } catch (error) {
        console.error("Error refreshing publications:", error);
        return new Response("Failed to refresh publications", { status: 500 });
      }
    }
  }
};

export default teachersApi;