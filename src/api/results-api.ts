import { courseResults } from "@/stores/db";
import type { CourseResult } from "@/stores/models";
import type { BunRequest } from "bun";


const resultsApi = {
  "/api/specialties/:specialtyId/results": {
    async GET(req: BunRequest) {
      const { specialtyId } = req.params as { specialtyId: string };
      console.log("Fetching course results for specialty:", specialtyId);
      return Response.json(await courseResults.bySpecialty(Number(specialtyId)));
    },
    async POST(req: BunRequest) {
      const { specialtyId } = req.params as { specialtyId: string };
      const result = await req.json() as CourseResult;
      result.specialty_id = Number(specialtyId);
      console.log("Adding new course result for specialty:", specialtyId, result);
      await courseResults.add(result);
      return Response.json({ success: true });
    }
  },
  "/api/specialties/:specialtyId/results/:id": {
    async GET(req: BunRequest) {
      const { specialtyId, id } = req.params as { specialtyId: string; id: string };
      console.log("Fetching course result with ID:", id, "for specialty:", specialtyId);
      const result = await courseResults.get(Number(id));
      if (!result || result.specialty_id !== Number(specialtyId)) {
        return new Response("Course result not found", { status: 404 });
      }
      return Response.json(result);
    },
    async PUT(req: BunRequest) {
      const { specialtyId, id } = req.params as { specialtyId: string; id: string };
      const existing = await courseResults.get(Number(id));
      if (!existing || existing.specialty_id !== Number(specialtyId)) {
        return new Response("Course result not found", { status: 404 });
      }
      const result = await req.json() as CourseResult;
      result.id = Number(id);
      result.specialty_id = Number(specialtyId);
      console.log("Updating course result with ID:", id, "for specialty:", specialtyId, result);
      await courseResults.update(result);
      return Response.json({ success: true });
    },
    async DELETE(req: BunRequest) {
      const { specialtyId, id } = req.params as { specialtyId: string; id: string };
      const existing = await courseResults.get(Number(id));
      if (!existing || existing.specialty_id !== Number(specialtyId)) {
        return new Response("Course result not found", { status: 404 });
      }
      console.log("Deleting course result with ID:", id, "for specialty:", specialtyId);
      await courseResults.delete(Number(id));
      return Response.json({ success: true });
    }
  }
};

export default resultsApi;
