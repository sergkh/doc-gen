import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { templates } from "@/stores/db";
import { getSessionContext, toolResult, ZodContext, type ToolContentResult } from "./session-context";

const ZodParameter = z.object({
  name: z.string(),
  type: z.enum(["text", "number", "boolean", "list", "object"]),
  subtype: z.enum(["text", "number", "boolean", "object"]).optional(),
});

const ZodTemplate = z.object({
  id: z.number(),
  name: z.string(),
  parameters: z.array(ZodParameter),
  url: z.string(),
});

const ZodOutput = z.object({
  templates: z.array(ZodTemplate),
  count: z.number(),
  status: z.string(),
  message: z.string().optional(),
  context: ZodContext.optional(),
});

type Output = z.infer<typeof ZodOutput>;

export function registerListTemplates(server: McpServer) {
  server.registerTool(
    "list_templates",
    {
      description: "Повертає список доступних шаблонів для генерації документів з параметрами та відносний URL для скачування. " +
      "Використовуй якщо необхідно згенерувати документ. Для формування повного URL шаблону візьми базовий URL MCP сервера без шляху й додай вміст поля url",
      annotations: {
        idempotentHint: true,
        readOnlyHint: false
      },
      inputSchema: z.object({}),
      outputSchema: ZodOutput,
    },
    async (_ignore: object, ctx: ServerContext) => {
      console.log("MCP tool list_templates called", { sessionId: ctx.sessionId });
      try {
        const allTemplates = await templates.all();
        const context = getSessionContext(ctx.sessionId);
        if (!context?.course) {
          return toolResult(
            "Не вибрано дисципліну. Спочатку скористайтесь get_course_info або select_course.",
            context,
            "dependency_not_met"
          );
        }
        const courseId = context.course.id;
        const items = allTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          parameters: (t.data?.parameters ?? []).map((p) => ({
            name: p.name,
            type: p.type,
            subtype: p.subtype,
          })),
          url: `/api/courses/${courseId}/generate/${t.id}/download`,
        }));

        const message = `Знайдено ${items.length} шаблонів.`;

        const response = {
          content: [{ type: "text", text: message }] as ToolContentResult,
          structuredContent: {
            status: "ok",
            message,
            count: items.length,
            templates: items,
            context,
          } satisfies Output,
        };

        console.log("MCP tool list_templates success", { sessionId: ctx.sessionId, count: items.length });
        return response;
      } catch (error) {
        console.error("MCP list_templates error:", error);
        return toolResult("Сталася помилка під час отримання списку шаблонів.", getSessionContext(ctx.sessionId), "error");
      }
    }
  );
}
