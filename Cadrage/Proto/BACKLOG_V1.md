# Backlog V1 — nouvelles fonctionnalités (NBA Pronos)

> Liste vivante, comme `GAPS_OUVERTS.md` : un point retiré/construit se
> retrouve dans `JOURNAL_SESSIONS.md` (trace de quand/comment), pas gardé
> ici "fait pour mémoire".
> Contenu issu du brainstorm de la session d'état des lieux pré-spec-
> technique du 17/07/2026, enrichi par un fichier réel de paris personnalisés
> de la saison passée fourni par l'utilisateur.
> **Toutes ces fonctionnalités sont des AJOUTS purs** — aucune ne touche au
> scoring, aux statuts, aux workflows ou aux règles de visibilité déjà
> validés dans le cadrage fonctionnel (`nba_pronos_SPEC_FONCTIONNELLE_V0_2.md`,
> clos).
> Priorisation/faisabilité détaillée : à trancher en spec technique. Ce
> document liste le QUOI, pas le QUAND ni le COMMENT.

---

> **Reclassement du 30/07/2026** (décidé avec l'utilisateur, fin de
> session) : 3 chantiers retenus comme prioritaires parmi ce qui reste,
> dans cet ORDRE — 1. ~~refonte visuelle du Bracket~~ **FAITE le
> 30/07/2026** (distinction Est/Ouest, Vue A scindée en sous-groupes, Vue B
> réordonnée en poster miroir Ouest-gauche/Finale-centre/Est-droite, sans
> trait de connexion, + colonnes centrées en hauteur + carte surlignée sur
> série terminée — voir `ETAT_ACTUEL.md`/`JOURNAL_SESSIONS.md`) ;
> 2. **Tutoriel joueur** ; 3. **"Fun / esprit ligue" REDÉFINI** : plus les
> superlatifs de clôture (déjà faits), mais des BADGES PERMANENTS visibles
> en continu PENDANT la compétition (profil joueur et/ou classement,
> emplacement pas encore tranché) — à spécifier le moment venu. Le reste de
> ce document (export .ics, courbe d'évolution, classement all-time,
> Hall of shame, etc.) est reporté après ces 3.

---

## Tutoriel & notifications

- ~~Tutoriel d'utilisation de l'appli pour le JOUEUR~~ **FAIT — 31/07/2026**
  (`SPEC_TUTORIEL_JOUEUR_V0_1.md`, `ETAT_ACTUEL.md` §2.51) : bannière de
  proposition à la 1re connexion + wizard modal 7 étapes (dont la règle du
  reset à chaque nouvelle compétition, le point demandé ici), lien permanent
  « Comment jouer ? » dans Profil > Compte. Étapes 3→7 illustrées par de
  vraies captures d'écran. Distinct du « mini-tuto outils Next.js/Supabase/
  Vercel » du proto (0.2.10), qui reste un document séparé.
- Notifications journalières programmées (contenu, canal, horaire exacts à
  définir en spec technique).

## Système de ligue

- ~~Groupement d'amis avec mot de passe de ligue, façon MPP~~ **FAIT —
  30/07/2026** (`ETAT_ACTUEL.md` §2.48) : ligue PERMANENTE (indépendante des
  compétitions), adhésion par CODE généré aléatoirement (pas un mot de passe
  choisi), appartenance à plusieurs ligues, rang recalculé dans le groupe.
  VUE FILTRÉE sur le classement existant, comme prévu — aucun système de
  pronos/scoring séparé. Compatible avec 0.2.6, non rouvert. Voir aussi
  `nba_pronos_PREP_SPEC_TECHNIQUE_V1.md` bloc C4 (distinction avec le code
  compétition).

## Fun / esprit ligue entre potes

- ~~Superlatifs de fin de compétition~~ / ~~Badges / titres honorifiques~~
  **FAIT — 30/07/2026** (`ETAT_ACTUEL.md` §2.50) : Nostradamus (le plus de
  bons vainqueurs), Sniper (le plus d'écarts exacts), Meilleur bracket,
  Meilleur 1er tour, Plus grosse remontée — calculés et figés à la clôture
  (`closeCompetition`), ex-aequo tous crédités, aucun titre décerné si la
  valeur max est nulle. "Plus grosse remontée" a nécessité de construire
  d'abord un snapshot quotidien du classement (`leaderboard_snapshots`),
  qui sert aussi de socle pour "courbe d'évolution" ci-dessous (non
  construite). Affiché dans une nouvelle section "Historique" (Profil, pour
  l'instant — voir note ci-dessous).
- **Badges permanents** (redéfini le 30/07/2026, 3e des chantiers
  prioritaires) : des titres/badges visibles en CONTINU pendant la
  compétition (pas seulement révélés à la clôture comme les superlatifs
  ci-dessus). **Emplacement tranché le 04/08/2026** : catégorie dédiée dans
  le nouvel onglet Stats du Profil (voir "Historique & stats" ci-dessous) —
  posée en PLACEHOLDER ("Bientôt disponible") en même temps que le reste de
  l'onglet. **Cadrage CLOS le 08/08/2026** — voir
  `Cadrage/V1/Spec visuelle/SPEC_BADGES_PERMANENTS_V0_1.md` (~30 badges,
  6 axes, paliers Bronze→Diamant, noms validés, approche technique en
  lecture pure via vue SQL). Reste à coder.
- Face-à-face entre deux joueurs précis, match par match / série par série
  — EN OPTION, pas prioritaire, utilité encore incertaine pour
  l'utilisateur.

## Confort au quotidien

- ~~Rappels ciblés (PRIORITÉ)~~ **FAIT — canal Push, 29/07/2026**
  (`ETAT_ACTUEL.md` §2.46) : « tu n'as pas encore pronostiqué le match de ce
  soir » (fenêtre 4h avant coup d'envoi), « la deadline du bracket approche »
  (fenêtre 24h). Canal Email reporté, bloqué sur un nom de domaine vérifié
  (SMTP personnalisé) — le modèle de préférence le couvre déjà.
- ~~Vue admin « qui manque à l'appel » avant une deadline qui approche~~
  **FAIT — 30/07/2026** (`ETAT_ACTUEL.md` §2.49) : `/admin/missing`, un bloc
  par échéance (bracket + chaque match dans la fenêtre 3 jours), liste
  nominative des joueurs ACTIVE manquants. Lecture seule, en complément des
  rappels push automatiques.
- Export calendrier (.ics) des deadlines à venir.

## Historique & stats

- ~~Courbe d'évolution du classement dans le temps~~ **FAIT — 04/08/2026**
  (`lib/queries/stats.ts`, `components/profile/RankEvolutionChart.tsx`) :
  nouvel onglet **Stats** dans Profil (cadré par maquette avant le code,
  comme les couleurs d'équipe le même jour) — courbe d'évolution du rang
  (SVG fait main, aucune librairie de graphes introduite), précision des
  pronos (% bons vainqueurs/écarts exacts, répartition des points), bilan
  des paris perso (taux de réussite, plus gros coup gagné), comparaison à la
  moyenne des autres joueurs (filtrable Général/Ligue, même mécanisme que
  Classement/Bracket), et une catégorie Badges en placeholder (voir "Fun /
  esprit ligue entre potes" ci-dessus). Aucune migration : tout lit des
  données déjà existantes (`user_scores`, `leaderboard_snapshots`, `bets`,
  `match_predictions`). Portée : compétition ACTIVE uniquement, comme
  Classement/Bracket.
- Classement all-time toutes compétitions archivées confondues, en plus du
  classement par compétition. **Garde-fou à ne pas oublier en conception** :
  nécessite que le barème de scoring reste identique d'une compétition à
  l'autre, SINON construire le classement all-time d'une manière qui
  neutralise les changements de barème (ex. classement par rang/points
  relatifs plutôt que total brut). Pas tranché maintenant, juste à ne pas
  oublier.
- Page perso détaillée : historique complet de tous les pronos d'un joueur
  vs résultat réel — à construire SI PAS TROP LOURD (condition posée par
  l'utilisateur, à évaluer en spec technique).

## Partage

- Image exportable du classement ou du bracket rempli, à partager en
  dehors de l'app (génération côté client, pas de dépendance serveur).

## Nom & habillage

- Renommer l'écran Classement en **« Hall of shame »** (28/07/2026). À FAIRE
  VRAIMENT À LA FIN — l'utilisateur finit encore la direction artistique,
  pas la peine de coder ce renommage avant que la DA soit stabilisée
  (renommage cosmétique pur : libellé de nav + titre d'écran, aucun impact
  scoring/statuts/route).

## Personnalisation du profil

- ~~Couleurs de l'interface du Profil adaptées à l'équipe favorite choisie~~
  **REESSAYÉE ET FAITE — 04/08/2026** (`lib/labels/teamColors.ts`,
  `app/(app)/profile/page.tsx`) : 1er essai (30/07/2026, accents doux puis
  fonds/bandeau teintés sur TOUT l'écran) abandonné le jour même ("je ne
  pense pas que ça ait d'importance"), entièrement retiré (code + migration).
  Redemandé explicitement le 04/08/2026 — cette fois cadré par plusieurs
  maquettes (artifact) validées AVANT le code : scope réduit au SEUL bandeau
  d'en-tête (fonds/onglets/boutons neutres, inchangés), photo désaturée puis
  recolorée en 2 tons de l'équipe (mode de fusion CSS `color`, pas une voile
  translucide "comme d'habitude" — jugée trop conventionnelle), blason plein
  à gauche (liseré blanc fin, filtre SVG dilate+composite) et pseudo agrandi
  à droite. Aucune migration : pas de colonne base, pas de toggle
  opt-in/opt-out — s'applique automatiquement dès qu'une équipe favorite est
  choisie (`favorite_team_id` déjà existant), rien ne change sinon. Détail
  complet (itérations de maquette, découverte du bug de `viewBox` SVG,
  vérification en conditions réelles) dans `JOURNAL_SESSIONS.md`.
- ~~Remplacer la liste longue de sélection d'équipe favorite par un menu
  déroulant~~ **FAIT — 30/07/2026** (`TeamPicker.tsx`) : déclencheur
  logo+nom, menu flottant ouvert au clic, toujours de vrais radios (logos
  conservés). 1 bug réel corrigé en testant (sélection perdue à
  l'enregistrement, radios sortis du DOM à la fermeture).
