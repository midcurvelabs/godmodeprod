import OpenAI from "openai";
import type { SkillContext } from "@godmodeprod/shared";
import type { ModelConfig } from "./models";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    // OpenRouter attribution headers — show up on the OpenRouter dashboard.
    "HTTP-Referer": "https://godmodeprod.vercel.app",
    "X-Title": "GodModePod Worker",
  },
});

export interface OpenRouterCallOptions {
  systemPrompt: string;
  userPrompt: string;
  context: SkillContext;
  modelConfig: ModelConfig;
}

function buildContextBlock(context: SkillContext): string {
  return [
    `<show_context>`,
    `<soul>${JSON.stringify(context.soul)}</soul>`,
    `<hosts>${JSON.stringify(context.hosts)}</hosts>`,
    `<brand>${JSON.stringify(context.brand)}</brand>`,
    `<workflow>${JSON.stringify(context.workflow)}</workflow>`,
    `<episode>Episode ${context.episode_number} (${context.show_slug})</episode>`,
    `</show_context>`,
  ].join("\n");
}

// OpenRouter occasionally returns HTTP 200 with Content-Type: application/json
// but an empty/truncated body (usually when the upstream provider connection
// drops mid-stream). The OpenAI SDK only auto-retries on 5xx/408/409/429, so
// it surfaces those as `TypeError: invalid json response body ... Unexpected
// end of JSON input` and fails the job. We retry those here.
function isTransientOpenRouterError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /invalid json response body/i.test(msg) ||
    /Unexpected end of JSON input/i.test(msg) ||
    /fetch failed/i.test(msg) ||
    /ECONNRESET|ETIMEDOUT|socket hang up/i.test(msg)
  );
}

export async function callOpenRouter({
  systemPrompt,
  userPrompt,
  context,
  modelConfig,
}: OpenRouterCallOptions): Promise<string> {
  const contextBlock = buildContextBlock(context);

  // Base request params, OpenAI-compatible shape.
  const params: Record<string, unknown> = {
    model: modelConfig.model,
    max_tokens: modelConfig.maxTokens ?? 4096,
    messages: [
      { role: "system", content: `${systemPrompt}\n\n${contextBlock}` },
      { role: "user", content: userPrompt },
    ],
  };

  // Extended thinking (Claude reasoning models via OpenRouter).
  // Passed as `reasoning: { effort }`. OpenRouter forwards this to Anthropic.
  if (modelConfig.extendedThinking) {
    params.reasoning = { effort: modelConfig.extendedThinking };
  }

  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.chat.completions.create(
        params as unknown as Parameters<typeof client.chat.completions.create>[0]
      );

      // Cast to non-streaming response (we never pass stream:true).
      const completion = response as OpenAI.Chat.Completions.ChatCompletion;
      const text = completion.choices[0]?.message?.content;
      if (!text) {
        throw new Error(
          `No text returned from OpenRouter (model=${modelConfig.model})`
        );
      }
      return text;
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS || !isTransientOpenRouterError(err)) {
        break;
      }
      const backoffMs = 500 * Math.pow(2, attempt - 1); // 500, 1000, 2000ms
      console.warn(
        `[openrouter] transient error on attempt ${attempt}/${MAX_ATTEMPTS} (model=${modelConfig.model}): ${
          err instanceof Error ? err.message : String(err)
        }. Retrying in ${backoffMs}ms...`
      );
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  // Exhausted retries — surface a clearer error so the UI doesn't just show
  // the raw SDK TypeError.
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(
    `OpenRouter call failed after ${MAX_ATTEMPTS} attempts (model=${modelConfig.model}): ${msg}`
  );
}
