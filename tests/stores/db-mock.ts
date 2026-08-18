import { mock } from "bun:test";

// Mock the DB module to avoid initializing the real database during tests
mock.module("@/stores/db", () => {
  const emptyArray = async () => [];
  const emptyObjectArray = async () => [{}];
  const nullValue = async () => null;

  return {
    specialties: {
      all: emptyArray,
      get: nullValue,
      findByName: nullValue,
      findByCode: nullValue,
      add: emptyObjectArray,
      update: emptyObjectArray,
      delete: nullValue,
    },
    courseResults: {
      all: emptyArray,
      list: emptyArray,
      bySpecialty: emptyArray,
      get: nullValue,
      add: async () => 1,
      update: emptyObjectArray,
      delete: nullValue,
    },
    courses: {
      all: emptyArray,
      brief: emptyArray,
      bySpecialty: emptyArray,
      bySpecialtyBrief: emptyArray,
      add: async (c: any) => [{ id: c?.id ?? 1 }],
      get: nullValue,
      findByName: nullValue,
      getShortInfos: emptyArray,
      update: emptyObjectArray,
      delete: nullValue,
    },
    courseTopics: {
      all: emptyArray,
      byCourseIds: emptyArray,
      get: nullValue,
      add: emptyObjectArray,
      update: emptyObjectArray,
      updateOrdering: nullValue,
      delete: nullValue,
    },
    history: {
      save: nullValue,
      saveHistory: nullValue,
      createTombstone: nullValue,
    },
    teachers: {
      all: emptyArray,
      get: nullValue,
      findByName: nullValue,
      add: emptyObjectArray,
      update: emptyObjectArray,
      delete: nullValue,
    },
    teacherPublications: {
      all: emptyArray,
      byTeacher: emptyArray,
      get: nullValue,
      add: emptyObjectArray,
      update: emptyObjectArray,
      delete: nullValue,
      deleteByTeacher: nullValue,
    },
    teacherTimesheets: {
      get: nullValue,
      save: async () => ({}),
    },
    templates: {
      all: emptyArray,
      get: nullValue,
      add: emptyObjectArray,
      update: emptyObjectArray,
      delete: nullValue,
    },
  } as any;
});

export default mock;
