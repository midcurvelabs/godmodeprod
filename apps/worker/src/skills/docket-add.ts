import { supabase } from "../lib/supabase";
import type { callGemini as GeminiFn } from "../lib/gemini";

interface DocketAddPayload {
  topicId: string;
  showId: string;
  episodeId: string;
  url?: string;
  rawText?: string;
}

// --- URL scraping helpers ---

function isTwitterUrl(url: string): boolean {
  return /^https?:\/\/(x\.com|twitter\.com)\//i.test(url);
}

async function scrapeTwitter(url: string): Promise<string> {
  // Use FxTwitter API — returns tweet JSON without auth
  const fxUrl = url
    .replace(/^https?:\/\/(x\.com|twitter\.com)/i, "https://api.fxtwitter.com");
  const res = await fetch(fxUrl, {
    headers: { "User-Agent": "GodModeProd/1.0" },
  });
  if (!res.ok) throw new Error(`FxTwitter ${res.status}`);
  const data = await res.json();
  const tweet = data.tweet;
  if (!tweet) throw new Error("No tweet data returned");
  const parts = [
    `Author: ${tweet.author?.name || "Unknown"} (@${tweet.author?.screen_name || "unknown"})`,
    `Text: ${tweet.text}`,
  ];
  if (tweet.created_at) parts.push(`Posted: ${tweet.created_at}`);
  if (tweet.likes) parts.push(`Likes: ${tweet.likes}`);
  if (tweet.retweets) parts.push(`Retweets: ${tweet.retweets}`);
  if (tweet.media?.all?.length) {
    parts.push(`Media: ${tweet.media.all.length} attachment(s)`);
  }
  return parts.join("\n");
}

async function scrapeGenericUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GodModeProd/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  const desc = descMatch ? descMatch[1].trim() : "";
  // Extract og:title and og:description
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  // Strip HTML tags from body text, take first 2000 chars
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let bodyText = "";
  if (bodyMatch) {
    bodyText = bodyMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);
  }
  const parts = [];
  if (title || ogTitleMatch?.[1]) parts.push(`Title: ${ogTitleMatch?.[1] || title}`);
  if (desc || ogDescMatch?.[1]) parts.push(`Description: ${ogDescMatch?.[1] || desc}`);
  if (bodyText) parts.push(`Content: ${bodyText}`);
  return parts.join("\n\n") || "Could not extract content from page.";
}

async function fetchUrlContent(url: string): Promise<string> {
  try {
    if (isTwitterUrl(url)) {
      return await scrapeTwitter(url);
    }
    return await scrapeGenericUrl(url);
  } catch (err) {
    return `[Failed to fetch URL content: ${err instanceof Error ? err.message : String(err)}]\nURL: ${url}`;
  }
}

const SYSTEM_PROMPT = `You are a podcast topic researcher for a tech/web3/AI podcast.

Given scraped content from a link or raw topic text, expand it into a structured docket entry with:
1. A clear, punchy title (if the original is vague, improve it)
2. Context: 2-3 sentences on what happened and why it matters NOW
3. Angle: the specific lens or take the hosts should explore (not just "discuss this")
4. Sources: relevant links with titles (if a URL was provided, include it plus any related sources you know about)

IMPORTANT: Base your response ONLY on the actual scraped content provided. Do NOT make up information. If the content is a tweet, use the actual tweet text and author — do not fabricate quotes or authors.

Your job is to give hosts enough context to decide if this topic is IN or OUT for the episode, and enough angle to make the conversation interesting.

Output ONLY valid JSON:
{
  "title": "Improved topic title",
  "context": "What happened and why it matters",
  "angle": "The specific take or lens to explore",
  "sources": [{ "url": "https://...", "title": "Source title" }]
}`;

export async function execute(
  payload: DocketAddPayload,
  callGemini: typeof GeminiFn
): Promise<Record<string, unknown>> {
  // Fetch show context
  const { data: showContextRows } = await supabase
    .from("show_context")
    .select("context_type, content")
    .eq("show_id", payload.showId);

  const context = {
    show_slug: "",
    soul: {} as Record<string, unknown>,
    hosts: {} as Record<string, unknown>,
    brand: {} as Record<string, unknown>,
    workflow: {} as Record<string, unknown>,
    assets_path: "",
    episode_number: 0,
    episode_id: payload.episodeId,
  };

  if (showContextRows) {
    for (const row of showContextRows) {
      const ct = row.context_type as string;
      if (ct === "soul") context.soul = row.content as Record<string, unknown>;
      else if (ct === "hosts") context.hosts = row.content as Record<string, unknown>;
      else if (ct === "brand") context.brand = row.content as Record<string, unknown>;
      else if (ct === "workflow") context.workflow = row.content as Record<string, unknown>;
    }
  }

  let userPrompt = "";
  if (payload.url) {
    const scraped = await fetchUrlContent(payload.url);
    userPrompt = `Expand this link into a docket entry based on the ACTUAL scraped content below.\n\nURL: ${payload.url}\n\n--- SCRAPED CONTENT ---\n${scraped}\n--- END SCRAPED CONTENT ---`;
  } else if (payload.rawText) {
    userPrompt = `Expand this topic into a docket entry:\n\n${payload.rawText}`;
  } else {
    // Fetch the existing topic title as input
    const { data: topic } = await supabase
      .from("docket_topics")
      .select("title")
      .eq("id", payload.topicId)
      .single();
    userPrompt = `Expand this topic into a docket entry:\n\n${topic?.title || "Unknown topic"}`;
  }

  const response = await callGemini({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
  });

  // Parse JSON from response
  let parsed: { title?: string; context?: string; angle?: string; sources?: Array<{ url: string; title: string }> };
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {};
  }

  // Update the docket topic
  const updates: Record<string, unknown> = {};
  if (parsed.context) updates.context = parsed.context;
  if (parsed.angle) updates.angle = parsed.angle;
  if (parsed.sources) updates.sources = parsed.sources;
  if (parsed.title) updates.title = parsed.title;

  if (Object.keys(updates).length > 0) {
    await supabase
      .from("docket_topics")
      .update(updates)
      .eq("id", payload.topicId);
  }

  return { topicId: payload.topicId, enriched: true, ...parsed };
}
