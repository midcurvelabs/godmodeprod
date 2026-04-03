import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { action, episodeId, showId } = body as {
    action: "analyze" | "write" | "humanize" | "regenerate" | "humanize-all";
    episodeId: string;
    showId: string;
    outputId?: string;
    outputType?: string;
  };

  if (!action || !episodeId || !showId) {
    return NextResponse.json(
      { error: "action, episodeId, and showId are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  // Handle humanize-all: create one humanizer job per output
  if (action === "humanize-all") {
    const { data: existingOutputs, error: fetchErr } = await supabase
      .from("repurpose_outputs")
      .select("id")
      .eq("episode_id", episodeId)
      .neq("output_type", "master");

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const jobs = (existingOutputs || []).map((o) => ({
      show_id: showId,
      episode_id: episodeId,
      queue: "ai-jobs",
      job_type: "humanizer",
      status: "pending",
      payload: { episodeId, showId, outputId: o.id },
    }));

    if (jobs.length === 0) {
      return NextResponse.json({ error: "No outputs to humanize" }, { status: 400 });
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("jobs")
      .insert(jobs)
      .select();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ jobs: inserted });
  }

  const skillName =
    action === "analyze" ? "repurpose-analyze" :
    action === "write" || action === "regenerate" ? "repurpose-write" :
    "humanizer";

  const payload: Record<string, unknown> = { episodeId, showId };
  if (action === "humanize" && body.outputId) {
    payload.outputId = body.outputId;
  }
  if (action === "regenerate" && body.outputType) {
    payload.outputType = body.outputType;
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      show_id: showId,
      episode_id: episodeId,
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

  return NextResponse.json({ job });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const episodeId = searchParams.get("episode_id");
  const outputType = searchParams.get("output_type");

  if (!episodeId) {
    return NextResponse.json(
      { error: "episode_id is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  let query = supabase
    .from("repurpose_outputs")
    .select("*")
    .eq("episode_id", episodeId)
    .order("generated_at", { ascending: false });

  if (outputType) {
    query = query.eq("output_type", outputType);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Separate master analysis from content outputs
  const master = data?.find((d) => d.output_type === "master") || null;
  const outputs = data?.filter((d) => d.output_type !== "master") || [];

  return NextResponse.json({ master, outputs });
}
