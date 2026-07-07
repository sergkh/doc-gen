import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { courseResults } from "@/stores/db";
import { coursesService } from "@/services/courses-service";
import { getSessionContext, toolResult, ZodContext } from "./session-context";

const ZodInput = z.object({
  zk: z.array(z.number().int().positive()).default([]),
  sk: z.array(z.number().int().positive()).default([]),
  rn: z.array(z.number().int().positive()).default([]),
  confirm: z.boolean().default(false),
});

const ZodOutput = z.object({
  status: z.string(),
  message: z.string(),
  context: ZodContext,
  applied: z
    .object({
      byType: z.object({
        zk: z.array(z.number()),
        sk: z.array(z.number()),
        rn: z.array(z.number()),
        ik: z.number().optional()
      }),
    })
    .optional(),
});

type Input = z.infer<typeof ZodInput>;

export function registerUpdateCourseResults(server: McpServer) {
  server.registerTool(
    "update_course_results",
    {
      description:
        "Оновлює результати активної дисципліни за номерами окремо для кожного типу: ЗК, СК, РН. " +
        "Результат ІК додається автоматично (він обов'язковий). Якщо не вказано явно, підбери результати сам, у відповідності до того чи вони відповідають темам дисципліни." +
        "ПРАВИЛО: перед update_course_results обов'язково отримай список результатів через get_current_specialty_full_info і використовуй номери результатів саме з поточної спеціальності.",
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
      console.log("MCP tool update_course_results called", {
        sessionId: ctx.sessionId,
        specialtyId: current.specialty?.id,
        courseId: current.course?.id,
        zk: args.zk,
        sk: args.sk,
        rn: args.rn,
      });

      if (!current.specialty) {
        return toolResult("Спеціальність не встановлено. Викличте set_specialty_context.", current, "dependency_not_met");
      }

      if (!current.course) {
        return toolResult("Дисципліну не встановлено. Викличте set_course_context.", current, "dependency_not_met");
      }

      if (!args.confirm) {
        return toolResult("Підтвердіть оновлення результатів: confirm=true", current, "missing_input");
      }

      const course = await coursesService.getCourseById(current.course.id);
      if (!course) {
        return toolResult("Дисципліну не знайдено.", current, "not_found");
      }

      const specialtyId = current.specialty.id;
      const specialtyResults = await courseResults.bySpecialty(specialtyId);

      const indexByTypeAndNo = new Map<string, number>();
      for (const result of specialtyResults) {
        indexByTypeAndNo.set(`${result.type}:${result.no}`, result.id);
      }

      const toUnique = (list: number[]) => Array.from(new Set(list));

      const missing: string[] = [];
      const resolve = (type: "ЗК" | "СК" | "РН", nos: number[]): number[] => {
        const uniqueNos = toUnique(nos);
        const ids: number[] = [];

        for (const no of uniqueNos) {
          const id = indexByTypeAndNo.get(`${type}:${no}`);
          if (!id) {
            missing.push(`${type}-${no}`);
            continue;
          }
          ids.push(id);
        }

        return ids;
      };

      const zkIds = resolve("ЗК", args.zk);
      const skIds = resolve("СК", args.sk);
      const rnIds = resolve("РН", args.rn);
      const ikId = indexByTypeAndNo.get("ІК:1");

      if (missing.length > 0) {
        return toolResult(
          `Не знайдено результати у поточній спеціальності: ${missing.join(", ")}. Спочатку отримайте результати спеціальності (get_current_specialty_full_info).`,
          current,
          "not_found"
        );
      }

      const ids = toUnique([...zkIds, ...skIds, ...rnIds].concat(ikId ? [ikId] : []));

      const updated = {
        ...course,
        data: {
          ...course.data,
          results: ids,
        },
      };

      await coursesService.updateCourse(course.id, updated, "Updated course results via MCP");

      const message = `Оновлено результати дисципліни ${course.name}: ЗК=${zkIds.length}, СК=${skIds.length}, РН=${rnIds.length}, ІК=1.`;

      return {
        content: [{ type: "text", text: message }],
        structuredContent: {
          status: "ok",
          message,
          context: current,
          applied: {
            byType: {
              zk: zkIds,
              sk: skIds,
              rn: rnIds,
              ik: ikId
            },
          },
        },
      };
    }
  );
}
