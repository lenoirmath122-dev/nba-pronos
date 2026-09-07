# Audit de sécurité — nba-pronos

> **⚠️ Document figé au 29/08/2026, en grande partie dépassé (mis à jour 07/09/2026).** La plupart
> des findings ci-dessous sont déjà corrigés et vérifiés depuis — dont les 2 plus sérieux (fuite de
> la clé `service_role`, service Cloud Run non protégé, tous deux évoqués §4/§6 ci-dessous). Pour le
> statut précis finding par finding, voir `audit/ANOMALIES.md` (registre daté, mis à jour au
> 07/09/2026) et `audit/PLAN_ACTION.md` (suivi des correctifs par PR).

**Date de l'audit** : 29/08/2026
**Périmètre** : dépôt `c:\dev\nba-pronos` en entier — application Next.js 16 (App Router) + Supabase (Postgres/Auth/RLS), Server Actions, routes API, migrations SQL, scripts, et micro-service Python (Cloud Run) de calcul de probabilités référencé depuis `Cadrage/Stats/`.
**Nature** : audit **read-only**. Aucun fichier n'a été modifié. Toutes les recommandations sont à mettre en œuvre par l'équipe projet.
**Méthode** : analyse manuelle + 4 revues ciblées en parallèle (authentification/sessions/secrets, contrôle d'accès/RLS, injections/validation des entrées, configuration serveur/logs/dépendances/stockage), `npm audit`, lecture intégrale des migrations RLS et des triggers d'invariants, grep exhaustif du dépôt (hors `node_modules`, `.next`, `.git`).

---

## Résumé exécutif

| Sévérité | Nombre |
|---|---|
| Critique | 1 |
| Élevé | 1 |
| Moyen | 6 |
| Faible | 6 |
| Info | 1 |

**Constat général.** L'application est d'une qualité de sécurité applicative nettement au-dessus de la moyenne pour un projet de cette taille. Le design est cohérent et documenté dans le code lui-même : `proxy.ts` ne fait qu'une garde d'**authentification** (session valide ou non, via `getUser()` revalidé serveur — jamais `getSession()`) ; l'**autorisation** fine (rôle admin, propriété d'une ressource) est portée par la base Postgres via Row Level Security, des fonctions `SECURITY DEFINER`, et des triggers d'invariants qui protègent des scénarios comme l'auto-promotion admin ou la suppression du dernier admin actif — un contournement de la couche applicative (appel direct d'une Server Action) n'ouvre donc, dans la quasi-totalité des cas, aucun accès non désiré. Aucune injection SQL, aucune injection de commande système, aucun XSS (`dangerouslySetInnerHTML` absent de tout le dépôt) n'a été trouvé.

Les deux findings les plus sérieux ne concernent **pas** le code applicatif Next.js mais l'infrastructure annexe : un incident réel et documenté de fuite de la clé `service_role` Supabase (jamais régénérée), et un micro-service Cloud Run public détenant cette même clé. Le reste des findings relève du durcissement (headers HTTP, limites de taille, cohérence de la validation, verbosité des messages d'erreur) plutôt de failles activement exploitables aujourd'hui.

---

## 1. Authentification & sessions

**Hashing des mots de passe — Bon.** Entièrement délégué à Supabase Auth (GoTrue). Aucun mot de passe en clair n'est stocké ou manipulé côté application ; `lib/auth/actions.ts` ne fait que transmettre au SDK (`signInWithPassword`/`signUp`/`updateUser`). La table applicative `users` (`supabase/migrations/20260718090000_initial_schema.sql:69-80`) ne contient d'ailleurs ni email ni mot de passe — choix de conception explicite, tout reste dans `auth.users`.

**Pattern `getUser()` appliqué uniformément — Bon.** `proxy.ts:48` et plus de 50 fichiers serveur (`lib/actions/*`, `lib/queries/*`, layouts) utilisent `supabase.auth.getUser()`, jamais `getSession()` côté serveur pour une décision de sécurité. Le seul `getSession()` trouvé (`components/auth/ResetPasswordForm.tsx:34`) est côté client et ne pilote qu'un affichage UI, pas une autorisation.

**[Moyen] Pas de protection anti brute-force applicative sur le login.**
*Fichier* : `lib/auth/actions.ts` (fonction `login`).
*Constat* : aucune limitation de tentatives, CAPTCHA ou lockout compte côté application ; `proxy.ts` ne fait pas de rate-limiting. La seule protection est celle par défaut de Supabase (`supabase/config.toml` → `[auth.rate_limit]`, `[auth.captcha]` commenté/désactivé), et ce fichier est la config **locale** (CLI), rien ne garantit qu'elle reflète les réglages réels du projet Supabase de **production**.
*Risque* : credential-stuffing distribué (IPs multiples) sans garde-fou applicatif.
*Recommandation* : activer un CAPTCHA (hCaptcha/Turnstile, supporté nativement par Supabase Auth) sur login/signup, activer "Leaked Password Protection" (HaveIBeenPwned) dans le dashboard Supabase, et vérifier manuellement les réglages effectifs en production (ne pas se fier à `config.toml`).

**[Faible] Énumération de compte sur le signup.**
*Fichier* : `lib/auth/actions.ts:81-82,90-92`.
*Constat* : message explicite "Un compte existe déjà avec cet email." en cas de doublon. À l'inverse, le flux reset-password applique correctement l'anti-énumération (message générique, `ResetPasswordForm.tsx:59-62`).
*Recommandation* : si acceptable pour l'UX du flux (code compétition + pseudo + email combinés), documenter le compromis ; sinon, généraliser le message générique.

**Flux mot de passe oublié — Bon.** SDK Supabase standard (`resetPasswordForEmail` + écoute `onAuthStateChange("PASSWORD_RECOVERY")` + `updateUser`), message anti-énumération générique, déconnexion forcée après changement (`ResetPasswordForm.tsx:87-88`).

**[Faible] Cookies de session non `HttpOnly` par défaut.**
*Fichiers* : `lib/supabase/server.ts:13-34`, `proxy.ts:23-42`, `lib/supabase/browser.ts` — aucune `cookieOptions` explicite passée à `createServerClient`.
*Constat* : `@supabase/ssr` utilise par défaut `httpOnly: false`, `sameSite: "lax"`, sans `secure` forcé (nécessaire pour que le client navigateur s'authentifie auprès de Supabase Realtime). C'est un compromis architectural du SDK Supabase, pas une erreur de configuration propre au projet.
*Risque* : en cas d'apparition future d'une faille XSS (aucune trouvée dans cet audit), le cookie de session serait directement volable en JavaScript.
*Recommandation* : documenter ce compromis, garantir la discipline actuelle (pas de `dangerouslySetInnerHTML`, pas de rendu HTML non échappé), envisager une CSP stricte en filet de sécurité (cf. finding Moyen sur les headers HTTP), et forcer `secure: true` en production si le flux Realtime le permet.

**JWT / expiration / refresh — Info / Bon.** Entièrement gérés par Supabase (`jwt_expiry = 3600`, `enable_refresh_token_rotation = true`). Aucun stockage en `localStorage`, aucune gestion de token faite maison.

---

## 2. Contrôle d'accès

**Modèle général — Très solide.** `is_admin()` (`supabase/migrations/20260718110000_rls.sql:44-47`) est une fonction `SECURITY DEFINER` qui lit `users.role`, jamais un claim JWT. L'écriture de `role`/`status` sur `users` est protégée à double niveau : RLS (`users_update_admin`) **et** un trigger `enforce_users_invariants` (`20260718120000_fix_users_trigger_system_context.sql:26-29`) qui interdit l'auto-promotion, l'auto-rétrogradation d'un admin, et la suppression du dernier admin actif — même un bug RLS ne permettrait pas une auto-élévation de privilège. Les écritures sensibles (paris, corrections, ligues) passent par des fonctions SQL `SECURITY DEFINER` (`save_bet`, `withdraw_bet`, `delete_bet`, `request_prediction_correction`, `create_league`/`join_league`, etc.) qui revérifient elles-mêmes `auth.uid()` et la propriété de la ressource — protection IDOR par construction, pas seulement côté UI. `app/(admin)/admin/layout.tsx:10-29` revérifie `is_admin()` côté serveur à chaque navigation et redirige sans révéler l'existence du panneau admin à un non-admin. `app/(app)/play/bets/[id]/edit` vérifie explicitement `betRow.user_id !== user.id` avant de renvoyer les données d'édition (`lib/queries/bets.ts:176-207`) — pas d'IDOR en lecture malgré l'ID exposé dans l'URL.

**[Moyen] `setPlayerRole`/`setPlayerStatus` sans garde `is_admin()` explicite → faux succès et entrée d'audit trompeuse.**
*Fichier* : `lib/actions/admin-players.ts:17-65`.
*Constat* : contrairement à `admin.ts`, `admin-competitions.ts`, `admin-results.ts` (qui font tous `const { data: isAdmin } = await supabase.rpc("is_admin"); if (!isAdmin) return {...}`), ces deux actions ne vérifient que l'authentification (`if (!user)`), puis comptent sur la RLS pour bloquer l'écriture. Or le code ne vérifie pas non plus qu'une ligne a effectivement été modifiée (pas de `.select().maybeSingle()` après l'`UPDATE`).
*Scénario d'exploitation* : un joueur non-admin authentifié appelle directement `setPlayerRole({ userId: <autre id>, role: "ADMIN" })` (une Server Action Next.js est invocable sans passer par l'UI). L'écriture est bien bloquée par la RLS/le trigger (**pas d'élévation de privilège réelle, vérifié**), mais Postgres ne renvoie aucune erreur sur un `UPDATE` qui touche 0 ligne : la fonction retourne `{ success: true }` **et écrit une entrée `audit_logs` (`SET_PLAYER_ROLE`) qui prétend faussement qu'un changement a eu lieu**, ce qui nuit à la fiabilité du journal d'audit en cas d'investigation d'incident.
*Recommandation* : ajouter la revérification explicite `supabase.rpc("is_admin")` et systématiser `.select("id").maybeSingle()` sur l'`UPDATE` pour détecter un no-op RLS et ne jamais logger un succès qui n'en est pas un.

**[Faible] Même schéma sur `resolveBugReportFormAction` et `deleteChatMessageFormAction`.**
*Fichiers* : `lib/actions/bug-reports.ts:46-72`, `lib/actions/chat.ts:95-106` (cette dernière n'appelle même pas `auth.getUser()`, choix documenté en commentaire : « un appel forgé par un non-admin supprime 0 ligne, silencieusement »).
*Risque* : plus faible que le finding précédent (ni levier de privilège, ni entrée d'audit faussée), mais un non-admin qui invoquerait ces actions directement croirait à tort avoir réussi une action de modération.
*Recommandation* : par cohérence, ajouter `is_admin()` explicite et un contrôle du nombre de lignes affectées.

**Point positif** : `league_memberships_select` contenait une policy RLS récursive détectée en testant avec deux comptes réels, corrigée proprement via une fonction `SECURITY DEFINER` (`20260730093000_fix_league_memberships_recursion.sql`) — bon signal de rigueur de test.

---

## 3. Injections

**Bilan très propre.** Recherche exhaustive sur tout le dépôt :
- Aucune concaténation SQL — 100% des accès passent par le query builder Supabase JS (requêtes paramétrées) ou des `.rpc()` vers des fonctions PL/pgSQL typées.
- Aucun `EXECUTE format`/`EXECUTE '...'` dans les 60+ fichiers de `supabase/migrations/*.sql`.
- Aucune injection de commande système (`child_process`, `exec(`, `execSync(`, `spawn(`, `eval(`) — zéro résultat pertinent.
- Aucun `dangerouslySetInnerHTML` dans tout le dépôt (`.tsx`) — le contenu utilisateur libre (chat, bug reports, bio, description de pari) est systématiquement rendu via l'échappement JSX standard de React.
- La structuration de paris par IA (`lib/ai/structureBet.ts` et fichiers associés) contraint strictement la sortie du modèle Anthropic via des schémas `zod` (enums fermés, types stricts) : même en cas de prompt injection dans le texte libre du pari, la sortie exploitée en aval reste bornée et n'est jamais utilisée pour construire une requête SQL ou déclencher une action privilégiée.

Aucun finding sur cet axe.

---

## 4. Gestion des secrets

**[CRITIQUE] Clé `SUPABASE_SERVICE_ROLE_KEY` documentée comme ayant fuité en clair, rotation refusée.**
*Fichier* : `Cadrage/Stats/service/DEPLOIEMENT_CLOUD_RUN.md:50-54` (contenu vérifié directement).
*Citation exacte du fichier* :
> « Incident réel le 21/08/2026 : la clé est apparue en clair via une sélection IDE collée par mégarde — rotation proposée, déclinée par l'utilisateur ce jour-là. »
*Risque* : `SUPABASE_SERVICE_ROLE_KEY` (utilisée par `lib/supabase/service.ts`) **contourne intégralement la RLS** — accès total en lecture/écriture à toutes les tables de la base, sans restriction. Une fois cette valeur sortie du terminal (historique de presse-papiers, télémétrie d'éditeur, capture d'écran, partage d'écran…), l'équipe ne maîtrise plus où elle a pu atterrir. Tant qu'elle n'est pas régénérée, le risque reste ouvert indéfiniment, indépendamment de la qualité du reste du code applicatif.
*Recommandation* : **régénérer immédiatement** `SUPABASE_SERVICE_ROLE_KEY` dans le dashboard Supabase, puis mettre à jour toutes les cibles qui la consomment (`.env.local`, variables Vercel, secret `nba-pronos-supabase-key` dans Google Secret Manager). Documenter la rotation. Mettre en place un hook pre-commit (`gitleaks` ou équivalent) et éviter tout copier-coller de secret dans un IDE/chat sans passer par un gestionnaire de secrets dédié.

**Séparation client/serveur des secrets — Bon.** `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase/service.ts:20`), `VAPID_PRIVATE_KEY` (`lib/push/send.ts`), `ANTHROPIC_API_KEY` (fichiers `lib/ai/structure*.ts`), `HIGHLIGHTLY_API_KEY` (`lib/nba/client.ts`) sont **tous** lus dans des modules démarrant par `import "server-only"` — le build échoue si un composant client les importe, même transitivement. Seules 3 variables `NEXT_PUBLIC_*` existent dans tout le repo, toutes légitimement publiques.

**Aucun secret en dur — Bon.** Recherche exhaustive (`sk-`, `AKIA`, `-----BEGIN`, littéraux `password/apiKey/secret="..."`) : zéro résultat. `.env.local` n'est jamais commité (`git ls-files` et `git log --all` confirment son absence totale de l'historique), correctement exclu via `.gitignore` (`.env*`).

**[Faible] Comparaison non constante du secret `SYNC_SECRET`.**
*Fichier* : `lib/sync/auth.ts:8` — `return request.headers.get("authorization") === \`Bearer ${expected}\`;`
*Risque* : comparaison `===` non "timing-safe" ; risque théorique de timing attack pour reconstituer le secret. Exploitabilité jugée faible en pratique (jitter réseau/cold starts serverless noient le signal), mais l'enjeu protégé est élevé : ces routes (`/api/sync/*`, `/api/heartbeat`, `/api/resolve-bets`, `/api/reminders/*`, `/api/snapshots/leaderboard`) utilisent `service_role`.
*Recommandation* : remplacer par `crypto.timingSafeEqual` sur des buffers de longueur égale.

**Pas de fuite de secret dans les logs — Bon.** Grep exhaustif de `console.log/error/warn` : aucune trace de token/mot de passe/secret. `HIGHLIGHTLY_API_KEY` est transmise uniquement via header HTTP (`lib/nba/client.ts:66`), jamais interpolée dans les messages d'erreur stockés en base (`sync_logs`), eux-mêmes protégés par RLS admin-only.

---

## 5. Dépendances

**[Faible] 3 vulnérabilités "high" sur des dépendances transitives de build.**
*Constat* (`npm audit`, exécuté en lecture seule) :
- `nanoid@3.3.16` (< 3.3.18) — boucle infinie (CWE-835), via `@tailwindcss/postcss → postcss@8.5.23`
- `brace-expansion` (< 5.0.9) — DoS, via `eslint → minimatch@10.2.6`
- `js-yaml@4.3.0` (< 4.3.1) — DoS quadratique, via `eslint → @eslint/eslintrc`
*Analyse* : `npm ls nanoid` confirme que ces paquets sont introduits uniquement par la toolchain de build/lint (`eslint`, `@tailwindcss/postcss`) — aucun n'est présent dans le bundle runtime servi aux utilisateurs. Point notable : l'override `package.json:26` (`"brace-expansion": "^..."`) épingle actuellement une version antérieure au correctif.
*Recommandation* : relever l'override `brace-expansion` à `^5.0.9`, mettre à jour `eslint`/`@eslint/eslintrc` et `@tailwindcss/postcss`, relancer `npm audit`. Intégrer un scan de dépendances (Dependabot ou équivalent) en CI — aucun n'est configuré actuellement.

**Versions de production à jour — Bon.** Next 16.2.12, React 19.2.4, `@supabase/supabase-js` 2.110.7, `@supabase/ssr` 0.12.3, `@anthropic-ai/sdk` 0.120.0, `zod` 4.4.3, `web-push` 3.6.7 : toutes des versions récentes, pas de CVE connue notable sur les paquets runtime eux-mêmes.

---

## 6. Configuration serveur & réseau

**[ÉLEVÉ] Micro-service Cloud Run public détenteur de la clé `service_role`.**
*Fichiers* : `Cadrage/Stats/service/DEPLOIEMENT_CLOUD_RUN.md:76-80`, `lib/ai/statsService.ts` (appels vers `STATS_SERVICE_URL`).
*Constat* (commande de déploiement documentée) :
```
gcloud run deploy nba-pronos-stats --source . --region europe-west1 --allow-unauthenticated \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=nba-pronos-supabase-key:latest
```
Le service Python (`/predict`, `/predict-combo`, `/predict-comparison`, …) est déployé avec `--allow-unauthenticated` : n'importe qui connaissant l'URL Cloud Run peut l'appeler directement, sans passer par l'application Next.js ni par une authentification Supabase. Ce service détient en variable d'environnement la clé `service_role`. Le guide de déploiement reconnaît lui-même le problème : *« à revoir si on veut le protéger plus tard »*.
*Risque* : abus de quota/coût par appels directs massifs (aucun rate-limiting applicatif côté Next.js non plus) ; en cas de faille future dans ce service Python (désérialisation, dépendance vulnérable), exploitation immédiate depuis l'extérieur avec, en toile de fond, un identifiant qui contourne la RLS.
*Recommandation* : restreindre l'accès — soit via IAM (`--no-allow-unauthenticated` + compte de service dédié), soit a minima via un secret partagé (header `Authorization: Bearer <STATS_SERVICE_SECRET>` vérifié dans `app.py`, même patron que `isAuthorizedSyncRequest` côté Next.js). Envisager de donner à ce service une clé Supabase dédiée à privilèges réduits (lecture seule sur les tables de stats) plutôt que la `service_role` globale.

**[Moyen] Absence de headers de sécurité HTTP.**
*Fichiers* : `next.config.ts:1-8` (config vide), `vercel.json:1-4` (seulement `{"regions": ["dub1"]}`).
*Constat* : aucune configuration `headers()` — pas de `Content-Security-Policy`, pas de `X-Frame-Options`/`frame-ancestors`, pas de `X-Content-Type-Options: nosniff`, pas de `Strict-Transport-Security` explicite (Vercel gère TLS/HTTPS nativement mais n'ajoute pas de CSP ni de protection anti-cadrage par défaut).
*Risque* : sans XSS actif (aucun trouvé), l'impact direct est limité, mais ce sont des filets de sécurité standards : sans `X-Frame-Options`, l'application peut être intégrée dans une iframe tierce (clickjacking sur des actions sensibles — validation de pari, suppression de message) ; sans CSP, une future régression XSS serait immédiatement exploitable.
*Recommandation* : ajouter un bloc `headers()` dans `next.config.ts` avec au minimum `X-Frame-Options: DENY` (ou `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, et une CSP de base adaptée aux domaines Supabase/Anthropic utilisés.

**CORS — Bon.** Aucune configuration CORS trouvée dans `app/api/**/*.ts` (pas de `Access-Control-Allow-Origin`, pas de wildcard). En l'absence de headers CORS explicites, les navigateurs bloquent les lectures cross-origin par défaut — pas de risque de type "wildcard + credentials".

**HTTPS/TLS — Bon.** Hébergement Vercel, TLS et redirection HTTP→HTTPS gérés nativement par la plateforme.

**Routes API privilégiées bien protégées — Bon.** `/api/sync/*`, `/api/heartbeat`, `/api/resolve-bets`, `/api/reminders/*`, `/api/snapshots/leaderboard` sont uniformément protégées par un Bearer `SYNC_SECRET` avant tout accès `service_role` — aucune n'est accessible anonymement.

---

## 7. Validation des entrées

**[Moyen] Absence quasi totale de validation par schéma (`zod`) sur les Server Actions et routes API.**
*Fichiers* : tous les fichiers de `lib/actions/*.ts` (aucun n'importe `zod`), `app/api/**/*.ts`. `zod` (v4, présent en dépendance) n'est utilisé que dans `lib/ai/*.ts`.
*Constat* : la validation actuelle est manuelle (`String(formData.get(...) ?? "")`, tests de longueur ad hoc, comparaisons contre des unions littérales). Dans la pratique cette validation est plutôt correcte et systématiquement doublée par des contraintes en base (RLS, `CHECK`, triggers, fonctions `SECURITY DEFINER`) qui restent la véritable autorité — ce n'est donc pas une vulnérabilité active constatée, mais un risque de dérive à mesure que le nombre d'actions augmente (déjà plus d'une trentaine) sans schéma centralisé pour signaler un oubli.
*Recommandation* : introduire des schémas `zod` au moins pour les entrées texte libre les plus exposées (voir finding suivant) et pour les Server Actions les plus fréquemment modifiées, en réutilisant le patron déjà maîtrisé dans `lib/ai/structureBet.ts`.

**[Moyen] Aucune limite de taille appliquée côté serveur sur plusieurs champs texte libre.**
*Fichiers* :
- `lib/actions/bug-reports.ts:27-28` (`description`, aucune limite ni contrainte `CHECK` en base — `supabase/migrations/20260828130000_bug_reports.sql:20` : `description text not null` sans borne)
- `lib/actions/profile.ts:74-75` (`bio`, `20260718090000_initial_schema.sql:74` : `bio text` sans contrainte)
- `lib/actions/bets.ts` (`description` du pari, `20260726130000_bet_write_functions.sql:42` : `p_description text` sans borne)
- `lib/actions/corrections.ts`/`bet-corrections.ts` (`justification`, non-vide vérifié mais sans plafond haut)
*Comparaison utile* : le chat (`lib/actions/chat.ts:17,39-41`) applique correctement `MAX_MESSAGE_LENGTH = 2000` doublé d'une contrainte SQL `CHECK (char_length(trim(body)) between 1 and 2000)` (`20260827100000_chat.sql:34`) — seul champ borné aux deux niveaux.
*Risque* : un joueur authentifié peut soumettre un texte de plusieurs mégaoctets, dégradant l'affichage admin et gonflant la base sans contrôle (impact mineur en pratique, application en alpha/bêta à cercle fermé, mais correctif peu coûteux).
*Recommandation* : ajouter une limite raisonnable (2000-5000 caractères) côté Server Action **et** via contrainte `CHECK` en base, plus `maxLength` sur les `<textarea>` correspondants (`components/feedback/BugReportButton.tsx` n'en a pas, contrairement à `ChatComposer.tsx`).

---

## 8. Logs & gestion des erreurs

**[Moyen] Fuite de messages d'erreur internes bruts vers le client dans les Server Actions.**
*Fichiers (motif répété dans quasiment tout `lib/actions/`)* : `admin-results.ts`, `bet-corrections.ts`, `bug-reports.ts`, `bets.ts`, `admin-resolution.ts`, `corrections.ts`, `leagues.ts`, `admin-requests.ts`, `notifications.ts`, `admin-competitions.ts`, `profile.ts`, `admin-players.ts`, `admin-validation.ts`, `admin.ts`, `chat.ts`.
*Constat* : le motif `{ success: false, error: error.message }` est utilisé de façon quasi-systématique, renvoyant au client le message Postgres/Supabase brut (ex. `duplicate key value violates unique constraint "..."`, `new row violates row-level security policy for table "..."`), ce qui peut révéler noms de tables/colonnes/contraintes/policies à un attaquant authentifié cartographiant le schéma. Contexte atténuant : ces actions nécessitent déjà une session authentifiée.
*Recommandation* : centraliser la gestion d'erreur (helper commun) qui journalise `error.message` côté serveur et renvoie systématiquement un message générique côté client.

**[Faible] Même motif sur les routes API `/api/sync/*` et `/api/resolve-bets`.**
*Fichiers* : `app/api/sync/results/route.ts:44-46,54`, `app/api/sync/schedule/route.ts`, `app/api/sync/teams/route.ts`, `app/api/resolve-bets/route.ts:107-108`.
*Contexte atténuant fort* : ces routes exigent déjà `Bearer SYNC_SECRET` — non accessibles anonymement.
*Recommandation* : même principe, message générique au client, détail réservé aux logs serveur/`sync_logs`.

**Bon exemple à généraliser.** `lib/auth/actions.ts` (login/signup) ne renvoie **jamais** d'erreur Supabase brute — messages génériques ("Email ou mot de passe incorrect.") avec anti-énumération réfléchie. Aucune fuite de secret dans les logs (`HIGHLIGHTLY_API_KEY` jamais interpolée dans les messages d'erreur stockés par `writeSyncLog`). `sync_logs`/`audit_logs` protégés par RLS admin-only.

---

## 9. Stockage des données

**Bon global.** `users` ne contient ni email ni mot de passe (gérés exclusivement par `auth.users`/Supabase Auth). Aucune donnée de paiement/carte bancaire nulle part dans le dépôt (recherche exhaustive `card`/`cvv`/`iban`/`stripe` : uniquement des faux positifs UI). Chiffrement au repos assuré nativement par l'infrastructure managée Supabase. Codes d'invitation (`competition_secrets`, `league_secrets`) correctement isolés et protégés par RLS admin/membres. `push_subscriptions` protégé par RLS strict propriétaire (`user_id = auth.uid()`).

**[Info] Pas de procédure documentée de rétention/effacement RGPD.**
*Fichiers* : `bug_reports.description`, `chat_messages.body` — texte libre pouvant contenir des données personnelles collées par un utilisateur.
*Constat* : RLS correcte (auteur+admin pour les signalements, scope+admin pour le chat), mais aucune procédure de purge/anonymisation trouvée en cas de suppression de compte.
*Recommandation* : si le projet grandit au-delà d'un cercle fermé d'amis (mentionné comme cadre actuel dans les commentaires du code), documenter/implémenter une procédure d'effacement ou d'anonymisation de ces contenus lors de la suppression d'un compte.

---

## Récapitulatif des findings

| # | Titre | Sévérité | Axe |
|---|---|---|---|
| 1 | Clé `SUPABASE_SERVICE_ROLE_KEY` documentée comme ayant fuité, rotation refusée | **Critique** | Secrets |
| 2 | Micro-service Cloud Run public (`--allow-unauthenticated`) détenteur de la clé `service_role` | **Élevé** | Config serveur/réseau |
| 3 | Pas de rate-limiting/CAPTCHA applicatif sur le login | Moyen | Authentification |
| 4 | `setPlayerRole`/`setPlayerStatus` sans garde `is_admin()` explicite → faux succès + audit log trompeur | Moyen | Contrôle d'accès |
| 5 | Absence quasi totale de validation par schéma `zod` sur Server Actions/API | Moyen | Validation des entrées |
| 6 | Champs texte libre sans limite de taille (bug report, bio, description de pari, justification) | Moyen | Validation des entrées |
| 7 | Absence de headers de sécurité HTTP (CSP, X-Frame-Options, nosniff) | Moyen | Config serveur/réseau |
| 8 | Fuite de messages d'erreur bruts vers le client (Server Actions) | Moyen | Logs & erreurs |
| 9 | 3 vulnérabilités "high" npm audit (dépendances de build uniquement) | Faible | Dépendances |
| 10 | Cookies de session Supabase non `HttpOnly` (défaut du SDK) | Faible | Authentification |
| 11 | Comparaison non constante du secret `SYNC_SECRET` | Faible | Secrets |
| 12 | `resolveBugReportFormAction`/`deleteChatMessageFormAction` sans garde explicite | Faible | Contrôle d'accès |
| 13 | Fuite de messages d'erreur bruts sur `/api/sync/*` et `/api/resolve-bets` | Faible | Logs & erreurs |
| 14 | Énumération de compte sur le signup | Faible | Authentification |
| 15 | Pas de procédure documentée de rétention/effacement RGPD | Info | Stockage des données |

---

## Prochaines étapes (priorisées)

1. **Immédiat** — Régénérer `SUPABASE_SERVICE_ROLE_KEY` (finding 1) dans le dashboard Supabase et propager la nouvelle valeur à tous les environnements (`.env.local`, Vercel, Secret Manager Cloud Run). Mettre en place un hook pre-commit type `gitleaks` pour prévenir toute récidive.
2. **Court terme** — Restreindre l'accès public du service Cloud Run de stats (finding 2) : IAM ou secret partagé, et envisager une clé Supabase dédiée à privilèges réduits pour ce service.
3. **Court terme** — Ajouter les headers de sécurité HTTP de base dans `next.config.ts` (finding 7) — gain large pour un effort faible.
4. **Court terme** — Introduire un helper d'erreur générique pour les Server Actions et routes API, afin de ne plus renvoyer `error.message` brut au client (findings 8, 13).
5. **Court terme** — Corriger l'override `brace-expansion` et mettre à jour `eslint`/`@tailwindcss/postcss` (finding 9), puis rejouer `npm audit`.
6. **Moyen terme** — Ajouter l'appel explicite `is_admin()` et la vérification de ligne affectée dans `admin-players.ts` (finding 4) et par cohérence dans `bug-reports.ts`/`chat.ts` (finding 12).
7. **Moyen terme** — Borner en taille (serveur + `CHECK` SQL) les champs texte libre encore illimités (finding 6), et introduire progressivement des schémas `zod` sur les Server Actions les plus exposées (finding 5).
8. **Moyen terme** — Activer CAPTCHA + vérifier manuellement la configuration anti-brute-force réelle en production (finding 3).
9. **Bas priorité** — Passer `isAuthorizedSyncRequest` en comparaison à temps constant (finding 11) ; documenter le compromis cookies non-`HttpOnly` (finding 10) ; traiter l'énumération de compte au signup si jugé nécessaire (finding 14) ; documenter une procédure RGPD de rétention/effacement (finding 15).

---

*Audit réalisé par analyse statique du code source et de la configuration. Aucun test d'intrusion actif n'a été mené (pas d'appel réseau vers les environnements de production ou vers le service Cloud Run). Une vérification manuelle des réglages effectifs du dashboard Supabase de production (rate-limiting, CAPTCHA, cookies) est recommandée en complément, ces réglages n'étant pas garantis identiques à la configuration locale (`supabase/config.toml`) analysée ici.*
