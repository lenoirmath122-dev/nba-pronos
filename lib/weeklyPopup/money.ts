// Vocabulaire d'argent (plan §3.8) : l'appli n'a aucun argent réel, un texte
// qui parle de mise ou de gain est signalé en AVERTISSEMENT (jamais bloquant).
// Pur. Les libellés renvoyés viennent de cette liste fermée, jamais du texte
// du joueur : sans risque pour `warnings[].detail`.

interface MoneyPattern {
  label: string;
  re: RegExp;
}

const word = (alternatives: string, after = "") =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])${after}`, "iu");

export const MONEY_PATTERNS: readonly MoneyPattern[] = [
  // « mise en place / à jour / au point » n'est pas de l'argent.
  { label: "mise", re: word("mises?", "(?!\\s+(?:en|à|au)(?![\\p{L}\\p{N}]))") },
  { label: "misé", re: word("misé(?:e|es|s)?|miser") },
  { label: "gain", re: word("gains?") },
  { label: "euros", re: word("euros?") },
  { label: "€", re: /€/u },
  { label: "cash", re: word("cash") },
  { label: "payé", re: word("pay(?:é|ée|ées|és|er|e|ent|ons)|paiements?") },
  { label: "douille", re: word("douilles?") },
  { label: "jackpot", re: word("jackpots?") },
  { label: "cagnotte", re: word("cagnottes?") },
  { label: "pactole", re: word("pactoles?") },
  { label: "cote", re: word("cotes?") },
  { label: "remboursé", re: word("rembours(?:é|ée|ées|és|er|ement|ements)") },
  { label: "récompense", re: word("récompenses?") },
  { label: "rente", re: word("rentes?") },
];

/** Libellés (de `MONEY_PATTERNS`) trouvés dans le texte, sans doublon. */
export function findMoneyWords(text: string): string[] {
  return MONEY_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
}
