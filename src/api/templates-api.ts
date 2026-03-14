import type { Template } from "@/stores/models";
import type { BunRequest } from "bun";
import { templatesService } from "@/services/templates-service";

const templatesApi = {
  "/api/templates": {
    async GET() {
      console.log("Fetching all templates");
      return Response.json(await templatesService.getAllTemplates());
    },
    async POST(req: BunRequest) {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const name = formData.get("name") as string;
        const dataStr = formData.get("data") as string | null;
        const promptsStr = formData.get("prompts") as string | null;

        if (!file) {
          return new Response("No file provided", { status: 400 });
        }

        if (!name) {
          return new Response("No name provided", { status: 400 });
        }

        const data = dataStr ? JSON.parse(dataStr) : undefined;
        const prompts = promptsStr ? JSON.parse(promptsStr) : [];

        const template = await templatesService.createTemplate(file, name, data, prompts);
        
        return Response.json({ success: true, template });
      } catch (error) {
        console.error("Error creating template:", error);
        return new Response(
          `Error creating template: ${error instanceof Error ? error.message : "Unknown error"}`,
          { status: 500 }
        );
      }
    }
  },
  "/api/templates/:id": {
    async GET(req: BunRequest) {
      const { id } = req.params as { id: string };
      console.log("Fetching template with ID:", id);
      const template = await templatesService.getTemplateById(Number(id));
      if (!template) {
        return new Response("Template not found", { status: 404 });
      }
      return Response.json(template);
    },
    async PUT(req: BunRequest) {
      try {
        const { id } = req.params as { id: string };
        const templateId = Number(id);

        const existingTemplate = await templatesService.getTemplateById(templateId);
        if (!existingTemplate) {
          return new Response("Template not found", { status: 404 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const name = formData.get("name") as string;
        const dataStr = formData.get("data") as string | null;
        const promptsStr = formData.get("prompts") as string | null;

        const data = dataStr ? JSON.parse(dataStr) : undefined;
        const prompts = promptsStr ? JSON.parse(promptsStr) : undefined;

        const template = await templatesService.updateTemplate(templateId, file, name, data, prompts);
        return Response.json({ success: true, template });
      } catch (error) {
        console.error("Error updating template:", error);
        return new Response(
          `Error updating template: ${error instanceof Error ? error.message : "Unknown error"}`,
          { status: 500 }
        );
      }
    },
    async DELETE(req: BunRequest) {
      try {
        const { id } = req.params as { id: string };
        const templateId = Number(id);

        console.log("Deleting template with ID:", id);
        await templatesService.deleteTemplate(templateId);
        return Response.json({ success: true });
      } catch (error) {
        console.error("Error deleting template:", error);
        return new Response(
          `Error deleting template: ${error instanceof Error ? error.message : "Unknown error"}`,
          { status: 500 }
        );
      }
    }
  },
  "/api/templates/:id/download": {
    async GET(req: BunRequest) {
      try {
        const { id } = req.params as { id: string };
        const templateId = Number(id);
        
        const arrayBuffer = await templatesService.downloadTemplate(templateId);
        
        return new Response(arrayBuffer, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `attachment; filename="template.docx"`,
          },
        });
      } catch (error) {
        console.error("Error downloading template:", error);
        return new Response(
          `Error downloading template: ${error instanceof Error ? error.message : "Unknown error"}`,
          { status: 500 }
        );
      }
    }
  }
};

export default templatesApi;
