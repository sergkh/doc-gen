import { createOpenAIClient, retryWithBackoff } from "./common";
import { z } from 'zod';
import { zodTextFormat } from "openai/helpers/zod";
import { DEFAULT_AGENT_MODEL } from "@/ai/models";

// Extracts information with prompt from text
export async function extractInformationAI<ZodInput extends z.ZodType>(
  prompt: string, 
  text: string, 
  format: ZodInput, 
  model: string | null = null, 
  apiKey: string | null = null
): Promise<z.infer<ZodInput> | null> {
  const client = createOpenAIClient(apiKey);

  console.log("Extracting information with AI:", text.slice(0, 100), "...");
  
  const response = await retryWithBackoff(async () => {
    return await client.responses.parse({
      model: model ?? DEFAULT_AGENT_MODEL,
      input: [{
        role: "system",
        content: prompt
      }, {
        role: "user",
        content: text
      }],    
      text: {
        format: zodTextFormat(format, "data"),
      }
    });
  });

  return response.output_parsed;
}