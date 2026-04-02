import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topicId = searchParams.get("topic_id");

  if (!topicId) {
    return NextResponse.json(
      { error: "topic_id is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("docket_comments")
    .select("*")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comments: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { topicId, authorId, content } = body as {
    topicId: string;
    authorId: string;
    content: string;
  };

  if (!topicId || !content) {
    return NextResponse.json(
      { error: "topicId and content are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("docket_comments")
    .insert({
      topic_id: topicId,
      author_id: authorId || "00000000-0000-0000-0000-000000000000",
      content,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comment: data });
}
