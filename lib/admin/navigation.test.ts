import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  ADMIN_SCREENS,
  ADMIN_SECTION_LIST,
  ADMIN_SECTION_SCREENS,
  getAdminBackTarget,
} from "./navigation";

const adminDir = join(process.cwd(), "app", "(admin)");

describe("getAdminBackTarget", () => {
  it("est masqué sur le tableau de bord", () => {
    expect(getAdminBackTarget("/admin")).toBeNull();
    expect(getAdminBackTarget("/admin/")).toBeNull();
  });

  it("une rubrique remonte au tableau de bord", () => {
    expect(getAdminBackTarget("/admin/todo")).toEqual({ href: "/admin", label: "Tableau de bord" });
  });

  it("un écran remonte à sa rubrique", () => {
    expect(getAdminBackTarget("/admin/logs")).toEqual({ href: "/admin/system", label: "Système" });
    expect(getAdminBackTarget("/admin/popup")).toEqual({ href: "/admin/game", label: "Jeu" });
  });

  it("competitions/new et results remontent à Compétitions", () => {
    expect(getAdminBackTarget("/admin/competitions/new")?.href).toBe("/admin/competitions");
    expect(getAdminBackTarget("/admin/competitions/results")?.href).toBe("/admin/competitions");
  });

  it("une sous-route inconnue remonte à l'ancêtre enregistré", () => {
    expect(getAdminBackTarget("/admin/players/abc")?.href).toBe("/admin/community");
  });
});

describe("registre", () => {
  it("chaque écran existe et est atteignable depuis une rubrique", () => {
    const listed = new Set(Object.values(ADMIN_SECTION_SCREENS).flat());
    for (const href of Object.keys(ADMIN_SCREENS)) {
      expect(listed.has(href), `${href} orphelin`).toBe(true);
      const dir = join(adminDir, ...href.split("/").filter(Boolean));
      expect(existsSync(join(dir, "page.tsx")), `${href} sans page`).toBe(true);
    }
  });

  it("chaque rubrique a une page", () => {
    for (const section of ADMIN_SECTION_LIST) {
      expect(existsSync(join(adminDir, "admin", section.slug, "page.tsx"))).toBe(true);
    }
  });
});
