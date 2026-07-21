import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { coursesService } from "@/services/courses-service";
import { getSessionContext, toolResult, ZodContext } from "./session-context";

const ZodInput = z.object({
  main: z.array(z.string()).default([]),
  additional: z.array(z.string()).default([]),
  internet: z.array(z.string()).default([])
});

const ZodOutput = z.object({
  status: z.string(),
  message: z.string(),
  context: ZodContext,
  applied: z
    .object({
      literature: z.object({
        main: z.array(z.string()),
        additional: z.array(z.string()),
        internet: z.array(z.string()),
      }),
      counts: z.object({
        main: z.number().int().nonnegative(),
        additional: z.number().int().nonnegative(),
        internet: z.number().int().nonnegative(),
      }),
    })
    .optional(),
});

type Input = z.infer<typeof ZodInput>;

function normalizeList(list: string[]): string[] {
  const normalized = list.map((v) => v.trim()).filter(Boolean);
  return Array.from(new Set(normalized));
}

export function registerUpdateCourseLiterature(server: McpServer) {
  server.registerTool(
    "update_course_literature",
    {
      description:
        "Оновлює літературу активної дисципліни основну (main), додаткову (additional), та інтернет джерела (internet). Перед оновленням переконайся, що встановлено контекст спеціальності та дисципліни",
      inputSchema: ZodInput,
      outputSchema: ZodOutput,
      annotations: {
        idempotentHint: true,
        destructiveHint: false,
        readOnlyHint: false,
      },
    },
    async (args: Input, ctx: ServerContext) => {
      const current = getSessionContext(ctx.sessionId);
      console.log("MCP tool update_course_literature called", {
        sessionId: ctx.sessionId,
        specialtyId: current.specialty?.id,
        courseId: current.course?.id,
        mainCount: args.main.length,
        additionalCount: args.additional.length,
        internetCount: args.internet.length,
      });

      if (!current.specialty) {
        return toolResult("Спеціальність не встановлено. Викличте set_specialty_context.", current, "dependency_not_met");
      }

      if (!current.course) {
        return toolResult("Дисципліну не встановлено. Викличте set_course_context.", current, "dependency_not_met");
      }

      const course = await coursesService.getCourseById(current.course.id);
      if (!course) {
        return toolResult("Дисципліну не знайдено.", current, "not_found");
      }

      if (course.specialty_id !== current.specialty.id) {
        return toolResult(
          "Активна дисципліна не належить поточній спеціальності. Встановіть правильний контекст через set_specialty_context/set_course_context.",
          current,
          "dependency_not_met"
        );
      }

      const main = normalizeList(args.main);
      const additional = normalizeList(args.additional);
      const internet = normalizeList(args.internet);

      const updated = {
        ...course,
        data: {
          ...course.data,
          literature: {
            main,
            additional,
            internet,
          },
        },
      };

      await coursesService.updateCourse(course.id, updated, "Updated course literature via MCP");

      const message = `Оновлено літературу дисципліни ${course.name}: основна=${main.length}, додаткова=${additional.length}, інтернет-ресурси=${internet.length}.`;

      return {
        content: [{ type: "text", text: message }],
        structuredContent: {
          status: "ok",
          message,
          context: current,
          applied: {
            literature: { main, additional, internet },
            counts: {
              main: main.length,
              additional: additional.length,
              internet: internet.length,
            },
          },
        },
      };
    }
  );
}
