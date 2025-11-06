import { createHash } from "crypto";
import { existsSync } from "fs";
import { rm } from "fs/promises";
import path from "path";

export async function computeFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return createHash("sha256").update(buffer).digest("hex");
}

export async function saveUploadedFile(file: File): Promise<string> {
  const hash = await computeFileHash(file);
  const uploadsDir = path.join(process.cwd(), "uploads");
  const fileExtension = path.extname(file.name);
  const uploadFileName = `${hash}${fileExtension}`;
  const uploadPath = path.join(uploadsDir, uploadFileName);
  await Bun.write(uploadPath, file);
  return `uploads/${uploadFileName}`;
}

export async function deleteOldFile(filePath: string): Promise<void> {
  if (!filePath) return;
  
  const fullPath = path.join(process.cwd(), filePath);
  if (existsSync(fullPath)) {
    try {
      await rm(fullPath, { force: true });
    } catch (error) {
      console.error("Error deleting old file:", error);
    }
  }
}