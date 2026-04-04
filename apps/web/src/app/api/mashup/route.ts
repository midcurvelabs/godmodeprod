import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { MashupVariant } from "@godmodeprod/shared";

const ALL_VARIANTS: MashupVariant[] = [
  "standard",
  "reversed",
  "theme_lead",
  "flash",
  "gaps",
];

export async function POST(request: Request) {
  const body = await request.json();
  const { episodeId, showId, clipIds, musicUrl, transitionStyle } = body as {
    episodeId: string;
    showId: string;
    clipIds: string[];
    musicUrl?: string;
    transitionStyle?: string;
  };

  if (!episodeId || !showId || !clipIds?.length) {
    return NextResponse.json(
      { error: "episodeId, showId, and clipIds are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  // Create one mashup_output row per variant
  const rows = ALL_VARIANTS.map((variant) => ({
    episode_id: episodeId,
    variant,
    status: "pending",
  }));

  const { data: outputs, error: outputErr } = await supabase
    .from("mashup_outputs")
    .insert(rows)
    .select();

  if (outputErr) {
    return NextResponse.json({ error: outputErr.message }, { status: 500 });
  }

  // Create a job for the worker
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      show_id: showId,
      episode_id: episodeId,
      queue: "video-jobs",
      job_type: "mashup-maker",
      status: "pending",
      payload: {
        episodeId,
        showId,
        clipIds,
        musicUrl: musicUrl || null,
        transitionStyle: transitionStyle || "cut",
        outputIds: outputs?.map((o) => o.id) || [],
      },
    })
    .select()
    .single();

  if (jobErr) {
    return NextResponse.json({ error: jobErr.message }, { status: 500 });
  }

  return NextResponse.json({ outputs, job });
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
    .from("mashup_outputs")
    .select("*")
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ outputs: data });
}
