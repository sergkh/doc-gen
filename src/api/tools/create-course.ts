import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { courses, specialties, teachers } from "@/stores/db";
import { getSessionContext, setSessionCourse, toolResult, type ToolResult } from "./session-context";
import type { Course, CourseData } from "@/stores/models";
import { coursesService } from "@/services/courses-service";

const ZodInput = z.object({
  name: z.string().min(1, "Вкажіть назву курсу"),
  code: z.string().min(1, "Вкажіть ОК/ВК номер"),
  optional: z.boolean().optional(),
  teacherName: z.string().min(1, "Вкажіть ПІБ викладача"),
  hours: z.object({
    lections: z.number().int().nonnegative(),
    srs: z.number().int().nonnegative(),
    practice: z.number().int().nonnegative().optional(),
    labs: z.number().int().nonnegative().optional(),
  }),
  controlType: z.enum(["exam", "credit", "both"]).default("credit"),
  studyYear: z.number().int().positive().default(1),
  confirm: z.boolean().default(false),
  description: z.string().min(1, "Вкажіть опис курсу")
});

const ZodOutput = z.object({
  status: z.string(),
  message: z.string(),
  courseId: z.number().optional(),
});

type Input = z.infer<typeof ZodInput>;

export function registerCreateCourse(server: McpServer) {
  server.registerTool(
    "create_course",
    {
      description: "Створює курс для поточної спеціальності. " +
      "Потрібні: назва, ОК/ВК номер, ПІБ викладача, години (лекції, СРС, практика/лабораторні), опис. Потребує підтвердження." + 
      "Замість точної кількості годин можна вказати кількість кредитів. Зазвичай 5 кредитів це 150 годин з яких 26 год лекцій, 24 год практичних чи лабораторних, 100 год – СРС. " +
      "якщо 3 кредити то це 16 год лекцій, 14 год практичних чи лабораторних та 90 год – СРС",
      inputSchema: ZodInput,
      outputSchema: ZodOutput,
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        readOnlyHint: false
      }
    },
    async (args: Input, ctx: ServerContext): Promise<ToolResult> => {
      const current = getSessionContext(ctx.sessionId);
      console.log("MCP tool create_course called", { sessionId: ctx.sessionId, specialtyId: current.specialty?.id, name: args.name, code: args.code, teacherName: args.teacherName });

      if (!current.specialty) {
        const message = "Спеціальність не встановлено. Викличте set_specialty_context.";
        return toolResult(message, current, "dependency_not_met");
      }

      const specialty = await specialties.get(current.specialty.id);
      if (!specialty) {
        return toolResult("Спеціальність не знайдена.", current, "not_found");
      }

      // Find teacher by name (supports partial/like via findByName)
      const teacher = await teachers.findByName(args.teacherName);
      if (!teacher) {
        return toolResult(`Викладача не знайдено за вказаним ПІБ: ${args.teacherName}`, current, "not_found");
      }

      if (!args.confirm) {
        return toolResult("Підтвердіть створення курсу: confirm=true", current, "missing_input");
      }

      const optional = args.optional ?? /(^вк|вибір|^vk)/i.test(args.code.trim());
      const hasLabs = (args.hours.labs ?? 0) > 0;
      const hasPractice = (args.hours.practice ?? 0) > 0;

      const totalHours = (args.hours.lections ?? 0) + (args.hours.srs ?? 0) + (hasLabs ? args.hours.labs ?? 0 : args.hours.practice ?? 0);
      const credits = Math.max(1, Math.round(totalHours / 30));

      const courseData = {
        ok_no: args.code.trim(),
        practice: hasPractice || !hasLabs,
        optional,
        type: hasLabs ? "practice" : "lesson",
        control_type: args.controlType,
        hours: totalHours,
        hours_detailed: {
          fulltime: {
            hours: totalHours,
            practical_hours: hasLabs ? 0 : args.hours.practice ?? 0,
            lab_hours: hasLabs ? args.hours.labs ?? 0 : 0,
            srs_hours: args.hours.srs ?? 0,
          },
        },
        credits,
        specialty_mode: "new_only",
        specialty: specialty.name,
        area: specialty.area,
        description: args.description,
        prerequisites: [],
        postrequisites: [],
        results: [],
        attestations: [],
        fulltime: { semesters: [args.studyYear], study_year: args.studyYear },
        inabscentia: { semesters: [args.studyYear], study_year: args.studyYear },
        literature: { main: [], additional: [], internet: [] },
        warnings: [],
      } as CourseData;

      const insertPayload = {
        name: args.name,
        teacher_id: teacher.id,
        specialty_id: specialty.id,
        data: courseData,
        generated: {},
        version: 1,
      } as Course;

      const created = await coursesService.createCourse(insertPayload, 'Generated using MCP');

      setSessionCourse(ctx.sessionId, created, []);

      console.log("MCP tool create_course success", { sessionId: ctx.sessionId, specialtyId: specialty.id, courseId: created?.id });

      return {
        content: [{ type: "text", text: `Курс створено: ${args.name}` }],
        structuredContent: {
          status: "ok",
          message: "Курс створено",
          context: current,
        },
      };
    }
  );
}