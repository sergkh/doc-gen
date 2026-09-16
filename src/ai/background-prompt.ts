import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import type { Course, CourseTopic, Prompt, PromptResult } from "@/stores/models";
import { createOpenAIClient, fixAItext } from "./common";
import { formatPrompt } from "./prompt";

type StartedPrompt = {
  responseId: string;
  status: "queued" | "generating";
  systemPrompt: string;
  userPrompt: string;
};

type PolledPrompt =
  | { status: "queued" | "generating" }
  | { status: "completed"; item: PromptResult["item"] }
  | { status: "error"; error: string };

function responseFormat(format: Prompt["format"]): z.ZodType<{ data: any }> {
  switch (format) {
    case "text": return z.object({ data: z.string() });
    case "list": return z.object({ data: z.array(z.string()) });
    case "quiz": return z.object({ data: z.array(z.object({ question: z.string(), options: z.array(z.string()), answerIndex: z.number() })) });
  }
}

function topicContext(course: Course, topic: CourseTopic, allTopics: CourseTopic[]): Record<string, unknown> {
  return {
    ...topic.generated ?? {},
    courseName: course.name,
    courseDescription: course.data.description ?? "",
    name: topic.name,
    lection: topic.lection || topic.name,
    topics: allTopics.map((current) => current.name).join('", "'),
    subtopics: topic.generated?.subtopics ?? "",
    course,
  };
}

function courseContext(course: Course, topics: CourseTopic[]): Record<string, unknown> {
  const sumHours = (selector: (topic: CourseTopic) => number | undefined) =>
    topics.reduce((total, topic) => total + (selector(topic) ?? 0), 0);

  return {
    ...course.generated ?? {},
    courseName: course.name,
    courseDescription: course.data.description ?? "",
    topics: topics.map((topic) => topic.name).join('", "'),
    subtopics: topics.flatMap((topic) => topic.generated?.subtopics || []).join(", "),
    course,
    hours: {
      total: course.data.hours,
      fulltime: {
        lectures: sumHours((topic) => topic.data.fulltime.hours),
        practicals: sumHours((topic) => topic.data.fulltime.practical_hours),
        srs: sumHours((topic) => topic.data.fulltime.srs_hours),
      },
      inabscentia: {
        lectures: sumHours((topic) => topic.data.inabscentia?.hours),
        practicals: sumHours((topic) => topic.data.inabscentia?.practical_hours),
        srs: sumHours((topic) => topic.data.inabscentia?.srs_hours),
      },
    },
  };
}

async function start(prompt: Prompt, context: Record<string, unknown>, apiKey?: string | null): Promise<StartedPrompt> {
  const systemPrompt = formatPrompt(prompt.system_prompt, context);
  const userPrompt = formatPrompt(prompt.prompt, context);
  const response = await createOpenAIClient(apiKey).responses.create({
    model: prompt.model,
    background: true,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    text: { format: zodTextFormat(responseFormat(prompt.format), "data") },
  });

  return {
    responseId: response.id,
    status: response.status === "queued" ? "queued" : "generating",
    systemPrompt,
    userPrompt,
  };
}

export function startCoursePrompt(prompt: Prompt, course: Course, topics: CourseTopic[], apiKey?: string | null) {
  return start(prompt, courseContext(course, topics), apiKey);
}

export function startTopicPrompt(prompt: Prompt, course: Course, topic: CourseTopic, allTopics: CourseTopic[], apiKey?: string | null) {
  return start(prompt, topicContext(course, topic, allTopics), apiKey);
}

export async function pollPromptResponse(responseId: string, format: Prompt["format"], apiKey?: string | null): Promise<PolledPrompt> {
  const response = await createOpenAIClient(apiKey).responses.retrieve(responseId);
  if (response.status === "completed") {
    try {
      const parsed = responseFormat(format).parse(JSON.parse(response.output_text));
      return { status: "completed", item: fixAItext(parsed.data) };
    } catch (error) {
      return { status: "error", error: `Не вдалося обробити відповідь моделі: ${error instanceof Error ? error.message : "невідомий формат"}` };
    }
  }
  if (response.status === "failed" || response.status === "cancelled" || response.status === "incomplete") {
    return { status: "error", error: response.error?.message ?? "Генерацію не завершено" };
  }
  return { status: response.status === "queued" ? "queued" : "generating" };
}
