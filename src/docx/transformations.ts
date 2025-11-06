import { generateCourseInfo } from "@/ai/generator";
import { courseResults, courses } from "@/stores/db";
import type { Course, CourseAttestation, CourseGenerationData, CourseSemester, CourseTopic } from "@/stores/models";

declare global {
  interface Array<T> {
    sum(this: Array<number>): number;
  }
}

Array.prototype.sum = function (this: number[]): number {
  return this.reduce((acc, val) => acc + val, 0);
};

function buildAttestations(course: Course, allTopics: CourseTopic[]): CourseAttestation[] {
  // group topics by attestation
  return course.data.attestations.map((a, index) => {
    
    const topics = allTopics.filter(t => t.data?.attestation === index + 1);

    let attestation: CourseAttestation = {
      no: index+1,
      name: a.name,
      semester: a.semester,
      topics,
      fulltime: {
        hours: topics.map(t => t.data.fulltime.hours).sum(),
        practical_hours: topics.map(t => t.data.fulltime.practical_hours).sum(),
        srs_hours: topics.map(t => t.data.fulltime.srs_hours).sum(),
        total_hours: 0
      },
      inabscentia: {
        hours: topics.map(t => t.data.inabscentia.hours).sum(),
        practical_hours: topics.map(t => t.data.inabscentia.practical_hours).sum(),
        srs_hours: topics.map(t => t.data.inabscentia.srs_hours).sum(),
        total_hours: 0
      }
    }
    
    attestation.fulltime.total_hours = attestation.fulltime.hours + attestation.fulltime.practical_hours + attestation.fulltime.srs_hours;
    attestation.inabscentia.total_hours = attestation.inabscentia.hours + attestation.inabscentia.practical_hours + attestation.inabscentia.srs_hours;

    return attestation;
  });  
}

function buildSemesters(attestations: CourseAttestation[]): CourseSemester[] {
  const semesters: CourseSemester[] = [];

  for (const a of attestations) {
    const semester = a.semester;
    if (!semesters[semester]) {
      semesters[semester] = { 
        attestations: [], 
        semester, 
        fulltime: { hours: 0, practical_hours: 0, srs_hours: 0, total_hours: 0 }, 
        inabscentia: { hours: 0, practical_hours: 0, srs_hours: 0, total_hours: 0 } 
      };
    }
    semesters[semester].attestations.push(a);
    semesters[semester].fulltime.hours += a.fulltime.hours;
    semesters[semester].fulltime.practical_hours += a.fulltime.practical_hours;
    semesters[semester].fulltime.srs_hours += a.fulltime.srs_hours;
    semesters[semester].fulltime.total_hours += a.fulltime.total_hours;
    semesters[semester].inabscentia.hours += a.inabscentia.hours;
    semesters[semester].inabscentia.practical_hours += a.inabscentia.practical_hours;
    semesters[semester].inabscentia.srs_hours += a.inabscentia.srs_hours;
    semesters[semester].inabscentia.total_hours += a.inabscentia.total_hours;
  }

  return semesters;
}

/*
 * Loads all possible course information into a single JS object for rendering.
 * Some fields are duplicated to simplify rendering.
 * One can find plain topics list, list grouped by attestations and 
 * list of attestations grouped by semesters.
 * 
 * Hours are mostly calculated from the hours set in course topics data.
 */
export async function loadFullCourseInfo(
  course: Course, 
  topics: CourseTopic[],
  onProgress?: (progress: number) => void,
  apiKey?: string
): Promise<CourseGenerationData> {
  onProgress?.(5);
  
  // Generate course info - this is the slowest part (as might use AI)
  // Progress from 5% to 70% (65% for AI generation)
  const { course: updatedCourse, topics: updatedTopics } = await generateCourseInfo(course, topics, (progress: number) => {
    onProgress?.(5 + progress * 0.65); // Scale progress to 65%
  }, apiKey);
  
  // Estimate progress: if we have N topics, each topic is roughly 65% / N
  // For now, we'll report 70% after generation completes
  onProgress?.(70);

  const prerequisites = await courses.getShortInfos(course.data.prerequisites);
  onProgress?.(80);
  const postrequisites = await courses.getShortInfos(course.data.postrequisites);
  onProgress?.(85);

  const results = await courseResults.list(course.data.results);
  onProgress?.(90);


  const attestations = buildAttestations(course, updatedTopics);
  const semesters: CourseSemester[] = buildSemesters(attestations);
  
  const oneSemesterOnly = course.data.attestations.every(a => a.semester === 1);

  onProgress?.(95);

  const hours = {
    total: course.data.hours,
    fulltime: {
      lectures: updatedTopics.map(t => t.data.fulltime.hours).sum(),
      practicals: updatedTopics.map(t => t.data.fulltime.practical_hours).sum(),
      srs: updatedTopics.map(t => t.data.fulltime.srs_hours).sum(),
    },
    inabscentia: {
      lectures: updatedTopics.map(t => t.data.inabscentia.hours).sum(),
      practicals: updatedTopics.map(t => t.data.inabscentia.practical_hours).sum(),
      srs: updatedTopics.map(t => t.data.inabscentia.srs_hours).sum(),
    }
  }
  
  return {
    course: updatedCourse,
    topics: updatedTopics,
    prerequisites,
    postrequisites,
    generalResults: results.filter(r => r.type === "ЗК").sort((a, b) => a.no - b.no),
    specialResults: results.filter(r => r.type === "СК").sort((a, b) => a.no - b.no),
    programResults: results.filter(r => r.type === "РН").sort((a, b) => a.no - b.no),
    attestations,
    oneSemesterOnly,
    semesters,
    hours
  } as CourseGenerationData
}