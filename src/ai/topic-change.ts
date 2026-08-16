import { z } from "zod";
import { extractInformationAI } from "./extractor";
import type { CourseTopic } from "@/stores/models";

const topicChangeSchema = z.object({
  substantial: z.boolean(),
});

type TopicContent = {
  name: string;
  lection: string;
  subtopics: string[];
};

function normalizedSubtopics(topic: CourseTopic): string[] {
  return (topic.generated?.subtopics ?? [])
    .map((subtopic) => subtopic.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

function contentOf(topic: CourseTopic): TopicContent {
  return {
    name: topic.name.trim().replace(/\s+/g, " "),
    lection: (topic.lection ?? "").trim().replace(/\s+/g, " "),
    subtopics: normalizedSubtopics(topic),
  };
}

function sameItems(left: string[], right: string[]): boolean {
  return left.length === right.length
    && [...left].sort().every((item, index) => item === [...right].sort()[index]);
}

/**
 * Identifies an unchanged topic independently of its mutable display index.
 * Used before any AI call so a topic move is never treated as a replacement.
 */
export function topicContentFingerprint(topic: CourseTopic): string {
  const content = contentOf(topic);
  return JSON.stringify({
    ...content,
    subtopics: [...content.subtopics].sort(),
  });
}

/**
 * Ask the model only when the topic's educational content changed. Pure
 * reordering of subtopics is deliberately ignored.
 */
export async function isTopicContentSubstantiallyChanged(
  previous: CourseTopic,
  next: CourseTopic,
): Promise<boolean> {
  const before = contentOf(previous);
  const after = contentOf(next);

  if (
    before.name === after.name
    && before.lection === after.lection
    && sameItems(before.subtopics, after.subtopics)
  ) {
    return false;
  }

  try {
    const decision = await extractInformationAI(
      "Ти оцінюєш зміни в темі університетської дисципліни. Визначай, чи змінився саме навчальний зміст теми настільки, що раніше згенеровані матеріали (план, ключові слова, питання тощо) більше не можна вважати актуальними. Не вважай суттєвими виправлення формулювання, скорочення, перестановку тих самих підтем або невеликі уточнення. Вважай суттєвими перехід до іншої предметної області, інший центральний метод/технологію чи значне оновлення переліку питань.",
      `Попередня тема:\n${JSON.stringify(before)}\n\nОновлена тема:\n${JSON.stringify(after)}`,
      topicChangeSchema,
    );

    return decision?.substantial === true;
  } catch (error) {
    // Generated content is valuable user data: an unavailable AI service must
    // never cause it to be discarded.
    console.warn("Could not classify course-topic content change; preserving generated data:", error);
    return false;
  }
}
