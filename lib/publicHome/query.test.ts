import { afterEach, describe, expect, it, vi } from "vitest";

// Le build de la CI n'a aucune variable Supabase : l'accueil public (pré-rendu
// depuis #277) doit sortir vide plutôt que faire échouer le build.

const createClient = vi.fn(() => {
  throw new Error("supabaseUrl is required.");
});
vi.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => createClient(...(args as [])) }));
vi.mock("@/lib/queries/dailyVisibility", () => ({ hiddenSeriesFilter: vi.fn() }));

import { getPublicHomeData } from "./query";

afterEach(() => {
  vi.unstubAllEnvs();
  createClient.mockClear();
});

describe("getPublicHomeData sans variables Supabase", () => {
  it("renvoie un état vide sans créer de client", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const data = await getPublicHomeData();
    expect(data).toEqual({
      live: null,
      featured: null,
      featuredKicker: null,
      next: [],
      splits: {},
      lastResult: null,
      top: [],
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("avec les variables, une vraie erreur de lecture continue de lever", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    await expect(getPublicHomeData()).rejects.toThrow("supabaseUrl is required");
  });
});
