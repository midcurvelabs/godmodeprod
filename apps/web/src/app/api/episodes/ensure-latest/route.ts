import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ensureLatestEpisode } from "@godmodeprod/shared";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { showId?: string };
  const showId = body.showId;

  if (!showId) {
    return NextResponse.json({ error: "showId is required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const episode = await ensureLatestEpisode(supabase, showId);
    return NextResponse.json({ episode });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
