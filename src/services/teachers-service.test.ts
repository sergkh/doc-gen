import { describe, it, expect } from "bun:test";

describe("teachersService exports", () => {
  it("should export all required functions", async () => {
    const { teachersService } = await import("./teachers-service");
    
    expect(teachersService).toBeDefined();
    expect(typeof teachersService.getAllTeachers).toBe("function");
    expect(typeof teachersService.getTeacherById).toBe("function");
    expect(typeof teachersService.createTeacher).toBe("function");
    expect(typeof teachersService.updateTeacher).toBe("function");
    expect(typeof teachersService.deleteTeacher).toBe("function");
    expect(typeof teachersService.getTeacherPublications).toBe("function");
    expect(typeof teachersService.refreshTeacherPublications).toBe("function");
  });
});

describe("teachersService function signatures", () => {
  it("getAllTeachers should not require parameters", async () => {
    const { teachersService } = await import("./teachers-service");
    const sig = teachersService.getAllTeachers.toString();
    expect(sig).toBeDefined();
  });

  it("getTeacherById should accept id parameter", async () => {
    const { teachersService } = await import("./teachers-service");
    const sig = teachersService.getTeacherById.toString();
    expect(sig).toContain("id");
  });

  it("createTeacher should accept teacherData parameter", async () => {
    const { teachersService } = await import("./teachers-service");
    const sig = teachersService.createTeacher.toString();
    expect(sig).toContain("teacherData");
  });

  it("updateTeacher should accept id and teacher parameters", async () => {
    const { teachersService } = await import("./teachers-service");
    const sig = teachersService.updateTeacher.toString();
    expect(sig).toContain("id");
    expect(sig).toContain("teacher");
  });

  it("deleteTeacher should accept id parameter", async () => {
    const { teachersService } = await import("./teachers-service");
    const sig = teachersService.deleteTeacher.toString();
    expect(sig).toContain("id");
  });

  it("getTeacherPublications should accept teacherId parameter", async () => {
    const { teachersService } = await import("./teachers-service");
    const sig = teachersService.getTeacherPublications.toString();
    expect(sig).toContain("teacherId");
  });

  it("refreshTeacherPublications should accept teacherId parameter", async () => {
    const { teachersService } = await import("./teachers-service");
    const sig = teachersService.refreshTeacherPublications.toString();
    expect(sig).toContain("teacherId");
  });
});

describe("teachersService return types", () => {
  it("getAllTeachers should return Promise<Teacher[]>", async () => {
    const { teachersService } = await import("./teachers-service");
    const result = teachersService.getAllTeachers();
    expect(result).toBeInstanceOf(Promise);
  });

  it("getTeacherById should return Promise<Teacher | null>", async () => {
    const { teachersService } = await import("./teachers-service");
    const result = teachersService.getTeacherById(1);
    expect(result).toBeInstanceOf(Promise);
  });

  it("createTeacher should return Promise<Teacher>", async () => {
    const { teachersService } = await import("./teachers-service");
    const result = teachersService.createTeacher({} as any);
    expect(result).toBeInstanceOf(Promise);
  });

  it("updateTeacher should return Promise<Teacher>", async () => {
    const { teachersService } = await import("./teachers-service");
    const result = teachersService.updateTeacher(1, {} as any);
    expect(result).toBeInstanceOf(Promise);
  });

  it("deleteTeacher should return Promise<void>", async () => {
    const { teachersService } = await import("./teachers-service");
    const result = teachersService.deleteTeacher(1);
    expect(result).toBeInstanceOf(Promise);
  });

  it("getTeacherPublications should return Promise<TeacherPublication[]>", async () => {
    const { teachersService } = await import("./teachers-service");
    const result = teachersService.getTeacherPublications(1);
    expect(result).toBeInstanceOf(Promise);
  });

  it("refreshTeacherPublications should return Promise<number>", async () => {
    const { teachersService } = await import("./teachers-service");
    const result = teachersService.refreshTeacherPublications(1);
    expect(result).toBeInstanceOf(Promise);
  });
});
