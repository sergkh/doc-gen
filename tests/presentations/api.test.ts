import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  PresentationConflictError,
  PresentationNotFoundError,
  PresentationValidationError,
} from "@/presentations/models";

const listCoursePresentations = mock(async () => ({ course: { id: 1, name: "Course" }, topics: [] }));
const createPresentation = mock(async () => ({ revision: "a".repeat(40), slides: [] }));
const getPresentation = mock(async () => ({ revision: "a".repeat(40), slides: [] }));
const replacePresentationSlides = mock(async () => ({ revision: "b".repeat(40), slides: [] }));
const updatePresentationSlides = mock(async () => ({ revision: "c".repeat(40), slides: [] }));
const previewPresentationSlide = mock(async () => ({ html: "<section />", css: "section{}" }));
const putPresentationDiagram = mock(async () => ({ presentation: {}, diagram: {} }));
const getPresentationHistory = mock(async () => []);
const restorePresentation = mock(async () => ({ revision: "d".repeat(40), slides: [] }));
const readDiagramFile = mock(async () => new Blob(["<svg />"]));

mock.module("@/presentations/service", () => ({
  presentationService: {
    listCoursePresentations,
    createPresentation,
    getPresentation,
    replacePresentationSlides,
    updatePresentationSlides,
    previewPresentationSlide,
    putPresentationDiagram,
    getPresentationHistory,
    restorePresentation,
    readDiagramFile,
  },
}));

function request(params: Record<string, string>, body: unknown = {}) {
  return {
    params,
    json: async () => body,
  } as any;
}

describe("presentation API", () => {
  let api: any;

  beforeAll(async () => {
    api = (await import("@/presentations/api")).default;
  });

  beforeEach(() => {
    for (const fn of [
      listCoursePresentations,
      createPresentation,
      getPresentation,
      replacePresentationSlides,
      updatePresentationSlides,
      previewPresentationSlide,
      putPresentationDiagram,
      getPresentationHistory,
      restorePresentation,
      readDiagramFile,
    ]) fn.mockClear();
  });

  it("lists, creates and reads the one presentation for a topic", async () => {
    const list = api["/api/presentations/courses/:courseId"];
    expect((await list.GET(request({ courseId: "1" }))).status).toBe(200);
    expect(listCoursePresentations).toHaveBeenCalledWith(1);

    const route = api["/api/presentations/courses/:courseId/topics/:topicUid"];
    const params = { courseId: "1", topicUid: "123e4567-e89b-12d3-a456-426614174000" };
    expect((await route.POST(request(params, { theme: "gaia" }))).status).toBe(201);
    expect(createPresentation).toHaveBeenCalledWith(1, params.topicUid, { theme: "gaia" });
    expect((await route.GET(request(params))).status).toBe(200);
  });

  it("updates slides by revision and previews unsaved Markdown", async () => {
    const params = { courseId: "1", topicUid: "123e4567-e89b-12d3-a456-426614174000" };
    const replace = api["/api/presentations/courses/:courseId/topics/:topicUid/slides"];
    await replace.PUT(request(params, { baseRevision: "abc1234", slides: ["# One"] }));
    expect(replacePresentationSlides).toHaveBeenCalledWith(1, params.topicUid, "abc1234", ["# One"]);

    const operations = api["/api/presentations/courses/:courseId/topics/:topicUid/slides/operations"];
    await operations.POST(request(params, {
      baseRevision: "abc1234",
      operations: [{ operation: "replace", slideIndex: 1, markdown: "# Updated" }],
    }));
    expect(updatePresentationSlides).toHaveBeenCalled();

    const preview = api["/api/presentations/courses/:courseId/topics/:topicUid/preview"];
    await preview.POST(request(params, { slideIndex: 1, markdown: "# Draft" }));
    expect(previewPresentationSlide).toHaveBeenCalledWith(1, params.topicUid, 1, "# Draft");
  });

  it("maps validation, missing and revision conflicts to HTTP responses", async () => {
    const route = api["/api/presentations/courses/:courseId/topics/:topicUid"];
    const params = { courseId: "1", topicUid: "123e4567-e89b-12d3-a456-426614174000" };

    getPresentation.mockRejectedValueOnce(new PresentationNotFoundError("missing"));
    expect((await route.GET(request(params))).status).toBe(404);

    getPresentation.mockRejectedValueOnce(new PresentationValidationError("invalid"));
    expect((await route.GET(request(params))).status).toBe(400);

    getPresentation.mockRejectedValueOnce(new PresentationConflictError("f".repeat(40)));
    const conflict = await route.GET(request(params));
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).currentRevision).toBe("f".repeat(40));
  });

  it("requires explicit confirmation before restoring history", async () => {
    const route = api["/api/presentations/courses/:courseId/topics/:topicUid/history/restore"];
    const params = { courseId: "1", topicUid: "123e4567-e89b-12d3-a456-426614174000" };
    const rejected = await route.POST(request(params, {
      baseRevision: "abc1234",
      revision: "def5678",
      confirm: false,
    }));
    expect(rejected.status).toBe(400);
    expect(restorePresentation).not.toHaveBeenCalled();
  });
});

