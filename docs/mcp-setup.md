# Connecting Claude Desktop to the GodModePod Docket

Read-only MCP server. Lets you ask Claude about the docket, topics, research brief, and show context.

## Setup (one time)

1. Open Claude Desktop → Settings → Developer → **Edit Config**.
2. Add this entry under `mcpServers` (replace `YOUR_TOKEN` with the token Rik sent you):

```json
{
  "mcpServers": {
    "godmodepod-docket": {
      "url": "https://godmodeprod-web.vercel.app/api/mcp/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

If your Claude Desktop version doesn't support remote MCP servers natively, use the stdio bridge instead:

```json
{
  "mcpServers": {
    "godmodepod-docket": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://godmodeprod-web.vercel.app/api/mcp/mcp",
        "--header",
        "Authorization: Bearer YOUR_TOKEN"
      ]
    }
  }
}
```

3. Restart Claude Desktop.

## Try it

- *"List the latest GodModePod episodes"*
- *"What's on the current docket?"*
- *"Give me the docket topics for episode 9 that are status 'in'"*
- *"Get the research brief for the current episode"*
- *"What's the show's voice / brand context?"*

## Available tools (read-only)

| Tool | Description |
|---|---|
| `list_episodes` | Recent episodes (id, number, title, status) |
| `get_episode` | Metadata for a specific or current episode |
| `list_docket_topics` | Topics on the docket — filterable by status |
| `get_topic` | Full topic detail with all comments and votes |
| `get_research_brief` | Synthesized research brief for the episode |
| `get_show_context` | Show-level voice / brand / workflow guardrails |

## Episode selection

Most tools take an optional `episode` argument:

- **omitted** → current working (non-shipped) episode
- **integer** (e.g. `9`) → that specific `episode_number`
- **`"latest"`** → highest episode number regardless of status

When unsure, run `list_episodes` first to see what's available.

## Required env vars on Vercel

- `MCP_SHOW_ID` — uuid of the GodModePod show row
- `MCP_TOKEN_RIK`, `MCP_TOKEN_BEN`, `MCP_TOKEN_LUCA` — per-host bearer tokens (`openssl rand -hex 32`)
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — already set; reused by the route
