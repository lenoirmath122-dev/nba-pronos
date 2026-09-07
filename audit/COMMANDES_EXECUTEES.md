# Commandes exécutées pendant l'audit

*Toutes les commandes ci-dessous sont en lecture seule ou de création de fichiers locaux (`audit/`). Aucune n'a modifié le code applicatif, la base de données distante, ou un environnement distant. Certaines ont été exécutées directement par la session principale, d'autres par des agents d'exploration dédiés (indiqué). Aucune valeur de secret n'est reproduite ci-dessous.*

## Phase 0 — État Git et structure

| Commande | Objectif | Résultat | Fichiers affectés |
|---|---|---|---|
| `git status --short --branch` | Vérifier l'état du dépôt avant toute analyse | Branche `main`, à jour avec `origin/main`, uniquement des fichiers de logs d'entraînement ML non suivis (`Cadrage/Stats/scripts/*.log`, `train_points_tuned_v2.log`) | Aucun |
| `git log --oneline -10` | Identifier les derniers commits | 10 derniers commits listés, tous des merges de PR | Aucun |
| `git remote -v` | Identifier les remotes configurés | `origin` → dépôt GitHub `lenoirmath122-dev/nba-pronos` | Aucun |
| `git branch -a` | Lister les branches locales/distantes | 19 branches (locales + distantes), toutes des branches de travail déjà mergées | Aucun |
| `git merge-base --is-ancestor origin/<branche> main` (×19) | Vérifier si chaque branche est déjà mergée dans `main` | Les 19 branches sont mergées (`YES` pour toutes) | Aucun |
| `ls -la` (racine) | Cartographier la structure du dépôt | Structure listée (voir `01-inventaire-et-architecture.md`) | Aucun |
| `mkdir -p audit` | Créer le dossier de livrables de l'audit | Dossier créé | `audit/` (nouveau) |
| `find app/lib/components/supabase/scripts/Cadrage/.github -maxdepth N` (plusieurs) | Cartographier les sous-dossiers clés | Structure détaillée obtenue | Aucun |
| `wc -l` sur les fichiers de suivi `Cadrage/Suivi/*.md` | Évaluer la taille des documents avant lecture | Tailles obtenues (jusqu'à 12 617 lignes) — a orienté un échantillonnage plutôt qu'une lecture intégrale | Aucun |

## Phase 5/12 — Qualité du code et tests (exécutées par un agent d'exploration dédié)

| Commande | Objectif | Résultat | Code de sortie |
|---|---|---|---|
| `npx tsc --noEmit` | Vérifier la compilation TypeScript | Aucune erreur | 0 |
| `npx eslint .` | Vérifier le linting | 0 erreur, 5 avertissements (tous dans `scripts/*.mjs`, hors périmètre applicatif) | 0 (avertissements seuls) |
| `npx vitest run --reporter=dot` | Exécuter la suite de tests | 224 tests / 18 fichiers, tous passés | 0 |
| `npm audit` | Détecter les vulnérabilités de dépendances (avec devDependencies) | 1 vulnérabilité "high" (`browserslist`, dev-only) | Non bloquant |
| `npm audit --omit=dev` | Détecter les vulnérabilités en production | 0 vulnérabilité | 0 |

## Phase 11 — Performances (exécutées par la session principale)

| Commande | Objectif | Résultat | Fichiers affectés |
|---|---|---|---|
| `npm run build` (en tâche de fond) | Obtenir des métriques réelles de build/bundle | Build réussi en ~30s (compilation 14.0s, typecheck 15.9s, génération 46 pages en 676ms), toutes les routes marquées dynamiques (`ƒ`) | `.next/` (artefact de build local, non commité, déjà exclu par `.gitignore`) |
| `du -sh .next/static/chunks` | Mesurer la taille totale des chunks JS | 1.6 Mo | Aucun (lecture) |
| `find .next/static/chunks -maxdepth 1 -name "*.js" ... \| sort` | Identifier les plus gros chunks individuels | Plus gros chunk : 247 Ko | Aucun (lecture) |
| `du -sh .next` | Taille totale de l'artefact de build | 563 Mo (inclut cache webpack/serveur, non représentatif du poids client) | Aucun (lecture) |

## Fichiers lus intégralement ou partiellement (hors commandes shell)

- `.env.local` — pour inventorier les **noms** de variables et évaluer la séparation public/privé des secrets (Phase 7). Aucune valeur reproduite dans aucun livrable.
- `security-audit-report.md` (intégral, 233 lignes).
- `package.json`, `README.md`, `proxy.ts`, `next.config.ts`, `vercel.json` (intégraux).
- `Cadrage/Suivi/BACKLOG_V1.md` (intégral, 177 lignes), extraits ciblés de `ETAT_ACTUEL.md`, `GAPS_OUVERTS.md`, `BILAN_GLOBAL_01_09_2026.md`, `AUDIT_UX_16_08_2026.md`, `AVIS_EXPERT_16_08_2026.md`, `AUDIT_TYPES_PARIS_24_08_2026.md` (ces derniers intégraux, moins volumineux).
- 5 agents d'exploration dédiés ont par ailleurs lu en profondeur : `proxy.ts`, `app/(admin)/admin/layout.tsx`, `app/(app)/layout.tsx`, `lib/actions/*.ts` (21 fichiers), `lib/auth/actions.ts`, `lib/sync/auth.ts`, `lib/scoring/*.ts`, `lib/ai/*.ts` (structuration + résolution), `lib/nbaCupAlpha/*.ts`, `lib/sync/{results,schedule,teams}.ts`, les 66 migrations SQL de `supabase/migrations/` [corrigé le 07/09/2026, "85" était une erreur de comptage — voir `audit/ANOMALIES.md`], `components/auth/*`, `components/bets/BetForm.tsx`, `components/chat/ChatComposer.tsx`, `components/feedback/BugReportButton.tsx`, `components/ui/ModalDialog.tsx`, `app/tokens.css`, `app/globals.css`, les 9 fichiers `.github/workflows/*.yml`.

## Limites et échecs documentés

- Aucune commande n'a échoué dans cette session.
- Aucune connexion réseau vers un environnement Supabase/Vercel/Cloud Run de production n'a été tentée.
- La configuration réelle du dashboard Supabase (rate-limiting, CAPTCHA serveur, plan de facturation) n'a pas pu être vérifiée — hors périmètre d'accès de cet audit (dépôt de code uniquement).
- `Cadrage/Suivi/ETAT_ACTUEL.md` (7828 lignes) et `JOURNAL_SESSIONS.md` (12 617 lignes) n'ont pas été lus intégralement (taille prohibitive pour une lecture ligne à ligne dans le budget de cet audit) — échantillonnage ciblé sur les entrées les plus récentes et les plus pertinentes aux phases de l'audit.

## Vérification finale de l'état Git (contrôle de cohérence, fin d'audit)

Une vérification finale de `git status` a été effectuée avant de conclure l'audit (voir `RAPPORT_FINAL.md`, section contrôle de cohérence) pour confirmer qu'aucune commande exécutée pendant cette session n'a modifié involontairement le dépôt suivi par Git.
