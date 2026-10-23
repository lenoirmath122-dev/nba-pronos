import { describe, expect, it, vi } from "vitest";
import { estimateBalance, fetchCostBuckets, readCreditConfig, sumCostUsd, type CostReportBucket } from "./creditBalance";

const bucket = (day: string, ...amounts: string[]): CostReportBucket => ({
  starting_at: `${day}T00:00:00Z`,
  ending_at: `${day}T23:59:59Z`,
  results: amounts.map((amount) => ({ amount, currency: "USD" })),
});

describe("readCreditConfig", () => {
  const ok = {
    ANTHROPIC_ADMIN_KEY: "sk-ant-admin01-test",
    CREDITS_PURCHASED_USD: "6.00",
    CREDITS_SINCE: "2026-08-21",
  } as unknown as NodeJS.ProcessEnv;

  it("lit la config et applique le seuil par défaut de 0,25 $", () => {
    expect(readCreditConfig(ok)).toEqual({
      adminKey: "sk-ant-admin01-test",
      purchasedUsd: 6,
      sinceDate: "2026-08-21",
      thresholdUsd: 0.25,
    });
  });

  it("refuse une clé API classique à la place d'une clé Admin", () => {
    expect(readCreditConfig({ ...ok, ANTHROPIC_ADMIN_KEY: "sk-ant-api03-x" })).toHaveProperty("error");
  });

  it("refuse une date mal formée", () => {
    expect(readCreditConfig({ ...ok, CREDITS_SINCE: "21/08/2026" })).toHaveProperty("error");
  });
});

describe("sumCostUsd", () => {
  it("additionne les montants en cents et renvoie des dollars", () => {
    // 68.578340 cents (Sonnet 5, 20/10) + 26.847860 (22/10) + 0 (web search)
    expect(sumCostUsd([bucket("2026-10-20", "68.578340", "0"), bucket("2026-10-22", "26.847860")])).toBeCloseTo(0.954262, 6);
  });

  it("ignore les montants illisibles", () => {
    expect(sumCostUsd([bucket("2026-10-20", "abc", "100")])).toBe(1);
  });
});

describe("estimateBalance", () => {
  const config = { purchasedUsd: 6, sinceDate: "2026-08-21", thresholdUsd: 0.25 };

  it("au-dessus du seuil : pas d'alerte", () => {
    expect(estimateBalance(config, 5.36, 64)).toMatchObject({ balanceUsd: 0.64, belowThreshold: false });
  });

  it("au seuil ou en dessous : alerte", () => {
    expect(estimateBalance(config, 5.75, 64).belowThreshold).toBe(true);
    expect(estimateBalance(config, 5.9, 64)).toMatchObject({ balanceUsd: 0.1, belowThreshold: true });
  });
});

describe("fetchCostBuckets", () => {
  it("suit la pagination et envoie la clé Admin", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [bucket("2026-10-01", "10")], has_more: true, next_page: "p2" })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [bucket("2026-10-02", "20")], has_more: false, next_page: null })),
      );

    const buckets = await fetchCostBuckets("sk-ant-admin01-test", "2026-10-01", new Date("2026-10-02T12:00:00Z"), fetchImpl);

    expect(buckets).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [firstUrl, firstInit] = fetchImpl.mock.calls[0];
    expect(firstUrl).toContain("starting_at=2026-10-01T00%3A00%3A00.000Z");
    expect(firstUrl).toContain("ending_at=2026-10-03T00%3A00%3A00.000Z");
    expect(firstUrl).toContain("bucket_width=1d");
    expect(firstInit.headers["x-api-key"]).toBe("sk-ant-admin01-test");
    expect(fetchImpl.mock.calls[1][0]).toContain("page=p2");
  });

  it("lève une erreur lisible si l'API refuse", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    await expect(fetchCostBuckets("sk-ant-admin01-test", "2026-10-01", new Date(), fetchImpl)).rejects.toThrow(
      "cost_report HTTP 403",
    );
  });
});
