import { courses, history, teachers } from "@/stores/db";
import type { Course, CourseTopic, DocVersionRecord, GeneratedCourseData, ParsedData, Prompt, PromptResult } from "@/stores/models";
import { dropEmpty } from "@/client/util/util";
import { CourseNotFoundError } from "./errors";
import { parseSylabusOrProgram } from "@/docx/parse";
import { verifyCourse } from "@/docx/verification";
import { deepEquals } from "bun";
import { runCoursePrompts } from "@/ai/generator";
import { create } from "jsondiffpatch";

async function getCourses(
  specialtyId?: number,
  brief: boolean = false,
  topics: boolean = false,
): Promise<Course[]> {
  let loadedCourses: Course[];

  if (specialtyId) {
    loadedCourses = brief ? await courses.bySpecialtyBrief(specialtyId) as unknown as Course[] : await courses.bySpecialty(specialtyId);
  } else {
    loadedCourses = brief ? await courses.brief() as unknown as Course[] : await courses.all();
  }

  if (topics && loadedCourses.length > 0 && !loadedCourses[0].topics) {
    await Promise.all(
      loadedCourses.map(async (course) => {
        course.topics = (await courses.get(course.id))?.topics ?? [];
      })
    );
  }
  
  return loadedCourses;
}

async function createCourse(c: Course, reason: string = 'Created new course by user'): Promise<Course> {
  console.log("Adding new course", c);
  
  const courseId = (await courses.add(c))[0].id;
  c.id = courseId;

  await history.save({
    object_id: courseId, 
    object_type: 'course',
    type: 'snapshot',
    stamp: new Date(),
    comment: reason,
    data: c 
  } as Partial<DocVersionRecord>);

  return c;
}

function mergeCourseData(original: Course, parsed: Course & ParsedData): Course {
  const generated = original.generated ?? parsed.generated ?? {} as GeneratedCourseData;
  if (parsed.generated?.subtopics && (generated.subtopics?.length ?? 0) === 0) {
    generated.subtopics = parsed.generated.subtopics;
  };

  const data = {
    ...original.data,
    ...dropEmpty(parsed.data, { 
      blacklist: ['prerequisites', 'postrequisites']
    })
  }

  return {
    ...original,
    teacher_id: parsed.teacher_id || original.teacher_id,
    specialty_id: parsed.specialty_id || original.specialty_id,
    teacher: parsed.teacher || original.teacher,
    generated,
    data
  } as Course;
}

async function mergeCourseTopics(courseId: number, parsedTopics: CourseTopic[]) {
  if (parsedTopics.length === 0) return;
  const course = await courses.get(courseId);
  if (!course) return;
  const existingTopics = course.topics ?? [];
  const existingTopicsMap = new Map(existingTopics.map(t => [t.index, t]));

  const merged: CourseTopic[] = [];
  const seen = new Set<number>();

  for (const parsedTopic of parsedTopics) {
    const existingTopic = existingTopicsMap.get(parsedTopic.index);
    if (existingTopic) {
      merged.push(mergeCourseTopic(existingTopic, parsedTopic));
      seen.add(existingTopic.index);
    } else {
      merged.push({ ...parsedTopic, id: 0, course_id: courseId });
      seen.add(parsedTopic.index);
    }
  }

  for (const t of existingTopics) {
    if (!seen.has(t.index)) {
      merged.push(t);
    }
  }

  merged.sort((a, b) => a.index - b.index);
  course.topics = merged;
  await courses.update(course);
}

function mergeCourseTopic(existing: CourseTopic, parsed: CourseTopic) {
  const mergedData = {
    attestation: parsed.data?.attestation ?? existing.data?.attestation,
    fulltime: {    
      hours: parsed.data?.fulltime?.hours ?? existing.data?.fulltime?.hours,
      practical_hours: parsed.data?.fulltime?.practical_hours ?? existing.data?.fulltime?.practical_hours,
      srs_hours: parsed.data?.fulltime?.srs_hours ?? existing.data?.fulltime?.srs_hours,
    },
    inabscentia: {
      hours: parsed.data?.inabscentia?.hours ?? existing.data?.inabscentia?.hours,
      practical_hours: parsed.data?.inabscentia?.practical_hours ?? existing.data?.inabscentia?.practical_hours,
      srs_hours: parsed.data?.inabscentia?.srs_hours ?? existing.data?.inabscentia?.srs_hours
    }
  }

  return {
    id: existing.id,
    course_id: existing.course_id,
    index: existing.index,
    name: parsed.name ?? existing.name,
    lection: parsed.lection ?? existing.lection,
    data: mergedData,
    generated: existing.generated
  } as CourseTopic;
}

async function handleTeacher(course: Course & ParsedData) {
  if (course.parsed_teacher) {
    if (course.parsed_teacher.id === -1) {
      const id = (await teachers.add(course.parsed_teacher))[0].id;
      course.teacher_id = id;
    } else if (course.type === "syllabus") {
      const dbTeacher = await teachers.get(course.parsed_teacher.id);

      if (dbTeacher) {
        const updatedTeacher = { 
          ...dbTeacher, 
          name: dbTeacher.name.length < course.parsed_teacher.name.length ? course.parsed_teacher.name : dbTeacher.name,
          position: course.parsed_teacher.position ?? dbTeacher.position,
          email: course.parsed_teacher.email ?? dbTeacher.email,
          academic_title: course.parsed_teacher.academic_title ?? dbTeacher.academic_title
        };
        await teachers.update(updatedTeacher);                  
      }
      
      await teachers.update(course.parsed_teacher);
      course.teacher_id = course.parsed_teacher.id;
    }
  }
}

async function updateCourseInt(updated: Course, old: Course, reason: string): Promise<void> {
  if (deepEquals(updated, old)) return;
  await courses.update(updated);
  await history.saveHistory(old, updated, reason, "course");
}

async function updateCourse(id: number, updated: Course, reason: string): Promise<Course> {
  const oldCourse = await coursesService.getCourseById(Number(id));
      
  if (!oldCourse) {
    throw new CourseNotFoundError(id);
  }

  console.log("Updating course with ID:", id, updated); 

  await updateCourseInt(updated, oldCourse, reason);
  return {...updated, version: updated.version + 1 };
}

async function updateCourseFromParsed(course: Course & ParsedData, dbCourse: Course | null) {
  await handleTeacher(course);

  let updated = dbCourse ? mergeCourseData(dbCourse, course) : course;
  
  if (dbCourse) {
    updated.topics = course.topics;
    await updateCourseInt(updated, dbCourse, `Doc upload`);
  } else {
    updated.topics = course.topics;
    const stored = await createCourse(updated, 'Doc upload');
  }

  return course;
}

async function deleteCourse(id: number) {
  const course = await courses.get(id);
      
  console.log("Deleting course with ID:", id);

  if (!course) {
    throw new CourseNotFoundError(id);
  }

  await history.createTombstone("course", course, "Deleted by user");
  await courses.delete(id);
}

async function getCourseById(id: number) {
  const course = await courses.get(id);
  // TODO: migration - remove after all courses have initial history entries
  if (course) {
    const historyEntries = await history.forObject("course", id, 1);
    if (historyEntries.length === 0) {
      await history.save({
        object_id: id,
        object_type: "course",
        type: "snapshot",
        stamp: new Date(),
        comment: "Initial history entry (migration)",
        data: course,
      } as Partial<DocVersionRecord>);
    }
  }
  return course;
}

async function parseCourseDataUpload(filepath: string, okNo: string | null): Promise<Course | null> {
  const course = await parseSylabusOrProgram(filepath, true, { okNo });
            
  if (!course) return null;

  const dbCourse = await courses.findByName(course.name);

  console.log("Searching by name:", course.name, "Found in DB:", dbCourse);

  const { issues } = verifyCourse(course);
  const warnings = [...course.parse_warnings, ...issues];        
  course.data.warnings = warnings;

  console.log(dbCourse ? "Updating course" : "Adding new course");        
  
  await updateCourseFromParsed(course, dbCourse);

  return course;
}

async function runPrompt(id: number, prompt: Prompt, apiKey?: string): Promise<PromptResult[]> {
  const course = await courses.get(id);
  if (!course) {
    throw new CourseNotFoundError(id);
  }

  const topics = course.topics ?? [];
  if (topics.length === 0) {
    throw new Error("У дисципліни немає тем");
  }

  return await runCoursePrompts([prompt], course, topics, apiKey ?? null, true);
}

async function savePromptResult(id: number, field: string, value: any) {
  const course = await courses.get(id);
  console.log("got course: ", course?.id, course?.version)
  if (!course) {
    throw new CourseNotFoundError(id);
  }

  const generated = {
    ...(course.generated || {}),
    [field]: value
  } as GeneratedCourseData;
    
  console.log(`Saving prompt result for course: ${course.name}, field: ${field}, item:`, value);

  await updateCourseInt(
    { ...course, generated }, 
    course,
    `Saved prompt result for field ${field}`
  );
}


async function getCourseHistory(courseId: number) {
  return history.forObject("course", courseId);
}

async function revertToHistory(courseId: number, historyId: number): Promise<Course> {
  const records = await history.forObject("course", courseId);
  // Sort ASC (oldest first)
  const sorted = records.sort((a, b) => new Date(a.stamp).getTime() - new Date(b.stamp).getTime());

  const targetIdx = sorted.findIndex(r => r.id === historyId);
  if (targetIdx === -1) {
    throw new Error("Запис історії не знайдено");
  }

  // Start from current course state
  const current = await courses.get(courseId);
  if (!current) {
    throw new Error("Дисципліну не знайдено");
  }
  let state = JSON.parse(JSON.stringify(current)) as Course;

  const diffpatcher = create();

  // Walk backwards from the newest history entry to the one just after target,
  // reversing patches to undo changes.
  for (let i = sorted.length - 1; i > targetIdx; i--) {
    const entry = sorted[i];
    if (entry.type === "patch") {
      try {
        state = diffpatcher.unpatch(state, entry.data) as Course;
      } catch (e) {
        console.error("Unpatch failed at index", i, ":", (e as Error).message);
        throw new Error(`Помилка скасування зміни: ${(e as Error).message}`);
      }
    }
    // snapshots are skipped — the forward patches between them and
    // the current state are what we reverse via unpatch above
  }

  state.id = courseId;
  await courses.update(state);

  await history.save({
    object_id: courseId,
    object_type: "course",
    type: "snapshot",
    stamp: new Date(),
    comment: `Відновлено до запису історії #${historyId}`,
    data: state,
  } as Partial<DocVersionRecord>);

  return state;
}

export const coursesService = {
  createCourse,
  getCourses,
  mergeCourseData,
  mergeCourseTopics,
  mergeCourseTopic,
  updateCourse,
  parseCourseDataUpload,
  deleteCourse,
  getCourseById,
  getCourseHistory,
  revertToHistory,
  runPrompt,
  savePromptResult
};
