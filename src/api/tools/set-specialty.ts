import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { setSessionSpecialty, getSessionContext, ZodContext, toolResult } from "./session-context";
import { specialties } from "@/stores/db";
import type { Specialty, SpecialtyDegree } from "@/stores/models";

const DEGREE_LABELS: Record<SpecialtyDegree, string> = {
  bachelor: "бакалавр",
  master: "магістр",
};

export function registerSetSpecialty(server: McpServer) {
  server.registerTool(
    "set_specialty_context",
    {
      description: "Встановлює контекст спеціальності для поточної сесії за кодом (наприклад F3) або назвою (наприклад Комп'ютерні науки) з урахуванням рівня освіти (degree: bachelor|master; за замовчуванням bachelor)",
      annotations: {
        idempotentHint: true,
        readOnlyHint: false,
      },
      inputSchema: z.object({
        code: z.string().optional(),
        name: z.string().optional(),
        degree: z.enum(["bachelor", "master"]).optional(),
      }),
      outputSchema: z.object({
        status: z.string(),
        message: z.string(),
        context: ZodContext
      }),
    },
    async (
      { code, name, degree }: { code?: string; name?: string; degree?: SpecialtyDegree },
      ctx
    ) => {
      const requestedDegree: SpecialtyDegree = degree ?? "bachelor";

        console.log("MCP tool set_specialty_context called", {
          sessionId: ctx.sessionId,
          specialtyId: null, // Placeholder for specialtyId, will be set later
          code,
          name,
          degree: requestedDegree,
        });

      const allSpecialties = await specialties.all();
      const normalizedCode = code?.trim().toLowerCase();
      const normalizedName = name?.trim().toLowerCase();

      let resolvedSpecialty: Specialty | null = null;

      if (normalizedCode) {
        resolvedSpecialty =
          allSpecialties.find(
            (s) => s.code?.trim().toLowerCase() === normalizedCode && s.degree === requestedDegree
          ) ?? null;
      }

      if (!resolvedSpecialty && normalizedName) {
        resolvedSpecialty =
          allSpecialties.find(
            (s) =>
              (s.name.trim().toLowerCase() === normalizedName ||
                s.old_name?.trim().toLowerCase() === normalizedName) &&
              s.degree === requestedDegree
          ) ?? null;
      }

      if (!resolvedSpecialty) {
        const message = `Спеціальність не знайдено: вкажіть назву або код та рівень освіти (${DEGREE_LABELS[requestedDegree]})`;
        return toolResult(message, getSessionContext(ctx.sessionId), "not_found");
      }

      const context = setSessionSpecialty(ctx.sessionId, resolvedSpecialty);

      console.log("MCP tool set_specialty_context success", {
        sessionId: ctx.sessionId,
        id: resolvedSpecialty.id,
        name: resolvedSpecialty.name,
        degree: resolvedSpecialty.degree,
      });

      return toolResult(
        `Спеціальність встановлено: ${resolvedSpecialty.code} ${resolvedSpecialty.name} (${DEGREE_LABELS[resolvedSpecialty.degree]}) [${resolvedSpecialty.id}]`,
        context
      );
    }
  );
}
