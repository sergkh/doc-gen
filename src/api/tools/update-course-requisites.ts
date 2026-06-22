import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { courses } from "@/stores/db";
import { coursesService } from "@/services/courses-service";
import { getSessionContext, toolResult, ZodContext } from "./session-context";

const ZodInput = z.object({
  prerequisiteCourseIds: z.array(z.number().int().positive()).default([]),
  postrequisiteCourseIds: z.array(z.number().int().positive()).default([]),
  confirm: z.boolean().default(false),
});

const ZodOutput = z.object({
  status: z.string(),
  message: z.string(),
  context: ZodContext,
  applied: z
    .object({
      prerequisites: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          okNo: z.string().nullable(),
        })
      ),
      postrequisites: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          okNo: z.string().nullable(),
        })
      ),
    })
    .optional(),
});

type Input = z.infer<typeof ZodInput>;

export function registerUpdateCourseRequisites(server: McpServer) {
  server.registerTool(
    "update_course_requisites",
    {
      description:
        "Оновлює пререквізити і постреквізити активної дисципліни. " +
        "Усі пререквізити/постреквізити мають бути дисциплінами тієї ж спеціальності. " +
        "Перед оновленням отримай список дисциплін поточної спеціальності через list_courses.",
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
      console.log("MCP tool update_course_requisites called", {
        sessionId: ctx.sessionId,
        specialtyId: current.specialty?.id,
        courseId: current.course?.id,
        prerequisiteCourseIds: args.prerequisiteCourseIds,
        postrequisiteCourseIds: args.postrequisiteCourseIds,
      });

      if (!current.specialty) {
        return toolResult("Спеціальність не встановлено. Викличте set_specialty_context.", current, "dependency_not_met");
      }

      if (!current.course) {
        return toolResult("Дисципліну не встановлено. Викличте set_course_context.", current, "dependency_not_met");
      }

      if (!args.confirm) {
        return toolResult("Підтвердіть оновлення пререквізитів/постреквізитів: confirm=true", current, "missing_input");
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

      const specialtyCourses = await courses.bySpecialty(current.specialty.id);
      const byId = new Map(specialtyCourses.map((c) => [c.id, c]));

      const uniquePrereqIds = Array.from(new Set(args.prerequisiteCourseIds));
      const uniquePostreqIds = Array.from(new Set(args.postrequisiteCourseIds));

      if (uniquePrereqIds.includes(course.id) || uniquePostreqIds.includes(course.id)) {
        return toolResult("Дисципліна не може бути пререквізитом або постреквізитом самої себе.", current, "missing_input");
      }

      const missingIds = [...uniquePrereqIds, ...uniquePostreqIds].filter((id) => !byId.has(id));
      if (missingIds.length > 0) {
        return toolResult(
          `Дисципліни не знайдено у поточній спеціальності: ${Array.from(new Set(missingIds)).join(", ")}. Спочатку отримайте список через list_courses.`,
          current,
          "not_found"
        );
      }

      const overlap = uniquePrereqIds.filter((id) => uniquePostreqIds.includes(id));
      if (overlap.length > 0) {
        return toolResult(
          `Одні й ті самі дисципліни не можуть бути одночасно пре- і постреквізитами: ${overlap.join(", ")}`,
          current,
          "missing_input"
        );
      }

      const prerequisites = uniquePrereqIds.map((id) => byId.get(id)!);
      const postrequisites = uniquePostreqIds.map((id) => byId.get(id)!);

      const updated = {
        ...course,
        data: {
          ...course.data,
          prerequisites: prerequisites.map((item) => item.name),
          postrequisites: postrequisites.map((item) => item.name),
        },
      };

      await coursesService.updateCourse(course.id, updated, "Updated course prerequisites/postrequisites via MCP");

      const message = `Оновлено реквізити дисципліни ${course.name}: пререквізитів ${prerequisites.length}, постреквізитів ${postrequisites.length}.`;

      return {
        content: [{ type: "text", text: message }],
        structuredContent: {
          status: "ok",
          message,
          context: current,
          applied: {
            prerequisites: prerequisites.map((item) => ({
              id: item.id,
              name: item.name,
              okNo: item.data?.ok_no ?? null,
            })),
            postrequisites: postrequisites.map((item) => ({
              id: item.id,
              name: item.name,
              okNo: item.data?.ok_no ?? null,
            })),
          },
        },
      };
    }
  );
}
