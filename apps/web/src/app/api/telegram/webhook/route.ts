import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ensureLatestEpisode, SKILL_REGISTRY } from "@godmodeprod/shared";

/**
 * Telegram Bot webhook.
 *
 * Register once (outside of this handler) with:
 *   POST https://api.telegram.org/bot<TOKEN>/setWebhook
 *        url=https://<host>/api/telegram/webhook
 *        secret_token=<TELEGRAM_WEBHOOK_SECRET>
 *
 * Supported commands:
 *   /docket <url> [note]   — add a topic to the latest episode
 *   /list                  — reply with titles of last 10 topics on latest episode
 *   /guest <name | @handle | url> [-- note]
 *                          — add a guest to the show wishlist (async enrichment)
 *   /guests, /wishlist     — reply with last 10 guests in the wishlist
 */

interface TgUser {
  id: number;
  first_name?: string;
  username?: string;
}

interface TgChat {
  id: number;
}

interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

const URL_RE = /https?:\/\/\S+/i;
const TWITTER_HANDLE_RE = /(?:^|\s)@([A-Za-z0-9_]{1,15})\b/;
const TWITTER_URL_RE = /^https?:\/\/(x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})(?:\/|$|\?)/i;

async function sendMessage(chatId: number, text: string, replyTo?: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_to_message_id: replyTo,
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // Non-fatal — user gets no ack, but the topic was still created.
  }
}

function parseAllowedChats(): Set<string> {
  const raw = process.env.TELEGRAM_ALLOWED_CHATS || "";
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

function submitterFrom(user?: TgUser): string {
  if (!user) return "Telegram";
  const first = user.first_name || "";
  const handle = user.username ? `@${user.username}` : "";
  return [first, handle].filter(Boolean).join(" ") || "Telegram";
}

export async function POST(request: Request) {
  // 1. Verify secret token header.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message || !message.text) {
    return NextResponse.json({ ok: true });
  }

  // 3. Check chat allow-list. Silently ack if not allowed — don't leak bot existence.
  const allowed = parseAllowedChats();
  if (!allowed.has(String(message.chat.id))) {
    return NextResponse.json({ ok: true });
  }

  const text = message.text.trim();

  // Only handle known commands.
  // NOTE: order matters — `/guests` must be tested before `/guest`.
  const isGuestList =
    text.startsWith("/guests") || text.startsWith("/wishlist");
  const isGuestAdd = !isGuestList && text.startsWith("/guest");
  const isDocket = text.startsWith("/docket");
  const isListCmd = text.startsWith("/list") && !isGuestList;
  if (!isDocket && !isListCmd && !isGuestAdd && !isGuestList) {
    return NextResponse.json({ ok: true });
  }

  const supabase = getSupabaseServer();

  // MVP: single show assumption.
  const { data: shows } = await supabase.from("shows").select("id").limit(1);
  const showId = shows?.[0]?.id as string | undefined;
  if (!showId) {
    await sendMessage(message.chat.id, "⚠️ No show configured.", message.message_id);
    return NextResponse.json({ ok: true });
  }

  // --- /list ---
  if (isListCmd) {
    const episode = await ensureLatestEpisode(supabase, showId);
    const { data: topics } = await supabase
      .from("docket_topics")
      .select("title, status")
      .eq("episode_id", episode.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const epLabel = `EP ${String(episode.episode_number).padStart(2, "0")}`;
    if (!topics || topics.length === 0) {
      await sendMessage(message.chat.id, `${epLabel} has no topics yet.`, message.message_id);
    } else {
      const lines = topics.map((t, i) => `${i + 1}. ${t.title} [${t.status}]`);
      await sendMessage(
        message.chat.id,
        `${epLabel} — last ${topics.length} topics:\n${lines.join("\n")}`,
        message.message_id
      );
    }
    return NextResponse.json({ ok: true });
  }

  // --- /guests ---
  if (isGuestList) {
    const { data: guests } = await supabase
      .from("guests")
      .select("name, twitter_handle, status")
      .eq("show_id", showId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!guests || guests.length === 0) {
      await sendMessage(message.chat.id, "Guest wishlist is empty.", message.message_id);
    } else {
      const lines = guests.map((g, i) => {
        const handle = g.twitter_handle ? ` (@${g.twitter_handle})` : "";
        return `${i + 1}. ${g.name}${handle} [${g.status}]`;
      });
      await sendMessage(
        message.chat.id,
        `Guest wishlist — last ${guests.length}:\n${lines.join("\n")}`,
        message.message_id
      );
    }
    return NextResponse.json({ ok: true });
  }

  // --- /guest <name | @handle | url> [-- note] ---
  if (isGuestAdd) {
    const afterCommand = text.replace(/^\/guest(@\S+)?\s*/, "");

    // Split off an optional note after `--` so handles/URLs in the note don't
    // confuse the parser.
    const [headRaw, ...noteParts] = afterCommand.split(/\s+--\s+/);
    const head = (headRaw || "").trim();
    const noteText = noteParts.join(" -- ").trim();

    if (!head) {
      await sendMessage(
        message.chat.id,
        "Usage: /guest <name | @handle | url> [-- note]",
        message.message_id
      );
      return NextResponse.json({ ok: true });
    }

    // Pull out URL, twitter handle, and what's left = display name.
    const urlMatch = head.match(URL_RE);
    const sourceUrl = urlMatch?.[0] || "";
    let remainder = head.replace(URL_RE, "").trim();

    // If the URL looks like a Twitter/X profile, pull the handle from it.
    let twitterHandle = "";
    let twitterUrl = "";
    if (sourceUrl) {
      const twMatch = sourceUrl.match(TWITTER_URL_RE);
      if (twMatch) {
        twitterHandle = twMatch[2];
        twitterUrl = sourceUrl;
      }
    }
    if (!twitterHandle) {
      const handleMatch = remainder.match(TWITTER_HANDLE_RE);
      if (handleMatch) {
        twitterHandle = handleMatch[1];
        remainder = remainder.replace(handleMatch[0], "").trim();
      }
    }
    if (twitterHandle && !twitterUrl) {
      twitterUrl = `https://x.com/${twitterHandle}`;
    }

    const fallbackName =
      remainder || (twitterHandle ? `@${twitterHandle}` : sourceUrl || "Unknown");

    const { data: guest, error: insertError } = await supabase
      .from("guests")
      .insert({
        show_id: showId,
        name: fallbackName,
        twitter_handle: twitterHandle,
        twitter_url: twitterUrl,
        source_url: sourceUrl,
        notes: noteText,
        status: "wishlist",
        submitted_by: submitterFrom(message.from),
      })
      .select()
      .single();

    if (insertError || !guest) {
      // Conflict on (show_id, lower(twitter_handle)) → already on the wishlist.
      const isDup = insertError?.code === "23505";
      await sendMessage(
        message.chat.id,
        isDup
          ? `ℹ️ ${twitterHandle ? "@" + twitterHandle : fallbackName} is already on the wishlist.`
          : `⚠️ Failed to add: ${insertError?.message || "unknown"}`,
        message.message_id
      );
      return NextResponse.json({ ok: true });
    }

    await supabase.from("jobs").insert({
      show_id: showId,
      episode_id: null,
      queue: SKILL_REGISTRY["guest-enrich"]?.queue || "ai-jobs",
      job_type: "guest-enrich",
      status: "pending",
      payload: {
        guestId: guest.id,
        showId,
        name: fallbackName,
        twitterHandle: twitterHandle || undefined,
        twitterUrl: twitterUrl || undefined,
        sourceUrl: sourceUrl || undefined,
        notes: noteText || undefined,
      },
    });

    await sendMessage(
      message.chat.id,
      `✅ Added ${fallbackName} to guest wishlist — enriching now.`,
      message.message_id
    );
    return NextResponse.json({ ok: true });
  }

  // --- /docket <url> [note] ---
  // Strip the command token.
  const afterCommand = text.replace(/^\/docket(@\S+)?\s*/, "");
  const urlMatch = afterCommand.match(URL_RE);
  const url = urlMatch?.[0];
  const note = afterCommand
    .replace(URL_RE, "")
    .trim()
    .replace(/^[-—:]\s*/, "");

  if (!url && !note) {
    await sendMessage(
      message.chat.id,
      "Usage: /docket <url> [note]",
      message.message_id
    );
    return NextResponse.json({ ok: true });
  }

  // 5. Ensure latest episode.
  let episode;
  try {
    episode = await ensureLatestEpisode(supabase, showId);
  } catch (err) {
    await sendMessage(
      message.chat.id,
      `⚠️ Failed to resolve episode: ${err instanceof Error ? err.message : "unknown"}`,
      message.message_id
    );
    return NextResponse.json({ ok: true });
  }

  const isLocked = episode.status === "docket_locked";

  // Find next sort_order for this episode.
  const { data: existing } = await supabase
    .from("docket_topics")
    .select("sort_order")
    .eq("episode_id", episode.id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const title = note || url || "Untitled";

  // 6. Insert topic.
  const { data: topic, error: insertError } = await supabase
    .from("docket_topics")
    .insert({
      episode_id: episode.id,
      show_id: showId,
      title,
      context: "",
      angle: "",
      sources: [],
      original_url: url || "",
      submitted_by: submitterFrom(message.from),
      status: isLocked ? "in" : "under_review",
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (insertError || !topic) {
    await sendMessage(
      message.chat.id,
      `⚠️ Failed to add: ${insertError?.message || "unknown"}`,
      message.message_id
    );
    return NextResponse.json({ ok: true });
  }

  // 7. Dispatch enrichment job only if we have a URL.
  if (url) {
    await supabase.from("jobs").insert({
      show_id: showId,
      episode_id: episode.id,
      queue: SKILL_REGISTRY["docket-add"]?.queue || "ai-jobs",
      job_type: "docket-add",
      status: "pending",
      payload: {
        topicId: topic.id,
        showId,
        episodeId: episode.id,
        url,
      },
    });
  }

  // 8. Ack.
  const epLabel = `EP ${String(episode.episode_number).padStart(2, "0")}`;
  const reply = url
    ? `✅ Added to ${epLabel} — enriching now.`
    : `✅ Added to ${epLabel}.`;
  await sendMessage(message.chat.id, reply, message.message_id);

  return NextResponse.json({ ok: true });
}
