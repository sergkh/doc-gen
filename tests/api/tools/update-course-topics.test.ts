import { describe, expect, it } from "bun:test";
await import("../../stores/db-mock");
const { UpdateCourseTopicsInput } = await import("@/api/tools/update-course-topics");

const topic = {
  name: "Cryptographic foundations",
  lection: "Hash functions and signatures",
  index: 1,
  data: {
    attestation: 1,
    practices: [
      {
        name: "Merkle tree",
        description: "Build a Merkle tree and verify an inclusion proof.",
      },
    ],
    fulltime: {
      hours: 2,
      practical_hours: 2,
      lab_hours: 0,
      srs_hours: 6,
    },
  },
  generated: {
    subtopics: [],
    keywords: [],
    lection_plan: [],
  },
};

describe("update_course_topics input", () => {
  it("accepts practice objects with a short description", () => {
    const result = UpdateCourseTopicsInput.safeParse({
      attestations: [{ name: "Module 1" }, { name: "Module 2" }],
      topics: [topic],
    });

    expect(result.success).toBe(true);
    expect(result.data?.topics[0]?.data.practices).toEqual(topic.data.practices);
  });

  it("rejects the legacy list of practice strings", () => {
    const result = UpdateCourseTopicsInput.safeParse({
      attestations: [{ name: "Module 1" }, { name: "Module 2" }],
      topics: [
        {
          ...topic,
          data: {
            ...topic.data,
            practices: ["Merkle tree"],
          },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("allows an empty description for each practice", () => {
    const result = UpdateCourseTopicsInput.safeParse({
      attestations: [{ name: "Module 1" }, { name: "Module 2" }],
      topics: [
        {
          ...topic,
          data: {
            ...topic.data,
            practices: [{ name: "Merkle tree", description: "" }],
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.topics[0]?.data.practices).toEqual([
      { name: "Merkle tree", description: "" },
    ]);
  });

  it("defaults an omitted practice description to an empty string", () => {
    const result = UpdateCourseTopicsInput.safeParse({
      attestations: [{ name: "Module 1" }, { name: "Module 2" }],
      topics: [
        {
          ...topic,
          data: {
            ...topic.data,
            practices: [{ name: "Merkle tree" }],
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.topics[0]?.data.practices).toEqual([
      { name: "Merkle tree", description: "" },
    ]);
  });

  it("allows practices to be omitted when an existing topic is not changing them", () => {
    const { practices: _practices, ...dataWithoutPractices } = topic.data;
    const result = UpdateCourseTopicsInput.safeParse({
      attestations: [{ name: "Module 1" }, { name: "Module 2" }],
      topics: [
        {
          ...topic,
          data: dataWithoutPractices,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.topics[0]?.data.practices).toBeUndefined();
  });
});
