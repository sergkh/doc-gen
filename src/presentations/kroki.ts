import type { DiagramType } from "./models";
import { DIAGRAM_TYPES, PresentationValidationError } from "./models";

const SOURCE_EXTENSIONS: Record<DiagramType, string> = {
  mermaid: "mmd",
  d2: "d2",
  excalidraw: "excalidraw.json",
  plantuml: "puml",
  graphviz: "dot",
};

export function diagramSourceExtension(type: DiagramType): string {
  return SOURCE_EXTENSIONS[type];
}

export function normalizeDiagramName(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (!normalized || normalized.length > 80) {
    throw new PresentationValidationError("Назва діаграми повинна містити від 1 до 80 символів.");
  }
  return normalized;
}

export function assertDiagramType(value: string): asserts value is DiagramType {
  if (!(DIAGRAM_TYPES as readonly string[]).includes(value)) {
    throw new PresentationValidationError(`Непідтримуваний тип діаграми: ${value}.`);
  }
}

export function validateSvg(svg: string): void {
  if (!/^\s*<svg[\s>]/i.test(svg)) {
    throw new PresentationValidationError("Kroki не повернув SVG-зображення.");
  }
  const unsafe = [
    /<script[\s>]/i,
    /\son[a-z]+\s*=/i,
    /\b(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i,
    /javascript:/i,
  ];
  if (unsafe.some((pattern) => pattern.test(svg))) {
    throw new PresentationValidationError("Kroki повернув SVG з небезпечним вмістом.");
  }
}

export async function renderDiagram(type: DiagramType, source: string): Promise<string> {
  if (!source.trim()) throw new PresentationValidationError("Код діаграми не може бути порожнім.");
  if (source.length > 200_000) throw new PresentationValidationError("Код діаграми завеликий.");

  const baseUrl = (process.env.KROKI_BASE_URL ?? "https://kroki.sergkh.com").replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${baseUrl}/${type}/svg`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "image/svg+xml",
      },
      body: JSON.stringify({ diagram_source: source }),
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) {
      throw new PresentationValidationError(
        `Kroki не зміг згенерувати діаграму (${response.status}): ${body.slice(0, 500)}`,
      );
    }
    if (body.length > 5_000_000) {
      throw new PresentationValidationError("SVG-відповідь Kroki завелика.");
    }
    validateSvg(body);
    return body;
  } catch (error) {
    if (error instanceof PresentationValidationError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PresentationValidationError("Перевищено час очікування відповіді Kroki.");
    }
    throw new PresentationValidationError(
      `Не вдалося підключитися до Kroki: ${error instanceof Error ? error.message : "невідома помилка"}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}
