import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { courses } from "@/stores/db";
import { setSessionDiscipline, getSessionContext } from "./session-context";

export function registerSetDiscipline(server: McpServer) {
  server.registerTool(
    "set_discipline_context",
    {
      description: "Встановлює контекст дисципліни за її ок-номером або назвою (в межах поточної спеціальності)",
      inputSchema: z.object({
        okNo: z.string().optional(),
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
    async ({ okNo, name }: { okNo?: string; name?: string }, ctx) => {
      console.log("MCP tool set_discipline_context called", {
        sessionId: ctx.sessionId,
        okNo,
        name,
      });

      const current = getSessionContext(ctx.sessionId);
      if (!current.specialtyId) {
        const message = "Спочатку встановіть спеціальність через set_specialty_context.";
        return {
          content: [{ type: "text", text: message }],
          structuredContent: { status: "error", message, context: current },
        };
      }

      if (!okNo && !name) {
        const message = "Вкажіть номер ОК (okNo) або назву (name) дисципліни.";
        return {
          content: [{ type: "text", text: message }],
          structuredContent: { status: "error", message, context: current },
        };
      }

      const list = await courses.bySpecialty(current.specialtyId);
      const norm = (s?: string | null) => s?.trim().toLowerCase() || "";
      const targetOk = norm(okNo);
      const targetName = norm(name);

      const found = list.find((course) => {
        const courseOk = norm(course.data?.ok_no ?? null);
        const courseName = norm(course.name);
        return (targetOk && courseOk === targetOk) || (targetName && courseName === targetName);
      });

      if (!found) {
        const message = "Дисципліну не знайдено за вказаними okNo/name у цій спеціальності.";
        return {
          content: [{ type: "text", text: message }],
          structuredContent: { status: "not_found", message, context: current },
        };
      }

      setSessionDiscipline(ctx.sessionId, {
        id: found.id,
        name: found.name,
        okNo: found.data?.ok_no ?? null,
        teacher: found.teacher ?? null,
      });

      const context = getSessionContext(ctx.sessionId);
      const message = `Дисципліна встановлена: ${found.name} (${found.data?.ok_no ?? ""})`;
      const response = {
        content: [{ type: "text", text: message }],
        structuredContent: {
          status: "ok",
          message,
          context,
        },
      };
      console.log("MCP tool set_discipline_context success", {
        sessionId: ctx.sessionId,
        id: found.id,
        name: found.name,
      });
      return response;
    }
  );
}