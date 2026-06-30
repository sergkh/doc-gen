import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { teachers } from "@/stores/db";
import { getSessionContext, toolResult, ZodContext, type ToolContentResult } from "./session-context";

const ZodTeacher = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  position: z.string().nullable(),
  academic_title: z.string().nullable(),
  alt_names: z.array(z.string()),
});

const ZodOutput = z.object({
  teachers: z.array(ZodTeacher),
  count: z.number(),
  status: z.string(),
  message: z.string().optional(),
  context: ZodContext.optional(),
});

type Output = z.infer<typeof ZodOutput>;

export function registerListTeachers(server: McpServer) {
  server.registerTool(
    "list_teachers",
    {
      description: "Повертає список усіх викладачів",
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      inputSchema: z.object({}),
      outputSchema: ZodOutput,
    },
    async (_ignore: object, ctx: ServerContext) => {
      console.log("MCP tool list_teachers called", { sessionId: ctx.sessionId });
      try {
        const allTeachers = await teachers.all();
        const context = getSessionContext(ctx.sessionId);

        const message = `Знайдено ${allTeachers.length} викладачів.`;

        const response = {
          content: [{ type: "text", text: message }] as ToolContentResult,
          structuredContent: {
            status: "ok",
            message,
            count: allTeachers.length,
            teachers: allTeachers,
            context,
          } satisfies Output,
        };

        console.log("MCP tool list_teachers success", { sessionId: ctx.sessionId, count: allTeachers.length });
        return response;
      } catch (error) {
        console.error("MCP list_teachers error:", error);
        return toolResult("Сталася помилка під час отримання списку викладачів.", getSessionContext(ctx.sessionId), "error");
      }
    }
  );
}
