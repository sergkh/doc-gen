import type { CoursePractice, CourseTopic } from "./models";

export function normalizePractices(value: unknown): CoursePractice[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") {
      const name = item.trim();
      return name ? [{ name, description: "" }] : [];
    }
    if (!item || typeof item !== "object") return [];
    const practice = item as Partial<CoursePractice>;
    const name = typeof practice.name === "string" ? practice.name : "";
    const description = typeof practice.description === "string" ? practice.description : "";
    if (!name && !description && !practice.generated) return [];
    return [{ ...practice, name, description } as CoursePractice];
  });
}

/** Number saved practices in topic order while keeping each practice's content attached. */
export function numberCoursePractices(topics: CourseTopic[]): CourseTopic[] {
  let index = 0;
  return topics.map((topic) => ({
    ...topic,
    data: {
      ...topic.data,
      ...(topic.data?.practices === undefined ? {} : {
        practices: normalizePractices(topic.data.practices).map((practice) => ({ ...practice, index: ++index })),
      }),
    },
  }));
}
