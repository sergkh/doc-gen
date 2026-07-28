import { Marp } from "@marp-team/marp-core";
import { parseMarpDeck, serializeMarpDeck } from "./deck";
import type { PresentationManifest } from "./models";

function rewriteDiagramUrls(
  markdown: string,
  courseId: number,
  topicUid: string,
): string {
  const prefix = `/api/presentations/courses/${courseId}/topics/${topicUid}/diagrams/`;
  return markdown.replace(
    /(\]\(|src=["'])\.\/diagrams\/([^)"']+)/g,
    (_match, opening: string, file: string) => `${opening}${prefix}${encodeURIComponent(file)}`,
  );
}

export function renderPresentationSlide(
  manifest: PresentationManifest,
  markdown: string,
  slideIndex: number,
  unsavedMarkdown?: string,
): { html: string; css: string } {
  const parsed = parseMarpDeck(markdown);
  const selected = unsavedMarkdown?.trim() || parsed.slides[slideIndex - 1];
  if (!selected) throw new Error(`Слайд ${slideIndex} не знайдено.`);
  const single = serializeMarpDeck({
    frontMatter: parsed.frontMatter,
    slides: [selected],
  });
  const rewritten = rewriteDiagramUrls(single, manifest.courseId, manifest.topicUid);
  const marp = new Marp({
    html: false,
    script: false,
    minifyCSS: true,
  });
  return marp.render(rewritten);
}
