"use client";

import { useImmersiveDefault } from "@/lib/hooks/useImmersiveDefault";
import { ProgressBar } from "@/components/bracket/ProgressBar";
import { RotateInvite } from "@/components/bracket/RotateInvite";
import type { BracketFillData } from "@/lib/queries/bracket-fill";
import { RoundTabs } from "./RoundTabs";
import { BracketFillBoard } from "./BracketFillBoard";
import { FillPosterView } from "./FillPosterView";
import styles from "./BracketFillView.module.css";

type BracketFillViewProps = {
  data: BracketFillData;
  activeRoundKey: string | undefined;
};

// Orchestrateur : bascule entre le flux normal (onglets par tour + un tour
// à la fois, BracketFillBoard.tsx — seule vue sans scroll horizontal,
// conservée pour mobile PORTRAIT) et le poster interactif
// (FillPosterView.tsx, défaut sur desktop/paysage) — même rôle que
// components/bracket/TreeView.tsx pour la consultation (16/08/2026,
// chantier « remplissage en poster interactif »). Pas de contrat d'URL
// `?arbre=` à préserver ici (contrairement à /bracket) : useImmersiveDefault
// appelé sans `onEnter`/`onExit`, l'état reste local à ce composant.
export function BracketFillView({ data, activeRoundKey }: BracketFillViewProps) {
  const { visible, showInvite, handleTriggerClick, handleSeeAnyway, dismissInvite, exit } = useImmersiveDefault({
    initialVisible: false,
    seenInviteKey: "bracket-fill-poster-seen-anyway",
  });

  if (visible) {
    return <FillPosterView data={data} onExit={exit} />;
  }

  const activeRound = data.rounds.find((round) => round.key === activeRoundKey);

  return (
    <div className={`${styles.page} photo-page`}>
      <div className={`${styles.header} glass-card`}>
        <h1 className={styles.title}>Mon bracket</h1>
        <button type="button" className={styles.trigger} onClick={handleTriggerClick}>
          Vue poster ↗
        </button>
      </div>
      <ProgressBar filledCount={data.filledCount} totalCount={data.totalCount} />
      <RoundTabs rounds={data.rounds} activeKey={activeRoundKey} />
      {activeRound && (
        <BracketFillBoard
          series={activeRound.series}
          competitionType={data.competitionType}
          isValidated={data.isValidated}
          isAutoValidated={data.isAutoValidated}
        />
      )}
      {showInvite && <RotateInvite onDismiss={dismissInvite} onSeeAnyway={handleSeeAnyway} />}
    </div>
  );
}
