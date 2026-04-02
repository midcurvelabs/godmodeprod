import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shows: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { orgId, name, slug, brandColor } = body as {
    orgId: string;
    name: string;
    slug: string;
    brandColor?: string;
  };

  if (!orgId || !name || !slug) {
    return NextResponse.json(
      { error: "orgId, name, and slug are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("shows")
    .insert({
      org_id: orgId,
      name,
      slug,
      brand_color: brandColor || "#E8001D",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ show: data });
}
