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
    if (result === undefined) throw new Error(`Missing dependency: ${key.trim()}`);
    return result;
  });
}

/** Retries an OpenAI API call with exponential backoff on rate limit errors */
async function retryWithBackoff<T>(
  callFn: () => Promise<T>,
  maxRetries: number = 5,
  initialDelay: number = 1000,
  maxDelay: number = 60000,
  timeout: number = 300000
): Promise<T> {
  const startTime = Date.now();
  let lastError: any;
  let delay = initialDelay;

  const isRateLimitError = (error: any): boolean => {
    if (!error) return false;    
    if (error.status === 429) return true;
    if (error.code === 'rate_limit_exceeded') return true;
    if (error.type === 'rate_limit_error') return true;
    if (error.message?.toLowerCase().includes('rate limit')) return true;    
    return false;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callFn();
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error
      if (isRateLimitError(error)) {
        // Check if we've exceeded the timeout
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= timeout) {
          throw new Error(`Rate limit retry timeout exceeded after ${timeout}ms: ${error.message || 'Unknown error'}`);
        }

        // Check if we have retries left
        if (attempt >= maxRetries) {
          throw new Error(`Rate limit error after ${maxRetries} retries: ${error.message || 'Unknown error'}`);
        }

        console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        delay = Math.min(delay * 2, maxDelay);        
      } else {
        // Not a rate limit error, throw immediately
        throw error;
      }
    }
  }

  throw lastError || new Error('Unknown error occurred during retry');
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

    console.log(`Generating ${type} prompt ${prompt.field}`);

    const systemPrompt = format(prompt.system_prompt, contextProvider(results));
    const formattedPrompt = format(prompt.prompt, contextProvider(results));

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
    results[prompt.field] = jsonResponse.items;

    console.log(`Generating ${type} prompt ${prompt.field}:\nsystem> ${systemPrompt}\nuser> ${formattedPrompt}\n${prompt.model}>${JSON.stringify(jsonResponse.items)}`);
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
      courseDescription: course.data.description ?? "",
      name: topic.name, 
      lection: topic.lection || topic.name,
      subtopics: topic.generated?.subtopics || state['subtopics'].items.join(", ") || ""
    }));

    const updated = {
      ...topic,
      generated: {
        ...prompts,
        quiz: prompts['quiz']?.map((q: any, idx: number) => Object.assign(q, { index: idx+1 } as QuizQuestion)),        
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
    courseDescription: course.data.description ?? "",
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