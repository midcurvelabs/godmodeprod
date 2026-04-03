import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

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

  const [videoRes, clipsRes] = await Promise.all([
    supabase
      .from("source_videos")
      .select("*")
      .eq("episode_id", episodeId)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("clips")
      .select("*")
      .eq("episode_id", episodeId)
      .order("created_at", { ascending: true }),
  ]);

  if (videoRes.error) {
    return NextResponse.json({ error: videoRes.error.message }, { status: 500 });
  }
  if (clipsRes.error) {
    return NextResponse.json({ error: clipsRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    sourceVideo: videoRes.data || null,
    clips: clipsRes.data || [],
  });
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, episodeId, showId } = body as {
    action: string;
    episodeId: string;
    showId: string;
    [key: string]: unknown;
  };

  if (!action || !episodeId) {
    return NextResponse.json(
      { error: "action and episodeId are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  if (action === "upload-source") {
    const { fileUrl, duration } = body as { fileUrl: string; duration?: number };
    const { data, error } = await supabase
      .from("source_videos")
      .insert({
        episode_id: episodeId,
        file_url: fileUrl,
        duration_seconds: duration || null,
        format: "mp4",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sourceVideo: data });
  }

  if (action === "add-clip") {
    const { sourceVideoId, name, hostId, startTime, endTime, hook } = body as {
      sourceVideoId?: string;
      name: string;
      hostId?: string;
      startTime: number;
      endTime: number;
      hook?: string;
    };

    const { data, error } = await supabase
      .from("clips")
      .insert({
        episode_id: episodeId,
        source_video_id: sourceVideoId || null,
        title: name,
        host_id: hostId || null,
        start_time: startTime,
        end_time: endTime,
        caption_text: hook || null,
        status: "queued",
        format: "9:16",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ clip: data });
  }

  if (action === "import-from-analysis") {
    const { sourceVideoId } = body as { sourceVideoId?: string };

    // Read clip_timestamps from repurpose analysis
    const { data: outputs, error: fetchErr } = await supabase
      .from("repurpose_outputs")
      .select("content")
      .eq("episode_id", episodeId)
      .eq("output_type", "clip_timestamps")
      .limit(1)
      .maybeSingle();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!outputs?.content) {
      return NextResponse.json({ error: "No clip timestamps found from analysis" }, { status: 404 });
    }

    const timestamps = (outputs.content as { clips?: Array<{ title: string; host?: string; host_id?: string; start_ref: string; end_ref: string; hook?: string }> }).clips || [];

    if (timestamps.length === 0) {
      return NextResponse.json({ error: "No clips in analysis output" }, { status: 404 });
    }

    const rows = timestamps.map((ts) => ({
      episode_id: episodeId,
      source_video_id: sourceVideoId || null,
      title: ts.title,
      host_id: ts.host_id || null,
      start_time: parseTimestamp(ts.start_ref),
      end_time: parseTimestamp(ts.end_ref),
      caption_text: ts.hook || null,
      status: "queued" as const,
      format: "9:16",
    }));

    const { data, error } = await supabase.from("clips").insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ clips: data });
  }

  if (action === "process-clip") {
    const { clipId, format } = body as { clipId: string; format?: string };
    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        show_id: showId,
        episode_id: episodeId,
        queue: "video-jobs",
        job_type: "pod-clipper",
        status: "pending",
        payload: { clipId, format: format || "9:16" },
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mark clip as cutting
    await supabase.from("clips").update({ status: "cutting" }).eq("id", clipId);

    return NextResponse.json({ job });
  }

  if (action === "process-all") {
    const { data: queuedClips, error: fetchErr } = await supabase
      .from("clips")
      .select("id, format")
      .eq("episode_id", episodeId)
      .eq("status", "queued");

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!queuedClips?.length) {
      return NextResponse.json({ error: "No queued clips to process" }, { status: 400 });
    }

    const jobs = queuedClips.map((clip) => ({
      show_id: showId,
      episode_id: episodeId,
      queue: "video-jobs",
      job_type: "pod-clipper",
      status: "pending",
      payload: { clipId: clip.id, format: clip.format || "9:16" },
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("jobs")
      .insert(jobs)
      .select();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    // Mark all queued clips as cutting
    const clipIds = queuedClips.map((c) => c.id);
    await supabase.from("clips").update({ status: "cutting" }).in("id", clipIds);

    return NextResponse.json({ jobs: inserted });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
