"use client";

import { useState } from "react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { parisDateTimeLabel } from "@/lib/dates/paris";
import {
  FORM_LABEL_TEXT,
  STAT_LEGEND,
  abbreviateName,
  formatConferenceRank,
  formatDecimal,
  formatPercent,
  formatSignedDiff,
  formatStreak,
} from "@/lib/teamInsights/display";
import type { PlayerSeasonLine, TeamInsights } from "@/lib/teamInsights/types";
import { FormStrokes } from "./FormStrokes";
import styles from "./TeamDetailsTabs.module.css";

// Les trois onglets de la popup « Stats des équipes » (cadrage refonte prono).

const EARLY_NOTE = "Début de saison : peu de matchs joués, ces chiffres bougent vite. Classement indicatif.";

// ---------------------------------------------------------------------------
// Sélecteur d'équipe partagé Effectif / Joueurs à surveiller
// ---------------------------------------------------------------------------

export function TeamSwitch({
  teams,
  index,
  onChange,
}: {
  teams: TeamInsights[];
  index: 0 | 1;
  onChange: (i: 0 | 1) => void;
}) {
  return (
    <div className={styles.switch} role="group" aria-label="Équipe">
      {teams.map((team, i) => (
        <button
          key={team.teamId}
          type="button"
          aria-pressed={index === i}
          className={index === i ? `${styles.switchBtn} ${styles.switchBtnActive}` : styles.switchBtn}
          onClick={() => onChange(i as 0 | 1)}
        >
          {team.tricode} · {team.roster.length} joueurs
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Face à face
// ---------------------------------------------------------------------------

function FormBadge({ team }: { team: TeamInsights }) {
  if (!team.form) return <span>–</span>;
  const hot = team.form.label === "EN_FEU";
  return (
    <span className={hot ? `${styles.badge} ${styles.badgeHot}` : styles.badge}>{FORM_LABEL_TEXT[team.form.label]}</span>
  );
}

export function FaceToFaceTab({ teams }: { teams: TeamInsights[] }) {
  const [a, b] = teams;
  if (!a || !b) return null;
  const rows: { label: string; cell: (t: TeamInsights) => React.ReactNode }[] = [
    { label: "Forme", cell: (t) => <FormBadge team={t} /> },
    { label: "5 derniers", cell: (t) => (t.form ? <FormStrokes last5={t.form.last5} /> : "–") },
    { label: "Bilan", cell: (t) => (t.form ? `${t.form.record.wins}-${t.form.record.losses}` : "–") },
    { label: "Classement", cell: (t) => (t.form ? formatConferenceRank(t.form.conferenceRank, t.form.conference) : "–") },
    { label: "Écart moyen (5 derniers)", cell: (t) => (t.form ? formatSignedDiff(t.form.pointDiffLast5) : "–") },
    { label: "Série en cours", cell: (t) => (t.form ? formatStreak(t.form.streak) : "–") },
    { label: "À domicile", cell: (t) => (t.home ? `${t.home.wins}-${t.home.losses}` : "–") },
    { label: "À l'extérieur", cell: (t) => (t.away ? `${t.away.wins}-${t.away.losses}` : "–") },
  ];
  return (
    <>
      <div className={styles.versus}>
        <div className={styles.versusRow}>
          <div className={`${styles.versusCell} ${styles.versusHead}`}>
            <TeamLogo abbreviation={a.tricode} alt="" size={28} />
            <span>{a.tricode}</span>
          </div>
          <div className={styles.versusLabel} />
          <div className={`${styles.versusCell} ${styles.versusHead}`}>
            <span>{b.tricode}</span>
            <TeamLogo abbreviation={b.tricode} alt="" size={28} />
          </div>
        </div>
        {rows.map((row) => (
          <div key={row.label} className={styles.versusRow}>
            <div className={styles.versusCell}>{row.cell(a)}</div>
            <div className={styles.versusLabel}>{row.label}</div>
            <div className={styles.versusCell}>{row.cell(b)}</div>
          </div>
        ))}
      </div>
      {(a.earlySeason || b.earlySeason) && <p className={styles.note}>{EARLY_NOTE}</p>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Effectif
// ---------------------------------------------------------------------------

export type SortKey = "pts" | "reb" | "ast" | "fg3m" | "fgPct" | "minutes" | "gamesPlayed";

const COLUMNS: { key: SortKey; label: string; value: (p: PlayerSeasonLine) => string }[] = [
  { key: "pts", label: "PTS", value: (p) => formatDecimal(p.pts) },
  { key: "reb", label: "REB", value: (p) => formatDecimal(p.reb) },
  { key: "ast", label: "PD", value: (p) => formatDecimal(p.ast) },
  { key: "fg3m", label: "3PTS", value: (p) => formatDecimal(p.fg3m) },
  { key: "fgPct", label: "% tir", value: (p) => formatPercent(p.fgPct) },
  { key: "minutes", label: "MIN", value: (p) => formatDecimal(p.minutes) },
  { key: "gamesPlayed", label: "M", value: (p) => String(p.gamesPlayed) },
];

/** Décroissant ; une valeur absente (null) passe en dernier. */
export function sortRoster(players: PlayerSeasonLine[], key: SortKey): PlayerSeasonLine[] {
  return [...players].sort((x, y) => {
    const vx = x[key];
    const vy = y[key];
    if (vx === null && vy === null) return 0;
    if (vx === null) return 1;
    if (vy === null) return -1;
    return vy - vx;
  });
}

export function RosterTab({ team, updatedAt }: { team: TeamInsights; updatedAt: string | null }) {
  const [sortKey, setSortKey] = useState<SortKey>("pts");
  const [legendOpen, setLegendOpen] = useState(false);
  const players = sortRoster(team.roster, sortKey);
  return (
    <>
      <p className={styles.help}>Moyennes par match. Touche une colonne pour trier.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={`${styles.th} ${styles.stickyCol}`}>
                Joueur
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`${styles.th} ${styles.num}${sortKey === c.key ? ` ${styles.thActive}` : ""}`}
                  aria-sort={sortKey === c.key ? "descending" : "none"}
                >
                  <button type="button" className={styles.sortBtn} onClick={() => setSortKey(c.key)}>
                    {c.label}
                    {sortKey === c.key ? <span aria-hidden="true"> ↓</span> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.playerId}>
                <th scope="row" className={`${styles.stickyCol} ${styles.player}`}>
                  {abbreviateName(p.name)}
                  {p.isUsualStarter ? (
                    <span className={styles.starter} title="Titulaire">
                      T
                    </span>
                  ) : null}
                </th>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={`${styles.num}${sortKey === c.key ? ` ${styles.tdActive}` : ""}`}>
                    {c.value(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.footer}>
        <div className={styles.footerRow}>
          <span className={styles.note}>{updatedAt ? `Mis à jour le ${parisDateTimeLabel(updatedAt)}` : ""}</span>
          <button
            type="button"
            className={styles.legendBtn}
            aria-expanded={legendOpen}
            onClick={() => setLegendOpen((o) => !o)}
          >
            Légende
          </button>
        </div>
        {legendOpen && (
          <p className={styles.legend}>{STAT_LEGEND.map((l) => `${l.abbr} ${l.meaning}`).join(" · ")}</p>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Joueurs à surveiller
// ---------------------------------------------------------------------------

export function KeyPlayersTab({ team }: { team: TeamInsights }) {
  if (team.keyPlayers.length === 0) return <p>Pas encore de joueur à surveiller.</p>;
  return (
    <>
      <ul className={styles.cards}>
        {team.keyPlayers.map((p) => (
          <li key={p.playerId} className={styles.card}>
            <p className={styles.cardName}>{p.name}</p>
            <p className={styles.cardMeta}>
              {[
                p.isUsualStarter ? "Titulaire" : "Remplaçant",
                `${p.gamesPlayed} ${p.gamesPlayed > 1 ? "matchs" : "match"}`,
                `${formatDecimal(p.minutes)} min`,
                p.fgPct !== null ? `${formatPercent(p.fgPct)} au tir` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <dl className={styles.tiles}>
              {(
                [
                  ["PTS", p.pts],
                  ["REB", p.reb],
                  ["PD", p.ast],
                  ["3PTS", p.fg3m],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className={styles.tile}>
                  <dd>{formatDecimal(value)}</dd>
                  <dt>{label}</dt>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <p className={styles.note}>Moyennes par match en saison régulière.</p>
    </>
  );
}
