import { templates } from "@/stores/db";
import type { Template } from "@/stores/models";
import type { BunRequest, Serve } from "bun";
import path from "path";
import { deleteOldFile, saveUploadedFile } from "./utils/files";


const templatesApi = {
  "/api/templates": {
    async GET() {
      console.log("Fetching all templates");
      return Response.json(await templates.all());
    },
    async POST(req: BunRequest) {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const name = formData.get("name") as string;

        if (!file) {
          return new Response("No file provided", { status: 400 });
        }

        if (!name) {
          return new Response("No name provided", { status: 400 });
        }

        // Save the file and get the path
        const filePath = await saveUploadedFile(file);

        // Create template
        const template = { id: 0, name, file: filePath } as Template;
        const result = await templates.add(template);
        
        return Response.json({ success: true, template: result[0] });
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
      const template = await templates.get(Number(id));
      if (!template) {
        return new Response("Template not found", { status: 404 });
      }
      return Response.json(template);
    },
    async PUT(req: BunRequest) {
      try {
        const { id } = req.params as { id: string };
        const templateId = Number(id);

        // Get existing template to check if file needs to be deleted
        const existingTemplate = await templates.get(templateId);
        if (!existingTemplate) {
          return new Response("Template not found", { status: 404 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const name = formData.get("name") as string;

        let filePath = existingTemplate.file;
        
        if (file) {
          const oldFilePath = existingTemplate.file;
          filePath = await saveUploadedFile(file);
          
          // Delete old file if it's different from the new one
          if (oldFilePath !== filePath) {
            await deleteOldFile(oldFilePath);
          }
        }

        const template = {
          id: templateId,
          name: name || existingTemplate.name,
          file: filePath
        } as Template;

        const result = await templates.update(template);
        return Response.json({ success: true, template: result[0] });
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

        // Get template to delete associated file
        const template = await templates.get(templateId);
        if (template) {
          await deleteOldFile(template.file);
        }

        console.log("Deleting template with ID:", id);
        await templates.delete(templateId);
        return Response.json({ success: true });
      } catch (error) {
        console.error("Error deleting template:", error);
        return new Response(
          `Error deleting template: ${error instanceof Error ? error.message : "Unknown error"}`,
          { status: 500 }
        );
      }
    }
  }
};

export default templatesApi;

