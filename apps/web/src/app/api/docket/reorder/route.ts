import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { orderedIds } = (await request.json()) as { orderedIds: string[] };

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Update sort_order for each topic in sequence
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("docket_topics")
      .update({ sort_order: index })
      .eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
