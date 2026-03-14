import { courses, courseTopics, history, teachers } from "@/stores/db";
import type { Course, CourseTopic, DocVersionRecord, GeneratedCourseData, ParsedData, Prompt, PromptResult } from "@/stores/models";
import { dropEmpty } from "@/client/util/util";
import { CourseNotFoundError } from "./errors";
import { parseSylabusOrProgram } from "@/docx/parse";
import { verifyCourse } from "@/docx/verification";
import { deepEqual } from "assert";
import { deepEquals } from "bun";
import { runCoursePrompts } from "@/ai/generator";

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

  // not nice, but works for now
  if (topics) {
    await Promise.all(
      loadedCourses.map(async (course) => {
        const courseTopicsList = await courseTopics.all(course.id);
        (course as Course & { topics: CourseTopic[] }).topics = courseTopicsList;
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
  if (parsedTopics.length === 0) return ;
  const existingTopics = await courseTopics.all(courseId);
  const existingTopicsMap = new Map(existingTopics.map(t => [t.index, t]));

  if (existingTopics.length === 0) {
    await Promise.all(
      parsedTopics
        .map(c => Object.assign(c, { course_id: courseId }))
        .map(c => courseTopics.add(c))
    );
    return;
  } else {    
    for (const parsedTopic of parsedTopics) {
      const existingTopic = existingTopicsMap.get(parsedTopic.index);
      if (existingTopic) {
        await courseTopics.update(mergeCourseTopic(existingTopic, parsedTopic));
      } else {
        await courseTopics.add(Object.assign(parsedTopic, { course_id: courseId }));
      }
    }
  }
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
    await updateCourseInt(updated, dbCourse, `Doc upload`);
    mergeCourseTopics(dbCourse.id, course.topics);
  } else {
    const stored = await createCourse(updated, 'Doc upload') 

    await Promise.all(
      course.topics
        .map(c => Object.assign(c, { course_id: stored.id }))
        .map(c => courseTopics.add(c))
    );
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
  return courses.get(id);
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

  const topics = await courseTopics.all(id);
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


export const coursesService = {
  createCourse,
  getCourses,
  mergeCourseData,
  updateCourse,
  parseCourseDataUpload,
  deleteCourse,
  getCourseById,
  runPrompt,
  savePromptResult
};
