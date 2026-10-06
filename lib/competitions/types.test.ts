import { describe, expect, it } from "vitest";
import { allowsSeriesBets, hasBracket, isSingleMatchSeries } from "./types";

describe("prédicats de type de compétition", () => {
  it("hasBracket : tout sauf DAILY_MATCH", () => {
    expect(hasBracket("PLAYOFFS")).toBe(true);
    expect(hasBracket("NBA_CUP")).toBe(true);
    expect(hasBracket("DAILY_MATCH")).toBe(false);
  });
  it("allowsSeriesBets : PLAYOFFS seulement", () => {
    expect(allowsSeriesBets("PLAYOFFS")).toBe(true);
    expect(allowsSeriesBets("NBA_CUP")).toBe(false);
    expect(allowsSeriesBets("DAILY_MATCH")).toBe(false);
  });
  it("isSingleMatchSeries : tout sauf PLAYOFFS", () => {
    expect(isSingleMatchSeries("PLAYOFFS")).toBe(false);
    expect(isSingleMatchSeries("NBA_CUP")).toBe(true);
    expect(isSingleMatchSeries("DAILY_MATCH")).toBe(true);
  });
});
