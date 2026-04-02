import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { main_content, notes_content, subject_options, status } = body as {
    main_content?: string;
    notes_content?: string;
    subject_options?: string[];
    status?: string;
  };

  const supabase = getSupabaseServer();

  const update: Record<string, unknown> = {};
  if (main_content !== undefined) update.main_content = main_content;
  if (notes_content !== undefined) update.notes_content = notes_content;
  if (subject_options !== undefined) update.subject_options = subject_options;
  if (status !== undefined) update.status = status;

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("newsletters")
    .update(update)
    .eq("id", id)
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
      action: status === "approved" ? "newsletter:approved" : "newsletter:edited",
      details: { newsletter_id: id },
    });
  }

  return NextResponse.json({ newsletter: data });
}
