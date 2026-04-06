import { create } from "jsondiffpatch";
import type { PostgrestError } from "@supabase/supabase-js";
import type { Course, CourseResult, CourseTopic, DocObjectType, DocVersionRecord, KeyValue, ShortCourseInfo, Specialty, Teacher, TeacherPublication, Template } from "./models";
import { ConcurrentModificationError } from "@/services/errors";
import { supabase } from "./supabase";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Throws if the Supabase response contains an error. */
function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) {
    throw new Error(`Database error: ${result.error.message} (code: ${result.error.code})`);
  }
  return result.data as T;
}

/** Flattens the nested `teachers` object returned by embedded selects into a `teacher` string field. */
function flattenTeacher<T extends { teachers?: { name: string } | null }>(
  row: T
): Omit<T, "teachers"> & { teacher: string | null } {
  const { teachers, ...rest } = row;
  return { ...rest, teacher: teachers?.name ?? null } as any;
}

function drop(obj: Record<string, any>, ...fields: string[]) {
  const result = { ...obj };
  for (const field of fields) {
    delete result[field];
  }
  return result;
}

// ---------------------------------------------------------------------------
// History / versioning
// ---------------------------------------------------------------------------

const history = {
  _diffpatcher: create(),

  forObject: async (type: DocObjectType, id: number, limit: number = 10): Promise<DocVersionRecord[]> => {
    return unwrap(
      await supabase
        .from("doc_version_records")
        .select("*")
        .eq("object_type", type)
        .eq("object_id", id)
        .order("stamp", { ascending: false })
        .limit(limit)
    ) as DocVersionRecord[];
  },

  save: async (record: Partial<DocVersionRecord>) => {
    return unwrap(
      await supabase
        .from("doc_version_records")
        .insert({
          object_id: record.object_id,
          object_type: record.object_type,
          type: record.type,
          stamp: record.stamp,
          comment: record.comment,
          data: record.data,
        })
        .select()
    );
  },

  createTombstone: async (type: DocObjectType, entity: { id: number }, reason: string) => {
    history.save({
      object_id: entity.id,
      object_type: type,
      type: "tombstone",
      stamp: new Date(),
      comment: reason,
      data: entity,
    });
  },

  saveHistory: async (
    oldData: { id: number } | null,
    newData: { id: number },
    reason: string,
    objType: DocObjectType
  ) => {
    const type = Math.random() < 0.2 || oldData === null ? "snapshot" : "patch";
    const objId = newData.id;

    const entry: Partial<DocVersionRecord> = {
      object_id: objId,
      object_type: objType,
      type,
      stamp: new Date(),
      comment: reason,
      data:
        type === "snapshot"
          ? newData
          : history._diffpatcher.diff(
              drop(oldData!, "created_at", "updated_at"),
              drop(newData, "created_at", "updated_at")
            ),
    };

    await history.save(entry);
  },
};

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

const courses = {
  all: async (): Promise<Course[]> => {
    const rows = unwrap(
      await supabase.from("courses").select("*, teachers(name)").order("name")
    );
    return (rows as any[]).map(flattenTeacher) as Course[];
  },

  brief: async (): Promise<KeyValue[]> => {
    return unwrap(
      await supabase.from("courses").select("id, name").order("name")
    ) as KeyValue[];
  },

  bySpecialty: async (specialtyId: number): Promise<Course[]> => {
    const rows = unwrap(
      await supabase
        .from("courses")
        .select("*, teachers(name)")
        .eq("specialty_id", specialtyId)
        .order("name")
    );
    return (rows as any[]).map(flattenTeacher) as Course[];
  },

  bySpecialtyBrief: async (specialtyId: number): Promise<KeyValue[]> => {
    return unwrap(
      await supabase
        .from("courses")
        .select("id, name")
        .eq("specialty_id", specialtyId)
        .order("name")
    ) as KeyValue[];
  },

  add: async (c: Course) => {
    return unwrap(
      await supabase
        .from("courses")
        .insert({ name: c.name, teacher_id: c.teacher_id, data: c.data, generated: c.generated })
        .select()
    );
  },

  get: async (id: number): Promise<Course | null> => {
    const { data, error } = await supabase
      .from("courses")
      .select("*, teachers(name)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Database error: ${error.message}`);
    return data ? flattenTeacher(data as any) as Course : null;
  },

  findByName: async (name: string): Promise<Course | null> => {
    const { data, error } = await supabase
      .from("courses")
      .select("*, teachers(name)")
      .eq("name", name)
      .maybeSingle();
    if (error) throw new Error(`Database error: ${error.message}`);
    return data ? flattenTeacher(data as any) as Course : null;
  },

  getShortInfos: async (list: number[]): Promise<ShortCourseInfo[]> => {
    if (list.length === 0) return [];
    const rows = unwrap(
      await supabase.from("courses").select("id, name, teachers(name)").in("id", list)
    );
    return (rows as any[]).map(flattenTeacher) as ShortCourseInfo[];
  },

  update: async (course: Course) => {
    const { data, error } = await supabase
      .from("courses")
      .update({
        name: course.name,
        teacher_id: course.teacher_id,
        data: course.data,
        generated: course.generated,
        version: course.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", course.id)
      .eq("version", course.version)
      .select("id");

    if (error) throw new Error(`Database error: ${error.message}`);
    if (!data || data.length === 0) {
      throw new ConcurrentModificationError(course.id, course.version);
    }
    return data;
  },

  delete: async (id: number) => {
    // Delete course topics first (no foreign key cascade)
    unwrap(await supabase.from("course_topics").delete().eq("course_id", id));
    // Then delete the course
    return unwrap(await supabase.from("courses").delete().eq("id", id));
  },
};

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

const teachers = {
  all: async (): Promise<Teacher[]> => {
    return unwrap(
      await supabase.from("teachers").select("*").order("name")
    ) as Teacher[];
  },

  get: async (id: number): Promise<Teacher | null> => {
    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Database error: ${error.message}`);
    return data as Teacher | null;
  },

  findByName: async (name: string): Promise<Teacher | null> => {
    const nameParts = name
      .split(/[\.\s]+/)
      .map((n) => (n.trim().endsWith(".") ? n.trim().slice(0, -1) : n.trim()))
      .filter((n) => n.length > 0);
    const likePattern =
      nameParts[0] + " " + nameParts.slice(1).map((n) => `${n}%`).join(" ");
    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .ilike("name", likePattern)
      .maybeSingle();
    if (error) throw new Error(`Database error: ${error.message}`);
    return data as Teacher | null;
  },

  add: async (teacher: Teacher) => {
    return unwrap(
      await supabase
        .from("teachers")
        .insert({
          name: teacher.name,
          email: teacher.email,
          position: teacher.position,
          academic_title: teacher.academic_title,
          alt_names: teacher.alt_names,
        })
        .select()
    );
  },

  update: async (teacher: Teacher) => {
    return unwrap(
      await supabase
        .from("teachers")
        .update({
          name: teacher.name,
          email: teacher.email,
          position: teacher.position,
          academic_title: teacher.academic_title,
          alt_names: teacher.alt_names,
          updated_at: new Date().toISOString(),
        })
        .eq("id", teacher.id)
        .select()
    );
  },

  delete: async (id: number) => {
    return unwrap(await supabase.from("teachers").delete().eq("id", id));
  },
};

// ---------------------------------------------------------------------------
// Teacher Publications
// ---------------------------------------------------------------------------

const teacherPublications = {
  all: async (): Promise<TeacherPublication[]> => {
    return unwrap(
      await supabase
        .from("teacher_publications")
        .select("*")
        .order("year", { ascending: false })
        .order("title")
    ) as TeacherPublication[];
  },

  byTeacher: async (teacherId: number): Promise<TeacherPublication[]> => {
    return unwrap(
      await supabase
        .from("teacher_publications")
        .select("*")
        .eq("teacher_id", teacherId)
        .order("year", { ascending: false })
        .order("title")
    ) as TeacherPublication[];
  },

  get: async (id: number): Promise<TeacherPublication | null> => {
    const { data, error } = await supabase
      .from("teacher_publications")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Database error: ${error.message}`);
    return data as TeacherPublication | null;
  },

  add: async (publication: Omit<TeacherPublication, "id">) => {
    return unwrap(
      await supabase
        .from("teacher_publications")
        .insert({
          teacher_id: publication.teacher_id,
          title: publication.title,
          year: publication.year,
          journal: publication.journal,
          publication_type: publication.publication_type,
          repo_id: publication.repo_id,
          data: publication.data,
        })
        .select()
    );
  },

  update: async (publication: TeacherPublication) => {
    return unwrap(
      await supabase
        .from("teacher_publications")
        .update({
          teacher_id: publication.teacher_id,
          title: publication.title,
          year: publication.year,
          journal: publication.journal,
          publication_type: publication.publication_type,
          repo_id: publication.repo_id,
          data: publication.data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", publication.id)
        .select()
    );
  },

  delete: async (id: number) => {
    return unwrap(await supabase.from("teacher_publications").delete().eq("id", id));
  },

  deleteByTeacher: async (teacherId: number) => {
    return unwrap(
      await supabase.from("teacher_publications").delete().eq("teacher_id", teacherId)
    );
  },
};

// ---------------------------------------------------------------------------
// Course Topics
// ---------------------------------------------------------------------------

const courseTopics = {
  all: async (courseId: number): Promise<CourseTopic[]> => {
    return unwrap(
      await supabase
        .from("course_topics")
        .select("*")
        .eq("course_id", courseId)
        .order("index")
    ) as CourseTopic[];
  },

  byCourseIds: async (courseIds: number[]): Promise<CourseTopic[]> => {
    if (courseIds.length === 0) return [];
    return unwrap(
      await supabase
        .from("course_topics")
        .select("*")
        .in("course_id", courseIds)
        .order("course_id")
        .order("index")
    ) as CourseTopic[];
  },

  get: async (id: number): Promise<CourseTopic | null> => {
    const { data, error } = await supabase
      .from("course_topics")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Database error: ${error.message}`);
    return data as CourseTopic | null;
  },

  add: async (topic: CourseTopic) => {
    return unwrap(
      await supabase
        .from("course_topics")
        .insert({
          course_id: topic.course_id,
          index: topic.index,
          name: topic.name,
          lection: topic.lection,
          generated: topic.generated,
          data: topic.data,
        })
        .select()
    );
  },

  update: async (topic: CourseTopic) => {
    return unwrap(
      await supabase
        .from("course_topics")
        .update({
          index: topic.index,
          name: topic.name,
          lection: topic.lection,
          generated: topic.generated,
          data: topic.data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", topic.id)
        .select()
    );
  },

  updateOrdering: async (courseId: number, topics: number[]) => {
    await Promise.all(
      topics.map((topicId, index) =>
        supabase
          .from("course_topics")
          .update({ index: index + 1 })
          .eq("id", topicId)
          .eq("course_id", courseId)
      )
    );
  },

  delete: async (id: number) => {
    return unwrap(await supabase.from("course_topics").delete().eq("id", id));
  },
};

// ---------------------------------------------------------------------------
// Course Results (Learning Outcomes / Competencies)
// ---------------------------------------------------------------------------

const courseResults = {
  all: async (): Promise<CourseResult[]> => {
    const rows = unwrap(
      await supabase
        .from("course_results")
        .select("id, no, specialty_id, type, name, specialties(code, name, area_code, area)")
        .order("specialty_id")
        .order("type")
        .order("no")
    );
    return (rows as any[]).map((row: any) => {
      const { specialties: s, ...rest } = row;
      return {
        ...rest,
        specialty_code: s?.code ?? null,
        specialty_name: s?.name ?? null,
        specialty_area_code: s?.area_code ?? null,
        specialty_area: s?.area ?? null,
      };
    }) as CourseResult[];
  },

  list: async (ids: number[]): Promise<CourseResult[]> => {
    if (ids.length === 0) return [];
    return unwrap(
      await supabase
        .from("course_results")
        .select("*")
        .in("id", ids)
        .order("type")
        .order("no")
    ) as CourseResult[];
  },

  bySpecialty: async (specialtyId: number): Promise<CourseResult[]> => {
    return unwrap(
      await supabase
        .from("course_results")
        .select("*")
        .eq("specialty_id", specialtyId)
        .order("type")
        .order("no")
    ) as CourseResult[];
  },

  get: async (id: number): Promise<CourseResult | null> => {
    const { data, error } = await supabase
      .from("course_results")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Database error: ${error.message}`);
    return data as CourseResult | null;
  },

  add: async (result: CourseResult): Promise<number> => {
    const rows = unwrap(
      await supabase
        .from("course_results")
        .upsert(
          { no: result.no, type: result.type, name: result.name, specialty_id: result.specialty_id },
          { onConflict: "no,type,specialty_id" }
        )
        .select()
    );
    return (rows as any[])[0].id;
  },

  update: async (result: CourseResult) => {
    return unwrap(
      await supabase
        .from("course_results")
        .update({
          no: result.no,
          type: result.type,
          name: result.name,
          specialty_id: result.specialty_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", result.id)
        .select()
    );
  },

  delete: async (id: number) => {
    return unwrap(await supabase.from("course_results").delete().eq("id", id));
  },
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const templates = {
  all: async (): Promise<Template[]> => {
    return unwrap(
      await supabase.from("templates").select("*").order("name")
    ) as Template[];
  },

  get: async (id: number): Promise<Template | null> => {
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Database error: ${error.message}`);
    return data as Template | null;
  },

  add: async (template: Template) => {
    return unwrap(
      await supabase
        .from("templates")
        .insert({ name: template.name, file: template.file, data: template.data, prompts: template.prompts })
        .select()
    );
  },

  update: async (template: Template) => {
    return unwrap(
      await supabase
        .from("templates")
        .update({
          name: template.name,
          file: template.file,
          data: template.data,
          prompts: template.prompts,
          updated_at: new Date().toISOString(),
        })
        .eq("id", template.id)
        .select()
    );
  },

  delete: async (id: number) => {
    return unwrap(await supabase.from("templates").delete().eq("id", id));
  },
};

// ---------------------------------------------------------------------------
// Specialties
// ---------------------------------------------------------------------------

const specialties = {
  all: async (): Promise<Specialty[]> => {
    return unwrap(
      await supabase.from("specialties").select("*").order("code").order("name")
    ) as Specialty[];
  },

  get: async (id: number): Promise<Specialty | null> => {
    const { data, error } = await supabase
      .from("specialties")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Database error: ${error.message}`);
    return data as Specialty | null;
  },

  findByName: async (name: string): Promise<Specialty | null> => {
    const { data, error } = await supabase
      .from("specialties")
      .select("*")
      .or(`name.eq.${name},old_name.eq.${name}`)
      .maybeSingle();
    if (error) throw new Error(`Database error: ${error.message}`);
    return data as Specialty | null;
  },

  findByCode: async (code: string): Promise<Specialty | null> => {
    console.log("Searching specialty by code:", code);
    const { data, error } = await supabase
      .from("specialties")
      .select("*")
      .or(`code.eq.${code},old_code.eq.${code}`)
      .maybeSingle();
    if (error) throw new Error(`Database error: ${error.message}`);
    return data as Specialty | null;
  },

  add: async (specialty: Omit<Specialty, "id">) => {
    return unwrap(
      await supabase
        .from("specialties")
        .insert({
          code: specialty.code,
          name: specialty.name,
          old_code: specialty.old_code,
          old_name: specialty.old_name,
          area_code: specialty.area_code,
          area: specialty.area,
          qualification: specialty.qualification,
          data: specialty.data,
        })
        .select()
    );
  },

  update: async (specialty: Specialty) => {
    return unwrap(
      await supabase
        .from("specialties")
        .update({
          name: specialty.name,
          code: specialty.code,
          old_code: specialty.old_code,
          old_name: specialty.old_name,
          area_code: specialty.area_code,
          area: specialty.area,
          qualification: specialty.qualification,
          data: specialty.data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", specialty.id)
        .select()
    );
  },

  delete: async (id: number) => {
    return unwrap(await supabase.from("specialties").delete().eq("id", id));
  },
};


// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { courses, teachers, courseTopics, courseResults, templates, specialties, teacherPublications, history };
