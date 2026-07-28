import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { coursesService } from "@/services/courses-service";
import { getSessionContext, toolResult, type ToolResult } from "./session-context";
import type { CourseTopicData, GeneratedTopicData } from "@/stores/models";

const TopicInput = z.object({
  id: z.number().int().positive().optional(),
  uid: z.string().uuid().optional(),
  name: z.string().min(1, "Вкажіть назву теми"),
  lection: z.string().default(""),
  index: z.number().int().positive().default(1),  
  data: z.object({
    attestation: z.number().int().nonnegative().default(0),
    practices: z.array(z.string()).default([]),
    fulltime: z.object({
      hours: z.number().int().nonnegative(),
      practical_hours: z.number().int().nonnegative().default(0),
      lab_hours: z.number().int().nonnegative().default(0),
      srs_hours: z.number().int().nonnegative().default(0),
    }),
    inabscentia: z
      .object({
        hours: z.number().int().nonnegative(),
        practical_hours: z.number().int().nonnegative().default(0),
        lab_hours: z.number().int().nonnegative().default(0),
        srs_hours: z.number().int().nonnegative().default(0),
      })
      .optional(),
  }) as z.ZodType<CourseTopicData>,
  generated: z.object({
    subtopics: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]),
    lection_plan: z.array(z.string()).default([]),
  }) as z.ZodType<GeneratedTopicData>,
});

const ZodInput = z.object({
  attestations: z.array(z.string()).min(2, "Вкажіть принаймні 2 атестації"),
  topics: z.array(TopicInput).min(1, "Додайте принаймні одну тему")
});

const ZodOutput = z.object({
  status: z.string(),
  message: z.string()
});

type Input = z.infer<typeof ZodInput>;

export function registerUpdateCourseTopics(server: McpServer) {
  server.registerTool(
    "update_course_topics",
    {
      description: "Оновлює теми для активної дисципліни в контексті. Потрібно підтвердження confirm=true. " +
        "Для наявних тем завжди повертай uid з get_current_course_full_info — він зберігає звʼязок теми зовнішніми системами. " +
        "Зазвичай кожна тема займає 2 або 4 години лекцій. Та має 0 або 2 чи 4 години практичних. " +
        "Тому 16 годин лекцій це 8 лекцій, тому 8 лекційних тем. " +
        "Дисципліна має або практичні або лабораторні заняття, але не одночасно. Тому одна з цих категорій буде завжди 0." +
        "Загальну кількість годин можна взяти з дисципліни (курсу) і сумарно всі години тем мають відповідати загальній кількості годин дисципліни." +
        "Зверни увагу що години для денного навчання (fulltime) та заочного (inabscentia) відрізняються, у заочного значно менше годин, тому розподіли " +
        "їх на перші теми з кожної атестації (скільки вистачить), а всі інші вистав в 0." +
        "Використовуючи назву теми та опис від користувача, додай підтеми (subtopics) та ключові слова (keywords) а також плану лекції (lection_plan)." +
        "Якщо тема має години практичних чи лабораторних, придумай і додай відповідні теми практичних в список (practices). Назви практичних мають відповідати назві теми," +
        "а кількість залежить від годин – 1 практична це 2 години.",
      inputSchema: ZodInput,
      outputSchema: ZodOutput,
      annotations: {
        idempotentHint: true,
        destructiveHint: true,
        readOnlyHint: false
      }
    },
    async (args: Input, ctx: ServerContext): Promise<ToolResult> => {
      const current = getSessionContext(ctx.sessionId);
      console.log("MCP tool update_course_topics called", { sessionId: ctx.sessionId, courseId: current.course?.id, topics: args.topics, attestations: args.attestations });

      if (!current.course) {
        return toolResult("Дисципліну не встановлено. Викличте set_discipline_context.", current, "dependency_not_met");
      }
    
      await coursesService.mergeCourseTopics(
        current.course.id,
        args.topics.map((topic) => ({
          uid: topic.uid,
          course_id: current.course!.id,
          index: topic.index,
          name: topic.name,
          lection: topic.lection,
          data: topic.data,
          generated: topic.generated
        })) as any
      );

      await

      console.log("MCP tool update_course_topics success", { sessionId: ctx.sessionId, courseId: current.course.id });

      return toolResult(`Оновлено ${args.topics.length} тем`, current);
    }
  );
}
