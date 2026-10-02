import { formatPrompt } from "@/ai/prompt";
import type { Course, CoursePractice, CourseTopic, GeneratedCourseData, Prompt, QuizQuestion, Template } from "@/stores/models";
import { numberCoursePractices } from "@/stores/practices";

export type TemplateFieldInput = {
  field: string;
  value: unknown;
  topicIndex?: number;
  practiceIndex?: number;
  scope?: Prompt["type"];
};

export type TemplateFieldDependency = {
  field: string;
  scope: Prompt["type"];
  relation: "single" | "same_topic" | "all_topics" | "same_practice" | "all_practices" | "practices_of_topic";
};

export type TemplateFieldResult = {
  field: string;
  scope: Prompt["type"];
  topicIndex?: number;
  practiceIndex?: number;
  status: "accepted" | "blocked" | "invalid";
  missingDependencies?: string[];
  message?: string;
};

export type GeneratedTemplateField = {
  templateId: number;
  templateName: string;
  templateDescription: string | null;
  field: string;
  description: string;
  scope: Prompt["type"];
  topicIndex?: number;
  topicName?: string;
  practiceIndex?: number;
  practiceName?: string;
  currentValue: unknown | null;
  outputSchema: Record<string, unknown>;
  dependsOn: TemplateFieldDependency[];
};

const BUILT_IN_CONTEXT_FIELDS = new Set([
  "courseName", "courseDescription", "name", "description", "practiceIndex", "practice", "topicName", "topic", "lection", "topics", "subtopics", "course", "hours",
]);

function promptReferences(prompt: Prompt): Array<{ field: string; scope?: Prompt["type"] }> {
  const references = new Map<string, { field: string; scope?: Prompt["type"] }>();
  const expression = /\{\{\s*([^{}]+?)\s*\}\}/g;
  for (const source of [prompt.system_prompt, prompt.prompt]) {
    for (const match of source.matchAll(expression)) {
      const path = match[1]?.split("|", 1)[0]?.trim();
      if (!path) continue;
      const nested = path.match(/^(course|topic|practice)\.generated\.([^.]*)/);
      const reference = nested
        ? { field: nested[2]!, scope: nested[1] as Prompt["type"] }
        : { field: path.split(".")[0]! };
      if (reference.field) references.set(`${reference.scope ?? ""}:${reference.field}`, reference);
    }
  }
  return [...references.values()];
}

export function getPromptDependencies(template: Template, prompt: Prompt): TemplateFieldDependency[] {
  const requested = promptReferences(prompt).filter(({ field, scope }) =>
    template.prompts.some((candidate) => candidate.field === field && candidate !== prompt
      && (scope === undefined || candidate.type === scope))
    || (scope !== undefined || !BUILT_IN_CONTEXT_FIELDS.has(field))
  );
  const dependencies: TemplateFieldDependency[] = [];

  for (const { field, scope } of requested) {
    const dependencyPrompt = template.prompts.find((candidate) => candidate.field === field && candidate.type === (scope ?? prompt.type))
      ?? template.prompts.find((candidate) => candidate.field === field);
    const dependencyScope = scope ?? dependencyPrompt?.type ?? prompt.type;
    const relation: TemplateFieldDependency["relation"] = dependencyScope === "course" ? "single"
      : dependencyScope === "topic" ? (prompt.type === "course" ? "all_topics" : "same_topic")
      : prompt.type === "course" ? "all_practices"
      : prompt.type === "topic" ? "practices_of_topic" : "same_practice";
    dependencies.push({
      field,
      scope: dependencyScope,
      relation,
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

function dependencyKey(dependency: TemplateFieldDependency, topicIndex?: number, practiceIndex?: number): string {
  if (dependency.relation === "same_topic") return `topic[${topicIndex}].${dependency.field}`;
  if (dependency.relation === "all_topics") return `all_topics.${dependency.field}`;
  if (dependency.relation === "same_practice") return `practice[${practiceIndex}].${dependency.field}`;
  if (dependency.relation === "all_practices") return `all_practices.${dependency.field}`;
  if (dependency.relation === "practices_of_topic") return `topic[${topicIndex}].practices.${dependency.field}`;
  return `${dependency.scope}.${dependency.field}`;
}

function missingDependencies(
  dependencies: TemplateFieldDependency[],
  courseGenerated: Record<string, unknown>,
  topics: CourseTopic[],
  topicIndex?: number,
  practiceIndex?: number,
): string[] {
  return dependencies.flatMap((dependency) => {
    const topic = topics.find((candidate) => candidate.index === topicIndex);
    const practices = topics.flatMap((candidate) => candidate.data?.practices ?? []);
    if (dependency.relation === "all_topics") {
      return topics.length > 0 && topics.every((topic) => hasValue(topic.generated?.[dependency.field]))
        ? []
        : [dependencyKey(dependency, topicIndex, practiceIndex)];
    }
    if (dependency.relation === "same_topic") {
      return topic && hasValue(topic.generated?.[dependency.field]) ? [] : [dependencyKey(dependency, topicIndex, practiceIndex)];
    }
    if (dependency.relation === "same_practice") {
      const practice = topic?.data?.practices?.find((candidate) => candidate.index === practiceIndex);
      return practice && hasValue(practice.generated?.[dependency.field]) ? [] : [dependencyKey(dependency, topicIndex, practiceIndex)];
    }
    if (dependency.relation === "all_practices") {
      return practices.length > 0 && practices.every((practice) => hasValue(practice.generated?.[dependency.field]))
        ? [] : [dependencyKey(dependency, topicIndex, practiceIndex)];
    }
    if (dependency.relation === "practices_of_topic") {
      const items = topic?.data?.practices ?? [];
      return items.length > 0 && items.every((practice) => hasValue(practice.generated?.[dependency.field]))
        ? [] : [dependencyKey(dependency, topicIndex, practiceIndex)];
    }
    return hasValue(courseGenerated[dependency.field]) ? [] : [dependencyKey(dependency, topicIndex, practiceIndex)];
  });
}

function contextFor(prompt: Prompt, course: Course, topics: CourseTopic[], topic?: CourseTopic, practice?: CoursePractice): Record<string, unknown> {
  const state = prompt.type === "course" ? course.generated ?? {}
    : prompt.type === "topic" ? topic?.generated ?? {} : practice?.generated ?? {};
  return {
    ...course.generated ?? {},
    ...state,
    courseName: course.name,
    courseDescription: course.data.description ?? "",
    name: prompt.type === "practice" ? practice?.name : topic?.name,
    description: practice?.description,
    practiceIndex: practice?.index,
    practice,
    topicName: topic?.name,
    topic,
    lection: topic?.lection ?? topic?.name,
    topics: topics.map((item) => item.name).join(", "),
    subtopics: prompt.type === "practice" ? topic?.generated?.subtopics ?? []
      : topics.flatMap((item) => item.generated?.subtopics ?? []).join(", "),
    course,
  };
}

export function getFillableTemplateFields(template: Template, course: Course) {
  const topics = numberCoursePractices(course.topics ?? []);
  const courseGenerated: Record<string, unknown> = course.generated ?? {};
  return template.prompts.flatMap((prompt) => {
    const targets: Array<{ topic?: CourseTopic; practice?: CoursePractice }> = prompt.type === "course" ? [{}]
      : prompt.type === "topic" ? topics.map((topic) => ({ topic }))
      : topics.flatMap((topic) => (topic.data?.practices ?? []).map((practice) => ({ topic, practice })));
    return targets.flatMap(({ topic, practice }) => {
      const current = prompt.type === "course" ? courseGenerated[prompt.field]
        : prompt.type === "topic" ? topic?.generated?.[prompt.field] : practice?.generated?.[prompt.field];
      if (hasValue(current)) return [];
      const dependencies = getPromptDependencies(template, prompt);
      const missing = missingDependencies(dependencies, courseGenerated, topics, topic?.index, practice?.index);
      if (missing.length > 0) return [];
      const context = contextFor(prompt, course, topics, topic, practice);
      return [{
        field: prompt.field,
        scope: prompt.type,
        ...(topic ? { topicIndex: topic.index, topicName: topic.name } : {}),
        ...(practice ? { practiceIndex: practice.index, practiceName: practice.name } : {}),
        systemPrompt: formatPrompt(prompt.system_prompt, context),
        prompt: formatPrompt(prompt.prompt, context),
        outputSchema: outputSchemaForPrompt(prompt),
      }];
    });
  });
}

/**
 * Lists every generated field defined by a template, rather than only fields
 * that are currently ready to be generated. Topic fields are listed once for
 * each existing course topic because their values are stored per topic.
 */
export function getGeneratedTemplateFields(template: Template, course: Course): GeneratedTemplateField[] {
  const courseGenerated: Record<string, unknown> = course.generated ?? {};
  const templateDescription = template.data?.description ?? null;
  const topics = numberCoursePractices(course.topics ?? []);

  return template.prompts.flatMap((prompt) => {
    const targets: Array<{ topic?: CourseTopic; practice?: CoursePractice }> = prompt.type === "course" ? [{}]
      : prompt.type === "topic" ? topics.map((topic) => ({ topic }))
      : topics.flatMap((topic) => (topic.data?.practices ?? []).map((practice) => ({ topic, practice })));
    return targets.map(({ topic, practice }) => ({
      templateId: template.id,
      templateName: template.name,
      templateDescription,
      field: prompt.field,
      description: prompt.name || prompt.field,
      scope: prompt.type,
      ...(topic ? { topicIndex: topic.index, topicName: topic.name } : {}),
      ...(practice ? { practiceIndex: practice.index, practiceName: practice.name } : {}),
      currentValue: (prompt.type === "course"
        ? courseGenerated[prompt.field]
        : prompt.type === "topic" ? topic?.generated?.[prompt.field] : practice?.generated?.[prompt.field]) ?? null,
      outputSchema: outputSchemaForPrompt(prompt),
      dependsOn: getPromptDependencies(template, prompt),
    }));
  });
}

export function applyTemplateFields(template: Template, course: Course, inputs: TemplateFieldInput[]) {
  let updatedCourse: Course = {
    ...course,
    generated: { ...(course.generated ?? {}) } as GeneratedCourseData,
    topics: numberCoursePractices(course.topics ?? []).map((topic) => ({
      ...topic, generated: { ...(topic.generated ?? {}) },
      data: { ...topic.data, practices: topic.data?.practices?.map((practice) => ({
        ...practice, generated: { ...(practice.generated ?? {}) },
      })) },
    })),
  };
  const results: TemplateFieldResult[] = [];
  const remaining = inputs.map((input, inputIndex) => ({ input, inputIndex }));
  const promptFor = (input: TemplateFieldInput) => {
    const scope = input.scope ?? (input.practiceIndex !== undefined ? "practice"
      : input.topicIndex !== undefined ? "topic" : undefined);
    return template.prompts.find((candidate) => candidate.field === input.field
      && (scope === undefined || candidate.type === scope));
  };

  while (remaining.length > 0) {
    let progressed = false;
    for (let index = 0; index < remaining.length;) {
      const { input } = remaining[index]!;
      const prompt = promptFor(input);
      if (!prompt) {
        results.push({ field: input.field, scope: "course", status: "invalid", message: "Поле відсутнє в маніфесті шаблону." });
        remaining.splice(index, 1);
        continue;
      }
      if (prompt.type !== "course" && input.topicIndex === undefined) {
        results.push({ field: input.field, scope: prompt.type, status: "invalid", message: "Для поля теми або заняття обов'язковий topicIndex." });
        remaining.splice(index, 1);
        continue;
      }
      if (prompt.type === "practice" && input.practiceIndex === undefined) {
        results.push({ field: input.field, scope: "practice", topicIndex: input.topicIndex, status: "invalid", message: "Для поля заняття обов'язковий practiceIndex." });
        remaining.splice(index, 1);
        continue;
      }
      const topic = prompt.type !== "course"
        ? updatedCourse.topics?.find((candidate) => candidate.index === input.topicIndex)
        : undefined;
      if (prompt.type !== "course" && !topic) {
        results.push({ field: input.field, scope: prompt.type, topicIndex: input.topicIndex, practiceIndex: input.practiceIndex, status: "invalid", message: "Тему не знайдено." });
        remaining.splice(index, 1);
        continue;
      }
      const practice = prompt.type === "practice"
        ? topic?.data?.practices?.find((candidate) => candidate.index === input.practiceIndex) : undefined;
      if (prompt.type === "practice" && !practice) {
        results.push({ field: input.field, scope: "practice", topicIndex: input.topicIndex, practiceIndex: input.practiceIndex, status: "invalid", message: "Заняття не знайдено." });
        remaining.splice(index, 1);
        continue;
      }
      const validationError = validateValue(prompt, input.value);
      if (validationError) {
        results.push({ field: input.field, scope: prompt.type, topicIndex: input.topicIndex, practiceIndex: input.practiceIndex, status: "invalid", message: validationError });
        remaining.splice(index, 1);
        continue;
      }
      const missing = missingDependencies(
        getPromptDependencies(template, prompt),
        updatedCourse.generated ?? {},
        updatedCourse.topics ?? [],
        input.topicIndex,
        input.practiceIndex,
      );
      if (missing.length > 0) {
        index++;
        continue;
      }

      if (prompt.type === "course") {
        updatedCourse.generated = { ...(updatedCourse.generated ?? {}), [prompt.field]: input.value } as GeneratedCourseData;
      } else if (prompt.type === "topic" && topic) {
        topic.generated = { ...(topic.generated ?? {}), [prompt.field]: input.value };
      } else if (practice) {
        practice.generated = { ...(practice.generated ?? {}), [prompt.field]: input.value } as CoursePractice["generated"];
      }
      results.push({ field: input.field, scope: prompt.type, topicIndex: input.topicIndex, practiceIndex: input.practiceIndex, status: "accepted" });
      remaining.splice(index, 1);
      progressed = true;
    }
    if (!progressed) break;
  }

  for (const { input } of remaining) {
    const prompt = promptFor(input)!;
    results.push({
      field: input.field,
      scope: prompt.type,
      topicIndex: input.topicIndex,
      practiceIndex: input.practiceIndex,
      status: "blocked",
      missingDependencies: missingDependencies(
        getPromptDependencies(template, prompt),
        updatedCourse.generated ?? {},
        updatedCourse.topics ?? [],
        input.topicIndex,
        input.practiceIndex,
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
