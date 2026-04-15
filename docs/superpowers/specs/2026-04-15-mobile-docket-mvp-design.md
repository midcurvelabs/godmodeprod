# Mobile Docket MVP — Design

**Date:** 2026-04-15
**Context:** Rik records episode 09 tomorrow (Thu). Needs the docket + research brief workflows to work well on mobile, so he can capture topics from his phone, review the brief, and tap through to original tweets/articles during the live episode.

## Goals

1. Capture topics from phone with minimum friction (paste → submit → enriched).
2. Review the research brief on phone (already generated on desktop or mobile).
3. During the episode, tap any docket topic to open its original URL (tweet, article) to moderate with the original content visible.
4. Set up a Telegram bot so anyone in the show's Telegram group can drop links via `/docket <url>` (phase 2, specced but shipped after phases 1–3).

## Non-goals

- PWA / iOS share-sheet integration.
- Voting, comment-writing, or drag-reorder on mobile (view-only where applicable).
- Real-time sync between devices (polling / revalidate-on-focus is sufficient).
- A separate "live show" route. The mobile docket IS the live surface.
- Authentication changes. Current single-user setup stays.

---

## Phase 1 — Mobile-responsive `/docket`

The existing three-column desktop layout (`apps/web/src/app/(dashboard)/docket/page.tsx`) collapses to a single stack on ≤768px:

**Top zone (sticky):**
- Compact episode chip: `EP 09 · Thu Apr 23`. Tap → dropdown to change episode.
- Capture input: single text field, placeholder `Paste link or type topic…`. Submit button to its right. Enter key submits.
- Filter pills on a horizontally scrollable row: All · Under Review · In · Out.

**Main list — `Inbox`:**
- Card per topic. Each card shows:
  - Title (LLM-improved, from `docket_topics.title`)
  - Link preview row (if `original_url` present): favicon + domain + `og:image` thumbnail (if we capture it; see Phase 2 of enrichment below)
  - Context snippet (first ~120 chars of `context`)
  - Status pill + submitter
- **Tap card → bottom sheet** with full detail: context, angle, sources, comments (read-only on mobile). Actions: `Mark In`, `Mark Out`, `Open Link`.
- **Tap the link preview (anywhere on the row) → open `original_url` in new tab directly** (no sheet). This is the primary live-show interaction.

**Lineup section:**
- Below the Inbox list, collapsible header: `In lineup (3) ▾`.
- Expanded: ordered list, same card style. Up/down buttons to reorder (no drag on mobile).
- At the bottom: estimated time, `Lock Docket` button, `Summarise` button — same as desktop.

**Breakpoint rules:**
- `<768px` → single-stack mobile layout above.
- `768–1024px` → existing desktop layout, but sidebar collapses to hamburger.
- `≥1024px` → full desktop layout unchanged.

**Implementation shape:**
- Keep `page.tsx` as a single component, use Tailwind responsive classes (`md:`, `lg:`) and CSS media queries. No new `/m` route, no duplicated logic.
- Bottom sheet: headless component in `components/ui/bottom-sheet.tsx`. Minimal — overlay + sheet with close-on-tap-backdrop.

---

## Phase 2 — Mobile-responsive `/research`

Existing research page (`apps/web/src/app/(dashboard)/research/page.tsx`) has a 35/65 two-column split (brief builder / brief output).

On ≤768px:
- Top: sticky toolbar with `Copy All` / `Download .md` / `Go to Prep`.
- Below: the brief output (accordion of sections), full width.
- Brief builder (topic selection + episode context + guest toggle + Generate button) is collapsed behind a `▸ Configure brief` button at the very top. Tapping expands it as a top sheet.

The output accordion is the primary mobile read surface. Each section's expandable content needs to render well at phone width — currently the grid `grid-cols-2` for Steel Man / Straw Man stays side-by-side; on mobile it should stack (`grid-cols-1 md:grid-cols-2`).

Nothing else in the research flow changes.

---

## Phase 3 — Light enrichment polish

Only change to `docket-add.ts`: capture `og:image` in `scrapeGenericUrl` and include in returned scraped content. The LLM prompt stays the same. A new column `original_image_url TEXT` on `docket_topics` holds it for display in cards.

Migration: `supabase/migrations/<timestamp>_add_original_image_url.sql`.

Backfill: skip. Old topics show without image, which is fine.

For tweets, FxTwitter already returns `tweet.media.photos[0].url` — wire that through the same column.

---

## Phase 4 — Shared `ensureLatestEpisode` helper

New module: `packages/shared/src/episode-autocreate.ts`.

```ts
export async function ensureLatestEpisode(
  supabase: SupabaseClient,
  showId: string
): Promise<Episode>
```

Logic:
1. Select the episode with max `episode_number` for this show.
2. If none exists, create `EP 01` with `recording_date = nextThursday(today)`, `status = "created"`. Return it.
3. If `latest.recording_date` is null → return latest as-is (don't auto-advance; the user hasn't set the date yet).
4. If `latest.recording_date < today` → create new episode with `episode_number = latest + 1`, `recording_date = nextThursday(today)`, `title = "EP ${n}"`, `status = "created"`. Return the new one.
5. Otherwise → return latest.

`nextThursday(from: Date)`: returns the next Thursday that is strictly after `from`. If `from` IS a Thursday, returns `from + 7 days`.

**Callers:**
- Telegram webhook (Phase 5).
- Mobile docket page load: if no `currentEpisode` is set in the episode store, call this and set it. Means the phone always lands on the right episode with zero taps.

The existing desktop episode bar dropdown behavior does NOT change. This is an additive default.

---

## Phase 5 — Telegram bot (shipped after 1–4)

### Setup

1. `@BotFather` → `/newbot` → receive token. Store as `TELEGRAM_BOT_TOKEN` env var.
2. Create `TELEGRAM_WEBHOOK_SECRET` (random string). Store in env.
3. Create `TELEGRAM_ALLOWED_CHATS` env var: comma-separated list of allowed Telegram chat IDs. Messages from other chats are silently ignored.
4. Register webhook once (one-off curl or script): `POST https://api.telegram.org/bot<TOKEN>/setWebhook` with `url=https://<vercel-url>/api/telegram/webhook` and `secret_token=<TELEGRAM_WEBHOOK_SECRET>`.

### Webhook handler

New route: `apps/web/src/app/api/telegram/webhook/route.ts`.

Request flow:
1. Verify `X-Telegram-Bot-Api-Secret-Token` header matches `TELEGRAM_WEBHOOK_SECRET`. Reject 401 if not.
2. Parse update. Only handle `message` updates with `text` starting with `/docket`.
3. Check `message.chat.id` is in `TELEGRAM_ALLOWED_CHATS`. If not, 200 OK silently (don't leak that the bot exists).
4. Extract URL + optional note from the message text. URL = first `https?://` token; note = everything after.
5. Look up the single show (MVP assumes one show). Call `ensureLatestEpisode(supabase, showId)`.
6. Insert into `docket_topics` with:
   - `title` = URL or the note (placeholder; docket-add skill will improve it)
   - `original_url` = URL
   - `submitted_by` = `message.from.first_name` + optional `@username`
   - `status` = `under_review`, or `in` if episode is `docket_locked`
7. Dispatch `docket-add` worker job (same as web submission).
8. Reply to the Telegram message: `✅ Added to EP 09 — enriching now.` Use `sendMessage` with `reply_to_message_id`.

### Commands (MVP)

- `/docket <url> [note]` — primary.
- `/list` — reply with titles of the last 10 topics on the latest episode.

Deferred: `/in <n>`, `/out <n>`, deep-detect URLs in plain messages.

---

## Data model changes

1. `docket_topics.original_image_url TEXT` — added in Phase 3.

No other schema changes. `submitted_by` is already `TEXT`, stores Telegram display name fine.

---

## Build order

1. Mobile-responsive `/docket` (Phase 1) + bottom sheet component.
2. Mobile-responsive `/research` (Phase 2).
3. OG image capture + `original_image_url` column (Phase 3).
4. `ensureLatestEpisode` helper + wire into mobile docket page load (Phase 4).
5. Telegram bot (Phase 5).

Phases 1–4 ship together as the first PR (it's Rik's core need for tomorrow's episode). Phase 5 is a follow-up PR.

---

## Testing

- Phase 1/2: manual verification on an iPhone or Chrome devtools mobile emulation. Real phone preferred since `env(safe-area-inset-*)` matters.
- Phase 3: submit a tweet URL and a news article URL, confirm `original_image_url` populates and renders.
- Phase 4: unit test `nextThursday` (table-driven with edge cases: Wednesday → next Thu, Thursday → +7, Sunday → upcoming Thu). Integration test `ensureLatestEpisode` against a local Supabase.
- Phase 5: test webhook locally via ngrok → `curl` with Telegram-shaped JSON. Verify signature rejection, allow-list enforcement, topic creation, reply-on-success.

## Risks

- **Mobile layout regressions on desktop.** Responsive changes can break desktop. Mitigation: review at all three breakpoints after every commit.
- **Telegram webhook needs public HTTPS URL.** Works fine on Vercel preview/prod. Local dev needs ngrok.
- **Single-show assumption in bot.** MVP has one show. If we add a second show later, `/docket` needs a show argument or per-chat show mapping. Not a blocker now.
- **Rate limits on FxTwitter** — no known issue, but worth monitoring if the bot drives up volume.
