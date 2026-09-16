import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { templates } from "@/stores/db";
import { coursesService } from "@/services/courses-service";
import { getGeneratedTemplateFields } from "@/services/template-fields-service";
import { getSessionContext, toolResult, ZodContext, type ToolContentResult } from "./session-context";

const ZodDependency = z.object({
  field: z.string(),
  scope: z.enum(["course", "topic"]),
  relation: z.enum(["single", "same_topic", "all_topics"]),
});

const ZodGeneratedField = z.object({
  templateId: z.number().int().positive(),
  templateName: z.string(),
  templateDescription: z.string().nullable(),
  field: z.string(),
  description: z.string(),
  scope: z.enum(["course", "topic"]),
  topicIndex: z.number().int().positive().optional(),
  topicName: z.string().optional(),
  currentValue: z.unknown().nullable(),
  outputSchema: z.record(z.string(), z.unknown()),
  dependsOn: z.array(ZodDependency),
});

const ZodOutput = z.object({
  status: z.string(),
  message: z.string(),
  context: ZodContext,
  fields: z.array(ZodGeneratedField).optional(),
});

export function registerListTemplateFields(server: McpServer) {
  server.registerTool(
    "list_template_fields",
    {
      description:
        "Повертає всі AI-поля всіх доступних шаблонів для активної дисципліни та її тем. "
        + "Для кожного поля містить назву й опис поля, назву й опис шаблону, область (дисципліна або тема), "
        + "поточне значення, схему очікуваного значення та залежності. Не змінює дані.",
      inputSchema: z.object({}),
      outputSchema: ZodOutput,
      annotations: {
        idempotentHint: true,
        readOnlyHint: true,
      },
    },
    async (_args: object, ctx: ServerContext) => {
      const current = getSessionContext(ctx.sessionId);
      console.log("MCP tool list_template_fields called", {
        sessionId: ctx.sessionId,
        courseId: current.course?.id,
      });

      if (!current.course) {
        return toolResult("Дисципліну не встановлено. Викличте set_course_context.", current, "dependency_not_met");
      }

      try {
        const course = await coursesService.getCourseById(current.course.id);
        if (!course) return toolResult("Дисципліну не знайдено.", current, "not_found");

        const allTemplates = await templates.all();
        const fields = allTemplates.flatMap((template) => getGeneratedTemplateFields(template, course));
        const message = `Знайдено ${fields.length} AI-полів у ${allTemplates.length} шаблонах.`;

        return {
          content: [{ type: "text", text: message }] as ToolContentResult,
          structuredContent: { status: "ok", message, context: current, fields },
        };
      } catch (error) {
        console.error("MCP list_template_fields error:", error);
        return toolResult("Сталася помилка під час отримання полів шаблонів.", current, "error");
      }
    },
  );
}
