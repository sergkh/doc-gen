import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { specialties } from "@/stores/db";
import { getSessionContext, toolResult, ZodContext, type ToolContentResult } from "./session-context";

const ZodOutput = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      code: z.string(),
      name: z.string(),
      area: z.string(),
    })
  ),
  count: z.number(),
  status: z.string(),
  message: z.string().optional(),
  context: ZodContext.optional(),
});

type Output = z.infer<typeof ZodOutput>;

export function registerListSpecialties(server: McpServer) {
  server.registerTool(
    "list_specialties",
    {
      description: "Повертає всі спеціальності з їх кодами",
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      inputSchema: z.object({}),
      outputSchema: ZodOutput,
    },
    async (_ignore: object, ctx: ServerContext) => {
      console.log("MCP tool list_specialties called", { sessionId: ctx.sessionId });
      try {
        const items = (await specialties.all()).map((spec) => ({
          id: spec.id,
          code: spec.code,
          name: spec.name,
          area: spec.area,
        }));

        const message = `Знайдено ${items.length} спеціальностей.`;

        const response = {
          content: [{ type: "text", text: message }] as ToolContentResult,
          structuredContent: {
            status: "ok",
            message,
            count: items.length,
            items,
            context: getSessionContext(ctx.sessionId),
          } satisfies Output,
        };

        console.log("MCP tool list_specialties success", { sessionId: ctx.sessionId, count: items.length });
        return response;
      } catch (error) {
        console.error("MCP list_specialties error:", error);
        return toolResult("Сталася помилка під час отримання списку спеціальностей.", getSessionContext(ctx.sessionId), "error");
      }
    }
  );
}