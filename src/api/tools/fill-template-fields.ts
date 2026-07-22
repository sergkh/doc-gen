import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { templates } from "@/stores/db";
import { coursesService } from "@/services/courses-service";
import { applyTemplateFields } from "@/services/template-fields-service";
import { getSessionContext, toolResult, ZodContext } from "./session-context";

const ZodFieldInput = z.object({
  field: z.string().min(1),
  topicIndex: z.number().int().positive().optional(),
  value: z.unknown(),
});

const ZodInput = z.object({
  templateId: z.number().int().positive(),
  fields: z.array(ZodFieldInput).default([]),
});

const ZodFieldResult = z.object({
  field: z.string(),
  scope: z.enum(["course", "topic"]),
  topicIndex: z.number().int().positive().optional(),
  status: z.enum(["accepted", "blocked", "invalid"]),
  missingDependencies: z.array(z.string()).optional(),
  message: z.string().optional(),
});

const ZodReadyField = z.object({
  field: z.string(),
  scope: z.enum(["course", "topic"]),
  topicIndex: z.number().int().positive().optional(),
  topicName: z.string().optional(),
  systemPrompt: z.string(),
  prompt: z.string(),
  outputSchema: z.record(z.string(), z.unknown()),
});

const ZodOutput = z.object({
  status: z.string(),
  message: z.string(),
  context: ZodContext,
  templateId: z.number().int().positive().optional(),
  manifestUri: z.string().optional(),
  results: z.array(ZodFieldResult).optional(),
  readyFields: z.array(ZodReadyField).optional(),
});

type Input = z.infer<typeof ZodInput>;

export function registerFillTemplateFields(server: McpServer) {
  server.registerTool(
    "fill_template_fields",
    {
      description:
        "Заповнює одне або кілька AI-полів шаблону для активної дисципліни. "
        + "Поля одного пакета обробляються з урахуванням залежностей. Якщо fields порожній, повертає поля, готові до заповнення. "
        + "Для topic-полів передайте topicIndex. Перед використанням прочитайте manifestUri шаблону.",
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
      console.log("MCP tool fill_template_fields called", {
        sessionId: ctx.sessionId,
        templateId: args.templateId,
        courseId: current.course?.id,
        fieldCount: args.fields.length,
      });

      if (!current.course) {
        return toolResult("Дисципліну не встановлено. Викличте set_course_context.", current, "dependency_not_met");
      }
      const template = await templates.get(args.templateId);
      if (!template) return toolResult("Шаблон не знайдено.", current, "not_found");
      const course = await coursesService.getCourseById(current.course.id);
      if (!course) return toolResult("Дисципліну не знайдено.", current, "not_found");

      const applied = applyTemplateFields(template, course, args.fields);
      if (applied.changed) {
        await coursesService.updateCourse(
          course.id,
          applied.course,
          `Filled template ${template.id} fields via MCP`,
        );
      }

      const accepted = applied.results.filter((result) => result.status === "accepted").length;
      const blocked = applied.results.filter((result) => result.status === "blocked").length;
      const invalid = applied.results.filter((result) => result.status === "invalid").length;
      const status = blocked || invalid ? (accepted ? "partial" : "rejected") : "ok";
      const message = args.fields.length === 0
        ? `Готові до заповнення поля: ${applied.readyFields.length}.`
        : `Прийнято: ${accepted}, заблоковано залежностями: ${blocked}, невалідних: ${invalid}.`;

      return {
        content: [{ type: "text", text: message }],
        structuredContent: {
          status,
          message,
          context: current,
          templateId: template.id,
          manifestUri: `docgen:///template/${template.id}/manifest`,
          results: applied.results,
          readyFields: applied.readyFields,
        },
      };
    },
  );
}
