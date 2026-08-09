import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { courses, specialties, teachers } from "@/stores/db";
import { getSessionContext, setSessionCourse, toolResult, type ToolResult } from "./session-context";
import type { Course, CourseData } from "@/stores/models";
import { coursesService } from "@/services/courses-service";

const ZodInput = z.object({
  name: z.string().min(1, "Вкажіть назву курсу"),
  code: z.string().min(1, "Вкажіть код. Формат 1 або 1.1").regex(/^(?:\d+|\d+\.\d+)$/),
  optional: z.boolean().optional(),
  teacherName: z.string().min(1, "Вкажіть ПІБ викладача"),
  hours: z.object({
    lections: z.number().int().nonnegative(),
    srs: z.number().int().nonnegative(),
    practice: z.number().int().nonnegative().optional(),
    labs: z.number().int().nonnegative().optional(),
  }),
  inabscentia_hours: z.object({
    lections: z.number().int().nonnegative(),
    srs: z.number().int().nonnegative(),
    practice: z.number().int().nonnegative().optional(),
    labs: z.number().int().nonnegative().optional(),
  }),
  controlType: z.enum(["exam", "credit", "both"]).default("credit"),
  year: z.number().int().positive().default(1),
  semesters: z.array(z.number().int().positive()).min(1).default([1]),
  attestationsCount: z.number().int().positive().default(2),
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
      description: `Створює курс для поточної спеціальності. Перед викликом необхідно встановити поточну спеціальність через set_specialty_context.
      Потрібні: назва, ОК/ВК номер, ПІБ викладача, рік навчання (year), семестри (semesters), години (лекції, самостійна робота – СРС, практика/лабораторні), опис. Потребує підтвердження.
      Якщо курс займає лише 1 семестр, створи 2 атестації, якщо 2 семестри – 4 атестації. За замовчуванням створюються 2 атестації: 'Атестація 1' і 'Атестація 2'. За потреби можна передати attestationsCount.
      Замість точної кількості годин можна вказати кількість кредитів. Кожен кредит це 30 годин курсу. Одне заняття – 2 години. Тому 16 год лекцій це 8 лекцій, тому 8 лекційних тем.
      Кількість годин для денного навчання (fulltime) та заочного (inabscentia) відрізняється – для заочного навчання сумарно кількість годин така сама, але зазвичай йде 2 год лекцій, 2 год практичних і всі інші години – СРС.
      Зазвичай 5 кредитів це 150 годин з яких денне навчання має 26 год лекцій, 24 год практичних чи лабораторних, 100 год – СРС.
      4 кредити це 120 годин з яких 16 год лекцій, 14 год практичних чи лабораторних та 90 год – СРС,
      3 кредити: для денного навчання 16 год лекцій, 14 год практичних чи лабораторних та 60 год – СРС.
      Якщо кредити та години не сходяться, перепитай у користувача. Після створення курсу, запропонуй додати теми, потім результати та літературу`,
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
        console.log(`Specialty not set for session: ${ctx.sessionId}`);
        const message = "Спеціальність не встановлено. Викличте set_specialty_context.";
        return toolResult(message, current, "dependency_not_met");
      }

      const specialty = await specialties.get(current.specialty.id);
      if (!specialty) {
        console.log(`Specialty not found for id: ${current.specialty.id}. Session: ${ctx.sessionId}`);
        return toolResult("Спеціальність не знайдена.", current, "not_found");
      }

      // Find teacher by name (supports partial/like via findByName)
      const teacher = await teachers.findByName(args.teacherName);
      if (!teacher) {
        console.log(`Teacher not found for name: ${args.teacherName}. Session: ${ctx.sessionId}`);
        return toolResult(`Викладача не знайдено за вказаним ПІБ: ${args.teacherName}`, current, "not_found");
      }

      if (!args.confirm) {
        return toolResult("Підтвердіть створення курсу: confirm=true", current, "missing_input");
      }

      const optional = args.optional ?? /(^вк|вибір|^vk)/i.test(args.code.trim());
      const hasLabs = (args.hours.labs ?? 0) > 0;
      const hasPractice = (args.hours.practice ?? 0) > 0;
      const year = args.year;
      const semesters = Array.from(new Set(args.semesters)).sort((a, b) => a - b);
      const attestations = Array.from({ length: args.attestationsCount }, (_, idx) => ({
        name: `Атестація ${idx + 1}`,
        semester: semesters[idx % semesters.length],
      }));

      const totalHours = (args.hours.lections ?? 0) + (args.hours.srs ?? 0) + (hasLabs ? args.hours.labs ?? 0 : args.hours.practice ?? 0);
      const credits = Math.max(1, Math.round(totalHours / 30));

      const courseData = {
        ok_no: args.code,
        practice_type: (hasPractice || !hasLabs) ? "practice" : "lab",
        optional,
        type: "lesson",
        control_type: args.controlType,
        hours: totalHours,
        hours_detailed: {
          fulltime: {
            hours: (args.hours.lections ?? 0),
            practical_hours: hasLabs ? 0 : args.hours.practice ?? 0,
            lab_hours: hasLabs ? args.hours.labs ?? 0 : 0,
            srs_hours: args.hours.srs ?? 0,
          },
          inabscentia: {
            hours: (args.inabscentia_hours.lections ?? 0),
            practical_hours: hasLabs ? 0 : args.inabscentia_hours.practice ?? 0,
            lab_hours: hasLabs ? args.inabscentia_hours.labs ?? 0 : 0,
            srs_hours: args.inabscentia_hours.srs ?? 0,
          }
        },
        credits,
        specialty_mode: "new_only",
        specialty: specialty.name,
        area: specialty.area,
        description: args.description,
        prerequisites: [],
        postrequisites: [],
        results: [],
        attestations,
        fulltime: { semesters, study_year: year },
        inabscentia: { semesters, study_year: year },
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

      setSessionCourse(ctx.sessionId, created);

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