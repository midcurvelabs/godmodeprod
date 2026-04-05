import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, role, platforms, voiceCharacteristics, clipStyle, photoUrl, sortOrder } = body as {
    name?: string;
    role?: string;
    platforms?: Record<string, string>;
    voiceCharacteristics?: string;
    clipStyle?: string;
    photoUrl?: string;
    sortOrder?: number;
  };

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (role !== undefined) updates.role = role;
  if (platforms !== undefined) updates.platforms = platforms;
  if (voiceCharacteristics !== undefined) updates.voice_characteristics = voiceCharacteristics;
  if (clipStyle !== undefined) updates.clip_style = clipStyle;
  if (photoUrl !== undefined) updates.photo_url = photoUrl;
  if (sortOrder !== undefined) updates.sort_order = sortOrder;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("hosts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ host: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  const { error } = await supabase.from("hosts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
