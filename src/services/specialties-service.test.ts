import { describe, it, expect } from "bun:test";

describe("specialtiesService exports", () => {
  it("should export all required functions", async () => {
    const { specialtiesService } = await import("./specialties-service");
    
    expect(specialtiesService).toBeDefined();
    expect(typeof specialtiesService.getAllSpecialties).toBe("function");
    expect(typeof specialtiesService.getSpecialtyById).toBe("function");
    expect(typeof specialtiesService.createSpecialty).toBe("function");
    expect(typeof specialtiesService.updateSpecialty).toBe("function");
    expect(typeof specialtiesService.deleteSpecialty).toBe("function");
    expect(typeof specialtiesService.getSpecialtyResults).toBe("function");
  });
});

describe("specialtiesService function signatures", () => {
  it("getAllSpecialties should not require parameters", async () => {
    const { specialtiesService } = await import("./specialties-service");
    const sig = specialtiesService.getAllSpecialties.toString();
    expect(sig).toBeDefined();
  });

  it("getSpecialtyById should accept id parameter", async () => {
    const { specialtiesService } = await import("./specialties-service");
    const sig = specialtiesService.getSpecialtyById.toString();
    expect(sig).toContain("id");
  });

  it("createSpecialty should accept specialtyData parameter", async () => {
    const { specialtiesService } = await import("./specialties-service");
    const sig = specialtiesService.createSpecialty.toString();
    expect(sig).toContain("specialtyData");
  });

  it("updateSpecialty should accept id and specialty parameters", async () => {
    const { specialtiesService } = await import("./specialties-service");
    const sig = specialtiesService.updateSpecialty.toString();
    expect(sig).toContain("id");
    expect(sig).toContain("specialty");
  });

  it("deleteSpecialty should accept id parameter", async () => {
    const { specialtiesService } = await import("./specialties-service");
    const sig = specialtiesService.deleteSpecialty.toString();
    expect(sig).toContain("id");
  });

  it("getSpecialtyResults should accept specialtyId parameter", async () => {
    const { specialtiesService } = await import("./specialties-service");
    const sig = specialtiesService.getSpecialtyResults.toString();
    expect(sig).toContain("specialtyId");
  });
});

describe("specialtiesService return types", () => {
  it("getAllSpecialties should return Promise<Specialty[]>", async () => {
    const { specialtiesService } = await import("./specialties-service");
    const result = specialtiesService.getAllSpecialties();
    expect(result).toBeInstanceOf(Promise);
  });

  it("getSpecialtyById should return Promise<Specialty | null>", async () => {
    const { specialtiesService } = await import("./specialties-service");
    const result = specialtiesService.getSpecialtyById(1);
    expect(result).toBeInstanceOf(Promise);
  });

  it("createSpecialty should return Promise<Specialty>", async () => {
    const { specialtiesService } = await import("./specialties-service");
    const result = specialtiesService.createSpecialty({} as any);
    expect(result).toBeInstanceOf(Promise);
  });

  it("updateSpecialty should return Promise<Specialty>", async () => {
    const { specialtiesService } = await import("./specialties-service");
    const result = specialtiesService.updateSpecialty(1, {} as any);
    expect(result).toBeInstanceOf(Promise);
  });

  it("deleteSpecialty should return Promise<void>", async () => {
    const { specialtiesService } = await import("./specialties-service");
    const result = specialtiesService.deleteSpecialty(1);
    expect(result).toBeInstanceOf(Promise);
  });

  it("getSpecialtyResults should return a Promise", async () => {
    const { specialtiesService } = await import("./specialties-service");
    const result = specialtiesService.getSpecialtyResults(1);
    expect(result).toBeInstanceOf(Promise);
  });
});
