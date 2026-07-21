import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { teachers } from "@/stores/db";
import type { Teacher, TeacherPosition, AcademicTitle } from "@/stores/models";
import { getSessionContext, toolResult, type ToolResult } from "./session-context";
import { teachersService } from "@/services/teachers-service";

const positionValues = ["аспірант", "асистент", "старший викладач", "доцент", "професор"] as const;
const titleValues = [
  "кандидат технічних наук",
  "кандидат економічних наук",
  "кандидат педагогічних наук",
  "PhD економічних наук",
  "доктор економічних наук",
  "доктор технічних наук",
] as const;

const ZodInput = z.object({
  name: z.string().min(1, "Вкажіть ПІБ викладача"),
  position: z.enum(positionValues, { message: `Посада має бути однією з: ${positionValues.join(", ")}` }),
  academic_title: z.enum(titleValues, { message: `Науковий ступінь має бути одним з: ${titleValues.join(", ")}` }),
  email: z.string().email("Некоректний email").optional(),
  alt_names: z.array(z.string()).optional(),
});

const ZodOutput = z.object({
  status: z.string(),
  message: z.string(),
  teacherId: z.number().optional(),
});

type Input = z.infer<typeof ZodInput>;

export function registerCreateTeacher(server: McpServer) {
  server.registerTool(
    "create_teacher",
    {
      description: "Створює нового викладача з вказаним ПІБ, посадою та науковим ступенем",
      inputSchema: ZodInput,
      outputSchema: ZodOutput,
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        readOnlyHint: false,
      },
    },
    async (args: Input, ctx: ServerContext): Promise<ToolResult> => {
      const context = getSessionContext(ctx.sessionId);
      console.log("MCP tool create_teacher called", { sessionId: ctx.sessionId, name: args.name });

      try {
        const teacher = await teachersService.createTeacher({
          name: args.name,
          position: args.position as TeacherPosition,
          academic_title: args.academic_title as AcademicTitle,
          email: args.email ?? null,
          alt_names: args.alt_names ?? [],
        });

        console.log("MCP tool create_teacher success", { sessionId: ctx.sessionId, teacherId: teacher.id });

        return {
          content: [{ type: "text", text: `Викладача створено: ${args.name} (ID: ${teacher.id})` }],
          structuredContent: {
            status: "ok",
            message: "Викладача створено",
            context,
          },
        };
      } catch (error) {
        console.error("MCP tool create_teacher error:", error);
        return toolResult("Сталася помилка під час створення викладача.", context, "error");
      }
    }
  );
}
