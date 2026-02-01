/**
 * Shared OpenAI Client for Lexora Edge Functions
 * Uses direct OpenAI API instead of Lovable AI credits
 */

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CallOpenAIOptions {
  messages: OpenAIMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

interface OpenAIResponse {
  ok: boolean;
  content?: string;
  error?: string;
  status?: number;
}

/**
 * Call OpenAI Chat Completions API directly
 * @param options - Messages, model, temperature, max_tokens
 * @returns OpenAI response with content or error
 */
export async function callOpenAI(options: CallOpenAIOptions): Promise<OpenAIResponse> {
  const {
    messages,
    model = "gpt-4.1-mini",
    temperature = 0.4,
    max_tokens,
  } = options;

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    console.error("[OpenAI] OPENAI_API_KEY not configured");
    return {
      ok: false,
      error: "AI service not configured",
      status: 500,
    };
  }

  try {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
    };

    if (max_tokens) {
      body.max_tokens = max_tokens;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[OpenAI] API error: ${response.status}`, errorText);
      
      if (response.status === 429) {
        return {
          ok: false,
          error: "Rate limit exceeded. Please try again later.",
          status: 429,
        };
      }
      
      return {
        ok: false,
        error: "AI temporarily unavailable",
        status: 500,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[OpenAI] No content in response:", data);
      return {
        ok: false,
        error: "No response from AI",
        status: 500,
      };
    }

    return {
      ok: true,
      content,
    };
  } catch (error) {
    console.error("[OpenAI] Unexpected error:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
      status: 500,
    };
  }
}
