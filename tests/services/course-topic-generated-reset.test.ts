import { beforeEach, describe, expect, it, mock } from "bun:test";

const course = {
  id: 1,
  version: 4,
  name: "Аналіз даних",
  teacher_id: 1,
  specialty_id: 1,
  generated: {},
  data: {},
  topics: [{
    course_id: 1,
    index: 1,
    name: "Вступ до аналізу даних",
    lection: "Типи даних і очищення",
    data: { attestation: 1, fulltime: { hours: 2, practical_hours: 0, lab_hours: 0, srs_hours: 0 } },
    generated: { subtopics: ["Типи даних"], keywords: ["дані"], lection_plan: ["Вступ"] },
  }],
};

const update = mock(async () => [{}]);
const saveHistory = mock(async () => undefined);
const isTopicContentSubstantiallyChanged = mock(async () => true);
const topicContentFingerprint = (topic: typeof course.topics[number]) => JSON.stringify({
  name: topic.name,
  lection: topic.lection,
  subtopics: [...(topic.generated?.subtopics ?? [])].sort(),
});
let courseToLoad = course;

mock.module("@/stores/db", () => ({
  courses: {
    get: async () => courseToLoad,
    update,
    all: async () => [],
    brief: async () => [],
    bySpecialty: async () => [],
    bySpecialtyBrief: async () => [],
    add: async () => [{ id: 1 }],
    findByName: async () => null,
    delete: async () => undefined,
  },
  history: { save: mock(async () => undefined), saveHistory, createTombstone: mock(async () => undefined) },
  teachers: { get: async () => null, add: async () => [{ id: 1 }], update: async () => undefined },
}));
mock.module("@/ai/topic-change", () => ({ isTopicContentSubstantiallyChanged, topicContentFingerprint }));
mock.module("@/docx/parse", () => ({ parseSylabusOrProgram: mock(async () => null) }));
mock.module("@/docx/verification", () => ({ verifyCourse: mock(() => ({ issues: [] })) }));
mock.module("@/ai/generator", () => ({ runCoursePrompts: mock(async () => []) }));

const { coursesService } = await import("@/services/courses-service");

describe("course topic generated data reset", () => {
  beforeEach(() => {
    courseToLoad = course;
    update.mockClear();
    saveHistory.mockClear();
    isTopicContentSubstantiallyChanged.mockClear();
  });

  it("keeps generated subtopics when topics are only reordered", async () => {
    const secondTopic = {
      ...course.topics[0]!,
      index: 2,
      name: "Візуалізація даних",
      lection: "Графіки та діаграми",
      generated: { subtopics: ["Типи графіків"], keywords: ["графіки"] },
    };
    const courseWithTwoTopics = { ...course, topics: [course.topics[0]!, secondTopic] };
    courseToLoad = courseWithTwoTopics;

    const updated = await coursesService.updateCourse(1, {
      ...courseWithTwoTopics,
      topics: [
        { ...secondTopic, index: 1 },
        { ...course.topics[0]!, index: 2 },
      ],
    } as any, "Updated by user");

    expect(isTopicContentSubstantiallyChanged).not.toHaveBeenCalled();
    expect(updated.topics?.map((topic) => topic.generated.subtopics)).toEqual([
      ["Типи графіків"],
      ["Типи даних"],
    ]);
    courseToLoad = course;
  });

  it("clears every generated field only when AI classifies the content change as substantial", async () => {
    const updated = await coursesService.updateCourse(1, {
      ...course,
      topics: [{ ...course.topics[0]!, name: "Нейронні мережі для класифікації" }],
    } as any, "Updated by user");

    expect(isTopicContentSubstantiallyChanged).toHaveBeenCalledTimes(1);
    expect(updated.topics?.[0]?.generated).toEqual({});
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      topics: [expect.objectContaining({ generated: {} })],
    }));
    expect(saveHistory).toHaveBeenCalledTimes(1);
  });

  it("keeps generated fields when AI classifies the change as minor", async () => {
    isTopicContentSubstantiallyChanged.mockResolvedValueOnce(false);

    const updated = await coursesService.updateCourse(1, {
      ...course,
      topics: [{ ...course.topics[0]!, name: "Вступ до аналізу даних: уточнено" }],
    } as any, "Updated by user");

    expect(updated.topics?.[0]?.generated).toEqual(course.topics[0]?.generated);
  });
});
