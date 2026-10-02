import { describe, expect, it, mock } from "bun:test";
import type { CourseTopic } from "@/stores/models";

mock.module("@/stores/db", () => ({
  courses: {}, courseResults: {}, teachers: {}, templates: {}, history: {},
}));

const { buildPracticalLessons } = await import("@/docx/transformations");

describe("practice document data", () => {
  it("exposes generated practice fields in the existing practice loop", () => {
    const topic = {
      index: 1, name: "Topic", generated: {},
      data: {
        practices: [{ index: 3, name: "Practice", description: "Short task", generated: { instructions: "Do this" } }],
        inabscentia: { practical_hours: 2 },
      },
    } as unknown as CourseTopic;
    expect(buildPracticalLessons([topic], 1)).toMatchObject([{
      no: 1, index: 3, name: "Practice", description: "Short task",
      generated: { instructions: "Do this" },
    }]);
  });
});
