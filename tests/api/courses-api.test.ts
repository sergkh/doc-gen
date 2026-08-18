import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

const coursesGet = mock(async () => null as any);
const coursesUpdate = mock(async () => undefined as any);
const oldTopicsAll = mock(async () => [] as any[]);
const resultsBySpecialty = mock(async () => [] as any[]);
const specialtiesGet = mock(async () => null as any);

mock.module("@/stores/db", () => ({
  courses: { get: coursesGet, update: coursesUpdate },
  courseTopics: { all: oldTopicsAll },
  teachers: {},
  courseResults: { bySpecialty: resultsBySpecialty },
  specialties: { get: specialtiesGet },
}));

const getCourses = mock(async () => [] as any[]);
const createCourse = mock(async () => undefined as any);
const getCourseById = mock(async () => null as any);
const updateCourse = mock(async () => null as any);
const updateCourseGeneratedData = mock(async () => null as any);
const deleteCourse = mock(async () => undefined as any);
const parseCourseDataUpload = mock(() => null as any);
const getCourseHistory = mock(async () => [] as any[]);
const revertToHistory = mock(async () => null as any);
const resetCourseHistory = mock(async () => null as any);

mock.module("@/services/courses-service", () => ({
  coursesService: {
    getCourses,
    createCourse,
    getCourseById,
    updateCourse,
    updateCourseGeneratedData,
    deleteCourse,
    parseCourseDataUpload,
    getCourseHistory,
    revertToHistory,
    resetCourseHistory,
  },
}));

const computeFileHash = mock(async () => "file-hash");
mock.module("@/api/utils/files", () => ({ computeFileHash }));

const autofillCourseResults = mock(async () => [] as any[]);
const generateCourseTopics = mock(async () => [] as any[]);
const generateTopicSubtopics = mock(async () => [] as string[]);
const renameAttestationName = mock(async () => "Generated name");
mock.module("@/ai/autofill", () => ({
  autofillCourseResults,
  generateCourseTopics,
  generateTopicSubtopics,
  renameAttestationName,
}));

mock.module("@/docx/parse", () => ({ parseSylabusOrProgram: mock(() => null) }));

function request(params: Record<string, string> = {}, body?: unknown, url = "http://localhost/") {
  return { params, url, json: async () => body } as any;
}

async function text(response: Response) {
  return response.text();
}

describe("coursesApi", () => {
  let api: any;

  beforeAll(async () => {
    api = (await import("@/api/courses-api")).default;
  });

  beforeEach(() => {
    for (const fn of [
      coursesGet, coursesUpdate, oldTopicsAll, resultsBySpecialty, specialtiesGet,
      getCourses, createCourse, getCourseById, updateCourse, updateCourseGeneratedData, deleteCourse,
      parseCourseDataUpload, getCourseHistory, revertToHistory, resetCourseHistory, computeFileHash,
      autofillCourseResults, generateCourseTopics, generateTopicSubtopics, renameAttestationName,
    ]) fn.mockClear();
  });

  describe("course CRUD", () => {
    it("lists courses with parsed query options", async () => {
      getCourses.mockResolvedValueOnce([{ id: 1 }] as any);
      const response = await api["/api/courses"].GET(request({}, undefined, "http://localhost/api/courses?brief=true&topics=true&specialtyId=7"));
      expect(await response.json()).toEqual([{ id: 1 }]);
      expect(getCourses).toHaveBeenCalledWith(7, true, true);
    });

    it("creates a course", async () => {
      const course = { name: "Testing" };
      const response = await api["/api/courses"].POST(request({}, course));
      expect(await response.json()).toEqual({ success: true });
      expect(createCourse).toHaveBeenCalledWith(course);
    });

    it("returns a course and a 404 when absent", async () => {
      getCourseById.mockResolvedValueOnce({ id: 3 } as any).mockResolvedValueOnce(null as any);
      expect(await (await api["/api/courses/:id"].GET(request({ id: "3" }))).json()).toEqual({ id: 3 });
      const missing = await api["/api/courses/:id"].GET(request({ id: "99" }));
      expect(missing.status).toBe(404);
      expect(await text(missing)).toBe("Course not found");
    });

    it("updates and deletes a course", async () => {
      updateCourse.mockResolvedValueOnce({ id: 4, name: "Updated" } as any);
      const updated = await api["/api/courses/:id"].PUT(request({ id: "4" }, { name: "Updated" }));
      expect(await updated.json()).toEqual({ success: true, course: { id: 4, name: "Updated" } });
      expect(updateCourse).toHaveBeenCalledWith(4, { name: "Updated" }, "Updated by user");

      const deleted = await api["/api/courses/:id"].DELETE(request({ id: "4" }));
      expect(await deleted.json()).toEqual({ success: true });
      expect(deleteCourse).toHaveBeenCalledWith(4);
    });

    it("updates generated course data through a history-aware route", async () => {
      updateCourseGeneratedData.mockResolvedValueOnce({ id: 4, version: 3 } as any);
      const generated = { programGoal: "New goal" };
      const response = await api["/api/courses/:id/generated"].PUT(
        request({ id: "4" }, { generated, version: 2 }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, course: { id: 4, version: 3 } });
      expect(updateCourseGeneratedData).toHaveBeenCalledWith(4, generated, 2);
    });

    it("rejects malformed generated course updates", async () => {
      const response = await api["/api/courses/:id/generated"].PUT(
        request({ id: "4" }, { generated: null, version: 2 }),
      );

      expect(response.status).toBe(400);
      expect(updateCourseGeneratedData).not.toHaveBeenCalled();
    });
  });

  describe("topic routes", () => {
    it("migrates legacy topics into the course", async () => {
      const course = { id: 1, topics: [] as any[] };
      const legacy = [{ course_id: 1, index: 1, name: "Legacy" }];
      coursesGet.mockResolvedValueOnce(course as any);
      oldTopicsAll.mockResolvedValueOnce(legacy as any);
      const response = await api["/api/courses/:courseId/topics"].GET(request({ courseId: "1" }));
      expect(await response.json()).toEqual(legacy);
      expect(course.topics).toEqual(legacy);
      expect(coursesUpdate).toHaveBeenCalledWith(course);
    });

    it("returns no topics for a missing course", async () => {
      coursesGet.mockResolvedValueOnce(null as any);
      expect(await (await api["/api/courses/:courseId/topics"].GET(request({ courseId: "8" }))).json()).toEqual([]);
    });

    it("returns existing inline topics without consulting the legacy table", async () => {
      const topics = [{ index: 1, name: "Current" }];
      coursesGet.mockResolvedValueOnce({ topics } as any);
      expect(await (await api["/api/courses/:courseId/topics"].GET(request({ courseId: "8" }))).json()).toEqual(topics);
      expect(oldTopicsAll).not.toHaveBeenCalled();
    });

    it("adds a topic with server-owned course id and index", async () => {
      const course = { id: 2, topics: [{ index: 1, name: "First" }] };
      coursesGet.mockResolvedValueOnce(course as any);
      const response = await api["/api/courses/:courseId/topics"].POST(request({ courseId: "2" }, { index: 99, name: "Second" }));
      expect(await response.json()).toEqual({ course_id: 2, index: 2, name: "Second" });
      expect(course.topics).toHaveLength(2);
      expect(coursesUpdate).toHaveBeenCalledWith(course);
    });

    it("throws when adding a topic to a missing course", async () => {
      coursesGet.mockResolvedValueOnce(null as any);
      expect(api["/api/courses/:courseId/topics"].POST(request({ courseId: "2" }, { name: "Second" }))).rejects.toThrow("Course not found");
    });

    it("gets a topic by index or returns 404", async () => {
      coursesGet.mockResolvedValueOnce({ topics: [{ index: 2, name: "Found" }] } as any);
      expect(await (await api["/api/courses/:courseId/topics/:index"].GET(request({ courseId: "1", index: "2" }))).json()).toEqual({ index: 2, name: "Found" });
      coursesGet.mockResolvedValueOnce({ topics: [] } as any);
      const missing = await api["/api/courses/:courseId/topics/:index"].GET(request({ courseId: "1", index: "2" }));
      expect(missing.status).toBe(404);
    });

    it("updates a topic while preserving its route identity", async () => {
      const course = { topics: [{ course_id: 1, index: 2, name: "Old", data: { hours: 1 } }] };
      coursesGet.mockResolvedValueOnce(course as any);
      const response = await api["/api/courses/:courseId/topics/:index"].PUT(request({ courseId: "5", index: "2" }, { index: 9, name: "New" }));
      expect(await response.json()).toEqual({ course_id: 5, index: 2, name: "New", data: { hours: 1 } });
      expect(updateCourse).toHaveBeenCalledWith(5, {
        topics: [{ course_id: 5, index: 2, name: "New", data: { hours: 1 } }],
      }, "Updated topic by user");
    });

    it("returns 404 when updating a missing course or topic", async () => {
      coursesGet.mockResolvedValueOnce(null as any);
      expect((await api["/api/courses/:courseId/topics/:index"].PUT(request({ courseId: "1", index: "1" }, {}))).status).toBe(404);
      coursesGet.mockResolvedValueOnce({ topics: [] } as any);
      expect((await api["/api/courses/:courseId/topics/:index"].PUT(request({ courseId: "1", index: "1" }, {}))).status).toBe(404);
    });

    it("deletes a topic and handles a missing course", async () => {
      const course = { topics: [{ index: 1 }, { index: 2 }] };
      coursesGet.mockResolvedValueOnce(course as any);
      expect(await (await api["/api/courses/:courseId/topics/:index"].DELETE(request({ courseId: "1", index: "1" }))).json()).toEqual({ success: true });
      expect(course.topics).toEqual([{ index: 2 }]);
      coursesGet.mockResolvedValueOnce(null as any);
      expect((await api["/api/courses/:courseId/topics/:index"].DELETE(request({ courseId: "1", index: "1" }))).status).toBe(404);
    });

    it("validates reorder input", async () => {
      const route = api["/api/courses/:courseId/topics/order"];
      expect((await route.PUT(request({ courseId: "1" }, {}))).status).toBe(400);
      expect((await route.PUT(request({ courseId: "1" }, []))).status).toBe(400);
    });

    it("reorders known topics and drops unknown indexes", async () => {
      const course = { topics: [{ index: 1, name: "A" }, { index: 2, name: "B" }] };
      coursesGet.mockResolvedValueOnce(course as any);
      const response = await api["/api/courses/:courseId/topics/order"].PUT(request({ courseId: "3" }, [2, 99, 1]));
      expect(await response.json()).toEqual({ success: true });
      expect(course.topics).toEqual([{ index: 1, name: "B" }, { index: 3, name: "A" }]);
    });

    it("returns 404 when reordering a missing course", async () => {
      coursesGet.mockResolvedValueOnce(null as any);
      expect((await api["/api/courses/:courseId/topics/order"].PUT(request({ courseId: "3" }, [1]))).status).toBe(404);
    });
  });

  describe("AI helpers", () => {
    it("validates result type and course existence", async () => {
      const route = api["/api/courses/:id/results/autofill"];
      expect((await route.POST(request({ id: "1" }, { type: "XX" }))).status).toBe(400);
      coursesGet.mockResolvedValueOnce(null as any);
      expect((await route.POST(request({ id: "1" }, { type: "ЗК" }))).status).toBe(404);
    });

    it("filters specialty results before autofill", async () => {
      const course = { id: 1, specialty_id: 4 };
      coursesGet.mockResolvedValueOnce(course as any);
      resultsBySpecialty.mockResolvedValueOnce([{ id: 1, type: "ЗК" }, { id: 2, type: "РН" }] as any);
      autofillCourseResults.mockResolvedValueOnce([{ id: 2 }] as any);
      const response = await api["/api/courses/:id/results/autofill"].POST(request({ id: "1" }, { type: "РН" }));
      expect(await response.json()).toEqual([{ id: 2 }]);
      expect(autofillCourseResults).toHaveBeenCalledWith([{ id: 2, type: "РН" }], course, "gpt-5-2025-08-07");
    });

    it("returns an empty result without invoking AI", async () => {
      coursesGet.mockResolvedValueOnce({ specialty_id: 4 } as any);
      resultsBySpecialty.mockResolvedValueOnce([]);
      expect(await (await api["/api/courses/:id/results/autofill"].POST(request({ id: "1" }, { type: "СК" }))).json()).toEqual([]);
      expect(autofillCourseResults).not.toHaveBeenCalled();
    });

    it("converts autofill failures to 500", async () => {
      coursesGet.mockRejectedValueOnce(new Error("database offline"));
      const response = await api["/api/courses/:id/results/autofill"].POST(request({ id: "1" }, { type: "ЗК" }));
      expect(response.status).toBe(500);
      expect(await text(response)).toContain("database offline");
    });

    it("validates attestation index and renames it", async () => {
      const route = api["/api/courses/:id/attestations/:index/ai-rename"];
      expect((await route.POST(request({ id: "1", index: "0" }, { topics: [] }))).status).toBe(400);
      const course = { id: 1 };
      const topics = [{ index: 1 }];
      coursesGet.mockResolvedValueOnce(course as any);
      renameAttestationName.mockResolvedValueOnce("Module one");
      expect(await (await route.POST(request({ id: "1", index: "2" }, { topics }))).json()).toEqual({ name: "Module one" });
      expect(renameAttestationName).toHaveBeenCalledWith(course, 2, topics, "gpt-5-2025-08-07");
    });

    it("handles missing courses and failures when renaming attestations", async () => {
      const route = api["/api/courses/:id/attestations/:index/ai-rename"];
      coursesGet.mockResolvedValueOnce(null as any);
      expect((await route.POST(request({ id: "1", index: "1" }, { topics: [] }))).status).toBe(404);
      coursesGet.mockResolvedValueOnce({ id: 1 } as any);
      renameAttestationName.mockRejectedValueOnce(new Error("AI unavailable"));
      const failed = await route.POST(request({ id: "1", index: "1" }, {}));
      expect(failed.status).toBe(500);
      expect(await text(failed)).toContain("AI unavailable");
    });

    it("generates topics with course and specialty context", async () => {
      const course = { name: "AI", specialty_id: 2, data: { description: "Desc", credits: 5 } };
      coursesGet.mockResolvedValueOnce(course as any);
      specialtiesGet.mockResolvedValueOnce({ code: "F2", name: "Engineering" } as any);
      generateCourseTopics.mockResolvedValueOnce([{ name: "Intro" }] as any);
      const response = await api["/api/courses/:id/topics/generate"].POST(request({ id: "1" }));
      expect(await response.json()).toEqual([{ name: "Intro" }]);
      expect(generateCourseTopics).toHaveBeenCalledWith("AI", "Desc", "F2 Engineering", 5, "gpt-5.6-luna", null);
    });

    it("requires both course and specialty for topic generation", async () => {
      const route = api["/api/courses/:id/topics/generate"];
      coursesGet.mockResolvedValueOnce(null as any);
      expect((await route.POST(request({ id: "1" }))).status).toBe(404);
      coursesGet.mockResolvedValueOnce({ specialty_id: 9 } as any);
      specialtiesGet.mockResolvedValueOnce(null as any);
      expect((await route.POST(request({ id: "1" }))).status).toBe(404);
    });

    it("converts topic generation failures to 500", async () => {
      coursesGet.mockRejectedValueOnce(new Error("database offline"));
      const response = await api["/api/courses/:id/topics/generate"].POST(request({ id: "1" }));
      expect(response.status).toBe(500);
      expect(await text(response)).toContain("database offline");
    });

    it("generates editable subtopics for a topic draft", async () => {
      const course = { id: 1, name: "AI", data: { description: "Desc" } };
      coursesGet.mockResolvedValueOnce(course as any);
      generateTopicSubtopics.mockResolvedValueOnce(["Основні поняття", "Приклади"]);

      const route = api["/api/courses/:id/topics/subtopics/generate"];
      const response = await route.POST(request({ id: "1" }, { name: "Вступ", lection: "План лекції" }));

      expect(await response.json()).toEqual({ subtopics: ["Основні поняття", "Приклади"] });
      expect(generateTopicSubtopics).toHaveBeenCalledWith(course, { name: "Вступ", lection: "План лекції" }, "gpt-5.6-luna");
    });

    it("validates a subtopic draft and handles generation failures", async () => {
      const route = api["/api/courses/:id/topics/subtopics/generate"];
      expect((await route.POST(request({ id: "1" }, { name: " " }))).status).toBe(400);

      coursesGet.mockResolvedValueOnce({ id: 1 } as any);
      generateTopicSubtopics.mockRejectedValueOnce(new Error("AI unavailable"));
      const response = await route.POST(request({ id: "1" }, { name: "Вступ", lection: "" }));
      expect(response.status).toBe(500);
      expect(await text(response)).toContain("AI unavailable");
    });
  });

  describe("DOCX upload", () => {
    it("rejects requests without files", async () => {
      const req = { formData: async () => new FormData() } as any;
      const response = await api["/api/courses/parse-docx"].POST(req);
      expect(response.status).toBe(400);
      expect(await text(response)).toBe("No files provided");
    });

    it("reports invalid file types without processing them", async () => {
      const form = new FormData();
      form.append("files", new File(["x"], "notes.txt", { type: "text/plain" }));
      const response = await api["/api/courses/parse-docx"].POST({ formData: async () => form } as any);
      expect(await response.json()).toEqual([{ file: "notes.txt", error: "Invalid file type. Expected .docx file", success: false }]);
      expect(computeFileHash).not.toHaveBeenCalled();
    });

    it("reports per-file errors for a valid DOCX", async () => {
      const form = new FormData();
      form.append("files", new File(["docx"], "course.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      computeFileHash.mockRejectedValueOnce(new Error("hash failed"));
      const response = await api["/api/courses/parse-docx"].POST({ formData: async () => form } as any);
      expect(await response.json()).toEqual([{ file: "course.docx", error: "hash failed", success: false }]);
    });

    it("converts form parsing failures to 500", async () => {
      const response = await api["/api/courses/parse-docx"].POST({ formData: async () => { throw new Error("bad multipart"); } } as any);
      expect(response.status).toBe(500);
      expect(await text(response)).toContain("bad multipart");
    });
  });

  describe("history", () => {
    it("returns course history", async () => {
      getCourseHistory.mockResolvedValueOnce([{ id: 10 }] as any);
      const response = await api["/api/courses/:id/history"].GET(request({ id: "5" }));
      expect(await response.json()).toEqual([{ id: 10 }]);
      expect(getCourseHistory).toHaveBeenCalledWith(5);
    });

    it("reverts history and reports domain errors", async () => {
      revertToHistory.mockResolvedValueOnce({ id: 5 } as any);
      const route = api["/api/courses/:id/history/:historyId/revert"];
      expect(await (await route.POST(request({ id: "5", historyId: "10" }))).json()).toEqual({ success: true, course: { id: 5 } });
      revertToHistory.mockRejectedValueOnce(new Error("Invalid history entry"));
      const failed = await route.POST(request({ id: "5", historyId: "11" }));
      expect(failed.status).toBe(400);
      expect(await failed.json()).toEqual({ error: "Invalid history entry" });
    });

    it("resets course history to one fresh snapshot", async () => {
      resetCourseHistory.mockResolvedValueOnce({ id: 12, type: "snapshot" } as any);
      const response = await api["/api/courses/:id/history/reset"].POST(request({ id: "5" }));

      expect(await response.json()).toEqual({
        success: true,
        record: { id: 12, type: "snapshot" },
      });
      expect(resetCourseHistory).toHaveBeenCalledWith(5);
    });
  });
});
