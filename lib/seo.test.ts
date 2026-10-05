import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata as homeMetadata } from "@/app/(public)/page";
import { DEFAULT_DESCRIPTION, HOME_TITLE, SITE_URL, TAGLINE, pageMetadata } from "./seo";

// Décision du 05/10/2026 : le mot « pari(s) » est voulu dans les métadonnées
// (référencement), toujours accompagné de « argent réel » pour lever toute
// ambiguïté (point de vigilance ANJ du cadrage business).
const WORD = /(?<![\p{L}])paris?(?![\p{L}])/iu;

describe("seo", () => {
  it("les textes de référence disent « paris » ET « sans argent réel »", () => {
    expect(DEFAULT_DESCRIPTION).toMatch(WORD);
    expect(HOME_TITLE).toMatch(WORD);
    for (const text of [DEFAULT_DESCRIPTION, TAGLINE]) {
      expect(text).toMatch(/argent réel/i);
    }
  });

  it("les métadonnées de la page d'accueil contiennent le mot « paris »", () => {
    expect(JSON.stringify(homeMetadata)).toMatch(WORD);
  });

  it("pageMetadata pose la canonique, l'url OG et les images", () => {
    const meta = pageMetadata({ title: "Classement", path: "/leaderboard" });
    expect(meta.alternates?.canonical).toBe("/leaderboard");
    expect(meta.openGraph).toMatchObject({ url: "/leaderboard", siteName: "Panier Ballon" });
    expect(meta.openGraph?.images).toBeDefined();
    expect(meta.twitter?.images).toBeDefined();
    expect(meta.description).toBe(DEFAULT_DESCRIPTION);
    expect(meta.robots).toBeUndefined();
  });

  it("pageMetadata pose noindex sur demande", () => {
    const meta = pageMetadata({ title: "X", path: "/x", noindex: true });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("la page d'accueil a un titre absolu et la canonique « / »", () => {
    expect(homeMetadata.title).toEqual({ absolute: HOME_TITLE });
    expect(homeMetadata.alternates?.canonical).toBe("/");
  });

  it("le sitemap n'expose aucune route exclue par robots.txt ni /players", () => {
    const rules = robots().rules;
    const disallow = (Array.isArray(rules) ? rules[0] : rules).disallow as string[];
    for (const { url } of sitemap()) {
      const path = url.slice(SITE_URL.length) || "/";
      expect(path.startsWith("/players")).toBe(false);
      for (const blocked of disallow) expect(path.startsWith(blocked)).toBe(false);
    }
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
