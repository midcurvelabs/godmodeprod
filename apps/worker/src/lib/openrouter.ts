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
}
