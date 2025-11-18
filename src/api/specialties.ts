import { specialties, courseResults } from "@/stores/db";
import type { Specialty } from "@/stores/models";
import type { BunRequest } from "bun";

const specialtiesApi = {
  "/api/specialties": {
    async GET() {
      console.log("Fetching all specialties");
      return Response.json(await specialties.all());
    },
    async POST(req: BunRequest) {
      const specialtyData = await req.json() as Omit<Specialty, "id">;
      console.log("Adding new specialty", specialtyData);
      const specialty = { ...specialtyData, id: 0 } as Specialty;
      await specialties.add(specialty);
      return Response.json({ success: true });
    }
  },
  "/api/specialties/:id": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Fetching specialty with ID:", id);
      const specialty = await specialties.get(Number(id));
      if (!specialty) {
        return new Response("Specialty not found", { status: 404 });
      }
      return Response.json(specialty);
    },
    async PUT(req: BunRequest) {
      const { id } = req.params as { id: string };
      const specialty = await req.json() as Specialty;
      specialty.id = Number(id);
      console.log("Updating specialty with ID:", id, specialty);
      await specialties.update(specialty);
      return Response.json({ success: true });
    },
    async DELETE(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Deleting specialty with ID:", id);
      await specialties.delete(Number(id));
      return Response.json({ success: true });
    }
  },
  "/api/specialties/:id/results": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Fetching results for specialty ID:", id);
      const results = await courseResults.bySpecialty(Number(id));
      return Response.json(results);
    }
  }
};

export default specialtiesApi;

