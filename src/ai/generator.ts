import type { Course, CourseTopic, GeneratedCourseData, GeneratedTopicData, Prompt, PromptResult, QuizQuestion, Template } from "@/stores/models.ts";
import { courses, courseTopics } from "@/stores/db.ts";
import { createOpenAIClient, retryWithBackoff } from "./common";
import { z } from 'zod';
import { zodTextFormat } from "openai/helpers/zod";
import { formatPrompt } from "./prompt";

function deepEqual(a: any, b: any): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
}

function packIntoObject(items: PromptResult[]): Record<string, any> {
  return items.reduce((acc, item) => {
    acc[item.field] = item.item;
    return acc;
  }, {} as Record<string, any>);
}

function zodPromptFormat(format: "text" | "list" | "quiz"): z.ZodType {
  switch (format) {
    case "list":
      return z.array(z.string());
    case "quiz":
      return z.array(z.object({
        question: z.string(),
        options: z.array(z.string()),
        answerIndex: z.number(),
      }));
    case "text":
      return z.string();
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

// Gets all configured prompts for given type and runs them if they weren't run before
// prompts are run in order of their index, so can rely on previous prompts results
export async function runPrompts(
  prompts: Prompt[],
  state: Record<string, any>,
  type: "topic" | "course",
  forceRecreate: boolean = false,
  apiKey: string | null,
  contextProvider: (context: Record<string, any>) => Record<string, any>  
): Promise<PromptResult[]> {
  const client = createOpenAIClient(apiKey);
  const results: PromptResult[] = [];
  const localState = {...state};

  const promptsToRun = prompts.filter(p => p.type === type);

  for (const prompt of promptsToRun) {
    try {
      const systemPrompt = formatPrompt(prompt.system_prompt, contextProvider(localState));
      const formattedPrompt = formatPrompt(prompt.prompt, contextProvider(localState));

      let item: any | null = forceRecreate ? null : localState[prompt.field] ?? null;

      if (item === null || (Array.isArray(item) && item.length === 0)) {

        console.log(`Running ${type} prompt ${prompt.field}`);

        const objFormat = z.object({
          data: zodPromptFormat(prompt.format),
        });      

        const response = await retryWithBackoff(async () => {
          return await client.responses.parse({
            model: prompt.model,
            input: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: formattedPrompt
              }
            ],
            text: {
              format: zodTextFormat(objFormat, "data"),
            }
          });
        });

        item = (response.output_parsed as { data: any }).data;

        console.log(`Generating ${type} prompt ${prompt.field}:\nsystem> ${systemPrompt}\nuser> ${formattedPrompt}\n${prompt.model}>${JSON.stringify(item)}`);
      }
      
      results.push({
        field: prompt.field,
        system_prompt: systemPrompt,
        prompt: formattedPrompt,
        item
      } as PromptResult);

      localState[prompt.field] = item;
    } catch(e) {
      console.log(`Error running ${type} prompt ${prompt.field}. state: `, localState, e);
      throw e;
    }
  }

  return results;
}

export function runTopicPrompts(
  prompts: Prompt[],
  course: Course,
  topic: CourseTopic,
  allTopics: CourseTopic[],
  apiKey: string | null,
  forceRecreate: boolean = false
): Promise<PromptResult[]> {
  return runPrompts(prompts, topic.generated ?? {}, "topic", forceRecreate, apiKey, (state) => ({
    ...topic.generated ?? {},
    ...state,
    courseName: course.name,
    courseDescription: course.data.description ?? "",
    name: topic.name,
    lection: topic.lection || topic.name,
    topics: allTopics.map(t => t.name).join(", "),
    subtopics: topic.generated?.subtopics ?? state['subtopics']?.items.join(", ") ?? '',
    course: course
  }));
}

export function runCoursePrompts(
  prompts: Prompt[],
  course: Course,
  courseTopics: CourseTopic[],
  apiKey: string | null,
  forceRecreate: boolean = false
): Promise<PromptResult[]> {  
  return runPrompts(prompts, course.generated ?? {}, "course", forceRecreate, apiKey, (state) => ({
    ...course.generated ?? {},
    ...state,
    courseName: course.name,
    courseDescription: course.data.description ?? "",
    topics: courseTopics.map(t => t.name).join(", "),
    subtopics: courseTopics.flatMap(t => t.generated?.subtopics || []).join(", "),
    course: course
  }));
}

// Runs set of prompts for course and topics
export async function generateCourseInfo(
  template: Template, 
  course: Course, 
  topics: CourseTopic[], 
  progress: (progress: number) => void, apiKey?: string
): Promise<{ course: Course, topics: CourseTopic[] }> {
  const key = apiKey ?? null;
  let updatedTopics = [] as CourseTopic[]
  
  // do not parallelize as it might be rate limited by the OpenAI API
  for (const topic of topics) {
    const prompts = packIntoObject(await runTopicPrompts(template.prompts, course, topic, topics, key));

    const updated = {
      ...topic,
      generated: {    
        ...(topic.generated ?? {}),    
        ...prompts        
      } as GeneratedTopicData
    } as CourseTopic

    progress((updatedTopics.length + 1) / topics.length * 100);
    
    if (!deepEqual(updated, topic)) {
      console.log(`\n\n\nSaving updated topic with generated fields ${Object.keys(updated.generated).join(", ")}\n\n\n`);
      await courseTopics.update(updated);  
    }

    updatedTopics.push(updated);
  }

  const prompts = packIntoObject(await runCoursePrompts(template.prompts, course, updatedTopics, key));

  const updatedCourse = {
    ...course, 
    generated: {
      ...(course.generated ?? {}),
      ...prompts
    } as GeneratedCourseData
  } as Course;

  if (!deepEqual(updatedCourse, course)) {
    await courses.update(updatedCourse);
  }
  
  return { course: updatedCourse, topics: updatedTopics };
}