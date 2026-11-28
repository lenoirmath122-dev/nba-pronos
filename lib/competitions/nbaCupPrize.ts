// Visibilité de l'encadré « NBA Cup : deux cartes cadeaux à gagner » (page Règles,
// ancre #nba-cup-lots) et des liens vers le règlement du jeu (barre légale des
// visiteurs, profil). Règlement v2 : deux cartes cadeaux numériques Decathlon
// attribuées au classement (meilleur bracket, meilleur pronostiqueur des matchs
// de la Cup) ; plus de maillot ni de tirage au sort.
// Jusqu'au 31/01/2027 23:59, heure de Paris (UTC+1 en janvier).
// Montant de chaque carte cadeau numérique Decathlon (lots 1 et 2), en euros :
// source unique pour le règlement et la popup NBA Cup.
export const NBA_CUP_GIFT_CARD_EUR = 50;

export const NBA_CUP_PRIZE_VISIBLE_UNTIL = new Date("2027-01-31T23:59:00+01:00");

export function isNbaCupPrizeVisible(now: Date = new Date()): boolean {
  return now.getTime() <= NBA_CUP_PRIZE_VISIBLE_UNTIL.getTime();
}
