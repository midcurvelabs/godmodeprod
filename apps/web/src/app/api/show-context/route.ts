import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get("show_id");

  if (!showId) {
    return NextResponse.json(
      { error: "show_id is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("show_context")
    .select("*")
    .eq("show_id", showId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contexts: data || [] });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { showId, contextType, content } = body as {
    showId: string;
    contextType: "soul" | "hosts" | "brand" | "workflow";
    content: Record<string, unknown>;
  };

  if (!showId || !contextType || !content) {
    return NextResponse.json(
      { error: "showId, contextType, and content are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("show_context")
    .upsert(
      {
        show_id: showId,
        context_type: contextType,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "show_id,context_type" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ context: data });
}
