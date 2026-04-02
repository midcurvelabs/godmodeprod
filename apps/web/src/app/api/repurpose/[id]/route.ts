import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { content, status } = body as {
    content?: Record<string, unknown>;
    status?: string;
  };

  if (!content && !status) {
    return NextResponse.json(
      { error: "content or status is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  const update: Record<string, unknown> = {};
  if (content) update.content = content;
  if (status) update.status = status;

  const { data, error } = await supabase
    .from("repurpose_outputs")
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
      action: status === "approved" ? "repurpose:output:approved" : "repurpose:output:edited",
      details: { output_id: id, output_type: data.output_type },
    });
  }

  return NextResponse.json({ output: data });
}
