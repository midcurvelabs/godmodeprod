import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clipId: string }> }
) {
  const { clipId } = await params;
  const body = await request.json();
  const { title, startTime, endTime, captionText, status, format } = body as {
    title?: string;
    startTime?: number;
    endTime?: number;
    captionText?: string;
    status?: string;
    format?: string;
  };

  const supabase = getSupabaseServer();

  const update: Record<string, unknown> = {};
  if (title !== undefined) update.title = title;
  if (startTime !== undefined) update.start_time = startTime;
  if (endTime !== undefined) update.end_time = endTime;
  if (captionText !== undefined) update.caption_text = captionText;
  if (status !== undefined) update.status = status;
  if (format !== undefined) update.format = format;

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "At least one field to update is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("clips")
    .update(update)
    .eq("id", clipId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  if (data) {
    await supabase.from("activity_log").insert({
      show_id: null,
      episode_id: data.episode_id,
      action: "video:clip:updated",
      details: { clip_id: clipId, updated_fields: Object.keys(update) },
    });
  }

  return NextResponse.json({ clip: data });
}
