import { describe, expect, it } from "bun:test";
import type { Course, Prompt, Template } from "@/stores/models";
import {
  applyTemplateFields,
  buildTemplateManifest,
  getFillableTemplateFields,
} from "@/services/template-fields-service";

function prompt(field: string, type: "course" | "topic" = "course", dependency?: string): Prompt {
  return {
    name: field,
    field,
    type,
    model: "test",
    format: "text",
    system_prompt: "Course: {{courseName}}",
    prompt: dependency ? `Use {{ ${dependency} }}` : `Fill ${field}`,
  };
}

function template(prompts: Prompt[]): Template {
  return { id: 7, name: "Test template", file: "test.docx", data: {}, prompts };
}

function course(): Course {
  return {
    id: 3,
    name: "Test course",
    teacher_id: 1,
    specialty_id: 1,
    version: 1,
    generated: {} as Course["generated"],
    data: { description: "Description" } as Course["data"],
    topics: [
      { course_id: 3, index: 1, name: "Topic 1", lection: "Topic 1", data: {} as any, generated: {} },
      { course_id: 3, index: 2, name: "Topic 2", lection: "Topic 2", data: {} as any, generated: {} },
    ],
  };
}

describe("template field manifest", () => {
  it("publishes dependencies parsed from prompt placeholders", () => {
    const manifest = buildTemplateManifest(template([
      prompt("summary"),
      prompt("objectives", "course", "summary"),
    ]));

    expect(manifest.generatedFields[1]?.dependsOn).toEqual([
      { field: "summary", scope: "course", relation: "single" },
    ]);
  });

  it("keeps unresolved placeholder dependencies visible so they cannot be bypassed", () => {
    const manifest = buildTemplateManifest(template([prompt("objectives", "course", "missingSummary")]));
    expect(manifest.generatedFields[0]?.dependsOn).toEqual([
      { field: "missingSummary", scope: "course", relation: "single" },
    ]);
  });

  it("parses dependencies from the system prompt, including generated fields with built-in names", () => {
    const dependent = prompt("outline");
    dependent.system_prompt = "Use {{ subtopics }}";
    const manifest = buildTemplateManifest(template([prompt("subtopics", "topic"), dependent]));
    expect(manifest.generatedFields[1]?.dependsOn).toEqual([
      { field: "subtopics", scope: "topic", relation: "all_topics" },
    ]);
  });

  it("parses the source field of a placeholder with map filters", () => {
    const dependent = prompt("summary");
    dependent.prompt = "Names: {{ items | map:name | join: \", \" }}";
    const manifest = buildTemplateManifest(template([
      { ...prompt("items"), format: "list" },
      dependent,
    ]));

    expect(manifest.generatedFields[1]?.dependsOn).toEqual([
      { field: "items", scope: "course", relation: "single" },
    ]);
  });
});

describe("applyTemplateFields", () => {
  it("blocks a field when its prerequisite is missing", () => {
    const result = applyTemplateFields(
      template([prompt("summary"), prompt("objectives", "course", "summary")]),
      course(),
      [{ field: "objectives", value: "Objectives" }],
    );

    expect(result.changed).toBe(false);
    expect(result.results[0]).toMatchObject({
      field: "objectives",
      status: "blocked",
      missingDependencies: ["course.summary"],
    });
  });

  it("orders fields inside a batch and accepts a dependent sent first", () => {
    const result = applyTemplateFields(
      template([prompt("summary"), prompt("objectives", "course", "summary")]),
      course(),
      [
        { field: "objectives", value: "Objectives" },
        { field: "summary", value: "Summary" },
      ],
    );

    expect(result.results.filter((item) => item.status === "accepted")).toHaveLength(2);
    expect(result.course.generated).toMatchObject({ summary: "Summary", objectives: "Objectives" });
  });

  it("enforces same-topic dependencies independently", () => {
    const result = applyTemplateFields(
      template([prompt("questions", "topic"), prompt("quizIntro", "topic", "questions")]),
      course(),
      [
        { field: "questions", topicIndex: 1, value: "Questions" },
        { field: "quizIntro", topicIndex: 1, value: "Intro" },
        { field: "quizIntro", topicIndex: 2, value: "Blocked" },
      ],
    );

    expect(result.results).toContainEqual(expect.objectContaining({ field: "quizIntro", topicIndex: 1, status: "accepted" }));
    expect(result.results).toContainEqual(expect.objectContaining({
      field: "quizIntro",
      topicIndex: 2,
      status: "blocked",
      missingDependencies: ["topic[2].questions"],
    }));
  });

  it("rejects values that do not match the declared format", () => {
    const listPrompt = { ...prompt("items"), format: "list" as const };
    const result = applyTemplateFields(template([listPrompt]), course(), [{ field: "items", value: "not a list" }]);
    expect(result.results[0]).toMatchObject({ field: "items", status: "invalid" });
  });

  it("returns only currently fillable fields", () => {
    const definition = template([prompt("summary"), prompt("objectives", "course", "summary")]);
    expect(getFillableTemplateFields(definition, course()).map((item) => item.field)).toEqual(["summary"]);
  });
});
