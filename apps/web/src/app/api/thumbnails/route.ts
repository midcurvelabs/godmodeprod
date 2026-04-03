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

  const { data, error } = await supabase
    .from("thumbnail_outputs")
    .select("*")
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ thumbnails: data || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { episodeId, showId, subtitle, episodeNumber, photos } = body as {
    episodeId: string;
    showId: string;
    subtitle: string;
    episodeNumber?: number;
    photos: Array<{ hostId: string; photoUrl: string }>;
  };

  if (!episodeId || !showId || !subtitle || !photos?.length) {
    return NextResponse.json(
      { error: "episodeId, showId, subtitle, and photos are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  // Insert thumbnail output
  const { data: thumbnail, error: thumbErr } = await supabase
    .from("thumbnail_outputs")
    .insert({
      episode_id: episodeId,
      photos: photos.map((p) => p.photoUrl),
      headline: subtitle,
      subtitle: episodeNumber ? `EP. ${episodeNumber}` : null,
      template_variant: "default",
      status: "pending",
    })
    .select()
    .single();

  if (thumbErr) {
    return NextResponse.json({ error: thumbErr.message }, { status: 500 });
  }

  // Create job
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      show_id: showId,
      episode_id: episodeId,
      queue: "media-jobs",
      job_type: "thumbnail-generator",
      status: "pending",
      payload: {
        thumbnailId: thumbnail.id,
        photos,
        subtitle,
        episodeNumber,
      },
    })
    .select()
    .single();

  if (jobErr) {
    return NextResponse.json({ error: jobErr.message }, { status: 500 });
  }

  return NextResponse.json({ thumbnail, job });
}
