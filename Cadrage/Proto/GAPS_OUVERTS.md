# Gaps ouverts — NBA Pronos

> Liste vivante. Un point retiré = un point traité (voir JOURNAL_SESSIONS.md
> pour la trace de quand/comment). Ne pas laisser de points "résolus mais
> gardés pour mémoire" ici — c'est le rôle du journal.

## Gaps techniques du prototype (à corriger ou trancher dans son périmètre)

- **Performance de `lib/botScripting.ts`** : requêtes Supabase séquentielles
  non groupées par bot (pas de batch/`Promise.all`). Avec 16 bots, un
  "Avancer de N jours" avec N élevé (testé à 60) a saturé la mémoire du
  process Node et bloqué l'admin ~84 secondes. Contourné côté UI
  (`AdvanceManyDaysControl` avance jour par jour), code non optimisé.
  Jugé hors scope pour un prototype jetable — pas de correction prévue sauf
  gêne concrète en usage.

## Ouvert pour les phases suivantes de la V1 (implémentation + T8)

> La RLS (précédemment listée ici comme « reportée en V1 ») est FAITE et
> TESTÉE de bout en bout depuis la session du 18/07/2026 (migrations #3/#4,
> plan de test T3 §7) — retirée des points ouverts. Voir `JOURNAL_SESSIONS.md`
> et `ETAT_ACTUEL.md`.

> Le choix du fournisseur d'API NBA (Highlightly, tranché dès la session du
> 17/07/2026) et le mécanisme de synchro (architecture complète, T4, session
> du 18/07/2026 suite) sont désormais FAITS et VALIDÉS. L'attache match → série
> (branche A vs B), seule réserve empirique restante à la validation de T4, est
> également tranchée par le repérage API du même jour : BRANCHE B retenue.
> Aucun de ces points n'apparaît donc plus ci-dessous. Voir
> `SPEC_TECHNIQUE_SYNCHRO_V0.1.md` et `JOURNAL_SESSIONS.md`.

> Le moteur de scoring (T5, session du 19/07/2026) est désormais FAIT et
> VALIDÉ : dérivation de l'agrégat de série, barèmes Playoffs + NBA Cup,
> neutralisation A2, et déclencheurs de recalcul (`recomputeMatch` /
> `recomputeSeries` / `recomputeBet` / `recomputeCompetition`, T5 §10.1)
> actés avec la couture T4. Les 3 points renvoyés à T5 n'apparaissent donc
> plus ci-dessous. Voir `SPEC_TECHNIQUE_SCORING_V0_1.md` et
> `JOURNAL_SESSIONS.md`.

> Les specs **T6** (T6a/T6b/T6c — arbre `app/` + route groups, server
> actions joueur/admin + garde-fou C2, Realtime + rendu des états actés) et
> **T7** (design system) sont désormais FAITES et VALIDÉES (session du
> 19/07/2026) : la série de specs techniques **T1 → T7 est entièrement
> bouclée**. Le rendu des états UX déjà actés fonctionnellement (paris
> annulés barrés/grisés, joueurs absents en compteur, marquage public de
> correction, joueur inactif conservé) est désormais entièrement SPÉCIFIÉ
> par T6c/T7 — le point ouvert n'est plus « spécifier » mais « coder » (voir
> le point d'implémentation ci-dessous). Voir
> `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md` /
> `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_b.md` /
> `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_c.md` / `SPEC_DESIGN_SYSTEM_V0_1.md`
> et `JOURNAL_SESSIONS.md`.

- **Implémentation code de la V1** (post-T7, EN COURS depuis la session du
  19/07/2026 suite) : plomberie Supabase (3 clients T6a §2.4), garde
  d'authentification (`proxy.ts`, T6a §4.1) et flux complet
  login/signup (T2 §4) sont CODÉS et vérifiés (build + serveur dev). Encore
  À CODER : tout écran joueur (Accueil, hub Jouer, classement/bracket
  partagés, admin), les server actions au-delà de l'auth (T6b), le moteur de
  synchro/scoring (T4/T5), le Realtime + rendu des états (T6c), les tokens
  visuels (T7 — aucun écran n'est encore stylé selon le design system).
  Prochaine étape concrète : l'écran Accueil (`app/(app)/home`, 0.2.9 §3),
  le premier vrai écran joueur. Détail dans `ETAT_ACTUEL.md` §2.
- **T8 — Déploiement** : configuration du planificateur externe gratuit
  (cron-job.org / GitHub Actions — fréquences des jobs `/api/sync/*` et
  `/api/heartbeat`), variables d'env et secrets côté Vercel — pas encore
  traité.
- **Pré-remplissage IA gagné/perdu des paris** (reporté, non bloquant V1) :
  évolution envisagée pour suggérer gagné/perdu à partir des données du
  match (réaliste pour les paris déductibles de scores/box scores, inopérant
  pour les paris flous/subjectifs), l'IA ne restant qu'une aide, jamais
  l'autorité finale (`nba_pronos_SPEC_FONCTIONNELLE_V0_2.md` §6.7/§10.7).
  Faisabilité et périmètre exact toujours renvoyés à la spec technique — non
  traité par T1/T2/T3, ni par T6/T7 (hors périmètre, aucune mention).
- **Barème stable pour un futur classement all-time** (backlog) : un
  classement all-time toutes compétitions confondues nécessite que le
  barème de scoring reste identique d'une compétition à l'autre, sinon il
  doit être construit d'une manière qui neutralise les changements de
  barème (ex. rang/points relatifs plutôt que total brut). Pas tranché,
  juste à ne pas oublier en conception si le barème change (`BACKLOG_V1.md`).

## Points ouverts issus de la passe design maquettes (T7 sur écrans réels,
## session du 20/07/2026 — voir `Cadrage/V1/JOURNAL_DESIGN_passe_maquettes.md`
## et `JOURNAL_SESSIONS.md`)

- **Couleurs de statut de prono** à réconcilier : 0.2.9 §4 avait validé
  validé/prêt/incomplet/à faire en vert/ambre/gris/bleu, or T7 réserve
  **vert = gagné** et **or = champion** (résultats de jeu, non des statuts de
  saisie). Une réconciliation est **proposée** (statuts de prono recolorés
  hors vert/ambre) mais **non validée** — à trancher avant de coder l'écran
  Matchs.
- **Saisie de l'écart** (0.2.3 §3) : stepper `−/+` seul, ou stepper **+
  saisie libre au pavé numérique** ?
- **Écran Matchs replié (accordéon)** : vue par défaut, ou bascule
  compacte/détaillée au choix du joueur ?
- **Entrée pari sur la carte de match** (0.2.9 §12) : l'indicateur passe de
  `x/3` à **binaire** (cohérent avec 1 pari/match en NBA Cup) — détail exact
  du rendu UI à acter.
- **Gains des paris par niveau** + forme de progression (linéaire vs
  « jackpot ») : point ouvert de 0.2.5, toujours pas tranché.
- **Marqueur « corrigé »** au classement : wording exact + placement.
- **Séparateur visuel du Total** (tableau classement desktop) : à trancher.
- **Vue B « arbre » du bracket en plein écran paysage** (0.2.9 §5/§10) :
  comportement exact toujours à faire.

## Interprétations d'implémentation actées (pas des gaps — à connaître, et à
## reporter dans `decisions_0.2.x` si l'utilisateur le souhaite un jour)

- Seuil "10 brackets remplis" (0.2.6) compté SÉRIE PAR SÉRIE, pas sur le
  bracket entier à 15/15.
- Classement : rang affiché TOUJOURS calculé sur Total, peu importe la
  colonne triée à l'affichage.
- "dont Écarts" rendu triable au classement — pas une des 5 colonnes
  officielles listées par 0.2.6/0.2.9.
- Tri alphabétique du classement par pseudo : différé en V1.
- Révélation d'un prono dès `VALIDATED`, peu importe volontaire ou
  auto-validé — simplification assumée par rapport à 0.2.3 §5 (distinction
  jamais observable en pratique).
