import { describe, expect, it } from "bun:test";
import {
  applySlideOperations,
  createInitialDeck,
  parseMarpDeck,
  serializeMarpDeck,
  toPresentationSlides,
} from "@/presentations/deck";

describe("Marp deck parsing", () => {
  it("keeps front matter and ignores separators inside code fences", () => {
    const source = `---
marp: true
theme: default
---

# One

\`\`\`yaml
---
value: true
\`\`\`

---

# Two
`;
    const parsed = parseMarpDeck(source);
    expect(parsed.frontMatter).toContain("marp: true");
    expect(parsed.slides).toHaveLength(2);
    expect(parsed.slides[0]).toContain("value: true");
    expect(serializeMarpDeck(parsed)).toContain("# Two");
  });

  it("addresses slides by index within a revision", () => {
    const result = applySlideOperations(["# One", "# Two"], [
      { operation: "replace", slideIndex: 2, markdown: "# Updated" },
      { operation: "insert", slideIndex: 2, markdown: "# Inserted" },
    ]);
    expect(result).toEqual(["# One", "# Inserted", "# Updated"]);
    expect(toPresentationSlides(result).map((slide) => slide.title)).toEqual(["One", "Inserted", "Updated"]);
  });

  it("creates a valid initial deck", () => {
    const parsed = parseMarpDeck(createInitialDeck("Topic", "Course", "gaia"));
    expect(parsed.frontMatter).toContain("theme: gaia");
    expect(parsed.slides).toEqual(["# Topic\n\nCourse"]);
  });
});

