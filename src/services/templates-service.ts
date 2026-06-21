import { templates } from "@/stores/db";
import type { Template } from "@/stores/models";
import path from "path";
import { deleteOldFile, saveUploadedFile } from "@/api/utils/files";

async function getAllTemplates(): Promise<Template[]> {
  const list = await templates.all();
  return await Promise.all(
    list.map(async (t) => {
      const fullPath = path.join(process.cwd(), t.file);
      const fileExists = await Bun.file(fullPath).exists();
      return { ...t, file_exists: fileExists };
    })
  );
}

async function getTemplateById(id: number): Promise<Template | null> {
  return templates.get(Number(id));
}

async function createTemplate(
  file: File,
  name: string,
  data?: any,
  prompts?: any[]
): Promise<Template> {
  const filePath = await saveUploadedFile(file);
  const template = { id: 0, name, file: filePath, data, prompts: prompts || [] } as Template;
  const result = await templates.add(template);
  return result[0];
}

async function updateTemplate(
  id: number,
  file: File | null,
  name: string,
  data?: any,
  prompts?: any[]
): Promise<Template> {
  const existingTemplate = await templates.get(id);
  if (!existingTemplate) {
    throw new Error("Template not found");
  }

  let filePath = existingTemplate.file;
  
  if (file) {
    const oldFilePath = existingTemplate.file;
    filePath = await saveUploadedFile(file);
    
    if (oldFilePath !== filePath) {
      await deleteOldFile(oldFilePath);
    }
  }

  const updatedData = data ?? existingTemplate.data;
  const updatedPrompts = prompts ?? (existingTemplate.prompts || []);

  const template = {
    id,
    name: name || existingTemplate.name,
    file: filePath,
    data: updatedData,
    prompts: updatedPrompts
  } as Template;

  const result = await templates.update(template);
  return result[0];
}

async function deleteTemplate(id: number): Promise<void> {
  const template = await templates.get(id);
  if (template) {
    await deleteOldFile(template.file);
  }
  await templates.delete(id);
}

async function downloadTemplate(id: number): Promise<ArrayBuffer> {
  const template = await templates.get(id);
  if (!template) {
    throw new Error("Template not found");
  }

  const fullPath = path.join(process.cwd(), template.file);
  const file = await Bun.file(fullPath);
  
  if (!(await file.exists())) {
    throw new Error("Template file not found");
  }

  return file.arrayBuffer();
}

export const templatesService = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  downloadTemplate
};
