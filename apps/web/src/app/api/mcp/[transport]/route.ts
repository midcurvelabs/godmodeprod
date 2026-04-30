import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { verifyMcpToken } from "@/lib/mcp/auth";
import { resolveEpisode } from "@/lib/mcp/episode";

const SHOW_ID = process.env.MCP_SHOW_ID;

const episodeArg = z
  .union([z.number().int().positive(), z.literal("latest")])
  .optional()
  .describe(
    "Episode selector: omit for the current working (non-shipped) episode, pass an integer for that episode_number, or 'latest' for the highest episode_number regardless of status."
  );

function ensureShowId(): string {
  if (!SHOW_ID) {
    throw new Error("MCP_SHOW_ID env var is not set");
  }
  return SHOW_ID;
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_episodes",
      {
        title: "List recent episodes",
        description:
          "List recent episodes (id, episode_number, title, status). Use this first to figure out which episode_number to pass into other tools.",
        inputSchema: {
          limit: z.number().int().positive().max(50).default(10),
        },
      },
      async ({ limit }) => {
        const showId = ensureShowId();
        const supabase = getSupabaseServer();
        const { data, error } = await supabase
          .from("episodes")
          .select("id, episode_number, title, subtitle, status, recording_date")
          .eq("show_id", showId)
          .order("episode_number", { ascending: false })
          .limit(limit);
        if (error) throw new Error(error.message);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
    );

    server.registerTool(
      "get_episode",
      {
        title: "Get episode metadata",
        description:
          "Get metadata for a single episode. Defaults to the current working (non-shipped) episode when no arg is given.",
        inputSchema: { episode: episodeArg },
      },
      async ({ episode }) => {
        const showId = ensureShowId();
        const supabase = getSupabaseServer();
        const ep = await resolveEpisode(supabase, showId, episode);
        return { content: [{ type: "text", text: JSON.stringify(ep, null, 2) }] };
      }
    );

    server.registerTool(
      "list_docket_topics",
      {
        title: "List docket topics",
        description:
          "List docket topics for an episode. Defaults to current working episode. Filter by status if needed (in, under_review, out).",
        inputSchema: {
          episode: episodeArg,
          status: z.enum(["in", "under_review", "out"]).optional(),
        },
      },
      async ({ episode, status }) => {
        const showId = ensureShowId();
        const supabase = getSupabaseServer();
        const ep = await resolveEpisode(supabase, showId, episode);
        let q = supabase
          .from("docket_topics")
          .select(
            "id, title, context, angle, status, sort_order, original_url, original_image_url, submitted_by, sources, docket_votes(*), docket_comments(count)"
          )
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

    server.registerTool(
      "get_topic",
      {
        title: "Get topic detail",
        description:
          "Full detail for a single docket topic, including all comments and votes.",
        inputSchema: { id: z.string().uuid() },
      },
      async ({ id }) => {
        const supabase = getSupabaseServer();
        const [topic, comments] = await Promise.all([
          supabase
            .from("docket_topics")
            .select("*, docket_votes(*)")
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("docket_comments")
            .select("*")
            .eq("topic_id", id)
            .order("created_at", { ascending: true }),
        ]);
        if (topic.error) throw new Error(topic.error.message);
        if (!topic.data) throw new Error(`Topic ${id} not found`);
        if (comments.error) throw new Error(comments.error.message);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { topic: topic.data, comments: comments.data },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    server.registerTool(
      "get_research_brief",
      {
        title: "Get research brief",
        description:
          "Latest research brief for an episode (synthesized topic research). Defaults to current working episode.",
        inputSchema: { episode: episodeArg },
      },
      async ({ episode }) => {
        const showId = ensureShowId();
        const supabase = getSupabaseServer();
        const ep = await resolveEpisode(supabase, showId, episode);
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
              text: JSON.stringify(
                { episode: ep, brief: data?.[0] || null },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    server.registerTool(
      "get_show_context",
      {
        title: "Get show context",
        description:
          "Show-level context (soul / hosts / brand / workflow) for the GodModePod show.",
        inputSchema: {},
      },
      async () => {
        const showId = ensureShowId();
        const supabase = getSupabaseServer();
        const { data, error } = await supabase
          .from("show_context")
          .select("*")
          .eq("show_id", showId);
        if (error) throw new Error(error.message);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
    );
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: false,
  }
);

const authedHandler = withMcpAuth(handler, verifyMcpToken, { required: true });

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };
