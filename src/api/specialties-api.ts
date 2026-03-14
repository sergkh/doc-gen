import type { Specialty } from "@/stores/models";
import type { BunRequest } from "bun";
import { specialtiesService } from "@/services/specialties-service";

const specialtiesApi = {
  "/api/specialties": {
    async GET() {
      return Response.json(await specialtiesService.getAllSpecialties());
    },
    async POST(req: BunRequest) {
      const specialtyData = await req.json() as Omit<Specialty, "id">;
      await specialtiesService.createSpecialty(specialtyData);
      return Response.json({ success: true });
    }
  },
  "/api/specialties/:id": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      const specialty = await specialtiesService.getSpecialtyById(Number(id));
      if (!specialty) {
        return new Response("Specialty not found", { status: 404 });
      }
      return Response.json(specialty);
    },
    async PUT(req: BunRequest) {
      const { id } = req.params as { id: string };
      const specialty = await req.json() as Specialty;
      await specialtiesService.updateSpecialty(Number(id), specialty);
      return Response.json({ success: true });
    },
    async DELETE(req: BunRequest) {
      const { id } = req.params as { id: string };
      await specialtiesService.deleteSpecialty(Number(id));
      return Response.json({ success: true });
    }
  },
  "/api/specialties/:id/results": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      const results = await specialtiesService.getSpecialtyResults(Number(id));
      return Response.json(results);
    }
  }
};

export default specialtiesApi;
