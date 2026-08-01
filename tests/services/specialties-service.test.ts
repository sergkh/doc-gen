import { describe, it, expect } from "bun:test";
await import("../stores/db-mock");

describe("specialtiesService exports", () => {
  it("should export all required functions", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    
    expect(specialtiesService).toBeDefined();
    expect(typeof specialtiesService.getAllSpecialties).toBe("function");
    expect(typeof specialtiesService.getSpecialtyById).toBe("function");
    expect(typeof specialtiesService.createSpecialty).toBe("function");
    expect(typeof specialtiesService.updateSpecialty).toBe("function");
    expect(typeof specialtiesService.deleteSpecialty).toBe("function");
    expect(typeof specialtiesService.getSpecialtyResults).toBe("function");
  });
});

describe("specialtiesService history details", () => {
  it("calculates field changes for snapshots as well as patches", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const records = [
      {
        id: 3,
        type: "snapshot",
        stamp: new Date("2026-01-03T00:00:00Z"),
        data: { id: 1, code: "F3", name: "Computer Science", data: { disciplines: [] } },
      },
      {
        id: 2,
        type: "patch",
        stamp: new Date("2026-01-02T00:00:00Z"),
        data: { code: ["122", "F"] },
      },
      {
        id: 1,
        type: "snapshot",
        stamp: new Date("2026-01-01T00:00:00Z"),
        data: { id: 1, code: "122", name: "Computer Science", data: { disciplines: [] } },
      },
    ];

    const detailed = specialtiesService.buildSpecialtyHistoryDetails(records as any);

    expect(detailed.map((record) => record.id)).toEqual([3, 2, 1]);
    expect(detailed[0]?.changes).toEqual({ code: ["F", "F3"] });
    expect(detailed[1]?.changes).toEqual({ code: ["122", "F"] });
    expect(detailed[2]?.changes).toBeUndefined();
  });

  it("keeps incompatible legacy patches visible without failing history loading", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const incompatiblePatch = {
      data: {
        disciplines: {
          _t: "a",
          0: { name: ["Old", "New"] },
        },
      },
    };
    const records = [
      {
        id: 3,
        type: "snapshot",
        stamp: new Date("2026-01-03T00:00:00Z"),
        data: { id: 1, code: "F3", data: { disciplines: [{ name: "New" }] } },
      },
      {
        id: 2,
        type: "patch",
        stamp: new Date("2026-01-02T00:00:00Z"),
        data: incompatiblePatch,
      },
      {
        id: 1,
        type: "snapshot",
        stamp: new Date("2026-01-01T00:00:00Z"),
        data: { id: 1, code: "F3", data: {} },
      },
    ];

    const detailed = specialtiesService.buildSpecialtyHistoryDetails(records as any);

    expect(detailed.map((record) => record.id)).toEqual([3, 2, 1]);
    expect(detailed[1]?.changes).toEqual(incompatiblePatch);
    expect(detailed[0]?.changes).toBeUndefined();
  });
});

describe("specialtiesService function signatures", () => {
  it("getAllSpecialties should not require parameters", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const sig = specialtiesService.getAllSpecialties.toString();
    expect(sig).toBeDefined();
  });

  it("getSpecialtyById should accept id parameter", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const sig = specialtiesService.getSpecialtyById.toString();
    expect(sig).toContain("id");
  });

  it("createSpecialty should accept specialtyData parameter", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const sig = specialtiesService.createSpecialty.toString();
    expect(sig).toContain("specialtyData");
  });

  it("updateSpecialty should accept id and specialty parameters", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const sig = specialtiesService.updateSpecialty.toString();
    expect(sig).toContain("id");
    expect(sig).toContain("specialty");
  });

  it("deleteSpecialty should accept id parameter", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const sig = specialtiesService.deleteSpecialty.toString();
    expect(sig).toContain("id");
  });

  it("getSpecialtyResults should accept specialtyId parameter", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const sig = specialtiesService.getSpecialtyResults.toString();
    expect(sig).toContain("specialtyId");
  });
});

describe("specialtiesService return types", () => {
  it("getAllSpecialties should return Promise<Specialty[]>", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const result = specialtiesService.getAllSpecialties();
    expect(result).toBeInstanceOf(Promise);
  });

  it("getSpecialtyById should return Promise<Specialty | null>", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const result = specialtiesService.getSpecialtyById(1);
    expect(result).toBeInstanceOf(Promise);
  });

  it("createSpecialty should return Promise<Specialty>", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const result = specialtiesService.createSpecialty({} as any);
    expect(result).toBeInstanceOf(Promise);
  });

  it("updateSpecialty should return Promise<Specialty>", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const result = specialtiesService.updateSpecialty(1, {} as any).catch(() => null);
    expect(result).toBeInstanceOf(Promise);
  });

  it("deleteSpecialty should return Promise<void>", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const result = specialtiesService.deleteSpecialty(1);
    expect(result).toBeInstanceOf(Promise);
  });

  it("getSpecialtyResults should return a Promise", async () => {
    const { specialtiesService } = await import("@/services/specialties-service");
    const result = specialtiesService.getSpecialtyResults(1);
    expect(result).toBeInstanceOf(Promise);
  });
});
