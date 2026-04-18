# Docket-Aware Repurpose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich `/repurpose` clip suggestions with the docket topic that sparked them, surface the source URL + image per clip, and let the user pick a layout intent (`clip_only` / `broll` / `split_screen`) that persists as metadata.

**Architecture:** Pure metadata + UI change. Worker skill `repurpose-analyze` adds docket + runsheet awareness (new fields in existing `repurpose_outputs.content` JSON). Next.js `/repurpose` page fetches docket topics in parallel, passes them into `tab-overview.tsx` so each clip candidate card can render a source strip + layout pill group. Layout choices persist via the already-existing `PATCH /api/repurpose/[id]` content-update endpoint.

**Tech Stack:** TypeScript, Next.js 16 App Router, React 19, Supabase (Postgres + JSONB), BullMQ worker, OpenRouter via `callModel`.

**Testing approach:** Codebase has no automated test infrastructure (no vitest/jest). Verification is manual per task — run the skill against EP 09's latest transcript and inspect via the browser preview. This is explicitly noted in each verify step.

---

## Spec reference

`docs/superpowers/specs/2026-04-16-docket-aware-repurpose-design.md`

Deviation from spec: the spec mentioned `tab-shorts.tsx` as the UI surface. That was wrong — `clip_candidates` is actually rendered inside `tab-overview.tsx` (the master analysis tab). The plan targets `tab-overview.tsx`. Intent is unchanged.

---

## File Structure

**Modify:**

- `apps/worker/src/skills/repurpose-analyze.ts` — fetch docket topics (with id/url/image) + latest runsheet; extend user prompt; extend SYSTEM_PROMPT output schema; relay new fields upward unchanged (they live inside `analysis` JSON that's already saved).
- `apps/web/src/app/(dashboard)/repurpose/page.tsx` — fetch docket topics alongside other data; pass `docketTopicsById` and `onUpdateClipLayout` into `<TabOverview/>`.
- `apps/web/src/app/(dashboard)/repurpose/components/tab-overview.tsx` — accept new props; render coverage banner; extend "Clip Candidates" cards with source strip + layout pill group.

**Create:**

- `apps/web/src/app/(dashboard)/repurpose/components/clip-source-strip.tsx` — small presentational component for source thumbnail + domain + layout pills.

**No new tables. No migrations. No new API routes** — the existing `PATCH /api/repurpose/[id]` with `{ content }` body is reused for writing layout choices.

---

## Task 1: Extend `repurpose-analyze` skill to fetch docket + runsheet

**Files:**
- Modify: `apps/worker/src/skills/repurpose-analyze.ts`

- [ ] **Step 1: Extend the `Promise.all` to also fetch full docket fields and the latest runsheet**

Open `apps/worker/src/skills/repurpose-analyze.ts`. Find the existing `supabase.from("transcripts")` fetch block (near the top of the `execute` function, around lines 106–125) and the block that reads `hosts` + `show_context`. The skill currently fetches transcript + hosts + show_context sequentially. Add two new parallel queries at the same place:

Locate the block that currently reads:

```ts
  // Fetch clean transcript
  const { data: transcript } = await supabase
    .from("transcripts")
    ...
    .single();
```

Immediately AFTER that `transcript` fetch (which must complete first so we have `payload.episodeId` available — it's already available; this is just for readability) and BEFORE the `Fetch hosts` block, insert:

```ts
  // Fetch docket topics (status 'in') with source URLs for clip→topic linking.
  const { data: docketTopics } = await supabase
    .from("docket_topics")
    .select("id, title, context, angle, original_url, original_image_url")
    .eq("episode_id", payload.episodeId)
    .eq("status", "in")
    .order("sort_order");

  // Fetch latest runsheet for the episode (if generated) so clip segments can align with planned structure.
  const { data: runsheetRows } = await supabase
    .from("runsheets")
    .select("content")
    .eq("episode_id", payload.episodeId)
    .order("generated_at", { ascending: false })
    .limit(1);

  const runsheetContent = runsheetRows?.[0]?.content as { segments?: Array<Record<string, unknown>> } | null | undefined;
```

- [ ] **Step 2: Build docket + runsheet prompt blocks**

Find the existing `userPrompt` construction (near the end of the function, around line 158):

```ts
const userPrompt = `Here are the podcast hosts. You MUST identify 5-8 clips per host:\n${hostList}\n\nAnalyze this podcast transcript and extract all repurposable content:\n\n${transcript.clean_content}`;
```

Replace that single-line assignment with the following block, which interleaves docket + runsheet sections BEFORE the transcript:

```ts
  // Build docket block (omitted entirely if empty — e.g. solo episode with no confirmed topics)
  const docketBlock = (docketTopics && docketTopics.length > 0)
    ? `\nDocket topics for this episode (match clips back to these by id when substance aligns):\n${JSON.stringify(
        docketTopics.map((t) => ({
          id: t.id,
          title: t.title,
          context: t.context,
          angle: t.angle,
          has_source: Boolean(t.original_url),
        })),
        null,
        2
      )}\n`
    : "";

  // Build runsheet block — pass only segment names + time labels; skip seed_points (too large, not needed for clip attribution)
  const runsheetBlock = runsheetContent?.segments?.length
    ? `\nRunsheet segment structure (use these segment names in topic_segments when segments align):\n${JSON.stringify(
        runsheetContent.segments.map((s) => ({
          name: s.name,
          time_label: s.time_label,
          duration_minutes: s.duration_minutes,
        })),
        null,
        2
      )}\n`
    : "";

  const userPrompt = `Here are the podcast hosts. You MUST identify 5-8 clips per host:\n${hostList}\n${docketBlock}${runsheetBlock}\nAnalyze this podcast transcript and extract all repurposable content:\n\n${transcript.clean_content}`;
```

- [ ] **Step 3: Verify the file still type-checks**

Run:

```bash
cd apps/worker && npx tsc --noEmit
```

Expected: zero errors. If there are errors related to `docketTopics` or `runsheetRows` typing, ensure the `select()` strings match the column names exactly and that the destructuring matches.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/skills/repurpose-analyze.ts
git commit -m "feat(repurpose-analyze): fetch docket topics + runsheet for clip attribution"
```

---

## Task 2: Teach the LLM about `docket_topic_id` and `coverage_note`

**Files:**
- Modify: `apps/worker/src/skills/repurpose-analyze.ts` (SYSTEM_PROMPT string, top of file)

- [ ] **Step 1: Add the `docket_topic_id` field to the `clip_candidates` schema in SYSTEM_PROMPT**

Open `apps/worker/src/skills/repurpose-analyze.ts`. Find the `clip_candidates` JSON schema block inside `SYSTEM_PROMPT` (lines 45–58 approximately, inside the big template literal). It currently ends with:

```
      "criteria_met": ["strong_hook", "personal_result", "news_peg", "named_concept", "entertainment"]
    }
  ],
```

Change it to add a new property `docket_topic_id` RIGHT BEFORE the closing `}` of the clip candidate object:

```
      "criteria_met": ["strong_hook", "personal_result", "news_peg", "named_concept", "entertainment"],
      "docket_topic_id": null
    }
  ],
```

- [ ] **Step 2: Add the `coverage_note` root field to the SYSTEM_PROMPT schema**

In the same `SYSTEM_PROMPT` literal, find this line near the top of the output JSON shape:

```
  "episode_summary": "3-4 sentence summary of the entire episode",
```

Change it to:

```
  "episode_summary": "3-4 sentence summary of the entire episode",
  "coverage_note": "One sentence describing how well the actual conversation matched the planned docket. Empty string if no docket topics were provided.",
```

- [ ] **Step 3: Add instructions for docket matching, runsheet alignment, and coverage note**

At the bottom of the `SYSTEM_PROMPT` (after the existing `IMPORTANT:` block around line 98), append these new rules to the existing `IMPORTANT` list:

Find:

```
IMPORTANT:
- Every host must have 5-8 clips. If you have fewer, re-scan the transcript.
- Priority 1 clips must have genuinely strong hooks.
- Timestamps must reference actual transcript positions.
- Quotable lines must be EXACT quotes, not paraphrased.`;
```

Replace with:

```
IMPORTANT:
- Every host must have 5-8 clips. If you have fewer, re-scan the transcript.
- Priority 1 clips must have genuinely strong hooks.
- Timestamps must reference actual transcript positions.
- Quotable lines must be EXACT quotes, not paraphrased.
- If a "Docket topics" list is provided, for each clip set "docket_topic_id" to the UUID of the matching topic when the clip's content clearly maps to that topic. Match on substance (the clip is about that topic), not just keyword overlap. If unsure, leave "docket_topic_id" as null.
- If a "Runsheet segment structure" is provided, use those exact segment names (e.g. "The Signal", "God Mode Takes") in the "topic" field of topic_segments when a segment aligns.
- Produce "coverage_note" as a single sentence summarizing docket coverage: mention topics that were skipped or covered in <30 seconds. If no docket was provided, set "coverage_note" to "".`;
```

- [ ] **Step 4: Type-check again**

Run:

```bash
cd apps/worker && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/skills/repurpose-analyze.ts
git commit -m "feat(repurpose-analyze): instruct LLM to link clips to docket topics and emit coverage_note"
```

---

## Task 3: End-to-end verify the skill against EP 09

**Files:** none modified — this is a verification step.

- [ ] **Step 1: Rebuild the worker and run it locally**

From the repo root:

```bash
cd apps/worker
pnpm build
pnpm dev
```

Keep that shell open — logs should show `worker ready`. If the deploy.sh Docker flow is what you use, `pnpm dev` still works locally for verification.

- [ ] **Step 2: Ensure EP 09 has confirmed docket topics with `original_url`**

Open the web app in your browser (separate terminal: `cd apps/web && pnpm dev`, visit `http://localhost:3000/docket`). Confirm EP 09 is selected and has ≥3 docket topics with status `in`, each with a non-empty `original_url`. If not, add them (paste a tweet/article URL; wait for enrichment).

- [ ] **Step 3: Trigger re-analyze on EP 09**

Navigate to `/repurpose` for EP 09. Ensure the transcript exists (if not, upload it via the Upload zone). Click `Analyze` (the button that triggers `action: "analyze"`). Watch the worker logs — you should see the skill run with the new prompt size larger than before.

- [ ] **Step 4: Inspect the saved output**

After the run completes (polling marks `analyzing` false), query Supabase (via Supabase dashboard SQL editor OR via `supabase` MCP tools):

```sql
select content->'clip_candidates'->0 as sample_clip,
       content->>'coverage_note' as coverage_note
  from repurpose_outputs
 where episode_id = '<EP 09 uuid>'
   and output_type = 'master'
 order by generated_at desc
 limit 1;
```

Expected:
- `sample_clip.docket_topic_id` is either a UUID from the docket or `null` (not missing).
- `coverage_note` is a non-empty string (one sentence).
- At least one clip has a non-null `docket_topic_id`.

If `docket_topic_id` is NEVER set across all clips, inspect the user prompt (add a temporary `console.log(userPrompt.slice(0, 2000))` in the skill) and verify the docket block was actually included. If the LLM ignores the instruction, tighten the prompt language (e.g. "You MUST attempt to match every clip to a docket_topic_id if applicable").

- [ ] **Step 5: Commit any prompt tweaks**

If you tweaked the prompt:

```bash
git add apps/worker/src/skills/repurpose-analyze.ts
git commit -m "chore(repurpose-analyze): tighten docket-match prompt based on EP 09 run"
```

If no changes needed, move on.

---

## Task 4: Fetch docket topics on `/repurpose` page and keep as lookup

**Files:**
- Modify: `apps/web/src/app/(dashboard)/repurpose/page.tsx`

- [ ] **Step 1: Add `DocketTopic` type and state**

Open `apps/web/src/app/(dashboard)/repurpose/page.tsx`. Near the other type declarations at the top of the file (after `interface HostInfo`), add:

```ts
interface DocketTopic {
  id: string;
  title: string;
  original_url: string | null;
  original_image_url: string | null;
}
```

Inside the component, below the existing `useState` calls for `hosts`, `outputs`, etc., add:

```ts
  const [docketTopicsById, setDocketTopicsById] = useState<Record<string, DocketTopic>>({});
```

- [ ] **Step 2: Add a fetch for docket topics, keyed by id**

Near `fetchHosts` (around line 131), add a sibling `fetchDocketTopics`:

```ts
  const fetchDocketTopics = useCallback(async () => {
    if (!currentEpisode) return;
    const res = await fetch(`/api/docket/topics?episode_id=${currentEpisode.id}&status=in`);
    const json = await res.json();
    const topics = (json.topics || []) as Array<{
      id: string;
      title: string;
      original_url: string | null;
      original_image_url: string | null;
    }>;
    const byId: Record<string, DocketTopic> = {};
    for (const t of topics) {
      byId[t.id] = {
        id: t.id,
        title: t.title,
        original_url: t.original_url || null,
        original_image_url: t.original_image_url || null,
      };
    }
    setDocketTopicsById(byId);
  }, [currentEpisode]);
```

- [ ] **Step 3: Wire it into the combined load effect**

Find the `useEffect` at line ~138:

```ts
  useEffect(() => {
    fetchTranscript();
    fetchRepurposeData();
    fetchHosts();
  }, [fetchTranscript, fetchRepurposeData, fetchHosts]);
```

Change to:

```ts
  useEffect(() => {
    fetchTranscript();
    fetchRepurposeData();
    fetchHosts();
    fetchDocketTopics();
  }, [fetchTranscript, fetchRepurposeData, fetchHosts, fetchDocketTopics]);
```

- [ ] **Step 4: Add a handler that persists layout_choice on a clip**

Still in `page.tsx`, near `handleSaveEdit` (around line 257), add:

```ts
  async function handleUpdateClipLayout(
    outputId: string,
    clipIndex: number,
    layoutChoice: "clip_only" | "broll" | "split_screen" | null
  ) {
    // Find the output (it's the master analysis output for this episode)
    const target = masterAnalysis?.id === outputId ? masterAnalysis : null;
    if (!target) return;

    // Deep clone the content, mutate the one clip's layout_choice, write back.
    const nextContent = JSON.parse(JSON.stringify(target.content)) as Record<string, unknown>;
    const clips = (nextContent.clip_candidates || []) as Array<Record<string, unknown>>;
    if (!clips[clipIndex]) return;
    clips[clipIndex].layout_choice = layoutChoice;
    nextContent.clip_candidates = clips;

    // Optimistic update
    setMasterAnalysis({ ...target, content: nextContent });

    const res = await fetch(`/api/repurpose/${outputId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: nextContent }),
    });
    if (!res.ok) {
      // Revert
      setMasterAnalysis(target);
    }
  }
```

Note: this assumes the page has `masterAnalysis` state holding the master output (check the existing state declarations — if it's named differently, substitute the actual name). Grep for `masterAnalysis` in this file to confirm.

- [ ] **Step 5: Type-check**

Run:

```bash
cd apps/web && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/repurpose/page.tsx
git commit -m "feat(repurpose): fetch docket topics and add layout-choice update handler"
```

---

## Task 5: Build the `ClipSourceStrip` component

**Files:**
- Create: `apps/web/src/app/(dashboard)/repurpose/components/clip-source-strip.tsx`

- [ ] **Step 1: Create the component file**

Write this exact file at `apps/web/src/app/(dashboard)/repurpose/components/clip-source-strip.tsx`:

```tsx
"use client";

import { ExternalLink } from "lucide-react";

export type LayoutChoice = "clip_only" | "broll" | "split_screen" | null;

export interface ClipSourceStripProps {
  sourceUrl: string | null;
  sourceImageUrl: string | null;
  sourceTitle: string | null;
  layoutChoice: LayoutChoice;
  onLayoutChange: (next: LayoutChoice) => void;
}

function getHostname(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const PILL_BASE =
  "px-2 py-0.5 rounded text-[10px] font-medium border transition-colors";
const PILL_ACTIVE = "bg-accent/15 text-accent border-accent/40";
const PILL_IDLE = "bg-bg-elevated text-text-muted border-border hover:text-text-secondary";
const PILL_DISABLED = "bg-bg-elevated text-text-muted/40 border-border cursor-not-allowed";

export function ClipSourceStrip({
  sourceUrl,
  sourceImageUrl,
  sourceTitle,
  layoutChoice,
  onLayoutChange,
}: ClipSourceStripProps) {
  const hasSource = Boolean(sourceUrl);
  const effectiveChoice: LayoutChoice = layoutChoice ?? "clip_only";
  const domain = getHostname(sourceUrl);

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-2">
      {hasSource && sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:bg-bg-elevated rounded px-1 py-1 transition-colors"
        >
          {sourceImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sourceImageUrl}
              alt=""
              className="w-10 h-10 rounded object-cover shrink-0 bg-bg-elevated"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-bg-elevated shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-text-muted truncate">{domain}</div>
            {sourceTitle ? (
              <div className="text-[11px] text-text-secondary truncate">
                {sourceTitle}
              </div>
            ) : null}
          </div>
          <ExternalLink size={12} className="text-text-muted shrink-0" />
        </a>
      ) : null}

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-text-muted uppercase tracking-wider mr-1">
          Layout
        </span>
        <button
          type="button"
          onClick={() => onLayoutChange("clip_only")}
          className={`${PILL_BASE} ${
            effectiveChoice === "clip_only" ? PILL_ACTIVE : PILL_IDLE
          }`}
        >
          Clip only
        </button>
        <button
          type="button"
          disabled={!hasSource}
          title={hasSource ? "" : "No source asset for this clip"}
          onClick={() => hasSource && onLayoutChange("broll")}
          className={`${PILL_BASE} ${
            !hasSource
              ? PILL_DISABLED
              : effectiveChoice === "broll"
              ? PILL_ACTIVE
              : PILL_IDLE
          }`}
        >
          + B-roll
        </button>
        <button
          type="button"
          disabled={!hasSource}
          title={hasSource ? "" : "No source asset for this clip"}
          onClick={() => hasSource && onLayoutChange("split_screen")}
          className={`${PILL_BASE} ${
            !hasSource
              ? PILL_DISABLED
              : effectiveChoice === "split_screen"
              ? PILL_ACTIVE
              : PILL_IDLE
          }`}
        >
          Split-screen
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/repurpose/components/clip-source-strip.tsx
git commit -m "feat(repurpose): add ClipSourceStrip with source link and layout pill group"
```

---

## Task 6: Wire `ClipSourceStrip` and coverage banner into `tab-overview.tsx`

**Files:**
- Modify: `apps/web/src/app/(dashboard)/repurpose/components/tab-overview.tsx`

- [ ] **Step 1: Extend `TabOverviewProps`**

At the top of `tab-overview.tsx`, replace the `TabOverviewProps` interface (around line 19):

```ts
interface TabOverviewProps {
  analysis: Record<string, unknown>;
  hostNames: string[];
}
```

with:

```ts
import { ClipSourceStrip, type LayoutChoice } from "./clip-source-strip";

interface DocketTopicLite {
  id: string;
  title: string;
  original_url: string | null;
  original_image_url: string | null;
}

interface TabOverviewProps {
  analysis: Record<string, unknown>;
  hostNames: string[];
  outputId: string;
  docketTopicsById: Record<string, DocketTopicLite>;
  onUpdateClipLayout: (
    outputId: string,
    clipIndex: number,
    layoutChoice: LayoutChoice
  ) => void;
}
```

(Merge the `import` line with the existing imports at the top — `ClipSourceStrip` import goes with the other local imports alongside `CopyButton`.)

- [ ] **Step 2: Destructure new props**

Change:

```ts
export function TabOverview({ analysis, hostNames }: TabOverviewProps) {
```

to:

```ts
export function TabOverview({
  analysis,
  hostNames,
  outputId,
  docketTopicsById,
  onUpdateClipLayout,
}: TabOverviewProps) {
```

- [ ] **Step 3: Render `coverage_note` banner at top of the overview content**

Inside the main `<div className="p-6 space-y-6">` (around line 54), as the FIRST child (before the existing `Episode Summary` block), insert:

```tsx
        {typeof analysis.coverage_note === "string" && analysis.coverage_note.length > 0 && (
          <div className="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text-secondary">
            <span className="text-text-muted mr-1">Docket coverage:</span>
            {analysis.coverage_note as string}
          </div>
        )}
```

- [ ] **Step 4: Render the source strip + layout toggle inside each clip candidate card**

Find the `Clip Candidates` block (around lines 142–175). Inside the `{clips.map((clip, i) => { ... })}` render, just BEFORE the closing `</div>` of the card (i.e., after the `flex-wrap gap-1` platforms block), insert:

```tsx
                    <ClipSourceStrip
                      sourceUrl={
                        typeof clip.docket_topic_id === "string"
                          ? docketTopicsById[clip.docket_topic_id]?.original_url || null
                          : null
                      }
                      sourceImageUrl={
                        typeof clip.docket_topic_id === "string"
                          ? docketTopicsById[clip.docket_topic_id]?.original_image_url || null
                          : null
                      }
                      sourceTitle={
                        typeof clip.docket_topic_id === "string"
                          ? docketTopicsById[clip.docket_topic_id]?.title || null
                          : null
                      }
                      layoutChoice={(clip.layout_choice as LayoutChoice) ?? null}
                      onLayoutChange={(next) => onUpdateClipLayout(outputId, i, next)}
                    />
```

- [ ] **Step 5: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/repurpose/components/tab-overview.tsx
git commit -m "feat(repurpose): render coverage banner and clip source strip in overview"
```

---

## Task 7: Pass new props from `page.tsx` → `<TabOverview/>`

**Files:**
- Modify: `apps/web/src/app/(dashboard)/repurpose/page.tsx`

- [ ] **Step 1: Find the `<TabOverview .../>` render**

Grep for `<TabOverview` in `apps/web/src/app/(dashboard)/repurpose/page.tsx` to find where it's rendered. It currently passes `analysis` and `hostNames` only.

- [ ] **Step 2: Add the three new props**

Change the render to include `outputId`, `docketTopicsById`, and `onUpdateClipLayout`:

```tsx
<TabOverview
  analysis={masterAnalysis.content}
  hostNames={hosts.map((h) => h.name)}
  outputId={masterAnalysis.id}
  docketTopicsById={docketTopicsById}
  onUpdateClipLayout={handleUpdateClipLayout}
/>
```

(If the actual variable is named something other than `masterAnalysis`, substitute the real name — Task 4 Step 4 already notes this.)

- [ ] **Step 3: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/repurpose/page.tsx
git commit -m "feat(repurpose): wire docket lookup and layout handler into TabOverview"
```

---

## Task 8: Manual QA on EP 09

**Files:** none modified.

- [ ] **Step 1: Ensure dev servers are running**

Two shells:

```bash
# shell 1
cd apps/worker && pnpm dev
# shell 2
cd apps/web && pnpm dev
```

- [ ] **Step 2: Visit `/repurpose` for EP 09**

Open `http://localhost:3000/repurpose` in the browser. Ensure EP 09 is the current episode.

- [ ] **Step 3: Trigger analyze (if not already done in Task 3)**

If EP 09 already has a fresh master analysis from Task 3, you should see clip candidate cards immediately on the Overview tab. Otherwise click `Analyze` and wait for it to finish.

- [ ] **Step 4: Verify coverage banner**

At the top of the Overview tab, a single-line `Docket coverage: ...` banner should be visible. If missing, confirm `coverage_note` is non-empty in the raw JSON (Task 3 Step 4).

- [ ] **Step 5: Verify source strip on at least one clip**

Scroll to the `Clip Candidates` grid. At least one clip card should show a source strip at the bottom with a thumbnail + domain. Click it — it should open the original tweet/article URL in a new tab.

- [ ] **Step 6: Verify layout pills persist**

On a clip card that has a source strip:
1. Click `+ B-roll`. It should highlight.
2. Reload the page (`⌘R`).
3. The same pill should still be highlighted.

On a clip card WITHOUT a source strip (no `docket_topic_id` or unresolved):
- `+ B-roll` and `Split-screen` should be visibly disabled (greyed out).
- Hovering them shows the "No source asset for this clip" tooltip.
- `Clip only` should still be clickable.

- [ ] **Step 7: Visual screenshot for the PR**

Take a screenshot of one clip card showing the new strip + pill group for the PR description.

- [ ] **Step 8: No commit needed**

Manual QA only. Any code tweaks go in separate commits.

---

## Task 9: Open PR

**Files:** none.

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin HEAD
gh pr create --title "feat: docket-aware repurpose (source links + layout choice on clips)"   --body "$(cat <<'EOF'
## Summary
- `repurpose-analyze` now pulls in docket topics (with `original_url` / `original_image_url`) and the latest runsheet; LLM links each clip to a `docket_topic_id` when applicable and emits a `coverage_note` on the analysis root.
- `/repurpose` Overview tab shows a one-line docket-coverage banner and, on each clip candidate card, a tappable source strip + a 3-way layout pill group (Clip only / + B-roll / Split-screen).
- Layout choices persist via the existing `PATCH /api/repurpose/[id]` endpoint; no new tables, no migrations.

## Test plan
- [x] Re-run analyze on EP 09; at least one clip has non-null `docket_topic_id`, `coverage_note` is non-empty.
- [x] Source strip renders on mapped clips, hidden on unmapped clips.
- [x] Layout pill selection persists across reload.
- [x] `+ B-roll` / `Split-screen` disabled when no source asset; tooltip visible.
- [x] Coverage banner renders at top of Overview tab.

## Non-goals (documented in spec)
- No ffmpeg rendering, no new `clips` table rows, no Buffer export changes.
- Re-running analyze DOES reset layout choices (acceptable for v1).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Return PR URL to user**

---

## Self-review notes

- **Spec coverage** — all 7 design sections mapped: Section 1 (skill changes) → Tasks 1–2; Section 2 (data shape) → Tasks 1–2 emit the fields; Section 3 (API) → reuses existing `PATCH /api/repurpose/[id]`, documented inline; Section 4 (UI) → Tasks 4–7; Section 5 (graceful degradation) → ClipSourceStrip handles missing source + disabled pills; Section 6 (build order) → task ordering matches; Section 7 (non-goals) → explicitly preserved (no migrations, no new tables, no render).
- **Placeholder scan** — every step has concrete code or concrete commands. No "similar to", no "add validation", no "TBD".
- **Type consistency** — `LayoutChoice` defined in `ClipSourceStrip` (Task 5), imported in `tab-overview.tsx` (Task 6), used in `page.tsx` handler (Task 4). `DocketTopic` in page.tsx vs `DocketTopicLite` in tab-overview: same shape, intentionally separate to keep component self-contained; `docketTopicsById` prop typing is `Record<string, DocketTopicLite>` which structurally matches page.tsx's `Record<string, DocketTopic>` so the pass-through compiles.
- **Deviation note** — the spec said `tab-shorts.tsx`; that was wrong. The plan uses `tab-overview.tsx` where `clip_candidates` actually renders. Called out at the top of the plan.
