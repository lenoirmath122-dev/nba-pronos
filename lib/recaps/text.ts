import type { CompetitionRecap, PersonalRecap, RecapPlayer } from "./build";

// Textes des récaps (p3-10) : notification push et petites formules
// partagées avec l'écran. Module pur.

export function ordinal(rank: number): string {
  return rank === 1 ? "1er" : `${rank}e`;
}

export function pointsLabel(points: number): string {
  return `${points} pt${points > 1 ? "s" : ""}`;
}

/** « ▲2 », « ▼1 », ou rien si le rang n'a pas bougé / est inconnu. */
export function rankDeltaLabel(delta: number | null): string {
  if (delta === null || delta === 0) return "";
  return delta > 0 ? `▲${delta}` : `▼${-delta}`;
}

export function joinPseudos(players: { pseudo: string }[]): string {
  const names = players.map((player) => player.pseudo);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

function rankSentence(me: PersonalRecap): string | null {
  if (me.rank === null) return null;
  const place = ordinal(me.rank);
  if (me.rankDelta === null || me.rankDelta === 0) return `toujours ${place}`;
  return me.rankDelta > 0 ? `tu passes ${place} (▲${me.rankDelta})` : `tu recules ${place} (▼${-me.rankDelta})`;
}

/** « 1h », « 2h30 » (Europe/Paris). */
export function kickoffHour(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}h${minute === "00" ? "" : minute}`;
}

export type PushText = { title: string; body: string };

/** Push journalier, ou null s'il n'y a rien à dire à ce joueur (règle
 *  cadrée avec l'utilisateur : jamais de push vide). */
export function dailyPushText(
  me: PersonalRecap | null,
  todo: { matchesToPredict: number; firstKickoffIso: string | null }
): PushText | null {
  const parts: string[] = [];
  if (me?.played) {
    const rank = rankSentence(me);
    parts.push(`Cette nuit : ${me.pointsGained > 0 ? `+${pointsLabel(me.pointsGained)}` : "0 pt"}${rank ? `, ${rank}` : ""}.`);
  }
  if (todo.matchesToPredict > 0) {
    const count = todo.matchesToPredict;
    const kickoff = todo.firstKickoffIso ? `, premier coup d'envoi à ${kickoffHour(todo.firstKickoffIso)}` : "";
    parts.push(`${count} match${count > 1 ? "s" : ""} à pronostiquer${kickoff}.`);
  }
  if (parts.length === 0) return null;
  return { title: "Ton récap du matin", body: parts.join(" ") };
}

function winnersSentence(top: RecapPlayer[], userId: string): string | null {
  if (top.length === 0) return null;
  const others = top.filter((player) => player.userId !== userId);
  const points = `+${pointsLabel(top[0].value)}`;
  if (others.length < top.length) {
    return others.length === 0
      ? `Tu remportes la semaine avec ${points} !`
      : `Tu remportes la semaine à égalité avec ${joinPseudos(others)} (${points}) !`;
  }
  return `${joinPseudos(top)} remporte${top.length > 1 ? "nt" : ""} la semaine (${points}).`;
}

/** Push hebdo : envoyé à tous les joueurs en push, y compris ceux qui n'ont
 *  pas joué de la semaine (relance). Null si la semaine est restée vide. */
export function weeklyPushText(recap: CompetitionRecap, me: PersonalRecap | null, userId: string): PushText | null {
  if (!recap.hasActivity) return null;
  const parts: string[] = [];
  if (me?.played) {
    const rank = rankSentence(me);
    parts.push(`${me.pointsGained > 0 ? `+${pointsLabel(me.pointsGained)}` : "0 pt"} cette semaine${rank ? `, ${rank}` : ""}.`);
  }
  const winners = winnersSentence(recap.topScorers, userId);
  if (winners) parts.push(winners);
  if (!me?.played) parts.push("À toi de jouer cette semaine !");
  return { title: "Ta semaine", body: parts.join(" ") };
}

/** « 2 bons vainqueurs dont 1 écart exact · 1 pari gagné, 1 perdu ». */
export function personalDetail(me: PersonalRecap): string {
  const parts: string[] = [];
  if (me.correctWinners > 0) {
    const winners = `${me.correctWinners} bon${me.correctWinners > 1 ? "s" : ""} vainqueur${me.correctWinners > 1 ? "s" : ""}`;
    const exact =
      me.exactMargins > 0 ? ` dont ${me.exactMargins} écart${me.exactMargins > 1 ? "s" : ""} exact${me.exactMargins > 1 ? "s" : ""}` : "";
    parts.push(winners + exact);
  }
  const bets = me.betsWon + me.betsLost;
  if (bets > 0) {
    if (me.betsLost === 0) parts.push(`${me.betsWon} pari${me.betsWon > 1 ? "s" : ""} gagné${me.betsWon > 1 ? "s" : ""}`);
    else if (me.betsWon === 0) parts.push(`${me.betsLost} pari${me.betsLost > 1 ? "s" : ""} perdu${me.betsLost > 1 ? "s" : ""}`);
    else parts.push(`${me.betsWon} pari${me.betsWon > 1 ? "s" : ""} gagné${me.betsWon > 1 ? "s" : ""}, ${me.betsLost} perdu${me.betsLost > 1 ? "s" : ""}`);
  }
  return parts.join(" · ");
}

/** Proba d'un pari en pourcentage lisible (« 4 % », « < 1 % »). */
export function probaLabel(proba: number): string {
  const percent = proba * 100;
  return percent < 1 ? "< 1 %" : `${Math.round(percent)} %`;
}
