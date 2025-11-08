import OpenAI from "openai";
import type { Course, CourseTopic, GeneratedCourseData, GeneratedTopicData, QuizQuestion } from "@/stores/models.ts";
import { courses, courseTopics, prompts } from "@/stores/db.ts";

function deepEqual(a: any, b: any): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
}

function createOpenAIClient(apiKey?: string | null): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OpenAI API key is required");
  }
  return new OpenAI({ apiKey: key });
}

function format(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const result = data[key.trim()];
    if (!result) throw new Error(`Missing dependency: ${key.trim()}`);
    return result;
  });
}

// Gets all configured prompts for given type and runs them if they weren't run before
// prompts are run in order of their index, so can rely on previous prompts results
export async function runPrompts(
  state: Record<string, any>,
  type: "topic" | "course",
  apiKey: string | null,
  contextProvider: (context: Record<string, any>) => Record<string, any>  
): Promise<Record<string, any>> {
  const client = createOpenAIClient(apiKey);
  const results = {...state} as Record<string, any>;

  const promptsToRun = await prompts.getByType(type);

  for (const prompt of promptsToRun) {
    // this field is already generated
    if (state[prompt.field]) continue;

    try {
      const systemPrompt = format(prompt.system_prompt, contextProvider(results));
      const formattedPrompt = format(prompt.prompt, contextProvider(results));

      const response = await client.chat.completions.create({
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

      const jsonResponse = JSON.parse(response.choices[0]?.message.content as string);
      results[prompt.field] = jsonResponse.items;

      console.log(`Generating ${type} prompt ${prompt.field}: request:\nsystem> ${systemPrompt}\nuser> ${formattedPrompt}\n${prompt.model}>${JSON.stringify(jsonResponse.items)}`);
    } catch (err) { 
      console.error(err);     
    }
  }

  return results;
}

// Runs set of prompts for course and topics
export async function generateCourseInfo(course: Course, topics: CourseTopic[], progress: (progress: number) => void, apiKey?: string): Promise<{ course: Course, topics: CourseTopic[] }> {
  const key = apiKey ?? null;
  let updatedTopics = [] as CourseTopic[]
  
  // do not parallelize as it might be rate limited by the OpenAI API
  for (const topic of topics) {
    const prompts = await runPrompts(topic.generated || {}, "topic", key, (state) => ({
      ...state,
      courseName: course.name,
      courseDescription: course.data.description,
      name: topic.name, 
      lection: topic.lection || topic.name,
      subtopics: topic.generated?.subtopics || state['subtopics'].items.join(", ") || ""
    }));

    const updated = {
      ...topic,
      generated: {
        ...prompts,
        quiz: prompts['quiz'].map((q: any, idx: number) => Object.assign(q, { index: idx+1 } as QuizQuestion)),        
      } as GeneratedTopicData
    } as CourseTopic

    progress((updatedTopics.length + 1)/ topics.length * 100);
    
    if (!deepEqual(updated, topic)) {
      await courseTopics.update(updated);  
    }
    updatedTopics.push(updated);
  }

  const prompts = await runPrompts(course.generated || {}, "course", key, (state) => ({
    ...state,
    courseName: course.name,
    courseDescription: course.data.description,
    topics: updatedTopics.map(t => t.name).join(", "),
    subtopics: updatedTopics.flatMap(t => t.generated?.subtopics || []).join(", ")
  }));

  const updatedCourse = { ...course, generated: prompts as GeneratedCourseData }

  console.log("Done generating AI course info");

  if (!deepEqual(updatedCourse, course)) {
    await courses.update(updatedCourse);
  }
  
  return { course: updatedCourse, topics: updatedTopics };
}