import { describe, expect, it } from "bun:test";
import type { CourseTopic } from "@/stores/models";
import { numberCoursePractices } from "@/stores/practices";

function topic(index: number, practices: unknown): CourseTopic {
  return {
    course_id: 1, index, name: `Topic ${index}`, lection: "", generated: {},
    data: { attestation: 1, practices } as CourseTopic["data"],
  };
}

describe("practice numbering", () => {
  it("numbers legacy and current practices across topics without detaching generated data", () => {
    const first = topic(1, ["Legacy", { name: "Detailed", description: "Task", generated: { steps: "Keep me" } }]);
    const second = topic(2, [{ name: "Later", description: "" }]);
    const numbered = numberCoursePractices([first, second]);
    expect(numbered.flatMap((item) => item.data.practices?.map((practice) => practice.index) ?? [])).toEqual([1, 2, 3]);
    expect(numbered[0]?.data.practices?.[0]).toEqual({ index: 1, name: "Legacy", description: "" });
    expect(numbered[0]?.data.practices?.[1]?.generated).toEqual({ steps: "Keep me" });

    const reordered = numberCoursePractices([second, first]);
    expect(reordered[1]?.data.practices?.[1]).toMatchObject({ index: 3, generated: { steps: "Keep me" } });
  });
});
