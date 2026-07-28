import { NextResponse, type NextRequest } from "next/server";
import { expectedGateToken, GATE_COOKIE } from "@/lib/gate";

/**
 * Closed-beta access-code gate.
 * Set GODMODEPROD_ACCESS_CODE on Vercel to enable. Unset = no gate (local default).
 * Telegram + MCP keep their own auth and stay open.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const expected = await expectedGateToken();
  if (!expected) return NextResponse.next();

  if (isPublicPath(pathname)) return NextResponse.next();

  const token = request.cookies.get(GATE_COOKIE)?.value;
  if (token === expected) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const gate = request.nextUrl.clone();
  gate.pathname = "/gate";
  gate.search = "";
  if (pathname !== "/") {
    gate.searchParams.set("next", pathname);
  }
  return NextResponse.redirect(gate);
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/gate") return true;
  if (pathname === "/api/gate") return true;
  // Bot/webhook surfaces — already secret-token gated
  if (pathname.startsWith("/api/telegram")) return true;
  if (pathname.startsWith("/api/mcp")) return true;
  return false;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
