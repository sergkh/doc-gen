import { z } from "zod";
import { extractInformationAI } from "./extractor";
import { formatPrompt } from "./prompt";
import { getInternalPrompt } from "./internal-prompts";
import type { Course, CourseResult, CourseTopic } from "@/stores/models.ts";

const autofillResultSchema = z.object({
  matchedResults: z.array(z.object({
    id: z.number(),
    reason: z.string()
  }))
});

export type AutofillResult = {
  id: number,
  reason: string
};

export type AutofillResults = AutofillResult[];

export async function autofillCourseResults(
  results: CourseResult[],
  course: Course,
  model?: string,
  apiKey?: string
): Promise<AutofillResults> {
  const prompt = await getInternalPrompt("ai.course_results_autofill");
  const text = formatPrompt(prompt.text, {
    courseName: course.name,
    courseDescription: course.data.description || "",
    topicLines: (course.topics ?? []).map(t => `${t.index} ${t.name}. ${(t.generated.keywords || []).join(", ")}`).join("\n"),
    resultLines: results.map(r => `[${r.id}] ${r.no}. ${r.name}`).join("\n"),
  });

  const response = await extractInformationAI(
    text,
    "",
    autofillResultSchema,
    prompt.model ?? model ?? null,
    apiKey ?? null
  );

  return response?.matchedResults ?? [];
}

const generatedTopicsSchema = z.object({
  topics: z.array(z.object({
    name: z.string(),
    subtopics: z.array(z.string())
  }))
});

export type GeneratedTopic = {
  name: string,
  subtopics: string[]
};

const attestationRenameSchema = z.object({
  name: z.string()
});

const topicSubtopicsSchema = z.object({
  subtopics: z.array(z.string()),
});

const topicPracticesSchema = (count: number) => z.object({
  practices: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).length(count),
});

export function buildAttestationRenamePrompt(template: string, courseName: string, attestationIndex: number, topics: CourseTopic[]): string {
  const topicLines = topics.length > 0
    ? topics.map((topic) => {
        const keywords = (topic.generated?.keywords || []).filter(Boolean);
        const keywordText = keywords.length > 0 ? `; ключові слова: ${keywords.join(", ")}` : "";
        return `- ${topic.name}${keywordText}`;
      }).join("\n")
    : "Теми не вказані";

  return formatPrompt(template, { courseName, attestationIndex, topicLines });
}

export function normalizeAttestationName(name: string, fallback: string): string {
  const trimmed = name.replace(/^['"`]+|['"`]+$/g, "").trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\s+/g, " ").slice(0, 60);
}

export async function renameAttestationName(
  course: Course,
  attestationIndex: number,
  topics: CourseTopic[],
  model?: string,
  apiKey?: string
): Promise<string> {
  const definition = await getInternalPrompt("ai.attestation_name");
  const prompt = buildAttestationRenamePrompt(definition.text, course.name, attestationIndex, topics);
  const response = await extractInformationAI(
    prompt,
    "",
    attestationRenameSchema,
    definition.model ?? model ?? null,
    apiKey ?? null
  );

  const suggestedName = response?.name ?? "";
  return normalizeAttestationName(suggestedName, `Атестація ${attestationIndex}`);
}

export async function generateTopicSubtopics(
  course: Course,
  topic: Pick<CourseTopic, "name" | "lection">,
  model?: string,
  apiKey?: string,
): Promise<string[]> {
  const definition = await getInternalPrompt("ai.topic_subtopics");
  const response = await extractInformationAI(
    formatPrompt(definition.text, { courseName: course.name, courseDescription: course.data.description || "не вказано", topicName: topic.name, lection: topic.lection || "не вказано" }),
    "",
    topicSubtopicsSchema,
    definition.model ?? model ?? null,
    apiKey ?? null,
  );

  return (response?.subtopics ?? []).map((subtopic) => subtopic.trim()).filter(Boolean);
}

export async function generateTopicPractices(
  course: Course,
  topic: { name: string; subtopics: string[]; practicalHours: number },
  model?: string,
  apiKey?: string,
): Promise<Array<{ name: string; description: string }>> {
  const practiceCount = Math.floor(topic.practicalHours / 2);
  if (practiceCount === 0) return [];

  const definition = await getInternalPrompt("ai.topic_practices");
  const response = await extractInformationAI(
    formatPrompt(definition.text, { courseName: course.name, courseDescription: course.data.description || "не вказано", topicName: topic.name, subtopics: topic.subtopics.length > 0 ? topic.subtopics.join("; ") : "не вказано", practicalHours: topic.practicalHours, practiceCount }),
    "",
    topicPracticesSchema(practiceCount),
    definition.model ?? model ?? null,
    apiKey ?? null,
  );

  return (response?.practices ?? [])
    .map((practice) => ({ name: practice.name.trim(), description: practice.description.trim() }))
    .filter((practice) => practice.name && practice.description);
}

export async function generateCourseTopics(
  disciplineName: string,
  description: string,
  specialtyName: string,
  credits: number,
  model?: string,
  apiKey: string | null = null
): Promise<GeneratedTopic[]> {
  const prompt = await getInternalPrompt("ai.course_topics");
  const text = formatPrompt(prompt.text, { disciplineName, description, specialtyName, credits });

  const response = await extractInformationAI(
    text,
    "",
    generatedTopicsSchema,
    prompt.model ?? model ?? null,
    apiKey
  );

  return response?.topics ?? [];
}
