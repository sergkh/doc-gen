import { describe, it, expect, mock, beforeAll, beforeEach } from "bun:test";

const mockCoursesGet = mock(() => null);
const mockCoursesUpdate = mock(() => [{}]);
const mockTemplatesGet = mock(() => null);
const mockSpecialtiesGet = mock(() => null);

mock.module("@/stores/db", () => {
  const emptyObjArr = () => [{}];
  const emptyArr = () => [];
  const nullVal = () => null;

  return {
    courses: {
      all: emptyArr,
      brief: emptyArr,
      bySpecialty: emptyArr,
      bySpecialtyBrief: emptyArr,
      add: () => [{ id: 1 }],
      get: mockCoursesGet,
      findByName: nullVal,
      getShortInfos: emptyArr,
      update: mockCoursesUpdate,
      delete: nullVal,
    },
    specialties: {
      all: emptyArr,
      get: mockSpecialtiesGet,
      findByName: nullVal,
      findByCode: nullVal,
      add: emptyObjArr,
      update: emptyObjArr,
      delete: nullVal,
    },
    templates: {
      all: emptyArr,
      get: mockTemplatesGet,
      add: emptyObjArr,
      update: emptyObjArr,
      delete: nullVal,
    },
    courseResults: {
      all: emptyArr,
      list: emptyArr,
      bySpecialty: emptyArr,
      get: nullVal,
      add: () => Promise.resolve(1),
      update: emptyObjArr,
      delete: nullVal,
    },
    teachers: {
      all: emptyArr,
      get: nullVal,
      findByName: nullVal,
      add: emptyObjArr,
      update: emptyObjArr,
      delete: nullVal,
    },
    teacherPublications: {
      all: emptyArr,
      byTeacher: emptyArr,
      get: nullVal,
      add: emptyObjArr,
      update: emptyObjArr,
      delete: nullVal,
      deleteByTeacher: nullVal,
    },
    courseTopics: {
      all: emptyArr,
      byCourseIds: emptyArr,
      get: nullVal,
      add: emptyObjArr,
      update: emptyObjArr,
      updateOrdering: nullVal,
      delete: nullVal,
    },
    history: {
      save: nullVal,
      saveHistory: nullVal,
      createTombstone: nullVal,
      forObject: emptyArr,
    },
  };
});

const mockLoadFullCourseInfo = mock(() => Promise.resolve({}));

mock.module("@/docx/transformations", () => ({
  loadFullCourseInfo: mockLoadFullCourseInfo,
}));

const mockRenderDoc = mock(() => new ArrayBuffer(0));
const mockRenderHandlebarsText = mock(() => new ArrayBuffer(0));

mock.module("@/docx/render", () => ({
  renderDoc: mockRenderDoc,
  renderHandlebarsText: mockRenderHandlebarsText,
}));

const mockRunCoursePrompts = mock(() => Promise.resolve([]));
const mockRunTopicPrompts = mock(() => Promise.resolve([]));

mock.module("@/ai/generator", () => ({
  runCoursePrompts: mockRunCoursePrompts,
  runTopicPrompts: mockRunTopicPrompts,
}));

function makePOST(path: string, body?: any) {
  return {
    params: {} as Record<string, string>,
    json: async () => body,
  } as any;
}

function makeGET(path: string) {
  return {
    params: {} as Record<string, string>,
    json: async () => { throw new Error("GET has no body"); },
  } as any;
}

function matchParams(req: any, params: Record<string, string>) {
  req.params = params;
}

describe("generationApi", () => {
  let generationApi: any;

  beforeAll(async () => {
    generationApi = (await import("@/api/generation-api")).default;
  });

  beforeEach(() => {
    mockCoursesGet.mockClear();
    mockCoursesUpdate.mockClear();
    mockTemplatesGet.mockClear();
    mockSpecialtiesGet.mockClear();
    mockLoadFullCourseInfo.mockClear();
    mockRenderDoc.mockClear();
    mockRenderHandlebarsText.mockClear();
    mockRunCoursePrompts.mockClear();
    mockRunTopicPrompts.mockClear();

  });

  // ---------------------------------------------------------------------------
  // POST /api/courses/:courseId/generate/:templateId
  // ---------------------------------------------------------------------------
  describe("POST /api/courses/:courseId/generate/:templateId", () => {
    const route = () => generationApi["/api/courses/:courseId/generate/:templateId"];

    it("should return 404 when course not found", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve(null));
      const req = makePOST("/api/courses/999/generate/1");
      matchParams(req, { courseId: "999", templateId: "1" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(404);
      const body = await resp.json();
      expect(body.error).toBe("Дисципліну не знайдено");
    });

    it("should return 404 when template not found", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve({ id: 1, topics: [{ id: 1 }] }));
      mockTemplatesGet.mockReturnValueOnce(Promise.resolve(null));
      const req = makePOST("/api/courses/1/generate/999", {});
      matchParams(req, { courseId: "1", templateId: "999" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(404);
      const body = await resp.json();
      expect(body.error).toBe("Шаблон не знайдено");
    });

    it("should return 404 when course has no topics", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve({ id: 1, topics: [] }));
      mockTemplatesGet.mockReturnValueOnce(Promise.resolve({ id: 1, file: "template.docx", name: "Template" }));
      const req = makePOST("/api/courses/1/generate/1", {});
      matchParams(req, { courseId: "1", templateId: "1" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(404);
      const body = await resp.json();
      expect(body.error).toBe("У дисципліни немає тем");
    });

    it("should start generation job and return jobId", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve({ id: 1, topics: [{ id: 1, name: "Topic 1" }] }));
      mockTemplatesGet.mockReturnValueOnce(Promise.resolve({ id: 1, file: "template.docx", name: "Template" }));
      mockSpecialtiesGet.mockReturnValueOnce(Promise.resolve({ id: 1 }));
      mockLoadFullCourseInfo.mockReturnValueOnce(Promise.resolve({}));
      mockRenderDoc.mockReturnValueOnce(new ArrayBuffer(8));

      const req = makePOST("/api/courses/1/generate/1", { apiKey: "test-key" });
      matchParams(req, { courseId: "1", templateId: "1" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(200);
      const body = await resp.json();
      expect(body.jobId).toBeDefined();
      expect(typeof body.jobId).toBe("string");
    });

    it("should handle invalid JSON body", async () => {
      const req = {
        params: { courseId: "1", templateId: "1" },
        json: async () => { throw new Error("Invalid JSON"); },
      } as any;
      const resp = await route().POST(req);
      expect(resp.status).toBe(400);
      const body = await resp.json();
      expect(body.error).toBe("Невалідний JSON у запиті");
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/courses/:courseId/run-prompt
  // ---------------------------------------------------------------------------
  describe("POST /api/courses/:courseId/run-prompt", () => {
    const route = () => generationApi["/api/courses/:courseId/run-prompt"];

    it("should return 400 for invalid JSON", async () => {
      const req = {
        params: { courseId: "1" },
        json: async () => { throw new Error("Invalid JSON"); },
      } as any;
      const resp = await route().POST(req);
      expect(resp.status).toBe(400);
      const body = await resp.json();
      expect(body.error).toBe("Невалідний JSON у запиті");
    });

    it("should return 400 when prompt is missing required fields", async () => {
      const req = makePOST("/api/courses/1/run-prompt", { prompt: { field: "" } });
      matchParams(req, { courseId: "1" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(400);
      const body = await resp.json();
      expect(body.error).toContain("Промпт не містить обов'язкових полів");
    });

    it("should run prompt and return result", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve({ id: 1, name: "Course", topics: [{ id: 1 }], data: {} }));
      mockRunCoursePrompts.mockReturnValueOnce(Promise.resolve([{ field: "description", result: "Generated description" }]));
      const req = makePOST("/api/courses/1/run-prompt", {
        prompt: { field: "description", system_prompt: "System", prompt: "Generate description" },
        apiKey: "test-key",
      });
      matchParams(req, { courseId: "1" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(200);
      const body = await resp.json();
      expect(body).toEqual({ field: "description", result: "Generated description" });
    });

    it("should return error when runPrompt returns empty", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve({ id: 1, name: "Course", topics: [{ id: 1 }], data: {} }));
      mockRunCoursePrompts.mockReturnValueOnce(Promise.resolve([]));
      const req = makePOST("/api/courses/1/run-prompt", {
        prompt: { field: "description", system_prompt: "System", prompt: "Generate" },
      });
      matchParams(req, { courseId: "1" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(200);
      const body = await resp.json();
      expect(body.error).toBe("Не вдалося згенерувати результат");
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/courses/:courseId/topics/:topicId/run-prompt
  // ---------------------------------------------------------------------------
  describe("POST /api/courses/:courseId/topics/:topicId/run-prompt", () => {
    const route = () => generationApi["/api/courses/:courseId/topics/:topicId/run-prompt"];

    const sampleTopic = { id: 5, name: "Sample Topic", index: 1, data: { fulltime: { hours: 2, practical_hours: 0, srs_hours: 0 }, inabscentia: { hours: 0, practical_hours: 0, srs_hours: 0 } }, generated: {} };
    const sampleCourse = { id: 1, name: "Course", topics: [sampleTopic], data: {} };

    it("should return 400 for invalid JSON", async () => {
      const req = {
        params: { courseId: "1", topicId: "5" },
        json: async () => { throw new Error("Invalid JSON"); },
      } as any;
      const resp = await route().POST(req);
      expect(resp.status).toBe(400);
    });

    it("should return 400 when prompt fields are missing", async () => {
      const req = makePOST("/api/courses/1/topics/5/run-prompt", { prompt: { field: "" } });
      matchParams(req, { courseId: "1", topicId: "5" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(400);
    });

    it("should return 404 when course not found", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve(null));
      const req = makePOST("/api/courses/999/topics/5/run-prompt", {
        prompt: { field: "description", system_prompt: "S", prompt: "P" },
      });
      matchParams(req, { courseId: "999", topicId: "5" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(404);
      const body = await resp.json();
      expect(body.error).toBe("Дисципліну не знайдено");
    });

    it("should return 404 when topic not found", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve(sampleCourse));
      const req = makePOST("/api/courses/1/topics/999/run-prompt", {
        prompt: { field: "description", system_prompt: "S", prompt: "P" },
      });
      matchParams(req, { courseId: "1", topicId: "999" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(404);
      const body = await resp.json();
      expect(body.error).toBe("Тему не знайдено");
    });

    it("should run topic prompt and return result", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve(sampleCourse));
      mockRunTopicPrompts.mockReturnValueOnce(Promise.resolve([{ field: "content", result: "Generated content" }]));
      const req = makePOST("/api/courses/1/topics/5/run-prompt", {
        prompt: { field: "content", system_prompt: "S", prompt: "P" },
      });
      matchParams(req, { courseId: "1", topicId: "5" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(200);
      const body = await resp.json();
      expect(body).toEqual({ field: "content", result: "Generated content" });
    });

    it("should return error when topic prompt returns no results", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve(sampleCourse));
      mockRunTopicPrompts.mockReturnValueOnce(Promise.resolve([]));
      const req = makePOST("/api/courses/1/topics/5/run-prompt", {
        prompt: { field: "content", system_prompt: "S", prompt: "P" },
      });
      matchParams(req, { courseId: "1", topicId: "5" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(200);
      const body = await resp.json();
      expect(body.error).toBe("Не вдалося згенерувати результат");
    });

    it("should return 500 when runTopicPrompts throws", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve(sampleCourse));
      mockRunTopicPrompts.mockRejectedValueOnce(new Error("API error"));
      const req = makePOST("/api/courses/1/topics/5/run-prompt", {
        prompt: { field: "content", system_prompt: "S", prompt: "P" },
      });
      matchParams(req, { courseId: "1", topicId: "5" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(500);
      const body = await resp.json();
      expect(body.error).toBe("API error");
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/courses/:courseId/save-prompt-result
  // ---------------------------------------------------------------------------
  describe("POST /api/courses/:courseId/save-prompt-result", () => {
    const route = () => generationApi["/api/courses/:courseId/save-prompt-result"];

    it("should return 400 for invalid JSON", async () => {
      const req = {
        params: { courseId: "1" },
        json: async () => { throw new Error("Invalid JSON"); },
      } as any;
      const resp = await route().POST(req);
      expect(resp.status).toBe(400);
    });

    it("should return 400 when field is missing", async () => {
      const req = makePOST("/api/courses/1/save-prompt-result", { field: "" });
      matchParams(req, { courseId: "1" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(400);
      const body = await resp.json();
      expect(body.error).toBe("Поле field є обов'язковим");
    });

    it("should save prompt result and return success", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve({ id: 1, name: "Course", version: 1, generated: {}, data: {} }));
      const req = makePOST("/api/courses/1/save-prompt-result", { field: "description", item: "New description" });
      matchParams(req, { courseId: "1" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(200);
      const body = await resp.json();
      expect(body).toEqual({ success: true, field: "description" });
      expect(mockCoursesUpdate).toHaveBeenCalled();
      const updated = mockCoursesUpdate.mock.calls[0][0];
      expect(updated.generated.description).toBe("New description");
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/courses/:courseId/topics/:topicId/save-prompt-result
  // ---------------------------------------------------------------------------
  describe("POST /api/courses/:courseId/topics/:topicId/save-prompt-result", () => {
    const route = () => generationApi["/api/courses/:courseId/topics/:topicId/save-prompt-result"];

    const sampleTopic = { id: 5, name: "Topic", index: 1, generated: {}, data: { fulltime: { hours: 2, practical_hours: 0, srs_hours: 0 }, inabscentia: { hours: 0, practical_hours: 0, srs_hours: 0 } } };
    const sampleCourse = { id: 1, name: "Course", topics: [sampleTopic], data: {} };

    it("should return 400 for invalid JSON", async () => {
      const req = {
        params: { courseId: "1", topicId: "5" },
        json: async () => { throw new Error("Invalid JSON"); },
      } as any;
      const resp = await route().POST(req);
      expect(resp.status).toBe(400);
    });

    it("should return 400 when field is missing", async () => {
      const req = makePOST("/api/courses/1/topics/5/save-prompt-result", { field: "" });
      matchParams(req, { courseId: "1", topicId: "5" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(400);
    });

    it("should return 404 when course not found", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve(null));
      const req = makePOST("/api/courses/999/topics/5/save-prompt-result", { field: "content", item: "New content" });
      matchParams(req, { courseId: "999", topicId: "5" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(404);
      const body = await resp.json();
      expect(body.error).toBe("Дисципліну не знайдено");
    });

    it("should return 404 when topic not found", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve(sampleCourse));
      const req = makePOST("/api/courses/1/topics/999/save-prompt-result", { field: "content", item: "New content" });
      matchParams(req, { courseId: "1", topicId: "999" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(404);
      const body = await resp.json();
      expect(body.error).toBe("Тему не знайдено");
    });

    it("should save topic prompt result and update course", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve(JSON.parse(JSON.stringify(sampleCourse))));
      const req = makePOST("/api/courses/1/topics/5/save-prompt-result", { field: "content", item: "Updated content" });
      matchParams(req, { courseId: "1", topicId: "5" });
      const resp = await route().POST(req);
      expect(resp.status).toBe(200);
      const body = await resp.json();
      expect(body).toEqual({ success: true, field: "content" });
      expect(mockCoursesUpdate).toHaveBeenCalled();
      const updatedCourse = mockCoursesUpdate.mock.calls[0][0];
      expect(updatedCourse.topics[0].generated.content).toBe("Updated content");
    });

    it("should merge with existing generated data", async () => {
      const courseWithExistingGenerated = {
        id: 1,
        name: "Course",
        topics: [{ id: 5, name: "Topic", index: 1, generated: { description: "Old desc" }, data: { fulltime: { hours: 2, practical_hours: 0, srs_hours: 0 }, inabscentia: { hours: 0, practical_hours: 0, srs_hours: 0 } } }],
        data: {},
      };
      mockCoursesGet.mockReturnValueOnce(Promise.resolve(courseWithExistingGenerated));
      const req = makePOST("/api/courses/1/topics/5/save-prompt-result", { field: "content", item: "New content" });
      matchParams(req, { courseId: "1", topicId: "5" });
      await route().POST(req);
      const updatedCourse = mockCoursesUpdate.mock.calls[0][0];
      expect(updatedCourse.topics[0].generated.description).toBe("Old desc");
      expect(updatedCourse.topics[0].generated.content).toBe("New content");
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/jobs/:jobId
  // ---------------------------------------------------------------------------
  describe("GET /api/jobs/:jobId", () => {
    const route = () => generationApi["/api/jobs/:jobId"];

    it("should return 404 when job not found", async () => {
      const req = makeGET("/api/jobs/unknown-id");
      matchParams(req, { jobId: "unknown-id" });
      const resp = await route().GET(req);
      expect(resp.status).toBe(404);
      const body = await resp.json();
      expect(body.error).toBe("Завдання не знайдено");
    });

    it("should return job status", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve({ id: 1, topics: [{ id: 1, name: "Topic" }] }));
      mockTemplatesGet.mockReturnValueOnce(Promise.resolve({ id: 1, file: "template.docx", name: "Template" }));
      mockSpecialtiesGet.mockReturnValueOnce(Promise.resolve({ id: 1 }));
      mockLoadFullCourseInfo.mockReturnValueOnce(Promise.resolve({}));
      mockRenderDoc.mockReturnValueOnce(new ArrayBuffer(8));

      const postReq = makePOST("/api/courses/1/generate/1");
      matchParams(postReq, { courseId: "1", templateId: "1" });
      const postResp = await generationApi["/api/courses/:courseId/generate/:templateId"].POST(postReq);
      const { jobId } = await postResp.json();

      const getReq = makeGET(`/api/jobs/${jobId}`);
      matchParams(getReq, { jobId });
      const getResp = await route().GET(getReq);
      expect(getResp.status).toBe(200);
      const body = await getResp.json();
      expect(body.id).toBe(jobId);
      expect(body.status).toBeDefined();
      expect(body.progress).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/jobs/:jobId/download
  // ---------------------------------------------------------------------------
  describe("GET /api/jobs/:jobId/download", () => {
    const route = () => generationApi["/api/jobs/:jobId/download"];

    it("should return 404 when job not found", async () => {
      const req = makeGET("/api/jobs/unknown-id");
      matchParams(req, { jobId: "unknown-id" });
      const resp = await route().GET(req);
      expect(resp.status).toBe(404);
    });

    it("should return 400 when job is not completed", async () => {
      mockCoursesGet.mockReturnValueOnce(Promise.resolve({ id: 1, topics: [{ id: 1, name: "Topic" }] }));
      mockTemplatesGet.mockReturnValueOnce(Promise.resolve({ id: 1, file: "template.docx", name: "Template" }));
      mockSpecialtiesGet.mockReturnValueOnce(Promise.resolve({ id: 1 }));
      mockLoadFullCourseInfo.mockReturnValueOnce(new Promise(() => {})); // never resolves

      const postReq = makePOST("/api/courses/1/generate/1");
      matchParams(postReq, { courseId: "1", templateId: "1" });
      const postResp = await generationApi["/api/courses/:courseId/generate/:templateId"].POST(postReq);
      const { jobId } = await postResp.json();

      const getReq = makeGET(`/api/jobs/${jobId}/download`);
      matchParams(getReq, { jobId });
      const getResp = await route().GET(getReq);
      expect(getResp.status).toBe(400);
      const body = await getResp.json();
      expect(body.error).toBe("Завдання ще не завершено");
    });
  });
});
