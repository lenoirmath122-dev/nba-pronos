import { NextResponse, type NextRequest } from "next/server";
import { PENDING_LEAGUE_COOKIE, PENDING_LEAGUE_MAX_AGE } from "@/lib/auth/pendingLeague";

// Visiteur invité dans une ligue : on retient le code puis on l'envoie
// créer son compte (?vers=login pour se connecter). Voir lib/auth/pendingLeague.ts.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const dest = request.nextUrl.searchParams.get("vers") === "login" ? "/login" : "/signup";
  const res = NextResponse.redirect(new URL(dest, request.url));
  res.cookies.set(PENDING_LEAGUE_COOKIE, decodeURIComponent(code).trim().slice(0, 64), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_LEAGUE_MAX_AGE,
  });
  return res;
}
