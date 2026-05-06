# Docket Flow — Collection & Read Access

The docket is the per-episode list of candidate topics. It has two interfaces outside the web app:

- **Inbound (write):** a Telegram bot that lets any allow-listed chat add topics with `/docket <url> [note]`.
- **Outbound (read):** an MCP server that lets co-hosts query the docket from Claude Desktop using natural language. Read-only.

```
┌──────────────────────┐    /docket <url> [note]     ┌─────────────────────────────────────┐
│ Telegram chat (bot)  │ ───────────────────────────▶│ POST /api/telegram/webhook           │
└──────────────────────┘                              │  • verify x-telegram-bot-api-secret │
        ▲                                             │  • check chat allow-list             │
        │  /list reply                                │  • ensureLatestEpisode()             │
        │                                             │  • insert into docket_topics         │
        │                                             │    (status = under_review or in)    │
        │                                             └─────────────────────────────────────┘
        │                                                              │
        │                                                              ▼
        │                                                    ┌─────────────────┐
        │                                                    │  Supabase       │
        │                                                    │  • episodes     │
        │                                                    │  • docket_topics│
        │                                                    │  • docket_votes │
        │                                                    │  • docket_comments
        │                                                    │  • research_briefs
        │                                                    │  • show_context │
        │                                                    └─────────────────┘
        │                                                              ▲
        │                                                              │  read-only
        │                                                              │
        │                                              ┌──────────────────────────────┐
        │                                              │ /api/mcp/[transport]         │
        │                                              │  (Streamable HTTP via        │
        │                                              │   mcp-handler)               │
        │                                              │  • bearer-token auth          │
        │                                              │  • 6 read-only tools          │
        │                                              └──────────────────────────────┘
        │                                                              ▲
        │                                                              │ stdio bridge
        │                                                              │ (mcp-remote)
        │                                                              │
        │                                              ┌──────────────────────────────┐
        │                                              │ Claude Desktop on each host  │
        │                                              │ (Rik / Ben / Luca)           │
        │                                              └──────────────────────────────┘
```

---

## Inbound — Telegram bot collection

**Source:** [`apps/web/src/app/api/telegram/webhook/route.ts`](../../apps/web/src/app/api/telegram/webhook/route.ts)

**Setup (one time, outside the codebase):**

```
POST https://api.telegram.org/bot<TOKEN>/setWebhook
  url=https://prod.godmodepod.com/api/telegram/webhook
  secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

**Auth model:**

- Telegram → Vercel: shared secret in the `x-telegram-bot-api-secret-token` request header (set when registering the webhook).
- Chat → bot: chat IDs must appear in the `TELEGRAM_ALLOWED_CHATS` env var (comma-separated). Unknown chats get a silent 200 — no leakage.

**Supported commands:**

| Command | Behavior |
|---|---|
| `/docket <url> [note]` | Resolves the latest episode via `ensureLatestEpisode()`, inserts a row into `docket_topics`. Status is `in` if the docket is locked, otherwise `under_review`. Replies to the user with confirmation. |
| `/list` | Returns up to the last 10 topics on the latest episode with their status. |

**Where it lands:**

A `docket_topics` row with `original_url`, `submitted_by` (`First Name @username`), and a `sort_order` appended to the end of the episode's docket. From there it surfaces in the `/docket` web UI for review/voting/editing.

**Env vars:**

- `TELEGRAM_BOT_TOKEN` — for outbound replies.
- `TELEGRAM_WEBHOOK_SECRET` — verifies inbound requests are from Telegram.
- `TELEGRAM_ALLOWED_CHATS` — comma-separated chat IDs allowed to add topics.

---

## Outbound — MCP server for hosts

**Source:** [`apps/web/src/app/api/mcp/[transport]/route.ts`](../../apps/web/src/app/api/mcp/[transport]/route.ts)
**Helpers:** [`apps/web/src/lib/mcp/auth.ts`](../../apps/web/src/lib/mcp/auth.ts), [`apps/web/src/lib/mcp/episode.ts`](../../apps/web/src/lib/mcp/episode.ts)
**Host setup doc:** [`docs/mcp-setup.md`](../mcp-setup.md)
**Implementation plan:** [`docs/superpowers/plans/2026-04-30-docket-mcp-server.md`](../superpowers/plans/2026-04-30-docket-mcp-server.md)

**Endpoint:** `https://prod.godmodepod.com/api/mcp/mcp` (Streamable HTTP). Built on Vercel's `mcp-handler` adapter.

**Auth model:**

- Per-host bearer tokens stored as `MCP_TOKEN_RIK` / `MCP_TOKEN_BEN` / `MCP_TOKEN_LUCA` env vars on Vercel.
- `withMcpAuth({ required: true })` rejects any request without a matching bearer.
- No OAuth — for 3 hosts it's overkill. **Consequence:** Claude Desktop's "Add custom connector" UI **does not work** (it expects OAuth 2.1 endpoints). Hosts connect via the `mcp-remote` stdio bridge instead.

**Tools (all read-only):**

| Tool | Purpose |
|---|---|
| `list_episodes` | Recent episodes with id, number, title, status. |
| `get_episode` | Metadata for a specific or current episode. |
| `list_docket_topics` | Topics on the docket; filter by `in` / `under_review` / `out`. |
| `get_topic` | Full topic detail incl. all comments and votes. |
| `get_research_brief` | Latest synthesized research brief for the episode. |
| `get_show_context` | Show-level voice / brand / workflow guardrails. |

**Episode resolution** (centralized in `lib/mcp/episode.ts`):

- `episode` arg omitted → latest episode whose `status` is not `delivered`/`posted` (the one being prepped).
- `episode: 9` → that exact `episode_number`.
- `episode: "latest"` → highest `episode_number` regardless of status.
- Every response embeds the resolved episode metadata so the host can confirm.

**Show is fixed** via the `MCP_SHOW_ID` env var — single-show assumption matches the rest of the system.

**Host wiring** (Claude Desktop config):

```json
{
  "mcpServers": {
    "godmodepod-docket": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "https://prod.godmodepod.com/api/mcp/mcp",
        "--header",
        "Authorization: Bearer <PER_HOST_TOKEN>",
        "--transport",
        "http-only"
      ]
    }
  }
}
```

`mcp-remote` runs locally on each host's machine, terminates auth (adds the bearer header), and exposes a stdio MCP server to Claude Desktop. Claude Desktop is reliable with stdio servers — that's the whole reason for this bridge.

---

## What's *not* exposed via MCP (deliberate)

- **No write tools.** No add/edit/delete/vote/comment from Claude. Topic curation stays in the web UI and Telegram bot. If a host wants to add a topic, they `/docket` it from Telegram.
- **No multi-show support.** Single show, fixed via env var.
- **No streaming or resources.** Plain JSON tool responses only.
- **No rate limiting.** Vercel platform limits + private bearer tokens are sufficient for 3 hosts.

---

## Recap — who can do what

| Actor | Channel | Capability |
|---|---|---|
| Anyone in allow-listed Telegram chats | `/docket <url> [note]` | Add a topic to the latest episode |
| Anyone in allow-listed Telegram chats | `/list` | Read last 10 topics on latest episode |
| Rik / Ben / Luca | Claude Desktop + MCP | Read everything: episodes, topics, comments, votes, research brief, show context, **guest wishlist** |
| Rik / Ben / Luca | `/docket` web UI | Full read/write — vote, comment, reorder, lock, edit angles, etc. |

---

## Guest wishlist (parallel flow)

The guest wishlist reuses the docket pattern — Telegram in, MCP out — but is **show-level** instead of episode-level (a long-lived pool, not per-episode candidates).

**Inbound (Telegram):**

| Command | Behavior |
|---|---|
| `/guest <name \| @handle \| url> [-- note]` | Insert a row into `guests` (status `wishlist`). If a Twitter handle or URL is present, the worker will scrape the profile via FxTwitter; otherwise it works from the name + any URL. Parses the note after `--`. |
| `/guests` | Reply with the last 10 guests in the wishlist with their status. |

The handler enqueues a `guest-enrich` job (queue `ai-jobs`) — the worker calls Grok‑4‑Fast (same routing as `docket-add`) and updates the guest row with `bio`, `background`, and `original_image_url`. Telegram acks immediately; enrichment is async.

**Outbound (MCP):**

| Tool | Purpose |
|---|---|
| `list_guests` | Wishlist entries (latest first). Filter by `status` (`wishlist` / `contacted` / `confirmed` / `recorded` / `declined`). |
| `get_guest` | Full detail for one guest, including `background` and raw `enrichment_data`. |

Same per-host bearer-token auth as the docket tools — no extra wiring on the host side.
