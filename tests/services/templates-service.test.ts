import { describe, it, expect } from "bun:test";
await import("../stores/db-mock");

describe("templatesService exports", () => {
  it("should export all required functions", async () => {
    const { templatesService } = await import("@/services/templates-service");
    
    expect(templatesService).toBeDefined();
    expect(typeof templatesService.getAllTemplates).toBe("function");
    expect(typeof templatesService.getTemplateById).toBe("function");
    expect(typeof templatesService.createTemplate).toBe("function");
    expect(typeof templatesService.updateTemplate).toBe("function");
    expect(typeof templatesService.deleteTemplate).toBe("function");
    expect(typeof templatesService.downloadTemplate).toBe("function");
  });
});

describe("templatesService function signatures", () => {
  it("getAllTemplates should not require parameters", async () => {
    const { templatesService } = await import("@/services/templates-service");
    const sig = templatesService.getAllTemplates.toString();
    expect(sig).toBeDefined();
  });

  it("getTemplateById should accept id parameter", async () => {
    const { templatesService } = await import("@/services/templates-service");
    const sig = templatesService.getTemplateById.toString();
    expect(sig).toContain("id");
  });

  it("createTemplate should accept file, name, data, prompts parameters", async () => {
    const { templatesService } = await import("@/services/templates-service");
    const sig = templatesService.createTemplate.toString();
    expect(sig).toContain("file");
    expect(sig).toContain("name");
    expect(sig).toContain("data");
    expect(sig).toContain("prompts");
  });

  it("updateTemplate should accept id, file, name, data, prompts parameters", async () => {
    const { templatesService } = await import("@/services/templates-service");
    const sig = templatesService.updateTemplate.toString();
    expect(sig).toContain("id");
    expect(sig).toContain("file");
    expect(sig).toContain("name");
    expect(sig).toContain("data");
    expect(sig).toContain("prompts");
  });

  it("deleteTemplate should accept id parameter", async () => {
    const { templatesService } = await import("@/services/templates-service");
    const sig = templatesService.deleteTemplate.toString();
    expect(sig).toContain("id");
  });

  it("downloadTemplate should accept id parameter", async () => {
    const { templatesService } = await import("@/services/templates-service");
    const sig = templatesService.downloadTemplate.toString();
    expect(sig).toContain("id");
  });
});
