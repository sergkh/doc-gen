import type { MemorySession } from "@openai/agents";

export const AVAILABLE_MODELS = [
  { id: "gpt-4o", name: "GPT-4O" },
  { id: "gpt-4o-mini", name: "GPT-4O Mini" },
  { id: "o1-mini", name: "O1 Mini" },
  { id: "gpt-5-2025-08-07", name: "GPT-5" },
  { id: "gpt-5-mini-2025-08-07", name: "GPT-5-mini" },
];

export type AgentContext = {
  session: MemorySession,
  discipline: DisciplineContext | null,
  pendingRunStates: Map<string, string>
}

export type DisciplineContext = {
  courseId: number;
  courseName: string;
  okNo: string | null;
};

export type ToolResult = {
  name: string;
  status: 'in_progress' | 'complete' | 'incomplete';
  output: any;
};

export type UserInputRequest = {
  kind: "approval";
  approvalId: string;
  question: string;
  options: ["approve", "reject"];
};

export type AgentReply = {
  reply: string;
  requiresUserInput?: UserInputRequest | null;
  context: {
    sessionId: string,
    discipline: DisciplineContext | null;
  },
  tools: Array<ToolResult>
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type DisciplineSearchItem = {
  courseId: number;
  courseName: string;
  okNo: string | null;
  teacher: string | null;
};

export const DEFAULT_AGENT_MODEL = "gpt-4o-mini";
