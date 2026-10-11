# Plan technique — popup hebdomadaire LLM (lot 5)

> Plan du 11/10/2026, rédigé sur `origin/main` (après la PR #164). **Aucun code
> applicatif, aucune migration appliquée, aucun appel LLM.** Complète
> `nba_pronos_cadrage_popup_hebdo.md` (décisions produit) et
> `popup_hebdo/` (prompts v5 et classifieur v1, schémas, essais). Ce document
> tranche la mise en œuvre et liste en §9 les décisions qui reviennent à
> l'utilisateur.
>
> Provenance : six explorations en lecture seule (client IA, figement et
> routes, modèle de données et RGPD, popups et admin, résolveurs du flop, docs
> locales Next et SDK) puis plan de l'`architect`. Les faits marqués
> « vérifié » ont été relus à la main ; les autres viennent des explorations
> et sont à reconfirmer à l'implémentation de la PR qui les touche.

## 0. Résumé

- **5 PR, une seule migration** (`20261013090000_weekly_popup.sql`, dans la
  PR 1). Tout est conçu d'avance, y compris les RPC lues par les PR 4 et 5.
- Trois choix structurants :
  1. **Mentions stockées en jetons** `{{u:<uuid>}}`, résolus à l'affichage :
     règle le pseudo d'un compte supprimé, le refus d'être cité (y compris
     rétroactif) et un futur changement de pseudo.
  2. **Table des brouillons réservée aux admins** ; le joueur ne lit le texte
     publié que par une RPC qui ne renvoie que le contenu publié.
  3. **Génération « assurée » à chaque passage du cron** (8 h, 9 h, 10 h UTC),
     pas seulement sur `frozen: true` : elle se répare seule si une étape
     échoue après le figement. Voir la décision 20 : c'est un écart avec la
     formulation du cadrage.
- **Deux constats corrigent le cadrage** (§3.3, §1.9) : le `sens` d'un pari n'a
  que deux valeurs hors fautes techniques (`OVER`/`UNDER`), et le pseudo n'est
  pas modéré à l'inscription.
- **Bloquants à lever avant code, sans appel payant** : tarif réel de
  `claude-sonnet-5-5` (console Anthropic), Fluid Compute actif ou non sur le
  projet Vercel (§4.3).

## 1. Modèle de données

Une seule migration, `supabase/migrations/20261013090000_weekly_popup.sql`
(dernière existante : `20261012090000`). Un ajustement ultérieur ira dans une
nouvelle migration. Chaque migration exige un push manuel puis
`supabase migration list` (mémoire projet : un merge n'est pas un déploiement).

### 1.1 `bets.rejected_at`

```sql
alter table bets add column rejected_at timestamptz;
create index idx_bets_comp_rejected_at on bets (competition_id, rejected_at) where status = 'REJECTED';
create index if not exists idx_bets_comp_resolved_at on bets (competition_id, resolved_at) where status in ('WON','LOST');
```

**Pose par un trigger en base** (recommandation, décision 1) plutôt que dans le
code des deux actions : il couvre `rejectBet`, `processCorrectionRequest`, les
scripts de seed et tout futur chemin, et il couvre le trou entre le push de la
migration et le déploiement du code.

```sql
create or replace function bets_set_rejected_at() returns trigger language plpgsql as $$
begin
  if new.status = 'REJECTED' then
    if tg_op = 'INSERT' then
      new.rejected_at := now();
    elsif old.status is distinct from 'REJECTED' then
      new.rejected_at := now();   -- toute (re)transition vers REJECTED repose la date
    end if;
  end if;
  return new;
end $$;
create trigger trg_bets_set_rejected_at before insert or update of status on bets
  for each row execute function bets_set_rejected_at();
```

Il ne remet jamais la date à NULL ; une réouverture puis un nouveau refus
(permis par correction admin, `20260728120000_contest_resolved_bet.sql:42-45`)
repose la date. Le trigger existant `trg_bet_transitions` ne contrôle que
`status` : aucun conflit (relu par la revue). Limite acceptée : la policy
`bets_update_self` n'a aucune restriction par colonne, un joueur peut écrire
`rejected_at` sur son propre pari, sans effet (il ne peut pas se le refuser, et
la présélection filtre sur `status = 'REJECTED'`).

**Remplissage de l'existant** (même migration) :

```sql
update bets b set rejected_at = a.rejected_ts
from (select target_id, max(created_at) as rejected_ts from audit_logs
      where action = 'REJECT_BET' and target_type = 'bet' group by target_id) a
where b.id = a.target_id and b.status = 'REJECTED' and b.rejected_at is null;
```

`audit_logs` a pour colonnes `actor_user_id, action, target_type, target_id,
reason, before_value, after_value, created_at` (pas de `entity`/`metadata`).
**Repli sans audit : on laisse NULL et la présélection exclut
`rejected_at is null`.** Trois cas : refus passé par
`processCorrectionRequest` (qui écrit `PROCESS_CORRECTION_REQUEST`, pas
`REJECT_BET`, et que `is_admin_corrected` exclut de toute façon), écriture
d'audit échouée (best-effort), audit purgé avec le compte d'un admin supprimé
(`delete_account_data` supprime les `audit_logs` dont l'acteur est la cible).
Pas de repli sur `updated_at` (jamais mis à jour, aucun trigger) ni sur
`submitted_at` (faux). Un pari ne peut être refusé qu'une fois par `rejectBet`
(exige `SUBMITTED`, aucune transition ne ramène à `SUBMITTED`).

### 1.2 Interrupteurs

```sql
alter table users add column popup_mentions_opt_out boolean not null default false;
alter table competitions add column weekly_popup boolean not null default false;
```

- `popup_mentions_opt_out` : écrit par update client direct (policy
  `users_update_self`, aucune restriction par colonne), comme
  `recap_enabled` (`lib/actions/notifications.ts:39-52`). `users_select`
  est ouverte à tous (vérifié, `using (true)`) : la colonne sera lisible, comme
  `recap_enabled` (mineur).
- `competitions.weekly_popup` : réglage par compétition du cadrage. La
  génération n'a lieu que si `weekly_ranking AND weekly_popup`.

### 1.3 Table des brouillons `weekly_popups` (admin seulement)

```sql
create table weekly_popups (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,
  week_end_date date not null,
  kind text not null default 'LLM' check (kind in ('LLM','FALLBACK')),
  status text not null check (status in ('GENERATING','READY','DOUBTFUL','PUBLISHED','SKIPPED','RETRACTED')),
  doubt_code text,            -- invalid_output, max_tokens, api_error, timeout, cap_reached, refusal, structure, budget, stale
  doubt_detail text,
  generation_id uuid,         -- jeton de la génération en cours (garde anti-écrasement)
  generation_started_at timestamptz,
  generation_count int not null default 0,
  prompt_version text,        -- 'redacteur-v5/classifieur-v1'
  candidates jsonb not null default '[]',
  generated_content jsonb,    -- dernière sortie LLM validée, jetons, immuable
  raw_output text,            -- sortie brute si invalid_output, effacée à la publication
  content jsonb,              -- version éditable puis publiée (jetons)
  warnings jsonb not null default '[]',   -- [{code, bloc, detail}]
  attempts jsonb not null default '[]',   -- 20 dernières tentatives
  featured_user_ids uuid[] not null default '{}',
  admin_notified_at timestamptz,
  published_at timestamptz,
  published_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, week_end_date),
  foreign key (competition_id, week_end_date) references weekly_rankings (competition_id, week_end_date),
  check (status not in ('PUBLISHED','RETRACTED') or published_at is not null)
);
create index idx_weekly_popups_comp_status on weekly_popups (competition_id, status, week_end_date desc);
alter table weekly_popups enable row level security;
create policy weekly_popups_select_admin on weekly_popups for select using (public.is_admin());
-- aucune policy d'écriture : service_role seul
```

**Format d'une entrée de `candidates`** (c'est la table de correspondance
« id court → `bets.id` » du cadrage et le lieu de conservation des verdicts) :

```
{short_id:"t1", bloc:"top"|"flop"|"refuse"|"champion", bet_id|null, user_id, texte, match, statut,
 chance_pct, raison, seuil, sens, cite_recemment, points (champion),
 verdict:"ok"|"bloque", categorie, verdict_source:"lot"|"unitaire"|"reutilise", input_hash}
```

Le **pseudo n'est pas stocké** (relu à chaque génération et affichage).
`input_hash` = sha256(pseudo + texte) au moment du classement : un changement
de pseudo ou de texte invalide le verdict conservé.

- « Un seul brouillon courant par semaine » = `unique (competition_id,
  week_end_date)`. Une régénération réécrit la ligne ; pas de table
  d'historique en V1 (`generation_count`, `attempts` et `ai_usage_logs`
  tracent).
- La clé étrangère vers `weekly_rankings` garantit en base qu'aucune popup
  n'existe pour une semaine non figée (valide : `unique (competition_id,
  week_end_date)` existe, `20261012090000_weekly_ranking.sql:30`, et
  `weekly_champions` s'y appuie déjà). **Conséquence à traiter dans la PR 1**
  (relevée à la revue) : sans `ON DELETE`, une ligne `weekly_popups` bloque la
  suppression de `weekly_rankings`, donc de la compétition. Ajouter
  `delete from weekly_popups` (les vues partent en cascade) avant
  `weekly_rankings` dans `test/integration/fixtures.ts`
  (`deleteCompetitionCascade`, l.96-97, qui n'en vérifie pas les erreurs) et
  dans toute procédure de suppression ; même point pour la « correction
  exceptionnelle » d'un figement (DELETE SQL manuel de `weekly_rankings`) : il
  faut d'abord retirer la popup de la semaine.
- `generated_content` (immuable) et `content` (retouches de l'admin) sont
  séparés.

**Transitions**, appliquées par des updates conditionnels `.eq('status',
attendu)` (patron des paris) :

| Depuis | Vers | Déclencheur |
|---|---|---|
| (insertion) | GENERATING | réservation |
| GENERATING | READY, DOUBTFUL | fin de génération, si `generation_id` correspond |
| READY, DOUBTFUL, SKIPPED, GENERATING périmé (> 10 min) | GENERATING | régénérer, relancer (SKIPPED par erreur reste récupérable) |
| READY, DOUBTFUL | PUBLISHED | publication, si le contenu repasse les contrôles bloquants |
| (absent), READY, DOUBTFUL | SKIPPED | « Ne pas publier » ; **crée la ligne si elle n'existe pas** (sinon l'envoi réel du push, bloqué par le §4.5, serait impossible quand la génération n'a jamais tourné) |
| PUBLISHED | RETRACTED | retrait d'urgence (décision 15) |

Codes de `doubt_code` : `invalid_output`, `max_tokens`, `api_error`,
`timeout`, `cap_reached`, `refusal` (statuts du client, §2), `structure`
(erreur structurelle de `validateOutput` après les relances), `budget`
(plus assez de temps pour une tentative), `stale` (génération refusée parce
que la semaine n'est plus récente, §4.1).

Une semaine pauvre donne une ligne `kind='FALLBACK'` en READY, **toujours
publiée à la main** (envoi 100 % manuel en pré-Cup).

**Contenu sans donnée personnelle** : `warnings[].detail`, `doubt_detail` et
`attempts` ne contiennent jamais de pseudo ni de texte de pari (codes, ids
courts, comptes, statuts), testé en PR 3. C'est ce qui permet à la purge de
compte (§1.8) de ne pas les réécrire. `raw_output` et `candidates` en
contiennent : ils sont traités explicitement.

### 1.4 État « vu » par joueur

Table dédiée plutôt qu'une colonne de `users` (lisible par tous) : compteur
« vu par N » côté admin, purge par cascade.

```sql
create table weekly_popup_views (
  popup_id uuid not null references weekly_popups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (popup_id, user_id)
);
alter table weekly_popup_views enable row level security;
create policy wpv_select_own on weekly_popup_views for select using (user_id = auth.uid() or public.is_admin());
create policy wpv_insert_own on weekly_popup_views for insert with check (user_id = auth.uid());
```

Patron propriétaire de `push_subscriptions`. Insertion `on conflict do nothing`
(`upsert` avec `ignoreDuplicates`). Déroge volontairement à la règle « vu côté
client » (décision 3 du cadrage : par joueur, pas par appareil).

### 1.5 RPC de lecture (`security definer`, `search_path public`, revoke public/anon, grant authenticated)

- `current_weekly_popup() → jsonb | null` : dernière popup `PUBLISHED` de la
  compétition ACTIVE, publiée depuis moins de 7 jours, sans ligne de vue pour
  `auth.uid()`. Renvoie `{id, week_end_date, kind, content}` et rien d'autre
  (jamais `candidates`, `raw_output`, verdicts).
- `my_weekly_popup_mentions()` pour l'export RGPD : `week_end_date`,
  `published_at`, `content` des popups `PUBLISHED`/`RETRACTED` où
  `auth.uid() = any(featured_user_ids)`. **Le contenu contient des jetons
  `{{u:uuid}}`** : la route d'export détokenise (même fonction que
  l'affichage) et ne renvoie que les blocs qui citent l'utilisateur, pour ne
  pas exporter des UUID bruts ni les pseudos des autres joueurs.

### 1.6 `ai_usage_logs`

Colonnes nullables ajoutées (le code existant n'est pas touché) :

```sql
alter table ai_usage_logs
  add column status text, add column stop_reason text, add column request_id text,
  add column latency_ms int, add column thinking_tokens int, add column attempt int;
create index idx_ai_usage_logs_callsite_created on ai_usage_logs (call_site, created_at desc);
```

Schéma actuel (vérifié par exploration, migration `20260907120000`) : `id,
call_site, model, input_tokens, output_tokens, cache_read_tokens,
cache_creation_tokens, estimated_cost_usd, created_at` ; aucune colonne
`status`. Un `call_site` suffixé (`popupRedacteur:refusal`) casserait le filtre
du plafond : écarté.

### 1.7 Déduplication

Pas de nouveau `kind` dans `recap_log` (le CHECK `IN ('DAILY','WEEKLY')` n'est
pas touché).

| Besoin | Mécanisme |
|---|---|
| Une génération par semaine | `unique` + réservation par insertion (§4.1) |
| Une vue par joueur | clé primaire de `weekly_popup_views` |
| Une alerte admin | `admin_notified_at`, update conditionnel `is null` |
| Push aux joueurs | `recap_log WEEKLY` existant de `runWeeklyRecapSend` |

### 1.8 Purge de compte (`delete_account_data`)

`create or replace` qui recopie la version de
`20261012090000_weekly_ranking.sql:133-192` et ajoute, avant `delete from bets` :

```sql
update weekly_popups set
  candidates = coalesce((select jsonb_agg(c order by o) from jsonb_array_elements(candidates) with ordinality e(c, o)
                         where c->>'user_id' is distinct from p_user_id::text), '[]'::jsonb),
  featured_user_ids = array_remove(featured_user_ids, p_user_id),
  content = replace(content::text, '{{u:' || p_user_id::text || '}}', '{{u:supprime}}')::jsonb,
  generated_content = replace(generated_content::text, '{{u:' || p_user_id::text || '}}', '{{u:supprime}}')::jsonb,
  raw_output = null
where candidates @> jsonb_build_array(jsonb_build_object('user_id', p_user_id::text))
   or p_user_id = any(featured_user_ids)
   or content::text like '%{{u:' || p_user_id::text || '}}%'
   or generated_content::text like '%{{u:' || p_user_id::text || '}}%';
```

Relue : syntaxe valide (`jsonb_agg(c order by o)` avec `with ordinality`,
`replace(NULL)` donne NULL sans erreur), aucune FK de `weekly_popups` vers
`bets` donc l'ordre n'importe pas. Le champ `featured_user_ids` d'une popup
RETRACTED est lui aussi nettoyé.

- `weekly_popup_views` part en cascade ; `published_by` passe à NULL.
- Reprendre les `revoke` de la fonction.
- Le `replace` sur `jsonb::text` est sûr (un uuid n'a ni guillemet ni
  caractère spécial).
- À aligner dans la même PR : `scripts/delete-player-account.mjs` (même
  nettoyage ; corriger au passage l'écart connu `chat_message_reports`) et les
  fixtures d'intégration (un brouillon qui contient l'utilisateur). Tests
  Docker : **accord de l'utilisateur requis**.

### 1.9 Pseudo d'un compte supprimé dans un texte publié (doute h)

| Option | Principe | Avis |
|---|---|---|
| A | Laisser le texte | donnée personnelle conservée après suppression |
| B | Réécrire le texte à la suppression | regex SQL sur un pseudo libre (espaces, `@`, casse) : fragile |
| **C (reco)** | **Jetons `{{u:<uuid>}}` dans tout contenu stocké, résolus à l'affichage** | voir ci-dessous |

Option C : à l'affichage le jeton devient le pseudo courant, ou « un ancien
joueur » si supprimé, ou « un joueur discret » si l'utilisateur a refusé d'être
cité (anonymisation rétroactive gratuite). Prêt pour un futur changement de
pseudo. Coût : `tokenize`/`detokenize` (fonctions pures) et la conversion à
l'enregistrement d'une retouche admin. Le texte d'un pari supprimé déjà cité
reste, devenu non rattaché à une personne : à écrire dans `/confidentialite`.

**Fait relevé (vérifié)** : le pseudo est un texte libre. `signup`
(`lib/auth/actions.ts:59-68`) ne fait que `trim` et vérifie non vide ; la base
impose `unique` sensible à la casse. `@Max` et `@max` peuvent coexister, un
pseudo peut contenir des espaces ou un `@`. **Aucune modération à
l'inscription** (non vérifié côté trigger `handle_new_user`) : l'hypothèse du
`prompt_classifieur_v1.md` « pseudo du champion contrôlé à l'inscription » est
fausse (décision 6).

### 1.10 Export RGPD et textes

- `app/api/account/export/route.ts` : ajouter `popup_mentions_opt_out` au
  profil, `weekly_popup_views` (lecture RLS propre), `weekly_popup_mentions`
  (`rpc('my_weekly_popup_mentions')`) et **`weekly_champions`** (écart connu du
  lot 4). `rejected_at` arrive seul via `bets.select("*")`.
- `app/confidentialite/page.tsx` §2 : nouveau traitement (texte hebdomadaire
  humoristique rédigé par IA à partir du texte des paris et du pseudo, relu
  par un admin avant publication ; droit de ne pas être cité ; un compte
  supprimé n'est plus nommé) ; vérifier le texte actuel sur Anthropic comme
  sous-traitant. §5 : durée de conservation (décision 16).
- « Mes données » (`app/(app)/profile/page.tsx:273-279`) : palmarès hebdo,
  mentions dans les popups, popups vues.

### 1.11 RLS (récapitulatif)

| Objet | Lecture | Écriture |
|---|---|---|
| `weekly_popups` | `is_admin()` | service_role |
| `weekly_popup_views` | propriétaire + admin | propriétaire |
| `current_weekly_popup()`, `my_weekly_popup_mentions()` | authenticated (security definer) | — |
| `bets`, `users` | policies inchangées | inchangées |

**Ne jamais ajouter de policy de lecture joueur sur `weekly_popups`** (elle
contient des textes discriminatoires bloqués et les refusés des autres).

## 2. Client Anthropic à statut explicite

Module `lib/ai/claudeJson.ts` (`import "server-only"`). Jamais dérivé de
`structureBet.ts` (qui renvoie `null` en silence, ne journalise qu'après un
`parse` réussi, ne lit pas `stop_reason`).

```ts
export type LlmStatus = "ok"|"refusal"|"invalid_output"|"max_tokens"|"api_error"|"timeout"|"cap_reached";
export type LlmCallResult<T> = {
  status: LlmStatus; data?: T; rawText?: string; issues?: string[];
  model?: string;  // response.model, le modèle réellement servi
  stopReason?: string | null; refusal?: { category: string | null; explanation: string | null } | null;
  requestId?: string | null; httpStatus?: number; errorMessage?: string;
  latencyMs: number; attempt: number;
  usage?: { input: number; output: number; thinking: number; cacheRead: number; cacheWrite: number };
  costUsd: number; retriable: boolean;
};
export async function callClaudeJson<T>(opts: {
  callSite: "popupClassifier" | "popupRedacteur";
  model: string; system: string; user: string;
  maxTokens: number; effort: "low" | "medium";
  schema: z.ZodType<T>; timeoutMs: number; attempt: number;
  deps?: { create?: CreateFn; now?: () => number; spend?: () => Promise<number>; record?: RecordFn };
}): Promise<LlmCallResult<T>>;
```

**Comportement**

- Client singleton paresseux `new Anthropic({ apiKey, maxRetries: 0 })` ;
  `timeout` par requête. Clé absente = `api_error`, sans exception.
- Requête : `{ model, max_tokens, thinking: {type:"adaptive"}, output_config:
  {effort}, system, messages }`. **Ni `temperature`, ni `top_p`, ni `top_k`**
  (le SDK 0.120.0 documente un 400 pour les modèles postérieurs à Opus 4.6).
- **`messages.create` non streamé + `JSON.parse` + Zod maison**, pas
  `messages.parse` ni `output_config.format` : `parse` ne lit pas `stop_reason`
  et lève sur un JSON tronqué ; effort + format n'est pas éprouvé ; le prompt
  seul a tenu 16 sorties sur 16 aux deux essais. Le doute (a) devient sans
  objet en V1.
- Le SDK ne force pas le streaming avec un `timeout` explicite
  (`messages.mjs:25-29`, rapporté par l'architect) ; sans timeout,
  16 000 tokens restent sous le seuil de 600 s.

| Cas | Statut |
|---|---|
| Plafond dépassé (vérifié avant l'appel) | `cap_reached` (aucun appel, pas de ligne de log) |
| `APIConnectionTimeoutError` | `timeout` |
| `APIError` | `api_error` ; `retriable` si 408, 409, 429, 5xx, 529 ; non pour 400, 401, 403, 404, 413 |
| `stop_reason = refusal` | `refusal` (avec `stop_details`) |
| `max_tokens` ou `model_context_window_exceeded` | `max_tokens` |
| autre `stop_reason` que `end_turn` | `invalid_output` |
| `end_turn` | concaténation des blocs `text` (thinking ignoré), clôture de code tolérée, `JSON.parse`, `safeParse` ; échec = `invalid_output` + `issues` |

**Journal** : une ligne `ai_usage_logs` par tentative ayant obtenu une réponse
(`ok`, `refusal`, `invalid_output`, `max_tokens`), avec `status`,
`stop_reason`, `request_id`, `latency_ms`, `thinking_tokens`, `attempt` ; une
ligne aussi pour `timeout`/`api_error` (0 token pour `api_error`). Pour
`timeout`, le coût est estimé au pire (entrée estimée + `max_tokens` × tarif
de sortie) : une requête abandonnée côté client peut être facturée.

**`lib/ai/usageTracking.ts`** : `recordAnthropicUsage(callSite, model, usage,
meta?)` (argument optionnel, rétrocompatible avec les 9 appelants) ;
`getTodaySpendUsd(scope: "structuration" | "popup" = "structuration")`
(`popup` filtre `call_site like 'popup%'`, `structuration` l'exclut).
Aujourd'hui la somme porte sur **tous** les `call_site` : sans ce filtre, la
popup consommerait le plafond de 5 $ de la structuration.
`POPUP_DAILY_COST_CAP_USD = 1`. **Le plafond popup échoue fermé** (erreur de
lecture = `cap_reached`) ; celui de la structuration reste ouvert. Contrôle
avant chaque tentative : dépense du jour + pire coût de l'appel ≤ 1 $ (pire
coût rédacteur ≈ 4 000 × 2 $/M + 16 000 × 10 $/M ≈ 0,17 $, sous réserve du
tarif réel).

**Plafond aveugle si le journal échoue** (relevé à la revue) :
`recordAnthropicUsage` avale les erreurs d'insert
(`usageTracking.ts:67-73`) ; si l'insert échoue (colonnes de la PR 1 absentes,
base indisponible), `getTodaySpendUsd` relit 0 et le plafond ne bloque plus.
Donc : (1) la génération **cumule le coût en mémoire** pendant le run et le
compte dans le contrôle ; (2) pour la portée `popup`, `record` renvoie un
booléen et un échec d'écriture rend le statut `cap_reached` pour les
tentatives suivantes ; (3) le contrôle précède chaque paquet de 6 appels
parallèles du repli unitaire (pire coût du paquet compté d'avance). Autres
appelants de `getTodaySpendUsd` : `structureAndScoreBet.ts:1218`, la page
`app/(admin)/admin/sync-logs/page.tsx:25` (qui affichera la dépense contre le
plafond de 5 $ sans la popup : ajouter une ligne « popup » à cette page dans
la PR 4) et le mock de `structureAndScoreBet.diagnosis.test.ts:27`.

**Tarif de `claude-sonnet-5-5` (doute j) : non établi.**
`PRICE_PER_MTOK_USD` ne connaît que `claude-sonnet-5` (2,0 / 10,0 / cacheWrite
2,5 / cacheRead 0,2) avec repli sur ce tarif (vérifié par exploration). Les
essais (`run_essai.mjs:20-23`) ont **supposé** ce tarif en dur : les 0,097 $ et
0,102 $ sont des estimations, pas des factures. Action : lire le coût réel du
11/10/2026 dans la console Anthropic (onglet Usage/Cost) et le rapporter aux
tokens de `resultats.json` — sans aucun appel. Entre-temps : entrée
`"claude-sonnet-5-5"` avec les valeurs de sonnet-5 marquées « À CONFIRMER » et
repli d'un modèle inconnu vers le tarif connu le plus cher.

**Réflexion** : `output_tokens` est « inclusive, authoritative total used for
billing » (SDK, `messages.d.ts:2024-2028`) ; `output_tokens_details.
thinking_tokens` est un sous-total. Établi aussi par les données : jeux
d'injection et d'écart ambigu à 1504, 1559 et 911 `output_tokens` dont 1111,
1173 et 656 de réflexion (vérifié dans `essai_v2/resultats.json`), les autres
jeux à 0. Doutes (b) et (c) levés (19 appels réels en adaptatif sans outil).
`thinking_tokens` est journalisé pour suivi, sans ajout au coût.

**Relances par l'application** (SDK en `maxRetries: 0`) : `lib/ai/retry.ts`,
`withRetries(fn, { maxAttempts: 3, deadlineMs, backoffMs: [2000, 5000] })`,
pure, horloge injectée. On relance si `retriable` : timeout, api_error
transitoire, `invalid_output`, `max_tokens`, `refusal` du **rédacteur**. Jamais
`cap_reached` ni une 4xx déterministe. `retry-after` respecté s'il tient dans
le budget. Une tentative n'est lancée que s'il reste ≥ 15 s ; sinon
brouillon DOUBTFUL, code `budget`.

**Refus du classifieur** : lot refusé → repli sur un appel par candidat (par
paquets de 6, en parallèle) ; un candidat refusé ou en `api_error`/`timeout`
après relances = « bloque », catégorie « doute » (échec fermé par candidat).
Seul un lot entièrement `invalid_output`/`api_error`/`timeout` après 3
tentatives rend le brouillon douteux. Le comportement réel sur un vrai refus
n'a jamais été observé (doute e) : accepté, le repli échoue fermé et la
publication est manuelle.

**Timeouts par rôle** : classifieur 25 s, rédacteur 45 s, bornés par le budget
restant (latences observées 2,3 à 13,1 s).

**Configuration** `lib/weeklyPopup/config.ts` : `MODEL = "claude-sonnet-5-5"`
(surcharge `POPUP_LLM_MODEL`), `EFFORT` (rédacteur `medium`, classifieur
`low`), `MAX_TOKENS` (16 000 / 8 000), `PROMPT_VERSION`.

## 3. Pipeline

### 3.1 Fonctions pures (`lib/weeklyPopup/`, testables sans I/O)

`sens.ts` (`computeSens`), `families.ts` (`flopFamily`, `isFlopEligible`),
`preselect.ts`, `format.ts` (`assignShortIds`, `buildClassifierInput`,
`buildRedacteurInput`, `matchLabel`), `verdicts.ts` (`mergeVerdicts`,
`applyVerdicts`), `validate.ts` (`validateOutput`), `mentions.ts`
(`scanMentions`, `normalizePseudo`), `tokens.ts` (`tokenize`, `detokenize`),
`words.ts`, `money.ts`, `fallback.ts`, `featured.ts`, `history.ts`,
`prompts.ts` (constantes recopiées mot pour mot du v5 et du classifieur v1),
`schemas.ts` (Zod), `types.ts`.

Avec I/O : `load.ts` (`loadWeekData`), `generate.ts`
(`runWeeklyPopupGeneration(popupId, generationId, {deadlineMs, trigger})`),
`ensure.ts` (`ensureWeeklyPopupDraft`, `reserveRegeneration`), `notify.ts`,
`lib/push/admins.ts` (`sendPushToAdmins`).

### 3.2 Chargement (service_role)

- Compétition ACTIVE (`maybeSingle`) avec `weekly_ranking && weekly_popup`.
- Fenêtre `[recapBoundaryIso(weekEnd-7), recapBoundaryIso(weekEnd))`. WON et
  LOST sur `resolved_at` (jamais `scored_at`, que `recomputeBet` réécrit à
  chaque recalcul avec points non nuls, `lib/scoring/recompute.ts:315` : un
  « Recalculer » ou une correction déplace le pari dans la fenêtre ;
  `lib/recaps/load.ts:72-80` n'est donc pas réutilisable) ; REJECTED sur
  `rejected_at` non NULL.
- Colonnes lues : identification (`id, user_id, description, status, match_id,
  scope, series_id`), scoring (`validated_difficulty, calculated_proba,
  resolved_at, rejected_at, resolution_reason, resolved_by_admin_id,
  is_admin_corrected`), structuration (`structured_stat, _threshold,
  _comparison, _negation, _team_id, _player_id, _period,
  _technical_fouls_count`, et les autres jsonb pour la liste blanche).
- Joueurs : `users(id, pseudo, status, popup_mentions_opt_out)`. Libellé du
  match : `matches.home_team_id`/`away_team_id` puis chargement séparé de
  `teams`, comme `lib/recaps/load.ts:66,108-109` (doute l levé) ; `match` =
  null pour un pari de portée SERIES (sans `match_id`).
- Niveau 1 de semaine pauvre : `count` (`head: true`) sur WON, LOST, REJECTED
  de la fenêtre, **avant les exclusions**.
- Limite PostgREST 1 000 lignes : lecture par bloc avec `order` SQL et
  `limit 300`, plafond par joueur en code. Dette à documenter.

### 3.3 Exclusions (tous blocs) et `sens`

Exclus : `is_admin_corrected` ; auteur non ACTIVE ; auteur avec
`popup_mentions_opt_out` ; description vide après `trim` ; `CANCELLED` ;
description contenant `/@[\p{L}\p{N}_-]/u` (V1 stricte) ; REJECTED avec
`rejected_at` NULL. `raison` mise à NULL si `resolved_by_admin_id` non nul
(top possible, flop jamais).

**`sens` à partir des colonnes réelles** (corrige le cadrage §1 ter) :

| Source | `sens` |
|---|---|
| `structured_technical_fouls_count.count_relation` | AT_LEAST → « au moins » ; MORE_THAN → « plus de » ; FEWER_THAN → « moins de » ; EXACTLY → « exactement » |
| `structured_period.outcome_kind = QUARTERS_WON_COUNT` et `exact_count = true` | « exactement » |
| sinon `structured_comparison` | OVER → « plus de » ; UNDER → « moins de » |
| sinon | `null` |

`structured_comparison` est contraint à `('OVER','UNDER')` (OVER = strictement
supérieur, `resolveBetsShared.ts:123-175`) ; `structured_negation` ne sert
qu'aux `went_to_ot`/`had_*`, jamais à un seuil. Il n'y a pas de colonne
`structured_data` ni de portée team/each/combined. Conséquences : **« au plus »
n'est jamais produit** et « au moins » ne vient que des fautes techniques. Le
prompt v5 garde ses cinq sens sans danger ; les cas limites 11 et 15 du prompt
(« au plus ») ne se présenteront pas en production. À corriger dans la PR 3
(doc seulement, sans toucher au texte du prompt) : cadrage §1 ter et la
section « Règles de production côté code » de `prompt_redacteur_v5.md`, qui
disent « depuis `structured_comparison`/`structured_negation` ».

### 3.4 Familles éligibles au flop (liste blanche et échelle)

Conditions communes : LOST, **`scope = 'MATCH'` et `match_id` non NULL**
(un pari SERIES perdu a une raison non vide sans valeur,
`resolveSeriesBets.ts:34,129-131`, et passerait sinon pour « joueur
simple »), `structured_threshold` non NULL, `sens` non NULL, `raison` non
vide, `resolved_by_admin_id` NULL, raison différente de
`DNP_RESOLUTION_REASON` (`resolveBetsShared.ts:334`),
`NOT_IN_MATCH_RESOLUTION_REASON` (`resolveNotInMatchBets.ts:124`) et
`NOT_IN_SERIES_RESOLUTION_REASON` (`resolveNotInMatchBets.ts:127`).

| Famille | Détection | Échelle | Statut |
|---|---|---|---|
| Joueur simple (MATCH, NotInMatch SINGLE) | `structured_player_id` non NULL (fiable : NULL à l'écriture, rempli par `fillPlayerId`/`settle` ; un NotInMatch non identifié porte la raison constante, donc exclu deux fois) ; `structured_stat` ∈ clés de `COUNTING_STAT_COLUMN` (`resolveBetsShared.ts:57` : pts, reb, ast, fg3m, stl, blk, fga, fg3a, oreb, tov, plus_minus), qui exclut déjà dd, td, tech, ft, fg, fg3, min ; **`plus_minus` retiré** (seuil négatif possible, piège d'écart) ; colonnes jsonb et `structured_team_id` NULL selon `namedPlayerShape` (`resolveNotInMatchBets.ts:104-122` : `_duel`, `_combo`, `_roster_split`, `_roster_count`, `_technical_fouls_count`, `_last_basket`, `_block_on_player`, `_period`, `_superlative`) : liste exportée ou dupliquée dans `flopFamily` et testée | valeur du joueur | éligible |
| `total_points` | `structured_stat = 'total_points'` | total du match | éligible |
| Stat équipe | `structured_team_id` non NULL ; stat dans `TEAM_STAT_CODES` (`teamStatCodes.ts`) hors `TEAM_PERCENTAGE_STATS` (ft, fg, fg3) | équipe (la raison ne nomme pas l'équipe, le texte du pari si) | éligible |
| Stat match `total_{stat}` | préfixe `total_`, hors pourcentages | total combiné | éligible |
| Période équipe | `structured_period.player_id` NULL, `outcome_kind` ∈ {MARGIN, TOTAL_POINTS, QUARTERS_WON_COUNT} | même échelle | éligible |
| Temps morts | `total_timeouts` | total combiné | éligible |
| Fautes techniques | `structured_technical_fouls_count` non NULL | total de la portée | éligible |
| Pourcentages (joueur, équipe), `POINT_SHARE_PCT` | — | seuil en fraction, raison en « % » | **exclus** |
| Minutes | — | raison arrondie au dixième | **exclues** |
| QUARTER_WINNER, HALF_WINNER, LEADS_HALF_RESULT | — | pas de seuil | exclus |
| Duel, combo, période joueur, série, superlatif, roster, dernier panier, contre | — | — | exclus |

**« Flop mis à null à tort 1 fois sur 2 » (doute f)** : en production ce cas ne
peut plus venir des données, la liste blanche ne transmettant que des familles
où la raison mesure la même chose que le pari (le piège « pour chaque équipe »
face à un total du match n'existe dans aucune famille éligible). Côté contrôle,
un bloc `null` alors qu'il a des candidats est un **avertissement** (décision
7). Levé par tests unitaires de `flopFamily` (PR 3).

### 3.5 Présélection, tri, départage (`preselect`, pur)

| Bloc | Filtre | Tri | Coupe |
|---|---|---|---|
| Top | WON | `validated_difficulty` décroissante, puis `calculated_proba` croissante (NULL en dernier) | 5 |
| Flop | LOST éligible | `calculated_proba` décroissante (NULL en dernier) | 8 |
| Refusé | REJECTED | `rejected_at` croissante | 5 |

Départage commun : date croissante puis `bets.id`. 2 paris au plus par joueur
et par bloc, **avant** la coupe. Pas de remplissage après un blocage
(décision 17). `chance_pct = round(calculated_proba × 100)` ; texte tronqué à
280 caractères. Ids courts dans l'ordre du tri : t1…t5, f1…f8, r1…r5, c1…c3.

### 3.6 HISTORIQUE, champion

- `cite_recemment` = `user_id` dans l'union des `featured_user_ids` des 2
  dernières popups `PUBLISHED` de la compétition (semaine antérieure) ;
  `RETRACTED` ne compte pas.
- Champion : `weekly_champions` de `(competition, weekEnd)`, pseudos courants
  (points > 0 déjà garanti par `pickWeeklyChampions`). **Il passe aussi par le
  classifieur** (ligne `{id:"c1", pseudo, texte:""}`) puisque le pseudo n'est
  pas modéré (décision 6). Refus d'être cité : décision 2. Plus aucun champion
  = `CHAMPION: null`.

### 3.7 Classifieur

Entrée : candidats restants + champions. Verdict réutilisé si un verdict de
même `bet_id` (ou `user_id` pour un champion) et même `input_hash` existe déjà
(`verdict_source:"reutilise"`) ; si tout est réutilisé, aucun appel ; sinon un
appel en lot sur les seuls nouveaux candidats (c'est le mécanisme de stabilité
qui remplace la température). Contrôles du lot en code : id absent, doublon,
id inconnu ou verdict inconnu = « bloque/doute » ; l'incohérence `categorie`
(NULL si et seulement si `ok`, le `if/then/else` du schéma) vérifiée en code.
**Joueur bloqué** : tous ses candidats sont retirés de la semaine (décision 8 :
le classifieur ne dit pas si c'est le pseudo ou le texte). Niveau 2 de semaine
pauvre : après exclusions et blocages, top, flop et refusé vides = repli.

### 3.8 Rédacteur et contrôles

Message système : le prompt v5 mot pour mot. Message utilisateur :
`CHAMPION: <JSON|null>\nCANDIDATS:\n<une ligne JSON par candidat ok>`. Ni
`user_id`, ni `bet_id`, ni `refusal_reason` transmis.

**`validateOutput` (pur).** Erreurs (brouillon douteux, relance) :

1. Zod : clés exactes, types, `maxLength` en caractères, motif
   `^[tfr]\d{1,3}$`, 8 éléments au plus ; unicité vérifiée en code.
2. Aucun des blocs top, flop, refuse n'est une chaîne.
3. Bloc NULL mais `paris_cites` non vide, ou l'inverse.
4. Id de `paris_cites` inconnu, hors bloc (préfixe) ou en doublon.
5. Mention `@` hors de l'ensemble fermé (candidats ok + champions retenus).
6. > +50 % sur un bloc, ou > 180 mots au total.

Avertissements (relecture) : dépassement entre +20 % et +50 % ; vocabulaire
d'argent (liste de `x-controles-en-code`, hors « mise en/à/au », « gagné »,
« côte ») ; bloc NULL alors qu'il a des candidats ; emoji. Le genre n'est pas
contrôlé en code (décidé). Mots : découpe sur les espaces, une `@mention`
compte pour un mot ; limites titre 8, champion 30, top 45, flop 50, refuse 40,
cta 15.

**`scanMentions`** : à chaque `@`, plus longue correspondance dans l'ensemble
fermé ; d'abord à l'identique, puis normalisée (NFKD, sans accents, minuscules) ;
suivie d'une fin de texte ou d'un caractère hors `[\p{L}\p{N}_-]` (`@max` ≠
`@maxime`, `@Rillettes` ≠ `@Rillettes-31`, pseudos avec espaces gérés) ; si
deux pseudos de l'ensemble se confondent une fois normalisés, correspondance
exacte seule. Un candidat bloqué ne peut être cité ni par id (jamais transmis)
ni par pseudo (joueur entier retiré).

**Après validation** : `tokenize(content, closedSet)` donne `generated_content`
et `content` (jetons ; seul le texte rédigé est tokenisé, un `@` dans un texte
de pari est impossible car le pari est exclu).

### 3.9 Publication

1. Recontrôle **bloquant** du `content` détokenisé : erreurs 1 à 6 et mentions
   d'utilisateurs ayant refusé d'être cités depuis la génération.
2. `featured_user_ids` = utilisateurs dont un jeton figure dans top, flop ou
   refuse (hors champion, titre, cta).
3. `status = 'PUBLISHED'`, `published_at`, `published_by`, `raw_output = null`.

### 3.10 Semaine pauvre et texte de repli

Niveau 1 (< 3 paris) : aucun appel. Niveau 2 : le classifieur a été payé, pas
le rédacteur. `kind='FALLBACK'`, `content = { titre, repli, cta, champion:
championSentence(champions) | null, top|flop|refuse: null }`. `FALLBACK_TEXTS`
(3 à 5, sans genre, argent ni emoji : **à écrire par l'utilisateur**,
décision 19) tournent par `index = nombre de popups FALLBACK déjà PUBLISHED
dans la compétition, modulo N` (déterministe, testé). `championSentence`, sans
genre : « En tête de la semaine : {{u:A}} avec 42 points. » / « À égalité en
tête : {{u:A}} et {{u:B}}, 42 points. ».

### 3.11 Écriture finale

`update weekly_popups set … where id = ? and generation_id = ?` (garde
anti-écrasement face à une régénération concurrente) ; statut READY ou
DOUBTFUL avec `doubt_code`, `doubt_detail`, `warnings`, `attempts`,
`generation_count + 1` ; puis notification de l'admin (§5.1).

## 4. Accroche et routes

### 4.1 Cron `/api/recaps`

Quatrième étape isolée, après `weekly` et avant `recaps` :

```ts
const popup = await ensureWeeklyPopupDraft(now).then(ok, err)
```

`ensureWeeklyPopupDraft(nowMs)` : `weekEnd = weekEndFor(now)` ; compétition
ACTIVE avec `weekly_ranking && weekly_popup` ; semaine figée (ligne
`weekly_rankings`) ; ligne `weekly_popups` absente → **réservation** par
`upsert({status:'GENERATING', generation_id, generation_started_at},
{onConflict:'competition_id,week_end_date', ignoreDuplicates:true}).select('id')`
(patron `recap_log`), seul celui qui a inséré continue ; ligne GENERATING de
plus de 10 min → reprise par update conditionnel ; puis
`after(() => runWeeklyPopupGeneration(...))` (`after` stable en Next 16,
`after.md:8`, durée de la route, `after.md:50`).

- **Pas d'accroche sur `frozen:true` seulement** : le cron cherche
  « semaine figée sans brouillon » à chaque passage et répare ainsi un échec
  après figement ou un figement admin antérieur au déploiement.
- **Combien de passages voient la bonne semaine** (corrigé à la revue,
  `lib/weekly/standings.ts:25-30` : la semaine n'est « close » qu'à partir du
  lundi 10 h Paris) : en **été** 10 h Paris = 08:00Z, les 3 passages (8 h,
  9 h, 10 h UTC) voient la nouvelle semaine ; en **hiver** 10 h Paris =
  09:00Z, le passage de 8 h UTC voit encore la semaine précédente, seuls
  ceux de 9 h et 10 h UTC comptent. Le premier figement réel (26/10) est en
  heure d'hiver.
- **Garde `stale`** : `ensureWeeklyPopupDraft` ne génère automatiquement que
  si la frontière `weekEnd` (lundi 10 h Paris) date de moins de 36 h. Au
  mauvais passage d'hiver elle date de ~7 jours : aucune génération payante
  pour une semaine déjà passée (code `stale` si la ligne existe sans
  contenu). L'admin garde `generateWeeklyPopupNow` pour un rattrapage
  volontaire.
- **Budget du cron** : `after` partage le `maxDuration` de la route, compté
  depuis le début de la requête (`after.md:48-50`), et snapshot, figement et
  `runRecaps` (envoi de push) s'exécutent avant. `deadlineMs` = début de
  requête + `maxDuration` − marge, et non un budget neuf de 50 s.
- Le 500 HTTP ne concerne que la réservation et la lecture ; l'issue de la
  génération est dans la ligne en base (DOUBTFUL + motif + alerte).
- Migration absente : erreur explicite sur le modèle de `MIGRATION_HINT`.
- Réponse du cron aujourd'hui : `{snapshot, weekly, recaps}` ; ajouter `popup`.

### 4.2 Action admin `freezeWeeklyRanking`

Après `result.frozen`, même réservation puis `after(...)` dans la Server
Action. L'admin voit « génération en cours » sur la page popup ; pas d'attente
synchrone de 20 s derrière « Figer ».

### 4.3 Durée maximale (à lever avant la PR 3)

- `/api/recaps` n'a **aucun** `maxDuration` (seul `runtime = "nodejs"`) ;
  `vercel.json` : région `dub1`, 3 crons, pas de bloc `functions` ; le layout
  admin est à `maxDuration = 60` (couvre les Server Actions de ses pages,
  confirmé par `maxDuration.md:18`).
- Nominal : 2 appels en série de 2 à 13 s chacun (≈ 17 s). Pire cas : 25 s +
  45 s plus relances : **ne tient pas dans 60 s**.
- Plan Vercel = Hobby (`audit/13-production-et-exploitation.md:38`) ; 300 s
  défaut et max avec Fluid Compute (skill Vercel locale, non vérifié sur le
  projet). **Fluid actif ? Non vérifié.** Un `maxDuration` au-dessus du plafond
  du plan fait échouer le déploiement.
- Si Fluid actif : `maxDuration = 300` sur `/api/recaps` (PR 3), sur
  **`app/(admin)/admin/competitions/page.tsx`** (PR 3 : c'est de cette page
  que part `freezeWeeklyRanking`, donc son `after()` ; la durée d'une Server
  Action se règle au niveau de la page, `maxDuration.md:18`, et la page hérite
  aujourd'hui de 60 s du layout) et sur `app/(admin)/admin/popup/page.tsx`
  (PR 4). Comportement quand layout (60) et page (300) divergent : non vérifié,
  à tester sur un déploiement preview. Sinon : 60 s partout, budget de 50 s
  pour les actions admin synchrones, dépassement = DOUBTFUL `budget`,
  « Relancer » repart avec un budget neuf (les verdicts réutilisés ne
  consomment rien).

### 4.4 Actions admin (`lib/actions/admin-weekly-popup.ts`)

Chaque action : `getUser` + `rpc('is_admin')`, écriture `getServiceClient()`,
`logAdminAction`, `revalidatePath('/admin/popup')` et `/admin`.

| Action | Effet |
|---|---|
| `generateWeeklyPopupNow()` | semaine figée sans ligne : réservation puis génération **synchrone** (budget 50 s) |
| `regenerateWeeklyPopup(popupId)` | READY, DOUBTFUL ou GENERATING périmé → GENERATING, nouveau `generation_id`, verdicts conservés, synchrone (`WEEKLY_POPUP_REGENERATE`) |
| `saveWeeklyPopupDraft(popupId, fields)` | tokenisation, contrôles (erreurs affichées, enregistrement permis), `content` (`WEEKLY_POPUP_EDIT`) |
| `publishWeeklyPopup(popupId)` | contrôles bloquants §3.9 puis PUBLISHED (`WEEKLY_POPUP_PUBLISH`) |
| `skipWeeklyPopup(popupId \| weekEnd)` | SKIPPED ; crée la ligne si elle n'existe pas (§1.3) |
| `retractWeeklyPopup(popupId)` | RETRACTED |

La relance après un brouillon douteux est `regenerateWeeklyPopup`.

### 4.5 Couplage avec le push hebdo existant (décision 9)

Deux gestes conservés. Quand `weekly_popup` est actif,
`runWeeklyRecapSend` refuse l'envoi **réel** tant que la popup de `weekEnd`
n'est pas PUBLISHED ou SKIPPED (« Publie d'abord la popup ») ; l'essai reste
permis. L'URL du push passe de `/leaderboard?vue=semaine` à `/home` (la popup
s'ouvre partout dans `(app)`).

## 5. Écrans

### 5.1 Admin

Page `app/(admin)/admin/popup/page.tsx`, lecture
`lib/queries/admin-weekly-popup.ts` (session, RLS `is_admin`) :

- semaine et statut (badge READY, DOUBTFUL avec `doubt_code` et
  `doubt_detail` en clair, GENERATING avec « relancer » si périmé, PUBLISHED
  « vu par N », SKIPPED, RETRACTED) ;
- avertissements ; aperçu avec le même composant que côté joueur ;
- éditeur 6 champs (+ `repli` pour FALLBACK) avec compteur de mots et limite
  (couleur à +20 % et +50 %) ;
- tableau des candidats : bloc, pseudo courant, texte, chance, raison, `sens`,
  verdict et catégorie, `cite_recemment`, cité ou non ;
- boutons Enregistrer, Régénérer (confirmation « appel payant »), Publier, Ne
  pas publier, Retirer ; `raw_output` repliée si invalide ; tentatives et coût
  du jour (somme `ai_usage_logs` popup).

**Rendu toujours en texte React, jamais en HTML** (textes de joueurs
potentiellement hostiles).

- Interrupteur `competitions.weekly_popup` dans `/admin/competitions`, sur le
  modèle de `setWeeklyRankingFormAction`.
- Pastille : `weeklyPopupPendingCount` (READY ou DOUBTFUL) et
  `weeklyPopupDoubtful` dans `getAdminDashboardData` et `EMPTY_COUNTS`
  (`lib/queries/admin-dashboard.ts`) + carte dans `queues` de
  `app/(admin)/admin/page.tsx`, ton « alerte » si douteux.
- Rappel « envoi manuel » près de `SendWeeklyRecapButton`.
- **Push à l'admin** : nouveau `lib/push/admins.ts`, `sendPushToAdmins(payload,
  opts?)` (il n'existe aucune fonction « envoyer à un user », seulement
  `sendPushToSubscriptions` et le mode `onlyUserId`) ; destinataires
  `users role='ADMIN' status='ACTIVE'` puis leurs `push_subscriptions` ;
  `recap_enabled` ignoré (alerte d'exploitation) ; envoi seulement si
  `trigger === 'CRON'`, une fois (`admin_notified_at is null`, remis à NULL à
  la régénération) ; textes « Popup hebdo prête à relire » / « Popup hebdo
  bloquée : <motif> », URL `/admin/popup`. Pas d'email (décision du 11/10).
- **Essai** (décision 13) : « Générer un essai » exécute le pipeline sur les 7
  derniers jours, sans figement ni écriture, résultat affiché, coût journalisé :
  seul moyen de tester avant le premier figement réel du 26/10. **Chaque clic
  est un appel payant, avec accord.**

### 5.2 Joueur

- **Lecture** : server action `getMyWeeklyPopup()`
  (`lib/actions/weekly-popup.ts`) : `rpc('current_weekly_popup')` puis
  `detokenize` avec `users(id, pseudo, popup_mentions_opt_out)` (supprimé =
  « un ancien joueur », refus = « un joueur discret »).
- **Montage** : `components/weeklyPopup/WeeklyPopupWatcher.tsx` (client) dans
  `app/(app)/layout.tsx` à l'intérieur de `ValidatedDialogProvider`, chargement
  après montage avec 800 ms de délai (comme `NewBadgesWatcher`).
- **Ordre : « Pari validé », puis popup hebdo, puis badges.** Le watcher
  attend `!useIsValidatedDialogOpen()` ; il expose `useIsWeeklyPopupOpen()`
  (petit `WeeklyPopupProvider`) et `NewBadgesWatcher` y ajoute une condition
  d'attente (modification minime, régression possible). Relevé à la revue :
  (1) dans `NewBadgesWatcher` seul le **rendu** est bloqué par la popup
  validée (`:155`), `check()` ne l'est pas ; (2) les deux watchers chargent
  après 800 ms : si les badges répondent avant la popup hebdo, la leur
  s'afficherait puis serait masquée (scintillement) ; donc
  `useIsWeeklyPopupOpen()` vaut **vrai aussi pendant le chargement** de la
  popup hebdo ; (3) `NewBadgesWatcher` re-vérifie à `visibilitychange` (5
  min) : le watcher hebdo fait pareil, sinon une PWA ouverte depuis le
  dimanche ne voit pas la popup du lundi ; (4) l'id fixe `modal-dialog-title`
  de `ModalDialog` est dupliqué si deux `ModalDialog` sont montés (mineur).
- **Coquille** : `ModalDialog` (titre = titre de la popup, « × Fermer ») ;
  dedans `WeeklyPopupCard` (partagé avec l'aperçu admin), une section par bloc
  non NULL avec sous-titre fixe (« En tête », « Le coup de la semaine »,
  « Raté de peu », « Refusé »), `repli`, cta, bouton « À mes pronos » vers
  `/play` qui ferme aussi la popup. `role="dialog"`, `aria-modal`, piège à
  focus, Échap et clic sur le fond sont déjà fournis ; contraste à valider.
- **« Vu » à la fermeture**, quelle qu'en soit la voie :
  `markWeeklyPopupSeen(popupId)` (insertion par session et RLS, `on conflict do
  nothing`, sans attendre) ; drapeau `sessionStorage` contre un second
  affichage si l'écriture échoue ; une fermeture forcée de la PWA la fait
  revenir (accepté).
- **Interrupteur e2e** : clé localStorage `weekly-popup:disabled` dans
  `e2e/fixtures.ts` (obligatoire : une popup avale des clics).
- **Profil** : interrupteur « Ne pas me citer dans la popup hebdo », copié de
  celui des récaps ; l'aide précise l'effet rétroactif.

## 6. Découpage en PR (une branche + une PR chacune, depuis `origin/main`)

| PR | Branche | Taille | Dépend de | Contenu |
|---|---|---|---|---|
| 1 | `feat/popup-hebdo-donnees` | M (~350 l.) | décisions 1-4, 6, 11, 15, 16, 21 | migration complète §1, `scripts/delete-player-account.mjs` (+ `chat_message_reports`), `test/integration/fixtures.ts` (`delete from weekly_popups` avant `weekly_rankings`), types TS |
| 2 | `feat/popup-hebdo-client-llm` | S-M (~450 l.) | décisions 12, 18 (∥ PR 1) | `lib/ai/claudeJson.ts`, `lib/ai/retry.ts`, `usageTracking.ts` (portée du plafond, `meta`, tarif, repli, cumul en mémoire), `schemas.ts`, **`tokens.ts`** (pur : consommé par les PR 3 et 5) |
| 3 | `feat/popup-hebdo-pipeline` | L (~1 200 l.) | PR 1, 2 ; (k) levé | le reste de `lib/weeklyPopup/*`, `lib/push/admins.ts`, étape cron, `maxDuration` (`/api/recaps` et `/admin/competitions`), accroche `freezeWeeklyRanking`, correction de doc sur `sens` |
| 4 | `feat/popup-hebdo-admin` | M-L | PR 3 | page `/admin/popup` et actions, pastille, interrupteur, garde et URL de `runWeeklyRecapSend`, bouton essai |
| 5 | `feat/popup-hebdo-joueur` | M | PR 1 et 2 (∥ PR 3) | watcher, `WeeklyPopupCard`, ordre des popups, `getMyWeeklyPopup`/`markWeeklyPopupSeen`, interrupteur Profil, export RGPD (détokénisé, §1.5), `/confidentialite`, « Mes données », interrupteur e2e |

`WeeklyPopupCard` est créée en PR 5 et importée par l'aperçu admin de la PR 4 :
**la PR 4 vient après les PR 3 et 5**. Enchaînement : 1 ∥ 2, puis 3 ∥ 5, puis
4. Charge totale ≈ 2 500 lignes avec tests.

**Dette connue, dans aucune PR** : décision 16, la purge des `candidates` « à
l'archivage » d'une compétition n'est implémentée nulle part (le code
d'archivage ne touche pas aux tables hebdo) ; à consigner dans
`GAPS_OUVERTS.md` ou à ajouter à la PR 4.

**Tests**

- PR 1 : intégration Docker (trigger `rejected_at`, RLS des deux tables et des
  deux RPC, `delete_account_data` avec un brouillon), écrits, **lancés
  seulement avec l'accord de l'utilisateur** ; aucun test unitaire pertinent.
- PR 2 : unitaires purs avec un faux `create` injecté (le dépôt ne mocke pas
  le SDK) : chaque statut et correspondance d'erreur, timeout, refus avec
  `stop_details`, `max_tokens`, JSON tronqué, clôture de code, Zod, plafond
  fermé et filtre par `call_site`, relances et budget (horloge injectée),
  `getTodaySpendUsd` avec service moqué (patron `freezeWeek.test.ts:13-50`).
- PR 3 : `computeSens`, `flopFamily`, `preselect`, `scanMentions`,
  `validateOutput` (seuils 20 %, 50 %, 180 mots, argent et faux positifs),
  `tokenize`/`detokenize`, `computeFeaturedUserIds`, `recentlyFeatured`,
  `pickFallback`, `mergeVerdicts`, orchestration avec faux client (refus du lot
  puis repli unitaire, lot invalide 3 fois, `cap_reached`, budget, garde
  `generation_id`), `ensureWeeklyPopupDraft` (réservation concurrente, ligne
  périmée, semaine non figée, interrupteurs).
- PR 4 : unitaires des fonctions pures de l'éditeur et des gardes de
  transition (service moqué) ; aucun test de composant n'existe pour ces
  écrans (à signaler).
- PR 5 : `detokenize` à l'affichage ; e2e possible mais Docker : accord.

**Reste manuel** : pousser chaque migration puis `supabase migration list`
après merge (sans la migration, l'étape cron répond 500 avec l'indice et les
inserts `ai_usage_logs` popup échouent) ; vérifier sur la vraie base que
`rejected_at` est rempli (lecture SQL) ; activer `weekly_popup` sur la
compétition réelle ; premier essai payant et premier figement réel du 26/10
avec l'utilisateur. **Aucun appel LLM ni test Docker sans accord explicite.**
Après chaque merge : `ETAT_ACTUEL.md`, `GAPS_OUVERTS.md` (section
« Classement hebdomadaire »), `JOURNAL_SESSIONS.md`.

## 7. Doutes non levés

| Doute | Établi | Non établi | Façon la moins coûteuse de le lever | PR |
|---|---|---|---|---|
| (a) mots-clés de `output_config.format` | le SDK reporte dans `description` tout mot-clé non supporté (`transform-json-schema.ts`) ; aucun texte local ne liste les rejets | acceptation par l'API, combinaison avec effort | **Sans objet en V1** (prompt + Zod). Si besoin : test local de `transformJSONSchema` (gratuit) puis appel réel avec accord | 2 (à documenter) |
| (b) `output_tokens` inclut la réflexion | **Oui** (doc du SDK et `essai_v2`) | — | levé | 2 |
| (c) réflexion adaptative sans outil | **Oui** (19 appels réels) | `between_tools` non utilisé | levé | — |
| (d) schéma et colonne `status` de `ai_usage_logs` | migration `20260907120000`, sans `status` | état réel en production | la PR 1 ajoute les colonnes ; `supabase migration list` / `list_tables` en lecture | 1 |
| (e) classifieur face à un vrai refus | type `stop_details` existe, repli conçu | comportement réel (jamais observé) | accepter (échec fermé, publication manuelle) ; test réel optionnel, sur contenu fictif, avec accord | 3 (logique) |
| (f) règle d'échelle du flop | familles et gabarits relus (§3.4) | — | liste blanche + tests ; bloc NULL à tort = avertissement | 3 |
| (g) champion et désengagement | — | choix produit | décision 2 | — |
| (h) pseudo d'un compte supprimé | — | choix produit | décision 3 (jetons) | 1, 3 |
| (i) périmètre du classifieur | prompt v1 : racisme, discrimination, manipulation | choix produit | décision 5 | — |
| (j) tarif de sonnet-5-5 | les essais ont **supposé** le tarif de sonnet-5 | valeur réelle | console Anthropic (coût du 11/10 rapporté aux tokens de `resultats.json`), gratuit, avant merge | 2 |
| (k) Fluid Compute | plan Hobby, 60 s utilisé ailleurs | Fluid actif ou non | réglages Vercel ou `get_project` en lecture, avant la PR 3 | 3 |
| (l) relations de jointure du libellé de match | `matches.home_team_id`/`away_team_id` + `teams`, `lib/recaps/load.ts:66,108-109` | — | levé | 3 |
| (m) valeur de `seuil` pour « au moins N » | `computeOutcome` compare en `>` strict ; `structured_comparison` n'a que OVER/UNDER | comment le structureur stocke « au moins N » (N ou N-1 en OVER) : change le `seuil` transmis au LLM et donc l'écart | relire le prompt de `structureBet.ts` (gratuit) et trancher la formulation de `sens` et d'écart | 3 |

## 8. Risques

- **Durée Vercel** : 2 appels en série plus relances sur Hobby, peut-être sans
  Fluid. Mitigation : budget, statut `budget`, relance manuelle, `after()`.
- **Migration non poussée** : 500 au cron (message explicite), plafond
  aveugle ; le plafond popup échoue fermé.
- **Coût sous-estimé** : un timeout peut être facturé (compté au pire) ; tarif
  non confirmé.
- **Fuite vers les joueurs** de textes bloqués ou refusés des autres :
  mitigée par la table admin-only et la RPC qui ne renvoie que `content`.
- **Pseudos libres** : faux positifs ou négatifs du contrôle des mentions ;
  tests dédiés.
- **Genre** : règle tenue à environ 75 % par le v5 ; seule la relecture humaine
  la garantit, la publication manuelle reste indispensable tant qu'elle n'est
  pas automatique.
- **Ordre des popups** : régression possible dans `NewBadgesWatcher` ; e2e :
  l'interrupteur `weekly-popup:disabled` est obligatoire.
- **Limite PostgREST de 1 000 lignes** : lectures par bloc avec `limit` ;
  `getTodaySpendUsd` côté structuration reste non paginé (dette existante).
- **Concurrence** (cron et admin, deux admins, ancien worker) : réservation par
  `unique`, `generation_id`, verrou périmé à 10 min.
- **Purge RGPD de `jsonb`** : fonction plus complexe, tests Docker
  indispensables (accord).
- **26/10 (changement d'heure)** : premier figement réel et première popup en
  même temps ; couvert par `recapBoundaryIso` ; prévoir l'essai avant.
- **Identifiant de modèle** : `claude-sonnet-5-5` configurable
  (`POPUP_LLM_MODEL`), `response.model` journalisé.
- **Doc devenue fausse** (cadrage §1 ter, `prompt_redacteur_v5.md`, hypothèse
  du classifieur sur les pseudos) : à corriger dans la PR 3.

## 9. Décisions à prendre par l'utilisateur

Recommandation de l'architect en gras ; rien n'est appliqué tant qu'elles ne
sont pas confirmées. Les décisions 1 à 4, 6, 11, 15, 16 et 21 touchent au schéma
et doivent être prises **avant la PR 1** ; 12 et 18 avant la PR 2.

| # | Sujet | Options | Reco |
|---|---|---|---|
| 1 | Pose de `rejected_at` | (a) trigger en base ; (b) code dans les 2 actions | **(a)** |
| 2 | Champion et refus d'être cité | (a) le refus vaut aussi pour le champion ; (b) champion non filtré | **(a)** |
| 3 | Pseudo d'un compte supprimé | (a) rien ; (b) réécriture SQL ; (c) jetons résolus à l'affichage | **(c)** |
| 4 | Interrupteur « ne pas me citer » au Profil dans le lot 5 | (a) oui, effet rétroactif ; (b) plus tard | **(a)** |
| 5 | Périmètre du classifieur | (a) racisme, discrimination, manipulation ; (b) étendre aux menaces et harcèlement visant un joueur | **(a)** en pré-Cup (publication manuelle) ; revoir si la publication auto revient aux playoffs |
| 6 | Classer le pseudo du champion | oui / non | **oui** (pseudos non modérés) |
| 7 | Bloc NULL alors qu'il a des candidats | avertissement / brouillon douteux | **avertissement** |
| 8 | Un candidat bloqué retire tous les candidats du joueur | oui / non | **oui** |
| 9 | Publication et push | (a) deux gestes, envoi réel refusé tant que non PUBLISHED/SKIPPED, URL `/home` ; (b) un bouton « Publier et envoyer » | **(a)** |
| 10 | Durée maximale | (a) vérifier Fluid puis 300 s ; (b) 60 s, budget, relance manuelle | **vérifier d'abord**, (a) si Fluid actif, sinon (b) |
| 11 | Colonnes de journal sur `ai_usage_logs` | oui / non | **oui** |
| 12 | Tarif de sonnet-5-5 | confirmer en console avant la PR 2 | tarif sonnet-5 « à confirmer » + repli au plus cher en attendant |
| 13 | Bouton « Générer un essai » (semaine en cours, rien d'écrit) | oui / non | **oui** (appel payant, accord à chaque clic) |
| 14 | Qui voit la popup et combien de temps | dernière popup PUBLISHED de la compétition active, < 7 jours, non vue, tout joueur de `(app)` | **oui** |
| 15 | Action « Retirer » une popup publiée | oui / non | **oui** |
| 16 | Conservation de `candidates` (textes bloqués compris) et `raw_output` | `raw_output` effacée à la publication ; `candidates` gardés le temps de la compétition, purgés à l'archivage (à ajouter ou noter en dette), écrit dans `/confidentialite` §5 | **oui** |
| 17 | Remplacer un candidat bloqué par le suivant | oui / non | **non** en V1 |
| 18 | Plafond popup si lecture en erreur | fermé / ouvert | **fermé** |
| 19 | Textes de repli (3 à 5) | à écrire par l'utilisateur ; sans genre, argent ni emoji | — |
| 20 | **Écart avec le cadrage** : génération « assurée » à chaque passage du cron (idempotente) plutôt que seulement sur `frozen: true` | oui / non | **oui** : même déclencheur (le figement), mais auto-réparation ; sans effet si déjà généré |
| 21 | Nouvelle colonne `competitions.weekly_popup` (le cadrage du 11/10 demande un réglage par compétition mais ne nomme pas la colonne) | oui / non | **oui** |

## 9 bis. Décisions prises le 11/10/2026

L'utilisateur a validé **les recommandations de l'architect pour les 21
décisions du §9** (« on garde tout comme ça »), avec ces précisions :

- **Décision 10** : Fluid Compute est actif sur le projet Vercel (confirmé par
  l'utilisateur) : option (a), `maxDuration` 300 s. Le doute (k) est levé.
- **Décision 12** : la console Anthropic n'affichait encore aucun coût le
  11/10. L'utilisateur estime le mouvement observé à environ 0,1 $ pour les
  essais. Tarif retenu **provisoirement** : celui de sonnet-5 (surestimation,
  sans danger pour un coupe-circuit à 1 $/jour), à ajuster quand la console
  affichera le coût réel.
- **Décision 19** : textes de repli validés (5, sans genre, argent ni emoji,
  aucun pseudo ; titre <= 8 mots, cta <= 15 mots) :

| # | Titre | Repli | CTA |
|---|---|---|---|
| 1 | Semaine calme au comptoir | Peu de paris cette semaine, et le classement a fait la sieste. Les prochains matchs ne vont pas se pronostiquer tout seuls. | Passe sur Jouer, les matchs t'attendent. |
| 2 | Le banc était plein | Les pronos ont fait banquette cette semaine. Pas de quoi faire une vanne, et c'est bien le problème. | Un pari perso, une idée farfelue : lance-toi. |
| 3 | Semaine sans histoire | Rien à raconter : peu de paris, aucune légende. La rédaction cherche encore ses vannes. | Remplis ta grille, on se retrouve lundi prochain. |
| 4 | Mi-temps | Vestiaires silencieux cette semaine. Peu de pronos, peu de paris, donc peu de matière. À toi de remettre du sel. | Un pronostic, un pari : fais du bruit. |
| 5 | Temps mort | Temps mort sur le terrain des paris : pas assez de matière pour une vraie revue de presse. Le prochain coup d'envoi est déjà là. | Ouvre l'appli et pronostique avant le coup d'envoi. |

Ces textes sont à recopier tels quels dans `FALLBACK_TEXTS` (PR 3), dans cet
ordre. Le tableau du §9 reste la référence des options écartées.

## 10. Écarts avec le cadrage à corriger (PR 3)

1. §1 ter, ligne « Flop » et `prompt_redacteur_v5.md` « Règles de production
   côté code » : `sens` ne vient pas de `structured_comparison`/
   `structured_negation` en combinant cinq valeurs ; il vient de `OVER`/`UNDER`
   plus `count_relation` et `exact_count` (§3.3). « au plus » n'existe pas en
   production.
2. §1 ter, ligne « Bloc champion » / `prompt_classifieur_v1.md` « Consignes
   côté code » : « pseudo du champion contrôlé à l'inscription » est faux
   (§1.9) ; le champion passe par le classifieur.
3. §2 du cadrage (« Brouillon propre non validé → publié automatiquement le
   lundi ») reste écarté pour la pré-Cup (envoi 100 % manuel, décidé le
   11/10/2026) : publication à la main, état `READY` en attente.
4. §3 point 4 (heure fixe de publication) : sans objet.
