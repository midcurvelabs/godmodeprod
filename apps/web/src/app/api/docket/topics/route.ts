import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const episodeId = searchParams.get("episode_id");
  const showId = searchParams.get("show_id");
  const status = searchParams.get("status");

  if (!episodeId && !showId) {
    return NextResponse.json(
      { error: "episode_id or show_id is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  let query = supabase
    .from("docket_topics")
    .select("*, docket_votes(*), docket_comments(count)")
    .order("sort_order", { ascending: true });

  if (episodeId) query = query.eq("episode_id", episodeId);
  if (showId) query = query.eq("show_id", showId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ topics: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { episodeId, showId, title, context, angle, sources, submittedBy, originalUrl, autoIn } =
    body as {
      episodeId: string;
      showId: string;
      title: string;
      context?: string;
      angle?: string;
      sources?: Array<{ url: string; title: string }>;
      submittedBy?: string;
      originalUrl?: string;
      autoIn?: boolean;
    };

  if (!episodeId || !showId || !title) {
    return NextResponse.json(
      { error: "episodeId, showId, and title are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  // Get current max sort_order for this episode
  const { data: existing } = await supabase
    .from("docket_topics")
    .select("sort_order")
    .eq("episode_id", episodeId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("docket_topics")
    .insert({
      episode_id: episodeId,
      show_id: showId,
      title,
      context: context || "",
      angle: angle || "",
      sources: sources || [],
      original_url: originalUrl || "",
      submitted_by: submittedBy || "",
      status: autoIn ? "in" : "under_review",
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ topic: data });
}
