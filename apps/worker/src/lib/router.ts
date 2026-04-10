import type { SkillContext } from "@godmodeprod/shared";
import { resolveModel, type SkillKey } from "./models";
import { callOpenRouter } from "./openrouter";
import { callGemini } from "./gemini";

export interface CallModelOptions {
  systemPrompt: string;
  userPrompt: string;
  context: SkillContext;
  // Optional per-call max_tokens override. If omitted, uses the skill's
  // configured default from lib/models.ts.
  maxTokens?: number;
}

/**
 * Single entry point every skill uses to talk to an LLM.
 *
 * Looks up the skill's model config in lib/models.ts and dispatches to the
 * right provider wrapper. Skills no longer import provider SDKs directly.
 *
 * Example:
 *   const text = await callModel("slide-generation", {
 *     systemPrompt, userPrompt, context,
 *   });
 */
export async function callModel(
  skill: SkillKey,
  opts: CallModelOptions
): Promise<string> {
  const config = resolveModel(skill);

  // Per-call maxTokens override (rare — prefer setting it in models.ts).
  const effectiveConfig = opts.maxTokens
    ? { ...config, maxTokens: opts.maxTokens }
    : config;

  // Dev-time visibility into which model each skill actually hit.
  if (process.env.LOG_MODEL_ROUTING === "1") {
    console.log(
      `[router] ${skill} → ${effectiveConfig.via}:${effectiveConfig.model}${
        effectiveConfig.extendedThinking
          ? ` (thinking=${effectiveConfig.extendedThinking})`
          : ""
      }`
    );
  }

  if (effectiveConfig.via === "openrouter") {
    return callOpenRouter({
      systemPrompt: opts.systemPrompt,
      userPrompt: opts.userPrompt,
      context: opts.context,
      modelConfig: effectiveConfig,
    });
  }

  if (effectiveConfig.via === "google") {
    return callGemini({
      systemPrompt: opts.systemPrompt,
      userPrompt: opts.userPrompt,
      context: opts.context,
      model: effectiveConfig.model,
    });
  }

  throw new Error(`Unknown provider for skill "${skill}"`);
}
