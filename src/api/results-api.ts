import { courseResults } from "@/stores/db";
import type { CourseResult } from "@/stores/models";
import type { BunRequest } from "bun";


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
  }
};

export default resultsApi;
