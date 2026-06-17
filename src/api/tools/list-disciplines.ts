import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { courses } from "@/stores/db";
import { getSessionContext } from "./session-context";

export function registerListDisciplines(server: McpServer) {
  server.registerTool(
    "list_disciplines",
    {
      description: "Повертає всі дисципліни для заданої спеціальності",
      inputSchema: z.object({
        specialtyId: z.number().int().positive(),
      }),
      outputSchema: z.object({
        items: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            okNo: z.string().nullable(),
            teacher: z.string().nullable(),
          })
        ),
        count: z.number(),
        status: z.string(),
        message: z.string().optional(),
      }),
    },
    async ({ specialtyId }: { specialtyId: number }, ctx) => {
      console.log("MCP tool list_disciplines called", {
        sessionId: ctx.sessionId,
        specialtyId,
      });
      try {
        const current = getSessionContext(ctx.sessionId);
        const effectiveSpecialtyId = specialtyId ?? current.specialtyId;

        if (!effectiveSpecialtyId) {
          const message = "Не вказано specialtyId і не встановлено в контексті.";
          return {
            content: [{ type: "text", text: message }],
            structuredContent: { status: "error", message, count: 0, items: [] },
          };
        }

        const list = await courses.bySpecialty(effectiveSpecialtyId);

        const items = list.map((course) => ({
          id: course.id,
          name: course.name,
          okNo: course.data?.ok_no ?? null,
          teacher: course.teacher ?? null,
        }));

        const message = `Знайдено ${items.length} дисциплін(и) для спеціальності ${effectiveSpecialtyId}.`;

        const response = {
          content: [{ type: "text", text: message }],
          structuredContent: {
            status: "ok",
            message,
            count: items.length,
            items,
          },
        };
        console.log("MCP tool list_disciplines success", {
          sessionId: ctx.sessionId,
          specialtyId: effectiveSpecialtyId,
          count: items.length,
        });
        return response;
      } catch (error) {
        console.error("MCP list_disciplines error:", error);
        const message = "Сталася помилка під час отримання списку дисциплін.";
        return {
          content: [{ type: "text", text: message }],
          structuredContent: { status: "error", message, count: 0, items: [] },
        };
      }
    }
  );
}