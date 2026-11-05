# Chantier — classement hebdomadaire et popup hebdo LLM

> **Nature** : vivant. Détail complet du chantier, sorti de
> `GAPS_OUVERTS.md` le 12/10/2026 (section « Classement hebdomadaire », reprise telle quelle).
> **À ne lire que quand la session porte sur le classement hebdo, le récap hebdo ou la popup LLM.** Le résumé des points ouverts et la
> prochaine étape restent dans `GAPS_OUVERTS.md` ; quand un point est
> traité, le retirer ici ET là-bas.


> Stratégie complète et décisions : `BACKLOG_V1.md` (section « Fun /
> esprit ligue entre potes »). Aucun code à ce jour.

- **Échéance : lots 0 et 1 déployés, migrations poussées, avant le lundi
  26/10/2026** (premier figement, semaine du changement d'heure). Si les
  migrations ne sont pas poussées, le figement hebdo répond 500 avec un
  message explicite (lot 1).
- **Lot 0 codé le 11/10/2026, PR #155 (à merger)** : snapshot figé (pris au
  premier passage après 10 h Paris, jamais réécrit, trigger anti-UPDATE),
  `correct_match_winners`/`exact_margins` persistés (nullables, pas de
  backfill : le lot 1 traite NULL comme « départage inconnu »), figement
  branché sur `/api/recaps` (avant les récaps, isolé), 3e cron Vercel
  `0 10 * * *`, erreurs Supabase remontées en 500. Le workflow GitHub
  `snapshot-leaderboard.yml` est gardé en secours (ne peut plus rien écraser).
  **Reste à faire par l'utilisateur** : (1) vérifier dans Vercel (Settings →
  Cron Jobs) que le plan autorise 3 crons, sinon retirer celui de 10 h UTC ;
  (2) pousser la migration `20261011090000_leaderboard_snapshots_frozen.sql`
  puis `supabase migration list` (sans elle, 500 chaque jour) ; (3) après
  déploiement, `POST /api/snapshots/leaderboard?force=1` deux fois (2e =
  « déjà figé ») ; (4) tests d'intégration Docker du trigger et de
  `delete_account_data` (non lancés). Points relevés à la revue : deux
  compétitions ACTIVE feraient échouer le snapshot (500) alors que `runRecaps`
  se tait (invariant « une seule ACTIVE » non documenté ailleurs) ; le champ
  `late` n'est consommé par rien ; la réponse de `/api/recaps` est maintenant
  `{ snapshot, recaps }` (aucun lecteur) ; pagination (limite 1000 lignes
  PostgREST) absente de `computeBiggestClimb`, dette existante. Les snapshots
  déjà pris avant la migration (ex. 11/10 à 12 h UTC) auront des colonnes de
  départage NULL. Déployer avant le lundi 19/10 10 h (première semaine DAILY_MATCH).
- **Lot 0 mergé (PR #155, 11/10/2026).** **Lot 1 mergé (PR #156, 11/10/2026)** :
  migration `20261012090000_weekly_ranking.sql` **appliquée en production le
  11/10/2026** (outil MCP Supabase, CLI absente ; version de l'historique
  réalignée sur celle du fichier, avec l'accord de l'utilisateur),
  `lib/weekly/*`, figement dans `/api/recaps`, bouton « Figer la semaine » et
  interrupteur sur `/admin/competitions`. **Reste à faire par l'utilisateur** :
  (2) activer `weekly_ranking` sur la vraie compétition (interrupteur admin ou
  case à la création) ; (3) vérifier après le premier lundi 10 h que
  `weekly_rankings` a une ligne (premier figement possible le 26/10 : la
  première semaine n'a pas de snapshot de référence, décidé). Comportement :
  semaine sautée ou snapshot en retard = rattrapage automatique (`endLate` /
  `baselineLate` dans la réponse de la route), départage NULL (snapshots
  d'avant le lot 0) = classement aux points seuls, un champion figé ne se
  retire que par DELETE SQL manuel. Dette : lecture d'un snapshot limitée à
  1000 lignes PostgREST, tests d'intégration Docker (trigger, RPC concurrent,
  `delete_account_data`) non lancés. **Quand `weekly_ranking` est actif, le
  lundi reçoit le récap journalier** ; le hebdo « Ta semaine » automatique
  n'existe plus pour cette compétition (le hebdo manuel arrive au lot 3).
  **Limites relevées à la revue** : (a) le cron refuse de figer quand le
  snapshot de départ est plus ancien que le lundi n-1 (`skipped: "départ trop
  ancien…"`, réponse 200) : seul le bouton admin tranche ; un skip « snapshot
  de fin absent » ou « première semaine » n'alerte personne, à surveiller le
  26/10 ; (b) l'Accueil (`lib/recaps/home.ts`, `visibleWeeklyPeriod`) affiche
  toujours la carte hebdo « Ta semaine » le lundi, même quand le push du lundi
  est devenu journalier : à trancher au lot 2/3 ; (c) pas de test pour
  `runRecaps`, `getActiveCompetitionSummary` et les actions admin.
- **Lot 2 codé (branche `feat/classement-hebdo-lot2`, 11/10/2026, PR à
  ouvrir)** : vue Semaine du Classement, voir `ETAT_ACTUEL.md` §4.6. Décidé avec
  l'utilisateur : Accueil du lundi non touché (« Ta semaine » reste affichée le
  lundi alors que le push est journalier : à reprendre au lot 3), ordre fixe en
  Semaine, anciens liens vers Général. Reste : limite PostgREST 1000 lignes
  (`user_scores` et snapshot, à traiter ensemble), lundi : écran « semaine vient
  de commencer » tant que le cron des snapshots n'est pas passé (peut durer
  plusieurs heures), points de bracket comptés dans la semaine où il se résout,
  une correction admin rétroactive retombe sur la semaine en cours (peut être
  négative), aucun test de composant (onglets, liste).
- **Lot 3 codé (branches `feat/classement-hebdo-lot3` et `feat/recap-hebdo-essai`, PR #158 + #159, 11/10/2026 ; essai « M'envoyer un essai » testé OK sur la compétition active)** :
  envoi manuel du récap hebdo, voir `ETAT_ACTUEL.md` §4.6. Aucune migration.
  Décidé par défaut (recommandations de l'architect, à confirmer) : relance
  aussi aux joueurs sans point ; semaine sans champion envoyée quand même ;
  seule la dernière semaine close est envoyable ; figer et envoyer = deux
  gestes. Carte « Ta semaine » de l'Accueil masquée quand le classement hebdo
  est actif (règle l'ancien point lot 2/3). Limites : envois séquentiels
  (`maxDuration` ou parallélisme borné si la base grandit), « envoyé à N »
  peut surestimer sur erreur transitoire, `users`/`recap_log` non paginés
  (1000 lignes), `getHomeRecap` sans test, envoi réel jamais exercé (à tester
  sur une compétition de test : figer, envoyer, relancer = « déjà servi »).
- ~~Prochaine étape : lots 2 et 3~~ (faits ci-dessus). **Lot 4 codé le
  11/10/2026** (branche `feat/classement-hebdo-lot4`, PR à ouvrir, aucune
  migration) : palmarès hebdo sur le profil propre et sur `/players`, voir
  `ETAT_ACTUEL.md` §4.6. Décidé avec l'utilisateur : visible sur les deux
  profils, toutes compétitions avec nom, total + liste, section dans l'onglet
  Stats. Reste : lot 5 (popup LLM). Limites : mention co-champion perdue si
  l'autre champion supprime son compte ; `weekly_champions` absent de l'export
  RGPD (`app/api/account/export/route.ts`, à ajouter avec la mention
  « palmarès » dans le texte de « Mes données »), non fait ici ; aucun test de
  composant.
- **Lot 5, avancement (11/10/2026, cadrage terminé, aucun code)** : points 1,
  2, 4, 5, 6, 9, 10 tranchés (cadrage §1 bis et §1 ter), prompts versionnés
  dans `Cadrage/Fonctionnel/popup_hebdo/` (`prompt_redacteur_v4.md`,
  `prompt_classifieur_v1.md`, deux schémas JSON), **essayés une fois le 11/10/2026**
  (11 appels, 0,10 $, données fictives). **Point 7 tranché le 11/10/2026**
  (cadrage §1 quater) : `claude-sonnet-5-5` pour les deux rôles (rédacteur
  effort `medium`, classifieur effort `low`), Anthropic direct, nouveau client à
  statut explicite, plafond popup séparé (1 $/jour, confirmé), pas
  de température (400 sur la génération 5.x). Essai : JSON valide 8/8 sans
  sortie imposée, classifieur 7/7 bloqués et 12/12 « ok » stable sur 3 passages.
  Écarts à corriger au prompt v5 : genre des joueurs deviné d'après le pseudo
  (6 sorties sur 8 avec pronom ou accord genré, 7 sur 8 avec « champion »), cas « exactement » non exercé, 1 dépassement de longueur,
  mots proches de l'argent ; humour jugé satisfaisant par l'utilisateur
  (`popup_hebdo/essai_v1/notation_humour.md`). Reste : (1) ~~prompt v5 puis second
  essai ciblé~~ fait le 11/10/2026, voir l'entrée « Lot 5, second essai »
  ci-dessous ; (2) plan technique avec l'`architect`
  (migration : `bets.rejected_at` + remplissage depuis `audit_logs`, table des
  brouillons avec `candidates jsonb` et `featured_user_ids uuid[]`, état « vu »
  par joueur en base, `users.popup_mentions_opt_out`, purge dans
  `delete_account_data` ; client Anthropic à statut explicite ; routes et écrans
  admin) ; (3) à confirmer : le bloc champion ignore-t-il le désengagement, que
  faire du pseudo d'un compte supprimé dans un texte déjà publié, périmètre du
  classifieur (seuls racisme et discrimination, comme la v3).
  **Résolveurs et valeur réelle dans `resolution_reason`** (exploré le
  11/10/2026) : aucun résolveur n'écrit le seuil ni l'écart. Valeur réelle OUI :
  joueur simple MATCH (`resolveMatchBets.ts:103`, via `formatActualStatReason`)
  et NotInMatch SINGLE (`resolveNotInMatchBets.ts:260`), `total_points`
  (`resolveMatchTotalBets.ts:129`), stat équipe (`resolveTeamStatBets.ts:172`,
  sans dire quelle équipe), duel (`resolveComparisonBets.ts:164`, les deux
  côtés sans nom de joueur, et pas de seuil pour un duel « plus que » :
  exclu du flop), période équipe (`resolvePeriodBets.ts:371`), `total_timeouts`
  (`resolveGameEventBets.ts:96`), fautes techniques
  (`resolveTechnicalFoulsCountBets.ts:110`). PARTIELLE : roster count (nombre de
  joueurs, pas leurs valeurs), superlatif (valeur du joueur seulement), roster
  split (BENCH_SUM et STARTERS_SUM : nombre de joueurs, pas la somme ;
  STARTERS_SHARE : pourcentage réel). NON : série (`resolveSeriesBets.ts`),
  `went_to_ot`, combo, période joueur, dernier panier, contre sur un joueur, flags
  game-event, DNP (texte sans valeur). Un pari passé en résolution admin porte un
  texte libre (`admin-resolution.ts:44`). Les paris perdus de ces familles
  n'alimentent donc pas le bloc flop. Défauts relevés en passant, hors lot 5 :
  « points » codé en dur dans la branche STARTERS_SHARE du roster
  split, même pour une autre stat (`resolveRosterSplitBets.ts:134`), « fautes techniques » sans accord au
  singulier (`resolveTechnicalFoulsCountBets.ts:110`), un superlatif perdu ne dit
  pas qui a gagné (`resolveSuperlativeBets.ts:117`). **À corriger à part** :
  `lib/recaps/load.ts:72-80` filtre les paris du récap sur `scored_at`, que le
  recalcul admin réécrit (`recompute.ts:315`) : un « Recalculer » déplace des
  paris dans la fenêtre d'un récap. Autre piège pour la présélection :
  `processCorrectionRequest` (`admin-requests.ts:93-110`) change le statut sans
  toucher `resolved_at` ; d'où l'exclusion des `is_admin_corrected`.
- **Lot 5, second essai (11/10/2026, prompt v5, aucun code)** : décisions
  de l'utilisateur (« Reco partout ») : longueur par bloc = avertissement à la
  relecture (tolérance +20 %, brouillon douteux au-delà de +50 % par bloc ou
  de 180 mots au total) ; vocabulaire d'argent = avertissement, jamais
  brouillon douteux ; contenu d'une injection jamais repris (ni titre ni cta).
  Livrables : `popup_hebdo/prompt_redacteur_v5.md`, `schema_sortie_v5.json`,
  `essai_v2/` (cadrage §1 quinquies). Essai réel de 8 appels, 0,102 $ :
  JSON valide 8/8, injection non reprise, « exactement » et « au plus »/« moins
  de » justes ; genre nettement amélioré mais **non tenu à 100 %** (2
  violations nettes sur 8, contre 6 à 7 sur 8 au v4) ; règle d'échelle tenue
  1 fois sur 2 (un `flop` mis à null à tort). La réflexion se déclenche
  (jusqu'à environ 1 500 tokens de sortie sur le jeu d'injection) : coût par
  appel jusqu'à 0,022 $, plafond de 1 $/jour inchangé. **Décidé par
  l'utilisateur après l'essai : le prompt v5 est retenu** (pas de v5.1, pas de
  nouvel essai) ; le genre sera réglé par un champ de profil rempli à
  l'inscription, popup rétroactive pour les inscrits (chantier futur dans
  `BACKLOG_V1.md`, « Personnalisation du profil », avec le changement de
  pseudo). Reste ouvert : la règle d'échelle (cadrage §1 quinquies). **Pour le plan technique** :
  contrôle de longueur en mots avec tolérance et avertissement (pas de
  détection automatique des pronoms, trop bruyante), avertissement affiché à
  la relecture admin, brouillon douteux seulement hors tolérance,
  `schema_sortie_v5.json` fait foi.
- **Lot 5, plan technique (11/10/2026, aucun code)** : document
  `Cadrage/Fonctionnel/nba_pronos_plan_technique_popup_hebdo.md`, 5 PR (1 ∥ 2,
  puis 3 ∥ 5, puis 4), une migration. **Les 21 décisions du §9 sont validées
  (11/10/2026, recommandations de l'architect, voir §9 bis)** ; Fluid Compute
  actif (300 s) ; textes de repli validés (5) ; tarif de `claude-sonnet-5-5`
  provisoire = celui de sonnet-5 (à ajuster quand la console Anthropic
  affichera le coût réel, ~0,1 $ estimé pour les essais). **PR 1 faite**
  (#167 mergée, migration `20261013090000` appliquée en production le
  11/10/2026, tests d'intégration Docker écrits et non lancés). **PR 2 faite**
  (12/10/2026 : client LLM, relances, plafond popup, schémas, jetons ;
  aucun appel réel). **PR 3 faite** (12/10/2026, branche
  `feat/popup-hebdo-pipeline`, aucune migration : pipeline de génération,
  étape cron, `maxDuration` 300 s, accroche de « Figer la semaine » ; aucun
  appel LLM réel). **Reste** : PR 5 (popup joueur, export RGPD) puis PR 4
  (page `/admin/popup`, garde et URL du push hebdo) ; puis par l'utilisateur :
  activer `weekly_popup` sur la compétition réelle, premier essai payant avec
  accord. Dette notée : purge des `candidates` à l'archivage d'une
  compétition, dans aucune PR.
- **Popup hebdo, prompt rédacteur v6 (25/10/2026, non essayé)** :
  `popup_hebdo/prompt_redacteur_v6.md` (le v5 reste intact), `PROMPT_VERSION`
  `redacteur-v6/classifieur-v1`. Décidé par l'utilisateur : objectif « une du
  lundi », ton plus trash (vulgarité, joueurs NBA interpellés) **sans insulte
  directe d'un joueur de l'appli**, format long (~140 mots, limites
  inchangées), section ÉCRITURE contre les maximes plaquées, et HISTORIQUE des
  titres et cta des 4 dernières popups publiées (`history.ts`
  `recentPhrasing`, mentions remplacées par `[joueur]`). **Reste** : essai réel
  avec accord (cas limites 18 à 20 du v6), relecture du premier brouillon v6.
- **Popup hebdo, points ouverts après la PR 3** :
  - **Vérifier sur preview la durée réelle** de `/admin/competitions` : le
    layout admin déclare 60 s, la page 300 s, la doc locale ne dit pas
    laquelle s'applique (Vercel, Deployment → Functions). Si 60 s : la
    génération lancée depuis « Figer » est coupée, la ligne reste GENERATING et
    le passage suivant du cron la reprend (verrou de 10 min).
  - **Champion en semaine pauvre de niveau 1** : aucun appel (§3.10), donc le
    champion n'est pas classé ; avertissement `champion_non_classe` à la
    relecture (publication manuelle). Alternative : un appel du classifieur
    sur le seul champion (~0,005 $). À trancher si cela gêne.
  - **Règle m (seuil inclusif)** : un pari au texte inclusif (« au moins N »,
    « N+ », « minimum »…) avec seuil entier est écarté du flop, la
    structuration ne dit pas comment elle stocke « au moins N ». Le flop peut
    en être appauvri ; à revoir si la structuration fixe une convention. La
    règle est dans `lib/weeklyPopup/sens.ts` mais pas encore dans le plan
    technique (§3.3/§3.4).
  - **Pseudo cité sans « @ »** : avertissement `pseudo_sans_arobase` ; il
    n'est ni tokenisé ni retrouvable par la purge de compte. À rendre
    bloquant à la publication (PR 4).
  - **Alerte admin** : push seulement au passage du cron (pas au figement
    manuel), et jamais renotifié si aucun admin n'est abonné à cet instant.
    Un brouillon DOUBTFUL transitoire (`api_error`, `timeout`) n'est pas
    retenté par les passages suivants (choix du plan : l'admin régénère).
  - **Cible du push admin** : `/admin/popup` n'existe qu'en PR 4 (404 d'ici
    là ; sans effet tant que `weekly_popup` reste faux).
  - **Test de l'action `freezeWeeklyRanking`** : aucun test des actions
    admin n'existe (dette connue) ; l'accroche popup n'est testée que par
    `ensure.test.ts` et `route.test.ts`.
- **Décidé le 11/10/2026 : envoi du récap hebdo 100 % manuel** en
  pré-Cup (bouton admin, aucun envoi automatique, rappel dans l'admin ; le
  cron ne fait que figer les données). Ordre : 1) lots 0 et 1 avant le
  26/10, 2) popup LLM ensuite.
- La compétition réelle (à créer avant le 16/10) doit avoir
  `weekly_ranking` activé ; la compétition de test est à archiver avant.
