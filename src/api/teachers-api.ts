import type { Teacher } from "@/stores/models";
import type { BunRequest } from "bun";
import { teachersService } from "@/services/teachers-service";

const teachersApi = {
  "/api/teachers": {
    async GET() {
      console.log("Fetching all teachers");
      return Response.json(await teachersService.getAllTeachers());
    },
    async POST(req: BunRequest) {
      const teacherData = await req.json() as Omit<Teacher, "id">;
      console.log("Adding new teacher", teacherData);
      await teachersService.createTeacher(teacherData);
      return Response.json({ success: true });
    }
  },
  "/api/teachers/:id": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Fetching teacher with ID:", id);
      const teacher = await teachersService.getTeacherById(Number(id));
      if (!teacher) {
        return new Response("Teacher not found", { status: 404 });
      }
      return Response.json(teacher);
    },
    async PUT(req: BunRequest) {
      const { id } = req.params as { id: string };
      const teacher = await req.json() as Teacher;
      console.log("Updating teacher with ID:", id, teacher);
      await teachersService.updateTeacher(Number(id), teacher);
      return Response.json({ success: true });
    },
    async DELETE(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Deleting teacher with ID:", id);
      await teachersService.deleteTeacher(Number(id));
      return Response.json({ success: true });
    }
  },
  "/api/teachers/:id/publications": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      const teacherId = Number(id);
      
      console.log("Fetching publications for teacher with ID:", teacherId);
      const publications = await teachersService.getTeacherPublications(teacherId);
      
      return Response.json(publications);
    }
  },
  "/api/teachers/:id/timesheets/:period": {
    async GET(req: BunRequest) {
      const { id, period } = req.params as { id: string; period: string };
      if (!/^\d{4}-\d{2}$/.test(period)) return new Response("Invalid timesheet period", { status: 400 });
      const timesheet = await teachersService.getTeacherTimesheet(Number(id), period);
      return timesheet ? Response.json(timesheet) : new Response("Timesheet not found", { status: 404 });
    },
    async PUT(req: BunRequest) {
      const { id, period } = req.params as { id: string; period: string };
      if (!/^\d{4}-\d{2}$/.test(period)) return new Response("Invalid timesheet period", { status: 400 });
      const data = await req.json() as Record<string, unknown>;
      return Response.json(await teachersService.saveTeacherTimesheet(Number(id), period, data));
    },
  },
  "/api/teachers/:id/refresh-publications": {
    async POST(req: BunRequest) {
      const { id } = req.params as { id: string };
      const teacherId = Number(id);
      
      console.log("Refreshing publications for teacher with ID:", teacherId);
      
      const teacher = await teachersService.getTeacherById(teacherId);
      if (!teacher) {
        return new Response("Teacher not found", { status: 404 });
      }
      
      try {
        const count = await teachersService.refreshTeacherPublications(teacherId);
        console.log(`Added ${count} publications for teacher ${teacherId}`);
        return Response.json({ success: true, count });
      } catch (error) {
        console.error("Error refreshing publications:", error);
        return new Response("Failed to refresh publications", { status: 500 });
      }
    }
  }
};

export default teachersApi;
