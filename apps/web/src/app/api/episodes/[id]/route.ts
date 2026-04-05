import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { canTransition } from "@godmodeprod/shared";
import type { EpisodeStatus } from "@godmodeprod/shared";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ episode: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabaseServer();

  // Validate status transition if status is being changed
  if (body.status) {
    const { data: current, error: fetchError } = await supabase
      .from("episodes")
      .select("status")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!canTransition(current.status as EpisodeStatus, body.status as EpisodeStatus)) {
      return NextResponse.json(
        { error: `Invalid transition: ${current.status} → ${body.status}` },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("episodes")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ episode: data });
}
