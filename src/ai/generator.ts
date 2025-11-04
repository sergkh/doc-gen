import OpenAI from "openai";
import type { Course, CourseTopic, GeneratedCourseData, GenerateTopicData, QuizQuestion } from "@/stores/models.ts";
import { courses, courseTopics } from "@/stores/db.ts";

const model = "gpt-4o";

function deepEqual(a: any, b: any): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
}

export const prompts = [
  {
    name: "subtopics",
    prompt: "вибери підтеми що розглядаються в наданій лекції українською мовою. Виведи тільки підтеми без нумерації в JSON формату {terms: string[]}"
  },
  {
    name: "keywords",
    prompt: "придумай ключові слова та терміни до цієї лекції українською мовою. виведи тільки ключові слова та терміни без нумерації в JSON формату {terms: string[]}"
  },
  {
    name: "selfQuestions",
    prompt: "придумай 15 теоретичних тем для самостійної роботи студентів з лекції, які будуть дотичні до цієї лекції але бажано не присутні в ній. Поверни тільки JSON формату {questions: string[]}"
  },
  {
    name: "referats",
    prompt: "зроби 15 тем рефератів що відносяться до тем цієї лекції. Поверни тільки JSON формату {topics: string[]}"
  },
  {
    name: "quiz",
    prompt: `зроби 20 тестових завдань на 4 варіанти відповіді по цій лекції. Поверни тільки JSON який чітко відповідає формату: 
    {
      "questions": [
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
    prompt: "зроби 20 запитань без варіантів відповіді по цій лекції. Поверни тільки JSON as {questions: string[]}"
  }
];

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateCourseTopic(course: Course, topic: CourseTopic): Promise<CourseTopic> {
  const results = {} as Record<string, any>;

  console.log(`Processing topic ${topic.index} ${topic.name}`);

  for (const { name, prompt } of prompts) {
    if (topic.generated && topic.generated[name]) {
      console.log(`Skipping ${name} for topic ${topic.index} ${topic.name} as it is already generated`);
      results[name] = topic.generated[name];
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

  console.log(`Generated data for topic ${topic.index} ${topic.name}`, results);
  
  const quiz = results['quiz'].questions.map((q: any, idx: number) => 
    Object.assign(q, { index: idx+1, option1: q.options[0], option2: q.options[1], option3: q.options[2], option4: q.options[2] })
  ) as QuizQuestion[]

  return {
    ...topic,
    generated: {
      ...topic.generated,
      ...quiz,
      subtopics: results['subtopics'].terms,
      keywords: results['keywords'].terms,
      selfQuestions: results['selfQuestions'].questions,
      referats: results['referats'].topics,    
      keyQuestions: results['keyQuestions'].questions
    } as GenerateTopicData
  } as CourseTopic
}

export async function generateCourseInfo(course: Course, topics: CourseTopic[], progress: (progress: number) => void): Promise<{ course: Course, topics: CourseTopic[] }> {
  
  let updatedTopics = [] as CourseTopic[]
  
  // do not parallelize as it might be rate limited by the OpenAI API
  for (const topic of topics) {
    const updated = await generateCourseTopic(course, topic);

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