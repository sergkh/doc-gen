import { describe, expect, it } from "bun:test";
import {
  filterPromptVariables,
  findOpenPlaceholder,
  insertPromptVariable,
  type PromptVariable,
} from "@/client/util/prompt-autocomplete";

const variables: PromptVariable[] = [
  { value: "courseName", source: "course" },
  { value: "course.data.credits", label: "Credits", source: "course" },
  { value: "summary", label: "Course summary", source: "ai" },
];

describe("prompt placeholder autocomplete", () => {
  it("detects an unfinished placeholder at the cursor", () => {
    expect(findOpenPlaceholder("Use {{ cour", 11)).toEqual({ start: 4, end: 11, query: "cour" });
    expect(findOpenPlaceholder("Use {{courseName}}", 18)).toBeNull();
  });

  it("inserts the selected variable and places the cursor after it", () => {
    const match = findOpenPlaceholder("Use {{ sum later", 10)!;
    expect(insertPromptVariable("Use {{ sum later", match, "summary")).toEqual({
      value: "Use {{summary}} later",
      cursor: 15,
    });
  });

  it("filters by field path or human-readable label", () => {
    expect(filterPromptVariables(variables, "credits").map((item) => item.value)).toEqual(["course.data.credits"]);
    expect(filterPromptVariables(variables, "summary").map((item) => item.value)).toEqual(["summary"]);
  });

  it("removes duplicate variable suggestions", () => {
    expect(filterPromptVariables([...variables, variables[0]!], "courseName")).toHaveLength(1);
  });
});
