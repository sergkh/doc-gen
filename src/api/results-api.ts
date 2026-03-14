import { parseOPP } from "@/docx/opp-results";
import { courseResults, specialties } from "@/stores/db";
import type { CourseResult } from "@/stores/models";
import type { BunRequest } from "bun";
import path from "path";
import { computeFileHash } from "./utils/files";


const resultsApi = {
  "/api/results": {
    async GET() {
      console.log("Fetching all course results");
      return Response.json(await courseResults.all());
    },
    async POST(req: BunRequest) {
      const result = await req.json() as CourseResult;
      console.log("Adding new course result", result);
      await courseResults.add(result);
      return Response.json({ success: true });
    }
  },
  "/api/results/:id": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Fetching course result with ID:", id);
      const result = await courseResults.get(Number(id));
      if (!result) {
        return new Response("Course result not found", { status: 404 });
      }
      return Response.json(result);
    },
    async PUT(req: BunRequest) {
      const { id } = req.params as { id: string };
      const result = await req.json() as CourseResult;
      result.id = Number(id);
      console.log("Updating course result with ID:", id, result);
      await courseResults.update(result);
      return Response.json({ success: true });
    },
    async DELETE(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Deleting course result with ID:", id);
      await courseResults.delete(Number(id));
      return Response.json({ success: true });
    }
  },
  "/api/results/parse": {
    async POST(req: BunRequest) {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        
        if (!file) {
          return new Response("No file provided", { status: 400 });
        }

        // Validate file type
        const fileName = file.name.toLowerCase();
        const isDocxFile = 
          file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          fileName.endsWith(".docx");
        
        const isPdfFile = file.type === "application/pdf" || fileName.endsWith(".pdf");
        
        if (!isDocxFile && !isPdfFile) {
          return new Response("Invalid file type. Expected .docx or .pdf file", { status: 400 });
        }

        // Generate unique filename using hash
        const hash = await computeFileHash(file);
        const fileExtension = path.extname(file.name);
        const uploadFileName = `${hash}${fileExtension}`;        
        const uploadsDir = path.join(process.cwd(), "uploads", "opps");
        const uploadPath = path.join(uploadsDir, uploadFileName);

        // Save the file (Bun.write will create directories if needed)
        await Bun.write(uploadPath, file);
        console.log("Saving uploaded OPP file to:", uploadPath);

        // Parse the docx file
        const opp = await parseOPP(uploadPath);
        if (!opp) throw new Error("Невалідний файл ОПП");

        console.log("Parsed results:", opp.generalResults, opp.specialResults, opp.programResults, opp.integralResults);
        console.log("Parsed disciplines:", opp.disciplines);

        const dbSpecialty = opp.specialty.code ?  await specialties.findByCode(opp.specialty.code) : null;

        const updatedSpecialty = dbSpecialty ? {
          dbSpecialty,
          ...opp.specialty,
          id: dbSpecialty.id
        }: opp.specialty;

        let specialtyId = -1;

        if (dbSpecialty) {
          console.log("Updating specialty:", updatedSpecialty.name);
          specialties.update(updatedSpecialty);
          specialtyId = dbSpecialty.id;
        } else {
          console.log("Adding new specialty:", updatedSpecialty.name);
          specialtyId = (await specialties.add(opp.specialty))[0].id;
        }
        
        const parsedResults = [...opp.integralResults, ...opp.specialResults, ...opp.generalResults, ...opp.programResults];

        const oldResults = await courseResults.bySpecialty(specialtyId);

        const savedResults: (CourseResult | null)[] = await Promise.all(parsedResults.map(async (result) => {
          try {
            const id = await courseResults.add({...result, specialty_id: specialtyId});
            return Object.assign(result, { id });
          } catch (error) {
            // ignore duplicate key errors (PostgreSQL unique constraint violation)
            if (error && typeof error === 'object' && 'errno' in error && error.errno === '23505') return null;            
            console.error("Error adding result:", error);
            return null;
          }
        }));

        // remove old extra results that were not in the parsed document
        for (const oldResult of oldResults) {
          if (!parsedResults.find(r => r && r.type === oldResult.type && r.no === oldResult.no)) {
            console.log("Deleting old result not in parsed document:", oldResult);
            await courseResults.delete(oldResult.id);
          }
        }
        
        return Response.json(savedResults.filter(result => result !== null));
      } catch (error) {
        console.error("Error processing docx file:", error);
        return new Response(`Error processing docx file: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
      }
    }
  }
};

export default resultsApi;

