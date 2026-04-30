# Architecture

System-level diagrams and write-ups for how the GodModePod stack fits together. Each doc covers one slice of the system end-to-end.

| Doc | Covers |
|---|---|
| [`docket-flow.md`](./docket-flow.md) | How topics get **into** the docket (Telegram bot) and how hosts **read** the docket (MCP server in Claude Desktop). |

When adding a new doc here:

- One concern per file.
- Lead with an ASCII flow diagram or table — words second.
- Link to source files (`apps/web/src/...`) so the doc points at the implementation, not duplicates it.
- Implementation **plans** and **specs** belong in `docs/superpowers/{plans,specs}/` — this folder is for the steady-state picture.
