// Solde de crédits Anthropic estimé (alerte « solde bas »).
//
// Anthropic n'expose PAS le solde par API (pas d'endpoint, demande fermée
// « not planned »). On le reconstitue : crédits achetés depuis une date de
// référence, moins le coût réel facturé depuis cette date, lu dans
// l'Admin API (`GET /v1/organizations/cost_report`). Le coût couvre TOUTES
// les clés de l'organisation (Panier Ballon, Bon Plan Tennis, tests de dev),
// contrairement à `ai_usage_logs` qui ne voit que les appels de l'appli.
//
// Prérequis : compte Console en organisation (l'Admin API est indisponible
// pour les comptes individuels) et une clé `sk-ant-admin01-...`.
//
// Variables d'environnement (Vercel, Production) :
//   ANTHROPIC_ADMIN_KEY          clé Admin API (lecture des coûts uniquement)
//   CREDITS_PURCHASED_USD        total des crédits achetés/accordés depuis CREDITS_SINCE
//   CREDITS_SINCE                date (AAAA-MM-JJ, UTC) du premier crédit compté
//   CREDIT_ALERT_THRESHOLD_USD   seuil d'alerte (défaut 0.25)
// À chaque achat de crédits : ajouter le montant à CREDITS_PURCHASED_USD.

const COST_REPORT_URL = "https://api.anthropic.com/v1/organizations/cost_report";
const DAY_MS = 24 * 60 * 60 * 1000;
// Le cost_report ne sert que des buckets d'un jour, 31 au maximum par page.
const MAX_BUCKETS_PER_PAGE = 31;
const MAX_PAGES = 50;

export type CostReportBucket = {
  starting_at: string;
  ending_at: string;
  results: { amount: string; currency?: string }[];
};

type CostReportPage = {
  data: CostReportBucket[];
  has_more: boolean;
  next_page: string | null;
};

export type CreditConfig = {
  adminKey: string;
  purchasedUsd: number;
  sinceDate: string;
  thresholdUsd: number;
};

export type BalanceEstimate = {
  purchasedUsd: number;
  spentUsd: number;
  balanceUsd: number;
  thresholdUsd: number;
  belowThreshold: boolean;
  since: string;
  days: number;
};

/** Lit la config depuis l'environnement. Renvoie une erreur lisible plutôt
 *  que de lever : le cron doit pouvoir dire ce qui manque. */
export function readCreditConfig(env: NodeJS.ProcessEnv = process.env): CreditConfig | { error: string } {
  const adminKey = env.ANTHROPIC_ADMIN_KEY ?? "";
  if (!adminKey.startsWith("sk-ant-admin")) {
    return { error: "ANTHROPIC_ADMIN_KEY absente ou n'est pas une clé Admin API." };
  }
  const purchasedUsd = Number(env.CREDITS_PURCHASED_USD);
  if (!Number.isFinite(purchasedUsd) || purchasedUsd < 0) {
    return { error: "CREDITS_PURCHASED_USD absent ou invalide." };
  }
  const sinceDate = env.CREDITS_SINCE ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sinceDate) || Number.isNaN(Date.parse(`${sinceDate}T00:00:00Z`))) {
    return { error: "CREDITS_SINCE absent ou invalide (format AAAA-MM-JJ)." };
  }
  const thresholdUsd = env.CREDIT_ALERT_THRESHOLD_USD === undefined ? 0.25 : Number(env.CREDIT_ALERT_THRESHOLD_USD);
  if (!Number.isFinite(thresholdUsd) || thresholdUsd < 0) {
    return { error: "CREDIT_ALERT_THRESHOLD_USD invalide." };
  }
  return { adminKey, purchasedUsd, sinceDate, thresholdUsd };
}

/** Somme des coûts des buckets, en dollars. Les montants du cost_report sont
 *  des chaînes décimales en CENTS (même convention que les pages Coût de la
 *  Console : « 68.578340 » = 0,69 $). Vérification au premier déploiement :
 *  `balanceUsd` renvoyé par la route doit égaler le solde affiché dans la
 *  Console. */
export function sumCostUsd(buckets: CostReportBucket[]): number {
  let cents = 0;
  for (const bucket of buckets) {
    for (const result of bucket.results ?? []) {
      const amount = Number(result.amount);
      if (Number.isFinite(amount)) cents += amount;
    }
  }
  return cents / 100;
}

export function estimateBalance(config: Omit<CreditConfig, "adminKey">, spentUsd: number, days: number): BalanceEstimate {
  const balanceUsd = Math.round((config.purchasedUsd - spentUsd) * 10_000) / 10_000;
  return {
    purchasedUsd: config.purchasedUsd,
    spentUsd: Math.round(spentUsd * 10_000) / 10_000,
    balanceUsd,
    thresholdUsd: config.thresholdUsd,
    belowThreshold: balanceUsd <= config.thresholdUsd,
    since: config.sinceDate,
    days,
  };
}

/** Récupère tous les buckets journaliers depuis `sinceDate` jusqu'à la fin
 *  du jour courant (UTC), pages comprises. */
export async function fetchCostBuckets(
  adminKey: string,
  sinceDate: string,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<CostReportBucket[]> {
  const startingAt = new Date(`${sinceDate}T00:00:00Z`);
  const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + DAY_MS);

  const buckets: CostReportBucket[] = [];
  let page: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const params = new URLSearchParams({
      starting_at: startingAt.toISOString(),
      ending_at: endOfToday.toISOString(),
      bucket_width: "1d",
      limit: String(MAX_BUCKETS_PER_PAGE),
    });
    if (page) params.set("page", page);

    const response = await fetchImpl(`${COST_REPORT_URL}?${params}`, {
      headers: { "x-api-key": adminKey, "anthropic-version": "2023-06-01" },
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`cost_report HTTP ${response.status} : ${body.slice(0, 300)}`);
    }
    const json = (await response.json()) as CostReportPage;
    buckets.push(...(json.data ?? []));
    if (!json.has_more || !json.next_page) return buckets;
    page = json.next_page;
  }
  throw new Error(`cost_report : plus de ${MAX_PAGES} pages, arrêt par sécurité.`);
}
