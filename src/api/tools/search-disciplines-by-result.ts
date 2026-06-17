import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { courseResults, courses } from "@/stores/db";
import { getSessionContext } from "./session-context";
import type { ResultType } from "@/stores/models";

function normalizeResultType(raw: string): ResultType | null {
  const normalized = raw.replace(/\s+/g, "").toUpperCase();
  if (normalized === "ЗК") return "ЗК";
  if (normalized === "СК") return "СК";
  if (normalized === "РН" || normalized === "ПР" || normalized === "ПРН") return "РН";
  return null;
}

function parseResultQuery(query: string): { type: ResultType; no: number } | null {
  const match = query.trim().match(/^(ЗК|СК|РН|ПР|ПРН)[\s-]*(\d+)$/i);
  if (!match) return null;
  const type = normalizeResultType(match[1] ?? "");
  const no = Number(match[2]);
  if (!type || !Number.isFinite(no) || no <= 0) return null;
  return { type, no };
}

export function registerSearchDisciplinesByResult(server: McpServer) {
  server.registerTool(
    "search_disciplines_by_result",
    {
      description:
        "Шукає дисципліни за результатом (ЗК, СК, ПР/РН). Аргументи: specialtyId (number), result (string на кшталт 'ЗК-3').",
      inputSchema: z.object({
        specialtyId: z.number().int().positive(),
        result: z.string(),
      }),
      outputSchema: z.object({
        status: z.string(),
        message: z.string().optional(),
        result: z
          .object({
            id: z.number(),
            type: z.string(),
            no: z.number(),
            name: z.string(),
          })
          .nullable()
          .optional(),
        items: z
          .array(
            z.object({
              courseId: z.number(),
              courseName: z.string(),
              okNo: z.string().nullable(),
              teacher: z.string().nullable(),
            })
          )
          .optional(),
      }),
    },
    async ({ specialtyId, result }: { specialtyId: number; result: string }, ctx) => {
      console.log("MCP tool search_disciplines_by_result called", {
        sessionId: ctx.sessionId,
        specialtyId,
        result,
      });
      try {
        const current = getSessionContext(ctx.sessionId);
        const effectiveSpecialtyId = specialtyId ?? current.specialtyId;

        if (!effectiveSpecialtyId) {
          const message = "Не вказано specialtyId і не встановлено в контексті.";
          return {
            content: [{ type: "text", text: message }],
            structuredContent: { status: "error", message, result: null, items: [] },
          };
        }

        const parsed = parseResultQuery(result);

        if (!parsed) {
          return {
            content: [
              { type: "text", text: "Некоректний код результату. Приклад: ЗК-3, СК2, ПР-7 або РН-1." },
            ],
            structuredContent: {
              status: "invalid",
              message: "Некоректний код результату. Приклад: ЗК-3, СК2, ПР-7 або РН-1.",
              items: [],
            },
          };
        }

        const results = await courseResults.bySpecialty(effectiveSpecialtyId);
        const matchedResult = results.find((r) => r.type === parsed.type && r.no === parsed.no) || null;

        if (!matchedResult) {
          const message = `Результат ${parsed.type}-${parsed.no} не знайдено для цієї спеціальності.`;
          return {
            content: [{ type: "text", text: message }],
            structuredContent: { status: "not_found", message, items: [] },
          };
        }

        const allCourses = (await courses.bySpecialty(effectiveSpecialtyId)).filter(
          (course) => Array.isArray(course.data?.results) && course.data.results.includes(matchedResult.id)
        );

        if (allCourses.length === 0) {
          const message = `Курсів для результату ${matchedResult.type}-${matchedResult.no} **${matchedResult.name}** не знайдено.`;
          return {
            content: [{ type: "text", text: message }],
            structuredContent: { status: "not_found", message, items: [] },
          };
        }

        const items = allCourses.map((course) => ({
          courseId: course.id,
          courseName: course.name,
          okNo: course.data?.ok_no ?? null,
          teacher: course.teacher ?? null,
        }));

        const message = `Знайдено ${items.length} курс(и) для ${matchedResult.type}-${matchedResult.no}: ${matchedResult.name}.`;
        const response = {
          content: [{ type: "text", text: message }],
          structuredContent: {
            status: "ok",
            message,
            result: {
              id: matchedResult.id,
              type: matchedResult.type,
              no: matchedResult.no,
              name: matchedResult.name,
            },
            items,
          },
        };
        console.log("MCP tool search_disciplines_by_result success", {
          sessionId: ctx.sessionId,
          specialtyId: effectiveSpecialtyId,
          items: items.length,
        });
        return response;
      } catch (error) {
        console.error("MCP search_disciplines_by_result error:", error);
        const message = "Сталася помилка під час пошуку дисциплін.";
        return {
          content: [{ type: "text", text: message }],
          structuredContent: { status: "error", message, items: [] },
        };
      }
    }
  );
}