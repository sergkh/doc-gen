import type {
  PresentationHistoryEntry,
  PresentationState,
  PresentationTopicSummary,
  SlideOperation,
} from "./models";

async function json<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  const payload = await response.json().catch(() => ({ error: response.statusText })) as {
    error?: string;
    currentRevision?: string;
  };
  const error = new Error(payload.error || "Помилка запиту.") as Error & { currentRevision?: string };
  error.currentRevision = payload.currentRevision;
  throw error;
}

function base(courseId: number, topicUid: string): string {
  return `/api/presentations/courses/${courseId}/topics/${topicUid}`;
}

export function loadCoursePresentations(courseId: number): Promise<{
  course: { id: number; name: string };
  topics: PresentationTopicSummary[];
}> {
  return fetch(`/api/presentations/courses/${courseId}`).then(json<{
    course: { id: number; name: string };
    topics: PresentationTopicSummary[];
  }>);
}

export function createTopicPresentation(courseId: number, topicUid: string): Promise<PresentationState> {
  return fetch(base(courseId, topicUid), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }).then(json<PresentationState>);
}

export function loadPresentation(courseId: number, topicUid: string): Promise<PresentationState> {
  return fetch(base(courseId, topicUid)).then(json<PresentationState>);
}

export function updateSlides(
  courseId: number,
  topicUid: string,
  baseRevision: string,
  operations: SlideOperation[],
): Promise<PresentationState> {
  return fetch(`${base(courseId, topicUid)}/slides/operations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseRevision, operations }),
  }).then(json<PresentationState>);
}

export function replaceSlides(
  courseId: number,
  topicUid: string,
  baseRevision: string,
  slides: string[],
): Promise<PresentationState> {
  return fetch(`${base(courseId, topicUid)}/slides`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseRevision, slides }),
  }).then(json<PresentationState>);
}

export function previewSlide(
  courseId: number,
  topicUid: string,
  slideIndex: number,
  markdown: string,
): Promise<{ html: string; css: string }> {
  return fetch(`${base(courseId, topicUid)}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slideIndex, markdown }),
  }).then(json<{ html: string; css: string }>);
}

export function loadPresentationHistory(
  courseId: number,
  topicUid: string,
): Promise<PresentationHistoryEntry[]> {
  return fetch(`${base(courseId, topicUid)}/history`).then(json<PresentationHistoryEntry[]>);
}

export function restorePresentationRevision(
  courseId: number,
  topicUid: string,
  baseRevision: string,
  revision: string,
): Promise<PresentationState> {
  return fetch(`${base(courseId, topicUid)}/history/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseRevision, revision, confirm: true }),
  }).then(json<PresentationState>);
}
