# Docket-Aware Repurpose — Design

**Date:** 2026-04-16
**Context:** After an episode is recorded, `/repurpose` analyzes the transcript and suggests clips. Today that analysis is transcript-only — it loses the link back to the docket topic (and its `original_url`) that sparked each segment. This feature makes the analysis docket + runsheet aware and surfaces the source article/tweet on each clip card, so during manual editing Rik can decide to use the clip alone, overlay the source as B-roll, or split-screen with the source.

## Goals

1. Enrich clip suggestions with the docket topic that sparked them (LLM-matched during analysis).
2. Show the source URL + OG image on each clip card in `/repurpose` → one tap opens the original tweet/article.
3. Capture per-clip layout intent (`clip_only` / `broll` / `split_screen`) as metadata on the clip, so the decision is made while context is fresh and travels with the clip to manual editing (and later, Remotion automation).
4. Add a one-line coverage note to the repurpose overview: "X of Y docket topics covered; topic Z was skipped or <30s."
5. Align clip segment names with the runsheet's segment names (e.g. "The Signal", "God Mode Takes") when possible.

## Non-goals

- ffmpeg / video rendering of any kind. Clip editing stays manual.
- New `clips` table rows, new `source_videos` handling, new caption burning.
- A standalone runsheet-coverage analysis page. Coverage lives as a single-sentence note on the existing overview tab.
- Per-clip freeform notes, tagging, or any other clip metadata beyond `docket_topic_id` + `layout_choice`.
- CSV / JSON export of clip decisions. Decisions are read inside the `/repurpose` UI only.
- Preservation of layout choices across re-runs of `repurpose-analyze`. Re-running the skill replaces the clip list; previous layout choices are lost. Documented, not prevented.
- Live tweet rendering / Puppeteer screenshotting of sources. The visual asset is whatever `original_image_url` already holds (OG image or FxTwitter photo, captured during docket-add).
- Changes to how clips are posted to Buffer. That flow stays manual copy-paste.

---

## Architecture

The feature is **metadata + UI only**. No new tables, no migrations, no worker pipelines.

Three touch points:

1. **`apps/worker/src/skills/repurpose-analyze.ts`** — fetch docket topics + latest runsheet, pass to LLM, prompt produces `docket_topic_id` per clip and a `coverage_note` on the root.
2. **`apps/web/src/app/api/repurpose/clip-decision/route.ts`** (new) — PATCH endpoint that writes `layout_choice` into the JSON.
3. **`apps/web/src/app/(dashboard)/repurpose/components/tab-shorts.tsx`** (and `tab-overview.tsx`) — render the source strip, layout toggle, and coverage banner.

### Data flow

```
docket_topics (status='in') ─┐
runsheets (latest)           ├─→ repurpose-analyze ─→ repurpose_outputs.content JSON
transcripts (clean)         ─┘                          │
                                                         ├─ coverage_note
                                                         └─ clip_candidates[]
                                                            ├─ docket_topic_id (LLM)
                                                            └─ layout_choice  (user, via PATCH)
                                                                  │
                                                         /repurpose UI ─→ reads, writes via PATCH
```

---

## Section 1 — Skill changes (`repurpose-analyze.ts`)

### Additional data fetched

In the existing `Promise.all` block, add two queries in parallel:

```ts
supabase
  .from("docket_topics")
  .select("id, title, context, angle, original_url, original_image_url")
  .eq("episode_id", payload.episodeId)
  .eq("status", "in")
  .order("sort_order"),

supabase
  .from("runsheets")
  .select("content")
  .eq("episode_id", payload.episodeId)
  .order("generated_at", { ascending: false })
  .limit(1),
```

Note the existing skill already fetches docket topics for the transcript prompt — but only `title, context, angle`. We extend that select to include `id, original_url, original_image_url` (and use it in both places).

### Prompt changes

**New input sections** appended after the transcript:

```
Docket topics (id → topic):
[{ "id": "uuid", "title": "...", "context": "...", "angle": "...", "has_source": true }, ...]

Runsheet segments:
[{ "name": "The Signal", "time_label": "5:00–15:00", "seed_points_by_host": {...} }, ...]
```

**New fields in the output JSON:**

- `coverage_note: string` — at the root. One sentence describing docket coverage. Example: `"Covered 4 of 5 docket topics; 'zkEVM rollups' was skipped."` Empty string if no docket topics (solo episode).
- `clip_candidates[].docket_topic_id: string | null` — the matching docket topic UUID, or null if the clip doesn't map to a docket item.

**New instructions (added to `SYSTEM_PROMPT`):**

- "If a clip's content aligns with a docket topic, set `docket_topic_id` to that topic's UUID from the list provided. Match on substance (the clip is about that topic), not just keyword overlap. If unsure, leave null."
- "Use the runsheet segment names when naming entries in `topic_segments` so segments align with the planned structure."
- "Produce a `coverage_note` at the root: one sentence about how the actual conversation matched the planned docket. Mention topics that were skipped or covered in <30 seconds."

### Backward compatibility

Existing consumers reading `content.clip_candidates[]` will see two new optional fields and keep working. `coverage_note` is a new top-level key — consumers ignoring unknown keys are unaffected.

### No schema change

All additions live inside `repurpose_outputs.content` JSON.

---

## Section 2 — PATCH endpoint

**New file:** `apps/web/src/app/api/repurpose/clip-decision/route.ts`

**Method:** `PATCH`

**Body:**

```ts
{
  outputId: string;      // repurpose_outputs.id
  clipIndex: number;     // index into content.clip_candidates[]
  layoutChoice: "clip_only" | "broll" | "split_screen" | null;
}
```

**Behavior:**

1. Validate body (zod or inline).
2. Read `repurpose_outputs` row by id.
3. Read the clip at `content.clip_candidates[clipIndex]`. 404 if out of range.
4. Set `layout_choice` on that clip.
5. Write back with `supabase.from("repurpose_outputs").update({ content }).eq("id", outputId)`.
6. Return `{ ok: true, clip: <updated clip> }`.

**Concurrency:** single-user app, not worth optimistic locking. Last write wins.

**Auth:** follows the existing auth pattern in `apps/web/src/app/api/**`.

---

## Section 3 — UI

### Types

Extend the `ClipCandidate` type (wherever it's defined in `/repurpose/components/`) to include:

```ts
docket_topic_id?: string | null;
layout_choice?: "clip_only" | "broll" | "split_screen" | null;
```

Add a new lookup structure in the repurpose page: a map `docketTopicsById: Record<string, { original_url: string; original_image_url: string | null; title: string }>` fetched once alongside the output.

### `tab-shorts.tsx` — per-clip card additions

Under the existing clip card body, add a conditional block:

```
┌ Clip card body (existing) ─────────────────────┐
│ Title · Hook · Host · Priority · Why it works  │
├────────────────────────────────────────────────┤
│ [source strip — only if docket_topic_id maps]  │
│   [thumb 48×48]  favicon · domain              │
│                  ↳ tap → open original_url     │
├────────────────────────────────────────────────┤
│ Layout: ( ) Clip only  ( ) + B-roll  ( ) Split │
│   ↑ pill group, default = Clip only            │
└────────────────────────────────────────────────┘
```

**Source strip rules:**

- Only renders if `docket_topic_id` is set AND the lookup resolves to a topic AND that topic has `original_url`.
- If `original_image_url` is null, show favicon-only, no thumbnail.
- The strip itself is a clickable `<a href={original_url} target="_blank" rel="noopener noreferrer">`.
- Domain is derived from `new URL(original_url).hostname` (strip `www.`).

**Layout toggle rules:**

- Three pills. Active pill has `bg-accent` styling.
- `null` layout_choice is treated as `clip_only` visually (Clip only is the default pill on first render).
- If the clip has no `docket_topic_id` / no resolvable source → the pill group is rendered but `+ B-roll` and `Split-screen` are disabled (greyed out with a tooltip `"No source asset for this clip"`). `Clip only` stays enabled — lets Rik explicitly mark clips he's reviewed.
- Click handler calls the PATCH endpoint with the outputId (the master repurpose output id) and the clip index. Optimistic update on the UI, revert on error.

### `tab-overview.tsx` — coverage banner

At the top of the overview tab, if `content.coverage_note` is a non-empty string, render a single-line info banner:

```
ⓘ Covered 4 of 5 docket topics; 'zkEVM rollups' was skipped.
```

Uses the existing banner/info-card component if one exists, otherwise a simple `<div>` with `bg-muted text-sm rounded p-3`. No interactivity. No dismissal.

If the episode has zero docket topics (solo episode), `coverage_note` is `""` and the banner does not render.

### Data fetch

The repurpose page already loads `repurpose_outputs` for the current episode. Add a parallel fetch of docket topics (the same subset the skill consumes) for this episode, keyed by `id` for O(1) lookup in the card. The fetch belongs in the same `loadData` / page-level effect; no new hook.

---

## Section 4 — Testing

### Unit
- `repurpose-analyze`: mock Supabase responses for `docket_topics` and `runsheets`, assert the user prompt string contains the topic IDs and runsheet segment names.

### Integration
- Seed: episode with 3 `docket_topics` (status `in`) with distinct `original_url` + `original_image_url`, and a runsheet with the standard 6 segments.
- Run the skill against a known transcript.
- Assert: ≥1 clip has `docket_topic_id` set, it resolves to a real topic, and `coverage_note` is a non-empty string.

### Manual
- Run on EP 09 transcript (latest). Open `/repurpose`. Verify:
  - At least some clip cards show a source strip.
  - Tapping the strip opens the original URL in a new tab.
  - Picking a layout pill persists across page reload.
  - Coverage banner appears on the overview tab.
- Re-run analyze on the same episode. Confirm that clip layout_choice values reset (expected behavior; documented).

---

## Section 5 — Risks & mitigations

- **LLM false-positive topic matches.** The model may link a clip to a loosely-related docket topic. Mitigation: prompt explicitly says "match on substance, leave null if unsure." No DB enforcement. Rik can visually spot mismatches in the UI and ignore them.
- **Large prompts.** Episodes with 8+ docket topics + full runsheet JSON + full transcript may approach token limits. Mitigation: pass only the fields the LLM needs (`id, title, context, angle` for topics; just segment names + time labels for runsheet). Do NOT pass full transcripts of `seed_points` in every runsheet segment.
- **Re-run loses decisions.** Acceptable for v1 — called out in non-goals. When Remotion lands, clip materialization into the `clips` table will give stable IDs and decision persistence falls out naturally.
- **Runsheet may not exist yet for an episode.** Skill fetches `.limit(1)`; handle empty result by omitting the runsheet section from the prompt and skipping segment-name alignment. No error thrown.
- **Buffer publishing unchanged.** Ensure the existing `TabSchedule` flow doesn't break when clip candidates carry new fields — it should ignore unknown fields today.

---

## Section 6 — Build order

1. **Skill changes** (`repurpose-analyze.ts`) — fetch + prompt + output fields. Testable end-to-end by re-running analyze on EP 09.
2. **Types + PATCH endpoint** — define the shared `ClipCandidate` type extension, build the PATCH route.
3. **UI — source strip + layout toggle** in `tab-shorts.tsx`. Use mocked data first if needed, then real data.
4. **UI — coverage banner** in `tab-overview.tsx`.
5. **Manual QA on EP 09**, adjust prompt if topic-match quality is poor.

Ships as a single PR; no phase split needed. Estimated ~1 day of work if no surprises in the existing repurpose UI structure.

---

## Section 7 — Future work (out of scope for this spec)

- **Remotion automation (~2 months out):** materialize `clip_candidates` into the `clips` table with stable IDs. Persist `layout_choice` across re-runs. Feed layout choices + source assets into Remotion compositions.
- **Coverage page:** if the single-line note proves useful, a full coverage view (topic-by-topic depth, timestamps of mentions) becomes an obvious v2.
- **Live tweet rendering:** if static OG images look bad as B-roll, revisit headless-Chrome or tweetpik once render pipeline exists.
