"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Backdrop } from "@/components/ui/Backdrop";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { shootingLine, type BoxScorePlayer, type BoxScoreSheet, type BoxScoreTeam } from "@/lib/boxScores/schema";
import styles from "./BoxScoreDialog.module.css";

// Popup « Feuille de match » d'un match terminé : un onglet par équipe (dans
// l'ordre de la carte du match, `firstTricode` d'abord), tableau qui défile à
// l'horizontale avec la colonne des joueurs figée. Données statiques lues sur
// le CDN de Supabase (lib/boxScores/schema.ts), chargées par BoxScoreButton.

export type BoxScoreLoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; sheet: BoxScoreSheet };

type Props = {
  subtitle: string;
  /** Équipe du premier onglet : celle affichée en premier sur la carte. */
  firstTricode: string;
  state: BoxScoreLoadState;
  onRetry: () => void;
  onClose: () => void;
};

type Column = {
  key: string;
  label: string;
  value: (s: BoxScorePlayer | BoxScoreTeam["totals"]) => string;
};

const COLUMNS: Column[] = [
  { key: "pts", label: "PTS", value: (s) => String(s.pts) },
  { key: "reb", label: "REB", value: (s) => String(s.reb) },
  { key: "ast", label: "PD", value: (s) => String(s.ast) },
  { key: "stl", label: "INT", value: (s) => String(s.stl) },
  { key: "blk", label: "CTR", value: (s) => String(s.blk) },
  { key: "tov", label: "BP", value: (s) => String(s.tov) },
  { key: "fg", label: "TIRS", value: (s) => shootingLine(s.fgm, s.fga).ratio },
  { key: "tp", label: "3PTS", value: (s) => shootingLine(s.tpm, s.tpa).ratio },
  { key: "ft", label: "LF", value: (s) => shootingLine(s.ftm, s.fta).ratio },
  { key: "pf", label: "F", value: (s) => String(s.pf) },
];

const LEGEND: { abbr: string; meaning: string }[] = [
  { abbr: "MIN", meaning: "minutes jouées" },
  { abbr: "PTS", meaning: "points" },
  { abbr: "REB", meaning: "rebonds" },
  { abbr: "PD", meaning: "passes décisives" },
  { abbr: "INT", meaning: "interceptions" },
  { abbr: "CTR", meaning: "contres" },
  { abbr: "BP", meaning: "balles perdues" },
  { abbr: "TIRS", meaning: "tirs réussis / tentés" },
  { abbr: "3PTS", meaning: "tirs à 3 points réussis / tentés" },
  { abbr: "LF", meaning: "lancers francs réussis / tentés" },
  { abbr: "F", meaning: "fautes personnelles" },
  { abbr: "+/-", meaning: "écart de points pendant que le joueur était sur le terrain" },
];

function formatPlusMinus(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function TeamTable({ team }: { team: BoxScoreTeam }) {
  const starters = team.players.filter((p) => p.starter);
  const bench = team.players.filter((p) => !p.starter);
  const fg = shootingLine(team.totals.fgm, team.totals.fga);
  const tp = shootingLine(team.totals.tpm, team.totals.tpa);
  const ft = shootingLine(team.totals.ftm, team.totals.fta);

  const row = (p: BoxScorePlayer) => (
    <tr key={p.id}>
      <th scope="row" className={styles.playerCell}>
        <span className={styles.playerName}>{p.short}</span>
        {p.pos && <span className={styles.position}>{p.pos}</span>}
      </th>
      <td>{p.min}</td>
      {COLUMNS.map((c) => (
        <td key={c.key} className={c.key === "pts" ? styles.points : undefined}>
          {c.value(p)}
        </td>
      ))}
      <td>{formatPlusMinus(p.pm)}</td>
    </tr>
  );

  const groupHeader = (label: string) => (
    <tr className={styles.groupRow}>
      <th scope="rowgroup" colSpan={COLUMNS.length + 3} className={styles.groupCell}>
        <span className={styles.groupLabel}>{label}</span>
      </th>
    </tr>
  );

  return (
    <>
      {/* Zone qui défile à l'horizontale : focusable pour pouvoir la faire défiler au
          clavier (WCAG 2.1.1), d'où le tabIndex sur un élément non interactif. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={`Statistiques ${team.city} ${team.name}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.playerCell}>
                Joueur
              </th>
              <th scope="col">MIN</th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col">
                  {c.label}
                </th>
              ))}
              <th scope="col">+/-</th>
            </tr>
          </thead>
          <tbody>
            {groupHeader("Cinq de départ")}
            {starters.map(row)}
          </tbody>
          {bench.length > 0 && (
            <tbody>
              {groupHeader("Banc")}
              {bench.map(row)}
            </tbody>
          )}
          <tfoot>
            <tr>
              <th scope="row" className={styles.playerCell}>
                Équipe
              </th>
              <td />
              {COLUMNS.map((c) => (
                <td key={c.key} className={c.key === "pts" ? styles.points : undefined}>
                  {c.value(team.totals)}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className={styles.percentages}>
        Adresse : tirs {fg.pct ?? "–"} · 3 pts {tp.pct ?? "–"} · LF {ft.pct ?? "–"}
      </p>

      {team.dnp.length > 0 && (
        <p className={styles.dnp}>
          <span className={styles.dnpLabel}>N’ont pas joué :</span> {team.dnp.map((d) => d.name).join(", ")}
        </p>
      )}
    </>
  );
}

export function BoxScoreDialog({ subtitle, firstTricode, state, onRetry, onClose }: Props) {
  const uid = useId();
  const [teamIndex, setTeamIndex] = useState<0 | 1>(0);

  // La page derrière ne défile plus tant que la popup est ouverte.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const sheetTeams = state.status === "ready" ? state.sheet.teams : null;
  const teams =
    sheetTeams && sheetTeams[1].tricode === firstTricode ? [sheetTeams[1], sheetTeams[0]] : sheetTeams;

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = teamIndex === 0 ? 1 : 0;
    setTeamIndex(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  }

  return createPortal(
    <Backdrop className={styles.backdrop} onClose={onClose}>
      <FocusTrap
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        onClose={onClose}
      >
        <div className={styles.header}>
          <div className={styles.headings}>
            <p id={`${uid}-title`} className={styles.title}>
              Feuille de match
            </p>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>
            <span aria-hidden="true">×</span> Fermer
          </button>
        </div>

        {teams && (
          <div className={styles.tabs} role="tablist" aria-label="Équipe">
            {teams.map((team, i) => (
              <button
                key={team.tricode}
                id={`${uid}-tab-${i}`}
                type="button"
                role="tab"
                aria-selected={teamIndex === i}
                aria-controls={`${uid}-panel`}
                tabIndex={teamIndex === i ? 0 : -1}
                className={teamIndex === i ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                onClick={() => setTeamIndex(i as 0 | 1)}
                onKeyDown={onTabKeyDown}
              >
                <span>{team.name || team.tricode}</span>
                <span className={styles.tabScore}>{team.score}</span>
              </button>
            ))}
          </div>
        )}

        <div
          id={`${uid}-panel`}
          role={teams ? "tabpanel" : undefined}
          aria-labelledby={teams ? `${uid}-tab-${teamIndex}` : undefined}
          className={styles.panel}
        >
          {state.status === "loading" && <p role="status">Chargement…</p>}
          {state.status === "missing" && (
            <p>
              La feuille de match n’est pas encore disponible. Elle arrive en général quelques minutes après la fin du
              match.
            </p>
          )}
          {state.status === "error" && (
            <div role="alert" className={styles.message}>
              <p>Impossible de charger la feuille de match, réessaie plus tard.</p>
              <button type="button" className={styles.retry} onClick={onRetry}>
                Réessayer
              </button>
            </div>
          )}
          {teams && (
            <>
              <TeamTable team={teams[teamIndex]} />
              <details className={styles.legend}>
                <summary>Que veulent dire les colonnes ?</summary>
                <dl>
                  {LEGEND.map((l) => (
                    <div key={l.abbr} className={styles.legendItem}>
                      <dt>{l.abbr}</dt>
                      <dd>{l.meaning}</dd>
                    </div>
                  ))}
                </dl>
              </details>
              {state.status === "ready" && (
                <p className={styles.source}>Source : NBA · mis à jour le {formatUpdatedAt(state.sheet.updatedAt)}</p>
              )}
            </>
          )}
        </div>
      </FocusTrap>
    </Backdrop>,
    document.body
  );
}
