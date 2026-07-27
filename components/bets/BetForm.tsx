"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeamLogo } from "@/components/ui/TeamLogo";
import {
  BET_CATEGORY_OPTIONS,
  BET_DIFFICULTY_LABELS,
  DEFAULT_BET_CATEGORY,
  DEFAULT_BET_DIFFICULTY,
  MATCH_SLOT_CAP,
} from "@/lib/labels/bets";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";
import type { BetFormBootstrap, EditableBet, MatchOption, NewBetContext, SeriesOption } from "@/lib/queries/bets";
import { saveDraftBet, submitBet, withdrawBet } from "@/lib/actions/bets";
import styles from "./BetForm.module.css";

// SEULE feuille "use client" de l'écran Nouveau pari (§1.1) : porte la saisie
// et appelle les server actions. Les sélecteurs série/match restent internes
// (au choix de l'implémentation, §1.1) — logos via TeamLogo (§13), pas de
// <select> natif pour eux (pas de rendu d'image dans une <option>).
//
// Le cadrage (dispos, quotas) est déjà calculé SERVEUR (lib/queries/bets.ts,
// props ci-dessous) : ce composant ne fait qu'afficher ces booléens et
// déclencher les server actions, qui recalculent tout à l'écriture (brief §4).

export type BetFormProps =
  | { mode: "CREATE"; bootstrap: BetFormBootstrap; context: NewBetContext; shortcutClosed: boolean }
  | { mode: "EDIT"; bootstrap: BetFormBootstrap; bet: EditableBet };

type Target = { scope: "SERIES" | "MATCH"; seriesId: string | null; matchId: string | null };

function resolveInitialTarget(props: BetFormProps): Target {
  if (props.mode === "EDIT") {
    return { scope: props.bet.scope, seriesId: props.bet.seriesId, matchId: props.bet.matchId };
  }
  if (props.context.mode === "FROM_MATCH") {
    const targetMatchId = props.context.matchId;
    const series = props.bootstrap.seriesOptions.find((s) => s.matchOptions.some((m) => m.matchId === targetMatchId));
    return { scope: "MATCH", seriesId: series?.seriesId ?? null, matchId: targetMatchId };
  }
  return { scope: "MATCH", seriesId: null, matchId: null };
}

function isSeriesSelectable(series: SeriesOption, scope: "SERIES" | "MATCH"): boolean {
  if (scope === "SERIES") return series.seriesBetOpen && !series.seriesSlotTaken;
  return series.matchOptions.some((m) => m.matchBetOpen && !m.matchSlotTaken);
}

export function BetForm(props: BetFormProps) {
  const router = useRouter();
  const isEdit = props.mode === "EDIT";
  const isCup = props.bootstrap.competition.kind === "NBA_CUP";
  const initial = useMemo(() => resolveInitialTarget(props), [props]);

  const [scope, setScope] = useState<"SERIES" | "MATCH">(isCup ? "MATCH" : initial.scope);
  const [seriesId, setSeriesId] = useState<string | null>(initial.seriesId);
  const [matchId, setMatchId] = useState<string | null>(initial.matchId);
  const [description, setDescription] = useState(isEdit ? props.bet.description : "");
  const [category, setCategory] = useState<BetCategory>(isEdit ? props.bet.proposedCategory : DEFAULT_BET_CATEGORY);
  const [difficulty, setDifficulty] = useState<BetDifficulty>(
    isEdit ? props.bet.proposedDifficulty : DEFAULT_BET_DIFFICULTY
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const seriesById = useMemo(
    () => new Map(props.bootstrap.seriesOptions.map((s) => [s.seriesId, s])),
    [props.bootstrap.seriesOptions]
  );
  const selectedSeries = seriesId ? seriesById.get(seriesId) ?? null : null;
  const capReached =
    scope === "MATCH" && !isCup && selectedSeries !== null && selectedSeries.matchSlotsUsed >= MATCH_SLOT_CAP;

  function handleScopeChange(next: "SERIES" | "MATCH") {
    setScope(next);
    setMatchId(null);
  }

  function handleSeriesSelect(series: SeriesOption) {
    setSeriesId(series.seriesId);
    setMatchId(null);
  }

  function targetPayload() {
    return {
      betId: isEdit ? props.bet.betId : undefined,
      scope,
      seriesId: seriesId as string,
      matchId: scope === "MATCH" ? matchId : null,
      description,
      category,
      difficulty,
    };
  }

  function handleSaveDraft() {
    setError(null);
    startTransition(async () => {
      const result = await saveDraftBet(targetPayload());
      if (result.success) router.push("/play");
      else setError(result.error);
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitBet(targetPayload());
      if (result.success) router.push("/play");
      else setError(result.error);
    });
  }

  function handleWithdraw() {
    if (!isEdit) return;
    setError(null);
    startTransition(async () => {
      const result = await withdrawBet(props.bet.betId);
      if (result.success) router.push("/play");
      else setError(result.error);
    });
  }

  const hasTarget = scope === "SERIES" ? seriesId !== null : seriesId !== null && matchId !== null;
  const descriptionEmpty = description.trim().length === 0;
  const isSubmittedBet = isEdit && props.bet.status === "SUBMITTED";

  return (
    <div className={styles.form}>
      {props.mode === "CREATE" && props.shortcutClosed && (
        <p className={styles.notice}>Ce match n&rsquo;est plus ouvert au pari.</p>
      )}

      {!isEdit && !isCup && (
        <div className={styles.scopeToggle} role="group" aria-label="Portée du pari">
          <button
            type="button"
            className={scope === "SERIES" ? `${styles.scopeButton} ${styles.scopeButtonActive}` : styles.scopeButton}
            aria-pressed={scope === "SERIES"}
            onClick={() => handleScopeChange("SERIES")}
          >
            Série
          </button>
          <button
            type="button"
            className={scope === "MATCH" ? `${styles.scopeButton} ${styles.scopeButtonActive}` : styles.scopeButton}
            aria-pressed={scope === "MATCH"}
            onClick={() => handleScopeChange("MATCH")}
          >
            Match
          </button>
        </div>
      )}

      {isEdit ? (
        <p className={styles.frozenTarget}>
          {selectedSeries?.label ?? ""}
          {scope === "MATCH" && matchId
            ? ` — ${selectedSeries?.matchOptions.find((m) => m.matchId === matchId)?.label ?? ""}`
            : ""}
        </p>
      ) : (
        <>
          {props.bootstrap.seriesOptions.length === 0 ? (
            <p className={styles.notice}>Aucune série n&rsquo;est ouverte au pari pour l&rsquo;instant.</p>
          ) : (
            <SeriesPicker
              seriesOptions={props.bootstrap.seriesOptions}
              scope={scope}
              selectedSeriesId={seriesId}
              onSelect={handleSeriesSelect}
            />
          )}

          {scope === "MATCH" && selectedSeries && (
            <>
              {capReached ? (
                <p className={styles.notice}>Tu as déjà 3 paris match sur cette série.</p>
              ) : selectedSeries.matchOptions.every((m) => !m.matchBetOpen) ? (
                <p className={styles.notice}>Aucun match identifié et à venir dans cette série.</p>
              ) : (
                <MatchPicker
                  matchOptions={selectedSeries.matchOptions}
                  selectedMatchId={matchId}
                  onSelect={(m) => setMatchId(m.matchId)}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Contenu du pari — fixé en bas du viewport (demandé 27/07/2026) :
          toujours visible pendant que le sélecteur série/match ci-dessus
          défile, plutôt qu'à atteindre en scrollant en bas de page. */}
      <div className={styles.stickyContent}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Énoncé</span>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex. Match 2 : Jaylen Brown marque 50+"
            rows={3}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Catégorie</span>
          <select
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value as BetCategory)}
          >
            {BET_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Difficulté</span>
          <select
            className={styles.select}
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value) as BetDifficulty)}
          >
            {([1, 2, 3, 4, 5] as BetDifficulty[]).map((level) => (
              <option key={level} value={level}>
                {level} — {BET_DIFFICULTY_LABELS[level]}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          {!isSubmittedBet && (
            <button
              type="button"
              className={styles.secondary}
              onClick={handleSaveDraft}
              disabled={isPending || !hasTarget}
            >
              Enregistrer le brouillon
            </button>
          )}
          <button
            type="button"
            className={styles.primary}
            onClick={handleSubmit}
            disabled={isPending || !hasTarget || descriptionEmpty}
          >
            {isSubmittedBet ? "Soumettre les modifications" : "Soumettre à validation"}
          </button>
          {isSubmittedBet && (
            <button type="button" className={styles.withdraw} onClick={handleWithdraw} disabled={isPending}>
              Revenir en brouillon
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type SeriesPickerProps = {
  seriesOptions: SeriesOption[];
  scope: "SERIES" | "MATCH";
  selectedSeriesId: string | null;
  onSelect: (series: SeriesOption) => void;
};

function SeriesPicker({ seriesOptions, scope, selectedSeriesId, onSelect }: SeriesPickerProps) {
  return (
    <div className={styles.pickerList} role="radiogroup" aria-label="Série">
      {seriesOptions.map((series) => {
        const selectable = isSeriesSelectable(series, scope);
        const isSelected = series.seriesId === selectedSeriesId;
        const reason =
          scope === "SERIES" && series.seriesSlotTaken
            ? "Déjà pris"
            : scope === "SERIES" && !series.seriesBetOpen
              ? "Fermée"
              : scope === "MATCH" && !selectable
                ? "Aucun match dispo"
                : null;
        return (
          <button
            key={series.seriesId}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={isSelected ? `${styles.pickerItem} ${styles.pickerItemSelected}` : styles.pickerItem}
            onClick={() => onSelect(series)}
            disabled={!selectable}
          >
            <span className={styles.pickerLogos}>
              {series.team1Abbr && <TeamLogo abbreviation={series.team1Abbr} alt={series.team1Abbr} size={20} />}
              {series.team2Abbr && <TeamLogo abbreviation={series.team2Abbr} alt={series.team2Abbr} size={20} />}
            </span>
            <span className={styles.pickerLabel}>{series.label}</span>
            {reason && <span className={styles.pickerReason}>{reason}</span>}
          </button>
        );
      })}
    </div>
  );
}

type MatchPickerProps = {
  matchOptions: MatchOption[];
  selectedMatchId: string | null;
  onSelect: (match: MatchOption) => void;
};

function MatchPicker({ matchOptions, selectedMatchId, onSelect }: MatchPickerProps) {
  return (
    <div className={styles.pickerList} role="radiogroup" aria-label="Match">
      {matchOptions.map((match) => {
        const selectable = match.matchBetOpen && !match.matchSlotTaken;
        const isSelected = match.matchId === selectedMatchId;
        const reason = !match.isIdentified
          ? "Date à venir"
          : match.matchSlotTaken
            ? "Déjà pris"
            : !match.matchBetOpen
              ? "Fermé"
              : null;
        return (
          <button
            key={match.matchId}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={isSelected ? `${styles.pickerItem} ${styles.pickerItemSelected}` : styles.pickerItem}
            onClick={() => onSelect(match)}
            disabled={!selectable}
          >
            <span className={styles.pickerLabel}>{match.label}</span>
            {reason && <span className={styles.pickerReason}>{reason}</span>}
          </button>
        );
      })}
    </div>
  );
}
