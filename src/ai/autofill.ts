import { z } from "zod";
import { extractInformationAI } from "./extractor";
import type { CourseResult } from "@/stores/models.ts";

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
  disciplineName: string,
  description: string,
  topics: string[],
  model: string = "gpt-4o-mini",
  apiKey: string | null = null
): Promise<AutofillResults> {
  const systemPrompt = `Ти - експерт з аналізу освітніх програм для університетських дисциплін. 
Твоя задача - визначити, які з вказаних результатів навчання покриваються описаної дисципліною.

Для кожного результату навчання:
1. Оціни, наскільки дисципліна сприяє формуванню цього результату
2. Враховуй: назву дисципліни, опис, теми/модулі
3. Надай коротке обґрунтування чому ця дисципліна відповідає результату

Вибери ТІЛЬКИ ті результати, які ДІЙСНО формуються під час вивчення цієї дисципліни.`;

  const text = `Дисципліна: ${disciplineName}

Опис: ${description}

Теми/модулі: ${topics.join(", ")}

Доступні результати навчання:
${results.map(r => `[${r.id}] ${r.no}. ${r.name}`).join("\n")}

Для кожного результату, який відповідає цій дисципліні, надай ID та коротке обґрунтування.`;

  const response = await extractInformationAI(
    systemPrompt,
    text,
    autofillResultSchema,
    model,
    apiKey
  );

  return response?.matchedResults ?? [];
}
