export const DIAGRAM_TYPES = ["mermaid", "d2", "excalidraw", "plantuml", "graphviz"] as const;

export type DiagramType = (typeof DIAGRAM_TYPES)[number];

export type PresentationManifest = {
  schemaVersion: 1;
  courseId: number;
  courseNameAtCreation: string;
  topicUid: string;
  topicIndexAtCreation: number;
  topicNameAtCreation: string;
  title: string;
  language: string;
  theme: string;
  deckFile: "deck.marp.md";
  createdAt: string;
};

export type PresentationSlide = {
  index: number;
  title: string;
  markdown: string;
};

export type PresentationDiagram = {
  name: string;
  type: DiagramType;
  sourceFile: string;
  renderedFile: string;
  markdown: string;
};

export type PresentationState = {
  manifest: PresentationManifest;
  revision: string;
  markdown: string;
  slides: PresentationSlide[];
  diagrams: PresentationDiagram[];
  dirty: boolean;
};

export type PresentationTopicSummary = {
  uid: string;
  index: number;
  name: string;
  exists: boolean;
  revision?: string;
  slideCount?: number;
};

export type PresentationHistoryEntry = {
  revision: string;
  authoredAt: string;
  message: string;
};

export type SlideOperation =
  | { operation: "replace"; slideIndex: number; markdown: string }
  | { operation: "insert"; slideIndex: number; markdown: string }
  | { operation: "delete"; slideIndex: number };

export class PresentationNotFoundError extends Error {}
export class PresentationAlreadyExistsError extends Error {}
export class PresentationConflictError extends Error {
  constructor(public readonly currentRevision: string) {
    super("Презентацію вже змінено. Оновіть дані та повторіть дію.");
  }
}
export class PresentationDirtyError extends Error {
  constructor() {
    super("Git-репозиторій курсу має незафіксовані зовнішні зміни.");
  }
}
export class PresentationValidationError extends Error {}

