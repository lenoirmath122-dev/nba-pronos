import {
  Crosshair,
  Clock,
  Eye,
  Repeat,
  Cpu,
  Target,
  Percent,
  Sparkles,
  BadgeCheck,
  ShieldCheck,
  Binoculars,
  Calculator,
  Compass,
  Timer,
  Swords,
  Watch,
  Puzzle,
  Search,
  PartyPopper,
  Layers,
  Drama,
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Gem,
  TrendingUp,
  Trophy,
  Coins,
  Medal,
  Heart,
  History,
  Hourglass,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { BadgeId } from "./thresholds";

// Icônes de badges (10/08/2026) — bibliothèque sous licence (lucide-react,
// ISC), plutôt qu'un dessin sur-mesure ou un asset fourni par l'utilisateur
// (décision explicite : cf. GAPS_OUVERTS.md). Un mapping 1:1, aucune icône
// répétée entre badges. L'échelle de difficulté (Prudent → Fou furieux)
// reprend volontairement les faces de dé Dice1→Dice5 : correspondance
// littérale et lisible avec le niveau 1 à 5.
//
// STOPGAP : ce mapping sera remplacé par des visuels générés par IA une
// fois prêts (cf. Cadrage/V1/Spec visuelle/PROMPTS_BADGES_ICONES.md) — pas
// mis à jour pour coller aux nouveaux concepts visuels choisis par
// l'utilisateur le 10/08/2026 (échelle Casse-cou/Kamikaze/Fou furieux
// notamment, qui abandonne les dés aux 2 derniers paliers), pour éviter un
// double travail. Seul PILIER a été retiré (fusionné dans FIDELE,
// migration #28) — sinon le mapping n'était plus valide (type manquant).

export const BADGE_ICONS: Record<BadgeId, LucideIcon> = {
  CHIRURGIEN: Crosshair,
  HORLOGER: Clock,
  OEIL_DE_LYNX: Eye,
  METRONOME: Repeat,
  MACHINE_A_PRONOS: Cpu,

  CHIRURGIEN_SERIE: Target,
  SCOREUR_SERIE: Percent,
  VISIONNAIRE: Sparkles,
  COMPLETISTE: BadgeCheck,
  SANS_FAUTE: ShieldCheck,

  SCOUT: Binoculars,
  COMPTABLE: Calculator,
  TACTICIEN: Compass,
  MINUTEUR: Timer,
  DUELLISTE: Swords,
  CHRONOMETRE: Watch,
  ASSEMBLEUR: Puzzle,
  LIMIER: Search,
  FANTAISISTE: PartyPopper,
  ACCRO_DU_PARI: Layers,
  MAINO: Drama,
  PRUDENT: Dice1,
  JOUEUR: Dice2,
  CASSE_COU: Dice3,
  KAMIKAZE: Dice4,
  FOU_FURIEUX: Dice5,

  COLLECTIONNEUR: Gem,
  PRONOS_MASTER: TrendingUp,
  BRACKET_MASTER: Trophy,
  PARIS_PERSOS_MASTER: Coins,
  PODIUMISTA: Medal,

  FIDELE: Heart,
  VETERAN: History,
  DOYEN: Hourglass,

  SOCIABLE: Users,
};
