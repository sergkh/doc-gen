import { z } from "zod";

export const ZodSpecialty = z.object({
  id: z.number().int().positive(),
  name: z.string()
});

export const ZodCourse = z.object({
  id: z.number().int().positive(),
  name: z.string()
});

export const ZodContext = z.object({
  specialty: ZodSpecialty.nullable().optional(),
  course: ZodCourse.nullable().optional()
});

export type SessionContext = {
  specialty?: { id: number; name: string };
  course?: { id: number; name: string };
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

export function setSessionSpecialty(sessionId: string | undefined, specialty: { id: number; name: string }): SessionContext {
  const ctx = getOrInit(sessionId);
  ctx.specialty = { id: specialty.id, name: specialty.name };
  delete ctx.course;
  return ctx;
}

export function setSessionCourse(sessionId: string | undefined, course: { id: number; name: string } | null): SessionContext {
  const ctx = getOrInit(sessionId);
  ctx.course = course ?? undefined;
  return ctx;
}

export function toolResult(message: string, context: SessionContext, status: "ok" | "missing_input" | "not_found" | "dependency_not_met" | "error" = "ok") : ToolResult {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: { status, message, context }
  };
}