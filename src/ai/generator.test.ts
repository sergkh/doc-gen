import { describe, it, expect } from "bun:test";
import { formatPrompt } from "./generator";

describe("formatPrompt", () => {
  describe("basic functionality", () => {
    it("should return empty string as-is", () => {
      expect(formatPrompt("", { name: "test" })).toBe("");
    });

    it("should return null as-is", () => {
      expect(formatPrompt(null as any, {})).toBe(null);
    });

    it("should return undefined as-is", () => {
      expect(formatPrompt(undefined as any, {})).toBe(undefined);
    });

    it("should return template without placeholders unchanged", () => {
      const template = "Hello world, no placeholders here";
      expect(formatPrompt(template, { name: "test" })).toBe(template);
    });
  });

  describe("single placeholder", () => {
    it("should replace single placeholder", () => {
      expect(formatPrompt("Hello {{name}}!", { name: "World" })).toBe("Hello World!");
    });

    it("should replace placeholder with number", () => {
      expect(formatPrompt("Count: {{count}}", { count: 42 })).toBe("Count: 42");
    });

    it("should trim whitespace in placeholder key", () => {
      expect(formatPrompt("Hello {{ name }}!", { name: "World" })).toBe("Hello World!");
    });

    it("should handle multiple occurrences of same placeholder", () => {
      expect(
        formatPrompt("{{name}} says: Hello {{name}}!", { name: "Alice" })
      ).toBe("Alice says: Hello Alice!");
    });
  });

  describe("multiple placeholders", () => {
    it("should replace multiple different placeholders", () => {
      expect(
        formatPrompt("{{greeting}} {{name}}!", { greeting: "Hello", name: "World" })
      ).toBe("Hello World!");
    });

    it("should handle placeholders with surrounding text", () => {
      expect(
        formatPrompt("The {{animal}} jumped over the {{object}}", { 
          animal: "fox", 
          object: "fence" 
        })
      ).toBe("The fox jumped over the fence");
    });
  });

  describe("nested path access", () => {
    it("should access nested object properties", () => {
      expect(
        formatPrompt("User: {{user.name}}", { user: { name: "Alice" } })
      ).toBe("User: Alice");
    });

    it("should access deeply nested properties", () => {
      expect(
        formatPrompt("City: {{user.address.city}}", { 
          user: { address: { city: "Kyiv" } } 
        })
      ).toBe("City: Kyiv");
    });

    it("should access array elements by index", () => {
      expect(
        formatPrompt("First: {{items.0}}", { items: ["a", "b", "c"] })
      ).toBe("First: a");
    });

    it("should handle mixed nested access", () => {
      expect(
        formatPrompt("{{course.topics.0.name}}", { 
          course: { topics: [{ name: "Introduction" }] } 
        })
      ).toBe("Introduction");
    });
  });

  describe("error handling", () => {
    it("should throw error for missing key", () => {
      expect(() => formatPrompt("Hello {{name}}!", {})).toThrow("Missing dependency: name");
    });

    it("should throw error for missing nested key", () => {
      expect(() => 
        formatPrompt("User: {{user.name}}", { user: {} })
      ).toThrow("Missing dependency: user.name");
    });

    it("should throw error for undefined nested parent", () => {
      expect(() => 
        formatPrompt("{{user.name}}", {})
      ).toThrow("Missing dependency: user.name");
    });
  });

  describe("real-world use cases", () => {
    it("should format course prompt with course name", () => {
      const template = "Курс: {{courseName}}\nОпис: {{courseDescription}}";
      const data = {
        courseName: "Інтелектуальний аналіз даних",
        courseDescription: "Вивчення методів data mining"
      };
      expect(formatPrompt(template, data)).toBe(
        "Курс: Інтелектуальний аналіз даних\nОпис: Вивчення методів data mining"
      );
    });

    it("should format topic prompt with nested course data", () => {
      const template = "Тема: {{name}}\nКурс: {{courseName}}\nПідтеми: {{subtopics}}";
      const data = {
        name: "Машинне навчання",
        courseName: "Штучний інтелект",
        subtopics: "регресія, класифікація, кластеризація"
      };
      expect(formatPrompt(template, data)).toBe(
        "Тема: Машинне навчання\nКурс: Штучний інтелект\nПідтеми: регресія, класифікація, кластеризація"
      );
    });

    it("should handle Ukrainian text correctly", () => {
      const template = "Дисципліна: {{discipline}} викладає {{teacher}}";
      const data = {
        discipline: "Комп'ютерні науки",
        teacher: "доцент Петренко О.І."
      };
      expect(formatPrompt(template, data)).toBe(
        "Дисципліна: Комп'ютерні науки викладає доцент Петренко О.І."
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty placeholder", () => {
      expect(formatPrompt("Hello {{}}!", { "": "World" })).toBe("Hello World!");
    });

    it("should handle placeholder at start and end", () => {
      expect(formatPrompt("{{start}}middle{{end}}", { start: "A", end: "Z" })).toBe("AmiddleZ");
    });

    it("should handle adjacent placeholders", () => {
      expect(formatPrompt("{{a}}{{b}}", { a: "Hello", b: "World" })).toBe("HelloWorld");
    });

    it("should handle special characters in values", () => {
      expect(
        formatPrompt("Path: {{path}}", { path: "/usr/local/bin" })
      ).toBe("Path: /usr/local/bin");
    });

    it("should handle newlines in values", () => {
      expect(
        formatPrompt("List:\n{{items}}", { items: "item1\nitem2\nitem3" })
      ).toBe("List:\nitem1\nitem2\nitem3");
    });

    it("should handle boolean values", () => {
      expect(formatPrompt("Active: {{active}}", { active: true })).toBe("Active: true");
    });

    it("should handle null values in data", () => {
      expect(formatPrompt("Value: {{val}}", { val: null })).toBe("Value: null");
    });
  });
});
