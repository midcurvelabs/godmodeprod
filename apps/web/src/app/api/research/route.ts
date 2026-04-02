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
    .from("research_briefs")
    .select("*")
    .eq("episode_id", episodeId)
    .order("generated_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ brief: data?.[0] || null });
}
