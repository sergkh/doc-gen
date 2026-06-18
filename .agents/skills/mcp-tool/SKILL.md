name: mcp-tool
version: 0.1.0
applyTo: workspace

# Skill: Create MCP Tool (workspace-local)

## Purpose
Guide creating a new MCP tool in this repository, mirroring the existing patterns (see `src/api/tools/list-disciplines.ts`) and wiring it into `src/api/mcp-server.ts` with logging, user confirmation on writes, and correct annotations.

## When to use
- Adding a new MCP tool (not resource) under `src/api/tools/`.
- Exposing backend operations via MCP tools that read/modify data.
- Ensuring new tools are registered and advertised in `mcp-server.ts` instructions and capabilities.

## Workflow
1) Design
- Define the tool name, description, and input/output schemas with `zod`.
- Decide side-effect behavior (reads vs writes). If writes, plan confirmation prompt.

2) Implement tool module
- Place in `src/api/tools/<tool-name>.ts`.
- Import `McpServer`, `ServerContext`, `z`, and needed stores/services.
- Export `registerX(server: McpServer)` function.
- Call `server.registerTool(name, { description, inputSchema, outputSchema }, async (args, ctx: ServerContext) => { ... })`.
- Include structured response: `{ content: [{ type: "text", text }], structuredContent: {...} }`.
- Add logging `console.log`/`console.error` with `sessionId` and key parameters/results.
- For writes: before mutating, ensure confirmation (e.g., require `confirm: boolean` flag or separate confirm tool call); abort if not confirmed.

3) Wire into server
- In `src/api/mcp-server.ts`, import and invoke `registerX(server)`.
- Update `instructions` text to mention the new tool and its purpose.

4) Annotation & schemas
- Use `z.object({...})` for `inputSchema` and `outputSchema` with explicit types.
- Keep outputs predictable: status/message plus data payload.
- Prefer `satisfies` to lock response shapes when helpful.

5) Logging
- On entry and success/failure, log `sessionId`, key args, counts/ids. Avoid noisy payload dumps.

6) Confirmation pattern for writes
- Inputs should carry `confirm: boolean` or a staged flow. If `confirm !== true`, return a message asking for confirmation and do NOT mutate.
- Respond with `status: "confirmation_required"` where applicable.

## Example (read-only pattern)
Based on `list-disciplines` tool:
```ts
import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { courses } from "@/stores/db";
import { getSessionContext, toolResult, ZodContext, type ToolContentResult } from "./session-context";

const ZodOutput = z.object({
  items: z.array(
    z.object({ id: z.number(), name: z.string(), okNo: z.string().nullable(), teacher: z.string().nullable() })
  ),
  count: z.number(),
  status: z.string(),
  message: z.string().optional(),
  context: ZodContext,
});

type Output = z.infer<typeof ZodOutput>;

export function registerListDisciplines(server: McpServer) {
  server.registerTool(
    "list_disciplines",
    { description: "Повертає всі дисципліни спеціальності заданої через set_specialty_context", inputSchema: z.object({}), outputSchema: ZodOutput },
    async (_ignore: object, ctx: ServerContext) => {
      console.log("MCP tool list_disciplines called", { sessionId: ctx.sessionId });
      try {
        const current = getSessionContext(ctx.sessionId);
        const specialty = current.specialty;
        if (!specialty) return toolResult("Спеціальність не встановлено в контексті. Викличте set_specialty_context.", current, "dependency_not_met");

        const list = await courses.bySpecialty(specialty.id);
        const items = list.map((course) => ({ id: course.id, name: course.name, okNo: course.data?.ok_no ?? null, teacher: course.teacher ?? null }));
        const message = `Знайдено ${items.length} дисциплін(и) для спеціальності ${specialty.name}.`;
        const response = {
          content: [{ type: "text", text: message }] as ToolContentResult,
          structuredContent: { status: "ok", message, count: items.length, items, context: getSessionContext(ctx.sessionId) } as Output,
        };
        console.log("MCP tool list_disciplines success", { sessionId: ctx.sessionId, specialtyId: specialty.id, count: items.length });
        return response;
      } catch (error) {
        console.error("MCP list_disciplines error:", error);
        return toolResult("Сталася помилка під час отримання списку дисциплін.", getSessionContext(ctx.sessionId), "error");
      }
    }
  );
}
```

## Checklist (before commit)
- [ ] Tool file added under `src/api/tools/`
- [ ] Input/output schemas defined with zod
- [ ] Logging on entry and success/failure with sessionId
- [ ] Confirmation gating for writes (no mutation without explicit confirm)
- [ ] Structured response includes status/message and data
- [ ] Tool registered in `mcp-server.ts`
- [ ] Instructions string updated to mention the new tool

## Example prompts
- "Add an MCP tool to list teachers; follow the mcp-tool skill."
- "Create an MCP tool to delete a course with confirm gating; wire it into mcp-server instructions."
- "Implement a tool to export specialty data as JSON, using the mcp-tool pattern."
