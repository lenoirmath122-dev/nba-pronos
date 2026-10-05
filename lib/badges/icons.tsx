import {
  CircleCheckBig,
  AlarmClock,
  Eye,
  Repeat,
  ScrollText,
  GitFork,
  Percent,
  CopyCheck,
  Network,
  Sparkles,
  Binoculars,
  Calculator,
  ChessKnight,
  Clock,
  Swords,
  Timer,
  Users,
  Dog,
  PartyPopper,
  Receipt,
  Drama,
  Dice1,
  Dice2,
  Dice3,
  Bomb,
  Laugh,
  Gem,
  Trophy,
  Award,
  Signature,
  Podium,
  Heart,
  History,
  Hourglass,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import type { BadgeId } from "./thresholds";

// Icônes de badges (10/08/2026) — bibliothèque sous licence (lucide-react,
// ISC), plutôt qu'un dessin sur-mesure. Un mapping 1:1, aucune icône répétée
// entre badges.
//
// Revu le 05/10/2026 (p3-9, retour de l'alpha) pour coller aux idées de
// visuel de l'utilisateur (Cadrage/DA/BADGES.pdf) quand la bibliothèque a
// l'équivalent : jumelles, calculette, cavalier d'échecs, chien qui renifle,
// cotillons, bombe, podium... Les badges à compteur ou à afficheur (Buzzer-
// beater « 0.0 », Money-time « 0:03 », Métronome/Fidèle) affichent leur
// propre centre dans l'écusson une fois débloqués (BadgeEmblem.tsx) ; leur
// icône ci-dessous ne sert qu'en petit et tant qu'ils sont verrouillés.
// Les visuels générés par IA restent prévus plus tard (p6-20).

export const BADGE_ICONS: Record<BadgeId, LucideIcon> = {
  CHIRURGIEN: CircleCheckBig,
  HORLOGER: AlarmClock,
  OEIL_DE_LYNX: Eye,
  METRONOME: Repeat,
  MACHINE_A_PRONOS: ScrollText,

  CHIRURGIEN_SERIE: GitFork,
  SCOREUR_SERIE: Percent,
  VISIONNAIRE: CopyCheck,
  COMPLETISTE: Network,
  SANS_FAUTE: Sparkles,

  SCOUT: Binoculars,
  COMPTABLE: Calculator,
  TACTICIEN: ChessKnight,
  MINUTEUR: Clock,
  DUELLISTE: Swords,
  CHRONOMETRE: Timer,
  ASSEMBLEUR: Users,
  LIMIER: Dog,
  FANTAISISTE: PartyPopper,
  ACCRO_DU_PARI: Receipt,
  MAINO: Drama,
  PRUDENT: Dice1,
  JOUEUR: Dice2,
  CASSE_COU: Dice3,
  KAMIKAZE: Bomb,
  FOU_FURIEUX: Laugh,

  COLLECTIONNEUR: Gem,
  PRONOS_MASTER: Trophy,
  BRACKET_MASTER: Award,
  PARIS_PERSOS_MASTER: Signature,
  PODIUMISTA: Podium,

  FIDELE: Heart,
  VETERAN: History,
  DOYEN: Hourglass,

  SOCIABLE: MessagesSquare,
};
