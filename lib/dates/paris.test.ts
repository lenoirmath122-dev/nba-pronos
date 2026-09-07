// T-EDGE-01 (audit/BACKLOG_TESTS.md §5, feuille de route p1-4) : l'offset
// Europe/Paris est dérivé dynamiquement (jamais +1/+2 codé en dur, voir les
// commentaires de paris.ts) -- ce test fige le comportement réel autour
// d'une vraie bascule DST, plutôt que de faire confiance à la lecture de
// code seule. Dates 2026 vérifiées : passage à l'heure d'été le 29/03/2026
// (dernier dimanche de mars, CET +1 -> CEST +2), retour à l'heure d'hiver le
// 25/10/2026 (dernier dimanche d'octobre, CEST +2 -> CET +1).

import { describe, it, expect } from "vitest";
import { parisDayBoundsUtc, parisLocalToUtcIso, parisDateKey, parisDateTimeLabel } from "./paris";

describe("parisDayBoundsUtc — offset dynamique autour de la bascule DST", () => {
  it("veille du passage à l'heure d'été (28/03/2026) -> encore CET (+1h)", () => {
    const { startIso, endIsoExclusive } = parisDayBoundsUtc("2026-03-28");
    expect(startIso).toBe("2026-03-27T23:00:00.000Z");
    expect(endIsoExclusive).toBe("2026-03-28T23:00:00.000Z");
  });

  it("jour du passage à l'heure d'été (29/03/2026) -> déjà CEST (+2h) à midi UTC", () => {
    const { startIso, endIsoExclusive } = parisDayBoundsUtc("2026-03-29");
    expect(startIso).toBe("2026-03-28T22:00:00.000Z");
    expect(endIsoExclusive).toBe("2026-03-29T22:00:00.000Z");
  });

  it("jour du retour à l'heure d'hiver (25/10/2026) -> repassé en CET (+1h) à midi UTC", () => {
    const { startIso, endIsoExclusive } = parisDayBoundsUtc("2026-10-25");
    expect(startIso).toBe("2026-10-24T23:00:00.000Z");
    expect(endIsoExclusive).toBe("2026-10-25T23:00:00.000Z");
  });
});

describe("parisLocalToUtcIso — heure murale saisie sans fuseau, convertie selon la saison", () => {
  it("heure d'hiver (15/01, CET +1) -> UTC = heure locale - 1h", () => {
    expect(parisLocalToUtcIso("2026-01-15T14:00")).toBe("2026-01-15T13:00:00.000Z");
  });

  it("heure d'été (15/07, CEST +2) -> UTC = heure locale - 2h", () => {
    expect(parisLocalToUtcIso("2026-07-15T14:00")).toBe("2026-07-15T12:00:00.000Z");
  });

  it("après-midi du jour de bascule (29/03, déjà CEST) -> décalage de 2h, pas 1h", () => {
    expect(parisLocalToUtcIso("2026-03-29T14:00")).toBe("2026-03-29T12:00:00.000Z");
  });

  it("après-midi du jour de bascule inverse (25/10, déjà CET) -> décalage de 1h, pas 2h", () => {
    expect(parisLocalToUtcIso("2026-10-25T14:00")).toBe("2026-10-25T13:00:00.000Z");
  });
});

describe("parisDateKey / parisDateTimeLabel — sanité de part et d'autre de la bascule", () => {
  it("parisDateKey renvoie la date calendaire Paris, pas la date UTC", () => {
    // 23h30 UTC le 28/03 = 00h30 (déjà 29/03) heure de Paris -- CET encore (+1h) à ce moment.
    expect(parisDateKey(Date.parse("2026-03-28T23:30:00.000Z"))).toBe("2026-03-29");
  });

  it("parisDateTimeLabel formate en JJ/MM HH:mm heure locale Paris (été)", () => {
    expect(parisDateTimeLabel("2026-07-15T12:00:00.000Z")).toBe("15/07 14:00");
  });
});
