# Registre central des anomalies — nba-pronos

*Généré le 03/09/2026. Chaque anomalie est reliée à sa preuve fichier:ligne. Statut de vérification et niveau de confiance indiqués individuellement — voir légende en fin de document.*

> **⚠️ Document daté, en grande partie corrigé depuis.** Les Vagues 1 à 4 d'`audit/PLAN_ACTION.md`
> sont closes (07/09/2026) : SEC-001, SEC-002, BUG-002, BUG-003, ARCH-002, ARCH-003, UX-001,
> A11Y-001, A11Y-002, TEST-001, TEST-002, DATA-002, OPS-003, OPS-004 et DOC-003 sont corrigés et
> mergés (voir chaque entrée pour la PR). UX-002 a fait l'objet d'une **décision** (desktop dédié
> voulu à terme, non planifié maintenant) mais reste sans code. OPS-001 est désormais corrigé en
> entier (alerte de disponibilité + `.github/workflows/keep-alive.yml`, commit mensuel automatique
> qui empêche l'auto-désactivation à 60 jours). OPS-002 corrigé en partie (07/09/2026 — SMTP réparé,
> décision de fond toujours ouverte). SEC-003, SEC-004, ARCH-001, TEST-003, DATA-001/003/004/005/006/007, DOC-001,
> DOC-002 restent ouverts sans changement. Détail complet et suite priorisée : feuille de route
> du 06/09/2026 (artifact Claude, Phase 0/1) et `Cadrage/Suivi/GAPS_OUVERTS.md`.

---

## SEC-001 — Absence de rate limiting applicatif sur les Server Actions de contenu — CORRIGÉ (PR #33, 03/09/2026)

- **Catégorie** : Sécurité / Abus & robustesse
- **Gravité** : P3 Modéré (rétrogradé — corrigé)
- **Niveau de confiance** : Élevé (grep exhaustif, aucun résultat)
- **Statut de vérification** : Vérifié — corrigé (`check_rate_limit()`, migration `20260903150000`, `lib/actions/rateLimit.ts` sur chat/paris/signalements)
- **Fonctionnalité concernée** : Chat, paris personnalisés, signalements de bug
- **Rôles concernés** : Joueur authentifié
- **Fichiers** : `lib/actions/chat.ts` (`postChatMessageFormAction`), `lib/actions/bets.ts` (`saveDraftBet`/`submitBet`), `lib/actions/bug-reports.ts` (`submitBugReport`)
- **Lignes ou symboles** : fonctions citées, aucune limitation de fréquence
- **Description** : aucun rate limiter applicatif dédié n'existe au-delà du CAPTCHA login/signup et du rate-limiting par défaut de Supabase Auth. Un joueur authentifié peut poster en rafale illimitée dans le chat ou spammer des signalements de bug.
- **Comportement attendu** : une limite de fréquence raisonnable sur les actions à fort potentiel de nuisance (chat, signalement).
- **Comportement constaté** : aucune limite technique ; seules les contraintes métier (quota de paris en base) freinent les paris.
- **Preuve** : grep exhaustif de `rate`/`limit` dans `lib/` — aucun rate limiter applicatif trouvé (agent de vérification sécurité, 03/09/2026).
- **Étapes de reproduction** : un compte authentifié appelle `postChatMessageFormAction` en boucle serrée — aucun blocage.
- **Impact utilisateur** : dégradation de l'expérience du chat en cas d'abus (spam).
- **Impact technique** : charge base de données, notifications push en rafale (chaque message déclenche un envoi push).
- **Risque de sécurité ou de données** : faible — cercle fermé d'amis actuellement (contexte documenté par l'équipe), pas un risque d'attaque externe.
- **Probabilité** : faible dans le contexte actuel (alpha, cercle fermé), plus élevée si le produit s'ouvre.
- **Solution minimale** : limite de fréquence simple (ex. 1 message chat/2s, N signalements/heure) au niveau Server Action.
- **Solution recommandée** : rate limiter partagé (ex. table Postgres à compteur glissant, ou service dédié type Upstash) réutilisable sur toutes les Server Actions sensibles.
- **Risque de régression** : faible.
- **Tests à ajouter** : test d'intégration simulant un flux de requêtes rapprochées.
- **Dépendances avec d'autres anomalies** : aucune.

---

## SEC-002 — Vulnérabilité npm "high" sur `browserslist` (dépendance de build, dev-only) — CORRIGÉ (PR #36, 04/09/2026)

- **Catégorie** : Sécurité / Dépendances
- **Gravité** : P4 Mineur (rétrogradé — corrigé)
- **Niveau de confiance** : Élevé (`npm audit` exécuté)
- **Statut de vérification** : Vérifié — corrigé (`package.json` `overrides` → `browserslist@^4.28.8`, `0 vulnerabilities` confirmé dev inclus)
- **Fonctionnalité concernée** : Toolchain de build
- **Rôles concernés** : Aucun (n'affecte pas le runtime servi aux utilisateurs)
- **Fichiers** : `node_modules/browserslist` (transitif), `package.json`
- **Description** : `npm audit` (avec devDependencies) rapporte 1 vulnérabilité "high" sur `browserslist@<=4.28.6` (GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g). `npm audit --omit=dev` rapporte 0 vulnérabilité — confirme que le bundle runtime n'est pas concerné.
- **Comportement attendu** : dépendances de build à jour.
- **Comportement constaté** : dérive normale post-correction des 3 vulnérabilités de l'audit du 29/08 (nanoid, brace-expansion, js-yaml, toutes corrigées).
- **Preuve** : sortie `npm audit` (agent de vérification sécurité, 03/09/2026).
- **Impact utilisateur** : aucun.
- **Impact technique** : aucun en runtime ; hygiène de toolchain.
- **Solution minimale** : `npm audit fix` ou mise à jour de la chaîne `postcss`/Tailwind/`autoprefixer`.
- **Tests à ajouter** : aucun (vérification `npm audit` en CI suffirait, voir `OPS-003`).

---

## SEC-003 — Couverture zod partielle sur les Server Actions

- **Catégorie** : Sécurité / Validation des entrées
- **Gravité** : P4 Mineur
- **Niveau de confiance** : Élevé
- **Statut de vérification** : Vérifié
- **Fichiers** : `lib/actions/validation.ts` (schémas centralisés), 13 fichiers de `lib/actions/*.ts` sans zod (`account.ts`, `admin-*.ts`, `audit.ts`, `bracket-fill.ts`, `leagues.ts`, `matches.ts`, `notifications.ts`)
- **Description** : progrès réel depuis l'audit du 29/08 (schémas zod introduits sur les 7 fichiers à texte libre les plus exposés), mais 13 fichiers n'utilisent aucun schéma. Analyse : la majorité traite des ID UUID/enums validés manuellement puis transmis à des fonctions SQL `SECURITY DEFINER` (autorité réelle), donc le risque résiduel est faible, mais reste un facteur de dérive à mesure que le code grossit.
- **Solution recommandée** : étendre zod aux Server Actions manipulant des enums/formats structurés (ex. dates, IDs) par cohérence, sans urgence.

---

## SEC-004 — `error.message` brut encore renvoyé sur 3 Server Actions (choix documenté)

- **Catégorie** : Sécurité / Logs & erreurs
- **Gravité** : P4 Mineur (informationnel)
- **Niveau de confiance** : Élevé
- **Statut de vérification** : Vérifié
- **Fichiers** : `lib/actions/bets.ts:61,104,125`, `lib/actions/bet-corrections.ts:41`, `lib/actions/corrections.ts:49`
- **Description** : ces 3 fichiers renvoient encore le message brut d'une fonction SQL `SECURITY DEFINER` au client — mais ces messages sont rédigés à la main pour un joueur humain (ex. "Tu as déjà 3 paris en cours"), documenté explicitement en commentaire et dans `ETAT_ACTUEL.md`. Ce n'est pas le problème original (fuite de messages Postgres bruts type "duplicate key value..."). Un helper générique (`lib/actions/errors.ts`) existe et est utilisé sur 15/22 fichiers.
- **Solution recommandée** : aucune action requise — comportement volontaire et documenté ; à re-confirmer si de nouveaux messages RPC moins soignés apparaissent.

---

## BUG-001 — Désynchronisation `isLive`/`isDecided` sur le Bracket en direct — CORRIGÉ (vérifié 03/09/2026)

- **Catégorie** : Bug fonctionnel
- **Gravité** : P4 Mineur (rétrogradé — corrigé, gravité conservée pour traçabilité historique uniquement)
- **Niveau de confiance** : Élevé — corrigé, vérifié directement dans le code par lecture le 03/09/2026 (session de reprise post-audit)
- **Statut de vérification** : Vérifié — corrigé
- **Fonctionnalité concernée** : Bracket (vue live)
- **Fichiers** : `components/bracket/NodeCard.tsx:143-155`, `components/bracket/SeriesDrillDown.tsx:53-58,240-241`, `components/bracket/LiveSeriesSubscriber.tsx`
- **Description d'origine (16/08/2026)** : `node.status`/`node.liveScore` étaient un instantané pris au chargement de page (pas de push Realtime), mais `actualWinnerAbbreviation` était poussé en direct. Si une série `IN_PROGRESS` se terminait pendant que la page était ouverte, `isDecided` devenait vrai en direct mais `isLive` restait bloqué sur `true` — la carte continuait d'afficher "En cours" jusqu'au rechargement complet, sur `NodeCard` et sur le regroupement en colonnes de `SeriesDrillDown`.
- **Correctif constaté** : `LiveSeriesSubscriber.tsx` porte désormais `official_status` dans son payload Realtime (pas seulement le vainqueur), avec un commentaire d'en-tête daté du 16/08/2026 décrivant exactement ce bug et sa correction. `NodeCard.tsx:147` lit `liveStatus` via `useLiveSeriesStatus(node.nodeId, node.status)` (plus l'instantané SSR seul) pour dériver `isLive`. `SeriesDrillDown.tsx:57-58` fait de même via `useLiveSeriesMap()`/`liveNodeStatus()` pour le regroupement "en cours"/"replié" par colonne (`renderColumn:240-241`). Le correctif a donc été livré le jour même de l'audit UX qui l'a trouvé (16/08/2026), avant que l'audit complet du 03/09/2026 ne le recatalogue par erreur comme non revérifié (aucun des 5 agents d'exploration de cet audit n'avait lu ces deux fichiers en détail).
- **Nuance résiduelle, non corrigée, distincte du bug d'origine** : le **nombre exact** de victoires par équipe (`node.liveScore`, affiché à côté de chaque logo) reste un instantané SSR — seuls `status` et `actualWinnerAbbreviation` sont poussés en direct (`lib/queries/bracket.ts` commentaire §18 : "le live reste réservé à l'écran Matchs"). Le libellé "En cours"/"Terminé" et la mise en avant (vert/or) sont donc corrects en direct, mais le score chiffré affiché (ex. "3-1") peut rester en retard d'une victoire jusqu'au rechargement complet. Gravité jugée mineure (l'information la plus visible — qui a gagné — est correcte) ; à traiter séparément si jugé utile, en étendant `LiveSeriesSubscriber` pour compter les victoires depuis les `matches` FINISHED de la série, ou en acceptant ce compromis comme le reste du produit.
- **Dépendances avec d'autres anomalies** : aucune.

---

## BUG-002 — Logique de deadline de pari dupliquée en 3 endroits malgré une factorisation existante — CORRIGÉ (PR #35, 04/09/2026)

- **Catégorie** : Bug fonctionnel / dette technique
- **Gravité** : P4 Mineur (rétrogradé — corrigé)
- **Niveau de confiance** : Élevé (documenté par l'équipe elle-même)
- **Statut de vérification** : Vérifié — corrigé (`lib/queries/home.ts`/`admin-dashboard.ts` migrés vers `lib/scoring/bet-deadline.ts`, `bet-deadline.test.ts` ajouté)
- **Fichiers** : `lib/scoring/bet-deadline.ts` (factorisation), `lib/queries/home.ts:433-441`, `lib/queries/admin-dashboard.ts:81,129-135` (copies non migrées)
- **Description** : `bet-deadline.ts` a été créé pour factoriser une logique de calcul de deadline dupliquée 3 fois — mais les 3 sites préexistants n'ont volontairement pas été migrés vers ce module (commentaire explicite dans le code). Toute évolution future de la règle de deadline devra être répercutée manuellement à 4 endroits.
- **Comportement attendu** : une seule source de vérité pour le calcul de deadline.
- **Comportement constaté** : 4 implémentations parallèles (1 factorisée + 3 historiques).
- **Impact technique** : risque de divergence silencieuse si l'une des copies est modifiée sans les 3 autres.
- **Solution recommandée** : migrer `home.ts` et `admin-dashboard.ts` vers `lib/scoring/bet-deadline.ts` lors d'un prochain passage sur ces fichiers.
- **Risque de régression** : faible à moyen (toucher un calcul central utilisé sur l'écran d'accueil).

---

## BUG-003 — Vérification "joueur présent au match" reposant uniquement sur la connaissance générale de l'IA, sans données de roster réelles injectées — CORRIGÉ (PR #30, 03/09/2026)

- **Catégorie** : Bug fonctionnel / limite architecturale
- **Gravité** : P2 Majeur (rétrogradé — corrigé)
- **Niveau de confiance** : Élevé (2 erreurs réelles constatées sur échantillon de 30 paris)
- **Statut de vérification** : Vérifié — corrigé (`lib/ai/roster.ts`, roster réel injecté dans `buildDynamicSystemText()` et les 8 schémas dédiés)
- **Fonctionnalité concernée** : Paris personnalisés (structuration IA)
- **Fichiers** : `lib/ai/structureBet.ts` (`buildDynamicSystemText()`), 8 schémas dédiés `structureXxxBet.ts`
- **Description** : la vérification "ce joueur joue-t-il dans ce match" repose entièrement sur la connaissance générale de Claude — aucune donnée de roster réelle n'est injectée dans le prompt. Le service de calcul de probabilité résout bien les joueurs par nom, mais seulement **après** que Claude ait déjà tranché `not_in_match` (qui force `proba=0%` sans même interroger le service).
- **Comportement attendu** : vérification de présence au roster à partir d'une donnée réelle et à jour.
- **Comportement constaté** : 2 erreurs constatées sur 30 paris testés (joueurs jugés absents du match alors qu'ils y jouaient réellement).
- **Preuve** : `Cadrage/Suivi/GAPS_OUVERTS.md` (entrée du 03/09/2026, "Limite architecturale distincte, documentée").
- **Impact utilisateur** : un pari personnalisé légitime peut être jugé automatiquement non calculable ou à probabilité 0% à tort.
- **Impact technique** : nécessite d'injecter une source de roster à jour dans `buildDynamicSystemText()` et dans les 8 schémas dédiés — chantier non trivial (données à synchroniser, cache à gérer).
- **Solution minimale** : documentation du taux d'erreur connu, revue admin possible via `correction_requests`.
- **Solution recommandée** : injecter le roster confirmé du jour (déjà disponible via la synchro Highlightly / stats box-score) dans le prompt de structuration.
- **Dépendances avec d'autres anomalies** : lié à `AUDIT_TYPES_PARIS_24_08_2026.md` (couverture 69/17/14%).

---

## ARCH-001 — `/chat` protégé par le layout applicatif, pas par `proxy.ts`

- **Catégorie** : Architecture
- **Gravité** : P4 Mineur (informationnel — pas un trou de sécurité réel)
- **Niveau de confiance** : Élevé
- **Statut de vérification** : Vérifié
- **Fichiers** : `proxy.ts:13` (`APP_ZONE_PREFIXES`, n'inclut pas `/chat`), `app/(app)/layout.tsx:16-24` (garde de session effective)
- **Description** : `/chat` fait partie du groupe de routes `(app)` mais n'est pas listé dans les préfixes protégés par le middleware `proxy.ts`. La défense en profondeur du layout serveur compense entièrement (revérifie `getUser()` à chaque navigation) — **aucun accès non authentifié réel possible**, mais l'incohérence de la liste de préfixes est un facteur de risque si le layout venait un jour à être modifié sans que quelqu'un se souvienne de ce filet de sécurité implicite.
- **Solution recommandée** : ajouter `/chat` à `APP_ZONE_PREFIXES` par cohérence et lisibilité, même si non strictement nécessaire aujourd'hui.

---

## ARCH-002 / ARCH-003 — Barèmes de scoring dupliqués en affichage — CORRIGÉ (PR #36, 04/09/2026)

- **Catégorie** : Architecture / duplication
- **Gravité** : P4 Mineur (rétrogradé — corrigé)
- **Niveau de confiance** : Élevé
- **Statut de vérification** : Vérifié — corrigé (`lib/labels/bets.ts` et `MatchBaremeGrid.tsx`/`BetDifficulteGrid.tsx` importent désormais `lib/scoring/engine.ts`)
- **Fichiers** : `lib/scoring/engine.ts:290` (autorité) vs `lib/labels/bets.ts:48-54` (`BET_DIFFICULTY_POINTS`, affichage) ; `lib/scoring/engine.ts` (barème d'écart) vs `components/regles/MatchBaremeGrid.tsx:11-34` (`marginBonusFor`, affichage, page `/regles`)
- **Description** : ces tables ne sont jamais utilisées pour écrire un score (l'autorité reste `engine.ts`), mais leur duplication manuelle en affichage crée un risque de divergence silencieuse si le barème change côté moteur sans mise à jour de la page de règles/labels.
- **Solution recommandée** : exporter les constantes de barème depuis `engine.ts` et les réimporter en affichage plutôt que de les recopier.

---

## UX-001 — Absence de piège de focus (focus trap) dans les modales et dialogues de confirmation — CORRIGÉ (PR #37, 04/09/2026)

- **Catégorie** : UX / Accessibilité
- **Gravité** : P3 Modéré (rétrogradé — corrigé)
- **Niveau de confiance** : Élevé
- **Statut de vérification** : Vérifié — corrigé (`components/ui/FocusTrap.tsx`, appliqué aux 12 dialogues réels du dépôt, pas seulement les 3 cités)
- **Fichiers** : `components/ui/ModalDialog.tsx`, `components/bets/DeleteBetButton.tsx`, `components/admin/DeleteMatchButton.tsx`, `components/admin/CloseCompetitionButton.tsx`
- **Description** : les modales portent correctement `role="dialog"`/`role="alertdialog"` + `aria-modal="true"` + `aria-labelledby`, mais aucune ne gère le déplacement du focus à l'ouverture, ni le piège du `Tab` à l'intérieur du dialogue, ni la fermeture par `Échap`.
- **Comportement attendu** : à l'ouverture d'une modale, le focus clavier est capturé à l'intérieur ; `Échap` ferme la modale ; `Tab`/`Shift+Tab` boucle dans les éléments focalisables du dialogue.
- **Comportement constaté** : le focus reste où il était, `Tab` peut sortir de la modale vers le contenu arrière-plan.
- **Impact utilisateur** : utilisateur clavier/lecteur d'écran, en particulier sur une action irréversible (suppression de compte, clôture de compétition).
- **Solution minimale** : ajouter un `useEffect` de focus initial + gestion `Échap` sur `ModalDialog.tsx`.
- **Solution recommandée** : bibliothèque légère de focus-trap ou implémentation manuelle centralisée dans `ModalDialog.tsx`, réutilisée par tous les dialogues de confirmation.
- **Tests à ajouter** : test clavier (Tab/Shift+Tab/Échap) sur au moins un dialogue de confirmation.

---

## UX-002 — Absence quasi totale de design responsive multi-breakpoint — DÉCISION PRISE (06/09/2026), pas encore de code

- **Catégorie** : UX
- **Gravité** : P3 Modéré
- **Niveau de confiance** : Élevé (grep exhaustif : 0 classe Tailwind `sm:/md:/lg:/xl:` dans tout le repo)
- **Statut de vérification** : Vérifié — décision explicite de l'utilisateur (06/09/2026) : un visuel desktop dédié est voulu **à terme**, mais non planifié maintenant (chantier de design, pas une dette non tranchée). Voir Phase 4 de la feuille de route.
- **Correction (06/09/2026)** : le constat "le Bracket reste une pile de panneaux empilés" cité plus bas est **faux depuis le 16/08/2026** — `components/bracket/TreeConnectors.tsx` relie déjà les séries en arbre visuel, sur tout device. Ne pas citer le Bracket comme exemple de manque desktop si ce chantier est un jour repris.
- **Fichiers** : `app/globals.css:22` (largeur max fixe centrée), 120 fichiers `.module.css` (5 seulement avec `@media`)
- **Description** : bien que Tailwind 4 soit installé, l'application n'utilise pratiquement aucune classe utilitaire responsive. La mise en page repose sur une colonne centrée à largeur maximale fixe — fonctionne comme une "app mobile" avec un simple plafond de largeur en desktop, pas un vrai layout adaptatif.
- **Comportement attendu (selon l'ambition produit)** : expérience desktop distincte tirant parti de l'espace disponible (ex. classement en tableau large, bracket en arbre visuel).
- **Comportement constaté** : rendu mobile identique, juste centré, sur grand écran.
- **Impact utilisateur** : sous-exploitation de l'écran sur desktop/tablette ; cohérent avec le constat interne (`AVIS_EXPERT_16_08_2026.md`) que le Bracket "reste une pile de panneaux empilés" plutôt qu'un arbre visuel connecté.
- **Solution recommandée** : décision produit à trancher (l'app est-elle mobile-only par choix, ou le desktop mérite-t-il un investissement dédié ?) avant tout chantier de responsive.

---

## A11Y-001 — Contraste du token `--color-trend` non vérifié en thème clair — CORRIGÉ (PR #39, 06/09/2026)

- **Catégorie** : Accessibilité
- **Gravité** : P4 Mineur (rétrogradé — corrigé)
- **Niveau de confiance** : Élevé (aveu documenté dans le code)
- **Statut de vérification** : Vérifié — corrigé (nouveau token `--c-trend-700: #2E719E`, 4.67-5.29:1 selon la surface ; le thème sombre était déjà correct, non modifié)
- **Fichiers** : `app/tokens.css` (commentaire "À CONFIRMER" sur `--color-trend`)
- **Description** : le fichier de design tokens documente lui-même une zone de risque non résolue — le contraste AA de la couleur de tendance (classement) sur fond clair n'a jamais été vérifié.
- **Solution minimale** : vérifier le ratio de contraste (outil automatique type axe/Lighthouse) et ajuster si &lt;4.5:1.

---

## A11Y-002 — Pas de vérification automatisée d'accessibilité en CI — CORRIGÉ (PR #39, 06/09/2026)

- **Catégorie** : Accessibilité
- **Gravité** : P4 Mineur (rétrogradé — corrigé)
- **Niveau de confiance** : Élevé
- **Statut de vérification** : Vérifié — corrigé (`eslint-plugin-jsx-a11y`, ruleset recommandé actif dans `eslint.config.mjs`)
- **Description** : aucun outil d'audit a11y automatisé (axe-core, Lighthouse CI, `eslint-plugin-jsx-a11y`) n'est intégré au pipeline. La bonne couverture ARIA constatée manuellement (204 occurrences sur 71 fichiers) n'est donc pas protégée contre la régression.
- **Nuance** : la règle `label-has-associated-control` est désactivée — elle plante au lint (`require("minimatch").default`, `minimatch` v10 imposé par les `overrides` de sécurité de `SEC-002` a supprimé cet export par défaut ; aucun correctif publié dans `eslint-plugin-jsx-a11y` à la version 6.10.2). Seule cette règle est concernée, tout le reste du ruleset recommandé est actif.
- **Solution recommandée** : réactiver `label-has-associated-control` dès qu'`eslint-plugin-jsx-a11y` publie un correctif compatible minimatch v10.

---

## TEST-001 — Zéro test de composant React, end-to-end, ou d'intégration API — CORRIGÉ EN PARTIE (PR #38, 04/09/2026)

- **Catégorie** : Tests
- **Gravité** : P2 Majeur (rétrogradé — parcours critiques couverts)
- **Niveau de confiance** : Élevé
- **Statut de vérification** : Vérifié — corrigé pour le volet e2e (Playwright, `e2e/`, 3 specs sur les parcours critiques login/pari/validation admin, job CI dédié). Le test de composant React isolé (Testing Library) reste absent — jugé moins prioritaire que l'e2e réel, pas repris depuis.
- **Description** : les 224 tests existants (18 fichiers, tous passants) couvrent exclusivement la logique métier pure/orchestrée de `lib/scoring` et `lib/ai`. Aucun test de composant (Testing Library), aucun e2e (Playwright/Cypress absents du repo malgré des scripts de vérification manuelle Playwright mentionnés dans le journal — jamais commités), aucun test frappant réellement les routes `app/api/*`.
- **Impact** : les parcours utilisateur (formulaires, navigation, affichage conditionnel par rôle) ne sont vérifiés qu'à la main, session par session, sans filet de non-régression automatisé.
- **Solution recommandée** : prioriser 5-10 tests e2e sur les parcours critiques (login, soumission de pari, admin validation) avant d'investir dans une couverture exhaustive de composants.

---

## TEST-002 — Aucun test automatisé des policies RLS/permissions — CORRIGÉ (PR #34, 04/09/2026)

- **Catégorie** : Tests / Sécurité
- **Gravité** : P2 Majeur (rétrogradé — corrigé)
- **Niveau de confiance** : Élevé (grep exhaustif, aucun résultat)
- **Statut de vérification** : Vérifié — corrigé (`test/integration/rls.test.ts` contre Supabase local, propriété des paris + visibilité bracket, 8/8 passants, `npm run test:integration`)
- **Description** : le modèle d'autorisation (RLS + `SECURITY DEFINER` + triggers d'invariants) est le mécanisme de sécurité le plus critique du projet, et repose exclusivement sur des vérifications manuelles ponctuelles (documentées dans le journal, ex. test de la récursion `league_memberships` "en conditions réelles avec 2 comptes"). Aucun test automatisé ne rejoue ces scénarios (auto-élévation de rôle, accès à la ressource d'un autre utilisateur, dernier admin protégé).
- **Impact** : une régression future sur une policy RLS ou un trigger d'invariant ne serait détectée qu'en test manuel ou en production.
- **Solution recommandée** : suite de tests d'intégration contre une instance Supabase locale (`supabase start`) exerçant les scénarios IDOR/élévation de privilège les plus critiques.

---

## TEST-003 — Aucun test de fuseau horaire ou de concurrence

- **Catégorie** : Tests
- **Gravité** : P3 Modéré
- **Niveau de confiance** : Élevé
- **Statut de vérification** : Vérifié
- **Description** : malgré des risques documentés en commentaire dans le code lui-même (décalage UTC du cron `sync-schedule`, garde anti-concurrence dans la résolution de paris), aucun test n'exerce ces cas.
- **Solution recommandée** : au minimum, un test unitaire sur `lib/dates/paris.ts` autour d'un changement d'heure DST, et un test simulant deux résolutions concurrentes du même pari.

---

## OPS-001 — `heartbeat.yml` peut s'auto-désactiver après 60 jours sans commit — CORRIGÉ (PR #35 + Phase 0, 04-07/09/2026)

- **Catégorie** : Exploitation / Observabilité
- **Gravité** : P2 Majeur (rétrogradé — corrigé)
- **Niveau de confiance** : Élevé (risque documenté dans le fichier lui-même)
- **Statut de vérification** : Vérifié — corrigé en 2 temps. `/api/health` (route publique, désormais un vrai check Supabase + Cloud Run, pas juste `{ok:true}`) + un monitor UptimeRobot externe (5 min, alerte email) détectent une indisponibilité réelle de l'application. Le risque d'origine (auto-désactivation GitHub du cron après 60 jours sans activité sur le dépôt) est mitigé par `.github/workflows/keep-alive.yml` (07/09/2026) — commit automatique mensuel, marge de sécurité x2, aucun creux de saison NBA ne peut plus l'atteindre.
- **Fichiers** : `.github/workflows/heartbeat.yml:6-15`
- **Description** : GitHub désactive automatiquement un workflow planifié après 60 jours **sans aucune activité sur le dépôt** (pas seulement sans exécution du cron). Un creux de saison NBA (l'intersaison dure plusieurs mois, cf. `project_pause-inter-alpha-beta` en mémoire) pourrait dépasser 60 jours sans commit et arrêter silencieusement le heartbeat anti-pause, menant à la mise en veille du projet Supabase gratuit.
- **Comportement attendu** : alerte ou mécanisme de reprise automatique.
- **Comportement constaté** : aucune parade automatisée, seulement un commentaire d'avertissement dans le fichier.
- **Impact utilisateur** : indisponibilité complète de l'application si Supabase se met en veille sans que personne ne s'en aperçoive.
- **Impact technique** : nécessite une action manuelle (commit ou re-déclenchement du workflow) toutes les &lt;60 jours pendant les périodes creuses.
- **Solution minimale** : rappel calendaire manuel pendant l'intersaison.
- **Solution recommandée** : déplacer le heartbeat vers un service externe non soumis à cette limite (ex. cron-job.org, ou un projet GitHub Actions dédié avec une action de auto-commit périodique), ou surveiller activement via un monitoring externe (UptimeRobot sur une route de santé).
- **Dépendances** : lié à `[[project_pause-inter-alpha-beta]]` (mémoire) — la pause actuelle entre l'alpha et la vraie Cup est justement la fenêtre à risque.

---

## OPS-002 — Décision SMTP (quota email) — CORRIGÉ EN PARTIE (07/09/2026, rotation de clé)

- **Catégorie** : Exploitation
- **Gravité** : P3 Modéré
- **Niveau de confiance** : Élevé — revérifié en conditions réelles le 07/09/2026 (rotation de clé demandée par l'utilisateur)
- **Statut de vérification** : Vérifié — **la description ci-dessous datée du 16/08/2026 est fausse depuis un moment** : le SMTP réellement configuré en production n'est PAS Resend mais **Gmail** (`smtp.gmail.com`, compte personnel de l'utilisateur) — dérive jamais documentée, découverte seulement en tentant de faire tourner la clé Resend (qui n'est en réalité plus utilisée du tout). Hypothèse la plus probable : bascule volontaire pour contourner la limite "1 seule adresse" du bac-à-sable Resend pendant les tests avec plusieurs comptes réels d'amis.
- **Ce qui a été fait le 07/09/2026** : le mot de passe Gmail classique collé dans le champ SMTP ne fonctionnait plus (`535 BadCredentials`) — remplacé par un vrai mot de passe d'application Gmail dédié. 2 autres bugs réels trouvés et corrigés en marge (sans lien avec le SMTP lui-même) : `ResetPasswordForm.tsx` ne transmettait jamais de jeton Turnstile alors que la protection CAPTCHA du projet Supabase l'exige aussi sur `/recover` (PR #48) — CHAQUE demande de réinitialisation de mot de passe échouait silencieusement depuis l'activation de Turnstile, tous comptes confondus ; et `https://panierballon.fr/reset-password` n'était pas dans la liste blanche des URLs de redirection Supabase (Authentication → URL Configuration), ce qui faisait retomber le lien reçu par email sur `/login` en perdant le jeton de récupération. Les deux corrigés, flux bout-en-bout revérifié fonctionnel par l'utilisateur.
- **Reste ouvert** : la vraie question de fond (rester sur Gmail personnel indéfiniment vs. domaine Resend vérifié pour un vrai lancement à plusieurs joueurs) n'a toujours pas été tranchée consciemment — seulement rafistolée. Gmail a ses propres limites d'envoi (~500/jour, largement suffisant à ce stade, mais un compte personnel mélangé à un usage applicatif n'est pas un choix d'architecture propre). À revisiter avant l'élargissement (Phase 2 de la feuille de route). La clé Resend d'origine (celle qui avait fuité dans le chat) est à révoquer par l'utilisateur si ce n'est pas déjà fait, indépendamment de ce choix.
- **Impact** : plusieurs amis s'inscrivant dans la même heure au lancement d'une compétition tomberaient sur un échec de création de compte avec message générique.
- **Solution recommandée** : trancher avant tout vrai lancement à plusieurs joueurs simultanés (vérifier un domaine chez Resend, ~1-3€/an).

---

## OPS-003 — CI ne fait pas tourner `npm audit` — CORRIGÉ (PR #36, 04/09/2026)

- **Catégorie** : Exploitation / CI
- **Gravité** : P4 Mineur (rétrogradé — corrigé)
- **Niveau de confiance** : Élevé
- **Statut de vérification** : Vérifié — corrigé (`npm audit --omit=dev` non bloquant, ajouté à `ci.yml`)
- **Description** : `ci.yml` exécute lint/typecheck/test/build mais pas d'audit de dépendances — la dérive constatée en `SEC-002` (nouvelle vulnérabilité `browserslist` apparue depuis le dernier audit manuel) ne serait détectée qu'au prochain audit manuel.
- **Solution recommandée** : ajouter Dependabot (gratuit sur GitHub) ou une étape `npm audit --omit=dev` non bloquante dans `ci.yml`.

---

## DATA-001 à DATA-007

Voir `audit/06-donnees-et-integrite.md` §"Registre des anomalies de cette phase" pour le détail complet (reproduit ici pour le tableau de synthèse global uniquement) :

- **DATA-001** (P3) : pattern récurrent — nouveau statut/colonne introduit sans revue systématique des objets dépendants (5 migrations correctives déjà nécessaires).
- **DATA-002** (P2) — **CORRIGÉ (PR #32, 03/09/2026)** : ~~suppression de compte non transactionnelle~~ → fonction SQL `delete_account_data()` atomique (migration `20260903140000`), confirmée live sur le projet Supabase hébergé.
- **DATA-003** (P3) : quota "3 paris MATCH/série" sans backstop d'index unique.
- **DATA-004** (P4) : index manquants sur `correction_requests`, `chat_messages(user_id)`, `bug_reports(user_id)`, `chat_message_reports(reporter_user_id)`.
- **DATA-005** (P4) : orchestration multi-tables non transactionnelle du scoring (assumé, mitigé par idempotence).
- **DATA-006** (P4) : trigger `enforce_users_invariants` sans garde dédiée testée pour `auth.uid() IS NULL`.
- **DATA-007** (P3) : `age_confirmed_at` horodaté inconditionnellement, indépendamment du contrôle applicatif.

---

## OPS-004 — Pas de garde-fou de séquencement entre déploiement de code et application de migration — CORRIGÉ (PR #35, 04/09/2026)

- **Catégorie** : Exploitation
- **Gravité** : P3 Modéré (rétrogradé — corrigé)
- **Niveau de confiance** : Moyen (un cas concret déjà rencontré, pas nécessairement représentatif de tous les futurs déploiements)
- **Statut de vérification** : Vérifié — corrigé (`audit/RUNBOOK_MIGRATIONS.md` documente la règle, référencé depuis `.github/PULL_REQUEST_TEMPLATE.md`)
- **Fonctionnalité concernée** : Déploiement / migrations
- **Fichiers** : pipeline Vercel (déploiement auto sur push `main`) vs `supabase db push` (manuel) ; précédent : `supabase/migrations/20260821090000_drop_tutorial_seen_at.sql`
- **Description** : Vercel déploie automatiquement le code à chaque push sur `main`, tandis que les migrations Supabase sont appliquées manuellement à un moment potentiellement différent. Un cas réel documenté montre qu'une migration peut rester non appliquée plusieurs jours après le déploiement du code correspondant.
- **Comportement attendu** : le schéma de base est toujours compatible avec le code déployé au même instant.
- **Comportement constaté** : fenêtre possible où le code suppose un schéma qui n'existe pas encore (ou inversement, cas déjà rencontré sans impact car un `DROP COLUMN`).
- **Impact utilisateur** : erreurs applicatives si le code déployé suppose une colonne/table absente.
- **Impact technique** : dépend entièrement de la discipline manuelle de l'opérateur.
- **Solution minimale** : checklist "migration avant merge".
- **Solution recommandée** : intégrer l'application des migrations dans le pipeline de déploiement (étape CI dédiée, ou hook de build Vercel).
- **Tests à ajouter** : vérification automatique en CI que le schéma distant correspond aux migrations du dépôt avant déploiement.

---

## DOC-003 — `security-audit-report.md` non mis à jour après correction de ses findings — CORRIGÉ (PR #36, 04/09/2026)

- **Catégorie** : Documentation
- **Gravité** : P4 Mineur (rétrogradé — corrigé)
- **Niveau de confiance** : Élevé
- **Statut de vérification** : Vérifié — corrigé (bandeau daté en tête du fichier, renvoyant vers `audit/RAPPORT_FINAL.md`/`PLAN_ACTION.md`)
- **Fichiers** : `security-audit-report.md`
- **Description** : le rapport d'audit sécurité du 29/08 reste dans son état d'origine (15 findings, dont 11 corrigés depuis d'après le présent audit) — un lecteur qui ne consulterait que ce document se ferait une image datée et trop pessimiste de l'état de sécurité actuel.
- **Solution recommandée** : bandeau en tête renvoyant vers `audit/07-securite.md`, ou archivage daté.

---

## DOC-001 — `README.md` générique, ne reflète pas le projet réel

- **Catégorie** : Documentation
- **Gravité** : P4 Mineur
- **Niveau de confiance** : Élevé
- **Statut de vérification** : Vérifié
- **Fichiers** : `README.md`
- **Description** : le `README.md` racine est le boilerplate par défaut de `create-next-app`, sans aucune mention de Supabase, des variables d'environnement requises, de la structure du projet, ou de comment lancer les migrations/tests localement.
- **Comportement attendu** : un nouveau contributeur peut cloner et démarrer en suivant le README.
- **Comportement constaté** : le README ne mentionne aucune des spécificités réelles du projet ; l'onboarding réel n'existe que dispersé dans `Cadrage/` (25 000+ lignes cumulées, non indexées pour un nouvel arrivant).
- **Solution recommandée** : README minimal mais réel — prérequis (`.env.local`, Supabase CLI), commandes (`npm run dev`, `npm test`, `supabase db push`), lien vers `Cadrage/` pour le contexte produit.

---

## DOC-002 — Documentation de suivi volumineuse et non indexée

- **Catégorie** : Documentation
- **Gravité** : P4 Mineur
- **Niveau de confiance** : Élevé
- **Statut de vérification** : Vérifié
- **Fichiers** : `Cadrage/Suivi/ETAT_ACTUEL.md` (7828 lignes), `JOURNAL_SESSIONS.md` (12617 lignes), `GAPS_OUVERTS.md` (4505 lignes)
- **Description** : documentation exceptionnellement riche et à jour, mais sa taille (25 000+ lignes cumulées) la rend difficile à parcourir pour quelqu'un qui n'a pas suivi le projet en continu — pas d'index, de table des matières, ou de résumé par fonctionnalité qui permettrait une recherche rapide sans lecture linéaire ou grep.
- **Solution recommandée** : un index par fonctionnalité (déjà amorcé par `BACKLOG_V1.md`) pourrait être étendu à `GAPS_OUVERTS.md`/`ETAT_ACTUEL.md`, ou ces fichiers pourraient être archivés par trimestre avec un résumé en tête.

---

## Légende

- **Niveau de confiance** : Élevé (preuve directe dans le code actuel) / Moyen (documenté mais non revérifié dans cet audit) / Faible (déduction).
- **Statut de vérification** : Vérifié / À vérifier davantage / Non vérifiable dans ce périmètre.
- **Gravité** : P0 Bloquant, P1 Critique, P2 Majeur, P3 Modéré, P4 Mineur (échelle de la commande d'audit).

## Tableau de synthèse

| ID | Titre | Gravité | Catégorie | Confiance | Statut |
|---|---|---|---|---|---|
| SEC-001 | Pas de rate limiting applicatif (chat/paris/bug reports) | P3 | Sécurité | Élevé | **Corrigé (PR #33)** |
| SEC-002 | Vuln npm "high" browserslist (dev-only) | P4 | Sécurité | Élevé | **Corrigé (PR #36)** |
| SEC-003 | Couverture zod partielle (13/22 fichiers) | P4 | Sécurité | Élevé | Vérifié — ouvert |
| SEC-004 | `error.message` brut sur 3 fichiers (assumé) | P4 | Sécurité | Élevé | Vérifié — aucune action requise |
| BUG-001 | Désync isLive/isDecided sur Bracket live — **CORRIGÉ** (déjà fixé le 16/08/2026) | P4 | Bug | Élevé | Vérifié — corrigé |
| BUG-002 | Deadline pari dupliquée en 3 endroits | P4 | Bug/dette | Élevé | **Corrigé (PR #35)** |
| BUG-003 | Roster IA non vérifié par données réelles | P2 | Bug | Élevé | **Corrigé (PR #30)** |
| ARCH-001 | `/chat` hors `APP_ZONE_PREFIXES` (compensé) | P4 | Architecture | Élevé | Vérifié — ouvert |
| ARCH-002 | Barème difficulté dupliqué (affichage) | P4 | Architecture | Élevé | **Corrigé (PR #36)** |
| ARCH-003 | Barème d'écart dupliqué (`MatchBaremeGrid`) | P4 | Architecture | Élevé | **Corrigé (PR #36)** |
| UX-001 | Pas de focus-trap dans les modales | P3 | UX | Élevé | **Corrigé (PR #37)** |
| UX-002 | Responsive quasi absent (0 breakpoint Tailwind) | P3 | UX | Élevé | Décidé (06/09), pas de code |
| A11Y-001 | Contraste `--color-trend` non vérifié | P4 | Accessibilité | Élevé | **Corrigé (PR #39)** |
| A11Y-002 | Pas d'audit a11y automatisé en CI | P4 | Accessibilité | Élevé | **Corrigé (PR #39)** |
| TEST-001 | 0 test composant/e2e/intégration API | P2 | Tests | Élevé | **Corrigé en partie (PR #38, e2e)** |
| TEST-002 | 0 test RLS/permissions | P2 | Tests | Élevé | **Corrigé (PR #34)** |
| TEST-003 | 0 test fuseau horaire/concurrence | P3 | Tests | Élevé | Vérifié — ouvert |
| OPS-001 | `heartbeat.yml` auto-désactivable après 60j | P2 | Exploitation | Élevé | **Corrigé (PR #35 + keep-alive.yml)** |
| OPS-002 | SMTP en fait Gmail, pas Resend — décision de fond toujours ouverte | P3 | Exploitation | Élevé | **Corrigé en partie (07/09/2026)** |
| OPS-003 | Pas de `npm audit` en CI | P4 | Exploitation | Élevé | **Corrigé (PR #36)** |
| DATA-001 | Statuts/colonnes ajoutés sans revue systématique | P3 | Données | Élevé | Vérifié — ouvert |
| DATA-002 | Suppression de compte non transactionnelle | P2 | Données | Élevé | **Corrigé (PR #32)** |
| DATA-003 | Quota 3 paris/série sans backstop index | P3 | Données | Moyen | À vérifier — ouvert |
| DATA-004 | Index manquants (tables secondaires) | P4 | Données | Élevé | Vérifié — ouvert |
| DATA-005 | Scoring non transactionnel (mitigé) | P4 | Données | Élevé | Vérifié — ouvert |
| DATA-006 | Trigger invariants sans test dédié | P4 | Données | Moyen | À vérifier — ouvert |
| DATA-007 | `age_confirmed_at` horodaté inconditionnellement | P3 | Données | Élevé | Vérifié — ouvert |
| DOC-001 | README générique | P4 | Documentation | Élevé | **Corrigé (PR #36)** |
| DOC-002 | Doc de suivi non indexée | P4 | Documentation | Élevé | Vérifié — ouvert |
| OPS-004 | Pas de garde-fou de séquencement code/migration | P3 | Exploitation | Moyen | **Corrigé (PR #35)** |
| DOC-003 | `security-audit-report.md` non mis à jour | P4 | Documentation | Élevé | **Corrigé (PR #36)** |

**Total : 31 anomalies** — 0 P0, 0 P1, 5 P2, 9 P3, 17 P4. **20 corrigées** (dont 2 partiellement :
TEST-001 — e2e fait, test de composant isolé toujours absent ; OPS-002 — SMTP réparé, décision de
fond toujours ouverte), **1 décidée sans code** (UX-002), **10 encore ouvertes sans action**
(SEC-003, SEC-004 assumé sans action, ARCH-001, TEST-003, DATA-001/003/004/005/006/007, DOC-002).
Mise à jour du 07/09/2026 — voir la feuille de route pour la suite priorisée de ce qui reste
ouvert.
