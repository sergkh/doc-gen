import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { setSessionSpecialty, getSessionContext } from "./session-context";
import { specialties } from "@/stores/db";

export function registerSetSpecialty(server: McpServer) {
  server.registerTool(
    "set_specialty_context",
    {
      description: "Встановлює контекст спеціальності для поточної сесії (за id, code або name)",
      inputSchema: z.object({
        code: z.string().optional(),
        name: z.string().optional(),
      }),
      outputSchema: z.object({
        status: z.string(),
        message: z.string(),
        context: z.object({
          specialtyId: z.number().int().positive().optional(),
          discipline: z
            .object({
              id: z.number(),
              name: z.string().nullable().optional(),
              okNo: z.string().nullable().optional(),
              teacher: z.string().nullable().optional(),
            })
            .optional(),
        }),
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
      const candidates: Array<() => Promise<number | null>> = [
        async () => {
          if (!code) return null;
          const found = await specialties.findByCode(code.trim());
          return found?.id ?? null;
        },
        async () => {
          if (!name) return null;
          const found = await specialties.findByName(name.trim());
          return found?.id ?? null;
        },
      ];

      let resolvedId: number | null = null;
      for (const resolver of candidates) {
        resolvedId = await resolver();
        if (resolvedId) break;
      }

      if (!resolvedId) {
        const message = "Спеціальність не знайдена: вкажіть назву спеціальності або її код";
        return {
          content: [{ type: "text", text: message }],
          structuredContent: {
            status: "not_found",
            message,
            context: getSessionContext(ctx.sessionId),
          },
        };
      }

      setSessionSpecialty(ctx.sessionId, resolvedId);
      const context = getSessionContext(ctx.sessionId);
      const message = `Спеціальність встановлена: ${resolvedId}`;
        console.log("MCP tool set_specialty_context success", {
          sessionId: ctx.sessionId,
          resolvedId,
        });
      return {
        content: [{ type: "text", text: message }],
        structuredContent: {
          status: "ok",
          message,
          context,
        },
      };
    }
  );
}