import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { templates } from "@/stores/db";
import { coursesService } from "@/services/courses-service";
import { applyTemplateFields } from "@/services/template-fields-service";
import { getSessionContext, toolResult, ZodContext, type ToolContentResult } from "./session-context";

const ZodFieldInput = z.object({
  field: z.string().min(1),
  topicIndex: z.number().int().positive().optional(),
  value: z.unknown(),
});

const ZodInput = z.object({
  templateId: z.number().int().positive(),
  fields: z.array(ZodFieldInput).min(1),
});

const ZodFieldResult = z.object({
  field: z.string(),
  scope: z.enum(["course", "topic"]),
  topicIndex: z.number().int().positive().optional(),
  status: z.enum(["accepted", "blocked", "invalid"]),
  missingDependencies: z.array(z.string()).optional(),
  message: z.string().optional(),
});

const ZodOutput = z.object({
  status: z.string(),
  message: z.string(),
  context: ZodContext,
  templateId: z.number().int().positive().optional(),
  results: z.array(ZodFieldResult).optional(),
});

type Input = z.infer<typeof ZodInput>;

export function registerSetTemplateFields(server: McpServer) {
  server.registerTool(
    "set_template_fields",
    {
      description:
        "Встановлює одне або кілька AI-полів указаного шаблону для активної дисципліни. "
        + "Для поля області topic передайте topicIndex із list_template_fields. "
        + "Перевіряє тип значення і залежності; залежні поля в одному запиті можна передавати в будь-якому порядку.",
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
      console.log("MCP tool set_template_fields called", {
        sessionId: ctx.sessionId,
        templateId: args.templateId,
        courseId: current.course?.id,
        fieldCount: args.fields.length,
      });

      if (!current.course) {
        return toolResult("Дисципліну не встановлено. Викличте set_course_context.", current, "dependency_not_met");
      }

      try {
        const template = await templates.get(args.templateId);
        if (!template) return toolResult("Шаблон не знайдено.", current, "not_found");
        const course = await coursesService.getCourseById(current.course.id);
        if (!course) return toolResult("Дисципліну не знайдено.", current, "not_found");

        const applied = applyTemplateFields(template, course, args.fields);
        if (applied.changed) {
          await coursesService.updateCourse(
            course.id,
            applied.course,
            `Set template ${template.id} fields via MCP`,
          );
        }

        const accepted = applied.results.filter((result) => result.status === "accepted").length;
        const blocked = applied.results.filter((result) => result.status === "blocked").length;
        const invalid = applied.results.filter((result) => result.status === "invalid").length;
        const status = blocked || invalid ? (accepted ? "partial" : "rejected") : "ok";
        const message = `Прийнято: ${accepted}, заблоковано залежностями: ${blocked}, невалідних: ${invalid}.`;

        return {
          content: [{ type: "text", text: message }] as ToolContentResult,
          structuredContent: {
            status,
            message,
            context: current,
            templateId: template.id,
            results: applied.results,
          },
        };
      } catch (error) {
        console.error("MCP set_template_fields error:", error);
        return toolResult("Сталася помилка під час збереження полів шаблону.", current, "error");
      }
    },
  );
}
