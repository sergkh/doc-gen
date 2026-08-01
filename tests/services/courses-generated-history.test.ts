import { describe, expect, it, mock } from "bun:test";

const coursesGet = mock(async () => null as any);
const coursesUpdate = mock(async () => [{ id: 1 }] as any);
const saveHistory = mock(async () => undefined as any);
const resetHistory = mock(async () => ({ id: 10, type: "snapshot" }) as any);

mock.module("@/stores/db", () => ({
  courses: {
    get: coursesGet,
    update: coursesUpdate,
  },
  history: {
    saveHistory,
    reset: resetHistory,
  },
  teachers: {},
}));

mock.module("@/docx/parse", () => ({ parseSylabusOrProgram: mock(async () => null) }));
mock.module("@/docx/verification", () => ({ verifyCourse: mock(() => ({ issues: [] })) }));
mock.module("@/ai/generator", () => ({ runCoursePrompts: mock(async () => []) }));

const { coursesService } = await import("@/services/courses-service");

describe("course generated-data history", () => {
  it("stores a dedicated history entry when generated data is edited", async () => {
    const oldCourse = {
      id: 1,
      name: "Course",
      teacher_id: 1,
      specialty_id: 1,
      data: {},
      generated: { programGoal: "Old goal" },
      topics: [],
      version: 2,
    };
    const generated = { programGoal: "New goal" };
    coursesGet.mockResolvedValueOnce(oldCourse as any);

    const updated = await coursesService.updateCourseGeneratedData(1, generated as any, 2);

    expect(coursesUpdate).toHaveBeenCalledWith({ ...oldCourse, generated });
    expect(saveHistory).toHaveBeenCalledWith(
      oldCourse,
      { ...oldCourse, generated },
      "Updated generated course data by user",
      "course",
    );
    expect(updated).toEqual({ ...oldCourse, generated, version: 3 });
  });

  it("resets history using the current course as the new snapshot", async () => {
    const currentCourse = {
      id: 1,
      name: "Course",
      data: {},
      generated: {},
      topics: [],
      version: 3,
    };
    coursesGet.mockResolvedValueOnce(currentCourse as any);

    const record = await coursesService.resetCourseHistory(1);

    expect(resetHistory).toHaveBeenCalledWith(
      "course",
      currentCourse,
      "History reset: created a new snapshot from the current course state",
    );
    expect(record).toEqual({ id: 10, type: "snapshot" });
  });
});
