import type { PresentationSlide, SlideOperation } from "./models";
import { PresentationValidationError } from "./models";

export type ParsedDeck = {
  frontMatter: string;
  slides: string[];
};

function isFence(line: string): boolean {
  return /^\s*(```|~~~)/.test(line);
}

export function parseMarpDeck(markdown: string): ParsedDeck {
  const normalized = markdown.replace(/\r\n?/g, "\n").trimEnd();
  const lines = normalized.split("\n");
  let frontMatter = "";
  let bodyStart = 0;

  if (lines[0]?.trim() === "---") {
    const closing = lines.slice(1).findIndex((line) => line.trim() === "---");
    if (closing === -1) {
      throw new PresentationValidationError("Незакритий YAML front matter презентації.");
    }
    const closingIndex = closing + 1;
    frontMatter = lines.slice(0, closingIndex + 1).join("\n");
    bodyStart = closingIndex + 1;
  }

  const slides: string[] = [];
  let current: string[] = [];
  let activeFence: "```" | "~~~" | null = null;

  for (const line of lines.slice(bodyStart)) {
    if (isFence(line)) {
      const marker = line.trimStart().startsWith("```") ? "```" : "~~~";
      activeFence = activeFence === marker ? null : activeFence ?? marker;
    }
    if (!activeFence && line.trim() === "---") {
      slides.push(current.join("\n").trim());
      current = [];
    } else {
      current.push(line);
    }
  }
  slides.push(current.join("\n").trim());

  const nonEmptySlides = slides.filter((slide) => slide.length > 0);
  if (nonEmptySlides.length === 0) {
    throw new PresentationValidationError("Презентація повинна містити хоча б один слайд.");
  }
  return { frontMatter, slides: nonEmptySlides };
}

export function serializeMarpDeck(deck: ParsedDeck): string {
  const prefix = deck.frontMatter.trim() || "---\nmarp: true\n---";
  return `${prefix}\n\n${deck.slides.map((slide) => slide.trim()).join("\n\n---\n\n")}\n`;
}

export function slideTitle(markdown: string, index: number): string {
  const heading = markdown.match(/^\s*#{1,6}\s+(.+?)\s*$/m)?.[1]?.trim();
  return heading || `Слайд ${index}`;
}

export function toPresentationSlides(slides: string[]): PresentationSlide[] {
  return slides.map((markdown, offset) => ({
    index: offset + 1,
    title: slideTitle(markdown, offset + 1),
    markdown,
  }));
}

export function applySlideOperations(slides: string[], operations: SlideOperation[]): string[] {
  const next = [...slides];
  for (const operation of operations) {
    const index = operation.slideIndex - 1;
    if (operation.operation === "insert") {
      if (index < 0 || index > next.length) {
        throw new PresentationValidationError(`Некоректна позиція вставки: ${operation.slideIndex}.`);
      }
      next.splice(index, 0, operation.markdown.trim());
      continue;
    }
    if (index < 0 || index >= next.length) {
      throw new PresentationValidationError(`Слайд ${operation.slideIndex} не знайдено.`);
    }
    if (operation.operation === "replace") {
      if (!operation.markdown.trim()) {
        throw new PresentationValidationError("Слайд не може бути порожнім.");
      }
      next[index] = operation.markdown.trim();
    } else {
      if (next.length === 1) {
        throw new PresentationValidationError("Не можна видалити єдиний слайд.");
      }
      next.splice(index, 1);
    }
  }
  return next;
}

export function createInitialDeck(topicName: string, courseName: string, theme = "default"): string {
  return `---
marp: true
theme: ${theme}
paginate: true
---

# ${topicName}

${courseName}
`;
}
