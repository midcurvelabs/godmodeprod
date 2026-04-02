import Anthropic from "@anthropic-ai/sdk";
import type { SkillContext } from "@godmodeprod/shared";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ClaudeCallOptions {
  systemPrompt: string;
  userPrompt: string;
  context: SkillContext;
  maxTokens?: number;
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

export async function callClaude({
  systemPrompt,
  userPrompt,
  context,
  maxTokens = 4096,
}: ClaudeCallOptions): Promise<string> {
  const contextBlock = buildContextBlock(context);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    system: `${systemPrompt}\n\n${contextBlock}`,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return textBlock.text;
}
