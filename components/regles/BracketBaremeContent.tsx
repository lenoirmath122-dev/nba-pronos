import { BaremeTable } from "./BaremeTable";
import styles from "./RuleContent.module.css";

// Barème du bracket (Playoffs + NBA Cup) — extrait de app/regles/page.tsx
// (28/08/2026) pour être réutilisé dans le pop-up d'aide de l'écran Bracket
// (RuleHelpButton sur BracketFillView.tsx/FillPosterView.tsx). `competitionType`
// omis (cas /regles) : les 2 barèmes s'affichent l'un après l'autre, comme
// avant l'extraction. Passé (cas pop-up, écran déjà dans un format donné) :
// un seul des 2 s'affiche, sans le comparatif "même principe" qui n'a de
// sens que vu depuis /regles.
type BracketBaremeContentProps = {
  competitionType?: "PLAYOFFS" | "NBA_CUP";
};

export function BracketBaremeContent({ competitionType }: BracketBaremeContentProps) {
  const showPlayoffs = competitionType !== "NBA_CUP";
  const showCup = competitionType !== "PLAYOFFS";

  return (
    <>
      {showPlayoffs && (
        <>
          <p className={styles.baremeLabel}>Barème par série</p>
          <BaremeTable
            caption="Barème du bracket"
            columns={["Vainqueur", "Score exact", "Bonne affiche"]}
            rows={[
              { label: "1ᵉʳ tour", values: ["25", "+10", "+0"] },
              { label: "Demi-finales de conf.", values: ["45", "+20", "+15"] },
              { label: "Finales de conférence", values: ["80", "+30", "+25"] },
              { label: "Finale NBA", values: ["250", "+50", "+40"] },
            ]}
          />
          <p className={styles.note}>
            « Bonne affiche » = deviner à l&apos;avance les 2 équipes qui s&apos;affrontent à ce tour —
            indépendant du vainqueur (une bonne affiche avec le mauvais vainqueur compte quand même, et
            inversement). Aucune affiche à deviner au 1ᵉʳ tour, les oppositions sont déjà connues. 250 + 50 +
            40 = 340 points, c&apos;est le score maximum d&apos;une seule série gagnée à la Finale NBA — pas
            du bracket entier.
          </p>
        </>
      )}
      {showCup && (
        <>
          <p className={styles.baremeLabel}>
            {competitionType === "NBA_CUP" ? "Barème par série" : "NBA Cup — même principe, barème différent"}
          </p>
          <BaremeTable
            caption="Barème du bracket NBA Cup"
            columns={["Vainqueur", "Bonne affiche"]}
            rows={[
              { label: "Quarts de finale", values: ["20", "+0"] },
              { label: "Demi-finales", values: ["50", "+15"] },
              { label: "Finale", values: ["150", "+25"] },
            ]}
          />
          <p className={styles.note}>
            Pas de score exact à prédire pour la NBA Cup — seulement le vainqueur et, à partir des
            demi-finales, l&apos;affiche. 3 tours au lieu de 4 pour les playoffs classiques.
          </p>
        </>
      )}
    </>
  );
}
