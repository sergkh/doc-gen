import { z } from "zod";
import { extractInformationAI } from "./extractor";
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
  model: string = "gpt-5-2025-08-07",
  apiKey?: string
): Promise<AutofillResults> {
  const systemPrompt = `Ти - експерт з аналізу освітніх програм для університетських дисциплін. 
Твоя задача - визначити, які з вказаних результатів навчання покриваються описаної дисципліною.

Для кожного результату навчання:
1. Оціни, наскільки дисципліна сприяє формуванню цього результату
2. Враховуй: назву дисципліни, опис, теми/модулі, ключові слова.
3. Надай коротке обґрунтування чому ця дисципліна відповідає результату

Вибери ТІЛЬКИ ті результати, які ДІЙСНО формуються під час вивчення цієї дисципліни.`;

  const text = `Дисципліна: ${course.name}

Опис: ${course.data.description || ""}

Теми/модулі: ${course.topics!.map(t => `${t.index} ${t.name}. ${(t.generated.keywords || []).join(", ")}`).join("\n")}

Доступні результати навчання:
${results.map(r => `[${r.id}] ${r.no}. ${r.name}`).join("\n")}

Для кожного результату, який відповідає цій дисципліні, надай ID та коротке обґрунтування.`;

  const response = await extractInformationAI(
    systemPrompt,
    text,
    autofillResultSchema,
    model,
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

export function buildAttestationRenamePrompt(courseName: string, attestationIndex: number, topics: CourseTopic[]): string {
  const topicLines = topics.length > 0
    ? topics.map((topic) => {
        const keywords = (topic.generated?.keywords || []).filter(Boolean);
        const keywordText = keywords.length > 0 ? `; ключові слова: ${keywords.join(", ")}` : "";
        return `- ${topic.name}${keywordText}`;
      }).join("\n")
    : "Теми не вказані";

  return `Ти - експерт з розробки освітніх програм для університетських дисциплін.
Твоя задача - придумати коротку, узагальнюючу назву атестації за темами дисципліни.

Дисципліна: ${courseName}
Атестація №${attestationIndex}

Тематика цієї атестації:
${topicLines}

Завдання: на основі наведених тем і ключових слів придумай одну коротку назву українською мовою, яка узагальнює весь зміст атестації. Назва має бути максимально короткою (2–4 слова), загальною, але зрозумілою. Відповідай без пояснень і без лапок.`;
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
  model: string = "gpt-5-2025-08-07",
  apiKey?: string
): Promise<string> {
  const prompt = buildAttestationRenamePrompt(course.name, attestationIndex, topics);
  const response = await extractInformationAI(
    "Ти допомагаєш створювати назви освітніх атестацій для навчальних дисциплін.",
    prompt,
    attestationRenameSchema,
    model,
    apiKey ?? null
  );

  const suggestedName = response?.name ?? "";
  return normalizeAttestationName(suggestedName, `Атестація ${attestationIndex}`);
}

export async function generateTopicSubtopics(
  course: Course,
  topic: Pick<CourseTopic, "name" | "lection">,
  model: string = "gpt-5-2025-08-07",
  apiKey?: string,
): Promise<string[]> {
  const response = await extractInformationAI(
    "Ти допомагаєш створювати зміст університетської навчальної дисципліни українською мовою.",
    `Дисципліна: ${course.name}
Опис дисципліни: ${course.data.description || "не вказано"}

Тема: ${topic.name}
Текст лекції: ${topic.lection || "не вказано"}

Запропонуй 2–5 стислих підтем для цієї теми. Підтеми мають конкретизувати тему, не дублювати її назву та бути придатними для навчальної програми.`,
    topicSubtopicsSchema,
    model,
    apiKey ?? null,
  );

  return (response?.subtopics ?? []).map((subtopic) => subtopic.trim()).filter(Boolean);
}

export async function generateCourseTopics(
  disciplineName: string,
  description: string,
  specialtyName: string,
  credits: number,
  model: string = "gpt-4o-mini",
  apiKey: string | null = null
): Promise<GeneratedTopic[]> {
  const systemPrompt = `Ти - експерт з розробки освітніх програм для університетських дисциплін.
Твоя задача - створити список тем для навчальної дисципліни.

Правила:
1. Кількість тем має відповідати кількості кредитів (приблизно 3-4 теми на 1 кредит)
2. Кожна тема має мати 2-4 підтеми
3. Теми мають охоплювати весь зміст дисципліни
4. Теми мають бути логічно пов'язані між собою
5. Враховуй спеціальність, для якої читається дисципліна
6. Назви тем мають бути короткими та інформативними`;

  const text = `Дисципліна: ${disciplineName}

Опис: ${description}

Спеціальність: ${specialtyName}

Кількість кредитів: ${credits}

Згенеруй список тем та підтем для цієї дисципліни.`;

  const response = await extractInformationAI(
    systemPrompt,
    text,
    generatedTopicsSchema,
    model,
    apiKey
  );

  return response?.topics ?? [];
}
