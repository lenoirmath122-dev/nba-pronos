import { getServerClient } from "@/lib/supabase/server";

// Lecture de la section "Historique" (Profil, BACKLOG_V1.md « Fun / esprit
// ligue entre potes »). Composant serveur, RLS seule autorité — competitions
// (`competitions_select using (true)`) et competition_superlatives
// (`competition_superlatives_select using (true)`, migration #18) sont
// toutes deux publiques, même classe d'info que le classement archivé
// (`competition_archives`, déjà `using (true)`).

const SUPERLATIVE_LABELS: Record<string, string> = {
  NOSTRADAMUS: "Nostradamus — le plus de bons vainqueurs",
  SNIPER: "Sniper — le plus d'écarts exacts",
  BRACKET_KING: "Meilleur bracket",
  BEST_ROUND1: "Meilleur 1er tour",
  BIGGEST_CLIMB: "Plus grosse remontée",
};

export type SuperlativeEntry = {
  kind: string;
  label: string;
  pseudo: string;
  value: number;
};

export type CompetitionHistoryEntry = {
  competitionId: string;
  name: string;
  type: "PLAYOFFS" | "NBA_CUP";
  archivedAt: string | null;
  superlatives: SuperlativeEntry[];
};

type CompetitionRow = {
  id: string;
  name: string;
  type: "PLAYOFFS" | "NBA_CUP";
  archived_at: string | null;
  created_at: string;
};

type SuperlativeRow = {
  competition_id: string;
  kind: string;
  pseudo_snapshot: string;
  value: number;
};

export async function getCompetitionHistory(): Promise<CompetitionHistoryEntry[]> {
  const supabase = await getServerClient();

  const { data: competitionsData } = await supabase
    .from("competitions")
    .select("id, name, type, archived_at, created_at")
    .eq("status", "ARCHIVED");

  const competitions = (competitionsData ?? []) as CompetitionRow[];
  if (competitions.length === 0) return [];

  // archived_at peut être NULL pour les compétitions closes avant le
  // correctif qui l'écrit (lib/actions/admin-competitions.ts) — repli sur
  // created_at pour un tri toujours défini, jamais une erreur.
  const sorted = [...competitions].sort(
    (a, b) => Date.parse(b.archived_at ?? b.created_at) - Date.parse(a.archived_at ?? a.created_at)
  );

  const competitionIds = sorted.map((c) => c.id);
  const { data: superlativesData } = await supabase
    .from("competition_superlatives")
    .select("competition_id, kind, pseudo_snapshot, value")
    .in("competition_id", competitionIds);

  const superlativesByCompetition = new Map<string, SuperlativeEntry[]>();
  for (const row of (superlativesData ?? []) as SuperlativeRow[]) {
    const list = superlativesByCompetition.get(row.competition_id) ?? [];
    list.push({
      kind: row.kind,
      label: SUPERLATIVE_LABELS[row.kind] ?? row.kind,
      pseudo: row.pseudo_snapshot,
      value: row.value,
    });
    superlativesByCompetition.set(row.competition_id, list);
  }

  return sorted.map((c) => ({
    competitionId: c.id,
    name: c.name,
    type: c.type,
    archivedAt: c.archived_at,
    superlatives: superlativesByCompetition.get(c.id) ?? [],
  }));
}
