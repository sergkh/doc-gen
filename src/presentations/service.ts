import path from "path";
import { readdir, rm } from "fs/promises";
import { coursesService } from "@/services/courses-service";
import type { Course, CourseTopic } from "@/stores/models";
import {
  assertCleanRepository,
  assertPresentationRevision,
  atomicWrite,
  commitPresentation,
  courseRepositoryPath,
  ensureCourseRepository,
  presentationFilesExist,
  presentationHistory,
  presentationPath,
  presentationRelativePath,
  presentationRevision,
  repositoryDirty,
  repositoryExists,
  restorePresentationFiles,
  syncCourseSnapshot,
  withCourseRepositoryLock,
} from "./git";
import {
  applySlideOperations,
  createInitialDeck,
  parseMarpDeck,
  serializeMarpDeck,
  toPresentationSlides,
} from "./deck";
import {
  DIAGRAM_TYPES,
  PresentationAlreadyExistsError,
  PresentationNotFoundError,
  PresentationValidationError,
  type DiagramType,
  type PresentationDiagram,
  type PresentationHistoryEntry,
  type PresentationManifest,
  type PresentationState,
  type PresentationTopicSummary,
  type SlideOperation,
} from "./models";
import {
  assertDiagramType,
  diagramSourceExtension,
  normalizeDiagramName,
  renderDiagram,
} from "./kroki";
import { findTopicByUid } from "./topic-identity";
import { renderPresentationSlide } from "./render";

async function courseAndTopic(courseId: number, topicUid: string): Promise<{ course: Course; topic: CourseTopic }> {
  const course = await coursesService.getCourseById(courseId);
  if (!course) throw new PresentationNotFoundError("Дисципліну не знайдено.");
  const topic = findTopicByUid(course, topicUid);
  if (!topic) throw new PresentationNotFoundError("Тему дисципліни не знайдено.");
  return { course, topic };
}

async function readManifest(courseId: number, topicUid: string): Promise<PresentationManifest> {
  try {
    return await Bun.file(path.join(presentationPath(courseId, topicUid), "manifest.json")).json();
  } catch {
    throw new PresentationNotFoundError("Презентацію для цієї теми не знайдено.");
  }
}

async function readMarkdown(courseId: number, topicUid: string): Promise<string> {
  const file = Bun.file(path.join(presentationPath(courseId, topicUid), "deck.marp.md"));
  if (!(await file.exists())) throw new PresentationNotFoundError("Файл презентації не знайдено.");
  return file.text();
}

async function listDiagrams(courseId: number, topicUid: string): Promise<PresentationDiagram[]> {
  const directory = path.join(presentationPath(courseId, topicUid), "diagrams");
  let files: string[] = [];
  try {
    files = await readdir(directory);
  } catch {
    return [];
  }
  const result: PresentationDiagram[] = [];
  for (const renderedFile of files.filter((file) => file.endsWith(".svg")).sort()) {
    const name = renderedFile.slice(0, -4);
    const type = DIAGRAM_TYPES.find((candidate) => {
      const source = `${name}.${diagramSourceExtension(candidate)}`;
      return files.includes(source);
    });
    if (!type) continue;
    result.push({
      name,
      type,
      sourceFile: `${name}.${diagramSourceExtension(type)}`,
      renderedFile,
      markdown: `![${name}](./diagrams/${renderedFile})`,
    });
  }
  return result;
}

export async function listCoursePresentations(courseId: number): Promise<{
  course: { id: number; name: string };
  topics: PresentationTopicSummary[];
}> {
  const course = await coursesService.getCourseById(courseId);
  if (!course) throw new PresentationNotFoundError("Дисципліну не знайдено.");
  const hasRepository = await repositoryExists(courseId);
  const repository = courseRepositoryPath(courseId);
  const topics = await Promise.all((course.topics ?? []).map(async (topic): Promise<PresentationTopicSummary> => {
    const uid = topic.uid!;
    const exists = hasRepository && await presentationFilesExist(courseId, uid);
    if (!exists) return { uid, index: topic.index, name: topic.name, exists: false };
    const markdown = await readMarkdown(courseId, uid);
    return {
      uid,
      index: topic.index,
      name: topic.name,
      exists: true,
      revision: await presentationRevision(repository, uid),
      slideCount: parseMarpDeck(markdown).slides.length,
    };
  }));
  return { course: { id: course.id, name: course.name }, topics };
}

export async function createPresentation(
  courseId: number,
  topicUid: string,
  options: { title?: string; theme?: string; slides?: string[] } = {},
): Promise<PresentationState> {
  return withCourseRepositoryLock(courseId, async () => {
    const { course, topic } = await courseAndTopic(courseId, topicUid);
    const repository = await ensureCourseRepository(course);
    await assertCleanRepository(repository);
    if (await presentationFilesExist(courseId, topicUid)) {
      throw new PresentationAlreadyExistsError("Для цієї теми вже створено презентацію.");
    }

    const createdAt = new Date().toISOString();
    const manifest: PresentationManifest = {
      schemaVersion: 1,
      courseId,
      courseNameAtCreation: course.name,
      topicUid,
      topicIndexAtCreation: topic.index,
      topicNameAtCreation: topic.name,
      title: options.title?.trim() || topic.name,
      language: "uk",
      theme: options.theme?.trim() || "default",
      deckFile: "deck.marp.md",
      createdAt,
    };
    const directory = presentationPath(courseId, topicUid);
    const initial = createInitialDeck(manifest.title, course.name, manifest.theme);
    const parsed = parseMarpDeck(initial);
    const markdown = options.slides?.length
      ? serializeMarpDeck({ frontMatter: parsed.frontMatter, slides: options.slides })
      : initial;
    parseMarpDeck(markdown);
    await atomicWrite(path.join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await atomicWrite(path.join(directory, "deck.marp.md"), markdown);
    await syncCourseSnapshot(repository, course);
    await commitPresentation(repository, topicUid, `Create presentation for topic ${topic.index}`);
    return getPresentation(courseId, topicUid);
  });
}

export async function getPresentation(courseId: number, topicUid: string): Promise<PresentationState> {
  if (!(await presentationFilesExist(courseId, topicUid))) {
    throw new PresentationNotFoundError("Презентацію для цієї теми не знайдено.");
  }
  const repository = courseRepositoryPath(courseId);
  const [manifest, markdown, revision, diagrams, dirty] = await Promise.all([
    readManifest(courseId, topicUid),
    readMarkdown(courseId, topicUid),
    presentationRevision(repository, topicUid),
    listDiagrams(courseId, topicUid),
    repositoryDirty(repository),
  ]);
  const parsed = parseMarpDeck(markdown);
  return {
    manifest,
    revision,
    markdown,
    slides: toPresentationSlides(parsed.slides),
    diagrams,
    dirty,
  };
}

async function mutateSlides(
  courseId: number,
  topicUid: string,
  baseRevision: string,
  transform: (slides: string[]) => string[],
  message: string,
): Promise<PresentationState> {
  return withCourseRepositoryLock(courseId, async () => {
    const { course } = await courseAndTopic(courseId, topicUid);
    const repository = courseRepositoryPath(courseId);
    await assertCleanRepository(repository);
    await assertPresentationRevision(repository, topicUid, baseRevision);
    const markdown = await readMarkdown(courseId, topicUid);
    const parsed = parseMarpDeck(markdown);
    const slides = transform(parsed.slides).map((slide) => slide.trim());
    if (!slides.length || slides.some((slide) => !slide)) {
      throw new PresentationValidationError("Презентація повинна містити непорожні слайди.");
    }
    const updated = serializeMarpDeck({ ...parsed, slides });
    parseMarpDeck(updated);
    await atomicWrite(path.join(presentationPath(courseId, topicUid), "deck.marp.md"), updated);
    await syncCourseSnapshot(repository, course);
    await commitPresentation(repository, topicUid, message);
    return getPresentation(courseId, topicUid);
  });
}

export function updatePresentationSlides(
  courseId: number,
  topicUid: string,
  baseRevision: string,
  operations: SlideOperation[],
): Promise<PresentationState> {
  if (!operations.length) throw new PresentationValidationError("Не передано змін слайдів.");
  return mutateSlides(
    courseId,
    topicUid,
    baseRevision,
    (slides) => applySlideOperations(slides, operations),
    operations.length === 1
      ? `${operations[0]!.operation} slide ${operations[0]!.slideIndex}`
      : `Update ${operations.length} slides`,
  );
}

export function replacePresentationSlides(
  courseId: number,
  topicUid: string,
  baseRevision: string,
  slides: string[],
): Promise<PresentationState> {
  return mutateSlides(
    courseId,
    topicUid,
    baseRevision,
    () => slides,
    `Replace presentation slides (${slides.length})`,
  );
}

export async function putPresentationDiagram(
  courseId: number,
  topicUid: string,
  baseRevision: string,
  input: { name: string; type: string; source: string; alt?: string },
): Promise<{ presentation: PresentationState; diagram: PresentationDiagram }> {
  assertDiagramType(input.type);
  const type: DiagramType = input.type;
  const name = normalizeDiagramName(input.name);
  const svg = await renderDiagram(type, input.source);

  return withCourseRepositoryLock(courseId, async () => {
    const { course } = await courseAndTopic(courseId, topicUid);
    const repository = courseRepositoryPath(courseId);
    await assertCleanRepository(repository);
    await assertPresentationRevision(repository, topicUid, baseRevision);
    const diagramsDirectory = path.join(presentationPath(courseId, topicUid), "diagrams");
    const sourceFile = `${name}.${diagramSourceExtension(type)}`;
    const renderedFile = `${name}.svg`;

    for (const candidate of DIAGRAM_TYPES) {
      const candidateFile = path.join(diagramsDirectory, `${name}.${diagramSourceExtension(candidate)}`);
      if (candidate !== type) await rm(candidateFile, { force: true });
    }
    await atomicWrite(path.join(diagramsDirectory, sourceFile), `${input.source.trim()}\n`);
    await atomicWrite(path.join(diagramsDirectory, renderedFile), svg);
    await syncCourseSnapshot(repository, course);
    await commitPresentation(repository, topicUid, `Update ${type} diagram ${name}`);
    const presentation = await getPresentation(courseId, topicUid);
    const diagram = presentation.diagrams.find((item) => item.name === name)!;
    return {
      presentation,
      diagram: {
        ...diagram,
        markdown: `![${input.alt?.trim() || name}](./diagrams/${renderedFile})`,
      },
    };
  });
}

export async function getPresentationHistory(
  courseId: number,
  topicUid: string,
): Promise<PresentationHistoryEntry[]> {
  if (!(await presentationFilesExist(courseId, topicUid))) {
    throw new PresentationNotFoundError("Презентацію для цієї теми не знайдено.");
  }
  return presentationHistory(courseRepositoryPath(courseId), topicUid);
}

export async function restorePresentation(
  courseId: number,
  topicUid: string,
  baseRevision: string,
  revision: string,
): Promise<PresentationState> {
  return withCourseRepositoryLock(courseId, async () => {
    const repository = courseRepositoryPath(courseId);
    await assertCleanRepository(repository);
    await assertPresentationRevision(repository, topicUid, baseRevision);
    await restorePresentationFiles(repository, topicUid, revision);
    parseMarpDeck(await readMarkdown(courseId, topicUid));
    await commitPresentation(repository, topicUid, `Restore presentation to ${revision.slice(0, 12)}`);
    return getPresentation(courseId, topicUid);
  });
}

export async function previewPresentationSlide(
  courseId: number,
  topicUid: string,
  slideIndex: number,
  unsavedMarkdown?: string,
): Promise<{ html: string; css: string }> {
  const [manifest, markdown] = await Promise.all([
    readManifest(courseId, topicUid),
    readMarkdown(courseId, topicUid),
  ]);
  return renderPresentationSlide(manifest, markdown, slideIndex, unsavedMarkdown);
}

export async function readDiagramFile(
  courseId: number,
  topicUid: string,
  fileName: string,
): Promise<Blob> {
  if (path.basename(fileName) !== fileName || !/^[\p{Letter}\p{Number}_.-]+$/u.test(fileName)) {
    throw new PresentationValidationError("Некоректне імʼя файлу діаграми.");
  }
  const file = Bun.file(path.join(presentationPath(courseId, topicUid), "diagrams", fileName));
  if (!(await file.exists())) throw new PresentationNotFoundError("Діаграму не знайдено.");
  return file;
}

export const presentationService = {
  listCoursePresentations,
  createPresentation,
  getPresentation,
  updatePresentationSlides,
  replacePresentationSlides,
  putPresentationDiagram,
  getPresentationHistory,
  restorePresentation,
  previewPresentationSlide,
  readDiagramFile,
};
