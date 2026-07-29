import { getPlayHubData } from "@/lib/queries/play-hub";
import { PlayHubCard } from "@/components/play/PlayHubCard";
import styles from "./page.module.css";

// Hub Jouer (SPEC_ECRAN_HUB_JOUER_V0_1) — remplace le hub temporaire
// (ETAT_ACTUEL.md §2.10). Grille 2×2 : Matchs/Mes pronos en haut,
// Mon bracket/Paris en bas (acté avec l'utilisateur, §1). Composant serveur
// pur, aucune interaction hormis la navigation native des cartes.

const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });

function matchesLines(data: Awaited<ReturnType<typeof getPlayHubData>>["matches"]): string[] {
  if (!data.nextMatch) return [];
  const time = TIME_FORMATTER.format(new Date(data.nextMatch.scheduledAt));
  return [`${data.nextMatch.homeAbbreviation} - ${data.nextMatch.awayAbbreviation} · ${time}`];
}

function predictionsLines(data: Awaited<ReturnType<typeof getPlayHubData>>["predictions"]): string[] {
  if (!data.lastScored) return [];
  const { teamAbbreviation, margin, isWin, points } = data.lastScored;
  const outcome = isWin ? "gagné" : "perdu";
  return [`Dernier verrouillé : ${teamAbbreviation} −${margin} (${outcome}, ${points} pt${points > 1 ? "s" : ""})`];
}

function bracketDeadlineLabel(deadline: string): string {
  const remainingMs = Date.parse(deadline) - Date.now();
  const hours = Math.max(0, Math.round(remainingMs / (60 * 60 * 1000)));
  if (hours < 24) return `Deadline dans ${hours} h`;
  return `Deadline dans ${Math.round(hours / 24)} j`;
}

function bracketLines(data: Awaited<ReturnType<typeof getPlayHubData>>["bracket"]): string[] {
  const lines: string[] = [];
  if (data.isActionable) {
    lines.push(`Rempli ${data.filledCount}/${data.totalCount}`);
    if (data.isNearDeadline && data.deadline) lines.push(bracketDeadlineLabel(data.deadline));
  }
  // Indépendant de isActionable : un pari série reste posable même après la
  // deadline du BRACKET (celle du 1er match du tournoi) tant que le 1er match
  // DE CETTE SÉRIE précise n'a pas eu lieu (tours suivants notamment).
  if (data.remainingSeriesBets > 0) {
    const n = data.remainingSeriesBets;
    lines.push(`${n} pari${n > 1 ? "s" : ""} série${n > 1 ? "s" : ""} restant${n > 1 ? "s" : ""}`);
  }
  return lines;
}

function betsLines(data: Awaited<ReturnType<typeof getPlayHubData>>["bets"]): string[] {
  const parts: string[] = [];
  if (data.draftCount > 0) parts.push(`${data.draftCount} brouillon${data.draftCount > 1 ? "s" : ""}`);
  if (data.submittedCount > 0) parts.push(`${data.submittedCount} en attente d'admin`);
  return parts.length > 0 ? [parts.join(", ")] : [];
}

export default async function PlayPage() {
  const data = await getPlayHubData();

  return (
    <div className={styles.page}>
      <div className={`${styles.header} hero-banner`}>
        <h1 className={`${styles.title} hero-banner-title`}>Jouer</h1>
      </div>
      <div className={styles.grid}>
        <PlayHubCard
          title="Matchs"
          href="/play/matches"
          badge={data.matches.todoCount}
          lines={matchesLines(data.matches)}
        />
        <PlayHubCard title="Mes pronos" href="/play/my-predictions" lines={predictionsLines(data.predictions)} />
        {/* Pas de badge numérique ici : la pastille "à faire" du bracket est le
            ratio "X/15" lui-même (§2.3), déjà porté par la 1ère ligne
            (bracketLines) — un badge séparé ne ferait que le répéter. */}
        <PlayHubCard title="Mon bracket" href="/play/bracket" lines={bracketLines(data.bracket)} />
        <PlayHubCard
          title="Paris"
          href="/play/bets"
          badge={data.bets.draftCount + data.bets.submittedCount}
          lines={betsLines(data.bets)}
        />
      </div>
    </div>
  );
}
