import { describe, expect, it, mock } from "bun:test";

const extractInformationAI = mock(async () => ({ substantial: true }));
mock.module("@/ai/extractor", () => ({ extractInformationAI }));

const { isTopicContentSubstantiallyChanged } = await import("@/ai/topic-change");

const topic = (overrides: Record<string, unknown> = {}) => ({
  course_id: 1,
  index: 1,
  name: "Основи аналізу даних",
  lection: "Дані, типи змінних і підготовка набору даних",
  data: { attestation: 1, fulltime: { hours: 2, practical_hours: 0, lab_hours: 0, srs_hours: 0 } },
  generated: { subtopics: ["Типи даних", "Очищення даних"], keywords: ["дані"] },
  ...overrides,
});

describe("isTopicContentSubstantiallyChanged", () => {
  it("does not spend an AI request on a subtopic reorder", async () => {
    const result = await isTopicContentSubstantiallyChanged(
      topic() as any,
      topic({ generated: { subtopics: ["Очищення даних", "Типи даних"], keywords: ["дані"] } }) as any,
    );

    expect(result).toBe(false);
    expect(extractInformationAI).not.toHaveBeenCalled();
  });

  it("uses the model decision for a semantic topic change", async () => {
    const result = await isTopicContentSubstantiallyChanged(
      topic() as any,
      topic({ name: "Нейронні мережі для класифікації" }) as any,
    );

    expect(result).toBe(true);
    expect(extractInformationAI).toHaveBeenCalledTimes(1);
  });
});
