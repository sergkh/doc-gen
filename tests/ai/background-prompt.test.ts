import { describe, expect, it, mock } from "bun:test";
import type { Course, CoursePractice, CourseTopic, Prompt } from "@/stores/models";

const started = {
  field: "field",
  system_prompt: "System",
  prompt: "Prompt",
  item: "Result",
};
const mockRunCoursePrompts = mock(async () => [started]);
const mockRunTopicPrompts = mock(async () => [started]);
const mockRunPracticePrompts = mock(async () => [started]);

mock.module("@/ai/generator", () => ({
  runCoursePrompts: mockRunCoursePrompts,
  runTopicPrompts: mockRunTopicPrompts,
  runPracticePrompts: mockRunPracticePrompts,
}));

const {
  startCoursePrompt,
  startTopicPrompt,
  startPracticePrompt,
} = await import("@/ai/background-prompt");

describe("background prompt starters", () => {
  it("routes every starter through the corresponding run*Prompts method", async () => {
    const prompt = {
      name: "Test prompt",
      type: "course",
      field: "field",
      model: "test",
      format: "text",
      system_prompt: "System",
      prompt: "Prompt",
    } as Prompt;
    const course = {} as Course;
    const topic = { index: 1 } as CourseTopic;
    const practice = { index: 1, name: "Practice", description: "" } as CoursePractice;
    const topics = [topic];

    await startCoursePrompt(prompt, course, topics);
    await startTopicPrompt(prompt, course, topic, topics);
    await startPracticePrompt(prompt, course, topic, practice, topics);

    expect(mockRunCoursePrompts).toHaveBeenCalledWith([prompt], course, topics, null, true);
    expect(mockRunTopicPrompts).toHaveBeenCalledWith([prompt], course, topic, topics, null, true);
    expect(mockRunPracticePrompts).toHaveBeenCalledWith([prompt], course, topic, practice, topics, null, true);
  });
});
