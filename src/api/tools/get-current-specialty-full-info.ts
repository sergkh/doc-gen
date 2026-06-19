import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { courseResults, courses, specialties } from "@/stores/db";
import { getSessionContext, toolResult, ZodContext, type ToolContentResult } from "./session-context";

const ZodOutput = z.object({
  status: z.string(),
  message: z.string(),
  specialty: z
    .object({
      id: z.number(),
      code: z.string(),
      name: z.string(),
      old_code: z.string(),
      old_name: z.string(),
      area_code: z.string(),
      area: z.string(),
      qualification: z.string(),
      data: z.object({
        disciplines: z
          .array(
            z.object({
              ok_no: z.string(),
              name: z.string(),
              credits: z.number(),
              control_type: z.enum(["exam", "credit", "both"]),
            })
          )
          .default([]),
      }),
    })
    .nullable()
    .optional(),
  results: z.array(
    z.object({
      id: z.number(),
      no: z.number(),
      specialty_id: z.number().nullable(),
      type: z.enum(["ЗК", "СК", "РН", "ІК"]),
      name: z.string(),
    })
  ),
  courses: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      okNo: z.string().nullable(),
    })
  ),
  count: z.object({
    results: z.number(),
    courses: z.number(),
  }),
  context: ZodContext,
});

type Output = z.infer<typeof ZodOutput>;

export function registerGetCurrentSpecialtyFullInfo(server: McpServer) {
  server.registerTool(
    "get_current_specialty_full_info",
    {
      description:
        "Повертає повну інформацію про поточну спеціальність із контексту: дані спеціальності, повний список результатів (ЗК/СК/РН/ІК) і список дисциплін (назви + OK номери).",
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
      inputSchema: z.object({}),
      outputSchema: ZodOutput,
    },
    async (_ignore: object, ctx: ServerContext) => {
      console.log("MCP tool get_current_specialty_full_info called", { sessionId: ctx.sessionId });

      try {
        const current = getSessionContext(ctx.sessionId);

        if (!current.specialty) {
          return toolResult(
            "Спеціальність не встановлено в контексті. Викличте set_specialty_context.",
            current,
            "dependency_not_met"
          );
        }

        const specialty = await specialties.get(current.specialty.id);
        if (!specialty) {
          return toolResult("Спеціальність не знайдена.", current, "not_found");
        }

        const [results, specialtyCourses] = await Promise.all([
          courseResults.bySpecialty(specialty.id),
          courses.bySpecialty(specialty.id),
        ]);

        const courseItems = specialtyCourses.map((course) => ({
          id: course.id,
          name: course.name,
          okNo: course.data?.ok_no ?? null,
        }));

        const message = `Повернуто повну інформацію для спеціальності ${specialty.code} ${specialty.name}: результатів ${results.length}, дисциплін ${courseItems.length}.`;

        return {
          content: [{ type: "text", text: message }] as ToolContentResult,
          structuredContent: {
            status: "ok",
            message,
            specialty,
            results,
            courses: courseItems,
            count: {
              results: results.length,
              courses: courseItems.length,
            },
            context: current,
          } satisfies Output,
        };
      } catch (error) {
        console.error("MCP get_current_specialty_full_info error:", error);
        return toolResult(
          "Сталася помилка під час отримання повної інформації по спеціальності.",
          getSessionContext(ctx.sessionId),
          "error"
        );
      }
    }
  );
}
