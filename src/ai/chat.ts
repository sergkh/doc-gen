import type { BunRequest } from "bun";
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

export type DisciplineContext = {
  courseId: number;
  courseName: string;
  okNo: string | null;
} | null;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type SessionData = {
  context: DisciplineContext;
  history: ChatMessage[];
};

type SessionStore = Map<string, SessionData>;

const sessionStore: SessionStore = new Map();
const MAX_HISTORY_LENGTH = 20;

function getOrInitSession(sessionId: string): SessionData {
  let session = sessionStore.get(sessionId);
  if (!session) {
    session = { context: null, history: [] };
    sessionStore.set(sessionId, session);
  }
  return session;
}

export function getSessionContext(sessionId: string): DisciplineContext {
  return getOrInitSession(sessionId).context;
}

export function setSessionContext(sessionId: string, context: DisciplineContext): void {
  getOrInitSession(sessionId).context = context;
}

export function clearSessionContext(sessionId: string): void {
  const session = sessionStore.get(sessionId);
  if (session) {
    session.context = null;
  }
}

export function getSessionHistory(sessionId: string): ChatMessage[] {
  return getOrInitSession(sessionId).history;
}

export function addToSessionHistory(sessionId: string, role: "user" | "assistant", content: string): void {
  const session = getOrInitSession(sessionId);
  session.history.push({ role, content });
  
  if (session.history.length > MAX_HISTORY_LENGTH) {
    session.history = session.history.slice(-MAX_HISTORY_LENGTH);
  }
}

export function clearSessionHistory(sessionId: string): void {
  const session = sessionStore.get(sessionId);
  if (session) {
    session.history = [];
  }
}

export type ChatAction =
  | "disciplines_by_sk"
  | "disciplines_by_zk"
  | "disciplines_by_pr"
  | "disciplines_by_topic"
  | "sum_practical_hours"
  | "discipline_details"
  | "list_disciplines"
  | "set_discipline_context"
  | "get_discipline_context"
  | "clear_discipline_context"
  | "save_discipline_topics"
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

export type DisciplineBasicInfo = DisciplineItem & {
  credits: number | null;
  hours: number | null;
  controlType: string | null;
};

export type DisciplineDetailsItem = {
  discipline: DisciplineItem & {
    description: string | null;
    credits: number | null;
    hours: number | null;
    controlType: string | null;
    semesters: number[];
    resultIds: number[];
  };
  results: Array<{ type: string; no: number; name: string }>;
  topics: Array<{ name: string; lection: string }>;
};

export type ChatToolData =
  | { action: "clarify" }
  | { action: "disciplines_by_sk"; items: DisciplineItem[] }
  | { action: "disciplines_by_zk"; items: DisciplineItem[] }
  | { action: "disciplines_by_pr"; items: DisciplineItem[] }
  | { action: "disciplines_by_topic"; items: TopicMatchItem[] }
  | { action: "sum_practical_hours"; totalPracticalHours: number; byDiscipline: Array<DisciplineItem & { practicalHours: number }> }
  | { action: "discipline_details"; item: DisciplineDetailsItem | null }
  | { action: "list_disciplines"; items: DisciplineBasicInfo[] }
  | { action: "set_discipline_context"; context: DisciplineContext }
  | { action: "get_discipline_context"; context: DisciplineContext }
  | { action: "clear_discipline_context" }
  | { action: "save_discipline_topics"; status: "ok" | "error"; message: string; addedTopics: string[] };

export type ToolHistoryEntry = {
  toolName: string;
  arguments: Record<string, unknown>;
  result: ChatToolData;
};

export type ChatToolConversationResult = {
  reply: string;
  data: ChatToolData;
  toolHistory: ToolHistoryEntry[];
  context: DisciplineContext;
};

type ToolExecutionResult = {
  content: string;
  data: ChatToolData;
  toolName: string;
  arguments: Record<string, unknown>;
};

type ToolParameterSchema = {
  type: "integer" | "string";
  description: string;
  minimum?: number;
};

interface ChatTool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameterSchema>;
  required: string[];
  execute: (args: Record<string, unknown>, specialtyId: number, sessionId: string) => Promise<{ result: ChatToolData; content: string }>;
}

function normalizeText(value: string): string {
  return value.toLowerCase().trim().replaceAll("'", "ʼ");
}

function extractOkNumber(value: string): string | null {
  const normalized = value.toLowerCase().trim();
  const match = normalized.match(/^(ок|вк)?(\d+(?:\.\d+)?)$/);
  return match && match[2] ? match[2] : null;
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
  const okNumber = extractOkNumber(query);

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
    const courseName = normalizeText(course.name);
    const courseOkNo = normalizeText(course.data?.ok_no ?? "");

    const matchedTopics: string[] = [];
    const courseTopicsList = topicsByCourseId.get(course.id) ?? [];

    for (const topic of courseTopicsList) {
      const topicText = normalizeText([topic.name ?? "", topic.lection ?? ""].join("\n"));
      if (topicText.includes(normalizedQuery)) {
        matchedTopics.push(topic.name);
      }
    }

    let matchesCourse = false;
    if (okNumber && courseOkNo === okNumber) {
      matchesCourse = true;
    } else if (courseName === normalizedQuery || courseName.includes(normalizedQuery)) {
      matchesCourse = true;
    }

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

export async function listDisciplines(
  specialtyId: number,
): Promise<{ items: DisciplineBasicInfo[] }> {
  const coursesList = await listCoursesBySpecialty(specialtyId);

  const items: DisciplineBasicInfo[] = coursesList
    .map((course) => ({
      ok_no: course.data?.ok_no ?? null,
      name: course.name,
      credits: course.data?.credits ?? null,
      hours: course.data?.hours ?? null,
      controlType: course.data?.control_type ?? null,
    }))
    .sort((a, b) => compareOkNo(a.ok_no, b.ok_no));

  return { items };
}

export async function disciplineDetails(
  specialtyId: number,
  query: string,
): Promise<{ item: DisciplineDetailsItem | null }> {
  const normalizedQuery = normalizeText(query);
  const okNumber = extractOkNumber(query);
  const coursesList = await listCoursesBySpecialty(specialtyId);

  let discipline: Course | null = null;

  for (const course of coursesList) {
    const courseName = normalizeText(course.name);
    const courseOkNo = normalizeText(course.data?.ok_no ?? "");

    if (okNumber && courseOkNo === okNumber) {
      discipline = course;
      break;
    }
    if (courseName === normalizedQuery) {
      discipline = course;
      break;
    }
    if (courseName.includes(normalizedQuery)) {
      discipline = course;
      break;
    }
  }

  if (!discipline) {
    return { item: null };
  }

  const allResults = await courseResults.bySpecialty(specialtyId);
  const results = allResults
    .filter((r) => Array.isArray(discipline.data?.results) && discipline.data.results.includes(r.id))
    .map((r) => ({ type: r.type, no: r.no, name: r.name }))
    .sort((a, b) => {
      const typeOrder: Record<string, number> = { ЗК: 1, СК: 2, РН: 3 };
      const typeDiff = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
      if (typeDiff !== 0) return typeDiff;
      return a.no - b.no;
    });

  const topics = await courseTopics.byCourseIds([discipline.id]);
  const sortedTopics = topics
    .map((t) => ({
      index: t.index,
      name: t.name,
      lection: t.lection,
    }))
    .sort((a, b) => a.index - b.index);

  const semesters = discipline.data?.attestations?.map((a) => a.semester) ?? [];
  const uniqueSemesters = [...new Set(semesters)].sort((a, b) => a - b);

  const item: DisciplineDetailsItem = {
    discipline: {
      ok_no: discipline.data?.ok_no ?? null,
      name: discipline.name,
      description: discipline.data?.description ?? null,
      credits: discipline.data?.credits ?? null,
      hours: discipline.data?.hours ?? null,
      controlType: discipline.data?.control_type ?? null,
      semesters: uniqueSemesters,
      resultIds: discipline.data?.results ?? [],
    },
    results,
    topics: sortedTopics,
  };

  return { item };
}

function toToolContent(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, (_key, val) => (val === undefined ? null : val));
}

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

function toCompletionTool(tool: ChatTool): ChatCompletionTool {
  const parameters: Record<string, any> = {};
  for (const [key, schema] of Object.entries(tool.parameters)) {
    parameters[key] = schema.minimum !== undefined
      ? { type: schema.type, minimum: schema.minimum, description: schema.description }
      : { type: schema.type, description: schema.description };
  }

  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: parameters,
        required: tool.required,
      } as any,
    },
  };
}

const TOOL_REGISTRY: Record<string, ChatTool> = {
  disciplines_by_sk: {
    name: "disciplines_by_sk",
    description: "Повертає дисципліни, що покривають конкретну спеціальну компетентність (СК-5)",
    parameters: {
      number: { type: "integer", minimum: 1, description: "Номер СК (наприклад, 5 для СК-5)" },
    },
    required: ["number"],
    execute: async (args, specialtyId, _sessionId) => {
      const number = parsePositiveInt(args.number);
      if (!number) {
        return {
          result: { action: "clarify" },
          content: toToolContent({ status: "error", action: "disciplines_by_sk", message: "Відсутній номер СК" }),
        };
      }
      const { items, resultName } = await disciplinesBySk(specialtyId, number);
      return {
        result: { action: "disciplines_by_sk", items },
        content: toToolContent({
          status: items.length > 0 ? "ok" : "empty",
          action: "disciplines_by_sk",
          label: resultName ? `СК-${number} (${resultName})` : `СК-${number}`,
          items,
        }),
      };
    },
  },
  disciplines_by_zk: {
    name: "disciplines_by_zk",
    description: "Повертає дисципліни, що покривають конкретну загальну компетентність (ЗК-№)",
    parameters: {
      number: { type: "integer", minimum: 1, description: "Номер ЗК (наприклад, 3 для ЗК-3)" },
    },
    required: ["number"],
    execute: async (args, specialtyId, _sessionId) => {
      const number = parsePositiveInt(args.number);
      if (!number) {
        return {
          result: { action: "clarify" },
          content: toToolContent({ status: "error", action: "disciplines_by_zk", message: "Відсутній номер ЗК" }),
        };
      }
      const { items, resultName } = await disciplinesByZk(specialtyId, number);
      return {
        result: { action: "disciplines_by_zk", items },
        content: toToolContent({
          status: items.length > 0 ? "ok" : "empty",
          action: "disciplines_by_zk",
          label: resultName ? `ЗК-${number} (${resultName})` : `ЗК-${number}`,
          items,
        }),
      };
    },
  },
  disciplines_by_pr: {
    name: "disciplines_by_pr",
    description: "Повертає дисципліни, що покривають результати навчання/ПР (РН/ПР-№)",
    parameters: {
      number: { type: "integer", minimum: 1, description: "Номер ПР або РН (наприклад, 2 для ПР-2)" },
    },
    required: ["number"],
    execute: async (args, specialtyId, _sessionId) => {
      const number = parsePositiveInt(args.number);
      if (!number) {
        return {
          result: { action: "clarify" },
          content: toToolContent({ status: "error", action: "disciplines_by_pr", message: "Відсутній номер ПР/РН" }),
        };
      }
      const { items, resultName } = await disciplinesByPr(specialtyId, number);
      return {
        result: { action: "disciplines_by_pr", items },
        content: toToolContent({
          status: items.length > 0 ? "ok" : "empty",
          action: "disciplines_by_pr",
          label: resultName ? `ПР-${number} (${resultName})` : `ПР-${number}`,
          items,
        }),
      };
    },
  },
  disciplines_by_topic: {
    name: "disciplines_by_topic",
    description: "Шукає дисципліни та теми, де згадується конкретне ключове слово",
    parameters: {
      query: { type: "string", description: "Ключове слово або фраза для пошуку" },
    },
    required: ["query"],
    execute: async (args, specialtyId, _sessionId) => {
      const query = parseQuery(args.query);
      if (!query) {
        return {
          result: { action: "clarify" },
          content: toToolContent({ status: "error", action: "disciplines_by_topic", message: "Відсутня тема" }),
        };
      }
      const { items } = await disciplinesByTopic(specialtyId, query);
      return {
        result: { action: "disciplines_by_topic", items },
        content: toToolContent({
          status: items.length > 0 ? "ok" : "empty",
          action: "disciplines_by_topic",
          query,
          items,
        }),
      };
    },
  },
  sum_practical_hours: {
    name: "sum_practical_hours",
    description: "Підраховує сумарні практичні години (денна форма) по спеціальності",
    parameters: {},
    required: [],
    execute: async (_args, specialtyId) => {
      const result = await sumPracticalHours(specialtyId);
      return {
        result: { action: "sum_practical_hours", ...result },
        content: toToolContent({ status: "ok", action: "sum_practical_hours", ...result }),
      };
    },
  },
  discipline_details: {
    name: "discipline_details",
    description: "Повертає повну інформацію про дисципліну: опис, кредити, години, семестри, всі пов'язані результати (ЗК, СК, РН) та теми",
    parameters: {
      query: { type: "string", description: "Назва дисципліни або номер ОК для пошуку" },
    },
    required: ["query"],
    execute: async (args, specialtyId, _sessionId) => {
      const query = parseQuery(args.query);
      if (!query) {
        return {
          result: { action: "clarify" },
          content: toToolContent({ status: "error", action: "discipline_details", message: "Відсутня назва дисципліни" }),
        };
      }
      const { item } = await disciplineDetails(specialtyId, query);
      if (!item) {
        return {
          result: { action: "discipline_details", item: null },
          content: toToolContent({ status: "empty", action: "discipline_details", query }),
        };
      }
      return {
        result: { action: "discipline_details", item },
        content: toToolContent({ status: "ok", action: "discipline_details", item }),
      };
    },
  },
  list_disciplines: {
    name: "list_disciplines",
    description: "Повертає список усіх дисциплін з базовою інформацією: номер ОК, назва, кредити, години та форма контролю",
    parameters: {},
    required: [],
    execute: async (_args, specialtyId) => {
      const { items } = await listDisciplines(specialtyId);
      return {
        result: { action: "list_disciplines", items },
        content: toToolContent({ status: "ok", action: "list_disciplines", items }),
      };
    },
  },
  set_discipline_context: {
    name: "set_discipline_context",
    description: "Встановлює контекст поточної дисципліни для подальших операцій. Після виклику цього інструменту інші інструменти (збереження тем, перегляд деталей) працюватимуть з цією дисципліною.",
    parameters: {
      query: { type: "string", description: "Назва дисципліни або номер ОК (наприклад: ОК12, Хмарні технології)" },
    },
    required: ["query"],
    execute: async (args, specialtyId, sessionId) => {
      const query = parseQuery(args.query);
      if (!query) {
        return {
          result: { action: "clarify" },
          content: toToolContent({ status: "error", action: "set_discipline_context", message: "Відсутня назва дисципліни" }),
        };
      }

      const normalizedQuery = normalizeText(query);
      const okNumber = extractOkNumber(query);
      const coursesList = await listCoursesBySpecialty(specialtyId);

      let matchedCourse: Course | null = null;
      for (const course of coursesList) {
        const courseName = normalizeText(course.name);
        const courseOkNo = normalizeText(course.data?.ok_no ?? "");

        if (okNumber && courseOkNo === okNumber) {
          matchedCourse = course;
          break;
        }
        if (courseName === normalizedQuery || courseName.includes(normalizedQuery)) {
          matchedCourse = course;
          break;
        }
      }

      if (!matchedCourse) {
        return {
          result: { action: "set_discipline_context", context: null },
          content: toToolContent({ status: "error", action: "set_discipline_context", message: "Дисципліну не знайдено", query }),
        };
      }

      const context: DisciplineContext = {
        courseId: matchedCourse.id,
        courseName: matchedCourse.name,
        okNo: matchedCourse.data?.ok_no ?? null,
      };

      setSessionContext(sessionId, context);

      return {
        result: { action: "set_discipline_context", context },
        content: toToolContent({
          status: "ok",
          action: "set_discipline_context",
          message: `Встановлено контекст: ${context.okNo ? `ОК${context.okNo} ` : ""}${context.courseName}`,
          context,
        }),
      };
    },
  },
  get_discipline_context: {
    name: "get_discipline_context",
    description: "Повертає поточний контекст дисципліни, якщо він встановлений",
    parameters: {},
    required: [],
    execute: async (_args, _specialtyId, sessionId) => {
      const context = getSessionContext(sessionId);
      return {
        result: { action: "get_discipline_context", context },
        content: toToolContent({
          status: context ? "ok" : "empty",
          action: "get_discipline_context",
          context,
          message: context
            ? `Поточна дисципліна: ${context.okNo ? `ОК${context.okNo} ` : ""}${context.courseName}`
            : "Контекст не встановлено",
        }),
      };
    },
  },
  clear_discipline_context: {
    name: "clear_discipline_context",
    description: "Очищує контекст поточної дисципліни та історію чату",
    parameters: {},
    required: [],
    execute: async (_args, _specialtyId, sessionId) => {
      clearSessionContext(sessionId);
      clearSessionHistory(sessionId);
      return {
        result: { action: "clear_discipline_context" },
        content: toToolContent({ status: "ok", action: "clear_discipline_context", message: "Контекст та історію очищено" }),
      };
    },
  },
  save_discipline_topics: {
    name: "save_discipline_topics",
    description: "Зберігає теми для дисципліни. Якщо встановлено контекст дисципліни (через set_discipline_context), використовує його. Інакше шукає дисципліну за назвою.",
    parameters: {
      topics: { type: "string", description: "JSON масив назв тем для збереження, напр.: [\"Тема 1\", \"Тема 2\"]" },
      query: { type: "string", description: "Назва дисципліни (необов'язково, якщо контекст встановлено)" },
    },
    required: ["topics"],
    execute: async (args, specialtyId, sessionId) => {
      let topicsArg = args.topics;
      let courseQuery = args.query as string | undefined;

      if (typeof topicsArg === "string") {
        try {
          topicsArg = JSON.parse(topicsArg);
        } catch {
          return {
            result: { action: "save_discipline_topics", status: "error", message: "Некоректний формат тем", addedTopics: [] },
            content: toToolContent({ status: "error", action: "save_discipline_topics", message: "Теми мають бути у форматі JSON масиву" }),
          };
        }
      }

      if (!Array.isArray(topicsArg) || topicsArg.length === 0) {
        return {
          result: { action: "save_discipline_topics", status: "error", message: "Порожній список тем", addedTopics: [] },
          content: toToolContent({ status: "error", action: "save_discipline_topics", message: "Відсутні теми для збереження" }),
        };
      }

      const topicNames = topicsArg.map((t: unknown) => String(t)).filter((t: string) => t.trim());

      let context = getSessionContext(sessionId);

      if (!context && courseQuery) {
        const normalizedQuery = normalizeText(courseQuery);
        const okNumber = extractOkNumber(courseQuery);
        const coursesList = await listCoursesBySpecialty(specialtyId);

        for (const course of coursesList) {
          const courseName = normalizeText(course.name);
          const courseOkNo = normalizeText(course.data?.ok_no ?? "");

          if (okNumber && courseOkNo === okNumber) {
            context = {
              courseId: course.id,
              courseName: course.name,
              okNo: course.data?.ok_no ?? null,
            };
            break;
          }
          if (courseName === normalizedQuery || courseName.includes(normalizedQuery)) {
            context = {
              courseId: course.id,
              courseName: course.name,
              okNo: course.data?.ok_no ?? null,
            };
            break;
          }
        }
      }

      if (!context) {
        return {
          result: { action: "save_discipline_topics", status: "error", message: "Контекст не встановлено", addedTopics: [] },
          content: toToolContent({
            status: "error",
            action: "save_discipline_topics",
            message: "Спочатку встановіть контекст дисципліни через set_discipline_context або вкажіть назву дисципліни",
          }),
        };
      }

      const existingTopics = await courseTopics.byCourseIds([context.courseId]);
      const existingNames = new Set(existingTopics.map(t => normalizeText(t.name)));

      const nextIndex = existingTopics.length > 0
        ? Math.max(...existingTopics.map(t => t.index)) + 1
        : 1;

      const addedTopics: string[] = [];
      let currentIndex = nextIndex;

      for (const topicName of topicNames) {
        const normalizedName = normalizeText(topicName);
        if (existingNames.has(normalizedName)) {
          continue;
        }

        const newTopic: CourseTopic = {
          id: 0,
          course_id: context.courseId,
          index: currentIndex++,
          name: topicName.trim(),
          lection: "",
          data: {
            attestation: 1,
            fulltime: { hours: 0, practical_hours: 0, srs_hours: 0 },
            inabscentia: { hours: 0, practical_hours: 0, srs_hours: 0 },
          },
          generated: {},
        };

        await courseTopics.add(newTopic);
        addedTopics.push(topicName);
        existingNames.add(normalizedName);
      }

      const status = addedTopics.length > 0 ? "ok" : "error";
      const message = addedTopics.length > 0
        ? `Додано теми: ${addedTopics.join(", ")}`
        : "Всі вказані теми вже існують або не знайдено";

      return {
        result: { action: "save_discipline_topics", status, message, addedTopics },
        content: toToolContent({
          status,
          action: "save_discipline_topics",
          message,
          addedTopics,
          context,
        }),
      };
    },
  },
};

const CHAT_COMPLETION_TOOLS: ChatCompletionTool[] = Object.values(TOOL_REGISTRY).map(toCompletionTool);

const SYSTEM_PROMPT =
  "Ти асистент, що аналізує навчальні плани. " +
  "Використовуй надані інструменти для пошуку інформації та відповідай українською. " +
  "Перед фінальною відповіддю ОБОВ'ЯЗКОВО виконай усі необхідні виклики інструментів. " +
  "Якщо інструмент повертає помилку або бракує параметрів, попроси користувача уточнити дані. " +
  "Ти також можеш працювати з темами дисциплін: спочатку встанови контекст дисципліни (set_discipline_context), " +
  "а потім додавай теми (save_discipline_topics).";

async function handleToolCall(
  name: string,
  rawArgs: Record<string, unknown>,
  specialtyId: number,
  sessionId: string,
): Promise<ToolExecutionResult> {
  const tool = TOOL_REGISTRY[name];

  if (!tool) {
    return {
      content: toToolContent({ status: "error", action: "clarify", message: `Невідомий інструмент: ${name}` }),
      data: { action: "clarify" },
      toolName: name,
      arguments: rawArgs,
    };
  }

  const { result, content } = await tool.execute(rawArgs, specialtyId, sessionId);

  return {
    content,
    data: result,
    toolName: name,
    arguments: rawArgs,
  };
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
  sessionId: string;
  message: string;
  apiKey: string | null;
  maxSteps?: number;
}): Promise<ChatToolConversationResult> {
  const client = createOpenAIClient(options.apiKey);
  const sessionHistory = getSessionHistory(options.sessionId);
  
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...sessionHistory.map(msg => ({ role: msg.role, content: msg.content })),
    { role: "user", content: options.message },
  ];

  let latestData: ChatToolData = { action: "clarify" };
  const toolHistory: ToolHistoryEntry[] = [];
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

        const toolResult = await handleToolCall(call.function.name, safeParseArguments(call.function.arguments), options.specialtyId, options.sessionId);
        latestData = toolResult.data;

        toolHistory.push({
          toolName: toolResult.toolName,
          arguments: toolResult.arguments,
          result: toolResult.data,
        });

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: toolResult.content,
        });
      }
      continue;
    }

    const reply = extractAssistantText(assistantMessage);
    
    addToSessionHistory(options.sessionId, "user", options.message);
    addToSessionHistory(options.sessionId, "assistant", reply);
    
    const context = getSessionContext(options.sessionId);
    return {
      reply: reply || "Вибачте, не вдалося згенерувати відповідь.",
      data: latestData,
      toolHistory,
      context,
    };
  }

  throw new Error("Перевищено ліміт кроків під час виклику інструментів");
}
