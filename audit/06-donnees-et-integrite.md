# 06 — Données et intégrité

*Périmètre : 85 migrations SQL (`supabase/migrations/`, du 18/07/2026 au 03/09/2026). Analyse par lecture intégrale des fichiers structurants + grep exhaustif sur le reste. Aucune modification effectuée, aucune connexion à une base distante.*

## 1. Schéma synthétique

Schéma écrit à la main (pas d'ORM), `snake_case`, types énumérés Postgres, et usage systématique de **clés étrangères composites** `(id, competition_id)` pour garantir qu'un bracket, un pari ou un prono ne peut jamais référencer une série/un match d'une *autre* compétition — choix de conception explicite et cohérent à travers tout le schéma.

**Tables principales** (31 au total, RLS activée sur les 31 — voir §2) :

| Table | Grain | FK notables | Contraintes clés |
|---|---|---|---|
| `users` | 1 par joueur (id = `auth.users.id`) | `favorite_team_id → teams` | pseudo unique, `pinned_badge_ids` ≤3, `role`/`status` gardés par trigger |
| `competitions` | 1 par compétition | — | une seule `ACTIVE` à la fois (index unique partiel) |
| `series` / `matches` | 1 par série / par match | `team1/2_id`, `next_series_id`, `series_id+competition_id` | `unique(series_id, game_number)`, `game_number` 1-7 |
| `brackets` / `bracket_picks` | 1 par joueur/compétition, 1 par série | `bracket_id+competition_id`, `series_id+competition_id` | `unique(user_id,competition_id)`, `unique(bracket_id,series_id)` |
| `match_predictions` | 1 par joueur/match | `match_id+competition_id` | `unique(user_id,match_id)`, machine à états |
| `bets` | 1 par pari | `series_id`/`match_id+competition_id` | 2 index uniques partiels de quota, `CHECK` scope/`match_id` |
| `correction_requests` | 1 par demande | `target_match_prediction_id` XOR `target_bet_id` (`CHECK`) | 1 `PENDING` par cible (index unique partiel) |
| `leagues` / `league_secrets` / `league_memberships` | — | `created_by_user_id` | code d'adhésion unique |
| `chat_messages` / `chat_message_reports` | — | `league_id` nullable, `message_id on delete set null` | `CHECK` cohérence scope, longueur bornée |
| `audit_logs` / `sync_logs` | append-only | — | admin uniquement |

Deux vues dérivées (`user_scores`, `user_badges_lifetime`, etc.) en `security_invoker=false` — contournement RLS volontaire et borné (n'exposent que des agrégats, jamais de lignes brutes).

## 2. RLS — couverture complète vérifiée

**Vérifié exhaustivement** : la liste des 31 `CREATE TABLE` de l'ensemble des migrations a été comparée à la liste des `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` — les deux listes coïncident table par table, sans exception. Chaque migration qui crée une table active la RLS dans le même fichier. C'est un point positif rare pour un projet de cette taille et de cette vitesse de développement.

Modèle : `is_admin()`/`is_active()` (fonctions `SECURITY DEFINER STABLE`) réutilisées systématiquement ; lecture publique sur les données non sensibles (`users`, `teams`, `competitions`, `series`, `matches`), lecture admin-only sur les tables privées (`competition_secrets`, `entity_mappings`, `audit_logs`, `sync_logs`), règles fines "propriétaire OU admin OU condition de divulgation publique" sur `brackets`/`match_predictions`/`bets`. **Aucune policy DELETE** n'existe sur `users`, `match_predictions`, `bets` — les "suppressions" passent exclusivement par des fonctions `SECURITY DEFINER` qui posent un statut `CANCELLED` (rétention totale, jamais de perte physique côté joueur).

## 3. Triggers d'invariants

- `enforce_users_invariants` : bloque toute modification de `role`/`status` par un non-admin, interdit l'auto-rétrogradation d'un admin, protège le dernier admin actif. **Vérifié correct** sur les 3 cas.
- `enforce_match_prediction_transitions` / `enforce_bet_transitions` : machines à états strictes, avec extension pour la contestation post-résolution (exige `correction_request_id` + `corrected_by_admin_id ≠ user_id` pour rouvrir un pari `WON`/`LOST`/`REJECTED`).
- `enforce_prediction_correction` : interdit à un admin de corriger son propre prono.

**Point à surveiller (faible priorité)** : le trigger `enforce_users_invariants` laisse passer sans garde tout contexte où `auth.uid() IS NULL` (y compris `service_role`), en s'appuyant sur le fait que la RLS bloque déjà les écritures anonymes. Raisonnement correct mais reposant sur un commentaire, pas sur un test automatisé — voir `DATA-006`.

## 4. Historique des migrations correctives — bugs de production réels documentés

Le dépôt documente explicitement, en tête de chaque migration corrective, l'incident réel qui l'a motivée :

1. **Trigger bloquant le seed du premier admin** (`20260718120000_fix_users_trigger_system_context.sql`).
2. **Colonne inexistante `series.status`** dans `request_bet_correction` (la vraie colonne est `official_status`) — aurait cassé toute correction sur un pari SERIES en prod (`20260727110000_fix_request_bet_correction_series_column.sql`).
3. **Récursion RLS infinie** sur `league_memberships` (`ERROR: infinite recursion detected in policy`), cassant toute lecture touchant `leagues`/`league_secrets` — corrigée par extraction en fonction `SECURITY DEFINER` (`20260730093000_fix_league_memberships_recursion.sql`).
4. **Bug utilisateur réel signalé le 22/08/2026** : après annulation d'un pari MATCH, impossible d'en resoumettre un nouveau sur le même match — l'index unique de quota ne couvrait pas encore le statut `CANCELLED` (`20260822120000_fix_uniq_active_match_bet_cancelled.sql`).
5. **Policy UPDATE manquante sur `push_subscriptions`** — l'upsert `ON CONFLICT DO UPDATE` échouait dès qu'un abonnement existant était réactivé (`20260828100000_push_subscriptions_update_policy.sql`).

Ces cinq migrations partagent un même motif : **une règle métier a changé (nouveau statut, nouvelle colonne, nouvelle table) sans qu'une revue systématique de tous les objets qui en dépendaient (index uniques partiels, policies, fonctions) ait été faite au même moment.** C'est un pattern de risque récurrent à surveiller pour toute future évolution de statut — voir `DATA-001`.

**Irréversibilité** : aucun `DROP TABLE` dans les 85 migrations. Les seuls `DROP COLUMN` (`use_team_colors`, `tutorial_seen_at`) concernent des colonnes de préférences UX abandonnées, documentées comme telles et sans donnée métier perdue. Le seul `DROP COLUMN` touchant une donnée sensible (`competitions.join_code`) est précédé d'un `INSERT INTO competition_secrets ... SELECT` de migration — pas de perte sèche.

## 5. Nouvelles tables du 03/09/2026 — cohérence vérifiée

- `users.age_confirmed_at` : horodaté inconditionnellement par le trigger `handle_new_user`. Le blocage du signup sans case cochée est **applicatif** (`lib/auth/actions.ts`), pas en base — un appel direct à l'API Auth Supabase en dehors de l'application produirait quand même un horodatage "confirmé", ce qui est trompeur si cette colonne doit un jour servir de preuve de conformité légale. Voir `DATA-007`.
- `chat_message_reports` : snapshot du message au moment du signalement (`message_body_snapshot`), `message_id ON DELETE SET NULL` — survit correctement à la suppression admin du message. Le code reconstruit le snapshot côté serveur à partir d'une lecture RLS-gardée (pas de texte fourni par le client) — bonne pratique anti-forgery.

## 6. Index manquants

Couverture globale correcte sur les tables à fort volume (`bets`, `match_predictions`, `matches`, `series`, `bracket_picks`). Manques identifiés, tous de gravité faible à ce stade (faible volume actuel) :

- `correction_requests` : aucun index sur `requester_user_id`, `target_bet_id`, `target_match_prediction_id`, `handled_by_admin_id` (hors index uniques partiels `WHERE status='PENDING'`).
- `chat_messages(user_id)`, `bug_reports(user_id)`, `chat_message_reports(reporter_user_id)` : pas d'index dédié — ralentit potentiellement la suppression de compte (`lib/actions/account.ts`, qui fait un `.delete().eq("user_id", ...)` sur chacune) et les vues admin à volume élevé.

## 7. Atomicité multi-tables — le point le plus significatif de cette phase

**Le scoring n'utilise pas de transaction SQL unique.** `lib/scoring/recompute.ts` documente explicitement ce choix : `supabase-js` (REST) ne permet pas d'envelopper plusieurs `.update()` dans une seule transaction sans écrire une fonction RPC dédiée. Le risque est **assumé et compensé par l'idempotence** : une passe interrompue est rejouable sans dupliquer ni fausser un score, le pire cas étant un état transitoirement incomplet (jamais faux). C'est un compromis documenté et raisonnable pour ce cas précis.

**Cas plus préoccupant, non compensé par l'idempotence** : `deleteAccountFormAction` (`lib/actions/account.ts:107-141`) enchaîne une vingtaine d'opérations `.update()`/`.delete()` séquentielles (nullification de références, purge cascade, cassage de FK circulaires, puis `auth.admin.deleteUser`) dans un simple `try/catch`, sans transaction. Une interruption en cours de route (crash, timeout serverless) peut laisser un compte **partiellement supprimé** : ligne `users` orpheline sans ses données liées, ou `auth.users` supprimé (avec cascade sur `public.users`) alors que des références admin n'étaient pas toutes nullifiées. Contrairement au scoring, **rejouer l'opération n'est pas sûr par nature** (une 2e exécution sur un compte déjà partiellement supprimé peut échouer différemment selon l'étape atteinte). Voir `DATA-002` (registre central).

À l'inverse, les fonctions `SECURITY DEFINER` (`save_bet`, `create_league`, `request_*_correction`) sont atomiques par construction (une fonction PL/pgSQL s'exécute dans une transaction Postgres implicite) — c'est le pont `auth.users → public.users` (trigger `handle_new_user`, même transaction que l'INSERT `auth.users`) qui est le plus robuste du dépôt.

## 8. Dates et fuseaux horaires

**Vérifié** : toutes les colonnes temporelles sont en `timestamptz` — aucune colonne `timestamp without time zone` trouvée dans les 85 migrations. Bon choix : Postgres stocke en UTC, la conversion d'affichage est déléguée à l'application.

Le double fuseau applicatif répond à deux besoins distincts et non concurrents, sans confusion identifiée :
- `lib/dates/newyork.ts` : construit le paramètre `date` des appels à l'API sportive externe (Highlightly), qui interprète elle-même ce paramètre comme un jour calendaire America/New_York — contrainte du fournisseur, pas un choix arbitraire.
- `lib/dates/paris.ts` : toutes les frontières jour-calendaire côté UI (filtres, regroupement "Ce soir"/"Demain") pour un public francophone, avec calcul dynamique de l'offset DST (pas de +1/+2 codé en dur).

## 9. Contraintes d'unicité — bien couvertes, une exception notable

Bien couvertes : un prono par joueur/match, un bracket par joueur/compétition, un pick par série/bracket, un pari SERIES actif par série, un pari MATCH actif par match (corrigé le 22/08 pour exclure `CANCELLED`), une requête `PENDING` à la fois par cible.

**Exception** : le quota "3 paris MATCH maximum par série" (Playoffs) n'a **aucun backstop d'index unique** — il repose entièrement sur un `COUNT(*)` protégé par `pg_advisory_xact_lock` à l'intérieur de la fonction `save_bet`. C'est correctement fermé pour tout appel passant par cette fonction, mais un futur script d'admin ou un accès direct `service_role` qui insérerait dans `bets` sans repasser par `save_bet` contournerait silencieusement la règle, sans qu'aucune contrainte de base ne s'en aperçoive. Voir `DATA-003`.

## 10. Fuites de données entre utilisateurs / séparation public-privé

Aucune fuite constatée dans le périmètre exploré (RLS complète, fonctions `SECURITY DEFINER` revalidant systématiquement `auth.uid()` et la propriété de la ressource — vérifié sur `save_bet`, `withdraw_bet`, `delete_bet`, `request_bet_correction`/`request_prediction_correction`, `create_league`/`join_league`, avec re-scoping de la clause `WHERE` de l'écriture finale, pas seulement un contrôle logique en amont).

## 11. Données personnelles conservées — lien avec la Phase 7 (sécurité)

`bug_reports.description`, `chat_messages.body`, `bio` de profil : texte libre pouvant contenir des données personnelles. Depuis le 03/09/2026, la suppression de compte (`lib/actions/account.ts`) couvre ces tables par suppression en cascade — voir Phase 7 pour la vérification de complétude de ce mécanisme.

## Registre des anomalies de cette phase

| ID | Titre | Gravité | Statut |
|---|---|---|---|
| DATA-001 | Pattern récurrent : nouveau statut/colonne introduit sans revue systématique des index uniques partiels/policies qui en dépendent (5 migrations correctives déjà nécessaires pour cette cause) | P3 | Vérifié — corrigé à chaque fois après coup, aucun garde-fou process pour l'éviter à l'avenir |
| DATA-002 | Suppression de compte non transactionnelle (~20 opérations séquentielles), risque d'état partiellement supprimé si interruption | P2 | Vérifié, non mitigé |
| DATA-003 | Quota "3 paris MATCH/série" sans backstop d'index unique, contournable par toute écriture hors `save_bet` | P3 | À vérifier davantage (aucun chemin de contournement identifié aujourd'hui, mais rien ne l'empêche structurellement) |
| DATA-004 | Absence d'index sur `correction_requests`, `chat_messages(user_id)`, `bug_reports(user_id)`, `chat_message_reports(reporter_user_id)` | P4 | Vérifié, impact faible au volume actuel |
| DATA-005 | Orchestration multi-tables non transactionnelle du scoring (`recompute.ts`) | P4 | Vérifié, risque assumé et documenté par l'équipe, mitigé par idempotence |
| DATA-006 | Trigger `enforce_users_invariants` laisse passer tout contexte `auth.uid() IS NULL` sans garde dédiée (repose sur la RLS en aval) | P4 | À vérifier davantage — aucun test automatisé de ce cas |
| DATA-007 | `age_confirmed_at` horodaté inconditionnellement par le trigger, indépendamment du contrôle applicatif — un contournement de l'app produirait un horodatage "confirmé" trompeur | P3 | À vérifier davantage — question à trancher avec un conseil juridique (cf. `03-conformite-fonctionnelle.md`) |

*(Détail complet de chaque anomalie — reproduction, impact, solution — dans `audit/ANOMALIES.md`.)*
