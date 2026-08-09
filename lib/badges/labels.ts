// Noms et regroupement des badges permanents (SPEC_BADGES_PERMANENTS_V0_1.md
// §4) — SANS dépendance serveur, même contrainte que thresholds.ts.
// Namespace séparé de lib/labels/bets.ts (BET_CATEGORY_OPTIONS notamment) :
// "Duelliste" (badge) ne doit jamais être confondu avec "Comparaison / duel"
// (libellé sérieux du formulaire de pari, même catégorie bet_category
// sous-jacente).

import type { BadgeId } from "./thresholds";

export type BadgeCategoryId = "MATCH" | "BRACKET" | "BETS" | "RANKING" | "LOYALTY" | "LEAGUES";

export const BADGE_LABELS: Record<BadgeId, string> = {
  CHIRURGIEN: "Chirurgien",
  HORLOGER: "Horloger",
  OEIL_DE_LYNX: "Œil de lynx",
  METRONOME: "Métronome",
  PILIER: "Pilier",
  MACHINE_A_PRONOS: "Machine à pronos",

  CHIRURGIEN_SERIE: "Chirurgien (série)",
  SCOREUR_SERIE: "Scoreur (série)",
  VISIONNAIRE: "Visionnaire",
  COMPLETISTE: "Complétiste",
  SANS_FAUTE: "Sans-faute",

  SCOUT: "Scout",
  COMPTABLE: "Comptable",
  TACTICIEN: "Tacticien",
  MINUTEUR: "Minuteur",
  DUELLISTE: "Duelliste",
  CHRONOMETRE: "Chronomètre",
  ASSEMBLEUR: "Assembleur",
  LIMIER: "Limier",
  FANTAISISTE: "Fantaisiste",
  ACCRO_DU_PARI: "Accro du pari",
  MAINO: "Maïno",
  PRUDENT: "Prudent",
  JOUEUR: "Joueur",
  CASSE_COU: "Casse-cou",
  KAMIKAZE: "Kamikaze",
  FOU_FURIEUX: "Fou furieux",

  COLLECTIONNEUR: "Collectionneur",
  PRONOS_MASTER: "Pronos Master",
  BRACKET_MASTER: "Bracket Master",
  PARIS_PERSOS_MASTER: "Paris Persos Master",
  PODIUMISTA: "Podiumista",

  VETERAN: "Vétéran",
  DOYEN: "Doyen",

  SOCIABLE: "Sociable",
};

export const BADGE_DESCRIPTIONS: Record<BadgeId, string> = {
  CHIRURGIEN: "Pronostics vainqueur corrects",
  HORLOGER: "Écarts exacts",
  OEIL_DE_LYNX: "Écarts proches (à 1 ou 2 points près)",
  METRONOME: "Record de bons vainqueurs d'affilée",
  PILIER: "Record de participation sans absence",
  MACHINE_A_PRONOS: "Pronostics soumis, peu importe le résultat",

  CHIRURGIEN_SERIE: "Vainqueurs de série corrects au bracket",
  SCOREUR_SERIE: "Scores de série exacts au bracket",
  VISIONNAIRE: "Affiches de série correctement anticipées",
  COMPLETISTE: "Bracket rempli à 100% au moins une fois",
  SANS_FAUTE: "Tours de bracket sans aucune erreur de vainqueur",

  SCOUT: "Paris perso gagnés sur un joueur",
  COMPTABLE: "Paris perso gagnés sur un score ou un total de match",
  TACTICIEN: "Paris perso gagnés sur une équipe",
  MINUTEUR: "Paris perso gagnés sur une période de jeu",
  DUELLISTE: "Paris perso gagnés en comparaison/duel",
  CHRONOMETRE: "Paris perso gagnés sur le temps de jeu",
  ASSEMBLEUR: "Paris perso gagnés en combo multi-joueurs",
  LIMIER: "Paris perso gagnés sur un événement de match",
  FANTAISISTE: "Paris perso gagnés en fun/hors terrain",
  ACCRO_DU_PARI: "Paris perso posés, peu importe le résultat",
  MAINO: "Paris perso fun/hors terrain posés, peu importe le résultat",
  PRUDENT: "Paris perso tentés en difficulté 1",
  JOUEUR: "Paris perso tentés en difficulté 2",
  CASSE_COU: "Paris perso tentés en difficulté 3",
  KAMIKAZE: "Paris perso tentés en difficulté 4",
  FOU_FURIEUX: "Paris perso tentés en difficulté 5",

  COLLECTIONNEUR: "Points cumulés, toutes sources confondues",
  PRONOS_MASTER: "Points cumulés issus des pronostics de match",
  BRACKET_MASTER: "Points cumulés issus du bracket",
  PARIS_PERSOS_MASTER: "Points cumulés issus des paris perso",
  PODIUMISTA: "Jours cumulés passés dans le top 3 du classement",

  VETERAN: "Compétitions distinctes jouées depuis l'inscription",
  DOYEN: "Ancienneté du compte",

  SOCIABLE: "A rejoint ou créé au moins une ligue",
};

export const BADGE_CATEGORIES: { id: BadgeCategoryId; title: string; badges: BadgeId[] }[] = [
  {
    id: "MATCH",
    title: "Pronostics de match",
    badges: ["CHIRURGIEN", "HORLOGER", "OEIL_DE_LYNX", "METRONOME", "PILIER", "MACHINE_A_PRONOS"],
  },
  {
    id: "BRACKET",
    title: "Bracket personnel",
    badges: ["CHIRURGIEN_SERIE", "SCOREUR_SERIE", "VISIONNAIRE", "COMPLETISTE", "SANS_FAUTE"],
  },
  {
    id: "BETS",
    title: "Paris perso",
    badges: [
      "SCOUT",
      "COMPTABLE",
      "TACTICIEN",
      "MINUTEUR",
      "DUELLISTE",
      "CHRONOMETRE",
      "ASSEMBLEUR",
      "LIMIER",
      "FANTAISISTE",
      "ACCRO_DU_PARI",
      "MAINO",
      "PRUDENT",
      "JOUEUR",
      "CASSE_COU",
      "KAMIKAZE",
      "FOU_FURIEUX",
    ],
  },
  {
    id: "RANKING",
    title: "Classement global",
    badges: ["COLLECTIONNEUR", "PRONOS_MASTER", "BRACKET_MASTER", "PARIS_PERSOS_MASTER", "PODIUMISTA"],
  },
  {
    id: "LOYALTY",
    title: "Fidélité / régularité",
    badges: ["VETERAN", "DOYEN"],
  },
  {
    id: "LEAGUES",
    title: "Ligues",
    badges: ["SOCIABLE"],
  },
];
