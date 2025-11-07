import { prompts } from "@/stores/db";
import type { Prompt } from "@/stores/models";
import type { BunRequest } from "bun";

const promptsApi = {
  "/api/prompts/:type": {
    async GET(req: BunRequest) {
      const { type } = req.params as { type: string };
      console.log("Fetching prompts by type:", type);
      return Response.json(await prompts.getByType(type));
    },
    async POST(req: BunRequest) {
      const { type } = req.params as { type: string };
      const promptData = await req.json() as Omit<Prompt, "id" | "type">;
      console.log("Adding new prompt for type:", type, promptData);
      const prompt = { ...promptData, id: 0, type } as Prompt;
      const result = await prompts.add(prompt);
      return Response.json({ success: true, prompt: result[0] });
    }
  },
  "/api/prompts/:type/:id": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string; type: string };
      console.log("Fetching prompt with ID:", id);
      const prompt = await prompts.get(Number(id));
      if (!prompt) {
        return new Response("Prompt not found", { status: 404 });
      }
      return Response.json(prompt);
    },
    async PUT(req: BunRequest) {
      const { id } = req.params as { id: string; type: string };
      const promptData = await req.json() as Omit<Prompt, "id">;
      const prompt = { ...promptData, id: Number(id) } as Prompt;
      console.log("Updating prompt with ID:", id, prompt);
      const result = await prompts.update(prompt);
      return Response.json({ success: true, prompt: result[0] });
    },
    async DELETE(req: BunRequest) {
      const { id } = req.params as { id: string; type: string };
      console.log("Deleting prompt with ID:", id);
      await prompts.delete(Number(id));
      return Response.json({ success: true });
    }
  },
  "/api/prompts/:type/order": {
    async PUT(req: BunRequest) {
      const { type } = req.params as { type: string };
      const promptIds = await req.json() as number[];
      
      if (!Array.isArray(promptIds)) {
        return new Response("Invalid request body. Expected array of prompt IDs", { status: 400 });
      }

      if (promptIds.length === 0) {
        return new Response("Prompt IDs array cannot be empty", { status: 400 });
      }

      console.log("Reordering prompts for type:", type, "with IDs:", promptIds);
      
      try {
        await prompts.updateOrdering(type, promptIds);
        return Response.json({ success: true });
      } catch (error) {
        console.error("Error reordering prompts:", error);
        return new Response(`Error reordering prompts: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
      }
    }
  }
};

export default promptsApi;

