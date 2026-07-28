import { describe, expect, it } from "bun:test";
import { renderPresentationSlide } from "@/presentations/render";
import { normalizeDiagramName, validateSvg } from "@/presentations/kroki";
import { PresentationValidationError, type PresentationManifest } from "@/presentations/models";

const manifest: PresentationManifest = {
  schemaVersion: 1,
  courseId: 1,
  courseNameAtCreation: "Course",
  topicUid: "123e4567-e89b-12d3-a456-426614174000",
  topicIndexAtCreation: 1,
  topicNameAtCreation: "Topic",
  title: "Topic",
  language: "uk",
  theme: "default",
  deckFile: "deck.marp.md",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("presentation rendering and diagram validation", () => {
  it("renders one selected slide and rewrites diagram URLs", () => {
    const rendered = renderPresentationSlide(
      manifest,
      "---\nmarp: true\n---\n\n# One\n\n---\n\n# Two\n\n![Graph](./diagrams/graph.svg)\n",
      2,
    );
    expect(rendered.html).toContain("Two");
    expect(rendered.html).not.toContain(">One<");
    expect(rendered.html).toContain("/api/presentations/courses/1/topics/");
    expect(rendered.css.length).toBeGreaterThan(100);
  });

  it("normalizes names and rejects unsafe SVG", () => {
    expect(normalizeDiagramName("Consensus flow")).toBe("consensus-flow");
    expect(() => validateSvg("<svg><script>alert(1)</script></svg>"))
      .toThrow(PresentationValidationError);
    expect(() => validateSvg("<svg><path d=\"M0 0\" /></svg>")).not.toThrow();
    expect(() => validateSvg("<svg><foreignObject><div>Mermaid label</div></foreignObject></svg>")).not.toThrow();
  });
});
