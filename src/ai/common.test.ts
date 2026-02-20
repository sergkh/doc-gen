import { describe, it, expect } from "bun:test";
import { fixAItext } from "./common";

describe("fixAItext", () => {
  describe("text format (string)", () => {
    it("should replace em dashes with en dashes in string", () => {
      expect(fixAItext("Hello — World")).toBe("Hello – World");
    });

    it("should replace multiple em dashes", () => {
      expect(fixAItext("One — Two — Three")).toBe("One – Two – Three");
    });

    it("should return string without em dashes unchanged", () => {
      expect(fixAItext("Hello World")).toBe("Hello World");
    });

    it("should handle empty string", () => {
      expect(fixAItext("")).toBe("");
    });

    it("should handle Ukrainian text with em dashes", () => {
      expect(fixAItext("Курс — це навчальна програма")).toBe("Курс – це навчальна програма");
    });
  });

  describe("list format (array of strings)", () => {
    it("should replace em dashes in array of strings", () => {
      const input = ["Item — one", "Item — two", "Item — three"];
      const expected = ["Item – one", "Item – two", "Item – three"];
      expect(fixAItext(input)).toEqual(expected);
    });

    it("should handle empty array", () => {
      expect(fixAItext([])).toEqual([]);
    });

    it("should handle array with no em dashes", () => {
      const input = ["Item one", "Item two"];
      expect(fixAItext(input)).toEqual(input);
    });
  });

  describe("quiz format (array of objects)", () => {
    it("should replace em dashes in quiz question and options", () => {
      const input = [
        {
          question: "What is — AI?",
          options: ["Option — A", "Option — B", "Option — C"],
          answerIndex: 0
        }
      ];
      const expected = [
        {
          question: "What is – AI?",
          options: ["Option – A", "Option – B", "Option – C"],
          answerIndex: 0
        }
      ];
      expect(fixAItext(input)).toEqual(expected);
    });

    it("should handle multiple quiz questions", () => {
      const input = [
        {
          question: "Question — 1",
          options: ["A — 1", "B — 1"],
          answerIndex: 1
        },
        {
          question: "Question — 2",
          options: ["A — 2", "B — 2"],
          answerIndex: 0
        }
      ];
      const expected = [
        {
          question: "Question – 1",
          options: ["A – 1", "B – 1"],
          answerIndex: 1
        },
        {
          question: "Question – 2",
          options: ["A – 2", "B – 2"],
          answerIndex: 0
        }
      ];
      expect(fixAItext(input)).toEqual(expected);
    });

    it("should preserve number types in answerIndex", () => {
      const input = [
        {
          question: "Question",
          options: ["A", "B"],
          answerIndex: 2
        }
      ];
      expect(fixAItext(input)).toEqual(input);
    });
  });

  describe("nested objects", () => {
    it("should handle object with string properties", () => {
      const input = { description: "Course — description" };
      const expected = { description: "Course – description" };
      expect(fixAItext(input)).toEqual(expected);
    });

    it("should handle deeply nested objects", () => {
      const input = {
        course: {
          topic: {
            question: "Deep — nested"
          }
        }
      };
      const expected = {
        course: {
          topic: {
            question: "Deep – nested"
          }
        }
      };
      expect(fixAItext(input)).toEqual(expected);
    });

    it("should handle mixed nested structure with arrays", () => {
      const input = {
        name: "Course — Name",
        topics: ["Topic — 1", "Topic — 2"],
        quiz: [
          {
            question: "Q — 1",
            options: ["Opt — 1", "Opt — 2"],
            answerIndex: 0
          }
        ]
      };
      const expected = {
        name: "Course – Name",
        topics: ["Topic – 1", "Topic – 2"],
        quiz: [
          {
            question: "Q – 1",
            options: ["Opt – 1", "Opt – 2"],
            answerIndex: 0
          }
        ]
      };
      expect(fixAItext(input)).toEqual(expected);
    });
  });

  describe("non-string types", () => {
    it("should return numbers unchanged", () => {
      expect(fixAItext(42)).toBe(42);
    });

    it("should return null unchanged", () => {
      expect(fixAItext(null)).toBe(null);
    });

    it("should return undefined unchanged", () => {
      expect(fixAItext(undefined)).toBe(undefined);
    });

    it("should return booleans unchanged", () => {
      expect(fixAItext(true)).toBe(true);
      expect(fixAItext(false)).toBe(false);
    });

    it("should preserve number properties in objects", () => {
      const input = { count: 5, name: "Test — Name" };
      const expected = { count: 5, name: "Test – Name" };
      expect(fixAItext(input)).toEqual(expected);
    });
  });
});
