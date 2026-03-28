import type { AgentReply } from "@/ai/models";

export async function callAgentApi(
  specialtyId: number,
  message: string,
  sessionId: string | null,
  apiKey: string | null,
  model: string | null
): Promise<AgentReply> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  
  if (sessionId) {
    headers["X-Session-Id"] = sessionId;
  }

  const res = await fetch("/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({
      specialtyId: Number(specialtyId),
      message: message,
      apiKey: apiKey || undefined,
      model: model || undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const data = (await res.json()) as AgentReply;

  return data;
}
