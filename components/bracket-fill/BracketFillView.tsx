"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { BracketFillData, GuestBracketStructure } from "@/lib/queries/bracket-fill";
import { applyGuestPick, prunePicks, withGuestPicks } from "@/lib/bracketFill/guestDraft";
import { useRequireAuth } from "@/components/auth/AuthGateProvider";
import { FillPosterView } from "./FillPosterView";
import { GuestBracketReplay } from "./GuestBracketReplay";
import { useBracketDraft } from "./useBracketDraft";

type BracketFillViewProps = {
  data: BracketFillData;
  /** Retour d'inscription (`?reprise=bracket`) : enregistrer le brouillon invité. */
  reprise: boolean;
};

// Enveloppe client du remplissage : l'arbre (FillPosterView.tsx) est le SEUL
// rendu depuis le 04/10/2026 (p3-4, retour de l'alpha : « garder seulement
// l'arbre visuel, supprimer la vue en cartes »). L'ancien flux normal
// (onglets par tour + cartes, BracketFillBoard.tsx/RoundTabs.tsx) et la
// bascule usePosterToggle ont été retirés : « Quitter » ramène désormais à
// l'onglet Jouer, d'où part l'entrée Bracket (BracketEntry.tsx).
//
// Bracket NBA Cup en invité (28/11/2026, CHANTIER_BRACKET_INVITE.md) : sans
// compte, les choix vivent dans le navigateur et « Valider » ouvre la modale
// de compte ; au retour, GuestBracketReplay les enregistre (sans valider).
export function BracketFillView({ data, reprise }: BracketFillViewProps) {
  const router = useRouter();
  const onExit = () => router.push("/play");
  if (data.guest && data.competitionId) {
    return (
      <GuestBracketFill data={data} structure={data.guest} competitionId={data.competitionId} onExit={onExit} />
    );
  }
  return (
    <FillPosterView
      data={data}
      onExit={onExit}
      notice={reprise && data.competitionId ? <GuestBracketReplay data={data} competitionId={data.competitionId} /> : null}
    />
  );
}

function GuestBracketFill({
  data,
  structure,
  competitionId,
  onExit,
}: {
  data: BracketFillData;
  structure: GuestBracketStructure;
  competitionId: string;
  onExit: () => void;
}) {
  const requireAuth = useRequireAuth();
  const { picks: rawPicks, write } = useBracketDraft(competitionId);
  // Un brouillon peut dater d'avant un changement de structure : on retire ce qui n'est plus possible.
  const picks = useMemo(
    () => prunePicks(structure.series, rawPicks, data.competitionType),
    [structure.series, rawPicks, data.competitionType]
  );
  const view = useMemo(() => withGuestPicks(data, structure, picks), [data, structure, picks]);

  return (
    <FillPosterView
      data={view}
      onExit={onExit}
      guest={{
        onPick: (seriesId, winnerTeamId) =>
          write(applyGuestPick(structure.series, picks, seriesId, winnerTeamId, data.competitionType)),
        onValidate: () => requireAuth({ type: "bracket", returnUrl: "/play/bracket" }),
      }}
    />
  );
}
