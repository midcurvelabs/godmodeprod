# Connecting Claude Desktop to the GodModePod Docket

Read-only MCP server. Lets you ask Claude about the docket, topics, comments, research brief, and show context for any GodModePod episode.

The supported path is the **stdio bridge** via [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) — Claude Desktop's "Add custom connector" UI **does not work** with this server (it expects an OAuth flow we haven't implemented).

## Setup (~3 min)

### 1. Make sure Node is installed

```bash
node --version
```

If you see `v18` or higher, you're good. If you get "command not found":

```bash
brew install node
```

### 2. Edit the Claude Desktop config

Open Claude Desktop → **Settings** (⌘,) → **Developer** → **Edit Config**. Opens:

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Add a `godmodepod-docket` entry under `mcpServers` (replace `YOUR_TOKEN` with the personal bearer token Rik sent you):

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
        "Authorization: Bearer YOUR_TOKEN",
        "--transport",
        "http-only"
      ]
    }
  }
}
```

If you already have other MCP servers in your config, add the `"godmodepod-docket": { ... }` block as a new key inside `mcpServers` alongside them.

Save the file.

### 3. Restart Claude Desktop

**⌘Q to fully quit** — not just close the window. Then relaunch.

### 4. Verify

In a new chat, open the connectors / tools panel — `godmodepod-docket` should appear under **LOCAL DEV** with 6 tools. Test prompt:

> *"List the recent GodModePod episodes."*

You should get back JSON with the latest episodes.

## ⚠️ Don't use the "Add custom connector" UI

Claude Desktop has a "Add custom connector" button that takes a URL + Connect. **That path doesn't work for this server** — it expects OAuth 2.1 endpoints (authorize, dynamic client registration, etc.) which we haven't implemented and don't need for 3 hosts. The stdio bridge above is the only supported path.

If you previously tried it and have a "GodModePod Docket (CUSTOM)" entry stuck on "Connect", **delete it** to avoid confusion.

## Available tools (read-only)

| Tool | What it does |
|---|---|
| `list_episodes` | Recent episodes with id, number, title, status |
| `get_episode` | Metadata for a specific or current episode |
| `list_docket_topics` | Topics on the docket — filter by `in` / `under_review` / `out` |
| `get_topic` | Full topic detail incl. all comments and votes |
| `get_research_brief` | Synthesized research brief for the episode |
| `get_show_context` | Show-level voice / brand / workflow guardrails |

## Episode selection

Most tools take an optional `episode` argument. Defaults to **the current working (non-shipped) episode**. You can override:

- **omit** → current working episode
- **integer** (e.g. `9`) → that specific `episode_number`
- **`"latest"`** → highest episode number regardless of status

When unsure, run `list_episodes` first.

## How to use it — just talk to Claude

You don't call tools manually. Examples:

- *"What's on the current GodModePod docket?"*
- *"Give me the docket topics for episode 9 that are status 'in'"*
- *"Which episodes are coming up?"*
- *"Open the topic about [X] and show me the comments and votes"*
- *"Summarize the research brief for the current episode"*
- *"What's our show voice / brand guideline?"*
- *"Help me prep talking points for episode 11 based on the docket and research brief"*

## Troubleshooting

- **Tools don't appear after restart**:
  ```bash
  tail -80 ~/Library/Logs/Claude/mcp-server-godmodepod-docket.log
  ```
  Common causes: `npx` missing from PATH (install Node), token typo, or a JSON syntax error in `claude_desktop_config.json`.
- **JSON syntax check**:
  ```bash
  cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python3 -m json.tool
  ```
- **401 in logs** → token typo or missing `Bearer ` prefix.
- **"I don't have access to that tool"** → connector might be toggled off in the tools panel; enable it.

## Required env vars on Vercel (for ops reference)

Already set on Production / Preview / Development:

- `MCP_SHOW_ID` — uuid of the GodModePod show row
- `MCP_TOKEN_RIK`, `MCP_TOKEN_BEN`, `MCP_TOKEN_LUCA` — per-host bearer tokens
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — already set; reused by the route
