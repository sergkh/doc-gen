import OpenAI from "openai";
import type { Course } from "./courses";

const model = "gpt-4o";

export const prompts = [
  {
    name: "keywords",
    prompt: "придумай ключові слова та терміни до цієї лекції українською мовою. виведи тільки ключові слова та терміни без нумерації в JSON формату {terms: string[]}"
  },
  {
    name: "topics",
    prompt: "придумай 15 теоретичних тем для самостійної роботи студентів з лекції, які будуть дотичні до цієї лекції але бажано не присутні в ній. Поверни тільки JSON формату {questions: string[]}"
  },
  {
    name: "referats",
    prompt: "зроби 15 тем рефератів що відносяться до тем цієї лекції. Поверни тільки JSON формату {topics: string[]}"
  },
  {
    name: "tests",
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

export async function generateMethod(course: string, course: Course, index: number): Promise<Topic> {
  const results = {} as Record<string, any>;

  for (const { name, prompt } of prompts) {
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
            content: `${prompt}:\n\n${lesson.text}`
          }
        ]
      });

      const jsonResponse = JSON.parse(response.choices[0]?.message.content as string);
      console.log(jsonResponse);
      results[name] = jsonResponse;
    } catch (err) { 
      console.error(err);     
    }
  }

  return { 
    title: lesson.title,
    index,
    keywords: results['keywords'].terms,
    selfQuestions: results['topics'].questions,
    referats: results['referats'].topics,
    quiz: results['tests'].questions.map((q: any, idx: number) => 
      Object.assign(q, { index: idx+1, option1: q.options[0], option2: q.options[1], option3: q.options[2], option4: q.options[2] })
    ) as QuizQuestion[],
    keyQuestions: results['keyQuestions'].questions
  } as Topic
}

export async function generateAll(info: DisciplineLessons): Promise<MethodData> {
  const { discipline, lessons } = info;

  const topics = await Promise.all(
    lessons.map(async (lesson, idx) => await generate(discipline, lesson, idx+1)) 
  );

  const disciplineQuestions = topics.flatMap(t => t.keyQuestions)

  return { discipline, topics, disciplineQuestions } as MethodData;
}