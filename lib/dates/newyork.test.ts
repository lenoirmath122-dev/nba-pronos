import { describe, it, expect } from "vitest";
import { nyResultDates } from "./newyork";

describe("nyResultDates — veille NY pendant les premières heures", () => {
  it("00h30 NY (EDT) -> veille + jour", () => {
    expect(nyResultDates(new Date("2026-10-07T04:30:00Z"))).toEqual(["2026-10-06", "2026-10-07"]);
  });

  it("05h59 NY -> encore veille + jour", () => {
    expect(nyResultDates(new Date("2026-10-07T09:59:00Z"))).toEqual(["2026-10-06", "2026-10-07"]);
  });

  it("06h00 NY -> jour seul", () => {
    expect(nyResultDates(new Date("2026-10-07T10:00:00Z"))).toEqual(["2026-10-07"]);
  });

  it("midi UTC (override dev) -> jour seul", () => {
    expect(nyResultDates(new Date("2026-03-10T12:00:00Z"))).toEqual(["2026-03-10"]);
  });

  it("jour de retour à l'heure d'hiver (01/11/2026) 00h30 EDT -> veille 31/10", () => {
    expect(nyResultDates(new Date("2026-11-01T04:30:00Z"))).toEqual(["2026-10-31", "2026-11-01"]);
  });

  it("jour de passage à l'heure d'été (08/03/2026) 00h30 EST -> veille 07/03", () => {
    expect(nyResultDates(new Date("2026-03-08T05:30:00Z"))).toEqual(["2026-03-07", "2026-03-08"]);
  });
});

describe("nyResultDates — frontières", () => {
  it("minuit pile NY -> veille + jour", () => {
    expect(nyResultDates(new Date("2026-10-07T04:00:00Z"))).toEqual(["2026-10-06", "2026-10-07"]);
  });

  it("23h59 NY -> jour seul", () => {
    expect(nyResultDates(new Date("2026-10-07T03:59:00Z"))).toEqual(["2026-10-06"]);
  });

  it("06h00 NY un jour de bascule DST (01/11/2026, EST) -> jour seul", () => {
    expect(nyResultDates(new Date("2026-11-01T11:00:00Z"))).toEqual(["2026-11-01"]);
  });
});
