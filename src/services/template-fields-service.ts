import { formatPrompt } from "@/ai/prompt";
import type { Course, CourseTopic, GeneratedCourseData, Prompt, QuizQuestion, Template } from "@/stores/models";

export type TemplateFieldInput = {
  field: string;
  value: unknown;
  topicIndex?: number;
};

export type TemplateFieldDependency = {
  field: string;
  scope: "course" | "topic";
  relation: "single" | "same_topic" | "all_topics";
};

export type TemplateFieldResult = {
  field: string;
  scope: "course" | "topic";
  topicIndex?: number;
  status: "accepted" | "blocked" | "invalid";
  missingDependencies?: string[];
  message?: string;
};

const BUILT_IN_CONTEXT_FIELDS = new Set([
  "courseName", "courseDescription", "name", "lection", "topics", "subtopics", "course", "hours",
]);

function promptReferences(prompt: Prompt): string[] {
  const references = new Set<string>();
  const expression = /\{\{\s*([^{}]+?)\s*\}\}/g;
  for (const source of [prompt.system_prompt, prompt.prompt]) {
    for (const match of source.matchAll(expression)) {
      const path = match[1]?.split("|", 1)[0]?.trim();
      const root = path?.split(".")[0];
      if (root) references.add(root);
    }
  }
  return [...references];
}

export function getPromptDependencies(template: Template, prompt: Prompt): TemplateFieldDependency[] {
  const requested = new Set(promptReferences(prompt).filter((field) =>
    template.prompts.some((candidate) => candidate.field === field && candidate !== prompt)
    || !BUILT_IN_CONTEXT_FIELDS.has(field)
  ));
  const dependencies: TemplateFieldDependency[] = [];

  for (const field of requested) {
    const dependencyPrompt = template.prompts.find((candidate) => candidate.field === field);
    const dependencyScope = dependencyPrompt?.type ?? prompt.type;
    dependencies.push({
      field,
      scope: dependencyScope,
      relation: prompt.type === "topic" && dependencyScope === "topic"
        ? "same_topic"
        : prompt.type === "course" && dependencyScope === "topic"
          ? "all_topics"
          : "single",
    });
  }

  return dependencies;
}

export function outputSchemaForPrompt(prompt: Prompt): Record<string, unknown> {
  if (prompt.format === "list") return { type: "array", items: { type: "string" } };
  if (prompt.format === "quiz") {
    return {
      type: "array",
      items: {
        type: "object",
        required: ["question", "options", "answerIndex"],
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answerIndex: { type: "integer", minimum: 0 },
        },
      },
    };
  }
  return { type: "string" };
}

export function buildTemplateManifest(template: Template) {
  return {
    id: template.id,
    name: template.name,
    parameters: template.data?.parameters ?? [],
    generatedFields: template.prompts.map((prompt, order) => ({
      order,
      field: prompt.field,
      name: prompt.name,
      scope: prompt.type,
      instructions: {
        system: prompt.system_prompt,
        user: prompt.prompt,
      },
      outputSchema: outputSchemaForPrompt(prompt),
      dependsOn: getPromptDependencies(template, prompt),
    })),
  };
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && (!Array.isArray(value) || value.length > 0);
}

function validateValue(prompt: Prompt, value: unknown): string | null {
  if (prompt.format === "text") return typeof value === "string" ? null : "Очікується рядок.";
  if (!Array.isArray(value)) return "Очікується масив.";
  if (prompt.format === "list") {
    return value.every((item) => typeof item === "string") ? null : "Очікується масив рядків.";
  }
  const validQuiz = value.every((item): item is QuizQuestion => {
    if (!item || typeof item !== "object") return false;
    const quiz = item as Partial<QuizQuestion>;
    return typeof quiz.question === "string"
      && Array.isArray(quiz.options)
      && quiz.options.every((option) => typeof option === "string")
      && Number.isInteger(quiz.answerIndex)
      && quiz.answerIndex! >= 0
      && quiz.answerIndex! < quiz.options.length;
  });
  return validQuiz ? null : "Очікується масив тестових питань з коректними question, options та answerIndex.";
}

function dependencyKey(dependency: TemplateFieldDependency, topicIndex?: number): string {
  if (dependency.relation === "same_topic") return `topic[${topicIndex}].${dependency.field}`;
  if (dependency.relation === "all_topics") return `all_topics.${dependency.field}`;
  return `${dependency.scope}.${dependency.field}`;
}

function missingDependencies(
  dependencies: TemplateFieldDependency[],
  courseGenerated: Record<string, unknown>,
  topics: CourseTopic[],
  topicIndex?: number,
): string[] {
  return dependencies.flatMap((dependency) => {
    if (dependency.relation === "all_topics") {
      return topics.length > 0 && topics.every((topic) => hasValue(topic.generated?.[dependency.field]))
        ? []
        : [dependencyKey(dependency, topicIndex)];
    }
    if (dependency.relation === "same_topic") {
      const topic = topics.find((candidate) => candidate.index === topicIndex);
      return topic && hasValue(topic.generated?.[dependency.field]) ? [] : [dependencyKey(dependency, topicIndex)];
    }
    return hasValue(courseGenerated[dependency.field]) ? [] : [dependencyKey(dependency, topicIndex)];
  });
}

function contextFor(prompt: Prompt, course: Course, topics: CourseTopic[], topic?: CourseTopic): Record<string, unknown> {
  const state = prompt.type === "course" ? course.generated ?? {} : topic?.generated ?? {};
  return {
    ...course.generated ?? {},
    ...state,
    courseName: course.name,
    courseDescription: course.data.description ?? "",
    name: topic?.name,
    lection: topic?.lection ?? topic?.name,
    topics: topics.map((item) => item.name).join(", "),
    subtopics: topics.flatMap((item) => item.generated?.subtopics ?? []).join(", "),
    course,
  };
}

export function getFillableTemplateFields(template: Template, course: Course) {
  const topics = course.topics ?? [];
  const courseGenerated: Record<string, unknown> = course.generated ?? {};
  return template.prompts.flatMap((prompt) => {
    const targets = prompt.type === "course" ? [undefined] : topics;
    return targets.flatMap((topic) => {
      const current = prompt.type === "course" ? courseGenerated[prompt.field] : topic?.generated?.[prompt.field];
      if (hasValue(current)) return [];
      const dependencies = getPromptDependencies(template, prompt);
      const missing = missingDependencies(dependencies, courseGenerated, topics, topic?.index);
      if (missing.length > 0) return [];
      const context = contextFor(prompt, course, topics, topic);
      return [{
        field: prompt.field,
        scope: prompt.type,
        ...(topic ? { topicIndex: topic.index, topicName: topic.name } : {}),
        systemPrompt: formatPrompt(prompt.system_prompt, context),
        prompt: formatPrompt(prompt.prompt, context),
        outputSchema: outputSchemaForPrompt(prompt),
      }];
    });
  });
}

export function applyTemplateFields(template: Template, course: Course, inputs: TemplateFieldInput[]) {
  let updatedCourse: Course = {
    ...course,
    generated: { ...(course.generated ?? {}) } as GeneratedCourseData,
    topics: (course.topics ?? []).map((topic) => ({ ...topic, generated: { ...(topic.generated ?? {}) } })),
  };
  const results: TemplateFieldResult[] = [];
  const remaining = inputs.map((input, inputIndex) => ({ input, inputIndex }));

  while (remaining.length > 0) {
    let progressed = false;
    for (let index = 0; index < remaining.length;) {
      const { input } = remaining[index]!;
      const prompt = template.prompts.find((candidate) => candidate.field === input.field);
      if (!prompt) {
        results.push({ field: input.field, scope: "course", status: "invalid", message: "Поле відсутнє в маніфесті шаблону." });
        remaining.splice(index, 1);
        continue;
      }
      if (prompt.type === "topic" && input.topicIndex === undefined) {
        results.push({ field: input.field, scope: "topic", status: "invalid", message: "Для поля теми обов'язковий topicIndex." });
        remaining.splice(index, 1);
        continue;
      }
      const topic = prompt.type === "topic"
        ? updatedCourse.topics?.find((candidate) => candidate.index === input.topicIndex)
        : undefined;
      if (prompt.type === "topic" && !topic) {
        results.push({ field: input.field, scope: "topic", topicIndex: input.topicIndex, status: "invalid", message: "Тему не знайдено." });
        remaining.splice(index, 1);
        continue;
      }
      const validationError = validateValue(prompt, input.value);
      if (validationError) {
        results.push({ field: input.field, scope: prompt.type, topicIndex: input.topicIndex, status: "invalid", message: validationError });
        remaining.splice(index, 1);
        continue;
      }
      const missing = missingDependencies(
        getPromptDependencies(template, prompt),
        updatedCourse.generated ?? {},
        updatedCourse.topics ?? [],
        input.topicIndex,
      );
      if (missing.length > 0) {
        index++;
        continue;
      }

      if (prompt.type === "course") {
        updatedCourse.generated = { ...(updatedCourse.generated ?? {}), [prompt.field]: input.value } as GeneratedCourseData;
      } else if (topic) {
        topic.generated = { ...(topic.generated ?? {}), [prompt.field]: input.value };
      }
      results.push({ field: input.field, scope: prompt.type, topicIndex: input.topicIndex, status: "accepted" });
      remaining.splice(index, 1);
      progressed = true;
    }
    if (!progressed) break;
  }

  for (const { input } of remaining) {
    const prompt = template.prompts.find((candidate) => candidate.field === input.field)!;
    results.push({
      field: input.field,
      scope: prompt.type,
      topicIndex: input.topicIndex,
      status: "blocked",
      missingDependencies: missingDependencies(
        getPromptDependencies(template, prompt),
        updatedCourse.generated ?? {},
        updatedCourse.topics ?? [],
        input.topicIndex,
      ),
      message: "Спочатку заповніть залежні поля.",
    });
  }

  return {
    course: updatedCourse,
    results,
    changed: results.some((result) => result.status === "accepted"),
    readyFields: getFillableTemplateFields(template, updatedCourse),
  };
}
