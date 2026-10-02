import { describe, expect, it, mock } from "bun:test";
import type { Course, CourseTopicData, Template } from "@/stores/models";

let saved: Course;
const parse = mock(async () => ({ output_parsed: { data: "New instructions" } }));

mock.module("@/stores/db", () => ({
  courses: {
    get: async () => saved,
    update: async (course: Course) => { saved = course; return [course]; },
  },
  history: { saveHistory: async () => undefined },
}));

mock.module("@/ai/common", () => ({
  createOpenAIClient: () => ({ responses: { parse } }),
  fixAItext: (value: unknown) => value,
  retryWithBackoff: (run: () => Promise<unknown>) => run(),
}));

const { generateCourseInfo } = await import("@/ai/generator");

describe("practice generation", () => {
  it("runs the practice prompt for each missing practice value and saves it under that practice", async () => {
    parse.mockClear();
    saved = {
      id: 1, version: 1, name: "Course", teacher_id: 1, specialty_id: 1,
      data: { description: "Course description" } as Course["data"], generated: {} as Course["generated"],
      topics: [{
        course_id: 1, index: 1, name: "Topic", lection: "Lecture", generated: {},
        data: { attestation: 1, practices: [
          { name: "First", description: "Task" },
          { name: "Second", description: "Task", generated: { instructions: "Keep this" } },
        ] } as CourseTopicData,
      }],
    };
    const template: Template = {
      id: 1, name: "Template", file: "template.docx", data: {}, prompts: [{
        name: "Instructions", type: "practice", field: "instructions", model: "test", format: "text",
        system_prompt: "For {{courseName}}", prompt: "Write for {{name}} in {{topicName}}: {{description}}",
      }],
    };
    const progress: number[] = [];
    const result = await generateCourseInfo(template, saved, saved.topics!, (value) => progress.push(value));

    expect(parse).toHaveBeenCalledTimes(1);
    expect(result.topics[0]?.data.practices).toMatchObject([
      { index: 1, generated: { instructions: "New instructions" } },
      { index: 2, generated: { instructions: "Keep this" } },
    ]);
    expect(progress.at(-1)).toBe(100);
  });
});
