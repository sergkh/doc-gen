import { z } from "zod";
import { extractInformationAI } from "./extractor";
import { getInternalPrompt } from "./internal-prompts";
import { formatPrompt } from "./prompt";
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
    const prompt = await getInternalPrompt("ai.topic_content_change");
    const decision = await extractInformationAI(
      formatPrompt(prompt.text, { before: JSON.stringify(before), after: JSON.stringify(after) }),
      "",
      topicChangeSchema,
      prompt.model,
    );

    return decision?.substantial === true;
  } catch (error) {
    // Generated content is valuable user data: an unavailable AI service must
    // never cause it to be discarded.
    console.warn("Could not classify course-topic content change; preserving generated data:", error);
    return false;
  }
}
