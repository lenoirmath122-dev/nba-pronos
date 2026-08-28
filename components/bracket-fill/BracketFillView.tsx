"use client";

import { usePosterToggle } from "@/lib/hooks/usePosterToggle";
import { ProgressBar } from "@/components/bracket/ProgressBar";
import type { BracketFillData } from "@/lib/queries/bracket-fill";
import { RuleHelpButton } from "@/components/regles/RuleHelpButton";
import { BracketBaremeContent } from "@/components/regles/BracketBaremeContent";
import { RoundTabs } from "./RoundTabs";
import { BracketFillBoard } from "./BracketFillBoard";
import { FillPosterView } from "./FillPosterView";
import styles from "./BracketFillView.module.css";

type BracketFillViewProps = {
  data: BracketFillData;
  activeRoundKey: string | undefined;
};

// Orchestrateur : bascule entre le poster interactif (FillPosterView.tsx —
// TOUJOURS l'écran d'arrivée depuis le 17/08/2026, demandé par
// l'utilisateur : « peu importe le device, on arrive sur l'arbre ») et le
// flux normal (onglets par tour + un tour à la fois, BracketFillBoard.tsx),
// accessible via « Quitter »/« Voir en poster » — même rôle que
// components/bracket/TreeView.tsx pour la consultation (16/08/2026,
// chantier « remplissage en poster interactif », simplifié le 17/08/2026 :
// plus de bascule par device, cf. usePosterToggle.ts).
export function BracketFillView({ data, activeRoundKey }: BracketFillViewProps) {
  const { visible, enter, exit } = usePosterToggle();

  if (visible) {
    return <FillPosterView data={data} onExit={exit} />;
  }

  const activeRound = data.rounds.find((round) => round.key === activeRoundKey);

  return (
    <div className={`${styles.page} photo-page`}>
      <div className={`${styles.header} glass-card`}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Mon bracket</h1>
          <RuleHelpButton title="Barème du bracket" label="Comment est noté le bracket">
            <BracketBaremeContent competitionType={data.competitionType} />
          </RuleHelpButton>
        </div>
        <button type="button" className={styles.trigger} onClick={enter}>
          Voir en poster ↗
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
    </div>
  );
}
