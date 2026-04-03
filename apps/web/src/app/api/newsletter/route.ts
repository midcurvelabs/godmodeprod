import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { episodeId, showId, tone, sections } = body as {
    episodeId: string;
    showId: string;
    tone?: "default" | "formal" | "shorter";
    sections?: string[];
  };

  if (!episodeId || !showId) {
    return NextResponse.json(
      { error: "episodeId and showId are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      show_id: showId,
      episode_id: episodeId,
      queue: "ai-jobs",
      job_type: "substack",
      status: "pending",
      payload: { episodeId, showId, tone: tone || "default", sections: sections || ["intro", "topics", "quotes", "links", "closing"] },
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ job });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const episodeId = searchParams.get("episode_id");

  if (!episodeId) {
    return NextResponse.json(
      { error: "episode_id is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("newsletters")
    .select("*")
    .eq("episode_id", episodeId)
    .order("generated_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ newsletter: data?.[0] || null });
}
