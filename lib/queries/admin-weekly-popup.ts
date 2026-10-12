import { getServerClient } from "@/lib/supabase/server";
import { getTodaySpendUsd, POPUP_DAILY_COST_CAP_USD } from "@/lib/ai/usageTracking";
import { weekEndFor } from "@/lib/weekly/standings";
import { STALE_GENERATING_MS } from "@/lib/weeklyPopup/config";
import { toDisplayedPopup, type DisplayedPopup } from "@/lib/weeklyPopup/display";
import {
  buildValidationContext,
  checkForPublication,
  citedUserIds,
  toEditorFields,
  type EditorFields,
  type EditorUser,
} from "@/lib/weeklyPopup/edit";
import { extractTokenUserIds, type TokenUserInfo } from "@/lib/weeklyPopup/tokens";
import type {
  WeeklyPopupCandidate,
  WeeklyPopupKind,
  WeeklyPopupRow,
  WeeklyPopupStatus,
  WeeklyPopupWarning,
} from "@/lib/weeklyPopup/types";

// Lecture de l'écran `/admin/popup` (lot 5, PR 4, plan §5.1). Session admin :
// la RLS (`is_admin()`) donne accès à `weekly_popups` et `weekly_popup_views`,
// jamais service_role pour une lecture. Rien n'est écrit ici.

type Client = Awaited<ReturnType<typeof getServerClient>>;

export type PopupHistoryItem = {
  id: string;
  weekEnd: string;
  status: WeeklyPopupStatus;
  kind: WeeklyPopupKind;
};

export type PopupCandidateView = {
  shortId: string;
  bloc: WeeklyPopupCandidate["bloc"];
  /** Pseudo d'aujourd'hui (jamais stocké avec le candidat). */
  pseudo: string;
  texte: string;
  match: string | null;
  chancePct: number | null;
  raison: string | null;
  sens: string | null;
  seuil: number | null;
  verdict: "ok" | "bloque" | null;
  categorie: string | null;
  citeRecemment: boolean;
  /** Le joueur est cité par le texte actuel (top, flop, refuse ou champion). */
  cited: boolean;
};

export type AdminPopupView = {
  row: WeeklyPopupRow;
  /** Joueurs ayant fermé la popup (« vu par N »). */
  views: number;
  editor: EditorFields;
  /** Contrôle bloquant de la publication, calculé à la lecture. */
  blocking: WeeklyPopupWarning[];
  /** Avertissements de génération puis de relecture. */
  warnings: WeeklyPopupWarning[];
  preview: DisplayedPopup | null;
  candidates: PopupCandidateView[];
  /** GENERATING depuis plus de 10 min : abandonnée, « Régénérer » la reprend. */
  generationStale: boolean;
  /** Les 20 dernières tentatives conservées : nombre et coût cumulé. */
  attemptCount: number;
  attemptsCostUsd: number;
};

export type AdminPopupPageData = {
  competition: {
    id: string;
    name: string;
    weeklyRanking: boolean;
    /** Null : colonne absente (migration 20261013090000 non poussée). */
    weeklyPopup: boolean | null;
  } | null;
  weekEnd: string;
  currentWeekEnd: string;
  weekFrozen: boolean;
  popup: AdminPopupView | null;
  history: PopupHistoryItem[];
  spendUsd: number;
  capUsd: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function readUsers(supabase: Client, ids: string[]): Promise<Map<string, EditorUser>> {
  const out = new Map<string, EditorUser>();
  const unique = [...new Set(ids.map((id) => id.toLowerCase()))];
  for (let i = 0; i < unique.length; i += 100) {
    const { data } = await supabase
      .from("users")
      .select("id, pseudo, status, popup_mentions_opt_out")
      .in("id", unique.slice(i, i + 100));
    for (const row of data ?? []) {
      out.set(String(row.id).toLowerCase(), {
        pseudo: String(row.pseudo ?? ""),
        status: String(row.status ?? ""),
        popup_mentions_opt_out: row.popup_mentions_opt_out === true,
      });
    }
  }
  return out;
}

export async function getAdminWeeklyPopupPage(requestedWeek?: string): Promise<AdminPopupPageData> {
  const supabase = await getServerClient();
  const currentWeekEnd = weekEndFor(Date.now());
  const weekEnd = requestedWeek && DATE_RE.test(requestedWeek) ? requestedWeek : currentWeekEnd;
  const spendUsd = await getTodaySpendUsd("popup");
  const base = { weekEnd, currentWeekEnd, spendUsd, capUsd: POPUP_DAILY_COST_CAP_USD };

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, weekly_ranking")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string; name: string; weekly_ranking: boolean }>();
  if (!competition) {
    return { ...base, competition: null, weekFrozen: false, popup: null, history: [] };
  }

  // Lecture séparée : la colonne n'existe pas avant la migration.
  const { data: flag, error: flagError } = await supabase
    .from("competitions")
    .select("weekly_popup")
    .eq("id", competition.id)
    .maybeSingle<{ weekly_popup: boolean }>();
  const weeklyPopup = flagError || !flag ? null : flag.weekly_popup;

  const [frozen, popupResult, historyResult] = await Promise.all([
    supabase
      .from("weekly_rankings")
      .select("week_end_date")
      .eq("competition_id", competition.id)
      .eq("week_end_date", weekEnd)
      .maybeSingle(),
    supabase
      .from("weekly_popups")
      .select("*")
      .eq("competition_id", competition.id)
      .eq("week_end_date", weekEnd)
      .maybeSingle(),
    supabase
      .from("weekly_popups")
      .select("id, week_end_date, status, kind")
      .eq("competition_id", competition.id)
      .order("week_end_date", { ascending: false })
      .limit(8),
  ]);

  const history: PopupHistoryItem[] = (historyResult.data ?? []).map((r) => ({
    id: String(r.id),
    weekEnd: String(r.week_end_date),
    status: r.status as WeeklyPopupStatus,
    kind: r.kind as WeeklyPopupKind,
  }));

  const head = {
    ...base,
    competition: {
      id: competition.id,
      name: competition.name,
      weeklyRanking: competition.weekly_ranking,
      weeklyPopup,
    },
    weekFrozen: frozen.data !== null && !frozen.error,
    history,
  };

  const row = popupResult.error ? null : (popupResult.data as WeeklyPopupRow | null);
  if (!row) return { ...head, popup: null };

  const ids = [...row.candidates.map((c) => c.user_id), ...citedUserIds(row.content)];
  const [users, viewsResult] = await Promise.all([
    readUsers(supabase, ids),
    supabase.from("weekly_popup_views").select("user_id", { count: "exact", head: true }).eq("popup_id", row.id),
  ]);

  const ctx = buildValidationContext(row.candidates, users, row.content);
  const check = row.content ? checkForPublication(row.content, ctx, users) : null;
  const editor = toEditorFields(row.content, users);

  const info = new Map<string, TokenUserInfo>();
  for (const [id, u] of users) info.set(id, { pseudo: u.pseudo, popupMentionsOptOut: u.popup_mentions_opt_out });
  const preview = row.content ? toDisplayedPopup(row.content, info) : null;

  const cited = new Set(
    row.content
      ? extractTokenUserIds(
          [row.content.champion, row.content.top, row.content.flop, row.content.refuse]
            .filter((v): v is string => typeof v === "string")
            .join("\n"),
        )
      : [],
  );
  const candidates: PopupCandidateView[] = row.candidates.map((c) => ({
    shortId: c.short_id,
    bloc: c.bloc,
    pseudo: users.get(c.user_id.toLowerCase())?.pseudo ?? "joueur supprimé",
    texte: c.texte,
    match: c.match ?? null,
    chancePct: c.chance_pct ?? null,
    raison: c.raison ?? null,
    sens: c.sens ?? null,
    seuil: c.seuil ?? null,
    verdict: c.verdict ?? null,
    categorie: c.categorie ?? null,
    citeRecemment: c.cite_recemment === true,
    cited: cited.has(c.user_id.toLowerCase()),
  }));

  return {
    ...head,
    popup: {
      row,
      views: viewsResult.count ?? 0,
      editor,
      blocking: check?.errors ?? [],
      warnings: [...row.warnings, ...(check?.warnings ?? [])],
      preview,
      candidates,
      generationStale:
        row.status === "GENERATING" &&
        (row.generation_started_at === null ||
          Date.now() - Date.parse(row.generation_started_at) > STALE_GENERATING_MS),
      attemptCount: row.attempts.length,
      attemptsCostUsd: row.attempts.reduce((sum, a) => sum + (a.cost_usd ?? 0), 0),
    },
  };
}

// --- Pastille du tableau de bord ------------------------------------------------

export type PopupPendingCounts = { pending: number; doubtful: number };

/** READY ou DOUBTFUL de la compétition active : à relire ou à débloquer. */
export async function getWeeklyPopupPendingCounts(
  supabase: Client,
  competitionId: string,
): Promise<PopupPendingCounts> {
  const { data, error } = await supabase
    .from("weekly_popups")
    .select("status")
    .eq("competition_id", competitionId)
    .in("status", ["READY", "DOUBTFUL"]);
  // Migration absente ou lecture en erreur : pas de pastille plutôt qu'un écran cassé.
  if (error || !data) return { pending: 0, doubtful: 0 };
  const doubtful = data.filter((r) => r.status === "DOUBTFUL").length;
  return { pending: data.length, doubtful };
}
