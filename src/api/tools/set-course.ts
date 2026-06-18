import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { courses } from "@/stores/db";
import { setSessionCourse, getSessionContext, ZodContext, toolResult } from "./session-context";

export function registerSetActiveCourse(server: McpServer) {
  server.registerTool(
    "set_course_context",
    {
      description: "Встановлює контекст курсу за його ок-номером або назвою (в межах поточної спеціальності)",
      annotations: {
        idempotentHint: true,
        readOnlyHint: false,
      },
      inputSchema: z.object({
        okNo: z.string().optional(),
        name: z.string().optional(),
      }),
      outputSchema: z.object({
        status: z.string(),
        message: z.string(),
        context: ZodContext,
      }),
    },
    async ({ okNo, name }: { okNo?: string; name?: string }, ctx) => {

      console.log("MCP tool set_course_context called", { sessionId: ctx.sessionId, okNo, name });

      const context = getSessionContext(ctx.sessionId);

      if (!context.specialty) {
        const message = "Спочатку встановіть спеціальність через set_specialty_context.";
        return toolResult(message, context, "dependency_not_met");
      }

      if (!okNo && !name) {
        const message = "Вкажіть номер ОК (okNo) або назву (name) дисципліни.";
        return toolResult(message, context, "missing_input");
      }

      const list = await courses.bySpecialty(context.specialty.id);
      const norm = (s?: string | null) => s?.trim().toLowerCase() || "";
      const targetOk = norm(okNo);
      const targetName = norm(name);

      const found = list.find((course) => {
        const courseOk = norm(course.data?.ok_no ?? null);
        const courseName = norm(course.name);
        return (targetOk && courseOk === targetOk) || (targetName && courseName === targetName);
      });

      if (!found) {
        const message = "Дисципліну не знайдено за вказаними okNo/name у цій спеціальності.";
        return toolResult(message, context, "not_found");
      }

      const updatedContext = setSessionCourse(ctx.sessionId, found);

      const message = `Курс встановлений: (${found.data?.ok_no ?? ""}) ${found.name} `;

      const response = { status: "ok", message, context: updatedContext };

      console.log("MCP tool set_course_context success", 
        { sessionId: ctx.sessionId, id: found.id, name: found.name }
      );

      return toolResult(message, updatedContext);
    }
  );
}