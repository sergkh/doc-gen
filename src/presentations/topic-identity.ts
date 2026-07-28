import type { Course, CourseTopic } from "@/stores/models";

export function findTopicByUid(course: Course, topicUid: string): CourseTopic | null {
  return (course.topics ?? []).find((topic) => topic.uid === topicUid) ?? null;
}
