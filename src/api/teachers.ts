import { teachers } from "@/stores/db";
import type { Teacher } from "@/stores/models";
import type { BunRequest } from "bun";

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
  }
};

export default teachersApi;