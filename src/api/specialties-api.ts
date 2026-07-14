import { parseOPP } from "@/docx/opp-results";
import { courseResults, specialties } from "@/stores/db";
import type { Specialty } from "@/stores/models";
import type { BunRequest } from "bun";
import path from "path";
import { specialtiesService } from "@/services/specialties-service";
import { computeFileHash } from "./utils/files";

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
  },
  "/api/specialties/parse": {
    async POST(req: BunRequest) {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
          return new Response("No file provided", { status: 400 });
        }

        const fileName = file.name.toLowerCase();
        const isDocxFile =
          file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          fileName.endsWith(".docx");
        const isPdfFile = file.type === "application/pdf" || fileName.endsWith(".pdf");

        if (!isDocxFile && !isPdfFile) {
          return new Response("Invalid file type. Expected .docx or .pdf file", { status: 400 });
        }

        const hash = await computeFileHash(file);
        const fileExtension = path.extname(file.name);
        const uploadFileName = `${hash}${fileExtension}`;
        const uploadsDir = path.join(process.cwd(), "uploads", "opps");
        const uploadPath = path.join(uploadsDir, uploadFileName);

        await Bun.write(uploadPath, file);
        console.log("Saving uploaded OPP file to:", uploadPath);

        const opp = await parseOPP(uploadPath);
        if (!opp) throw new Error("Невалідний файл ОПП");

        console.log("Parsed results:", opp.generalResults, opp.specialResults, opp.programResults, opp.integralResults);
        console.log("Parsed disciplines:", opp.disciplines);

        const dbSpecialty = opp.specialty.code
          ? await specialties.findByCode(opp.specialty.code, opp.specialty.degree)
          : null;

        const updatedSpecialty = dbSpecialty
          ? {
              ...dbSpecialty,
              ...opp.specialty,
              id: dbSpecialty.id,
            }
          : opp.specialty;

        let specialtyId = -1;

        if (dbSpecialty) {
          console.log("Updating specialty:", updatedSpecialty.name);
          await specialties.update(updatedSpecialty);
          specialtyId = dbSpecialty.id;
        } else {
          console.log("Adding new specialty:", updatedSpecialty.name);
          specialtyId = (await specialties.add(opp.specialty))[0].id;
        }

        const parsedResults = [...opp.integralResults, ...opp.specialResults, ...opp.generalResults, ...opp.programResults];
        const oldResults = await courseResults.bySpecialty(specialtyId);

        const savedResults = await Promise.all(
          parsedResults.map(async (result) => {
            try {
              const id = await courseResults.add({ ...result, specialty_id: specialtyId });
              return Object.assign(result, { id });
            } catch (error) {
              if (error && typeof error === "object" && "errno" in error && error.errno === "23505") return null;
              console.error("Error adding result:", error);
              return null;
            }
          })
        );

        for (const oldResult of oldResults) {
          if (!parsedResults.find((r) => r && r.type === oldResult.type && r.no === oldResult.no)) {
            console.log("Deleting old result not in parsed document:", oldResult);
            await courseResults.delete(oldResult.id);
          }
        }

        return Response.json(savedResults.filter((result) => result !== null));
      } catch (error) {
        console.error("Error processing docx file:", error);
        return new Response(`Error processing docx file: ${error instanceof Error ? error.message : "Unknown error"}`, {
          status: 500,
        });
      }
    }
  }
};

export default specialtiesApi;
