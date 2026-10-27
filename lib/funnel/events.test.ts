import { describe, it, expect } from "vitest";
import {
  BOT_UA_PATTERNS,
  cleanUtmValue,
  isBotUserAgent,
  parseFunnelPayload,
  parseUtmCookie,
  serializeUtm,
  utmFromSearch,
} from "./events";

const base = { visitorId: "a1b2c3d4-e5f6-4789-a012-3456789abcde", event: "home_view" };

describe("parseFunnelPayload", () => {
  it("accepte un événement valide et réduit le référent à son hôte", () => {
    const p = parseFunnelPayload({ ...base, referrer: "https://l.instagram.com/?u=secret&x=1" });
    expect(p).toEqual({ visitorId: base.visitorId, event: "home_view", matchId: null,
      referrer: "l.instagram.com",
      utm: { source: null, medium: null, campaign: null, content: null },
    });
  });

  it("rejette un événement inconnu, un visiteur invalide ou un corps non objet", () => {
    expect(parseFunnelPayload({ ...base, event: "hack" })).toBeNull();
    expect(parseFunnelPayload({ ...base, visitorId: "x" })).toBeNull();
    expect(parseFunnelPayload(null)).toBeNull();
  });

  it("ignore un matchId ou un référent mal formé sans rejeter l'événement", () => {
    const p = parseFunnelPayload({ ...base, matchId: "pas-un-uuid", referrer: "pas une url" });
    expect(p).toMatchObject({ matchId: null, referrer: null });
  });
});

describe("UTM", () => {
  it("met en minuscules et n'accepte que [a-z0-9_.-]{1,100}", () => {
    expect(cleanUtmValue("Instagram_Bio")).toBe("instagram_bio");
    expect(cleanUtmValue("a b")).toBeNull();
    expect(cleanUtmValue("<script>")).toBeNull();
    expect(cleanUtmValue("")).toBeNull();
    expect(cleanUtmValue("x".repeat(101))).toBeNull();
    expect(cleanUtmValue("x".repeat(100))).toBe("x".repeat(100));
    expect(cleanUtmValue(42)).toBeNull();
  });

  it("nettoie chaque champ du payload sans rejeter l'événement", () => {
    const p = parseFunnelPayload({ ...base, utm: { source: "IG", medium: "bio link", campaign: "launch.1", content: 3 } });
    expect(p?.utm).toEqual({ source: "ig", medium: null, campaign: "launch.1", content: null });
  });

  it("accepte un payload sans UTM", () => {
    expect(parseFunnelPayload(base)?.utm).toEqual({ source: null, medium: null, campaign: null, content: null });
    expect(parseFunnelPayload({ ...base, utm: "n'importe quoi" })).not.toBeNull();
  });

  it("lit les utm_* de l'URL, et rien quand il n'y en a pas", () => {
    expect(utmFromSearch("?utm_source=Instagram&utm_medium=bio&x=1")).toEqual({
      source: "instagram",
      medium: "bio",
      campaign: null,
      content: null,
    });
    expect(utmFromSearch("?x=1")).toBeNull();
    expect(utmFromSearch("")).toBeNull();
  });

  it("fait l'aller-retour par le cookie pb_utm", () => {
    const utm = { source: "ig", medium: "story", campaign: null, content: "v2" };
    expect(parseUtmCookie(serializeUtm(utm))).toEqual(utm);
    expect(parseUtmCookie(undefined)).toEqual({ source: null, medium: null, campaign: null, content: null });
  });
});

describe("isBotUserAgent", () => {
  it("écarte robots, aperçus de liens et navigateurs sans tête", () => {
    const bots = [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; AhrefsBot/7.0)",
      "Mozilla/5.0 AppleWebKit/537.36 HeadlessChrome/120.0 Safari/537.36",
      "Mozilla/5.0 Chrome-Lighthouse",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
      "Mozilla/5.0 (compatible; YandexSpider/3.0)",
      "curl/8.4.0",
      "",
    ];
    for (const ua of bots) expect(isBotUserAgent(ua), ua).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
    expect(BOT_UA_PATTERNS.length).toBeGreaterThan(5);
  });

  it("laisse passer les vrais navigateurs, y compris intégrés", () => {
    const humans = [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0.0",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      "Mozilla/5.0 (Linux; Android 14; Cubot P80) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
    ];
    for (const ua of humans) expect(isBotUserAgent(ua), ua).toBe(false);
  });
});
