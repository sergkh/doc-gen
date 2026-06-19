import { z } from "zod";
import type { Course, CourseTopic, Specialty } from "@/stores/models";

export const ZodSpecialty = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  name: z.string(),
  area: z.string()
});

export const ZodCourse = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  teacher_id: z.number().int().positive(),
  data: z.object({
    ok_no: z.string().nullable().optional()
  })
});

export const ZodContext = z.object({
  specialty: ZodSpecialty.nullable().optional(),
  course: ZodCourse.nullable().optional()
});

export type SessionContext = {
  specialty?: Specialty;
  course?: Course;
  topics?: CourseTopic[];
};

export type ToolContentResult = { type: "text"; text: string }[];

export type ToolResult = {
  content: ToolContentResult;
  structuredContent: {
    status: string;
    message: string;
    context: SessionContext;
  }
}

const sessionContexts = new Map<string, SessionContext>();

function getOrInit(sessionId: string | undefined): SessionContext {
  const key = sessionId ?? "anonymous";
  const existing = sessionContexts.get(key);
  if (existing) return existing;
  const ctx: SessionContext = {};
  sessionContexts.set(key, ctx);
  return ctx;
}

export function getSessionContext(sessionId: string | undefined): SessionContext {
  return getOrInit(sessionId);
}

export function setSessionSpecialty(sessionId: string | undefined, specialty: Specialty): SessionContext {
  const ctx = getOrInit(sessionId);
  ctx.specialty = specialty;
  delete ctx.course;
  delete ctx.topics;
  return ctx;
}

export function setSessionCourse(sessionId: string | undefined, course: Course | null, topics: CourseTopic[]): SessionContext {
  const ctx = getOrInit(sessionId);
  ctx.course = course ?? undefined;
  ctx.topics = topics;
  return ctx;
}

export function toolResult(message: string, context: SessionContext, status: "ok" | "missing_input" | "not_found" | "dependency_not_met" | "error" = "ok") : ToolResult {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: { status, message, context }
  };
}