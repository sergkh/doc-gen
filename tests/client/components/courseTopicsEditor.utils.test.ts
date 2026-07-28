import { describe, it, expect } from "bun:test";
import type { CourseTopic } from "@/stores/models";
import type { AIGeneratedTopic } from "@/client/courses";
import {
  addGeneratedTopicsToCourseTopics,
  normalizeCoursePractices,
} from "@/client/components/courseTopicsEditor.utils";

describe("addGeneratedTopicsToCourseTopics", () => {
  it("adds all generated topics in one batch and preserves their order", () => {
    const existingTopics = [
      {
        course_id: 1,
        index: 1,
        name: "Existing topic",
        lection: "",
        data: {
          attestation: 1,
          fulltime: { hours: 2, practical_hours: 0, lab_hours: 0, srs_hours: 0 },
          inabscentia: { hours: 0, practical_hours: 0, lab_hours: 0, srs_hours: 0 },
        },
        generated: {},
      },
    ] as CourseTopic[];

    const generatedTopics = [
      { name: "Generated topic 2", subtopics: ["A"] },
      { name: "Generated topic 3", subtopics: ["B"] },
    ] as AIGeneratedTopic[];

    const result = addGeneratedTopicsToCourseTopics({
      topics: existingTopics,
      generatedTopics,
      courseId: 1,
    });

    expect(result.topics.map((topic) => topic.name)).toEqual(["Existing topic", "Generated topic 2", "Generated topic 3"]);
    expect(result.remainingGeneratedTopics).toEqual([]);
    expect(result.topics[1].index).toBe(2);
    expect(result.topics[2].index).toBe(3);
    expect(result.topics[1].data.practices).toEqual([]);
  });
});

describe("normalizeCoursePractices", () => {
  it("keeps practice objects for editing", () => {
    expect(normalizeCoursePractices([
      { name: "Merkle tree", description: "Build and verify an inclusion proof." },
    ])).toEqual([
      { name: "Merkle tree", description: "Build and verify an inclusion proof." },
    ]);
  });

  it("converts legacy strings and ignores invalid entries", () => {
    expect(normalizeCoursePractices([
      " Legacy practice ",
      "",
      null,
      { name: "Object practice" },
    ])).toEqual([
      { name: "Legacy practice", description: "" },
      { name: "Object practice", description: "" },
    ]);
  });
});
