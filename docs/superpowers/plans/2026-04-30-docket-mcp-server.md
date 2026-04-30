# Docket MCP Server Implementation Plan

**Goal:** Let co-hosts (Ben, Luca) connect Claude Desktop to the docket via MCP and ask questions about a chosen episode — read-only, hosted alongside the Next.js web app on Vercel.

**Architecture:** Single Next.js App Router catch-all route at `/api/mcp/[transport]` using Vercel's `mcp-handler` adapter (Streamable HTTP transport). Reuses existing Supabase server client. Bearer-token auth via env vars. No new tables, no migrations, no writes.

**Tech Stack:** TypeScript, Next.js 16 App Router, `@modelcontextprotocol/sdk`, `mcp-handler`, Supabase (existing tables).

**Testing approach:** Manual. Hit the route with `curl` for the unauthenticated 401, then connect via Claude Desktop's remote MCP config to verify each tool. Codebase has no automated test infrastructure.

---

## Episode selection model

Default-to-latest is risky (e.g., docket for EP 09 closes, EP 10 opens, but EP 09 hasn't recorded yet). Solution:

- **`episode` arg is optional** on every docket/research tool. Accepts:
  - omitted → "current working episode" = latest episode whose `status != 'published'` (the one being prepped). Falls back to highest `episode_number` if all are published.
  - integer → that `episode_number` for the show
  - `"latest"` → highest `episode_number` regardless of status
- All tools resolve through one helper, `resolveEpisode(supabase, showId, arg)`, that returns `{ id, episode_number, title, status }`. Every tool response includes the resolved episode metadata so the host can confirm they got the right one.
- Show is fixed via `MCP_SHOW_ID` env var (single show: GodModePod). No multi-show selection.

---

## File Structure

**Modify:**

- `apps/web/package.json` — add `@modelcontextprotocol/sdk`, `mcp-handler`, `zod` deps.

**Create:**

- `apps/web/src/app/api/mcp/[transport]/route.ts` — the MCP handler with all 5 tools.
- `apps/web/src/lib/mcp/auth.ts` — bearer-token check against `MCP_TOKEN_BEN` / `MCP_TOKEN_LUCA` / `MCP_TOKEN_RIK`.
- `apps/web/src/lib/mcp/episode.ts` — `resolveEpisode()` helper.
- `docs/mcp-setup.md` — copy-pasteable Claude Desktop config for hosts.

**No new tables. No migrations. No write tools.**

---

## Task 1: Install dependencies

**Files:** `apps/web/package.json`

- [ ] Run from repo root:
  ```bash
  pnpm --filter web add @modelcontextprotocol/sdk mcp-handler zod
  ```
- [ ] Verify versions land in `apps/web/package.json` `dependencies`. `mcp-handler` should be `>=1.0`, sdk should be `>=1.0`.

---

## Task 2: Bearer-token auth helper

**Files:** Create `apps/web/src/lib/mcp/auth.ts`

```ts
const TOKEN_ENV_VARS = ["MCP_TOKEN_RIK", "MCP_TOKEN_BEN", "MCP_TOKEN_LUCA"] as const;

export type McpUser = { name: string };

export function authenticateMcpRequest(req: Request): McpUser | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  for (const envVar of TOKEN_ENV_VARS) {
    const expected = process.env[envVar];
    if (expected && expected === token) {
      return { name: envVar.replace("MCP_TOKEN_", "").toLowerCase() };
    }
  }
  return null;
}
```

- [ ] Use constant-time-ish equality is overkill for 3 tokens; plain `===` is fine here.
- [ ] No token set in env → no auth match → 401. Never accept missing tokens.

---

## Task 3: `resolveEpisode` helper

**Files:** Create `apps/web/src/lib/mcp/episode.ts`

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedEpisode = {
  id: string;
  episode_number: number;
  title: string;
  subtitle: string | null;
  status: string;
  recording_date: string | null;
};

export async function resolveEpisode(
  supabase: SupabaseClient,
  showId: string,
  arg: number | "latest" | undefined
): Promise<ResolvedEpisode> {
  if (typeof arg === "number") {
    const { data, error } = await supabase
      .from("episodes")
      .select("id, episode_number, title, subtitle, status, recording_date")
      .eq("show_id", showId)
      .eq("episode_number", arg)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Episode ${arg} not found`);
    return data as ResolvedEpisode;
  }

  if (arg === "latest") {
    const { data, error } = await supabase
      .from("episodes")
      .select("id, episode_number, title, subtitle, status, recording_date")
      .eq("show_id", showId)
      .order("episode_number", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("No episodes for show");
    return data[0] as ResolvedEpisode;
  }

  // default: current working episode = latest non-published
  const { data: working } = await supabase
    .from("episodes")
    .select("id, episode_number, title, subtitle, status, recording_date")
    .eq("show_id", showId)
    .neq("status", "published")
    .order("episode_number", { ascending: false })
    .limit(1);
  if (working?.length) return working[0] as ResolvedEpisode;

  // fallback: latest by episode_number regardless of status
  const { data: latest, error } = await supabase
    .from("episodes")
    .select("id, episode_number, title, subtitle, status, recording_date")
    .eq("show_id", showId)
    .order("episode_number", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  if (!latest?.length) throw new Error("No episodes for show");
  return latest[0] as ResolvedEpisode;
}
```

- [ ] Episode statuses we expect: `created`, `prepping`, `recorded`, `published` (verify against `episode_status` enum in `00001_initial_schema.sql` — adjust the `.neq` filter if naming differs).

---

## Task 4: MCP route with 5 read-only tools

**Files:** Create `apps/web/src/app/api/mcp/[transport]/route.ts`

```ts
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { resolveEpisode } from "@/lib/mcp/episode";

const SHOW_ID = process.env.MCP_SHOW_ID!;

const episodeArg = z
  .union([z.number().int().positive(), z.literal("latest")])
  .optional()
  .describe(
    "Episode selector: omit for the current working (non-published) episode, pass an integer for that episode_number, or 'latest' for the highest episode_number regardless of status."
  );

const handler = createMcpHandler((server) => {
  server.tool(
    "list_episodes",
    "List recent episodes (id, number, title, status). Use this first to figure out which episode_number to pass into other tools.",
    { limit: z.number().int().positive().max(50).default(10) },
    async ({ limit }) => {
      const supabase = getSupabaseServer();
      const { data, error } = await supabase
        .from("episodes")
        .select("id, episode_number, title, subtitle, status, recording_date")
        .eq("show_id", SHOW_ID)
        .order("episode_number", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_episode",
    "Get metadata for a single episode. Defaults to the current working (non-published) episode when no arg is given.",
    { episode: episodeArg },
    async ({ episode }) => {
      const supabase = getSupabaseServer();
      const ep = await resolveEpisode(supabase, SHOW_ID, episode);
      return { content: [{ type: "text", text: JSON.stringify(ep, null, 2) }] };
    }
  );

  server.tool(
    "list_docket_topics",
    "List docket topics for an episode. Defaults to current working episode. Filter by status if needed.",
    {
      episode: episodeArg,
      status: z.enum(["in", "under_review", "out"]).optional(),
    },
    async ({ episode, status }) => {
      const supabase = getSupabaseServer();
      const ep = await resolveEpisode(supabase, SHOW_ID, episode);
      let q = supabase
        .from("docket_topics")
        .select("id, title, context, angle, status, sort_order, original_url, submitted_by, sources, docket_votes(*), docket_comments(count)")
        .eq("episode_id", ep.id)
        .order("sort_order", { ascending: true });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ episode: ep, topics: data }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_topic",
    "Full detail for a single docket topic, including all comments.",
    { id: z.string().uuid() },
    async ({ id }) => {
      const supabase = getSupabaseServer();
      const [topic, comments] = await Promise.all([
        supabase.from("docket_topics").select("*, docket_votes(*)").eq("id", id).maybeSingle(),
        supabase.from("docket_comments").select("*").eq("topic_id", id).order("created_at", { ascending: true }),
      ]);
      if (topic.error) throw new Error(topic.error.message);
      if (!topic.data) throw new Error(`Topic ${id} not found`);
      if (comments.error) throw new Error(comments.error.message);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ topic: topic.data, comments: comments.data }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_research_brief",
    "Latest research brief for an episode (synthesized topic research).",
    { episode: episodeArg },
    async ({ episode }) => {
      const supabase = getSupabaseServer();
      const ep = await resolveEpisode(supabase, SHOW_ID, episode);
      const { data, error } = await supabase
        .from("research_briefs")
        .select("*")
        .eq("episode_id", ep.id)
        .order("generated_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ episode: ep, brief: data?.[0] || null }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_show_context",
    "Get show-level context (soul/hosts/brand/workflow). No episode arg.",
    {},
    async () => {
      const supabase = getSupabaseServer();
      const { data, error } = await supabase
        .from("show_context")
        .select("*")
        .eq("show_id", SHOW_ID);
      if (error) throw new Error(error.message);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
});

async function authedHandler(req: Request) {
  const user = authenticateMcpRequest(req);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  return handler(req);
}

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };
```

- [ ] That's six tools — `list_episodes` is the discovery helper for hosts, the other five are the read surface.
- [ ] If `mcp-handler`'s API surface differs from the snippet above (e.g., `createMcpHandler` returns `{ GET, POST, DELETE }` or wants tools registered on a different object), adapt to match the version installed in Task 1. Check `node_modules/mcp-handler/README.md` after install.

---

## Task 5: Env vars

- [ ] Add to `.env.local` (and Vercel project env, all environments):
  - `MCP_SHOW_ID=<godmodepod show uuid>`
  - `MCP_TOKEN_RIK=<random 32+ char token>`
  - `MCP_TOKEN_BEN=<random 32+ char token>`
  - `MCP_TOKEN_LUCA=<random 32+ char token>`
- [ ] Generate tokens with `openssl rand -hex 32`.
- [ ] Confirm `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already set on Vercel (they are, the rest of the app uses them).

---

## Task 6: Host setup doc

**Files:** Create `docs/mcp-setup.md`

Contents (copy-paste-able):

````markdown
# Connecting Claude Desktop to the GodModePod Docket

1. Open Claude Desktop → Settings → Developer → Edit Config.
2. Add this entry under `mcpServers` (replace `YOUR_TOKEN`):

```json
{
  "mcpServers": {
    "godmodepod-docket": {
      "url": "https://godmodepod.com/api/mcp/sse",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

3. Restart Claude Desktop.
4. Try: *"List the docket topics for episode 9"* or *"What's on the current docket?"*

## Available tools (read-only)

- `list_episodes` — see recent episode numbers
- `get_episode` — current/specific episode metadata
- `list_docket_topics` — topics on the docket (filter by status)
- `get_topic` — full topic detail with comments
- `get_research_brief` — synthesized research brief for the episode
- `get_show_context` — voice / brand / format guardrails
````

- [ ] Send Ben & Luca their personal tokens via 1Password / signal — never paste into shared chat.

---

## Task 7: Verify end-to-end

- [ ] `pnpm --filter web dev` and curl unauth: `curl -i http://localhost:3000/api/mcp/sse` → expect 401.
- [ ] curl with bearer: `curl -i -H "Authorization: Bearer $MCP_TOKEN_RIK" http://localhost:3000/api/mcp/sse` → expect 200 + SSE headers.
- [ ] Connect Claude Desktop locally (point URL at a tunnel like `vercel dev` deployment URL or a preview deployment).
- [ ] Ask Claude: "use list_episodes" → verify response.
- [ ] Ask Claude: "list docket topics for episode 9 with status in" → verify resolved episode metadata is correct in the response.
- [ ] Ask Claude: "get the research brief" (no episode arg) → verify it picks the current working episode.

---

## Out of scope (explicitly)

- Write tools (no add-topic, vote, comment from Claude).
- Multi-show support.
- OAuth / per-user Supabase auth — bearer tokens are sufficient for 3 hosts.
- Streaming responses, resources, or prompts — tools only.
- Rate limiting — Vercel platform limits + private tokens are enough for v1.
