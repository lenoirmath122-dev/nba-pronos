"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useValidatedDialog } from "@/components/ui/ValidatedDialog";
import { RuleHelpButton } from "@/components/regles/RuleHelpButton";
import { BetWritingTips } from "@/components/regles/BetWritingTips";
import { MATCH_SLOT_CAP } from "@/lib/labels/bets";
import type { BetFormBootstrap, EditableBet, MatchOption, NewBetContext, SeriesOption } from "@/lib/queries/bets";
import { saveDraftBet, submitBet, withdrawBet } from "@/lib/actions/bets";
import { PlayerNotInMatchConfirm } from "./PlayerNotInMatchConfirm";
import { validatedBetDialog, PENDING_ADMIN_TOAST } from "./validatedBetDialog";
import styles from "./BetForm.module.css";
import { allowsSeriesBets } from "@/lib/competitions/types";
import { requestBadgeCheck } from "@/lib/badges/checkRequest";

// SEULE feuille "use client" de l'écran Nouveau pari (§1.1) : porte la saisie
// et appelle les server actions. Les sélecteurs série/match restent internes
// (au choix de l'implémentation, §1.1) — logos via TeamLogo (§13), pas de
// <select> natif pour eux (pas de rendu d'image dans une <option>).
//
// Le cadrage (dispos, quotas) est déjà calculé SERVEUR (lib/queries/bets.ts,
// props ci-dessous) : ce composant ne fait qu'afficher ces booléens et
// déclencher les server actions, qui recalculent tout à l'écriture (brief §4).

export type BetFormProps =
  | { mode: "CREATE"; bootstrap: BetFormBootstrap; context: NewBetContext; shortcutClosed: "MATCH" | "SERIES" | null }
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
  if (props.context.mode === "FROM_SERIES") {
    return { scope: "SERIES", seriesId: props.context.seriesId, matchId: null };
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
  const isCup = !allowsSeriesBets(props.bootstrap.competition.kind);
  const initial = useMemo(() => resolveInitialTarget(props), [props]);

  const [scope, setScope] = useState<"SERIES" | "MATCH">(isCup ? "MATCH" : initial.scope);
  const [seriesId, setSeriesId] = useState<string | null>(initial.seriesId);
  const [matchId, setMatchId] = useState<string | null>(initial.matchId);
  const [description, setDescription] = useState(isEdit ? props.bet.description : "");
  const [error, setError] = useState<string | null>(null);
  // p3-14 : joueur absent du match selon l'IA, pari repassé en brouillon en
  // attente de confirmation -- `draftBetId` évite de recréer un pari aux
  // envois suivants.
  const [notInMatch, setNotInMatch] = useState<string | null>(null);
  const [draftBetId, setDraftBetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Toast posé AVANT router.back() (p3-5) : il vit dans la coquille de la
  // zone joueur, qui survit à la fermeture de cette popup.
  const showToast = useToast();
  const showValidated = useValidatedDialog();
  // Panneau de saisie replié par défaut derrière une barre compacte, dépliée
  // seulement au tap (demandé par l'utilisateur 04/08/2026 : le panneau
  // complet, une fois affiché, prenait trop de place et cachait le
  // sélecteur — impossible de choisir facilement un AUTRE match/série sans
  // le refermer d'abord). Toujours déplié en édition (pas de sélecteur à
  // dégager, rien à cacher).
  const [isExpanded, setIsExpanded] = useState(isEdit);
  const descriptionId = useId();

  const seriesById = useMemo(
    () => new Map(props.bootstrap.seriesOptions.map((s) => [s.seriesId, s])),
    [props.bootstrap.seriesOptions]
  );
  // Une série dont les 2 équipes ne sont pas encore connues ne peut rien dire
  // de concret une fois choisie (récapitulatif réduit au nom du tour, ex.
  // "Finales de conférence" — les 2 conférences y sont indiscernables l'une
  // de l'autre). Retirée de la liste (15/08/2026, demandé par l'utilisateur)
  // — jamais du bootstrap serveur, qui reste correct pour TOUTES les séries
  // (quotas), seulement de ce qui est proposé au clic ici.
  const knownSeriesOptions = useMemo(
    () => props.bootstrap.seriesOptions.filter((s) => s.team1Abbr !== null && s.team2Abbr !== null),
    [props.bootstrap.seriesOptions]
  );
  const selectedSeries = seriesId ? seriesById.get(seriesId) ?? null : null;
  const capReached =
    scope === "MATCH" && !isCup && selectedSeries !== null && selectedSeries.matchSlotsUsed >= MATCH_SLOT_CAP;

  function handleScopeChange(next: "SERIES" | "MATCH") {
    setNotInMatch(null);
    setScope(next);
    setMatchId(null);
    setIsExpanded(false);
  }

  function handleSeriesSelect(series: SeriesOption) {
    setNotInMatch(null);
    setSeriesId(series.seriesId);
    setMatchId(null);
    setIsExpanded(false);
  }

  function handleMatchSelect(match: MatchOption) {
    setNotInMatch(null);
    setMatchId(match.matchId);
    setIsExpanded(false);
  }

  function targetPayload() {
    return {
      betId: isEdit ? props.bet.betId : (draftBetId ?? undefined),
      scope,
      seriesId: seriesId as string,
      matchId: scope === "MATCH" ? matchId : null,
      description,
    };
  }

  // router.back() (17/08/2026, passage en pop-up) plutôt qu'une redirection
  // fixe vers /play : referme le dialogue et ramène exactement à l'écran
  // d'origine (Mes paris, Bracket, Matchs — tous les raccourcis vers ce
  // formulaire restent de simples navigations, voir BetFormModal.tsx).
  function handleSaveDraft() {
    setError(null);
    startTransition(async () => {
      const result = await saveDraftBet(targetPayload());
      if (result.success) {
        showToast("Brouillon enregistré");
        router.back();
      } else {
        setError(result.error);
      }
    });
  }

  function handleSubmit(confirmPlayerNotInMatch = false) {
    setError(null);
    startTransition(async () => {
      const payload = targetPayload();
      const result = await submitBet({ ...payload, confirmPlayerNotInMatch });
      if (result.success && "playerNotInMatch" in result) {
        setDraftBetId(result.betId);
        setNotInMatch(result.playerNotInMatch);
        return;
      }
      setNotInMatch(null);
      if (result.success) {
        requestBadgeCheck();
        // Validé par l'IA (file admin sautée) : popup « Pari validé : x % de
        // chance pour x pts à gagner » ; sinon un admin le traite, le toast suffit.
        if (result.outcome === "VALIDATED") showValidated(validatedBetDialog(payload.description, result.probaPct, result.points));
        else showToast(PENDING_ADMIN_TOAST);
        router.back();
      } else {
        setError(result.error);
      }
    });
  }

  function handleWithdraw() {
    if (!isEdit) return;
    setError(null);
    startTransition(async () => {
      const result = await withdrawBet(props.bet.betId);
      if (result.success) {
        showToast("Pari repassé en brouillon");
        router.back();
      } else {
        setError(result.error);
      }
    });
  }

  const hasTarget = scope === "SERIES" ? seriesId !== null : seriesId !== null && matchId !== null;
  const descriptionEmpty = description.trim().length === 0;
  const isSubmittedBet = isEdit && props.bet.status === "SUBMITTED";
  const showFullPanel = hasTarget && isExpanded;
  const targetLabel = hasTarget
    ? scope === "MATCH" && matchId
      ? `${selectedSeries?.label ?? ""} — ${selectedSeries?.matchOptions.find((m) => m.matchId === matchId)?.label ?? ""}`
      : (selectedSeries?.label ?? "")
    : "";

  return (
    <div className={styles.form}>
      {props.mode === "CREATE" && props.shortcutClosed === "MATCH" && (
        <p className={styles.notice}>Ce match n&rsquo;est plus ouvert au pari.</p>
      )}
      {props.mode === "CREATE" && props.shortcutClosed === "SERIES" && (
        <p className={styles.notice}>
          Cette série n&rsquo;est plus ouverte au pari, ou tu as déjà un pari dessus.
        </p>
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
          {knownSeriesOptions.length === 0 ? (
            <p className={styles.notice}>Aucune série n&rsquo;est ouverte au pari pour l&rsquo;instant.</p>
          ) : (
            <SeriesPicker
              key={scope}
              seriesOptions={knownSeriesOptions}
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
                  key={selectedSeries.seriesId}
                  matchOptions={selectedSeries.matchOptions}
                  selectedMatchId={matchId}
                  onSelect={handleMatchSelect}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Barre compacte : cible choisie mais panneau replié (état par défaut
          après un clic sur un match/série, demandé 04/08/2026 — le panneau
          complet cachait trop le sélecteur pour changer d'avis facilement).
          Un tap déplie le panneau complet ci-dessous. */}
      {!isEdit && hasTarget && !isExpanded && (
        <button type="button" className={styles.selectionBar} onClick={() => setIsExpanded(true)}>
          <span className={styles.selectionLabel}>{targetLabel}</span>
          <span className={styles.selectionExpand}>Rédiger le pari</span>
        </button>
      )}

      {/* Contenu du pari — fixé en bas du viewport (demandé 27/07/2026) :
          toujours visible pendant que le sélecteur série/match ci-dessus
          défile, plutôt qu'à atteindre en scrollant en bas de page. N'apparaît
          qu'une fois une cible choisie ET le panneau déplié (`showFullPanel`
          — demandé 04/08/2026, en 2 temps : d'abord masqué tant que rien
          n'est choisi, puis replié derrière la barre compacte ci-dessus une
          fois choisi, pour ne jamais cacher le sélecteur sans action
          explicite de l'utilisateur). */}
      {showFullPanel && (
        <div className={styles.stickyContent}>
          {!isEdit && (
            <div className={styles.stickyHeader}>
              {/* PAS .selectionLabel ici (15/08/2026) : cette classe tronque
                  sur 1 ligne pour la barre compacte, où c'est nécessaire
                  (hauteur fixe) — mais coupait "Match 1 — 16/08 20:00" en
                  plein milieu de la date une fois le panneau déplié, alors
                  que la place ne manque pas ici. */}
              <span className={styles.stickyHeaderLabel}>{targetLabel}</span>
              <button type="button" className={styles.collapseButton} onClick={() => setIsExpanded(false)}>
                Réduire
              </button>
            </div>
          )}

          <div className={styles.field}>
            <div className={styles.fieldLabelRow}>
              <label htmlFor={descriptionId} className={styles.fieldLabel}>
                Énoncé
              </label>
              <RuleHelpButton title="Bien rédiger un pari" label="Aide pour rédiger un pari">
                <BetWritingTips />
              </RuleHelpButton>
            </div>
            <textarea
              id={descriptionId}
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex. Match 2 : Jaylen Brown marque 50+"
              rows={3}
              maxLength={2000}
            />
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          {isPending && (
          <div className={styles.analyzing} role="status" aria-live="polite">
            <Spinner size="md" />
            <div>
              <p className={styles.analyzingTitle}>Analyse de ton pari en cours…</p>
              <p className={styles.analyzingHint}>Calcul de ta probabilité de gagner, quelques secondes.</p>
            </div>
          </div>
          )}

          {notInMatch ? (
            <PlayerNotInMatchConfirm
              playerName={notInMatch}
              isPending={isPending}
              onEdit={() => {
                setNotInMatch(null);
                document.getElementById(descriptionId)?.focus();
              }}
              onConfirm={() => handleSubmit(true)}
            />
          ) : (
            <div className={styles.actions}>
              {!isSubmittedBet && (
                <button type="button" className={styles.secondary} onClick={handleSaveDraft} disabled={isPending}>
                  Enregistrer le brouillon
                </button>
              )}
              <button
                type="button"
                className={styles.primary}
                onClick={() => handleSubmit()}
                disabled={isPending || descriptionEmpty}
              >
                {isPending ? (
                  <span className={styles.primaryPending}>
                    <Spinner size="sm" />
                    Analyse du pari…
                  </span>
                ) : isSubmittedBet ? (
                  "Soumettre les modifications"
                ) : (
                  "Soumettre à validation"
                )}
              </button>
              {isSubmittedBet && (
                <button type="button" className={styles.withdraw} onClick={handleWithdraw} disabled={isPending}>
                  Revenir en brouillon
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type SeriesPickerProps = {
  seriesOptions: SeriesOption[];
  scope: "SERIES" | "MATCH";
  selectedSeriesId: string | null;
  onSelect: (series: SeriesOption) => void;
};

// Repliées par défaut (15/08/2026, demandé par l'utilisateur — la liste
// était dominée par des options indisponibles, il fallait traverser un mur
// de lignes mortes pour trouver la seule pariable). `key={scope}` posé par
// l'appelant : ce composant se remonte à chaque bascule Série/Match, l'état
// "tout afficher" ne doit pas survivre à un changement de portée.
function SeriesPicker({ seriesOptions, scope, selectedSeriesId, onSelect }: SeriesPickerProps) {
  const [showAll, setShowAll] = useState(false);
  const isVisible = (series: SeriesOption) =>
    showAll || isSeriesSelectable(series, scope) || series.seriesId === selectedSeriesId;
  const visible = seriesOptions.filter(isVisible);
  const hiddenCount = seriesOptions.length - visible.length;

  return (
    <div className={styles.pickerList} role="radiogroup" aria-label="Série">
      {visible.map((series) => {
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
              {series.team1Abbr && <TeamLogo abbreviation={series.team1Abbr} alt={series.team1Abbr} size={24} />}
              {series.team2Abbr && <TeamLogo abbreviation={series.team2Abbr} alt={series.team2Abbr} size={24} />}
            </span>
            <span className={styles.pickerLabel}>{series.label}</span>
            {reason && <span className={styles.pickerReason}>{reason}</span>}
          </button>
        );
      })}
      {!showAll && hiddenCount > 0 && (
        <button type="button" className={styles.showAllButton} onClick={() => setShowAll(true)}>
          Voir {hiddenCount} indisponible{hiddenCount > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}

type MatchPickerProps = {
  matchOptions: MatchOption[];
  selectedMatchId: string | null;
  onSelect: (match: MatchOption) => void;
};

// Même repli par défaut que SeriesPicker (voir son commentaire). `key`
// posée par l'appelant sur la série sélectionnée : remontée à chaque
// changement de série, l'état "tout afficher" ne doit pas survivre.
function MatchPicker({ matchOptions, selectedMatchId, onSelect }: MatchPickerProps) {
  const [showAll, setShowAll] = useState(false);
  const isSelectable = (match: MatchOption) => match.matchBetOpen && !match.matchSlotTaken;
  const isVisible = (match: MatchOption) => showAll || isSelectable(match) || match.matchId === selectedMatchId;
  const visible = matchOptions.filter(isVisible);
  const hiddenCount = matchOptions.length - visible.length;

  return (
    <div className={styles.pickerList} role="radiogroup" aria-label="Match">
      {visible.map((match) => {
        const selectable = isSelectable(match);
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
      {!showAll && hiddenCount > 0 && (
        <button type="button" className={styles.showAllButton} onClick={() => setShowAll(true)}>
          Voir {hiddenCount} indisponible{hiddenCount > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
