import OpenAI from "openai";
import type { Course, CourseTopic, GeneratedCourseData, GenerateTopicData, QuizQuestion } from "@/stores/models";
import { courses, courseTopics } from "@/stores/db";

const model = "gpt-4o";

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

export async function generateCourseInfo(course: Course, topics: CourseTopic[]): Promise<{ course: Course, topics: CourseTopic[] }> {
  const updatedTopics = await Promise.all(
    topics
    .filter(t => t.generated === null) // do not regenerate
    .map(async topic => {
      const updated = await generateCourseTopic(course, topic);
      await courseTopics.update(updated);
      return updated;
    })
  );

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