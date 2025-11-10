// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { parseOPPResults, parseOPP, parseSpecialtyAndArea } from "./parse";

describe("parseOPPResults", () => {
  describe("ЗК (General Competencies)", () => {
    it("should parse ЗК results with period", () => {
      const text = "ЗК1. Здатність до абстрактного мислення, аналізу та синтезу.";
      const results = parseOPPResults(text, "ЗК");
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: -1,
        no: 1,
        type: "ЗК",
        name: "Здатність до абстрактного мислення, аналізу та синтезу",
      });
    });

    it("should parse multiple ЗК results on same line", () => {
      const text = "ЗК1. Здатність до абстрактного мислення, аналізу та синтезу. ЗК2. Здатність застосовувати знання у практичних ситуаціях.";
      const results = parseOPPResults(text, "ЗК");
      
      expect(results).toHaveLength(2);
      expect(results[0].no).toBe(1);
      expect(results[0].name).toBe("Здатність до абстрактного мислення, аналізу та синтезу");
      expect(results[1].no).toBe(2);
      expect(results[1].name).toBe("Здатність застосовувати знання у практичних ситуаціях");
    });

    it("should parse ЗК results across multiple lines", () => {
      const text = "ЗК1. Здатність до абстрактного мислення,\nаналізу та синтезу.\n\nЗК2. Інший результат.";
      const results = parseOPPResults(text, "ЗК");
      
      expect(results).toHaveLength(2);
      expect(results[0].no).toBe(1);
      expect(results[0].name).toContain("Здатність до абстрактного мислення");
      expect(results[1].no).toBe(2);
    });

  });

  describe("СК (Special Competencies)", () => {
    it("should parse СК results", () => {
      const text = "СК1. Здатність до математичного формулювання та досліджування неперервних та дискретних математичних моделей.";
      const results = parseOPPResults(text, "СК");
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("СК");
      expect(results[0].no).toBe(1);
      expect(results[0].name).toBe("Здатність до математичного формулювання та досліджування неперервних та дискретних математичних моделей");
    });

    it("should parse multiple СК results", () => {
      const text = "СК1. Перша компетентність. СК2. Друга компетентність. СК3. Третя компетентність.";
      const results = parseOPPResults(text, "СК");
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.type).toBe("СК");
        expect(result.no).toBe(index + 1);
      });
    });
    
  });

  describe("РН (Program Results)", () => {
    it("should parse РН results", () => {
      const text = "РН1. Застосовувати знання основних форм і законів абстрактно-логічного мислення.";
      const results = parseOPPResults(text, "РН");
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("РН");
      expect(results[0].no).toBe(1);
      expect(results[0].name).toContain("Застосовувати знання");
    });

    it("should parse mixed format РН results", () => {
      const text = "РН1. Перший результат. РН2. Другий результат. РН15. П'ятнадцятий результат.";
      const results = parseOPPResults(text, "РН");
      
      expect(results).toHaveLength(3);
      expect(results[0].no).toBe(1);
      expect(results[1].no).toBe(2);
      expect(results[2].no).toBe(15);
    });
  });

 describe("Edge cases", () => {
    it("should handle empty text", () => {
      const results = parseOPPResults("", "ЗК");
      expect(results).toHaveLength(0);
    });

    it("should handle text without matching patterns", () => {
      const text = "Це текст без результатів ЗК або СК.";
      const results = parseOPPResults(text, "ЗК");
      expect(results).toHaveLength(0);
    });

    it("should normalize whitespace", () => {
      const text = "ЗК1.  Опис   з   багатьма   пробілами  .";
      const results = parseOPPResults(text, "ЗК");
      
      expect(results).toHaveLength(1);
      expect(results[0].name).not.toMatch(/\s{2,}/);
    });

    it("should handle large numbers", () => {
      const text = "ЗК100. Результат з великим номером.";
      const results = parseOPPResults(text, "ЗК");
      
      expect(results).toHaveLength(1);
      expect(results[0].no).toBe(100);
    });
  });

  describe("Real-world example", () => {
    it("should parse a realistic text block", () => {
      const text = `
Загальні компетентності (ЗК)

ЗК1. Здатність до абстрактного мислення, аналізу та синтезу. ЗК2. Здатність застосовувати знання у практичних ситуаціях.

ЗК3. Знання та розуміння предметної області та розуміння професійної діяльності.

ЗК4. Здатність спілкуватися державною мовою як усно, так і письмово.

Спеціальні (фахові) компетентності (СК)

СК1. Здатність до математичного формулювання та досліджування неперервних та дискретних математичних моделей.

СК2. Здатність до виявлення статистичних закономірностей недетермінованих явищ.

7 - Програмні результати навчання

РН1. Застосовувати знання основних форм і законів абстрактно-логічного мислення.

РН2. Використовувати сучасний математичний апарат неперервного та дискретного аналізу.

РН3 Використовувати знання закономірностей випадкових явищ.
      `;

      const зкResults = parseOPPResults(text, "ЗК");
      const скResults = parseOPPResults(text, "СК");
      const рнResults = parseOPPResults(text, "РН");

      expect(зкResults.length).toBeGreaterThan(0);
      expect(скResults.length).toBeGreaterThan(0);
      expect(рнResults.length).toBeGreaterThan(0);

      // Verify ЗК results
      expect(зкResults[0].no).toBe(1);
      expect(зкResults[0].name).toContain("Здатність до абстрактного мислення");

      // Verify СК results
      expect(скResults[0].no).toBe(1);
      expect(скResults[0].name).toContain("математичного формулювання");

      // Verify РН results
      expect(рнResults[0].no).toBe(1);
      expect(рнResults[0].name).toContain("Застосовувати знання");
      
      // РН3 without period should still be parsed
      const рн3 = рнResults.find(r => r.no === 3);
      expect(рн3).toBeDefined();
      expect(рн3?.name).toContain("Використовувати знання закономірностей");
    });
  });

  describe("parseSpecialtyAndArea", () => {
    it("should parse specialty and area from program text", () => {
      const text = `
РОБОЧА ПРОГРАМА НАВЧАЛЬНОЇ ДИСЦИПЛІНИ
Інтелектуальний аналіз даних
Рівень вищої освіти Перший (бакалаврський)
Галузь знань 12 Інформаційні технології
Спеціальність 122 «Комп’ютерні науки» 
Освітньо-професійна програма Комп’ютерні науки
  `;
      const [specialty, area] = parseSpecialtyAndArea(text);
      expect(specialty).toBe("122 – Комп’ютерні науки");
      expect(area).toBe("12 – Інформаційні технології");
    });

    it("should parse specialty and area from program text with F", () => {
      const text = `
РОБОЧА ПРОГРАМА НАВЧАЛЬНОЇ ДИСЦИПЛІНИ
Інтелектуальний аналіз даних
Рівень вищої освіти Перший (бакалаврський)
Галузь знань F Інформаційні технології
Спеціальність F3 Комп’ютерні науки
Освітньо-професійна програма Комп’ютерні науки
  `;
      const [specialty, area] = parseSpecialtyAndArea(text);
      expect(specialty).toBe("F3 – Комп’ютерні науки");
      expect(area).toBe("F – Інформаційні технології");
    });

    it("should parse specialty and area from sylabus text", () => {
      const text = `
СИЛАБУС 
НАВЧАЛЬНОЇ ДИСЦИПЛІНИ
«ІНТЕЛЕКТУАЛЬНИЙ АНАЛІЗ ДАНИХ»
Рівень вищої освіти: Перший (бакалаврський)
Спеціальність: 122 Комп’ютерні науки
Рік навчання:   4-й,  семестр  7-й
Кількість кредитів ECTS:   3 кредити
  `;
      const [specialty, area] = parseSpecialtyAndArea(text);
      expect(specialty).toBe("122 – Комп’ютерні науки");
      expect(area).toBe("12 – Інформаційні технології");
    });

    it("should parse specialty and area from sylabus text with F", () => {
      const text = `
СИЛАБУС 
НАВЧАЛЬНОЇ ДИСЦИПЛІНИ
«ІНТЕЛЕКТУАЛЬНИЙ АНАЛІЗ ДАНИХ»
Рівень вищої освіти: Перший (бакалаврський)
Спеціальність: F3 Комп’ютерні науки
Рік навчання:   4-й,  семестр  7-й
Кількість кредитів ECTS:   3 кредити
  `;
      const [specialty, area] = parseSpecialtyAndArea(text);
      expect(specialty).toBe("122 – Комп’ютерні науки");
      expect(area).toBe("12 – Інформаційні технології");
    });

    it("should parse specialty and area from program text with 12/F types", () => {
      const text = `
Рівень вищої освіти Перший (бакалаврський)
Галузь знань 12 Інформаційні технології  / F Інформаційні технології
Спеціальність 122 «Комп’ютерні науки» / F3 «Комп’ютерні науки» 
Освітньо-професійна програма Комп’ютерні науки
  `;
      const [specialty, area] = parseSpecialtyAndArea(text);
      expect(specialty).toBe("12 Інформаційні технології  / F Інформаційні технології");
      expect(area).toBe("12 Інформаційні технології / F Інформаційні технології");
    });
  });

});