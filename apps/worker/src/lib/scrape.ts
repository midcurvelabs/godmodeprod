// Shared URL scraping helpers used by enrichment skills (docket-add, guest-enrich).
//
// FxTwitter for x.com / twitter.com (no auth required), generic HTML scrape
// with og: meta extraction for everything else. Both return a normalized
// `{ text, imageUrl? }` shape so callers can feed it straight into a prompt.

export interface ScrapedContent {
  text: string;
  imageUrl?: string;
}

export function isTwitterUrl(url: string): boolean {
  return /^https?:\/\/(x\.com|twitter\.com)\//i.test(url);
}

export interface FxTweetAuthor {
  name?: string;
  screen_name?: string;
  avatar_url?: string;
}

export interface FxTweet {
  text?: string;
  created_at?: string;
  likes?: number;
  retweets?: number;
  author?: FxTweetAuthor;
  media?: {
    all?: unknown[];
    photos?: Array<{ url?: string }>;
  };
}

export interface FxProfile {
  name?: string;
  screen_name?: string;
  description?: string;
  avatar_url?: string;
  banner_url?: string;
  followers?: number;
  following?: number;
  location?: string;
  url?: string;
  verified?: boolean;
}

export async function scrapeTwitter(url: string): Promise<ScrapedContent> {
  const fxUrl = url.replace(
    /^https?:\/\/(x\.com|twitter\.com)/i,
    "https://api.fxtwitter.com"
  );
  const res = await fetch(fxUrl, {
    headers: { "User-Agent": "GodModeProd/1.0" },
  });
  if (!res.ok) throw new Error(`FxTwitter ${res.status}`);
  const data = await res.json();
  const tweet: FxTweet | undefined = data.tweet;
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
  const imageUrl: string | undefined =
    tweet.media?.photos?.[0]?.url || tweet.author?.avatar_url || undefined;
  return { text: parts.join("\n"), imageUrl };
}

// Fetch a Twitter/X user profile via FxTwitter (no auth). `handle` may include
// or omit the leading @.
export async function scrapeTwitterProfile(handle: string): Promise<{
  text: string;
  imageUrl?: string;
  profile: FxProfile | null;
}> {
  const screen = handle.replace(/^@/, "").trim();
  if (!screen) throw new Error("empty handle");
  const res = await fetch(`https://api.fxtwitter.com/${encodeURIComponent(screen)}`, {
    headers: { "User-Agent": "GodModeProd/1.0" },
  });
  if (!res.ok) throw new Error(`FxTwitter profile ${res.status}`);
  const data = await res.json();
  const user: FxProfile | undefined = data.user || data.profile;
  if (!user) {
    return { text: `[No profile data for @${screen}]`, profile: null };
  }
  const parts = [
    `Name: ${user.name || screen}`,
    `Handle: @${user.screen_name || screen}`,
  ];
  if (user.description) parts.push(`Bio: ${user.description}`);
  if (user.location) parts.push(`Location: ${user.location}`);
  if (user.url) parts.push(`Link: ${user.url}`);
  if (user.followers !== undefined) parts.push(`Followers: ${user.followers}`);
  if (user.following !== undefined) parts.push(`Following: ${user.following}`);
  if (user.verified) parts.push(`Verified: yes`);
  return {
    text: parts.join("\n"),
    imageUrl: user.avatar_url,
    profile: user,
  };
}

export async function scrapeGenericUrl(url: string): Promise<ScrapedContent> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GodModeProd/1.0)",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  const desc = descMatch ? descMatch[1].trim() : "";
  const ogTitleMatch = html.match(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
  );
  const ogDescMatch = html.match(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i
  );
  const ogImageMatch =
    html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
    html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  let imageUrl: string | undefined = ogImageMatch?.[1]?.trim() || undefined;
  if (imageUrl) {
    try {
      imageUrl = new URL(imageUrl, url).toString();
    } catch {
      imageUrl = undefined;
    }
  }
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
  const parts: string[] = [];
  if (title || ogTitleMatch?.[1]) parts.push(`Title: ${ogTitleMatch?.[1] || title}`);
  if (desc || ogDescMatch?.[1]) parts.push(`Description: ${ogDescMatch?.[1] || desc}`);
  if (bodyText) parts.push(`Content: ${bodyText}`);
  return {
    text: parts.join("\n\n") || "Could not extract content from page.",
    imageUrl,
  };
}

export async function fetchUrlContent(url: string): Promise<ScrapedContent> {
  try {
    if (isTwitterUrl(url)) return await scrapeTwitter(url);
    return await scrapeGenericUrl(url);
  } catch (err) {
    return {
      text: `[Failed to fetch URL content: ${err instanceof Error ? err.message : String(err)}]\nURL: ${url}`,
    };
  }
}
