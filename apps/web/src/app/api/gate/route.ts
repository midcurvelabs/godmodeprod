import { NextResponse, type NextRequest } from "next/server";
import {
  expectedGateToken,
  GATE_COOKIE,
  GATE_COOKIE_MAX_AGE,
  hashAccessCode,
} from "@/lib/gate";

export async function POST(request: NextRequest) {
  const expected = await expectedGateToken();
  if (!expected) {
    return NextResponse.json(
      { error: "Gate not configured" },
      { status: 503 },
    );
  }

  let code = "";
  try {
    const body = (await request.json()) as { code?: string };
    code = typeof body.code === "string" ? body.code : "";
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const submitted = await hashAccessCode(code);
  if (submitted !== expected) {
    return NextResponse.json({ error: "Wrong code" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_COOKIE_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
