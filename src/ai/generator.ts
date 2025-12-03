import type { Course, CourseTopic, GeneratedCourseData, GeneratedTopicData, Prompt, PromptResult, QuizQuestion, Template } from "@/stores/models.ts";
import { courses, courseTopics } from "@/stores/db.ts";
import { createOpenAIClient, retryWithBackoff } from "./common";
import { formatPrompt } from "@/client/util/util";

function deepEqual(a: any, b: any): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
}

function packIntoObject(items: PromptResult[]): Record<string, any> {
  return items.reduce((acc, item) => {
    acc[item.prompt] = item.items;
    return acc;
  }, {} as Record<string, any>);
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

  const promptsToRun = prompts.filter(p => p.type === type);

  for (const prompt of promptsToRun) {
    const systemPrompt = formatPrompt(prompt.system_prompt, contextProvider(results));
    const formattedPrompt = formatPrompt(prompt.prompt, contextProvider(results));

    let items: Record<string, any>[] = forceRecreate ? [] : state[prompt.field] || [];

    if (items.length == 0) {

      console.log(`Running ${type} prompt ${prompt.field}`);

      const response = await retryWithBackoff(async () => {
        return await client.chat.completions.create({
          model: prompt.model,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: formattedPrompt
            }
          ]
        });
      });

      const jsonResponse = JSON.parse(response.choices[0]?.message.content as string);
      items = jsonResponse.items || [];

      console.log(`Generating ${type} prompt ${prompt.field}:\nsystem> ${systemPrompt}\nuser> ${formattedPrompt}\n${prompt.model}>${JSON.stringify(items)}`);
    }
    
    results.push({
      system_prompt: systemPrompt,
      prompt: formattedPrompt,
      items: items
    } as PromptResult); 
  }

  return results;
}

export function runTopicPrompts(
  prompts: Prompt[],
  course: Course,
  topic: CourseTopic,
  apiKey: string | null,
  forceRecreate: boolean = false
): Promise<PromptResult[]> {
  return runPrompts(prompts, topic.generated || {}, "topic",  forceRecreate, apiKey, (state) => ({
    ...state,
    courseName: course.name,
    courseDescription: course.data.description ?? "",
    name: topic.name,
    lection: topic.lection || topic.name,
    subtopics: topic.generated?.subtopics || state['subtopics'].items.join(", ")
  }));
}

export function runCoursePrompts(
  prompts: Prompt[],
  course: Course,
  courseTopics: CourseTopic[],
  apiKey: string | null,
  forceRecreate: boolean = false
): Promise<PromptResult[]> {
  return runPrompts(prompts, course.generated || {}, "course",  forceRecreate, apiKey, (state) => ({
    ...state,
    courseName: course.name,
    courseDescription: course.data.description ?? "",
    topics: courseTopics.map(t => t.name).join(", "),
    subtopics: courseTopics.flatMap(t => t.generated?.subtopics || []).join(", ")
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
    const prompts = packIntoObject(await runTopicPrompts(template.prompts, course, topic, key));

    const updated = {
      ...topic,
      generated: {    
        ...(topic.generated ?? {}),    
        ...prompts        
      } as GeneratedTopicData
    } as CourseTopic

    progress((updatedTopics.length + 1) / topics.length * 100);
    
    if (!deepEqual(updated, topic)) {
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

  console.log("Done generating AI course info");

  if (!deepEqual(updatedCourse, course)) {
    await courses.update(updatedCourse);
  }
  
  return { course: updatedCourse, topics: updatedTopics };
}