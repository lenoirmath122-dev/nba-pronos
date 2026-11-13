import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser } })),
}));

import { createServerClient } from "@supabase/ssr";
import { config, proxy } from "./proxy";

const SESSION_COOKIE = "sb-abcd-auth-token=x";

function req(path: string, cookie?: string) {
  return new NextRequest(new URL(path, "https://panierballon.fr"), {
    headers: cookie ? { cookie } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("proxy — visiteur sans cookie de session", () => {
  it("n'interroge pas Supabase", async () => {
    await proxy(req("/leaderboard"));
    expect(createServerClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("renvoie toujours les zones protégées vers /login", async () => {
    for (const path of ["/home", "/play/bets/new", "/profile", "/admin/logs"]) {
      const res = await proxy(req(path));
      expect(res.headers.get("location")).toBe("https://panierballon.fr/login");
    }
  });

  it("laisse passer les pages publiques et la page d'accueil", async () => {
    for (const path of ["/", "/login", "/leaderboard", "/regles"]) {
      const res = await proxy(req(path));
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("laisse passer une Server Action sans rediriger", async () => {
    const r = new NextRequest(new URL("/play", "https://panierballon.fr"), {
      headers: { "next-action": "abc" },
    });
    expect((await proxy(r)).headers.get("location")).toBeNull();
  });
});

describe("proxy — avec cookie de session", () => {
  it("vérifie la session et renvoie un connecté de / vers /play (page d’arrivée)", async () => {
    const res = await proxy(req("/", SESSION_COOKIE));
    expect(getUser).toHaveBeenCalledOnce();
    expect(res.headers.get("location")).toBe("https://panierballon.fr/play");
  });

  it("reconnaît un cookie découpé en morceaux", async () => {
    await proxy(req("/home", "sb-abcd-auth-token.0=x; sb-abcd-auth-token.1=y"));
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("renvoie vers /login si la session est invalide", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await proxy(req("/home", SESSION_COOKIE));
    expect(res.headers.get("location")).toBe("https://panierballon.fr/login");
  });
});

describe("proxy — matcher", () => {
  const re = new RegExp(`^${config.matcher[0]}$`);
  it.each(["/", "/home", "/play/bets/new", "/admin", "/leaderboard", "/auth/callback", "/players/123"])(
    "passe par le proxy : %s",
    (path) => expect(re.test(path)).toBe(true)
  );
  it.each([
    "/api/sync/results",
    "/api/recaps",
    "/_vercel/insights/view",
    "/sw.js",
    "/icons/icon-192.png",
    "/_next/static/chunks/a.js",
    "/robots.txt",
  ])("ignoré : %s", (path) => expect(re.test(path)).toBe(false));
});
