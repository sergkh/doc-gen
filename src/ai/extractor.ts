import { formatPrompt } from "@/client/util/util";
import { createOpenAIClient } from "./common";

// Extracts information with prompt from text
export async function extractInformationAI<T>(text: string, prompt: string, model: string | null = null, apiKey: string | null = null): Promise<T> {
  const client = createOpenAIClient(apiKey);
  
  const response = await client.chat.completions.create({
    model: model ?? "gpt-4o",
    response_format: { type: "json_object" },
    messages: [{
      role: "system",
      content: "You are a helpful assistant that thouroughly extracts required information from text."
    }, {
      role: "user", 
      content: formatPrompt(prompt, { text })
    }],
  });  

  return JSON.parse(response.choices[0]?.message.content as string) as T;
}