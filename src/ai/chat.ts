import type {
  ChatCompletionContentPart,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions/completions";
import { createOpenAIClient } from "./common";
import { courseResults, courses, courseTopics } from "@/stores/db";
import type { Course, CourseResult, CourseTopic } from "@/stores/models";

export const CHAT_MODEL = "gpt-4o-mini";

export type ChatAction =
  | "disciplines_by_sk"
  | "disciplines_by_zk"
  | "disciplines_by_pr"
  | "disciplines_by_topic"
  | "sum_practical_hours"
  | "clarify";

export type DisciplineItem = {
  ok_no: string | null;
  name: string;
};

export type TopicMatchItem = DisciplineItem & {
  matchedTopics: string[];
};

export type PracticalHoursBreakdownItem = DisciplineItem & {
  practicalHours: number;
};

export type ChatToolData =
  | { action: "clarify" }
  | { action: "disciplines_by_sk"; items: DisciplineItem[] }
  | { action: "disciplines_by_zk"; items: DisciplineItem[] }
  | { action: "disciplines_by_pr"; items: DisciplineItem[] }
  | { action: "disciplines_by_topic"; items: TopicMatchItem[] }
  | { action: "sum_practical_hours"; totalPracticalHours: number; byDiscipline: Array<DisciplineItem & { practicalHours: number }> };

export type ChatToolConversationResult = {
  reply: string;
  data: ChatToolData;
};

type ToolExecutionResult = {
  content: string;
  data: ChatToolData;
};

function normalizeText(value: string): string {
  return value.toLowerCase().trim().replaceAll("'", "ʼ");
}

function compareOkNo(codeA: string | null, codeB: string | null): number {
  if (codeA === codeB) return 0;
  if (codeA === null) return -1;
  if (codeB === null) return 1;

  const isOkA = /^\d{1,2}$/.test(codeA);
  const isOkB = /^\d{1,2}$/.test(codeB);

  if (isOkA && isOkB) return Number(codeA) - Number(codeB);
  if (isOkA && !isOkB) return -1;
  if (!isOkA && isOkB) return 1;

  return codeA.localeCompare(codeB);
}

async function listCoursesBySpecialty(specialtyId: number): Promise<Course[]> {
  return await courses.bySpecialty(specialtyId);
}

async function listTopicsByCourses(coursesList: Course[]): Promise<CourseTopic[]> {
  return await courseTopics.byCourseIds(coursesList.map((c) => c.id));
}

async function findResultByType(
  specialtyId: number,
  type: "СК" | "ЗК" | "РН",
  no: number,
): Promise<CourseResult | null> {
  const results = await courseResults.bySpecialty(specialtyId);
  return results.find((r) => r.type === type && r.no === no) ?? null;
}

async function disciplinesByResultType(
  specialtyId: number,
  type: "СК" | "ЗК" | "РН",
  no: number,
): Promise<{ items: DisciplineItem[]; resultName: string | null }> {
  const result = await findResultByType(specialtyId, type, no);
  if (!result) return { items: [], resultName: null };

  const coursesList = await listCoursesBySpecialty(specialtyId);

  const items = coursesList
    .filter((course) => Array.isArray(course.data?.results) && course.data.results.includes(result.id))
    .map((course) => ({ ok_no: course.data?.ok_no ?? null, name: course.name }))
    .sort((a, b) => compareOkNo(a.ok_no, b.ok_no));

  return { items, resultName: result.name };
}

export async function disciplinesBySk(
  specialtyId: number,
  skNo: number,
): Promise<{ items: DisciplineItem[]; resultName: string | null }> {
  return disciplinesByResultType(specialtyId, "СК", skNo);
}

export async function disciplinesByZk(
  specialtyId: number,
  zkNo: number,
): Promise<{ items: DisciplineItem[]; resultName: string | null }> {
  return disciplinesByResultType(specialtyId, "ЗК", zkNo);
}

export async function disciplinesByPr(
  specialtyId: number,
  prNo: number,
): Promise<{ items: DisciplineItem[]; resultName: string | null }> {
  return disciplinesByResultType(specialtyId, "РН", prNo);
}

export async function disciplinesByTopic(
  specialtyId: number,
  query: string,
): Promise<{ items: TopicMatchItem[] }> {
  const normalizedQuery = normalizeText(query);

  const coursesList = await listCoursesBySpecialty(specialtyId);
  const topics = await listTopicsByCourses(coursesList);

  const topicsByCourseId = new Map<number, CourseTopic[]>();
  for (const topic of topics) {
    const arr = topicsByCourseId.get(topic.course_id) ?? [];
    arr.push(topic);
    topicsByCourseId.set(topic.course_id, arr);
  }

  const items: TopicMatchItem[] = [];

  for (const course of coursesList) {
    const courseText = normalizeText([course.name, course.data?.description ?? ""].join("\n"));

    const matchedTopics: string[] = [];
    const courseTopicsList = topicsByCourseId.get(course.id) ?? [];

    for (const topic of courseTopicsList) {
      const topicText = normalizeText([topic.name ?? "", topic.lection ?? ""].join("\n"));
      if (topicText.includes(normalizedQuery)) {
        matchedTopics.push(topic.name);
      }
    }

    const matchesCourse = courseText.includes(normalizedQuery);

    if (matchesCourse || matchedTopics.length > 0) {
      items.push({
        ok_no: course.data?.ok_no ?? null,
        name: course.name,
        matchedTopics: [...new Set(matchedTopics)].sort(),
      });
    }
  }

  items.sort((a, b) => compareOkNo(a.ok_no, b.ok_no));

  return { items };
}

export async function sumPracticalHours(
  specialtyId: number,
): Promise<{ totalPracticalHours: number; byDiscipline: PracticalHoursBreakdownItem[] }> {
  const coursesList = await listCoursesBySpecialty(specialtyId);
  const topics = await listTopicsByCourses(coursesList);

  const practicalByCourseId = new Map<number, number>();
  for (const topic of topics) {
    const practical = topic.data?.fulltime?.practical_hours ?? 0;
    practicalByCourseId.set(topic.course_id, (practicalByCourseId.get(topic.course_id) ?? 0) + practical);
  }

  const byDiscipline: PracticalHoursBreakdownItem[] = coursesList
    .map((course) => ({
      ok_no: course.data?.ok_no ?? null,
      name: course.name,
      practicalHours: practicalByCourseId.get(course.id) ?? 0,
    }))
    .sort((a, b) => compareOkNo(a.ok_no, b.ok_no));

  const totalPracticalHours = byDiscipline.reduce((sum, item) => sum + item.practicalHours, 0);

  return { totalPracticalHours, byDiscipline };
}

const SYSTEM_PROMPT =
  "Ти асистент, що аналізує навчальні плани. " +
  "Використовуй надані інструменти для пошуку інформації та відповідай українською. " +
  "Перед фінальною відповіддю ОБОВʼЯЗКОВО виконай усі необхідні виклики інструментів. " +
  "Якщо інструмент повертає помилку або бракує параметрів, попроси користувача уточнити дані.";

const CHAT_COMPLETION_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "disciplines_by_sk",
      description: "Повертає дисципліни, що покривають конкретну спеціальну компетентність (СК-№)",
      parameters: {
        type: "object",
        properties: {
          number: {
            type: "integer",
            minimum: 1,
            description: "Номер СК (наприклад, 5 для СК-5)",
          },
        },
        required: ["number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "disciplines_by_zk",
      description: "Повертає дисципліни, що покривають конкретну загальну компетентність (ЗК-№)",
      parameters: {
        type: "object",
        properties: {
          number: {
            type: "integer",
            minimum: 1,
            description: "Номер ЗК (наприклад, 3 для ЗК-3)",
          },
        },
        required: ["number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "disciplines_by_pr",
      description: "Повертає дисципліни, що покривають результати навчання/ПР (РН/ПР-№)",
      parameters: {
        type: "object",
        properties: {
          number: {
            type: "integer",
            minimum: 1,
            description: "Номер ПР або РН (наприклад, 2 для ПР-2)",
          },
        },
        required: ["number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "disciplines_by_topic",
      description: "Шукає дисципліни та теми, де згадується конкретне ключове слово",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Ключове слово або фраза для пошуку",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sum_practical_hours",
      description: "Підраховує сумарні практичні години (денна форма) по спеціальності",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

function safeParseArguments(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parsePositiveInt(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num <= 0) return null;
  return Math.trunc(num);
}

function parseQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toToolContent(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, (_key, val) => (val === undefined ? null : val));
}

async function handleToolCall(
  name: string,
  rawArgs: Record<string, unknown>,
  specialtyId: number,
): Promise<ToolExecutionResult> {
  switch (name) {
    case "disciplines_by_sk": {
      const number = parsePositiveInt(rawArgs.number);
      if (!number) {
        return {
          content: toToolContent({ status: "error", action: "disciplines_by_sk", message: "Відсутній номер СК" }),
          data: { action: "clarify" },
        };
      }
      const { items, resultName } = await disciplinesBySk(specialtyId, number);
      return {
        content: toToolContent({
          status: items.length > 0 ? "ok" : "empty",
          action: "disciplines_by_sk",
          label: resultName ? `СК-${number} (${resultName})` : `СК-${number}`,
          items,
        }),
        data: { action: "disciplines_by_sk", items },
      };
    }

    case "disciplines_by_zk": {
      const number = parsePositiveInt(rawArgs.number);
      if (!number) {
        return {
          content: toToolContent({ status: "error", action: "disciplines_by_zk", message: "Відсутній номер ЗК" }),
          data: { action: "clarify" },
        };
      }
      const { items, resultName } = await disciplinesByZk(specialtyId, number);
      return {
        content: toToolContent({
          status: items.length > 0 ? "ok" : "empty",
          action: "disciplines_by_zk",
          label: resultName ? `ЗК-${number} (${resultName})` : `ЗК-${number}`,
          items,
        }),
        data: { action: "disciplines_by_zk", items },
      };
    }

    case "disciplines_by_pr": {
      const number = parsePositiveInt(rawArgs.number);
      if (!number) {
        return {
          content: toToolContent({ status: "error", action: "disciplines_by_pr", message: "Відсутній номер ПР/РН" }),
          data: { action: "clarify" },
        };
      }
      const { items, resultName } = await disciplinesByPr(specialtyId, number);
      return {
        content: toToolContent({
          status: items.length > 0 ? "ok" : "empty",
          action: "disciplines_by_pr",
          label: resultName ? `ПР-${number} (${resultName})` : `ПР-${number}`,
          items,
        }),
        data: { action: "disciplines_by_pr", items },
      };
    }

    case "disciplines_by_topic": {
      const query = parseQuery(rawArgs.query);
      if (!query) {
        return {
          content: toToolContent({ status: "error", action: "disciplines_by_topic", message: "Відсутня тема" }),
          data: { action: "clarify" },
        };
      }
      const { items } = await disciplinesByTopic(specialtyId, query);
      return {
        content: toToolContent({
          status: items.length > 0 ? "ok" : "empty",
          action: "disciplines_by_topic",
          query,
          items,
        }),
        data: { action: "disciplines_by_topic", items },
      };
    }

    case "sum_practical_hours": {
      const result = await sumPracticalHours(specialtyId);
      return {
        content: toToolContent({ status: "ok", action: "sum_practical_hours", ...result }),
        data: { action: "sum_practical_hours", ...result },
      };
    }

    default:
      return {
        content: toToolContent({ status: "error", action: "clarify", message: `Невідомий інструмент: ${name}` }),
        data: { action: "clarify" },
      };
  }
}

function extractAssistantText(message: ChatCompletionMessage | undefined): string {
  if (!message) return "";
  const content = message.content as string | ChatCompletionContentPart[] | null;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    const parts = content as ChatCompletionContentPart[];
    return parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

export async function runChatToolsConversation(options: {
  specialtyId: number;
  message: string;
  apiKey: string | null;
  maxSteps?: number;
}): Promise<ChatToolConversationResult> {
  const client = createOpenAIClient(options.apiKey);
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: options.message },
  ];

  let latestData: ChatToolData = { action: "clarify" };
  const maxSteps = options.maxSteps ?? 6;

  for (let step = 0; step < maxSteps; step++) {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0,
      tool_choice: "auto",
      tools: CHAT_COMPLETION_TOOLS,
      messages,
    });

    const choice = completion.choices?.[0];
    const assistantMessage = choice?.message;

    if (!assistantMessage) {
      throw new Error("Empty response from model");
    }

    messages.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls ?? [];
    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        if (call.type !== "function" || !call.function) continue;

        const toolResult = await handleToolCall(call.function.name, safeParseArguments(call.function.arguments), options.specialtyId);
        latestData = toolResult.data;

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: toolResult.content,
        });
      }
      continue;
    }

    const reply = extractAssistantText(assistantMessage);
    return {
      reply: reply || "Вибачте, не вдалося згенерувати відповідь.",
      data: latestData,
    };
  }

  throw new Error("Перевищено ліміт кроків під час виклику інструментів");
}
