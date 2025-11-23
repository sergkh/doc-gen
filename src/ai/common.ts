import OpenAI from "openai";

export function createOpenAIClient(apiKey?: string | null): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OpenAI API key is required");
  }
  return new OpenAI({ apiKey: key });
}

export function formatPrompt(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const result = data[key.trim()];
    if (result === undefined) throw new Error(`Missing dependency: ${key.trim()}`);
    return result;
  });
}

/** Retries an OpenAI API call with exponential backoff on rate limit errors */
export async function retryWithBackoff<T>(
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
