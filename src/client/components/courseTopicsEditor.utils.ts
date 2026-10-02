import type { CoursePractice, CourseTopic } from "@/stores/models";
import { normalizePractices } from "@/stores/practices";
import type { AIGeneratedTopic } from "../courses";

interface AddGeneratedTopicsArgs {
  topics: CourseTopic[];
  generatedTopics: AIGeneratedTopic[];
  courseId: number;
}

export function normalizeCoursePractices(practices: unknown): CoursePractice[] {
  return normalizePractices(practices);
}

export function addGeneratedTopicsToCourseTopics({ topics, generatedTopics, courseId }: AddGeneratedTopicsArgs) {
  const nextTopics = generatedTopics.reduce<CourseTopic[]>((acc, gen) => {
    const topicData: CourseTopic = {
      course_id: courseId,
      index: acc.length + topics.length + 1,
      name: gen.name,
      lection: "",
      data: {
        attestation: 1,
        practices: [],
        fulltime: { hours: 2, practical_hours: 0, lab_hours: 0, srs_hours: 0 },
        inabscentia: { hours: 0, practical_hours: 0, lab_hours: 0, srs_hours: 0 },
      },
      generated: { subtopics: gen.subtopics, keywords: [], topics: [], referats: [], quiz: [], keyQuestions: [] },
    } as CourseTopic;

    return [...acc, topicData];
  }, []);

  return {
    topics: [...topics, ...nextTopics],
    remainingGeneratedTopics: [],
  };
}
