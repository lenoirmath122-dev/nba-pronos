import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { encodeThemeCookie, themeAttributes, type BackgroundTheme, type ThemePreference } from "./cookie";

const THEMES: ThemePreference[] = ["LIGHT", "DARK", "PHOTO"];
const BACKGROUNDS: BackgroundTheme[] = ["MURAL", "HOOP", "HK"];
const INIT_SCRIPT = readFileSync(path.resolve(__dirname, "../../public/theme-init.js"), "utf8");

/** Exécute public/theme-init.js avec un faux document et renvoie les attributs posés. */
function runInitScript(cookie: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const document = {
    cookie,
    documentElement: { setAttribute: (name: string, value: string) => (attrs[name] = value) },
  };
  runInNewContext(INIT_SCRIPT, { document });
  return attrs;
}

describe("themeAttributes", () => {
  it("garde les règles de l'ancien layout racine", () => {
    expect(themeAttributes("DARK", "HOOP")).toEqual({});
    expect(themeAttributes("LIGHT", "HK")).toEqual({ theme: "light" });
    expect(themeAttributes("PHOTO", "MURAL")).toEqual({ theme: "photo" });
    expect(themeAttributes("PHOTO", "HOOP")).toEqual({ theme: "photo", bg: "hoop" });
    expect(themeAttributes("PHOTO", "HK")).toEqual({ theme: "photo", bg: "hk" });
  });
});

describe("public/theme-init.js", () => {
  it.each(THEMES.flatMap((t) => BACKGROUNDS.map((b) => [t, b] as const)))(
    "applique les mêmes attributs que themeAttributes (%s, %s)",
    (theme, background) => {
      const expected = themeAttributes(theme, background);
      const attrs = runInitScript(`sb-x-auth-token=abc; pb-theme=${encodeThemeCookie(theme, background)}; autre=1`);
      expect(attrs).toEqual({
        ...(expected.theme ? { "data-theme": expected.theme } : {}),
        ...(expected.bg ? { "data-bg": expected.bg } : {}),
      });
    }
  );

  it("ne fait rien sans cookie ou avec une valeur inconnue", () => {
    expect(runInitScript("")).toEqual({});
    expect(runInitScript("pb-theme=ROUGE.MURAL")).toEqual({});
    expect(runInitScript("xpb-theme=LIGHT.MURAL")).toEqual({});
  });
});
