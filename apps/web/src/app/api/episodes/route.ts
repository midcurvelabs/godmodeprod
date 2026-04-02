import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get("show_id");

  if (!showId) {
    return NextResponse.json(
      { error: "show_id is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .eq("show_id", showId)
    .order("episode_number", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ episodes: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { showId, episodeNumber, title, subtitle, recordingDate } = body as {
    showId: string;
    episodeNumber: number;
    title: string;
    subtitle?: string;
    recordingDate?: string;
  };

  if (!showId || !episodeNumber || !title) {
    return NextResponse.json(
      { error: "showId, episodeNumber, and title are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("episodes")
    .insert({
      show_id: showId,
      episode_number: episodeNumber,
      title,
      subtitle: subtitle || null,
      recording_date: recordingDate || null,
      status: "created",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ episode: data });
}
