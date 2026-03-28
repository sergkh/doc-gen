import { Agent, MemorySession, run, RunContext, tool } from "@openai/agents";
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
    discipline: null 
  };

  agentSessions.set(sessionId, next);
  return next;
}

function clearAgentContext(sessionId: string): void {
  agentSessions.delete(sessionId);
}

const SYSTEM_PROMPT =
  "Ти асистент викладача вищого навчального закладу, що аналізує навчальні плани та дисципліни. " +
  "Використовуй надані інструменти для пошуку інформації та відповідай українською." +
  "Перед фінальною відповіддю ОБОВ'ЯЗКОВО виконай усі необхідні виклики інструментів. " +
  "Якщо інструмент повертає помилку або бракує параметрів, попроси користувача уточнити дані. " +
  "Ти можеш працювати конкретною дисципліною: спочатку встанови контекст дисципліни (set_discipline_context), а потім можна керувати нею чи теми (save_discipline_topics).";

export async function runAgent(options: {
  specialtyId: number;
  sessionId: string;
  message: string;
  apiKey: string | null;
  model?: string;
  maxSteps?: number;
}): Promise<AgentReply> {
  const model = options.model || DEFAULT_AGENT_MODEL;
  const context = getOrInitAgentContext(options.sessionId);

  // const client = createOpenAIClient(options.apiKey);

  const chatAgent = new Agent({
    name: "Teacher Assistant",
    instructions: SYSTEM_PROMPT,
    model,
    modelSettings: { temperature: 0 },
    tools: [
      disciplineByResult(options.specialtyId)
    ]
  });

  const reply = await run(chatAgent, options.message, { 
    session: context.session, 
    maxTurns: options.maxSteps ?? 10,
    context: context
  });

  console.log("Output:", reply.finalOutput)
  console.log("Output tools:", reply.output)
  
  const toolsCalls = reply.output.filter(r => r.type === "function_call_result").map(toolResult => ({
    name: toolResult.name,
    status: toolResult.status,
    // @ts-ignore
    output: JSON.parse(toolResult.output?.type === 'text' ? toolResult.output.text : '{}')
  })) as ToolResult[];

  return {
    reply: reply.finalOutput ?? "Вибачте, не вдалося згенерувати відповідь.",
    context: {
      discipline: context.discipline
    },
    tools: toolsCalls
  } as AgentReply;
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