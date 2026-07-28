import type { CourseTopic } from "@/stores/models";
import type { AIGeneratedTopic } from "../courses";

interface AddGeneratedTopicsArgs {
  topics: CourseTopic[];
  generatedTopics: AIGeneratedTopic[];
  courseId: number;
}

export function addGeneratedTopicsToCourseTopics({ topics, generatedTopics, courseId }: AddGeneratedTopicsArgs) {
  const nextTopics = generatedTopics.reduce<CourseTopic[]>((acc, gen) => {
    const topicData: CourseTopic = {
      uid: crypto.randomUUID(),
      course_id: courseId,
      index: acc.length + topics.length + 1,
      name: gen.name,
      lection: "",
      data: {
        attestation: 1,
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
