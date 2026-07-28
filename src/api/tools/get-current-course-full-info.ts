import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { coursesService } from "@/services/courses-service";
import { getSessionContext, toolResult, ZodContext, type ToolContentResult } from "./session-context";

const ZodOutput = z.object({
  status: z.string(),
  message: z.string(),
  course: z
    .object({
      id: z.number(),
      name: z.string(),
      teacher_id: z.number(),
      specialty_id: z.number(),
      teacher: z.string().optional(),
      data: z.any(),
      generated: z.any().nullable(),
      version: z.number(),
    })
    .nullable()
    .optional(),
  topics: z.array(
    z.object({
      uid: z.string(),
      course_id: z.number(),
      index: z.number(),
      name: z.string(),
      lection: z.string(),
      data: z.any(),
      generated: z.any(),
    })
  ),
  count: z.object({
    topics: z.number(),
  }),
  context: ZodContext,
});

type Output = z.infer<typeof ZodOutput>;

export function registerGetCurrentCourseFullInfo(server: McpServer) {
  server.registerTool(
    "get_current_course_full_info",
    {
      description:
        "Повертає повну інформацію про поточну дисципліну з контексту сесії, включно зі списком тем дисципліни.",
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      inputSchema: z.object({}),
      outputSchema: ZodOutput,
    },
    async (_ignore: object, ctx: ServerContext) => {
      console.log("MCP tool get_current_course_full_info called", { sessionId: ctx.sessionId });

      try {
        const current = getSessionContext(ctx.sessionId);

        if (!current.course) {
          return toolResult(
            "Курс не встановлено в контексті. Викличте set_course_context.",
            current,
            "dependency_not_met"
          );
        }

        const course = await courses.get(current.course.id);

        if (!course) {
          return toolResult("Дисципліну не знайдено в базі даних.", current, "not_found");
        }

        const topics = course.topics ?? [];

        const message = `Повернуто повну інформацію про курс: ${course.name}. Кількість тем: ${topics.length}.`;

        return {
          content: [{ type: "text", text: message }] as ToolContentResult,
          structuredContent: {
            status: "ok",
            message,
            course,
            topics,
            count: {
              topics: topics.length,
            },
            context: current,
          } satisfies Output,
        };
      } catch (error) {
        console.error("MCP get_current_course_full_info error:", error);
        return toolResult(
          "Сталася помилка під час отримання повної інформації по курсу.",
          getSessionContext(ctx.sessionId),
          "error"
        );
      }
    }
  );
}
