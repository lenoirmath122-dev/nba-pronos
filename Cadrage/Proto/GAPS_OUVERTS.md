# Gaps ouverts — NBA Pronos

> Liste vivante. Un point retiré = un point traité (voir JOURNAL_SESSIONS.md
> pour la trace de quand/comment). Ne pas laisser de points "résolus mais
> gardés pour mémoire" ici — c'est le rôle du journal.

> **Ordre de reprise, réactualisé avec l'utilisateur (28/07/2026, suite)** —
> **T4 (vraie synchro API Highlightly) est désormais CODÉE et TESTÉE EN
> CONDITIONS RÉELLES** (`ETAT_ACTUEL.md` §2.34) : client, `lib/sync/*`, 4
> routes, dry-run complet sur les vraies affiches/résultats du 1er tour
> Playoffs NBA 2026 (14 matchs réels créés et scorés automatiquement,
> idempotence vérifiée). Quatre correctifs post-validation actés au fil du
> codage, tous documentés dans `SPEC_TECHNIQUE_SYNCHRO_V0.1.md` (§3/§4/§5.2/
> §6/§12) : référentiel équipes par table d'alias (pas de filtre API fiable) ;
> attache match→série déterministe, secours passif par `sync_logs` (pas de
> PENDING/écran de revue, structurellement inapplicable) ; formes réelles du
> client (asymétrie `/teams`/`/matches`, un seul statut confirmé
> empiriquement) ; paramètre `?date=` dev/test. **Reste à trancher avec
> l'utilisateur avant de committer** : sort de la compétition de dry-run
> (laissée ACTIVE à sa demande, pour consultation navigateur). **Prochaine
> étape, à confirmer** : le vrai hub Jouer (aucune spec d'écran encore
> écrite) OU le reste de T6c (Realtime au-delà de l'existant) ; puis
> configurer le vrai planificateur externe (cron-job.org/GitHub Actions) au
> déploiement pour que T4 tourne en continu (§ Déploiement ci-dessous).

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

- **Implémentation code de la V1** (post-T7, EN COURS depuis le 19/07/2026) :
  le HUB JOUEUR (8 écrans), le LOT ADMIN (6 écrans), le CHANTIER T5
  (moteur de scoring, 4 lots) ET le chantier « Gestion des compétitions »
  (3/3 lots, voir entrée dédiée ci-dessous) sont désormais TOUS CODÉS,
  VÉRIFIÉS ET testés en conditions réelles. Reste à coder (ordre de reprise
  ci-dessus) : **T4** (routes `/api/sync/*`, client Highlightly, cron —
  déjà entièrement spécifiée, jamais codée, bloquant = clé API) ; PUIS le
  vrai hub Jouer (remplace le hub temporaire §2.10, aucune spec d'écran
  encore écrite) ; PUIS le Realtime + rendu des états au-delà de ce qui
  existe déjà (T6c). Détail dans `ETAT_ACTUEL.md` §2.
- **Gestion des compétitions — chantier ENTIÈREMENT CLOS (3/3 lots)**
  (ouvert le 27/07/2026, `ETAT_ACTUEL.md` §2.30, suite à une question
  directe de l'utilisateur sur le switch Playoffs/Cup — a révélé que le
  plan d'origine du 16/07/2026 visait la NBA Cup EN PREMIER pour la V1,
  lancement réel visé le 30/10/2026, mais que le jeu de données de test a
  silencieusement dérivé vers Playoffs le 23/07 sans que ça ne soit
  recroisé ; le moteur de scoring T5, lui, n'a jamais dérivé, les deux
  barèmes sont pleinement codés) : lot 1/3 (création), lot 2/3 (saisie des
  résultats + avancement automatique du bracket, `/admin/competitions/
  results`) et lot 3/3 (clôture/archivage, débloqué en cours de route par
  un vrai besoin utilisateur — sans lui, impossible de créer une 2e
  compétition) tous FAITS, VÉRIFIÉS et testés EN CONDITIONS RÉELLES par
  l'utilisateur lui-même (§2.33 `ETAT_ACTUEL.md` pour le détail complet).
  - Hors périmètre des 3 lots, non tranché : mini-bracket NBA Cup (monté
    une fois les 8 qualifiés connus, ~27/11) ; mapping automatique A7
    (pré-remplissage depuis T4, quand elle existera) ; onglet Historique
    côté Profil joueur (`decisions_multi_competitions_historique.md` §4).
    **Reformulé le 28/07/2026** suite à une question directe de
    l'utilisateur (« l'API peut détecter les matchs Cup automatiquement,
    non ? ») : la spec T4 (BRANCHE B, §5.2, empiriquement confirmée) dit
    que l'API est match-centrique, JAMAIS série-centrique — un match
    synchronisé se rattache à une série interne déjà posée, par
    heuristique (paire d'équipes + fenêtre de dates), l'API ne peut pas
    inventer la STRUCTURE d'une série. Détecter les 4 matchs de quarts
    (dates, équipes) est donc plausible via `/api/sync/schedule` ; mais
    construire à partir de ça les 7 séries internes (quarts/demies/finale,
    la bonne équipe au bon slot, distinguer ces matchs de la saison
    régulière qui tombe la même semaine) est une règle JAMAIS écrite ni
    sondée empiriquement — contrairement à la branche A/B des Playoffs
    (sondée sur une vraie requête, §5.1 de T4). Décidé AVEC l'utilisateur :
    reporté à une fois la clé API Highlightly en main, à sonder sur la
    fenêtre Cup réelle de décembre 2025 (déjà citée en test A6) avant de
    concevoir quoi que ce soit.
- **12 vulnérabilités npm — RÉSOLU le 27/07/2026 (suite)**, voir
  `ETAT_ACTUEL.md` §2.32 pour le détail complet : `next` 16.2.10→16.2.12
  (corrige les 9 CVE directes) + `overrides` npm (`minimatch@^10.2.6`,
  `brace-expansion@^5.0.8`, `postcss@^8.5.18`, `sharp@^0.35.0`) pour le
  reste. `npm audit` → 0, `tsc`/`eslint`/`next build`/`npm test` tous
  propres. Committé et poussé sur `main`.
- **`eslint` bloqué en v9, bump v10 reporté en amont** (trouvé le 27/07/2026
  en traitant le point ci-dessus, `ETAT_ACTUEL.md` §2.32) : la montée à
  `eslint@10.8.0` a été tentée, mais `eslint-plugin-react@7.37.5` (embarqué
  par `eslint-config-next@16.2.12`) plante (`TypeError:
  contextOrFilename.getFilename is not a function` — API supprimée par
  ESLint 10). Vérifié sur le registre npm : aucune version stable
  d'`eslint-plugin-react` ne déclare de compatibilité eslint 10 dans son
  `peerDependencies` à ce jour (max `^9.7`). Flagué explicitement avec
  l'utilisateur avant de choisir : reste sur eslint 9 pour l'instant,
  6 vulnérabilités « eslint-plugin-* » neutralisées autrement (overrides
  minimatch/brace-expansion ci-dessus) plutôt que par le bump v9→v10. À
  reprendre : revérifier quand `eslint-config-next` (ou
  `eslint-plugin-react` seul) publie une version compatible eslint 10.
- **Petits points d'intégration des tokens** (ouverts par la consolidation du
  21/07/2026, `app/tokens.css`, non bloquants) : contraste AA de
  `--color-trend` sur fond **clair** (une seule valeur donnée, §15.4, à
  vérifier à l'usage réel) ; `@font-face` Inter **auto-hébergée** pas encore
  ajoutée (l'asset n'est pas fourni, `--font-ui` retombe sur `system-ui`) ;
  asset réel du bandeau parquet (`public/brand/hero-parquet.webp`) pas encore
  déposé (à la charge de l'utilisateur, acté 21/07/2026).
- **T8 — Déploiement** : PARTIELLEMENT FAIT le 27/07/2026 (`ETAT_ACTUEL.md`
  §2.17) — projet Vercel lié + variables d'env poussées + déployé en
  production (https://nba-pronos.vercel.app). Reste : configuration du
  planificateur externe gratuit (cron-job.org / GitHub Actions — fréquences
  des jobs `/api/sync/*` et `/api/heartbeat`), toujours pas traité. S'y
  ajoute désormais : **effacer le jeu de données de test**
  (`ETAT_ACTUEL.md` §2.6/§6) avant tout lancement réel — compétition
  « Playoffs NBA (test) » + son contenu, et les 7 comptes
  `seed-*@nba-pronos.test` via `auth.admin.deleteUser`. Aucun script de
  nettoyage écrit à ce jour (le seed n'est pas idempotent). Le futur script
  devra aussi traiter le compte de démo partagé `demo-amis@nba-pronos.test`
  (créé le 27/07/2026, voir gap dédié ci-dessous) — motif d'email différent
  de `seed-*`, pas couvert automatiquement par un filtre sur ce seul motif.
- **Comportement de « Confirm email » pas élucidé** (27/07/2026,
  `ETAT_ACTUEL.md` §2.17/§7) : le réglage a été décoché et sauvegardé dans
  le dashboard Supabase (confirmé par capture d'écran), mais un test
  contrôlé ET une vraie tentative d'inscription ont quand même buté sur
  `over_email_send_rate_limit`/le message générique catch-all juste après.
  Deux hypothèses non tranchées : quota du mailer par défaut (partagé entre
  tous les types d'email) encore épuisé par un envoi précédent, ou envoi de
  courtoisie indépendant du réglage. Pas revérifié après un délai suffisant
  pour trancher. Solution de contournement immédiate (création de compte
  via API Admin, `email_confirm:true`) utilisée pour la démo, mais ne
  résout pas la question pour une vraie inscription publique en masse — à
  reprendre : soit revérifier après un délai, soit configurer un SMTP
  personnalisé (Resend évoqué, nécessite un nom de domaine vérifié que
  l'utilisateur ne possède pas à ce jour).
- **Compte de démo partagé, temporaire** (27/07/2026, `ETAT_ACTUEL.md`
  §2.17) : `Demo_Amis` / `demo-amis@nba-pronos.test` (rôle PLAYER), créé pour
  que les amis de l'utilisateur testent l'appli SANS vraie compétition entre
  eux (un seul bracket/jeu de pronos partagé par tout le monde — compromis
  signalé et accepté explicitement). **À retirer ou reconvertir** dès que
  l'utilisateur passe à un compte par ami, prévu explicitement après la fin
  de la V1 — même famille que l'autre élément temporaire encore suivi
  (hub Jouer temporaire ; la déconnexion temporaire, elle, est retirée pour
  de bon depuis l'écran Profil, 27/07/2026).
- **Dates du jeu de données de test à re-décaler périodiquement** (trouvé le
  27/07/2026, demande utilisateur — ses amis testeurs, via `Demo_Amis`
  ci-dessus, ne voyaient plus aucun match à pronostiquer ni de bracket
  ouvert) : `bracket_deadline` et les dates des matchs sont des timestamps
  ABSOLUS posés relativement au moment du seed (23/07/2026) — 4 jours plus
  tard, tout était mécaniquement passé. Corrigé une première fois (5 séries
  « sans rôle particulier » + `bracket_deadline` décalées vers l'avenir,
  mêmes offsets relatifs qu'à l'origine ; les 3 matchs à rôle spécial de
  §2.11 — CLE-ORL FINISHED, DEN-SAC IN_PROGRESS, MIN-GSW latence —
  intentionnellement NON touchés). Se reproduira : à recorriger (même
  méthode, script jetable service_role) chaque fois que la démo doit
  redevenir active après quelques jours d'inactivité, tant que le seed
  n'est pas remplacé par un mécanisme relatif à `now()`.
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
- **Règle « pari REJECTED avant/après sa deadline »** (0.2.4 §6, rencontrée en
  codant l'écran Matchs, `lib/queries/matches.ts`) : aucune colonne
  `rejected_at` n'existe (`bets`) — la distinction avant/après n'est donc pas
  calculable. Tranché AVEC l'utilisateur : un pari `REJECTED` est TOUJOURS
  considéré libéré (cas normal, `sealDeadlines` auto-valide tout `SUBMITTED`
  restant à la deadline — un rejet après coup est un cas limite hors
  fonctionnement normal). Le lot « Nouveau pari » (§2.15 `ETAT_ACTUEL.md`,
  fonction `save_bet`, migration #10) applique la MÊME règle pour le quota
  serveur — cohérence maintenue entre lecture (Matchs) et écriture (Nouveau
  pari). Toujours pas de gestion admin du refus (`rejectBet`) à ce jour —
  hors périmètre des deux lots. À rouvrir si une vraie colonne `rejected_at`
  est ajoutée un jour.
- **Aligner le badge de correction de l'écran Matchs sur le rendu nominatif**
  (ajouté le 24/07/2026, lot « Mes pronos » §7.1) : Matchs rend un badge
  **générique** (« Corrigé par un admin », contrat de types `OtherPrediction.
  isAdminCorrected: boolean` figé avant que le rendu nominatif ne soit
  décidé) alors que Mes pronos rend désormais le nom de l'admin + le motif
  en entier (« Saisi par X à la demande de Y — motif »), conformément à
  0.2.3 §7 (garde-fou social, pas technique). Divergence assumée à la
  rédaction de `SPEC_ECRAN_MES_PRONOS_V0_1.md` §7.1, pas reproduite là pour
  raison de symétrie — à trancher : soit étendre le contrat de types de
  Matchs (nom d'admin + nom du requérant), soit assumer la divergence en V1
  et harmoniser plus tard.
- **Tailles inégales entre les 30 logos de franchise** (trouvé le 25/07/2026,
  en corrigeant le décentrage §2.13 de `ETAT_ACTUEL.md`) : le script de
  bounding box a bien réglé le DÉCENTRAGE (chaque `viewBox` colle désormais
  au dessin réel de son propre fichier — confirmé visuellement par
  l'utilisateur), mais il ne les a PAS rendus uniformément CARRÉS entre eux :
  chaque logo garde son aspect ratio naturel (ex. SAS ≈ 2:1 large, LAL quasi
  carré). Conséquence : `object-fit: contain` dans la pastille carrée
  affiche donc les logos très larges (SAS) sensiblement plus PETITS/plus
  fins à l'intérieur de leur pastille que les logos plus carrés (LAL) — un
  problème de TAILLE relative, distinct du décentrage déjà réglé. Pas
  corrigé : nécessiterait soit de recadrer chaque SVG à un ratio carré
  uniforme (perte de marge autour du dessin, à valider visuellement par
  logo), soit une règle de mise à l'échelle différenciée côté CSS — aucune
  des deux tranchée à ce jour.
- **Cohérence des tailles de logo entre écrans** (25/07/2026, §2.13) : la
  carte-sélecteur de l'écran Matchs (`TeamPicker`) est passée à 48px
  (`SPEC_DESIGN_SYSTEM_V0_1.md` §16.1) ; les logos de l'écran Mes pronos
  (`MatchRowStatic`) n'ont PAS été revus à cette occasion et restent à leur
  taille d'origine (20px). Le bracket (`NodeCard`) est également resté
  inchangé (par choix, tier `lg` toujours approprié pour lui). À harmoniser
  si une cohérence stricte entre écrans est voulue.
- **Grossir encore le logo de la carte-sélecteur ?** (évoqué par
  l'utilisateur le 25/07/2026, NON tranché) : au-delà des 48px actuels
  (`--logo-size-lg`), une taille plus grande a été mentionnée comme piste
  possible sans être décidée. À reprendre si le besoin se confirme à
  l'usage.
- **Publication Realtime de `series`** (ajoutée le 24/07/2026, lot « Mes
  pronos »; réévaluée et TOUJOURS REPORTÉE le 27/07/2026, lot « Bracket
  personnel ») : `matches` est désormais publiée (migration #8) — `series`,
  prévue par T4 §9 et resserrée par T6c §14.2 (drill-down série + résumé
  bracket live), n'a PAS été activée par l'écran Bracket personnel
  (remplissage), contrairement à ce qui était anticipé : cet écran précis
  n'affiche que le pick du JOUEUR LUI-MÊME, aucun contenu d'un autre joueur
  à rafraîchir en direct. Le besoin identifié à l'origine (drill-down/résumé
  LIVE) concerne la vue GLOBALE (`/bracket`, déjà codée, fonctionne en SSR
  sans lui) — à activer SI ET QUAND cet écran-là a un besoin live réel,
  toujours pas le cas à ce jour.
- **Logos de franchise sur Accueil et Classement** (trouvé le 24/07/2026 : les
  30 SVG existent bien dans `public/logos/teams/` et sont déjà committés,
  mais aucun écran ne les affichait — câblés le même jour sur Bracket et
  Matchs, `components/ui/TeamLogo.tsx`, chemin déduit de l'abréviation, sans
  toucher aux contrats de types). Accueil et Classement laissés de côté
  volontairement : Classement n'affiche aucune équipe (classement de
  joueurs) ; Accueil ne porte les équipes que dans du texte déjà formaté
  (`TodoItem.subtitle`, `FeedItem.label`, ex. « Prochain : BOS - ATL ») —
  y ajouter un logo demanderait de restructurer ces contrats de type en
  objets équipe, un changement plus large qu'un simple ajout visuel. À
  décider plus tard : soit dans ce sens (restructurer), soit un simple
  remplacement texte→texte+logo par extraction regex du subtitle/label,
  moins propre.
- **Hub Jouer temporaire** (24/07/2026, posé pour pouvoir naviguer jusqu'à
  l'écran Matchs — jusqu'ici codé mais inaccessible depuis l'UI, l'onglet
  « Jouer » pointant sur un stub) : `app/(app)/play/page.tsx` (+
  `page.module.css`) liste 4 entrées — « Matchs », « Mes pronos » ET
  désormais « Paris » (26/07/2026, → `/play/bets/new`) en `<Link>` actifs,
  seule « Mon bracket » reste INERTE (route `/play/bracket` inexistante à ce
  jour) avec le libellé « à venir ». Marqué temporaire aux trois endroits
  (commentaire code, mention visible « hub temporaire — sera remplacé »,
  cette entrée). Aucune pastille « à faire » calculée (hors périmètre, rôle
  du vrai hub). **À retirer** dès que le vrai hub Jouer (spec d'écran dédiée,
  pas encore écrite) existe.
- **Deux points design jamais remontés depuis le journal de la passe
  maquettes** (ils n'existaient que dans
  `JOURNAL_DESIGN_passe_maquettes.md` §4, d'où l'oubli) : **portée du
  bandeau parquet** (recommandé « arène-only » : Matchs, Bracket, Accueil —
  avec en-tête plus calme sur Classement et Profil, à confirmer, sachant
  que Classement est déjà codé) ; et **thème clair du bandeau** (garder la
  bande sombre partout comme acté en §15.7, ou prévoir un éclaircissement
  de la photo en thème clair — même asset, filtre différent).
- **Révélation publique des paris des AUTRES joueurs** (0.2.4 §9, décision
  fonctionnelle actée mais JAMAIS construite nulle part — trouvé en codant
  Mes paris, 27/07/2026, `ETAT_ACTUEL.md` §2.19, en vérifiant le code réel
  d'`AssociatedBetCard` qui ne lit que `user_id = auth.uid()`) : chaque pari
  devrait devenir visible publiquement (nominatif) à sa propre deadline —
  la RLS `bet_is_public()` existe déjà et fonctionne (T3), mais aucun écran
  (Matchs, Mes pronos, Mes paris) ne l'exploite pour afficher les paris
  d'AUTRES joueurs. Décision explicite (27/07/2026) : Mes paris reste
  personnel pour l'instant (comme le faisait le prototype, qui avait un
  écran public séparé, jamais repris en V1) — ce point reste ouvert, sans
  écran assigné pour l'accueillir.
- **Contester un pari REJETÉ ou déjà résolu GAGNÉ/PERDU** (trouvé en codant
  Mes paris, 27/07/2026, `ETAT_ACTUEL.md` §2.19) : le mécanisme de
  correction ajouté (migration #11) ne couvre QUE le cas « pari VALIDATED
  jamais résolu » — `enforce_bet_transitions` traite REJECTED/WON/LOST comme
  des états TERMINAUX, aucune règle ne permet d'en sortir. Étendre à la
  contestation d'un refus ou d'une résolution déjà posée nécessiterait une
  extension de ce trigger, pas seulement une nouvelle fonction — décision
  explicite de ne pas le faire dans ce lot.
- **Bandeau sticky non traité pour la saisie inline dans Matchs** (27/07/2026,
  `ETAT_ACTUEL.md` §2.15 suite) : le formulaire dédié (`BetForm.tsx`) a son
  contenu fixé en bas de viewport, mais `InlineBetForm.tsx` (Matchs) ne l'a
  PAS reproduit — si deux lignes de match étaient dépliées simultanément avec
  leur formulaire ouvert, deux bandeaux fixes entreraient en conflit (un seul
  formulaire à la fois sur l'écran dédié, potentiellement plusieurs ici). Pas
  tranché : à reprendre si le besoin se confirme à l'usage (ex. ancrer le
  bandeau à la ligne plutôt qu'au viewport, ou l'exclure explicitement).
- **Garde `bet_scope=SERIES` interdit en NBA Cup non testée en conditions
  réelles** (26/07/2026, `save_bet`, migration #10) : le jeu de données de
  test ne porte qu'une compétition PLAYOFFS active — le refus d'un pari
  SÉRIE quand la compétition est NBA_CUP a été vérifié par relecture du code
  SQL uniquement, jamais exercé en live faute d'une compétition NBA Cup de
  test. À vérifier en conditions réelles si/quand un jeu de données NBA Cup
  existe.
- **Admin capable de valider son PROPRE pari** (trouvé le 28/07/2026 par
  l'utilisateur en testant la saisie d'un pari sur la compétition de
  dry-run T4) : `lib/actions/admin-validation.ts::validateBet`/`rejectBet`
  ne vérifient QUE `is_admin()` (via RLS) et le statut `SUBMITTED` du pari
  — aucune garde n'empêche `validated_by_admin_id = bets.user_id` (l'admin
  qui soumet un pari, ADMIN = joueur + droits admin, 0.2.1, peut ensuite se
  valider lui-même dans la file de validation). Le seul précédent connu de
  ce principe est explicitement acté pour les requêtes de correction
  (« un admin ne peut jamais traiter sa propre requête », 0.2.3 — via
  `handled_by_admin_id`, « jamais l'auteur ») mais n'a jamais été étendu ni
  discuté pour la validation normale des paris (`SPEC_ECRAN_ADMIN_
  VALIDATION_V0_1.md`, aucune mention). Pas corrigé — à trancher : soit
  bloquer explicitement (garde applicative, `user_id != validated_by_admin_id`),
  soit assumer que la confiance repose sur le nombre réduit d'admins et le
  traçage `audit_logs` (déjà en place, visible dans « Historique des logs »).
- **Friction UX — prono et pari saisis ensemble sur un même match, dans
  Matchs** (trouvé le 28/07/2026, testé sur la compétition de dry-run T4) :
  valider le prono ET le pari nécessite deux clics « Valider » séparés
  (comportement voulu — deux workflows/tables distincts, `match_predictions`
  vs `bets`). Mais si le prono est validé EN PREMIER, `PredictionForm.tsx`
  (ligne 48 : `if (match.viewStatus === "VALIDATED") return ...`) bascule la
  ligne en lecture seule et démonte `<InlineBetForm>` avec elle — il devient
  alors impossible de saisir/soumettre le pari associé depuis l'onglet
  Matchs, il faut repasser par l'onglet Paris dédié (`/play/bets/new`), pas
  pratique si les deux étaient prévus dans la même session. Pas corrigé —
  piste à explorer : rendre `InlineBetForm` indépendant du `viewStatus` du
  prono plutôt que conditionné par le même early-return.

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
- **Écran Accueil (session du 21/07/2026, `lib/queries/home.ts`)** :
  - Item « À traiter » du bracket : si `competitions.bracket_deadline` est
    NULL (deadline pas encore connue), l'item **n'apparaît pas** (rien à
    compter à rebours). Pas tranché par la spec produit, à confirmer si ce
    cas se présente réellement en usage (aucune compétition en base pour
    l'instant, §3 `ETAT_ACTUEL.md`).
  - Feed « Ça vient de tomber », item « Pari statué par l'admin » : la spec
    citait la colonne `resolved_at` mais illustrait le rendu par le texte
    « validé / ajusté » (qui décrit en réalité `validated_at`, un workflow
    différent). Tranché AVEC l'utilisateur (AskUserQuestion, 21/07/2026) :
    lecture littérale de la colonne citée → l'item correspond aux paris
    ANNULÉS (`CANCELLED`), libellé rendu « Neutralisé ». Voir
    `ETAT_ACTUEL.md` §7 et `JOURNAL_SESSIONS.md`.
  - Bloc « À traiter (paris) » : la spec ne détaille pas la mécanique de
    « slot à reproposer » côté requête. Interprété comme les paris
    `REJECTED` dont la deadline (`bet_deadline_open`, calcul reproduit en
    TypeScript, pas d'appel RPC) n'est pas encore passée — lecture directe
    de 0.2.4 §6 (« refusé avant deadline → slot libéré »), pas une
    invention. Paris `DRAFT` (brouillons) inclus de la même façon.
- **Écrans Classement/Bracket (session du 22/07/2026,
  `lib/queries/{leaderboard,bracket}.ts`)** :
  - Nav des routes physiques uniques `/leaderboard` et `/bracket` (hors
    route groups, T6a §3.2/§8.1) : la spec produit ne détaillait pas
    l'implémentation, seule l'archi T6a la prescrivait (« la page choisit
    elle-même sa nav selon la session »). Ajouté `components/nav/
    ScreenShell.tsx` (choix TabBar/nav réduite) + `components/nav/
    PublicNav.tsx` (extrait de `(public)/layout.tsx`, désormais partagé,
    stylé aux tokens — il ne l'était pas). Décision structurelle appliquée
    directement (déjà actée par T6a, pas une nouvelle règle produit).
  - `filledCount`/`totalCount` de `BracketData` (« progression X/15 ou
    X/7 ») : le contrat de type n'a pas de `userId`, donc pas de notion de
    « mon bracket rempli à X/15 ». Interprété comme la progression du
    TOURNOI (nombre de séries dont le résultat officiel est déjà connu),
    cohérent avec « vue A résumé... état réel de chaque série ». À
    confirmer si une autre lecture était voulue.
  - Le contrat `BracketNode` (spec §15.2, recopié à l'identique) n'expose
    pas le score de série RÉEL (`series.official_score_format`) — seulement
    `actualWinnerAbbreviation`. La carte de série (vue A/B) affiche donc le
    vainqueur seul, jamais le score exact de la série, y compris en
    Playoffs. Pas un oubli de code : le type imposé par la spec ne porte
    pas ce champ. À rouvrir si le score de série réel doit être affiché.
  - « Or = champion » (§17) appliqué STRICTEMENT à la finale (NBA_FINALS /
    CUP_FINAL) : le vainqueur d'une série normale (tour 1, demies, etc.)
    est rendu en vert (résultat gagné), jamais en or — lecture littérale de
    « champion déduit du bracket », pas une extension à chaque série.
  - Libellés de tour (« 1er tour », « Demi-finales de conférence », etc.) et
    nom de compétition générique (« Playoffs » / « NBA Cup », faute de
    `competitionName` dans `BracketData`) : texte de rendu choisi par
    l'implémentation, pas fourni par la spec ni par le schéma.
- **Écran Matchs (session du 23/07/2026, `SPEC_ECRAN_MATCHS_V0_1.md`)** :
  - la fenêtre 3 jours filtre sur **`scheduled_at > now()`**, jamais sur
    `matches.status` — le planificateur tournant toutes les 30-60 min (T4/A8),
    un match commencé peut rester `SCHEDULED` en base près d'une heure ; le
    verrouillage est piloté par l'heure connue, jamais par le live (T6c §10.3) ;
  - `N` du compteur « X/N ont pronostiqué » = joueurs **`ACTIVE` uniquement**
    (un `DISABLED` n'écrit plus, l'y compter rendrait `N/N` inatteignable) —
    sans contradiction avec sa conservation au classement, qui porte sur
    autre chose ;
  - « accéder à un match oublié » = **consulter** + déposer une **requête de
    correction** (0.2.3 §7), **jamais** une réouverture de la saisie (le
    verrouillage au coup d'envoi reste irréversible, 0.2.3 §4).
- **Écran Matchs — implémentation (session du 23/07/2026,
  `lib/queries/matches.ts`, `components/matches/*`)** :
  - regroupement par jour (« Ce soir »/« Demain »/« Samedi 25 ») en fuseau
    **Europe/Paris**, explicite — aucune convention de fuseau n'existait
    ailleurs dans le code, le fuseau machine du serveur pouvant être UTC en
    hébergement ;
  - « pavé numérique » de saisie de l'écart (§6) = `<input type="number"
    inputMode="numeric">`, qui déclenche le clavier numérique natif du
    système sur mobile — pas de grille de touches custom construite ;
  - badge « corrigé par un admin » : le contrat de types figé (§13,
    `OtherPrediction.isAdminCorrected: boolean`) ne porte ni le nom de
    l'admin ni celui du requérant (que la prose §8 mentionne littéralement,
    « saisi/corrigé par X sur requête de Y ») — le type fait autorité,
    rendu générique sans nom ;
  - statuts de prono (§4) et rappel « ✓ LAL −8 » : rendus en CSS pur (tokens
    de bordure/fond) + caractères (✓, →), aucune icône SVG créée — la spec
    elle-même écrit le rappel en toutes lettres avec un caractère ✓.
- **Écran Mes pronos (session du 24/07/2026, `SPEC_ECRAN_MES_PRONOS_V0_1.md`,
  `lib/queries/my-predictions.ts`, `components/my-predictions/*`)** :
  - **Dérivation d'état par COMPLÉTUDE, jamais par statut brut** (tranché AVEC
    l'utilisateur, ambiguïté non couverte par le tableau fermé §8) :
    `sealDeadlines` (auto-validation DRAFT complet → VALIDATED, T6b §2) n'est
    invoquée nulle part dans le code (aucun cron, aucune fonction de ce nom) —
    une ligne DRAFT aux deux champs remplis est donc un 4e cas réel. Rendu
    FROZEN par complétude, symétriquement pour mon prono et ceux des autres
    joueurs (RevealPanel) ;
  - le requérant d'une correction étant toujours le propriétaire du prono
    (§7.1), le rendu nominatif distingue « à ta demande » (mon propre prono,
    `PredictionSummary`) de « à la demande de <pseudo> » (prono d'un autre,
    `RevealPanel`) — aucune donnée supplémentaire à lire, juste un choix de
    formulation selon qui affiche le bloc ;
  - filtre date (§4.2) : `<input type="date">` natif (pas un `<select>`
    contraint aux `availableDates`), conformément à la lettre de la spec —
    une date hors du jeu de données mène simplement à l'état vide « Aucun
    match pour ce filtre » (§15.4), pas une erreur ;
  - libellé de série des filtres/en-tête de pari (§4.2/§11.2), non fixé par
    la spec : `<libellé de tour> — <équipe1> vs <équipe2>` (ex. « 1er tour —
    BOS vs MIA »), construit via `lib/labels/rounds.ts` + `series.team1_id/
    team2_id` (pas les home/away du match, qui peuvent être inversés d'un
    match à l'autre de la même série) ;
  - pari MATCH/SERIES affiché (`AssociatedBetCard`) : `catégorie` suit la
    même règle que `difficulté` (`validated_category ?? proposed_category`,
    la validée fait foi, 0.2.4 §7) — la spec ne le précise que pour la
    difficulté, extension jugée cohérente plutôt qu'une nouvelle règle.
- **Écran Nouveau pari (sessions du 26-27/07/2026,
  `SPEC_ECRAN_NOUVEAU_PARI_V0_1.md`, `lib/queries/bets.ts`,
  `lib/actions/bets.ts`, `components/bets/BetForm.tsx`,
  `components/matches/InlineBetForm.tsx`)** :
  - **choix structurant confirmé AVEC l'utilisateur** : écriture via 2
    fonctions SQL `SECURITY DEFINER` (`save_bet`/`withdraw_bet`, migration
    #10, patron `request_prediction_correction`) plutôt qu'une logique
    TypeScript pure — seule façon de fermer, par un `pg_advisory_xact_lock`,
    la fenêtre de course sur le cap « 3 MATCH/série » (aucun backstop
    d'index unique pour ce quota précis, contrairement aux deux quotas
    « 1 actif ») ;
  - défaut de scope à l'entrée libre (`mode: "FREE"`, `BetForm.tsx`) : `MATCH`
    par défaut (pas `SERIES`), simple choix d'ergonomie non fixé par la
    spec — ajustable sans changement de contrat de données ;
  - tier de logo des sélecteurs série/match (§13, non fixé par la spec) :
    20px, cohérent avec les lignes de liste existantes (`MatchRowStatic`,
    Mes pronos) plutôt qu'un nouveau tier ;
  - sélecteurs série/match = listes de boutons (`role="radio"`), pas des
    `<select>` natifs — un `<option>` HTML ne peut pas afficher de logo,
    exigé par §13 sur ces deux sélecteurs précisément (catégorie/difficulté,
    sans logo, restent des `<select>` natifs) ;
  - pari non éditable ici (statut non DRAFT/SUBMITTED, propriétaire différent,
    ou `betId` invalide) sur `/play/bets/[id]/edit` : état inerte affiché
    plutôt qu'une redirection vers « Mes paris », qui n'existait pas encore
    à l'époque — pas un choix produit, une conséquence du séquencement des
    lots. SUPERSEDÉ le 27/07/2026 : « Mes paris » existe désormais
    (`ETAT_ACTUEL.md` §2.19) — faire pointer cet état inerte vers
    `/play/bets` reste une amélioration possible, non faite (pas demandée) ;
  - saisie inline MATCH dans Matchs (27/07/2026, demandée explicitement
    par l'utilisateur en cours de session, PAS dans la spec close) : élargit
    le périmètre acté par la spec §1 (deux points d'entrée vers un écran
    dédié) — confirmé avec l'utilisateur avant de coder, pas une extension
    silencieuse. Les paris SÉRIE restent exclusivement sur l'écran dédié.
- **Écran Bracket personnel (session du 27/07/2026,
  `SPEC_ECRAN_BRACKET_PERSONNEL_V0_1.md`, `lib/queries/bracket-fill.ts`,
  `lib/actions/bracket-fill.ts`, `components/bracket-fill/*`)** :
  - **AUCUNE spec n'existait pour cet écran** (contrairement aux lots
    précédents, qui avaient au moins un brouillon) — rédigée EN SÉANCE avec
    l'utilisateur, appuyée sur des décisions déjà actées (0.2.2, 0.2.9 §5)
    plutôt que devinée ;
  - **choix structurant confirmé AVEC l'utilisateur** : écriture en
    TypeScript pur (RLS existante suffit, PAS de fonction SECURITY DEFINER)
    — à l'inverse du choix fait pour « Nouveau pari » ; chaque lot a été
    évalué sur ses propres besoins de concurrence, pas un patron copié
    automatiquement du lot précédent ;
  - garde-fou explicite hérité du prototype (pas une invention) : la cascade
    des candidats de tour 2+ dérive TOUJOURS du pick du joueur, jamais du
    résultat officiel — `computeCandidateTeamIds` ne lit même pas les
    colonnes de résultat, structurellement incapable de reproduire le bug
    historique (voir `ETAT_ACTUEL.md` §7) ;
  - Realtime `series` (T4 §9) : réévaluée pour ce lot précisément, TOUJOURS
    reportée (aucun besoin live sur un écran de saisie personnelle) — voir
    gap dédié ci-dessus ;
  - tap vainqueur + boutons de score sauvegardent IMMÉDIATEMENT (pas de
    bouton "enregistrer" séparé) — lecture littérale de 0.2.9 §5 ("vainqueur
    en 1 tap"), cohérent avec l'absence de champ texte sur cet écran
    (contrairement à Nouveau pari, qui a un énoncé libre à saisir) ;
  - validation du bracket sans garde de complétude (0/15 à 15/15 accepté) :
    lecture littérale de 0.2.2 §3, confirmée par le comportement du
    prototype avant réécriture.
