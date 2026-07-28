import { McpServer, ResourceTemplate, type ServerContext } from "@modelcontextprotocol/server";
import { z } from "zod";
import { coursesService } from "@/services/courses-service";
import { getSessionContext, ZodContext } from "@/api/tools/session-context";
import { presentationService } from "./service";
import {
  PresentationConflictError,
  type SlideOperation,
} from "./models";

function variable(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function presentationUri(courseId: number, topicUid: string): string {
  return `docgen:///course/${courseId}/topic/${topicUid}/presentation`;
}

function result(
  message: string,
  ctx: ServerContext,
  status: string,
  extra: Record<string, unknown> = {},
) {
  return {
    content: [{ type: "text" as const, text: message }],
    structuredContent: {
      status,
      message,
      context: getSessionContext(ctx.sessionId),
      ...extra,
    },
  };
}

async function handleTool<T>(
  ctx: ServerContext,
  action: () => Promise<T>,
  success: (value: T) => { message: string; extra?: Record<string, unknown> },
) {
  try {
    const value = await action();
    const output = success(value);
    return result(output.message, ctx, "ok", output.extra);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Невідома помилка.";
    const extra = error instanceof PresentationConflictError
      ? { currentRevision: error.currentRevision }
      : {};
    return result(message, ctx, error instanceof PresentationConflictError ? "conflict" : "error", extra);
  }
}

export function registerPresentationResources(server: McpServer) {
  server.registerResource(
    "course-presentations",
    new ResourceTemplate("docgen:///course/{courseId}/presentations", {
      list: async () => {
        const courses = await coursesService.getCourses();
        return {
          resources: courses.map((course) => ({
            uri: `docgen:///course/${course.id}/presentations`,
            name: course.name,
            description: "Презентації за темами дисципліни",
          })),
        };
      },
    }),
    {
      title: "Презентації дисципліни",
      description: "Теми дисципліни та стан презентації для кожної теми",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const courseId = Number(variable((variables as Record<string, unknown>).courseId) ?? uri.pathname.split("/")[2]);
      console.log("MCP resource course-presentations read", { uri: uri.href, courseId });
      try {
        const payload = await presentationService.listCoursePresentations(courseId);
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(payload),
          }],
        };
      } catch (error) {
        return { contents: [{ uri: uri.href, text: error instanceof Error ? error.message : "Помилка читання." }] };
      }
    },
  );

  server.registerResource(
    "topic-presentation",
    new ResourceTemplate("docgen:///course/{courseId}/topic/{topicUid}/presentation", {
      list: async () => ({ resources: [] }),
    }),
    {
      title: "Презентація теми",
      description: "Маніфест, Git-ревізія, слайди та діаграми презентації",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const parts = uri.pathname.split("/");
      const courseId = Number(variable((variables as Record<string, unknown>).courseId) ?? parts[2]);
      const topicUid = variable((variables as Record<string, unknown>).topicUid) ?? parts[4] ?? "";
      console.log("MCP resource topic-presentation read", { uri: uri.href, courseId, topicUid });
      try {
        const payload = await presentationService.getPresentation(courseId, topicUid);
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(payload),
          }],
        };
      } catch (error) {
        return { contents: [{ uri: uri.href, text: error instanceof Error ? error.message : "Помилка читання." }] };
      }
    },
  );

  server.registerResource(
    "topic-presentation-deck",
    new ResourceTemplate("docgen:///course/{courseId}/topic/{topicUid}/presentation/deck", {
      list: async () => ({ resources: [] }),
    }),
    {
      title: "Marp Markdown презентації",
      description: "Повний вихідний Markdown-файл презентації",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const parts = uri.pathname.split("/");
      const courseId = Number(variable((variables as Record<string, unknown>).courseId) ?? parts[2]);
      const topicUid = variable((variables as Record<string, unknown>).topicUid) ?? parts[4] ?? "";
      console.log("MCP resource topic-presentation-deck read", { uri: uri.href, courseId, topicUid });
      try {
        const payload = await presentationService.getPresentation(courseId, topicUid);
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/markdown",
            text: payload.markdown,
          }],
        };
      } catch (error) {
        return { contents: [{ uri: uri.href, text: error instanceof Error ? error.message : "Помилка читання." }] };
      }
    },
  );

  server.registerResource(
    "topic-presentation-history",
    new ResourceTemplate("docgen:///course/{courseId}/topic/{topicUid}/presentation/history", {
      list: async () => ({ resources: [] }),
    }),
    {
      title: "Історія презентації",
      description: "Git-історія презентації теми",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const parts = uri.pathname.split("/");
      const courseId = Number(variable((variables as Record<string, unknown>).courseId) ?? parts[2]);
      const topicUid = variable((variables as Record<string, unknown>).topicUid) ?? parts[4] ?? "";
      console.log("MCP resource topic-presentation-history read", { uri: uri.href, courseId, topicUid });
      try {
        const payload = await presentationService.getPresentationHistory(courseId, topicUid);
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(payload),
          }],
        };
      } catch (error) {
        return { contents: [{ uri: uri.href, text: error instanceof Error ? error.message : "Помилка читання." }] };
      }
    },
  );
}

const ZodToolOutput = z.object({
  status: z.string(),
  message: z.string(),
  context: ZodContext,
  presentation: z.any().optional(),
  presentationUri: z.string().optional(),
  diagram: z.any().optional(),
  currentRevision: z.string().optional(),
});

const ZodSlideOperation = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("replace"), slideIndex: z.number().int().positive(), markdown: z.string().min(1) }),
  z.object({ operation: z.literal("insert"), slideIndex: z.number().int().positive(), markdown: z.string().min(1) }),
  z.object({ operation: z.literal("delete"), slideIndex: z.number().int().positive() }),
]);

export function registerPresentationTools(server: McpServer) {
  server.registerTool(
    "create_topic_presentation",
    {
      description:
        "Створює єдину Marp-презентацію для теми активної дисципліни. "
        + "topicUid отримайте з get_current_course_full_info або ресурсу презентацій дисципліни.",
      inputSchema: z.object({
        topicUid: z.string().uuid(),
        title: z.string().optional(),
        theme: z.string().default("default"),
        slides: z.array(z.string().min(1)).optional(),
      }),
      outputSchema: ZodToolOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) => {
      const current = getSessionContext(ctx.sessionId);
      if (!current.course) return result("Спочатку встановіть контекст дисципліни.", ctx, "dependency_not_met");
      return handleTool(
        ctx,
        () => presentationService.createPresentation(current.course!.id, args.topicUid, args),
        (presentation) => ({
          message: `Створено презентацію з ${presentation.slides.length} слайдами.`,
          extra: {
            presentation,
            presentationUri: presentationUri(current.course!.id, args.topicUid),
          },
        }),
      );
    },
  );

  server.registerTool(
    "update_presentation_slides",
    {
      description:
        "Змінює, вставляє або видаляє один чи кілька слайдів за індексом. "
        + "Індекси належать версії baseRevision; при конфлікті перечитайте ресурс презентації.",
      inputSchema: z.object({
        topicUid: z.string().uuid(),
        baseRevision: z.string().min(7),
        operations: z.array(ZodSlideOperation).min(1),
        confirmDelete: z.boolean().default(false),
      }),
      outputSchema: ZodToolOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args, ctx) => {
      const current = getSessionContext(ctx.sessionId);
      if (!current.course) return result("Спочатку встановіть контекст дисципліни.", ctx, "dependency_not_met");
      if (args.operations.some((operation) => operation.operation === "delete") && !args.confirmDelete) {
        return result("Для видалення слайда передайте confirmDelete=true.", ctx, "missing_input");
      }
      return handleTool(
        ctx,
        () => presentationService.updatePresentationSlides(
          current.course!.id,
          args.topicUid,
          args.baseRevision,
          args.operations as SlideOperation[],
        ),
        (presentation) => ({
          message: `Оновлено презентацію. Слайдів: ${presentation.slides.length}.`,
          extra: { presentation, presentationUri: presentationUri(current.course!.id, args.topicUid) },
        }),
      );
    },
  );

  server.registerTool(
    "replace_presentation_slides",
    {
      description:
        "Атомарно замінює всі слайди презентації. Використовуйте для первинної генерації або повного переупорядкування.",
      inputSchema: z.object({
        topicUid: z.string().uuid(),
        baseRevision: z.string().min(7),
        slides: z.array(z.string().min(1)).min(1),
      }),
      outputSchema: ZodToolOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args, ctx) => {
      const current = getSessionContext(ctx.sessionId);
      if (!current.course) return result("Спочатку встановіть контекст дисципліни.", ctx, "dependency_not_met");
      return handleTool(
        ctx,
        () => presentationService.replacePresentationSlides(
          current.course!.id,
          args.topicUid,
          args.baseRevision,
          args.slides,
        ),
        (presentation) => ({
          message: `Замінено презентацію. Слайдів: ${presentation.slides.length}.`,
          extra: { presentation, presentationUri: presentationUri(current.course!.id, args.topicUid) },
        }),
      );
    },
  );

  server.registerTool(
    "put_presentation_diagram",
    {
      description:
        "Створює або оновлює діаграму через налаштований Kroki, зберігає текстове джерело та SVG у Git. "
        + "Повертає Markdown для вставки у слайд.",
      inputSchema: z.object({
        topicUid: z.string().uuid(),
        baseRevision: z.string().min(7),
        name: z.string().min(1).max(80),
        type: z.enum(["mermaid", "d2", "excalidraw", "plantuml", "graphviz"]),
        source: z.string().min(1),
        alt: z.string().optional(),
      }),
      outputSchema: ZodToolOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) => {
      const current = getSessionContext(ctx.sessionId);
      if (!current.course) return result("Спочатку встановіть контекст дисципліни.", ctx, "dependency_not_met");
      return handleTool(
        ctx,
        () => presentationService.putPresentationDiagram(
          current.course!.id,
          args.topicUid,
          args.baseRevision,
          args,
        ),
        ({ presentation, diagram }) => ({
          message: `Збережено діаграму ${diagram.name}. Вставте у слайд: ${diagram.markdown}`,
          extra: {
            presentation,
            diagram,
            presentationUri: presentationUri(current.course!.id, args.topicUid),
          },
        }),
      );
    },
  );

  server.registerTool(
    "restore_presentation_revision",
    {
      description: "Відновлює презентацію до Git-ревізії та створює новий коміт без переписування історії.",
      inputSchema: z.object({
        topicUid: z.string().uuid(),
        baseRevision: z.string().min(7),
        revision: z.string().min(7),
        confirm: z.literal(true),
      }),
      outputSchema: ZodToolOutput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args, ctx) => {
      const current = getSessionContext(ctx.sessionId);
      if (!current.course) return result("Спочатку встановіть контекст дисципліни.", ctx, "dependency_not_met");
      return handleTool(
        ctx,
        () => presentationService.restorePresentation(
          current.course!.id,
          args.topicUid,
          args.baseRevision,
          args.revision,
        ),
        (presentation) => ({
          message: `Презентацію відновлено до ${args.revision.slice(0, 12)}.`,
          extra: { presentation, presentationUri: presentationUri(current.course!.id, args.topicUid) },
        }),
      );
    },
  );
}

