import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { episodeId, showId, rawContent } = body as {
    episodeId: string;
    showId: string;
    rawContent: string;
  };

  if (!episodeId || !showId || !rawContent) {
    return NextResponse.json(
      { error: "episodeId, showId, and rawContent are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  // Insert raw transcript
  const { data: transcript, error: transcriptError } = await supabase
    .from("transcripts")
    .insert({
      episode_id: episodeId,
      raw_content: rawContent,
      word_count: rawContent.split(/\s+/).length,
      status: "pending",
    })
    .select()
    .single();

  if (transcriptError) {
    return NextResponse.json({ error: transcriptError.message }, { status: 500 });
  }

  // Enqueue transcript-ingest job
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      show_id: showId,
      episode_id: episodeId,
      queue: "ai-jobs",
      job_type: "transcript-ingest",
      status: "pending",
      payload: {
        transcriptId: transcript.id,
        showId,
        episodeId,
      },
    })
    .select()
    .single();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  return NextResponse.json({ transcript, job });
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
    .from("transcripts")
    .select("*")
    .eq("episode_id", episodeId)
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transcript: data?.[0] || null });
}
