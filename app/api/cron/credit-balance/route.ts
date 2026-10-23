import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/sync/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { sendPushToSubscriptions, type PushSubscriptionRow } from "@/lib/push/send";
import { estimateBalance, fetchCostBuckets, readCreditConfig, sumCostUsd } from "@/lib/billing/creditBalance";

// Alerte « solde de crédits Anthropic bas » (cron Vercel quotidien).
// Solde ESTIMÉ = crédits achetés - coût réel facturé (Admin API cost_report),
// voir lib/billing/creditBalance.ts. Sous le seuil : push au propriétaire
// (OWNER_USER_ID), une fois par exécution, donc une fois par jour tant que le
// solde reste bas. Aucun appel IA, aucune écriture en base.
// `?dry_run=1` : calcule et renvoie le solde sans envoyer de push (contrôle
// manuel contre le solde affiché dans la Console).
// Garde d'authentification : Bearer SYNC_SECRET ou CRON_SECRET (cron Vercel).
export const runtime = "nodejs";

function formatUsd(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} $`;
}

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const config = readCreditConfig();
  if ("error" in config) {
    return NextResponse.json({ error: config.error }, { status: 500 });
  }

  let estimate;
  try {
    const buckets = await fetchCostBuckets(config.adminKey, config.sinceDate);
    estimate = estimateBalance(config, sumCostUsd(buckets), buckets.length);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("credit-balance : lecture des coûts impossible", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const dryRun = new URL(request.url).searchParams.get("dry_run") === "1";
  if (!estimate.belowThreshold || dryRun) {
    return NextResponse.json({ ...estimate, pushed: false, dryRun });
  }

  const owner = process.env.OWNER_USER_ID ?? "";
  if (!owner) {
    return NextResponse.json({ ...estimate, pushed: false, error: "OWNER_USER_ID absent." }, { status: 500 });
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key")
    .eq("user_id", owner);
  if (error) {
    return NextResponse.json({ ...estimate, pushed: false, error: error.message }, { status: 500 });
  }
  const subscriptions = (data ?? []) as PushSubscriptionRow[];
  if (subscriptions.length === 0) {
    return NextResponse.json({ ...estimate, pushed: false, error: "Aucun abonnement push pour le propriétaire." });
  }

  const { deadSubscriptionIds } = await sendPushToSubscriptions(
    subscriptions,
    {
      title: "Crédits Anthropic bientôt épuisés",
      body: `Solde estimé : ${formatUsd(estimate.balanceUsd)} (seuil ${formatUsd(estimate.thresholdUsd)}). Les paris persos s'arrêteront à 0.`,
      url: "https://platform.claude.com/settings/billing",
    },
    { ttlSeconds: 24 * 60 * 60 },
  );
  if (deadSubscriptionIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", deadSubscriptionIds);
  }

  return NextResponse.json({ ...estimate, pushed: true, subscriptions: subscriptions.length - deadSubscriptionIds.length });
}

export const GET = handle;
export const POST = handle;
