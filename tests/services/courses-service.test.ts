import { describe, it, expect } from "bun:test";
await import("../stores/db-mock");
const { coursesService } = await import("@/services/courses-service");

describe("coursesService", () => {
  describe("mergeCourseData", () => {
    it("should merge teacher_id from parsed data", () => {
      const original = {
        id: 1,
        name: "Test Course",
        teacher_id: 1,
        specialty_id: 1,
        version: 1,
        generated: { description: "Original description" },
        data: { ok_no: "OK-1", credits: 3, hours: 45, control_type: "exam", optional: false, prerequisites: ["Math"], postrequisites: [], literature: { main: [], additional: [] }, assessments: [], topics: [], warnings: [] }
      };

      const parsed = {
        teacher_id: 2,
        version: 1,
        generated: null,
        data: {}
      };

      const result = coursesService.mergeCourseData(original as any, parsed as any);
      expect(result.teacher_id).toBe(2);
    });

    it("should keep original teacher_id when parsed teacher_id is 0", () => {
      const original = {
        id: 1,
        teacher_id: 1,
        version: 1,
        generated: null,
        data: { ok_no: "OK-1", credits: 3, hours: 45, control_type: "exam", optional: false, prerequisites: ["Math"], postrequisites: [], literature: { main: [], additional: [] }, assessments: [], topics: [], warnings: [] }
      };

      const parsed = {
        teacher_id: 0,
        version: 1,
        generated: null,
        data: {}
      };

      const result = coursesService.mergeCourseData(original as any, parsed as any);
      expect(result.teacher_id).toBe(1);
    });

    it("should merge specialty_id from parsed data", () => {
      const original = {
        id: 1,
        teacher_id: 1,
        specialty_id: 1,
        version: 1,
        generated: null,
        data: { ok_no: "OK-1", credits: 3, hours: 45, control_type: "exam", optional: false, prerequisites: [], postrequisites: [], literature: { main: [], additional: [] }, assessments: [], topics: [], warnings: [] }
      };

      const parsed = {
        specialty_id: 5,
        version: 1,
        generated: null,
        data: {}
      };

      const result = coursesService.mergeCourseData(original as any, parsed as any);
      expect(result.specialty_id).toBe(5);
    });

    it("should add subtopics from parsed when original has none", () => {
      const original = {
        id: 1,
        version: 1,
        generated: {},
        data: { ok_no: "OK-1", credits: 3, hours: 45, control_type: "exam", optional: false, prerequisites: [], postrequisites: [], literature: { main: [], additional: [] }, assessments: [], topics: [], warnings: [] }
      };

      const parsed = {
        version: 1,
        generated: { subtopics: ["Subtopic 1", "Subtopic 2"] },
        data: {}
      };

      const result = coursesService.mergeCourseData(original as any, parsed as any);
      expect(result.generated?.subtopics).toEqual(["Subtopic 1", "Subtopic 2"]);
    });

    it("should not overwrite existing subtopics", () => {
      const original = {
        id: 1,
        version: 1,
        generated: { subtopics: ["Existing subtopic"] },
        data: { ok_no: "OK-1", credits: 3, hours: 45, control_type: "exam", optional: false, prerequisites: [], postrequisites: [], literature: { main: [], additional: [] }, assessments: [], topics: [], warnings: [] }
      };

      const parsed = {
        version: 1,
        generated: { subtopics: ["New subtopic"] },
        data: {}
      };

      const result = coursesService.mergeCourseData(original as any, parsed as any);
      expect(result.generated?.subtopics).toEqual(["Existing subtopic"]);
    });

    it("should use parsed teacher when provided", () => {
      const original = {
        id: 1,
        version: 1,
        generated: null,
        data: { ok_no: "OK-1", credits: 3, hours: 45, control_type: "exam", optional: false, prerequisites: [], postrequisites: [], literature: { main: [], additional: [] }, assessments: [], topics: [], warnings: [] }
      };

      const parsed = {
        teacher: "New Teacher",
        version: 1,
        generated: null,
        data: {}
      };

      const result = coursesService.mergeCourseData(original as any, parsed as any);
      expect(result.teacher).toBe("New Teacher");
    });

    it("should merge data properties", () => {
      const original = {
        id: 1,
        version: 1,
        generated: null,
        data: { ok_no: "OK-1", credits: 3, hours: 45, control_type: "exam", optional: false, prerequisites: [], postrequisites: [], literature: { main: [], additional: [] }, assessments: [], topics: [], warnings: [] }
      };

      const parsed = {
        version: 1,
        generated: null,
        data: { credits: 5 }
      };

      const result = coursesService.mergeCourseData(original as any, parsed as any);
      expect(result.data.credits).toBe(5);
      expect(result.data.ok_no).toBe("OK-1");
    });
  });

  describe("mergeCourseTopic", () => {
    const existingTopic = {
      id: 1,
      course_id: 1,
      index: 1,
      name: "Existing Topic",
      lection: "2",
      data: {
        attestation: 1,
        practices: [{ name: "Existing practice", description: "Existing description" }],
        fulltime: { hours: 10, practical_hours: 5, lab_hours: 0, srs_hours: 5 },
        inabscentia: { hours: 8, practical_hours: 4, lab_hours: 0, srs_hours: 4 }
      },
      generated: null
    };

    it("should merge attestation from parsed", () => {
      const parsed = {
        data: {
          attestation: 2,
          fulltime: { hours: 10, practical_hours: 5, srs_hours: 5 },
          inabscentia: { hours: 8, practical_hours: 4, srs_hours: 4 }
        },
        generated: null
      };

      const result = coursesService.mergeCourseTopic(existingTopic as any, parsed as any);
      expect(result.data.attestation).toBe(2);
    });

    it("should keep existing attestation when parsed is undefined", () => {
      const parsed = {
        data: {
          attestation: undefined,
          fulltime: { hours: 10, practical_hours: 5, srs_hours: 5 },
          inabscentia: { hours: 8, practical_hours: 4, srs_hours: 4 }
        },
        generated: null
      };

      const result = coursesService.mergeCourseTopic(existingTopic as any, parsed as any);
      expect(result.data.attestation).toBe(1);
    });

    it("should merge fulltime hours from parsed", () => {
      const parsed = {
        data: {
          attestation: 1,
          fulltime: { hours: 20, practical_hours: 10, srs_hours: 10 },
          inabscentia: { hours: 8, practical_hours: 4, srs_hours: 4 }
        },
        generated: null
      };

      const result = coursesService.mergeCourseTopic(existingTopic as any, parsed as any);
      expect(result.data.fulltime.hours).toBe(20);
      expect(result.data.fulltime.practical_hours).toBe(10);
      expect(result.data.fulltime.srs_hours).toBe(10);
    });

    it("should keep existing fulltime when parsed values are undefined", () => {
      const parsed = {
        data: {
          attestation: 1,
          fulltime: { hours: undefined, practical_hours: undefined, srs_hours: undefined },
          inabscentia: { hours: 8, practical_hours: 4, srs_hours: 4 }
        },
        generated: null
      };

      const result = coursesService.mergeCourseTopic(existingTopic as any, parsed as any);
      expect(result.data.fulltime.hours).toBe(10);
      expect(result.data.fulltime.practical_hours).toBe(5);
      expect(result.data.fulltime.srs_hours).toBe(5);
    });

    it("should merge inabscentia hours from parsed", () => {
      const parsed = {
        data: {
          attestation: 1,
          fulltime: { hours: 10, practical_hours: 5, srs_hours: 5 },
          inabscentia: { hours: 15, practical_hours: 7, srs_hours: 8 }
        },
        generated: null
      };

      const result = coursesService.mergeCourseTopic(existingTopic as any, parsed as any);
      expect(result.data.inabscentia!.hours).toBe(15);
      expect(result.data.inabscentia!.practical_hours).toBe(7);
      expect(result.data.inabscentia!.srs_hours).toBe(8);
    });

    it("should use parsed name when provided", () => {
      const parsed = {
        name: "New Topic Name",
        data: existingTopic.data,
        generated: null
      };

      const result = coursesService.mergeCourseTopic(existingTopic as any, parsed as any);
      expect(result.name).toBe("New Topic Name");
    });

    it("should keep existing name when parsed name is undefined", () => {
      const parsed = {
        name: undefined,
        data: existingTopic.data,
        generated: null
      };

      const result = coursesService.mergeCourseTopic(existingTopic as any, parsed as any);
      expect(result.name).toBe("Existing Topic");
    });

    it("should use parsed lection when provided", () => {
      const parsed = {
        lection: "4",
        data: existingTopic.data,
        generated: null
      };

      const result = coursesService.mergeCourseTopic(existingTopic as any, parsed as any);
      expect(result.lection).toBe("4");
    });

    it("should preserve course_id", () => {
      const parsed = {
        course_id: 999,
        data: existingTopic.data,
        generated: null
      };

      const result = coursesService.mergeCourseTopic(existingTopic as any, parsed as any);
      expect(result.course_id).toBe(1);
    });

    it("should preserve index", () => {
      const parsed = {
        index: 99,
        data: existingTopic.data,
        generated: null
      };

      const result = coursesService.mergeCourseTopic(existingTopic as any, parsed as any);
      expect(result.index).toBe(1);
    });

    it("should save practices with their descriptions", () => {
      const practices = [
        { name: "Build a Merkle tree", description: "Create the tree and verify a proof." },
      ];
      const parsed = {
        data: {
          ...existingTopic.data,
          practices,
        },
        generated: null,
      };

      const result = coursesService.mergeCourseTopic(existingTopic as any, parsed as any);

      expect(result.data.practices).toEqual(practices);
    });

    it("should normalize legacy string practices when preserving them", () => {
      const legacyTopic = {
        ...existingTopic,
        data: {
          ...existingTopic.data,
          practices: ["Legacy practice"],
        },
      };
      const parsed = {
        data: {
          ...existingTopic.data,
          practices: undefined,
        },
        generated: null,
      };

      const result = coursesService.mergeCourseTopic(legacyTopic as any, parsed as any);

      expect(result.data.practices).toEqual([
        { name: "Legacy practice", description: "" },
      ]);
    });

    it("should preserve lab hours while merging topic data", () => {
      const parsed = {
        data: {
          ...existingTopic.data,
          fulltime: {
            ...existingTopic.data.fulltime,
            hours: 12,
          },
        },
        generated: null,
      };

      const result = coursesService.mergeCourseTopic(existingTopic as any, parsed as any);

      expect(result.data.fulltime).toEqual({
        hours: 12,
        practical_hours: 5,
        lab_hours: 0,
        srs_hours: 5,
      });
      expect(result.data.inabscentia?.lab_hours).toBe(0);
    });
  });
});
