// T-EDGE-01 (audit/BACKLOG_TESTS.md §5, feuille de route p1-4) : l'offset
// Europe/Paris est dérivé dynamiquement (jamais +1/+2 codé en dur, voir les
// commentaires de paris.ts) -- ce test fige le comportement réel autour
// d'une vraie bascule DST, plutôt que de faire confiance à la lecture de
// code seule. Dates 2026 vérifiées : passage à l'heure d'été le 29/03/2026
// (dernier dimanche de mars, CET +1 -> CEST +2), retour à l'heure d'hiver le
// 25/10/2026 (dernier dimanche d'octobre, CEST +2 -> CET +1).

import { describe, it, expect } from "vitest";
import { parisDayBoundsUtc, parisLocalToUtcIso, parisDateKey, parisDateTimeLabel, nyDayToSlot, slotToNyDay, dailyPublishAt, dailyPublishDay, isDailyDayPublished } from "./paris";

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

describe("publication du Match du jour (fenêtre glissante de 7 jours, 10h Paris)", () => {
  it("convertit jour NY <-> slot_index", () => {
    expect(nyDayToSlot("2026-10-20")).toBe(20261020);
    expect(slotToNyDay(20261020)).toBe("2026-10-20");
  });

  it("le match du jour D sort à 10h Paris le D-6", () => {
    expect(dailyPublishDay("2026-10-26")).toBe("2026-10-20");
    expect(dailyPublishDay("2026-11-15")).toBe("2026-11-09");
  });

  it("lancement : les jours 20 à 25/10 sortent tous le 19/10", () => {
    for (const day of ["2026-10-20", "2026-10-22", "2026-10-25"]) {
      expect(dailyPublishDay(day)).toBe("2026-10-19");
    }
    expect(dailyPublishDay("2026-10-26")).toBe("2026-10-20");
  });

  it("jours antérieurs au lancement (tests avec override) : publiés le jour même", () => {
    expect(dailyPublishDay("2026-10-07")).toBe("2026-10-07");
    expect(dailyPublishDay("2026-10-19")).toBe("2026-10-19");
  });

  it("été (CEST) : 10h Paris = 08:00Z", () => {
    expect(dailyPublishAt("2026-10-24")).toBe("2026-10-19T08:00:00.000Z");
    expect(dailyPublishAt("2026-10-26")).toBe("2026-10-20T08:00:00.000Z");
    expect(dailyPublishAt("2026-10-07")).toBe("2026-10-07T08:00:00.000Z");
  });

  it("après le retour à l'heure d'hiver Paris (25/10) : 10h CET = 09:00Z", () => {
    expect(dailyPublishAt("2026-10-31")).toBe("2026-10-25T09:00:00.000Z");
    expect(dailyPublishAt("2026-11-08")).toBe("2026-11-02T09:00:00.000Z");
  });

  it("borne exacte à 10:00:00 Paris", () => {
    const at = Date.parse("2026-10-20T08:00:00.000Z");
    expect(isDailyDayPublished("2026-10-26", at - 1)).toBe(false);
    expect(isDailyDayPublished("2026-10-26", at)).toBe(true);
  });

  it("7 jours de match visibles à un instant donné (J à J+6)", () => {
    const now = Date.parse("2026-10-24T12:00:00.000Z");
    expect(isDailyDayPublished("2026-10-24", now)).toBe(true);
    expect(isDailyDayPublished("2026-10-30", now)).toBe(true);
    expect(isDailyDayPublished("2026-10-31", now)).toBe(false);
  });

  it("un jour passé reste publié", () => {
    expect(isDailyDayPublished("2026-10-23", Date.parse("2026-10-24T12:00:00.000Z"))).toBe(true);
  });
});
