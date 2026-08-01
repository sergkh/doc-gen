import { describe, expect, it } from "bun:test";
import {
  formatCourseChangeValue,
  formatCourseFieldPath,
  formatSpecialtyFieldPath,
  getCourseFieldChanges,
} from "@/client/pages/courseHistory.utils";

describe("getCourseFieldChanges", () => {
  it("extracts nested old and new field values", () => {
    expect(getCourseFieldChanges({
      name: ["Old name", "New name"],
      data: {
        description: ["Old description", "New description"],
        credits: [3, 4],
      },
    })).toEqual([
      { path: "name", kind: "modified", before: "Old name", after: "New name" },
      { path: "data.description", kind: "modified", before: "Old description", after: "New description" },
      { path: "data.credits", kind: "modified", before: 3, after: 4 },
    ]);
  });

  it("extracts array additions, removals, and moves using one-based positions", () => {
    expect(getCourseFieldChanges({
      data: {
        prerequisites: {
          _t: "a",
          _0: ["First", 0, 0],
          _1: ["", 2, 3],
          1: ["Added"],
        },
      },
    })).toEqual([
      { path: "data.prerequisites[1]", kind: "removed", before: "First" },
      { path: "data.prerequisites[2]", kind: "moved", before: 2, after: 3 },
      { path: "data.prerequisites[2]", kind: "added", after: "Added" },
    ]);
  });
});

describe("course history formatting", () => {
  it("formats nested paths and values for display", () => {
    expect(formatCourseFieldPath("topics[1].data.practices[2].name"))
      .toBe("Теми › № 1 › Дані курсу › Практичні роботи › № 2 › Назва");
    expect(formatCourseChangeValue(false)).toBe("Ні");
    expect(formatCourseChangeValue(null)).toBe("—");
    expect(formatCourseChangeValue({ hours: 2 })).toBe('{\n  "hours": 2\n}');
    expect(formatSpecialtyFieldPath("data.disciplines[1].control_type"))
      .toBe("Дані спеціальності › Дисципліни › № 1 › Форма контролю");
    expect(formatCourseFieldPath("generated.programGoal"))
      .toBe("Згенеровані матеріали › Мета програми");
  });
});
