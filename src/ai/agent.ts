import { Agent, MemorySession, RunState, run, RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { courseResults, courses } from "@/stores/db";
import type { ResultType } from "@/stores/models";
import { createOpenAIClient } from "./common";
import { DEFAULT_AGENT_MODEL, type AgentReply, type DisciplineContext, type AgentContext, type DisciplineSearchItem, type ToolResult } from "./models";

// export type ChatToolData =
//   | { action: "clarify" }
//   | { action: "disciplines_by_sk"; items: DisciplineItem[] }
//   | { action: "disciplines_by_zk"; items: DisciplineItem[] }
//   | { action: "disciplines_by_pr"; items: DisciplineItem[] }
//   | { action: "disciplines_by_topic"; items: TopicMatchItem[] }
//   | { action: "sum_practical_hours"; totalPracticalHours: number; byDiscipline: Array<DisciplineItem & { practicalHours: number }> }
//   | { action: "discipline_details"; item: DisciplineDetailsItem | null }
//   | { action: "list_disciplines"; items: DisciplineBasicInfo[] }
//   | { action: "set_discipline_context"; context: DisciplineContext }
//   | { action: "get_discipline_context"; context: DisciplineContext }
//   | { action: "clear_discipline_context" }
//   | { action: "save_discipline_topics"; status: "ok" | "error"; message: string; addedTopics: string[] };

const agentSessions = new Map<string, AgentContext>();
function getOrInitAgentContext(sessionId: string): AgentContext {
  const existing = agentSessions.get(sessionId);
  if (existing) return existing;

  const next: AgentContext = { 
    session: new MemorySession({ sessionId }), 
    discipline: null,
    pendingRunStates: new Map<string, string>()
  };

  agentSessions.set(sessionId, next);
  return next;
}

const SYSTEM_PROMPT =
  "Ти асистент викладача вищого навчального закладу, що аналізує навчальні плани та дисципліни. " +
  "Використовуй надані інструменти для пошуку інформації та відповідай українською." +
  "Перед фінальною відповіддю ОБОВ'ЯЗКОВО виконай усі необхідні виклики інструментів. " +
  "Якщо інструмент повертає помилку або бракує параметрів, попроси користувача уточнити дані. " +
  "Ти можеш працювати конкретною дисципліною: спочатку встанови контекст дисципліни (set_discipline_context), а потім можна керувати нею чи теми (save_discipline_topics).";

function getApprovalId(sessionId: string, toolName: string, callId: string): string {
  return `${sessionId}:${toolName}:${callId}`;
}

function parseApprovalId(approvalId: string): { sessionId: string; toolName: string; callId: string } | null {
  const firstColon = approvalId.indexOf(":");
  const secondColon = approvalId.indexOf(":", firstColon + 1);

  if (firstColon <= 0 || secondColon <= firstColon + 1) return null;

  return {
    sessionId: approvalId.slice(0, firstColon),
    toolName: approvalId.slice(firstColon + 1, secondColon),
    callId: approvalId.slice(secondColon + 1),
  };
}

async function applyPendingApproval(options: {
  context: AgentContext;
  chatAgent: Agent<any, any>;
  approvalId: string;
  decision: "approve" | "reject";
}) {
  const parsed = parseApprovalId(options.approvalId);
  if (!parsed) {
    throw new Error("Invalid approval id");
  }

  const stateKey = options.approvalId;
  const serializedState = options.context.pendingRunStates.get(stateKey);
  if (!serializedState) {
    throw new Error("Approval state not found or expired");
  }

  const state = await RunState.fromString(options.chatAgent, serializedState);
  const interruptions = state.getInterruptions();
  const target = interruptions.find((item) => {
    const toolName = item.name ?? item.toolName ?? "unknown";
    const callId = (item.rawItem as any).callId ?? (item.rawItem as any).call_id;
    return toolName === parsed.toolName && String(callId) === parsed.callId;
  });

  if (!target) {
    throw new Error("Approval target not found");
  }

  if (options.decision === "approve") {
    state.approve(target);
  } else {
    state.reject(target, { message: "Користувач відхилив виконання дії." });
  }

  options.context.pendingRunStates.delete(stateKey);
  return state;
}

function extractInterruptionRequest(
  sessionId: string,
  context: AgentContext,
  runResult: { interruptions: any[]; state: any }
): AgentReply["requiresUserInput"] {
  const first = runResult.interruptions?.[0];
  if (!first) return null;

  const toolName = first.name ?? first.toolName ?? "unknown";
  const callId = (first.rawItem as any).callId ?? (first.rawItem as any).call_id;
  if (!callId) return null;

  const approvalId = getApprovalId(sessionId, toolName, String(callId));
  context.pendingRunStates.set(approvalId, runResult.state.toString());

  return {
    kind: "approval",
    approvalId,
    question: `Підтвердити виконання інструменту \"${toolName}\"?`,
    options: ["approve", "reject"],
  };
}

function extractToolCalls(output: Array<any>): ToolResult[] {
  return output
    .filter((r) => r.type === "function_call_result")
    .map((toolResult) => ({
      name: toolResult.name,
      status: toolResult.status,
      // @ts-ignore
      output: JSON.parse(toolResult.output?.type === "text" ? toolResult.output.text : "{}"),
    })) as ToolResult[];
}

function buildChatAgent(specialtyId: number, model: string) {
  return new Agent({
    name: "Teacher Assistant",
    instructions: SYSTEM_PROMPT,
    model,
    modelSettings: { temperature: 0 },
    tools: [disciplineByResult(specialtyId)],
  });
}

export async function runAgent(options: {
  specialtyId: number;
  sessionId: string;
  message: string;
  apiKey: string | null;
  model?: string;
  maxSteps?: number;
  approvalId?: string;
  approvalDecision?: "approve" | "reject";
}): Promise<AgentReply> {
  const model = options.model || DEFAULT_AGENT_MODEL;
  const context = getOrInitAgentContext(options.sessionId);

  // const client = createOpenAIClient(options.apiKey);

  const chatAgent = buildChatAgent(options.specialtyId, model);

  const runInput =
    options.approvalId && options.approvalDecision
      ? await applyPendingApproval({
          context,
          chatAgent,
          approvalId: options.approvalId,
          decision: options.approvalDecision,
        })
      : options.message;

  const reply = await run(chatAgent, runInput, {
    session: context.session,
    maxTurns: options.maxSteps ?? 10,
    context: context
  });

  console.log("Output:", reply.finalOutput)
  console.log("Output tools:", reply.output)

  const toolsCalls = extractToolCalls(reply.output as Array<any>);
  const interruptionRequest = extractInterruptionRequest(options.sessionId, context, reply as any);
  const finalReply = reply.finalOutput ?? (interruptionRequest ? "Потрібне підтвердження дії." : "Вибачте, не вдалося згенерувати відповідь.");

  return {
    reply: finalReply,
    requiresUserInput: interruptionRequest,
    context: {
      sessionId: options.sessionId,
      discipline: context.discipline,
    },
    tools: toolsCalls,
  };
}

export async function runAgentStream(options: {
  specialtyId: number;
  sessionId: string;
  message: string;
  apiKey: string | null;
  model?: string;
  maxSteps?: number;
  onTextDelta?: (delta: string) => void;
  approvalId?: string;
  approvalDecision?: "approve" | "reject";
}): Promise<AgentReply> {
  const model = options.model || DEFAULT_AGENT_MODEL;
  const context = getOrInitAgentContext(options.sessionId);

  const chatAgent = buildChatAgent(options.specialtyId, model);

  const runInput =
    options.approvalId && options.approvalDecision
      ? await applyPendingApproval({
          context,
          chatAgent,
          approvalId: options.approvalId,
          decision: options.approvalDecision,
        })
      : options.message;

  const streamed = await run(chatAgent, runInput, {
    session: context.session,
    maxTurns: options.maxSteps ?? 10,
    context,
    stream: true,
  });

  let replyText = "";
  const textStream = streamed.toTextStream();

  for await (const delta of textStream as AsyncIterable<string>) {
    if (!delta) continue;
    replyText += delta;
    options.onTextDelta?.(delta);
  }

  await streamed.completed;

  const toolsCalls = extractToolCalls(streamed.output as Array<any>);
  const interruptionRequest = extractInterruptionRequest(options.sessionId, context, streamed as any);
  const finalReply = (
    (streamed.finalOutput as string | undefined) ?? replyText
  ) || (interruptionRequest ? "Потрібне підтвердження дії." : "");

  return {
    reply: finalReply,
    requiresUserInput: interruptionRequest,
    context: {
      sessionId: options.sessionId,
      discipline: context.discipline
    },
    tools: toolsCalls
  };
}

function disciplineByResult(specialtyId: number) {
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

  return tool({
    name: "search_disciplines_by_result",
    description: "Шукає дисципліни за результатом (ЗК, СК, ПР/РН). Приймає код результату на кшталт 'ЗК-3', 'СК2', 'ПР-7' або 'РН-1'",
    parameters: z.object({ result: z.string() }),
    needsApproval: ({ result }) => false,
    execute: async ({ result }, context?: RunContext<AgentContext>) => {
      console.log("Searching disciplines by result:", result);
      try {
        const parsed = parseResultQuery(result);

        if (!parsed) {
          return {
            status: "invalid",
            message: "Некоректний код результату. Приклад: ЗК-3, СК2, ПР-7 або РН-1.",
            items: []
          };
        }

        const results = await courseResults.bySpecialty(specialtyId);
        const matchedResult = results.find(r => r.type === parsed.type && r.no === parsed.no) || null;
        
        if (!matchedResult) {
          return {
            status: "not_found",
            message: `Результат ${parsed.type}-${parsed.no} не знайдено для цієї спеціальності.`,
            items: []
          };
        }

        // TODO: client filtering is not very optimal
        const allCourses = (await courses.bySpecialty(specialtyId))
          .filter(course => Array.isArray(course.data?.results) && course.data.results.includes(matchedResult.id));

        console.log(`Searching courses by result: ${matchedResult.type}-${matchedResult.no} ${matchedResult.id} Found: ${allCourses.length} courses`);

        if (allCourses.length === 0) {
          return {
            status: "not_found",
            message: `Курсів для результату ${matchedResult.type}-${matchedResult.no} **${matchedResult.name}** не знайдено.`,
            items: []
          };
        }

        const items: DisciplineSearchItem[] = allCourses
          
          .map(course => ({
            courseId: course.id,
            courseName: course.name,
            okNo: course.data?.ok_no ?? null,
            teacher: course.teacher ?? null
          }));

        return {
          status: "ok",
          result: {
            id: matchedResult.id,
            type: matchedResult.type,
            no: matchedResult.no,
            name: matchedResult.name
          },
          items
        };
      } catch (error) {
        console.error("Error searching disciplines by result:", error);
        return {
          status: "error",
          message: "Сталася помилка під час пошуку дисциплін.",
          items: []
        };
      }
    }
  });
}