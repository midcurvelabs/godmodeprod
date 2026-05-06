import { supabase } from "../lib/supabase";
import { callModel } from "../lib/router";
import {
  fetchUrlContent,
  scrapeTwitterProfile,
  isTwitterUrl,
} from "../lib/scrape";

interface GuestEnrichPayload {
  guestId: string;
  showId: string;
  name: string;
  twitterHandle?: string;
  twitterUrl?: string;
  sourceUrl?: string;
  notes?: string;
}

const SYSTEM_PROMPT = `You are a podcast booking researcher for a tech / web3 / AI podcast.

Given scraped public content about a person (Twitter/X profile, recent tweet, or webpage), produce a guest profile with:
1. A clean canonical name (use the real name from the scraped profile when possible).
2. A short bio: 1-2 punchy sentences saying who they are.
3. Background: 2-3 paragraphs covering what they're known for, current projects, why they'd be interesting to interview NOW. Use concrete facts from the scraped content. Do NOT invent credentials, companies, or affiliations.
4. (Optional) A profile image URL if the scraped data includes an avatar.

If the scraped content is sparse, say so honestly and keep the entry short rather than fabricating.

Output ONLY valid JSON:
{
  "name": "Canonical Name",
  "bio": "Short 1-2 sentence bio",
  "background": "2-3 paragraph background",
  "image_url": "https://... (optional)"
}`;

export async function execute(
  payload: GuestEnrichPayload
): Promise<Record<string, unknown>> {
  // Fetch show context (same shape docket-add uses)
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
    episode_id: "",
  };

  if (showContextRows) {
    for (const row of showContextRows) {
      const ct = row.context_type as string;
      if (ct === "soul") context.soul = row.content as Record<string, unknown>;
      else if (ct === "hosts") context.hosts = row.content as Record<string, unknown>;
      else if (ct === "brand") context.brand = row.content as Record<string, unknown>;
      else if (ct === "workflow")
        context.workflow = row.content as Record<string, unknown>;
    }
  }

  // 1. Gather scraped content. Priority order:
  //    handle → profile, then sourceUrl (tweet or webpage), else just name.
  const scrapedSegments: string[] = [];
  let scrapedImageUrl: string | undefined;

  if (payload.twitterHandle) {
    try {
      const profile = await scrapeTwitterProfile(payload.twitterHandle);
      scrapedSegments.push(`--- TWITTER PROFILE ---\n${profile.text}`);
      if (profile.imageUrl) scrapedImageUrl = profile.imageUrl;
    } catch (err) {
      scrapedSegments.push(
        `[Twitter profile fetch failed for @${payload.twitterHandle}: ${
          err instanceof Error ? err.message : String(err)
        }]`
      );
    }
  }

  if (payload.sourceUrl) {
    // If sourceUrl is itself a Twitter URL of a tweet/profile, fetchUrlContent
    // will route through FxTwitter automatically.
    const scraped = await fetchUrlContent(payload.sourceUrl);
    scrapedSegments.push(`--- SOURCE URL (${payload.sourceUrl}) ---\n${scraped.text}`);
    if (!scrapedImageUrl && scraped.imageUrl) scrapedImageUrl = scraped.imageUrl;
  } else if (payload.twitterUrl && !isTwitterUrl(payload.twitterUrl)) {
    // Defensive: the field is intended for x.com URLs but accept any.
    const scraped = await fetchUrlContent(payload.twitterUrl);
    scrapedSegments.push(`--- LINK (${payload.twitterUrl}) ---\n${scraped.text}`);
    if (!scrapedImageUrl && scraped.imageUrl) scrapedImageUrl = scraped.imageUrl;
  }

  if (scrapedSegments.length === 0) {
    scrapedSegments.push(
      `[No scraped content available — only the submitted name "${payload.name}".]`
    );
  }

  const userPromptParts: string[] = [
    `Build a guest profile for "${payload.name}".`,
  ];
  if (payload.twitterHandle)
    userPromptParts.push(`Twitter/X handle: @${payload.twitterHandle}`);
  if (payload.twitterUrl) userPromptParts.push(`Twitter/X URL: ${payload.twitterUrl}`);
  if (payload.sourceUrl) userPromptParts.push(`Source URL: ${payload.sourceUrl}`);
  if (payload.notes) userPromptParts.push(`Submitter note: ${payload.notes}`);
  userPromptParts.push("");
  userPromptParts.push("--- SCRAPED CONTENT ---");
  userPromptParts.push(scrapedSegments.join("\n\n"));
  userPromptParts.push("--- END SCRAPED CONTENT ---");

  const userPrompt = userPromptParts.join("\n");

  const response = await callModel("guest-enrich", {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
  });

  let parsed: {
    name?: string;
    bio?: string;
    background?: string;
    image_url?: string;
  };
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {};
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  // Only override the row's name if the AI returned something more specific
  // than the placeholder we inserted from Telegram.
  if (parsed.name && parsed.name.trim() && parsed.name !== payload.name) {
    updates.name = parsed.name.trim();
  }
  if (parsed.bio) updates.bio = parsed.bio;
  if (parsed.background) updates.background = parsed.background;
  const finalImage = parsed.image_url || scrapedImageUrl;
  if (finalImage) updates.original_image_url = finalImage;
  updates.enrichment_data = {
    raw_response: response,
    parsed,
    scraped_image_url: scrapedImageUrl || null,
  };

  await supabase.from("guests").update(updates).eq("id", payload.guestId);

  return {
    guestId: payload.guestId,
    enriched: true,
    imageUrl: finalImage,
    ...parsed,
  };
}
