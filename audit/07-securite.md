# 07 — Sécurité

*Cette phase s'appuie sur un audit de sécurité complet préexistant (`security-audit-report.md`, 29/08/2026, 15 findings) et le met à jour par vérification ligne à ligne de l'état actuel du code (03/09/2026), plus une extension à des axes non couverts par cet audit initial (rate limiting, CSRF, webhooks, mass assignment). Aucune valeur de secret n'est reproduite dans ce document — uniquement noms de variables et emplacements.*

## 7.1 Secrets et configuration

| Point | État | Preuve |
|---|---|---|
| Clé `SUPABASE_SERVICE_ROLE_KEY` documentée comme fuitée le 21/08/2026 | **Rotation confirmée.** `.env.local` contient désormais une clé au nouveau format Supabase (`sb_secret_...`, préfixe du système de clés API remplaçant les JWT legacy), et les clés API legacy ont été désactivées côté dashboard Supabase d'après le journal interne. | `Cadrage/Suivi/ETAT_ACTUEL.md`/`JOURNAL_SESSIONS.md` (migration vers `sb_publishable_`/`sb_secret_` sur les 3 environnements + désactivation des clés legacy) |
| Séparation client/serveur des secrets | Bonne — `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `ANTHROPIC_API_KEY`, `HIGHLIGHTLY_API_KEY`, `STATS_SERVICE_SECRET` tous lus dans des modules `import "server-only"` | `lib/supabase/service.ts`, `lib/push/send.ts`, `lib/ai/*`, `lib/nba/client.ts` |
| Variables `NEXT_PUBLIC_*` | 3 variables publiques, toutes légitimement publiques (URL/clé anon Supabase, clé VAPID publique, site key Turnstile) | `.env.local` (noms uniquement) |
| Secret en dur dans le code | Aucun trouvé (recherche exhaustive `sk-`, `AKIA`, `-----BEGIN`, littéraux) | Confirmé par l'audit du 29/08, non contredit |
| `.env.local` dans l'historique git | Absent — `.gitignore` exclut `.env*`, confirmé par `git log --all` (audit du 29/08) | — |

**Note de transparence** : dans le cadre de cet audit, `.env.local` a été lu directement pour inventorier les variables présentes (nécessaire pour évaluer la séparation public/privé). Aucune valeur n'est reproduite dans ce rapport ni dans aucun fichier de `audit/`.

## 7.2 Authentification

| Point | État | Preuve |
|---|---|---|
| Hashing mots de passe | Délégué entièrement à Supabase Auth (GoTrue) | Confirmé, non modifié depuis le 29/08 |
| Pattern `getUser()` (jamais `getSession()` côté serveur pour une décision de sécurité) | Confirmé uniforme, y compris sur les nouvelles routes (`app/api/account/export`) | `proxy.ts:44-48`, vérifié exhaustivement par l'agent architecture |
| CAPTCHA login/signup | **Corrigé.** Cloudflare Turnstile intégré, token vérifié **côté serveur par Supabase Auth** (`captchaToken` transmis à `signInWithPassword`/`signUp`), pas une façade client seule | `components/auth/TurnstileWidget.tsx`, `lib/auth/actions.ts` |
| Rate-limiting/brute-force sur le login | Dépend de la configuration réelle du dashboard Supabase de production — **non vérifiable depuis ce dépôt** (config CLI locale `supabase/config.toml` non garantie identique à la prod) | Limite déjà signalée par l'audit du 29/08, non levée |
| Énumération de compte au signup | Documentée comme compromis assumé (UX du flux code compétition + pseudo + email) | `Cadrage/Suivi/docs/document-signup-enumeration-tradeoff` (branche mergée) |
| Cookies non `HttpOnly` | Documenté explicitement en commentaire dans le code comme compromis architectural nécessaire à Supabase Realtime, avec la CSP stricte comme filet de sécurité alternatif | `lib/supabase/server.ts:11-21` |
| Déclaration d'âge signup | Ajoutée (`age_confirmed_at`), bloque le signup côté Server Action si case non cochée — voir `DATA-007` pour la nuance sur le contournement direct de l'API Auth | `lib/auth/actions.ts`, migration `20260903120000` |

## 7.3 Autorisations

**Modèle général confirmé solide et intact** : `is_admin()` (`SECURITY DEFINER`) lisant `users.role`, jamais un claim JWT ; écriture de `role`/`status` protégée par RLS **et** trigger d'invariants (auto-promotion, auto-rétrogradation admin, dernier admin actif, tous bloqués) ; écritures sensibles via fonctions `SECURITY DEFINER` qui revalidatent systématiquement `auth.uid()` et la propriété de la ressource avant d'écrire, avec re-scoping de la clause `WHERE` finale (protection IDOR par construction).

| Finding du 29/08 | État vérifié le 03/09 |
|---|---|
| `setPlayerRole`/`setPlayerStatus` sans `is_admin()` explicite | **Corrigé** — garde `is_admin()` ajoutée + vérification du nombre de lignes affectées (`lib/actions/admin-players.ts`) |
| `resolveBugReportFormAction` sans garde | **Corrigé** — garde `is_admin()` + vérification de ligne affectée (`lib/actions/bug-reports.ts`) |
| `deleteChatMessageFormAction` sans garde (n'appelait même pas `getUser()`) | **Corrigé** — `getUser()` et `is_admin()` tous deux ajoutés (`lib/actions/chat.ts`) |

Aucune nouvelle vulnérabilité d'autorisation identifiée sur les fonctionnalités ajoutées depuis (export de compte : scope strict `user.id` de session, aucun paramètre externe accepté ; suppression de compte : idem).

## 7.4 Entrées et sorties

| Axe | État |
|---|---|
| Injections SQL/commande | Aucune trouvée — 100% requêtes paramétrées ou `.rpc()` typés (confirmé, non contredit) |
| XSS | `dangerouslySetInnerHTML` absent de tout le dépôt (confirmé) |
| CSRF | Server Actions Next.js protégées nativement (vérification d'origine) ; routes API exposant GET+POST protégées par Bearer `SYNC_SECRET` (non exploitable en CSRF car un navigateur ne peut pas forger ce header cross-site) ; seule route GET sans ce garde (`/api/account/export`) est une lecture scopée à l'utilisateur de session, non exfiltrable en cross-origin (Same-Origin Policy) — **pas de vulnérabilité CSRF identifiée** |
| Validation par schéma (zod) | Partielle — voir `SEC-003` |
| Limite de taille des champs texte libre | **Corrigée** — 4 contraintes `CHECK` SQL + limites applicatives + `maxLength` UI sur bio, description de pari, justification, description de bug report (`supabase/migrations/20260829090000_input_length_limits.sql`) |
| Erreurs trop détaillées / stack traces | **Largement corrigé** — helper générique `lib/actions/errors.ts` adopté sur 15/22 fichiers ; 3 fichiers restants (`bets.ts`, `bet-corrections.ts`, `corrections.ts`) renvoient des messages RPC rédigés à la main pour l'utilisateur, pas des messages Postgres bruts — voir `SEC-004` |
| Mass assignment | **Aucun trouvé** — vérification exhaustive : tous les `.update()`/`.insert()` de `lib/actions/*.ts` construisent leur objet champ par champ, jamais un spread d'un objet brut issu de la requête |
| Prototype pollution | Non applicable (pas de merge d'objets dynamiques non contrôlé identifié) |
| Désérialisation dangereuse | Non applicable (`JSON.parse` sur sortie IA contraint par schéma Zod strict) |

## 7.5 Abus et robustesse

| Axe | État |
|---|---|
| Rate limiting applicatif au-delà du login | **Ouvert** — aucun rate limiter sur chat/paris/signalements (`SEC-001`) |
| Idempotence des tâches planifiées | Vérifiée bonne sur les mécanismes examinés (résolution de paris, cycle NBA Cup Alpha, snapshot quotidien) — protection par condition d'état + vérification de ligne affectée |
| Webhooks entrants | **Non applicable** — aucun webhook entrant dans l'architecture (grep exhaustif, aucune route ne traite d'événement poussé par un tiers) |
| Rejeu de requête sur les routes sync | Protégé par Bearer `SYNC_SECRET` (comparaison `timingSafeEqual` depuis la correction du finding 11) — pas de protection anti-rejeu au sens strict (un token intercepté resterait valide indéfiniment jusqu'à rotation), mais le secret n'est jamais transmis au navigateur, risque d'interception jugé faible |
| Timeouts / retries sur services externes | Non vérifiés systématiquement dans cette session (voir `08-api-et-integrations.md`) |
| Quotas | Aucun quota technique constaté au-delà des quotas métier (paris) et du quota d'emails Supabase (`OPS-002`) |

## 7.6 Dépendances

| Point | État |
|---|---|
| 3 vulnérabilités "high" (nanoid, brace-expansion, js-yaml) de l'audit du 29/08 | **Corrigées** — `npm audit --omit=dev` : 0 vulnérabilité |
| Nouvelle vulnérabilité apparue depuis | `browserslist` (dev-only, dérive normale de l'écosystème) — `SEC-002` |
| Dépendances abandonnées / sources non standard | Aucune identifiée — toutes les dépendances proviennent du registre npm standard, versions récentes |
| Scripts post-install suspects | Non vérifiés spécifiquement dans cette session (limite) |

## Micro-service Cloud Run (finding Élevé du 29/08)

**Corrigé.** Le service reste déployé `--allow-unauthenticated` au niveau IAM Cloud Run (pas de restriction IAM), mais une authentification applicative équivalente au patron `SYNC_SECRET` a été ajoutée : middleware Python (`RequireSharedSecretMiddleware`) vérifiant `Authorization: Bearer <STATS_SERVICE_SECRET>` via `hmac.compare_digest` (timing-safe), **fail-closed** si le secret n'est pas configuré côté service. Côté Next.js, le secret est ajouté sur les 18 sites d'appel identifiés (`lib/ai/statsService.ts`). Ce qui neutralise le risque décrit dans le finding original (accès direct sans authentification), même si une restriction IAM native serait une défense en profondeur supplémentaire recommandée à terme.

## Registre des anomalies de sécurité restantes

Voir `SEC-001` à `SEC-004` dans `ANOMALIES.md`. **Aucune anomalie de sécurité de gravité P0/P1/P2 identifiée à ce jour** — le seul point réellement ouvert de gravité notable (P3) est l'absence de rate limiting applicatif (`SEC-001`), jugé de risque faible dans le contexte actuel (cercle fermé documenté par l'équipe).

## Limites de cette phase

- Configuration réelle du dashboard Supabase de production (rate-limiting, CAPTCHA serveur additionnel, Leaked Password Protection) **non vérifiable** depuis ce dépôt.
- Aucun test d'intrusion actif mené (analyse statique uniquement, cohérent avec le mandat read-only de cet audit).
- Le code du micro-service Python (Cloud Run) n'a été vérifié qu'au niveau du middleware d'authentification cité par la documentation de déploiement — pas d'audit de sécurité complet de son code Python dans cette session.
