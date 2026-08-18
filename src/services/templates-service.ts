import { templates } from "@/stores/db";
import type { Template } from "@/stores/models";
import path from "path";
import { deleteOldFile, saveUploadedFile } from "@/api/utils/files";

function dependencyIds(data: unknown): number[] {
  if (!data || typeof data !== "object") return [];
  const dependencies = (data as Template["data"]).dependencies;
  if (!Array.isArray(dependencies)) return [];
  return [...new Set(dependencies.filter(Number.isInteger))];
}

async function validateDependencies(data: unknown, templateId?: number): Promise<void> {
  const ids = dependencyIds(data);
  if (templateId !== undefined && ids.includes(templateId)) {
    throw new Error("A template cannot depend on itself");
  }

  const allTemplates = await templates.all();
  const byId = new Map(allTemplates.map((template) => [template.id, template]));
  for (const id of ids) {
    if (!byId.has(id)) throw new Error(`Dependent template ${id} was not found`);
  }

  const visit = (id: number, path: Set<number>): void => {
    if (templateId !== undefined && id === templateId) {
      throw new Error("Template dependencies cannot contain a cycle");
    }
    if (path.has(id)) throw new Error("Template dependencies cannot contain a cycle");

    const dependency = byId.get(id);
    if (!dependency) return;
    const nextPath = new Set(path).add(id);
    for (const dependencyId of dependencyIds(dependency.data)) visit(dependencyId, nextPath);
  };

  for (const id of ids) visit(id, new Set());
}

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
  await validateDependencies(data);
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
  await validateDependencies(updatedData, id);

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
  const dependents = (await templates.all()).filter((candidate) => dependencyIds(candidate.data).includes(id));
  if (dependents.length > 0) {
    throw new Error(`Template is required by: ${dependents.map((template) => template.name).join(", ")}`);
  }

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
