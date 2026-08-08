# NBA Pronos — SPEC BADGES PERMANENTS V0.1

> **Statut : cadré en séance le 08/08/2026 (plusieurs tours d'échange en
> conversation, pas d'AskUserQuestion formel sur ce chantier précis), en
> attente de relecture finale avant 1re ligne de code.** Aucune spec ne
> préexistait — seule une ligne dans `BACKLOG_V1.md` (« Badges permanents »,
> emplacement tranché le 04/08/2026 dans l'onglet Stats du Profil, posé en
> placeholder « Bientôt disponible », liste des badges volontairement non
> spécifiée jusqu'ici).
>
> 3ème et dernier des chantiers prioritaires retenus le 30/07/2026
> (`GAPS_OUVERTS.md`), après la refonte visuelle du Bracket (FAITE) et le
> Tutoriel joueur (FAIT — `SPEC_TUTORIEL_JOUEUR_V0_1.md`).
>
> Ce n'est PAS un écran à route dédiée : une catégorie affichée dans l'onglet
> Stats du Profil existant (`app/(app)/profile/page.tsx`), déjà posée en
> placeholder. D'où le nom sans « ÉCRAN », même patron que le Tutoriel.

---

## 0. Sources et cadre

```text
Backlog      : BACKLOG_V1.md, section "Fun / esprit ligue entre potes".
Reclassement : GAPS_OUVERTS.md, entrée du 30/07/2026 (3 chantiers
  prioritaires, ordre Bracket -> Tutoriel joueur -> badges permanents), et
  entrée détaillée du 08/08/2026 (cadrage complet de ce chantier, reprise
  intégrale dans ce document).
Matière première : tableur manuel pré-appli fourni par l'utilisateur
  (Cadrage/DA/🏀 NBA Pronos - 22_04_2026 (réponses) (1).xlsx, NON commité au
  dépôt — fichier personnel de l'utilisateur) : taxonomie des paris perso,
  recaps humoristiques par soirée ("Tableau d'honneur"/"Salle des
  brancards"/"Zone Maïno"/"Bilan des points bonus"). Confirmé que le
  bet_category réel de l'app (9 valeurs, migration initiale du 18/07)
  recoupe quasi mot pour mot la taxonomie du tableur.
Existant réutilisé :
  - lib/scoring/engine.ts (barème réel : winnerPoints=10, marginBonus
    5/3/2/1/0 selon marginDiff, barème bracket par tour, BET_DIFFICULTY_POINTS
    5/10/15/20/25) — source des seuils de points (§4.IV).
  - lib/labels/bets.ts (BET_CATEGORY_OPTIONS, BET_DIFFICULTY_LABELS "Très
    accessible"->"Jackpot") — labels SÉRIEUX du formulaire de pari, NE PAS
    confondre avec les noms de badges (§4.III, échelle Prudent->Fou furieux)
    qui vivent dans un namespace séparé.
  - lib/queries/stats.ts (onglet Stats du Profil, 04/08/2026) — emplacement
    d'accueil de la catégorie Badges, déjà posée en placeholder.
  - supabase/migrations/20260730100000_leaderboard_snapshots_and_superlatives.sql
    (competition_superlatives, superlative_kind) — les 5 superlatifs déjà
    codés (NOSTRADAMUS/SNIPER/BRACKET_KING/BEST_ROUND1/BIGGEST_CLIMB) sont
    FIGÉS à la clôture d'une compétition, un mécanisme DIFFÉRENT et
    INDÉPENDANT des badges permanents ci-dessous (§1). Noms de badges
    choisis pour ne jamais entrer en collision avec ces 5 noms.
```

## 1. Principe général — acté (08/08/2026)

```text
Les badges permanents sont DISTINCTS des 5 superlatifs de clôture déjà
  codés : les superlatifs couronnent le MEILLEUR joueur d'UNE compétition
  donnée (figés à closeCompetition()) ; les badges récompensent un
  ACCOMPLISSEMENT PERSONNEL, cumulé À VIE (toutes compétitions confondues),
  sans jamais comparer un joueur à un autre.

Décision actée : AUCUNE comparaison directe entre joueurs dans un badge (ni
  "le plus de X", ni "le meilleur taux de Y") — seulement des seuils
  personnels atteints ou non. C'est ce qui a fait tomber "le plus de paris
  FUN_OFF_COURT" -> un seuil de volume personnel, etc. (voir chaque axe,
  §4).

Décision actée : un badge, une fois débloqué, reste acquis POUR TOUJOURS —
  aucune régression possible, y compris pour les 2 seuls axes réellement
  "streak" (Métronome, Pilier ; voir aussi Fidèle) : le palier affiché se
  base sur le RECORD personnel jamais atteint (max cumulé, ne peut que
  monter), jamais sur l'état courant. Choisi pour garder un mécanisme
  unique à tous les badges et rester cohérent avec le ton bienveillant du
  tableur d'origine — personne ne se fait reprendre un trophée déjà gagné.

Décision actée : une streak (Métronome, Pilier) se CALCULE à l'intérieur
  d'une seule compétition (repart à zéro à la compétition suivante, cohérent
  avec le scope des superlatifs existants) — mais le RECORD affiché par le
  badge est le max de toutes les séries jamais obtenues, toutes compétitions
  confondues. Évite l'absurdité d'une "série" qui traverserait un trou de
  plusieurs mois entre deux saisons.
```

## 2. Approche technique — acté (08/08/2026)

```text
Calcul en LECTURE PURE, jamais de state incrémenté par trigger : une (ou
  plusieurs) vue(s) SQL agrégeant match_predictions / bracket_picks / bets /
  leaderboard_snapshots / league_memberships par user_id, TOUTES
  compétitions confondues (contrairement à user_scores, scopée par
  compétition) — même patron que user_scores elle-même, qui est déjà une
  vue non matérialisée, jamais une table à part.

Les seuils (Bronze/Argent/Or/Platine/Diamant, §3) restent des CONSTANTES
  TypeScript comparées au résultat de la vue — même patron que
  BET_DIFFICULTY_POINTS (lib/labels/bets.ts). Aucune donnée de seuil en
  base.

Volume validé tenable même à "quelques centaines de joueurs" (index déjà en
  place : idx_match_predictions_user, idx_bets_user) — quelques centaines de
  milliers de lignes au total sur toute la durée de vie du projet, largement
  dans ce qu'un group by user_id avec index traite en quelques millisecondes.

Porte de sortie notée si le volume devient un jour un vrai sujet : passer la
  vue en VUE MATÉRIALISÉE rafraîchie par cron (même patron que
  leaderboard_snapshots, cron quotidien existant) — AUCUN changement côté
  code appelant, pas à construire maintenant.

Notification de déblocage ("tu viens de débloquer Or sur Duelliste") :
  REPORTÉE hors de ce lot, explicitement (« ça va être technique ») —
  nécessiterait de détecter une transition de palier, donc un minimum
  d'état stocké, contrairement au calcul en lecture pure ci-dessus. Badges
  consultables dans l'onglet Stats uniquement pour cette 1re version, sans
  notification push ni bannière de déblocage.
```

## 3. Paliers — principe général — acté (08/08/2026)

```text
5 paliers pour la quasi-totalité des badges : Bronze / Argent / Or /
  Platine / Diamant, croissance approximative ×2.5 / ×2 / ×2 / ×1.7 entre
  paliers consécutifs — pensé pour que Bronze soit gratifiant presque
  immédiatement (quelques jours de jeu) et Diamant un vrai objectif long
  terme (plusieurs compétitions, pas atteignable en une saison).

Compteurs cumulés À VIE (toutes compétitions confondues, cohérent avec la
  permanence actée en §1) — sauf mention contraire explicite dans le
  catalogue (§4).

EXCEPTIONS à ce moule à 5 paliers génériques (détail §4/§5) :
  - Complétiste (bracket 100%) et Sociable (ligue) : badges UNIQUES,
    binaires (fait ou pas fait), aucun palier.
  - Échelle Prudent -> Fou furieux (paris perso par difficulté) : 5 BADGES
    DISTINCTS correspondant aux 5 niveaux de difficulté eux-mêmes, chacun
    avec son propre seuil de déblocage — pas un seul badge à 5 paliers.

TOUS les chiffres ci-dessous (§4) sont des ESTIMATIONS DE DÉPART, jamais
  calibrées sur une compétition allée au bout en conditions réelles avec un
  vrai volume de joueurs — à ajuster à l'usage, sans que ça remette en
  cause la mécanique elle-même.
```

## 4. Catalogue complet des badges

### I. Pronostics de match (`match_predictions`)

| Badge | Ce qui est compté (cumulé à vie) | Bronze | Argent | Or | Platine | Diamant |
|---|---|---|---|---|---|---|
| **Chirurgien** | Pronostics vainqueur corrects (`is_winner_correct = true`) | 10 | 25 | 50 | 100 | 200 |
| **Horloger** | Écarts exacts (`margin_diff = 0`) | 3 | 8 | 15 | 30 | 50 |
| **Œil de lynx** | Écarts proches non exacts (`margin_diff` entre 1 et 2) | 8 | 20 | 40 | 75 | 150 |
| **Métronome** | Record de bons vainqueurs d'affilée (streak, scopée par compétition — §1) | 3 | 5 | 8 | 12 | 20 |
| **Pilier** | Record de participation sans absence sur les pronostics (streak, scopée par compétition) | 5 | 15 | 30 | 50 | 80 |
| **Machine à pronos** | Volume total de pronostics figés (`VALIDATED`/`LOCKED`), peu importe le résultat | 5 | 15 | 35 | 70 | 120 |

### II. Bracket personnel (`bracket_picks` / `brackets`)

| Badge | Ce qui est compté (cumulé à vie) | Bronze | Argent | Or | Platine | Diamant |
|---|---|---|---|---|---|---|
| **Chirurgien (série)** | Vainqueurs de série corrects (`is_winner_correct = true`) | 3 | 8 | 15 | 30 | 50 |
| **Scoreur (série)** | Scores de série exacts (`is_score_exact = true`) | 2 | 5 | 10 | 20 | 35 |
| **Visionnaire** | Affiches correctement anticipées (`is_matchup_correct = true`) | 1 | 3 | 6 | 12 | 20 |
| **Complétiste** | Bracket validé à 100% au moins une fois (`brackets.is_validated = true`) | *badge unique, pas de palier* | | | | |
| **Sans-faute** | Tours entiers sans erreur (tous les picks du tour corrects), cumulés | 1 | 3 | 6 | 12 | 20 |

### III. Paris perso (`bets`)

| Badge | Catégorie (`validated_category`) — paris **gagnés** | Bronze | Argent | Or | Platine | Diamant |
|---|---|---|---|---|---|---|
| **Scout** | `PLAYER_PROP` | 3 | 8 | 15 | 25 | 40 |
| **Comptable** | `SCORE_TOTAL` | 3 | 8 | 15 | 25 | 40 |
| **Tacticien** | `TEAM_PROP` | 3 | 8 | 15 | 25 | 40 |
| **Minuteur** | `PERIOD` | 3 | 8 | 15 | 25 | 40 |
| **Duelliste** | `HEAD_TO_HEAD` | 3 | 8 | 15 | 25 | 40 |
| **Chronomètre** | `PLAYING_TIME` | 3 | 8 | 15 | 25 | 40 |
| **Assembleur** | `MULTI_PLAYER_COMBO` | 3 | 8 | 15 | 25 | 40 |
| **Limier** | `GAME_EVENT` | 3 | 8 | 15 | 25 | 40 |
| **Fantaisiste** | `FUN_OFF_COURT` | 3 | 8 | 15 | 25 | 40 |

| Badge | Ce qui est compté (cumulé à vie) | Bronze | Argent | Or | Platine | Diamant |
|---|---|---|---|---|---|---|
| **Accro du pari** | Volume total de paris posés (soumis), peu importe le résultat | 5 | 15 | 35 | 70 | 120 |
| **Maïno** | Paris `FUN_OFF_COURT` posés (soumis), peu importe le résultat | 2 | 5 | 10 | 20 | 35 |

**Échelle dédiée « prise de risque »** (ne suit PAS le moule Bronze->Diamant, §3) — 5 badges distincts, un par niveau de `difficulty` (`proposed_difficulty`/`validated_difficulty`, la validée fait foi comme partout ailleurs, ex. `save_bet`), déclenché par le nombre de paris **tentés** (peu importe le résultat) à ce niveau précis :

| Niveau | Badge | Seuil de déblocage (provisoire, à ajuster) |
|---|---|---|
| 1 | Prudent | 5 paris tentés en difficulté 1 |
| 2 | Joueur | 5 paris tentés en difficulté 2 |
| 3 | Casse-cou | 5 paris tentés en difficulté 3 |
| 4 | Kamikaze | 5 paris tentés en difficulté 4 |
| 5 | Fou furieux | 5 paris tentés en difficulté 5 |

> Même seuil (5) proposé pour les 5 niveaux par simplicité — à ajuster si les niveaux élevés se révèlent trop rares en usage réel pour être équitables face aux niveaux bas.

**Axe écarté (08/08/2026)** : badges par `scope` (MATCH vs SERIES) — retiré de cette spec après clarification, jugé pas assez parlant pour le joueur, pas remplacé.

### IV. Classement global (`user_scores` agrégée à vie, `leaderboard_snapshots`)

| Badge | Ce qui est compté (cumulé à vie) | Bronze | Argent | Or | Platine | Diamant |
|---|---|---|---|---|---|---|
| **Collectionneur** | Points totaux cumulés, toutes sources | 100 | 500 | 1500 | 4000 | 10000 |
| **Pronos Master** | Points cumulés issus des pronostics de match (`matches_points`) | 50 | 200 | 600 | 1500 | 3500 |
| **Bracket Master** | Points cumulés issus du bracket (`bracket_points`) | 50 | 200 | 600 | 1500 | 3500 |
| **Paris Persos Master** | Points cumulés issus des paris perso (`bets_points`) | 50 | 200 | 600 | 1500 | 3500 |
| **Podiumista** | Jours cumulés passés dans le top 3 du classement (`leaderboard_snapshots.rank <= 3`) | 3 | 10 | 25 | 50 | 100 |

**Reporté (08/08/2026)** : badge **Grimpeur** (progression de rang) — mécanisme déjà réfléchi si besoin à la reprise (paliers en % du classement traversé plutôt qu'en places absolues : `places gagnées / (nb joueurs classés − 1)`, seuils 20/35/50/70/90%, pour rester valable quel que soit le nombre de joueurs — un seuil de places fixe serait impossible à atteindre pour un petit groupe genre 6-8 joueurs). Pas retenu pour cette 1re version.

### V. Fidélité / régularité (transverse)

| Badge | Ce qui est compté | Bronze | Argent | Or | Platine | Diamant |
|---|---|---|---|---|---|---|
| **Fidèle** | Record de participation globale sans absence (streak, tous engagements confondus — pronostics ET paris ; définition précise du "sans absence" combiné à affiner en codant) | 5 | 15 | 30 | 50 | 80 |
| **Vétéran** | Nombre de compétitions distinctes jouées depuis l'inscription | 1 | 2 | 4 | 6 | 10 |
| **Doyen** | Ancienneté du compte (`users.created_at`) | 1 mois | 3 mois | 6 mois | 1 an | 2 ans |

### VI. Ligues (`leagues` / `league_memberships`)

| Badge | Ce qui est compté | |
|---|---|---|
| **Sociable** | A rejoint ou créé au moins une ligue | *badge unique, pas de palier* |

## 5. Axe écarté du périmètre — chantier séparé

```text
"Fan de tel joueur" (proposé par l'utilisateur en séance, 08/08/2026) :
  reconnaître les joueurs qui parient beaucoup sur un même joueur NBA en
  particulier. ÉCARTÉ de cette spec, reporté en chantier séparé futur :
  aucune donnée structurée sur les joueurs NBA n'existe aujourd'hui
  (bets.description en texte libre, pas de table `players` référentielle
  contrairement à `teams`, jamais synchronisée depuis Highlightly) —
  nécessiterait un référentiel joueurs synchronisé + une retouche du
  formulaire de pari (sélecteur structuré), sans backfill possible sur les
  paris déjà posés en texte libre. Cadré plus tard le moment venu, même
  patron que Bracket personnel ou Ligues en leur temps.
```

## 6. Composants / fichiers prévus (à créer en codant, RIEN n'est codé à ce stade)

```text
supabase/migrations/<timestamp>_badges_lifetime_view.sql — la ou les vues
  SQL agrégeant match_predictions/bracket_picks/bets/leaderboard_snapshots/
  league_memberships par user_id, tous compétitions confondues (§2).
  Streaks (Métronome/Pilier/Fidèle) : fenêtres SQL (row_number / gaps and
  islands) scopées par compétition, max() cross-compétition côté requête ou
  côté TypeScript selon ce qui reste le plus lisible en codant.

lib/badges/thresholds.ts — constantes des seuils par badge (§4), même
  patron que BET_DIFFICULTY_POINTS (lib/labels/bets.ts) ; ne PAS réutiliser
  ce fichier existant, namespace séparé (§0).

lib/badges/labels.ts — noms des badges (§4), séparés des BET_CATEGORY_OPTIONS
  /BET_DIFFICULTY_LABELS existants (§0) pour ne jamais les confondre avec
  les libellés sérieux du formulaire de pari.

lib/queries/badges.ts — lecture de la/les vue(s), calcul du palier atteint
  par badge (comparaison aux constantes ci-dessus), consommé par l'onglet
  Stats du Profil (lib/queries/stats.ts, catégorie déjà en placeholder).

components/profile/BadgesSection.tsx (ou équivalent) — rendu de la
  catégorie Badges dans l'onglet Stats, remplace le placeholder "Bientôt
  disponible" posé le 04/08/2026.
```

## 7. Hors périmètre de cette version

```text
- Badge Grimpeur (progression de rang) : reporté, §4.IV.
- Axe "fan de tel joueur" : chantier séparé, §5.
- Notification de déblocage (push/bannière) : reportée, §2.
- Affichage de la série de bons vainqueurs EN COURS comme stat live
  distincte du badge (record) : demandé par l'utilisateur mais formulation
  à clarifier ("quand elle constitue la plus longue série en cours") —
  détail d'affichage à trancher en construisant l'écran, pas un blocage de
  cette spec.
- Rendu visuel des badges (icônes, couleurs par palier, mise en page dans
  l'onglet Stats) : cette spec couvre les TYPES et seuils, pas le visuel —
  à cadrer séparément le moment venu (même découpage que le reste du
  projet, cadrage fonctionnel puis passe visuelle).
- Historique/all-time cross-compétition pour les 5 superlatifs de clôture
  existants (NOSTRADAMUS etc.) : aucun rapport avec ce chantier, restent un
  mécanisme séparé (§0/§1).
```

## 8. Récapitulatif des décisions actées (08/08/2026)

```text
A. Principe (§1) : badges DISTINCTS des superlatifs de clôture ; aucune
   comparaison directe entre joueurs ; permanence totale une fois débloqué ;
   streaks scopées par compétition mais record max à vie.
B. Approche technique (§2) : vue(s) SQL en lecture pure, seuils en
   constantes TypeScript, pas de nouvelle table de state, notification de
   déblocage reportée.
C. Paliers (§3) : 5 paliers Bronze->Diamant, croissance ×2.5/×2/×2/×1.7,
   compteurs cumulés À VIE, sauf badges uniques (Complétiste, Sociable) et
   échelle dédiée (Prudent->Fou furieux).
D. Catalogue (§4) : inventaire exhaustif des axes (I. Pronostics de match,
   II. Bracket personnel, III. Paris perso, IV. Classement global,
   V. Fidélité/régularité, VI. Ligues), noms et seuils validés un par un
   avec l'utilisateur.
E. Axes écartés/reportés : Grimpeur (§4.IV, mécanisme déjà pensé en % du
   classement si repris) ; Fan de tel joueur (§5, référentiel joueurs
   manquant) ; scope MATCH/SERIES des paris perso (§4.III, pas assez
   parlant).
F. Emplacement d'affichage : catégorie Badges de l'onglet Stats du Profil,
   déjà tranché le 04/08/2026, placeholder existant à remplacer (§6).
```
