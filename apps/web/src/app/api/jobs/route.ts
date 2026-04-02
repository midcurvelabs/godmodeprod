import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { SkillName } from "@godmodeprod/shared";

export async function POST(request: Request) {
  const body = await request.json();
  const { skillName, showId, episodeId, payload } = body as {
    skillName: SkillName;
    showId: string;
    episodeId?: string;
    payload: Record<string, unknown>;
  };

  if (!skillName || !showId) {
    return NextResponse.json(
      { error: "skillName and showId are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  // Create job record in database
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      show_id: showId,
      episode_id: episodeId || null,
      queue: "ai-jobs",
      job_type: skillName,
      status: "pending",
      payload,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // In production, this would also push to BullMQ via Redis.
  // For now, the worker polls the jobs table or we use Supabase realtime
  // to trigger the worker. This keeps the web app Vercel-compatible
  // (no direct Redis connection from serverless).

  return NextResponse.json({ job });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const episodeId = searchParams.get("episode_id");
  const showId = searchParams.get("show_id");

  if (!showId) {
    return NextResponse.json(
      { error: "show_id is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  let query = supabase
    .from("jobs")
    .select("*")
    .eq("show_id", showId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (episodeId) {
    query = query.eq("episode_id", episodeId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: data });
}
