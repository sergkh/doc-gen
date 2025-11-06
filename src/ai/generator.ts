import OpenAI from "openai";
import type { Course, CourseTopic, GeneratedCourseData, GeneratedTopicData, QuizQuestion } from "@/stores/models.ts";
import { courses, courseTopics } from "@/stores/db.ts";

const model = "gpt-4o";

function deepEqual(a: any, b: any): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
}

function createOpenAIClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OpenAI API key is required");
  }
  return new OpenAI({ apiKey: key });
}

export const prompts = [
  {
    name: "subtopics",
    prompt: "вибери підтеми що розглядаються в наданій лекції українською мовою. Виведи тільки підтеми без нумерації в JSON формату {items: string[]}"
  },
  {
    name: "keywords",
    prompt: "придумай основні терміни до цієї лекції українською мовою. Виведи тільки до 10 основних термінів без нумерації в JSON форматі {items: string[]}"
  },
  {
    name: "selfQuestions",
    prompt: "придумай 15 теоретичних тем для самостійної роботи студентів з лекції, які будуть дотичні до цієї лекції але бажано не присутні в ній. Поверни тільки JSON формату {items: string[]}"
  },
  {
    name: "referats",
    prompt: "зроби 15 тем рефератів що відносяться до тем цієї лекції. Поверни тільки JSON формату {items: string[]}"
  },
  {
    name: "quiz",
    prompt: `зроби 20 тестових завдань на 4 варіанти відповіді по цій лекції. Поверни тільки JSON який чітко відповідає формату: 
    {
      "items": [
        {
          "question": "string",
          "options": ["string", "string", "string", "string"],
          "correct_answer": "string",
          "explanation": "string"
        }
      ]
  }`
  },
  {
    name: "keyQuestions",
    prompt: "зроби 20 запитань без варіантів відповіді по цій лекції. Поверни тільки JSON as {items: string[]}"
  }
];

export async function generateCourseTopic(course: Course, topic: CourseTopic, apiKey?: string): Promise<CourseTopic> {
  const client = createOpenAIClient(apiKey);
  const results = {} as Record<string, any>;

  console.log(`Processing topic ${topic.index} ${topic.name}`);

  for (const { name, prompt } of prompts) {
    if (topic.generated && topic.generated[name]) {
      results[name] = { items: topic.generated[name] };
      continue;
    }

    console.log(`Generating prompt ${name} for topic ${topic.index} ${topic.name}`);

    try {
      const response = await client.chat.completions.create({
        model: model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Ти асистент викладача з дисципліни ${course}, який видає відповіді тільки в форматі JSON об'єктів`
          },
          {
            role: "user",
            content: `${prompt}:\n\n${topic.lection}`
          }
        ]
      });

      const jsonResponse = JSON.parse(response.choices[0]?.message.content as string);
      results[name] = jsonResponse;
    } catch (err) { 
      console.error(err);     
    }
  }

  const quiz = results['quiz'].items.map((q: any, idx: number) => 
    Object.assign(q, { index: idx+1 } as QuizQuestion)
  ) as QuizQuestion[]

  return {
    ...topic,
    generated: {
      ...topic.generated,
      quiz: quiz,
      subtopics: results['subtopics'].items,
      keywords: results['keywords'].items,
      selfQuestions: results['selfQuestions'].items,
      referats: results['referats'].items,    
      keyQuestions: results['keyQuestions'].items
    } as GeneratedTopicData
  } as CourseTopic
}

export async function generateCourseInfo(course: Course, topics: CourseTopic[], progress: (progress: number) => void, apiKey?: string): Promise<{ course: Course, topics: CourseTopic[] }> {
  
  let updatedTopics = [] as CourseTopic[]
  
  // do not parallelize as it might be rate limited by the OpenAI API
  for (const topic of topics) {
    const updated = await generateCourseTopic(course, topic, apiKey);

    progress((updatedTopics.length + 1)/ topics.length * 100);
    
    if (!deepEqual(updated, topic)) {
      await courseTopics.update(updated);  
    }
    updatedTopics.push(updated);
  }

  const disciplineQuestions = updatedTopics.flatMap(t => t.generated?.keyQuestions || []);

  const updatedCourse = {
    ...course,
    generated: {
      disciplineQuestions: disciplineQuestions
    } as GeneratedCourseData
  }

  console.log("Done generating AI course info");

  if (!course.generated) {
    await courses.update(updatedCourse);
  }
  
  return { course: updatedCourse, topics: updatedTopics };
}