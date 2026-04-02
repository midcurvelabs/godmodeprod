import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SkillContext } from "@godmodeprod/shared";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface GeminiCallOptions {
  systemPrompt: string;
  userPrompt: string;
  context: SkillContext;
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

export async function callGemini({
  systemPrompt,
  userPrompt,
  context,
}: GeminiCallOptions): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `${systemPrompt}\n\n${buildContextBlock(context)}`,
  });

  const result = await model.generateContent(userPrompt);
  return result.response.text();
}

export async function generateImage(
  prompt: string
): Promise<Buffer> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-preview-image-generation",
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["image", "text"],
    } as Record<string, unknown>,
  });

  const response = result.response;
  const parts = response.candidates?.[0]?.content?.parts;
  const imagePart = parts?.find(
    (part) => "inlineData" in part
  ) as { inlineData?: { data: string } } | undefined;

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image generated from Gemini");
  }

  return Buffer.from(imagePart.inlineData.data, "base64");
}
