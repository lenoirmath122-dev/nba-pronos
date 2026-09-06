# NBA Pronos ("Panier Ballon") — État actuel

> **Nature** : instantané de l'état RÉEL du projet au moment de la dernière
> réécriture — **réécrit ENTIÈREMENT à chaque mise à jour, jamais complété
> ni accumulé**. Ne raconte pas ce qui a changé ni quand ; décrit uniquement
> ce qui est vrai maintenant. Pour l'historique chronologique (qui a changé
> quoi, quand, pourquoi), voir `JOURNAL_SESSIONS.md`. Pour les points
> ouverts/décisions en attente, voir `GAPS_OUVERTS.md`. Pour les règles
> fonctionnelles détaillées, voir `Cadrage/Fonctionnel/` et l'écran `/regles`
> de l'application elle-même (seule source garantie synchrone avec le code
> réel). Ce fichier ne contient pas de barème chiffré, de spec d'écran ni de
> décision produit détaillée — seulement une vue d'ensemble d'architecture
> et d'avancement.
>
> **Restructuration du 06/09/2026** : ce fichier avait dérivé en journal
> chronologique accumulé (7 828 lignes, préambule jusqu'à un §2.128 jamais
> réellement atteint par les sections numérotées du corps, qui s'arrêtaient
> à §2.100) — il dupliquait `JOURNAL_SESSIONS.md` au lieu de photographier
> l'état courant. Réécrit intégralement à partir : d'une relecture complète
> de l'ancien contenu, d'une vérification croisée avec le code réel
> (structure `app/`/`lib/`/`components/`, migrations, `package.json`,
> `next.config.ts`, `README.md`, exécution réelle de la suite de tests), et
> de l'audit indépendant du 03/09/2026 (`audit/RAPPORT_FINAL.md`,
> `audit/SCORECARD.md`). L'intégralité de l'ancien contenu est conservée
> telle quelle dans `Cadrage/Suivi/archive/ETAT_ACTUEL_archive_jusquau_2026-09-06.md`.

---

## 1. Vue d'ensemble

**Panier Ballon** est une application de pronostics et paris NBA à jouer
entre amis : pronostics de matchs, remplissage de bracket de playoffs (+
format "NBA Cup" à élimination directe), paris personnalisés en texte libre
structurés et résolus automatiquement par IA, classement avec ligues
privées, badges à paliers, chat temps réel, panneau d'administration
complet, self-service RGPD (export/suppression de compte).

Développée en quelques semaines par un développeur unique (débutant sur
cette stack au démarrage du projet) assisté en continu par Claude, en
dialogue permanent avec l'unique partie prenante produit. Le cœur technique
(autorisation, modèle de données, moteur de scoring) est structurellement
plus mature que ce que la taille et le rythme du projet laisseraient
attendre — confirmé par un audit indépendant en lecture seule le
03/09/2026. Contexte d'usage actuel : cercle fermé d'amis, phase alpha.

---

## 2. Stack technique et architecture

```text
Framework   : Next.js 16.2.12 (App Router, Turbopack, TypeScript). Cette
              version a des ruptures par rapport aux conventions plus
              anciennes — AGENTS.md impose de vérifier
              node_modules/next/dist/docs/ avant toute brique de code
              touchant une convention Next.js (ex. middleware.ts renommé
              proxy.ts, cookies()/searchParams asynchrones, next/image qui
              refuse d'optimiser un SVG sans dangerouslyAllowSVG).
UI          : React 19.2.4. CSS Modules colocalisés par composant
              (*.module.css), lisant exclusivement les tokens sémantiques de
              app/tokens.css (aucune valeur en dur). Tailwind v4 présent au
              projet mais cantonné aux écrans publics d'auth (login/signup/
              reset-password), pas la convention pour le reste de l'appli.
              Composants serveur par défaut ; un "use client" doit être
              justifié (un simple fetch de données n'en est pas un).
Backend     : Supabase (Postgres/Auth/RLS/Realtime). Trois clients cloisonnés
              (lib/supabase/{browser,server,service}.ts) — anon côté
              navigateur, anon+JWT cookies côté serveur, service_role
              (contourne la RLS) réservé aux routes système et jamais
              exposé au navigateur. Autorisation intégralement portée en
              base : RLS sur 100% des 31 tables publiques + fonctions
              SECURITY DEFINER pour les écritures qui doivent contourner une
              policy précise (paris, corrections, suppression de compte) +
              triggers d'invariants (empêchent l'auto-élévation de rôle,
              les transitions de statut invalides, etc.).
IA          : Anthropic (Claude) pour structurer un pari personnalisé en
              texte libre en un schéma de données calculable (lib/ai/*) —
              fonctionnalité différenciante du produit. Micro-service Python
              séparé (Cloud Run) pour le calcul des probabilités
              pré-match/live (voir §5).
Services    : Highlightly (données NBA officielles, synchro calendrier/
              scores), Web Push (VAPID) pour les notifications, Cloudflare
              Turnstile (anti-bot sur signup/login).
Écriture    : exclusivement via Server Actions (lib/actions/*) ; lecture via
              des requêtes dédiées (lib/queries/*) — séparation stricte,
              aucune Server Action ne sert à la fois lecture et écriture.
Déploiement : Vercel (région Dublin — dub1, alignée sur la région Supabase
              eu-west-1), déploiement auto sur merge vers `main`. Migrations
              Supabase séparées du déploiement applicatif, jamais
              automatiques (voir audit/RUNBOOK_MIGRATIONS.md).
```

---

## 3. Modèle de données

66 migrations SQL versionnées (`supabase/migrations/`, nommage
`<timestamp>_nom.sql`), appliquées via `npx supabase db push`. 31 tables
publiques, RLS activée sur 100% d'entre elles (vérifié exhaustivement par
l'audit du 03/09/2026). Domaines couverts :

- **Identité/auth** : `users` (pont depuis `auth.users` via trigger SQL),
  rôles PLAYER/ADMIN.
- **Compétitions & structure de jeu** : `competitions` (type PLAYOFFS ou
  NBA_CUP), `competition_secrets`, `competition_archives`,
  `competition_superlatives`, `series`, `matches`, `teams`,
  `entity_mappings` (résolution des identifiants Highlightly ↔ IDs internes).
- **Pronostics & paris** : `match_predictions`, `brackets`,
  `bracket_picks`, `bets` (paris personnalisés), `correction_requests`
  (contestation d'un score déjà calculé, y compris après verrouillage).
- **Classement & ligues** : vues `user_scores`/`user_recent_form`
  (`security_invoker=false`, n'exposent que des agrégats — jamais une ligne
  individuelle, la confidentialité par pari/pronostic reste portée par la
  RLS des tables sources), `leagues`, `league_memberships`,
  `league_secrets`, `leaderboard_snapshots`.
- **Chat** : `chat_messages`, `chat_muted_channels`, `chat_message_reports`.
- **Signalements & exploitation** : `bug_reports`, `sync_logs`,
  `audit_logs`, `reminder_log`, `rate_limit_events`, `push_subscriptions`.
- **Données statistiques NBA** (alimentées par le micro-service Python, voir
  §5) : `stats_matchs`, `stats_equipes`, `stats_joueurs`,
  `stats_box_scores`, `stats_box_scores_by_period`, `stats_block_events`.

Patrons récurrents : les écritures les plus sensibles (création/résolution
de pari, suppression de compte, corrections) passent par des fonctions
`SECURITY DEFINER` qui revalident systématiquement propriété/`auth.uid()`
elles-mêmes plutôt que de faire confiance à l'appelant ; les écrans de
lecture consomment directement `getServerClient()` (jamais `service_role`).
Point de vigilance déjà identifié (audit `DATA-001`) : plusieurs migrations
correctives ont été nécessaires après l'ajout d'un nouveau statut/colonne
sans revue systématique des objets dépendants — à garder en tête pour toute
nouvelle valeur d'enum.

---

## 4. Fonctionnalités livrées

### 4.1 Compte et authentification
Supabase Auth (email + mot de passe), CAPTCHA Cloudflare Turnstile vérifié
côté serveur sur signup/login, déclaration d'âge à l'inscription,
confirmation du mot de passe côté client. Écrans `/login`, `/signup`,
`/reset-password`, `/verify-email`, `/email-confirmed` (groupe
`app/(public)`, non retouchés selon la convention design des écrans joueur —
Tailwind brut).

### 4.2 Pronostics de match, Bracket Playoffs, NBA Cup
Écran **Matchs** (pronostic vainqueur + écart), écran **Bracket personnel**
(remplissage, rendu en arbre visuel connecté — mode principal partout depuis
le 17/08/2026), vue **Bracket globale** de consultation (`/bracket`,
distincte du remplissage). Deux formats de compétition : Playoffs NBA
(best-of-7, score de série) et NBA Cup (élimination directe, barème dédié).
Live : statut/score de série poussé en Realtime (publication
`supabase_realtime` sur `matches`), bandeau LiveTicker épinglé au-dessus de
la TabBar sur l'écran Jouer.

### 4.3 Paris personnalisés structurés par IA
Fonctionnalité différenciante du produit (~4000 lignes,
`lib/ai/*` + `components/bets/*`). Un joueur rédige un pari en texte libre
(ex. "Jokic fait un triple-double ET plus de 25 points") ; Claude le
structure en un schéma typé et routé par famille (`lib/ai/structure*.ts` —
MATCH_TOTAL, TEAM_STAT, PERIOD, ROSTER_SPLIT, ROSTER_COUNT, COMPARISON,
COMBO, GAME_EVENT, TECHNICAL_FOULS_COUNT, LAST_BASKET, BLOCK_ON_PLAYER,
SUPERLATIF, entre autres) ; la résolution automatique
(`lib/ai/resolveCalculable*.ts`, une fonction dédiée par famille) calcule
gagné/perdu une fois les données officielles disponibles, avec repli
`is_calculable=false` (jamais bloquant) si la formulation ne peut pas être
résolue automatiquement — un admin traite alors le pari à la main. Chaque
pari jugé calculable par l'IA est validé directement, sans geste admin ;
l'admin garde un droit de correction après coup. Le pipeline de probabilités
pré-match (utilisé pour informer/valider certains paris) s'appuie sur le
micro-service Python (§5) avec repli `null`/non-calculable systématique en
cas de panne (jamais d'exception qui casserait la soumission d'un pari —
vérifié explicitement le 03/09/2026 sur les 18 fonctions `predict*()`).
Depuis début septembre 2026, l'effectif réel des deux équipes est injecté
dans le prompt de structuration (au lieu de compter sur la seule
connaissance générale du modèle) pour réduire les erreurs de vérification de
présence au roster.

### 4.4 Classement, ligues, badges, superlatifs
Classement global avec tri par en-têtes cliquables, tendance de rang, top 3
mis en avant. Ligues privées (création, code d'invitation, appartenance).
Badges permanents à paliers (Bronze/Argent/Or/Platine/Diamant), catalogue de
base complet sur trois familles (pronostics de match, bracket personnel,
paris perso) + badges de volume/participation ; jusqu'à 3 badges épinglables
dans le bandeau de profil. Superlatifs de fin de compétition (Nostradamus,
Sniper, Meilleur bracket, Meilleur 1ᵉʳ tour, Plus grosse remontée),
calculés une fois à la clôture d'une compétition.

### 4.5 Chat
Canal général + un canal par ligue, liste de canaux avec notifications par
canal (mute possible), signalement d'un message (`chat_message_reports`,
distinct du panneau `/admin/bug-reports`).

### 4.6 Notifications et rappels
Web Push (VAPID) pour les rappels ciblés (deadlines de pronostic/bracket
proches), notifications de chat par canal. Rappels automatisés côté serveur
via workflows GitHub Actions programmés (`reminder-bracket.yml`,
`reminder-matches.yml`).

### 4.7 Panneau d'administration
Groupe de routes `app/(admin)/admin/` : tableau de bord, validation des
pronostics/paris, résolution des paris non calculables automatiquement,
requêtes de correction, gestion des joueurs, gestion des compétitions
(création, résultats, clôture/archivage), vue "qui manque à l'appel",
historique des logs, file des signalements de bug (`/admin/bug-reports`),
file des signalements de messages de chat (`/admin/chat-reports`).

### 4.8 RGPD — self-service compte
Suppression de compte en self-service (`lib/actions/account.ts`,
`deleteAccountFormAction`) rendue **atomique/rejouable** début septembre
2026 (corrige l'ancien risque d'état partiellement supprimé en cas
d'interruption) — refuse un rôle ADMIN ou une ligue créée avec d'autres
membres actifs, confirmation par saisie du pseudo exact. Export de données
en self-service (`app/api/account/export/route.ts`, JSON téléchargeable :
profil, paris, messages de chat, signalements, appartenances de ligue).

### 4.9 Signalements
Bouton "Signaler" flottant sur tout l'espace joueur connecté (texte libre,
contexte capturé automatiquement) — capture ce qui se perdrait sinon en DM
pendant l'alpha/bêta, distinct de `correction_requests` (qui conteste un
score déjà calculé).

---

## 5. Micro-service Python de calcul de probabilités

`Cadrage/Stats/service/` (déployé sur Cloud Run, région europe-west1),
appelé par `lib/ai/statsService.ts`. Modèles entraînés (scripts dans
`Cadrage/Stats/scripts/`) sur l'historique NBA local (télécharge/backfill
play-by-play et box-scores, y compris par période) pour prédire des
probabilités pré-match sur de nombreuses familles de stats (équipe et
joueur, y compris par période/quart-temps). Protégé par un secret partagé
(`STATS_SERVICE_SECRET`, header `Authorization: Bearer`) sur toutes les
routes `/predict*` — seule `/health` reste ouverte. Comportement de panne
vérifié robuste de bout en bout (repli `null`/non-calculable systématique,
jamais d'exception propagée). Alimente aussi une partie des tables
`stats_*` de Supabase via des scripts de backfill/synchro quotidienne
(`refresh_daily.py`, workflow `refresh-stats-supabase.yml`).

---

## 6. Sécurité — état actuel

Un audit de sécurité dédié (29/08/2026, `security-audit-report.md`,
commité) a identifié 15 findings (1 critique/1 élevé/6 moyen/6 faible/1
info) ; 11 des 13 findings pertinents étaient déjà corrigés et
**revérifiés indépendamment** par l'audit global du 03/09/2026. Aucune
vulnérabilité de gravité P0/P1/P2 n'était ouverte à cette date. Mesures en
place : rotation complète de la clé `service_role` précédemment fuitée
(migration vers les clés Supabase `sb_publishable_`/`sb_secret_`, anciennes
clés legacy désactivées), secret d'authentification sur le micro-service
Cloud Run, headers de sécurité HTTP complets (`next.config.ts` — CSP,
X-Frame-Options, etc.), CAPTCHA Turnstile vérifié serveur, comparaison
timing-safe sur `SYNC_SECRET`, helper d'erreur générique évitant de
renvoyer un message d'erreur brut au client sur la plupart des écritures,
limites de taille sur les champs texte libre (bio/pari/justification/
signalement), rate limiting applicatif de base sur chat/paris/signalements
(ajouté début septembre 2026), tests d'intégration automatisés sur la RLS
(propriété des paris et du bracket).

Point restant, assumé et documenté (pas un bug) : les cookies de session ne
sont pas `HttpOnly`, compensé par la CSP en filet. Configuration réelle du
dashboard Supabase de production (rate-limiting natif, CAPTCHA serveur au
niveau Auth, Leaked Password Protection) non vérifiable depuis le dépôt de
code — à confirmer manuellement si besoin.

---

## 7. Qualité, tests, CI/CD

- **Tests unitaires** (`npm test`, Vitest) : 240 tests sur 21 fichiers,
  tous verts au 06/09/2026. Couvrent la logique métier la plus critique —
  moteur de scoring pur, résolution automatique des paris IA (une fonction
  de test dédiée par famille de pari), deadline de pari (désormais
  factorisée en un seul module, `lib/scoring/bet-deadline.ts`).
- **Tests d'intégration** (`npm run test:integration`, nécessite
  `npx supabase start`) : scénarios RLS/permissions (propriété des paris et
  du bracket).
- **Tests e2e** (`npm run test:e2e`, Playwright, `e2e/`) : 3 parcours
  critiques (focus-trap clavier sur les dialogues, connexion → pronostic →
  déconnexion, statut d'un pari personnalisé). Environnement dédié (port
  3100, Supabase local, comptes/données de test créés puis nettoyés
  automatiquement).
- `tsc --noEmit` et `eslint .` propres à 100% sur le code applicatif.
- **CI** (`.github/workflows/ci.yml`) bloquante : lint/typecheck/test/build,
  `npm audit` intégré. Autres workflows programmés : `heartbeat.yml`
  (anti-pause), `sync-teams.yml`/`sync-schedule.yml`/`sync-results.yml`
  (synchro NBA via Highlightly), `reminder-bracket.yml`/
  `reminder-matches.yml`, `snapshot-leaderboard.yml`,
  `refresh-stats-supabase.yml`, `nba-cup-alpha-reveal.yml`.
- Limite connue et assumée : aucun test de composant React, et la
  génération de schéma IA elle-même (appels réels à Claude) reste testée à
  la main plutôt qu'automatisée — seule la résolution déterministe en aval
  est couverte par des tests.

---

## 8. Déploiement et exploitation

Déployé sur Vercel (`https://nba-pronos.vercel.app`, domaine
`panierballon.fr` acheté et pointé), région `dub1` (Dublin, alignée sur
Supabase `eu-west-1`), déploiement automatique sur merge vers `main`.
Migrations Supabase poussées séparément (`npx supabase db push`), jamais
par le pipeline de déploiement — une checklist de séquencement
code/migration existe (`audit/RUNBOOK_MIGRATIONS.md`) pour éviter qu'un
déploiement suppose un schéma pas encore migré. Route de santé `/api/health`
disponible pour un monitoring externe. Route `/api/heartbeat` + workflow
associé pour éviter l'auto-désactivation de GitHub Actions après 60 jours
sans activité. `README.md` documente prérequis/installation/tests/
déploiement de bout en bout pour un nouveau contributeur ; `.env.example`
liste toutes les variables d'environnement nécessaires avec leur usage.

Workflow Git du projet : toujours une branche + PR (jamais de commit direct
sur `main`), CI verte requise, merge final toujours un geste humain
explicite de l'utilisateur.

---

## 9. État des compétitions

Aucune compétition réelle active au 06/09/2026 — pause intentionnelle entre
la phase alpha et la vraie NBA Cup (le trafic réel reprendra à ce
moment-là ; certaines décisions mesurables, ex. persistance d'usage IA, sont
explicitement reportées jusque-là plutôt que devinées). La compétition
**NBA Cup alpha** est entièrement préparée (quarts de finale déjà créés à
partir de vrais matchs NBA déjà joués, effectifs générés,
`NBA_CUP_ALPHA_EFFECTIFS.md`) et calendrée pour la seconde moitié de
septembre 2026. Les étapes 1 à 3 de son runbook de révélation
(révélation automatique d'un tour terminé, résolution des paris chaînée,
création automatique du match du tour suivant) sont automatisées côté
Next.js (`lib/nbaCupAlpha/*`, workflow `nba-cup-alpha-reveal.yml`, cron 30
min) et mergées sur `main` — plus besoin d'intervention manuelle le jour J
pour ces étapes.

---

## 10. Conventions de travail actuelles

- L'utilisateur committe/merge lui-même via des PR (branche dédiée par
  chantier, CI verte requise, clic "Merge" toujours humain) — Claude ne
  committe/pousse jamais directement sur `main`.
- Toute migration SQL passe par `supabase/migrations/` + `npx supabase db
  push`, jamais par un copier-coller manuel dans l'éditeur SQL Supabase ;
  contenu montré intégralement avant application.
- Toute validation serveur recalcule ses propres garde-fous depuis la base
  — jamais de confiance dans ce qu'affiche le client.
- Écrans joueur : aucune valeur visuelle en dur, uniquement les tokens de
  `app/tokens.css` via CSS Modules colocalisés ; composants serveur par
  défaut, "use client" justifié explicitement.
- Avant d'écrire du code touchant une convention Next.js, vérifier
  `node_modules/next/dist/docs/` (rappelé par `AGENTS.md`).
- Noms de colonnes/valeurs de statut absents d'une spec produit : lire le
  schéma réel avant d'écrire une requête, jamais deviner.
- En cas d'ambiguïté réelle (spec contradictoire, périmètre qui déborde
  d'un écran), s'arrêter et demander plutôt que choisir en silence.
- Un jeu de données de test réel (pas seulement `tsc`/`eslint`/`next
  build`) fait partie de la vérification avant de considérer un chantier
  fermé, quand c'est praticable.
- Secrets/clés API : jamais collés en clair dans la conversation.
- Les fichiers de suivi (`ETAT_ACTUEL.md`, `JOURNAL_SESSIONS.md`,
  `GAPS_OUVERTS.md`) sont mis à jour à la fin de chaque chantier notable —
  `ETAT_ACTUEL.md` spécifiquement réécrit en entier, jamais accumulé (voir
  l'en-tête de ce fichier).

---

## 11. Points ouverts connus

Suivi vivant dans `Cadrage/Suivi/GAPS_OUVERTS.md` (points fonctionnels/
produit) et `audit/PLAN_ACTION.md` (plan d'action issu de l'audit du
03/09/2026, organisé en 4 vagues). Au 06/09/2026, la quasi-totalité des
actions des vagues 1 à 4 de `PLAN_ACTION.md` sont traitées (suppression de
compte atomique, rate limiting, tests d'intégration RLS, injection du
roster réel dans le pipeline IA, factorisation de la deadline de pari,
route de santé + checklist de migration, suite e2e, README réel, barèmes
factorisés, `npm audit` en CI, focus-trap clavier sur les dialogues,
`eslint-plugin-jsx-a11y`, mesure des Web Vitals). Reste ouvert
explicitement :

- **D2 — responsive desktop** (`UX-002`) : décidé le 06/09/2026 — un visuel
  distinct PC/téléphone viendra à terme (l'app n'est pas mobile-only par
  choix définitif), mais rien n'est planifié ni codé pour l'instant. Le
  Bracket a déjà son arbre visuel connecté (§4.2) ; l'effort restant
  concernerait plutôt le Classement/l'Accueil (toujours 0 breakpoint
  Tailwind hors auth).
- Base légale précise pour les 15-17 ans (RGPD, `GAPS_OUVERTS.md` §8.5) —
  hors de portée d'un codage, nécessite un avis juridique.
- Décision de persistance de l'usage du pipeline IA (TTL cache /
  classify-then-structure) reportée faute de trafic réel — à revisiter au
  démarrage de la vraie NBA Cup.

---

## 12. Carte rapide des dossiers

```text
app/
  (public)/   — login, signup, reset-password, verify-email, email-confirmed.
  (app)/      — espace joueur connecté : home, play (hub Jouer), chat, profile.
  (admin)/    — panneau d'administration complet (voir §4.7).
  api/        — routes système : sync/*, reminders/*, snapshots/*, heartbeat,
                health, resolve-bets, account/export, nba-cup-alpha/auto-reveal.
  bracket/, leaderboard/, players/, regles/ — vues de consultation partagées
    visiteur/connecté (nav choisie par ScreenShell.tsx, hors du groupe (app)).
  cgu/, confidentialite/, mentions-legales/ — pages légales.

lib/
  actions/    — Server Actions (écriture), une famille par domaine.
  queries/    — lecture dédiée par écran/domaine.
  ai/         — structuration + résolution des paris personnalisés IA.
  scoring/    — moteur pur (engine.ts) + orchestration (recompute.ts) +
                avancement de bracket + superlatifs.
  sync/       — intégration Highlightly (calendrier, scores, équipes).
  auth/, badges/, dates/, hooks/, labels/, nba/, nbaCupAlpha/, push/,
  reminders/, snapshots/, supabase/ — modules dédiés par domaine.

components/   — un dossier par domaine d'écran (admin, auth, bets, bracket,
  bracket-fill, chat, feedback, home, leaderboard, my-bets, nav, play,
  profile, regles) ; ui/ — primitives partagées transversalement
  (ModalDialog.tsx, etc.).

supabase/migrations/ — 66 migrations SQL versionnées, voir §3.

Cadrage/
  Fonctionnel/, V1/ — specs produit/techniques.
  Suivi/            — ce fichier, JOURNAL_SESSIONS.md, GAPS_OUVERTS.md,
                       archive/ (contenu pré-restructuration).
  Stats/            — micro-service Python + scripts d'entraînement (§5).
  DA/               — gitignored, visuels/identité graphique.

audit/        — audit indépendant du 03/09/2026 (rapport, scorecard, plan
  d'action, anomalies détaillées par axe) — voir §11.

e2e/          — suite Playwright (§7).
```
