import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { courses } from "@/stores/db";
import { getSessionContext, toolResult, ZodContext, type ToolContentResult } from "./session-context";

const ZodOutput = z.object({
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
  context: ZodContext
});

type Output = z.infer<typeof ZodOutput>;

export function registerListCourses(server: McpServer) {
  server.registerTool(
    "list_courses",
    {
      description: "Повертає всі дисципліни спеціальності заданої через set_specialty_context",
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      outputSchema: ZodOutput,
    },
    async (ctx: ServerContext) => {
      console.log("MCP tool list_disciplines called", { sessionId: ctx.sessionId });
      try {
        const current = getSessionContext(ctx.sessionId);
        const specialty = current.specialty;

        if (!specialty) {
          const message = "Спеціальність не встановлено в контексті. Викличте set_specialty_context для встановлення спеціальності.";
          return toolResult(message, current, "dependency_not_met");
        }

        const list = await courses.bySpecialty(specialty.id);

        const items = list.map((course) => ({
          id: course.id,
          name: course.name,
          okNo: course.data?.ok_no ?? null,
          teacher: course.teacher ?? null,
        }));

        const message = `Знайдено ${items.length} дисциплін(и) для спеціальності ${specialty.name}. Виведи їх з ОК`;

        const response = {
          content: [{ type: "text", text: message }] as ToolContentResult,
          structuredContent: {
            status: "ok",
            message,
            count: items.length,
            items,
            context: getSessionContext(ctx.sessionId),
          } as Output
        }
        console.log("MCP tool list_disciplines success", { sessionId: ctx.sessionId, specialtyId: specialty.id, count: items.length });
        return response;
      } catch (error) {
        console.error("MCP list_disciplines error:", error);
        return toolResult("Сталася помилка під час отримання списку дисциплін.", getSessionContext(ctx.sessionId), "error");
      }
    }
  );
}