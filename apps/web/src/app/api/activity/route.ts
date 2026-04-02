import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get("show_id");
  const episodeId = searchParams.get("episode_id");
  const limit = parseInt(searchParams.get("limit") || "30");

  if (!showId) {
    return NextResponse.json(
      { error: "show_id is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  let query = supabase
    .from("activity_log")
    .select("*")
    .eq("show_id", showId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (episodeId) {
    query = query.eq("episode_id", episodeId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activities: data });
}
