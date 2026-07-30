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

## Tutoriel & notifications

- Tutoriel d'utilisation de l'appli pour le JOUEUR (comprendre que l'app se
  reset à chaque nouvelle compétition) — à distinguer du « mini-tuto outils
  Next.js/Supabase/Vercel » du proto (0.2.10), qui reste un document séparé
  et différent.
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

- Superlatifs de fin de compétition (généré automatiquement à la clôture —
  s'appuie sur `competition_archives` déjà existant). Ex : « meilleur 1er
  tour », « plus grosse remontée au classement ».
- Badges / titres honorifiques (gamification légère, aucun impact sur le
  scoring réel). Ex : « Nostradamus » (le plus de bons vainqueurs).
- Face-à-face entre deux joueurs précis, match par match / série par série
  — EN OPTION, pas prioritaire, utilité encore incertaine pour
  l'utilisateur.

## Confort au quotidien

- ~~Rappels ciblés (PRIORITÉ)~~ **FAIT — canal Push, 29/07/2026**
  (`ETAT_ACTUEL.md` §2.46) : « tu n'as pas encore pronostiqué le match de ce
  soir » (fenêtre 4h avant coup d'envoi), « la deadline du bracket approche »
  (fenêtre 24h). Canal Email reporté, bloqué sur un nom de domaine vérifié
  (SMTP personnalisé) — le modèle de préférence le couvre déjà.
- Vue admin « qui manque à l'appel » avant une deadline qui approche.
- Export calendrier (.ics) des deadlines à venir.

## Historique & stats

- Courbe d'évolution du classement dans le temps (pas juste l'état figé
  actuel).
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

- Couleurs de l'interface du Profil adaptées à l'équipe favorite choisie
  (28/07/2026) — SI un choix a été fait (`favorite_team_id` non NULL),
  sinon comportement par défaut inchangé. Nécessite une source de couleur
  par équipe (aucune colonne dédiée aujourd'hui, `teams` ne porte que
  `logo_url` — à voir en spec technique : couleurs codées en dur par équipe,
  ou dérivées d'un asset).
- Remplacer la liste longue de sélection d'équipe favorite (actuellement
  `components/profile/TeamPicker.tsx`, une liste de 30 boutons radio) par
  un **menu déroulant** (28/07/2026) — accès plus rapide, moins de
  défilement. Compatible avec les 30 logos existants (à voir si le menu
  déroulant les affiche ou reste texte seul, en spec technique).
