// Libellés de tour, PARTAGÉS entre l'écran Bracket et l'écran Mes pronos
// (SPEC_ECRAN_MES_PRONOS_V0_1 §16.5). Extrait de lib/queries/bracket.ts, qui
// les portait en dur avant ce module — aucun libellé ne change, seul son
// emplacement bouge, pour éviter un second vocabulaire qui diverge au
// premier changement de libellé.

export const ROUND_LABELS: Record<string, string> = {
  ROUND_1: "1er tour",
  CONF_SEMIS: "Demi-finales de conférence",
  CONF_FINALS: "Finales de conférence",
  NBA_FINALS: "Finale NBA",
  CUP_QUARTERS: "Quarts de finale",
  CUP_SEMIS: "Demi-finales",
  CUP_FINAL: "Finale",
};
