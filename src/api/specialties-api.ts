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
       const specialty = await specialtiesService.createSpecialty(specialtyData);
      return Response.json(specialty);
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
      return Response.json(specialty);
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
  },
  "/api/specialties/:id/history": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Fetching history for specialty ID:", id);
      const entries = await specialtiesService.getSpecialtyHistory(Number(id));
      return Response.json(entries);
    }
  },
  "/api/specialties/:id/history/:historyId/revert": {
    async POST(req: BunRequest) {
      const { id, historyId } = req.params as { id: string; historyId: string };
      console.log("Reverting specialty ID:", id, "to history entry:", historyId);
      try {
        const specialty = await specialtiesService.revertToHistory(Number(id), Number(historyId));
        return Response.json({ success: true, specialty });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Невідома помилка";
        return new Response(JSON.stringify({ error: message }), { status: 400 });
      }
    }
  }
};

export default specialtiesApi;
