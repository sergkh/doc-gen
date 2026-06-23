import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { setSessionSpecialty, getSessionContext, ZodContext, toolResult } from "./session-context";
import { specialties } from "@/stores/db";
import type { Specialty } from "@/stores/models";

export function registerSetSpecialty(server: McpServer) {
  server.registerTool(
    "set_specialty_context",
    {
      description: "Встановлює контекст спеціальності для поточної сесії за кодом (наприклад F3) або назвою (наприклад Комп'ютерні науки)",
      annotations: {
        idempotentHint: true,
        readOnlyHint: false,
      },
      inputSchema: z.object({
        code: z.string().optional(),
        name: z.string().optional(),
      }),
      outputSchema: z.object({
        status: z.string(),
        message: z.string(),
        context: ZodContext
      }),
    },
    async (
      { code, name }: { code?: string; name?: string },
      ctx
    ) => {
        console.log("MCP tool set_specialty_context called", {
          sessionId: ctx.sessionId,
          specialtyId: null, // Placeholder for specialtyId, will be set later
          code,
          name,
        });
      const candidates: Array<() => Promise<Specialty | null>> = [
        async () => {
          if (!code) return null;
          return (await specialties.findByCode(code.toUpperCase().trim())) ?? null;
        },
        async () => {
          if (!name) return null;
          return (await specialties.findByName(name.trim().toLowerCase())) ?? null;
        },
      ];

      let resolvedSpecialty: Specialty | null = null;
      for (const resolver of candidates) {
        resolvedSpecialty = await resolver();
        if (resolvedSpecialty) break;
      }

      if (!resolvedSpecialty) {
        const message = "Спеціальність не знайдено: вкажіть назву спеціальності або її код";
        return toolResult(message, getSessionContext(ctx.sessionId), "not_found");
      }

      const context = setSessionSpecialty(ctx.sessionId, resolvedSpecialty);

      console.log("MCP tool set_specialty_context success", {
        sessionId: ctx.sessionId,
        id: resolvedSpecialty.id,
        name: resolvedSpecialty.name
      });

      return toolResult(`Спеціальність встановлено: ${resolvedSpecialty.code} ${resolvedSpecialty.name} (${resolvedSpecialty.id})`, context);
    }
  );
}