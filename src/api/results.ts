import { parseOPP } from "@/docx/parse";
import { courseResults } from "@/stores/db";
import type { CourseResult } from "@/stores/models";
import type { BunRequest } from "bun";
import path from "path";

async function parseResultsFromDocx(filePath: string): Promise<CourseResult[]> {
  const opp = await parseOPP(filePath);
  if (!opp) throw new Error("Невалідний файл ОПП");
  console.log("Parsed OPP results: ", opp);
  return [...opp.specialResults, ...opp.generalResults, ...opp.programResults];
  return [];
}

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
  "/api/results/from-docx": {
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
        
        if (!isDocxFile) {
          return new Response("Invalid file type. Expected .docx file", { status: 400 });
        }

        const uploadFileName = `${Date.now()}.docx`;
        const uploadsDir = path.join(process.cwd(), "uploads");
        const uploadPath = path.join(uploadsDir, uploadFileName);

        // Save the file (Bun.write will create directories if needed)
        await Bun.write(uploadPath, file);
        console.log("Saving uploaded file to:", uploadPath);

        // Parse the docx file
        const parsedResults = await parseResultsFromDocx(uploadPath);
              
        const savedResults: CourseResult[] = await Promise.all(parsedResults.map(async (result) => {
          const id = await courseResults.add(result)
          return Object.assign(result, { id });
        }));
        
        return Response.json(savedResults);
      } catch (error) {
        console.error("Error processing docx file:", error);
        return new Response(`Error processing docx file: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
      }
    }
  }
};

export default resultsApi;

