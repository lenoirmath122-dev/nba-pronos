# NBA Pronos — SPEC TECHNIQUE T3 — RLS V0.1

> **Nature** : fichier thématique T3 du découpage acté dans `SPEC_TECHNIQUE_V0.1.md`
> (§4). C'est le chantier sensible : les policies Row Level Security qui décident
> qui voit et qui écrit quoi. Couvre les fonctions `SECURITY DEFINER`, la matrice
> de visibilité (SELECT) et les politiques d'écriture (INSERT/UPDATE/DELETE) table
> par table, les invariants confiés à des triggers, et le **test de l'invariant D4**.
> Ne contient **aucun écran** (→ T6), **aucun moteur de scoring** (→ T5).
>
> **Dépend de** : T1 (modèle, validé), T2 (auth, validé). Réutilise des décisions
> closes : 0.2.1 (visibilité de base, rôles/statuts), 0.2.3 §9 (« valider = voir »,
> verrouillage), 0.2.6 (consommation identique visiteur/joueur après coup), 0.2.7
> (admin, logs privés, ≥ 2 admins), P2 (service_role réservé synchro/seed), P3
> (règle temporelle dans les policies), D4 (vues `security_invoker`), C-5 (invariant
> à tester).
>
> **Statut** : **VALIDÉ** avec l'utilisateur le 18/07/2026. Les 6 points ouverts
> (§10) sont actés ; les points 2 et 3 ont été vérifiés dans les sources (0.2.2 §9
> et 0.2.4 §3/§9) plutôt que supposés. Prochaine étape : la migration #3, montrée
> en entier avant tout `db push`.
>
> **⚠ Remontée vers T2** : la RLS révèle que `competitions.join_code` (migration #2)
> ne peut pas cohabiter avec une table `competitions` lisible publiquement. Corrigé
> au §3, porté par la migration #3. Signalé, pas décidé en douce.

---

## 0. Résumé du chantier T3

```text
1. Le point qui remonte : join_code doit sortir de competitions (secret)   → §3
2. Fonctions SECURITY DEFINER (is_admin, is_active, verrous temporels)      → §2
3. Matrice de VISIBILITÉ (SELECT) table par table                          → §4
4. Politiques d'ÉCRITURE (INSERT/UPDATE/DELETE) table par table            → §5
5. Invariants confiés à des TRIGGERS (pas exprimables en policy)           → §6
6. Vérification C-5 / D4 + plan de test anon/joueur/admin                   → §7
```

Principe directeur (P2 + P13) : **les joueurs et les admins écrivent via des
server actions en session utilisateur** (rôle `authenticated` + JWT), jamais en
`service_role`. La RLS est donc *le* garde-fou de toutes ces écritures. Seuls la
synchro, le heartbeat et les seeds utilisent `service_role` (qui **contourne** la
RLS) — ils n'ont donc pas besoin de policy.

Rien à coder tant que T3 n'est pas validé.

---

## 1. Décisions closes réutilisées (non rouvrables)

| Règle | Contenu | Source |
|---|---|---|
| Consommation après coup | visiteur = joueur pour toute donnée de jeu une fois verrouillé/à la deadline | 0.2.6 §2 |
| « Valider = voir » | avant le coup d'envoi, je vois les pronos validés des autres sur un match **seulement si j'ai validé le mien** | 0.2.3 §4/§9 |
| Verrouillage | = heure de début du match atteinte ; après, tous les pronos non-brouillons deviennent publics (visiteurs inclus) | 0.2.3 §9 |
| Paris | détail nominatif public **à la deadline du pari** | 0.2.4 / 0.2.6 §1 |
| Bracket | tendances/détail publics **après la deadline du bracket** | 0.2.2 / 0.2.6 §4 |
| Données privées | email (absent, D5), ids internes, logs admin : **jamais** exposés aux non-admins | 0.2.1 / 0.2.6 |
| Désactivation | DISABLED ne peut plus saisir/valider, mais ses données et points restent et comptent | 0.2.7 §3 |
| Détection admin | `is_admin()` lit `users.role`, jamais un claim JWT (promotion sans re-login) | arbitrage C |
| ≥ 2 admins | un admin ne traite jamais sa propre requête ; dernier admin non rétrogradable ; pas d'auto-rétrogradation | 0.2.7 §2/§6 |
| Édition admin | agit sur données **officielles** (match/série), jamais sur les prédictions ; correction de prono seulement sur requête | 0.2.7 §4 / 0.2.3 §7 |

---

## 2. Fonctions `SECURITY DEFINER` (socle des policies)

Toutes en `security definer stable set search_path = public`. Le `definer`
**contourne la RLS à l'intérieur de la fonction** → indispensable pour éviter la
**récursion de policy** (une policy sur `users` qui appellerait `is_admin()` qui
lit `users`…) et pour lire des colonnes secrètes (join_code) sans les exposer.

```sql
-- Rôle courant = ADMIN ?
create function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and role = 'ADMIN');
$$;

-- Rôle courant = joueur ACTIVE ? (garde d'écriture, 0.2.7 §3)
create function public.is_active() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and status = 'ACTIVE');
$$;

-- Le match est-il verrouillé (coup d'envoi atteint) ? (P3, 0.2.3 §9)
create function public.match_is_locked(p_match uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from matches m
    where m.id = p_match and m.scheduled_at is not null and m.scheduled_at <= now()
  );
$$;

-- Le joueur courant a-t-il un prono NON-brouillon sur ce match ? (« valider = voir »)
-- Definer = pas de récursion sur match_predictions.
create function public.has_committed_prediction(p_match uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from match_predictions mp
    where mp.match_id = p_match and mp.user_id = auth.uid() and mp.status <> 'DRAFT'
  );
$$;

-- La deadline du bracket de cette compétition est-elle passée ? (0.2.6 §4)
create function public.bracket_deadline_passed(p_competition uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from competitions c
    where c.id = p_competition and c.bracket_deadline is not null and c.bracket_deadline <= now()
  );
$$;

-- Un pari est-il PUBLIC ? = statut public (VALIDATED/WON/LOST) ET deadline passée.
-- Statuts publics confirmés contre 0.2.4 §9 (visible à la deadline avec « difficulté
-- validée » ; un pari SUBMITTED non revu est auto-validé à la deadline, §5 → il est
-- donc VALIDATED au moment où il devient public). SUBMITTED/REJECTED/CANCELLED
-- restent privés (propriétaire + admin).
-- Deadline confirmée contre 0.2.4 §3 : tip-off du match (pari MATCH) ou 1er match
-- de la série (pari SERIES).
create function public.bet_is_public(p_bet uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from bets b
    where b.id = p_bet
      and b.status in ('VALIDATED','WON','LOST')
      and (
        (b.scope = 'MATCH'  and exists (select 1 from matches m
             where m.id = b.match_id and m.scheduled_at is not null and m.scheduled_at <= now()))
        or
        (b.scope = 'SERIES' and (select min(m.scheduled_at) from matches m where m.series_id = b.series_id) <= now())
      )
  );
$$;
```

> Note P3 : la règle temporelle (verrouillage, deadline) vit **dans ces fonctions
> appelées par les policies**, jamais recopiée dans du code applicatif comme source
> de vérité. La base est l'arbitre.

---

## 3. `join_code` : sortir le secret de `competitions` (remontée de T2, actée)

**Problème** : `competitions` doit être **lisible publiquement** (nom, type,
statut, `bracket_deadline` alimentent les écrans publics). Or la RLS filtre des
**lignes, pas des colonnes** : rendre la table publique exposerait `join_code`.
Un `revoke select(join_code)` ne résout rien, car les rôles DB sont `anon` /
`authenticated` — il ne distingue pas admin de joueur, alors que l'admin doit
**voir** le code (pour le partager) et le joueur non.

**Correction (migration #3)** : déplacer le code dans une table dédiée, lisible
**admin seulement**. Base neuve → aucune donnée à migrer.

```sql
create table competition_secrets (
  competition_id uuid primary key references competitions(id) on delete cascade,
  join_code text not null
);

-- Reprise du contenu (aucune ligne en base neuve, mais on garde le geste correct) :
insert into competition_secrets (competition_id, join_code)
  select id, join_code from competitions;

alter table competitions drop column join_code;

-- verify_join_code lit désormais competition_secrets (toujours en definer, jamais exposé) :
create or replace function public.verify_join_code(p_code text) returns uuid
language sql security definer stable set search_path = public as $$
  select cs.competition_id
  from competition_secrets cs
  join competitions c on c.id = cs.competition_id
  where c.status = 'ACTIVE'
    and lower(trim(cs.join_code)) = lower(trim(p_code))
  limit 1;
$$;
```

Policies de `competition_secrets` : **SELECT admin uniquement**, écriture admin
(création/rotation du code à la création de compétition). Aucun accès anon/joueur.

> C'est la seule chose que T3 fait remonter vers T2. Le reste de T2 est intact.

---

## 4. Matrice de VISIBILITÉ (policies SELECT)

RLS activée sur **toutes** les tables (`alter table … enable row level security`).
Rappel : `anon` et `authenticated` doivent avoir le `GRANT SELECT` (Supabase le
pose par défaut) ; la RLS filtre ensuite. Les vues sont en `security_invoker`
(D4) → elles héritent de ces policies.

| Table | Qui peut SELECT | Expression `using (...)` |
|---|---|---|
| `users` | **tout le monde** | `true` — plus aucune colonne secrète (email retiré en D5) ; pseudo/avatar/équipe/bio/role/statut sont publics (0.2.1 §4, 0.2.7 §3) |
| `teams` | tout le monde | `true` (référentiel public) |
| `competitions` | tout le monde | `true` (le secret est parti en `competition_secrets`, §3) |
| `competition_secrets` | admin | `is_admin()` |
| `series` | tout le monde | `true` (bracket/résultats publics, 0.2.2) |
| `matches` | tout le monde | `true` |
| `entity_mappings` | admin | `is_admin()` (ids internes privés, 0.2.1) |
| `brackets` | propriétaire, admin, ou après deadline | `user_id = auth.uid() or is_admin() or bracket_deadline_passed(competition_id)` |
| `bracket_picks` | idem via le bracket | `exists(bracket b: b.id=bracket_id and b.user_id=auth.uid()) or is_admin() or bracket_deadline_passed(competition_id)` |

> **Pas de « valider = voir » sur le bracket** (vérifié contre 0.2.2 §9/§3, acté) :
> contrairement aux pronos match, le bracket reste modifiable jusqu'à la deadline
> même après validation — valider ne fige rien, donc n'ouvre pas la vue des autres.
> Les brackets d'autrui sont cachés jusqu'à la deadline, point. Après la deadline,
> la RLS autorise la lecture des `bracket_picks` ; l'affichage public en **tendances
> agrégées** (%) vs détail nominatif au clic (0.2.2 §10, seuil 0.2.6 §4) est une
> couche d'écran au-dessus (T6), pas une affaire de RLS.
| `match_predictions` | **la règle « valider = voir »** | voir bloc ci-dessous |
| `bets` | propriétaire, admin, ou pari public | `user_id = auth.uid() or is_admin() or bet_is_public(id)` |
| `correction_requests` | auteur ou admin | `requester_user_id = auth.uid() or is_admin()` |
| `audit_logs` | admin | `is_admin()` (log interne privé, 0.2.7 §8) |
| `sync_logs` | admin | `is_admin()` |
| `competition_archives` | tout le monde | `true` (classement final public) |

**`match_predictions` — SELECT (le cœur de T3, 0.2.3 §9)** :

```sql
create policy match_predictions_select on match_predictions for select using (
  user_id = auth.uid()                       -- je vois toujours les miens (tout statut)
  or is_admin()
  or (
    status <> 'DRAFT'                        -- jamais les brouillons d'autrui
    and (
      match_is_locked(match_id)              -- après le coup d'envoi : public (visiteurs inclus)
      or has_committed_prediction(match_id)  -- avant : seulement si J'AI validé le mien
    )
  )
);
```

Déroulé par acteur, pour ce SELECT :
```text
- Visiteur anon : auth.uid() NULL → seule la branche « match verrouillé » joue.
  Il voit les pronos non-brouillons des matchs commencés. ✔ (0.2.6 §2)
- Joueur : voit les siens ; voit ceux des autres sur un match soit verrouillé,
  soit sur lequel il a lui-même validé (valider = voir). ✔
- Admin : tout. ✔
```

---

## 5. Politiques d'ÉCRITURE (INSERT / UPDATE / DELETE)

Principe : la RLS pose les gardes **grossières** (propriété, statut ACTIVE, rôle,
verrou temporel, machine à états simple) ; les **invariants fins** (dernier admin,
non-auto-rétrogradation, admin jamais sur son propre prono, irréversibilité
complète) sont confiés à des **triggers** (§6), car non exprimables proprement en
policy.

| Table | INSERT | UPDATE | DELETE |
|---|---|---|---|
| `users` | ✗ (créé par le trigger `handle_new_user`, definer, T2) | self : `id=auth.uid()` (profil) ; admin : `is_admin()` (rôle/statut) — champs sensibles gardés par trigger §6 | ✗ (rétention) |
| `teams` / `series` / `matches` | synchro `service_role` (bypass) | admin : `is_admin()` (données officielles, 0.2.7 §4) | ✗ |
| `competition_secrets` | admin | admin | admin (rotation) |
| `competitions` | admin | admin | ✗ |
| `entity_mappings` | synchro `service_role` | admin (confirmation) | ✗ |
| `brackets` | self actif avant deadline | self avant deadline **et** `not is_validated` | ✗ (acté) |
| `bracket_picks` | self via bracket, avant deadline, bracket non validé | idem | ✗ (acté) |
| `match_predictions` | self actif, match non verrouillé | self : `status='DRAFT'` (irréversibilité) ; admin : sur requête (trigger §6) | ✗ (acté) |
| `bets` | self actif, avant deadline, dans quota (index T1) | self avant validation ; admin : validation/résolution | ✗ (acté) |
| `correction_requests` | self actif | admin **et** `requester_user_id <> auth.uid()` (≥ 2 admins) | ✗ |
| `audit_logs` | `is_admin()` (actor=auth.uid() ou système) | ✗ | ✗ (append-only) |
| `sync_logs` | synchro `service_role` | ✗ | ✗ |
| `competition_archives` | admin/`service_role` (clôture) | ✗ | ✗ |

Exemples de policies d'écriture parlantes :

```sql
-- match_predictions : saisie/édition d'un brouillon, joueur actif, match non verrouillé.
create policy mp_insert on match_predictions for insert with check (
  user_id = auth.uid() and is_active() and not match_is_locked(match_id)
);
create policy mp_update_self on match_predictions for update using (
  user_id = auth.uid() and is_active() and status = 'DRAFT' and not match_is_locked(match_id)
) with check (user_id = auth.uid());
-- L'irréversibilité (pas d'édition une fois VALIDATED) tombe du « status='DRAFT' ».

-- correction_requests : un admin ne traite jamais sa propre requête (0.2.7 §2).
create policy cr_update_admin on correction_requests for update using (
  is_admin() and requester_user_id <> auth.uid()
);
```

> **DELETE (point 4, acté)** : aucun DELETE joueur nulle part (rétention D2). Pas
> de « dé-brouillonner » par suppression. En revanche, un brouillon reste
> **modifiable à volonté** tant que `status='DRAFT'` et le match/pari non verrouillé
> (`mp_update_self`) : le joueur écrase son brouillon autant qu'il veut, il ne le
> supprime jamais.

> La transition DRAFT→VALIDATED (validation volontaire) et l'auto-validation à la
> deadline sont des écritures faites **par le joueur (server action)** ou **par le
> système**. La policy `mp_update_self` autorise le passage tant que `status='DRAFT'` ;
> le trigger §6 verrouille les transitions illégales (ex. VALIDATED→DRAFT).

---

## 6. Invariants confiés à des TRIGGERS (pas exprimables en policy)

```text
T-a  users : un non-admin ne peut pas modifier role NI status (anti-escalade).
             Un admin ne peut pas se rétrograder lui-même, ni rétrograder/désactiver
             le DERNIER admin actif (0.2.7 §2). → trigger BEFORE UPDATE on users.
T-b  match_predictions / bets : machine à états stricte (transitions autorisées
             seulement). Ex. pas de VALIDATED→DRAFT ; pas de résolution d'un pari
             non validé. → trigger BEFORE UPDATE.
T-c  match_predictions : une correction admin exige (i) une requête TRAITÉE liée,
             (ii) l'admin ≠ auteur du prono (0.2.3 §7). → trigger BEFORE UPDATE.
T-d  points : refus de toute valeur de points < 0 (P6, déjà en CHECK T1 — le trigger
             n'est pas requis ; le CHECK suffit). Rappel, pas un nouveau trigger.
```

> Répartition : **RLS = qui a le droit d'agir** ; **trigger = l'action reste
> cohérente** ; **server action = orchestration** (T6). Les triggers T-a/T-b/T-c
> seront spécifiés au niveau SQL dans la migration #3 après validation de ce cadre.

---

## 7. Vérification de l'invariant D4 / C-5

C-5 demande de **prouver** que « tout point n'existe que sur une ligne déjà
publique », afin que les vues `security_invoker` donnent le bon total à un visiteur.

**Table par table** (le point ≠ 0 n'apparaît qu'après un événement qui a rendu la
ligne publique — donc anon la voit) :

```text
match_predictions : point ≠ 0 ⇒ match FINISHED ⇒ scheduled_at ≤ now()
                    ⇒ match_is_locked ⇒ SELECT anon OK (status ≠ DRAFT). ✔
bracket_picks     : point ≠ 0 ⇒ série résolue ⇒ après bracket_deadline
                    ⇒ bracket_deadline_passed ⇒ SELECT anon OK. ✔
bets              : point ≠ 0 ⇒ pari WON/LOST ⇒ deadline passée + statut public
                    ⇒ bet_is_public ⇒ SELECT anon OK. ✔
```

Aucune table ne casse l'invariant : **toute ligne porteuse de points est visible
de l'anon**. Donc la somme via `user_scores` (invoker) est identique pour un
visiteur et pour un admin — les lignes cachées valent toutes 0 (T1 §6.1).

**Plan de test de la migration #3** (à jouer dans le SQL Editor / via 3 rôles) :

```text
1. anon : lit user_scores et match_predictions d'un match NON commencé
   → ne voit AUCUN brouillon d'autrui ; total public correct.
2. joueur A (n'a pas validé) vs joueur B (a validé) sur un match non verrouillé
   → A ne voit pas les pronos de B ; B voit ceux de A validés. (valider = voir)
3. après avoir avancé scheduled_at dans le passé (simuler le verrouillage)
   → anon voit les pronos non-brouillons. Total inchangé.
4. anon : SELECT competition_secrets → 0 ligne (refus). SELECT sur join_code
   → colonne inexistante sur competitions. (le code ne fuit pas)
5. joueur : UPDATE users SET role='ADMIN' WHERE id=auth.uid() → refusé (trigger T-a).
6. joueur : UPDATE d'un prono VALIDATED → refusé (policy status='DRAFT').
7. admin : traite sa PROPRE requête de correction → refusé (policy cr_update_admin).
```

> Ce plan est la contrepartie concrète du « on pourra enfin tester » : chaque
> ligne est un test que la base doit refuser/autoriser d'elle-même.

---

## 8. Ce que T3 ne dit pas

```text
- Le moteur de scoring idempotent (qui écrit les points)          → T5.
- Les server actions et écrans (saisie, files admin, wording)     → T6.
- Les routes de synchro/heartbeat (service_role, bypass RLS)      → T4/B.
- Le rendu du marquage public « corrigé par admin »               → T6 (attribut,
  pas log ; le log d'audit reste privé, 0.2.7 §8).
```

---

## 9. Ordre de la migration #3

```text
1. Correctif join_code (§3) : create competition_secrets, copy, drop column,
   replace verify_join_code.
2. Fonctions SECURITY DEFINER (§2) : is_admin, is_active, match_is_locked,
   has_committed_prediction, bracket_deadline_passed, bet_is_public.
3. enable row level security sur TOUTES les tables publiques.
4. Policies SELECT (§4), table par table.
5. Policies INSERT/UPDATE/DELETE (§5), table par table.
6. Triggers d'invariants (§6) : T-a (users), T-b (états), T-c (correction).
7. (Vérif manuelle : le plan de test §7.)
```

> Montrée en entier avant tout `db push`. Sur une base neuve, `enable RLS` +
> policies n'ont aucune donnée à casser.

---

## 10. Décisions actées à la validation de T3 (18/07/2026)

```text
1. [REMONTÉE T2] join_code sort de competitions vers competition_secrets (lisible
   admin seulement), verify_join_code réécrite (§3). Porté par la migration #3. ACTÉ.

2. [VISIBILITÉ BRACKET] Vérifié contre 0.2.2 §9/§3 : PAS de « valider = voir » sur
   le bracket (valider ne fige rien, le bracket reste modifiable jusqu'à la
   deadline). Brackets d'autrui cachés jusqu'à la deadline, point. ACTÉ.

3. [DEADLINE PARI SÉRIE] Vérifié contre 0.2.4 §3/§9 : pari SÉRIE verrouillé/public
   au tip-off du 1er match de la série ; pari MATCH au tip-off du match visé.
   Statuts publics = VALIDATED/WON/LOST. bet_is_public correct tel quel. ACTÉ.

4. [DELETE] Aucun DELETE joueur (rétention D2). Pas de suppression de brouillon ;
   le brouillon est modifiable à volonté tant que DRAFT + non verrouillé. ACTÉ.

5. [RÉPARTITION] RLS (gardes grossières) / triggers (invariants fins §6) / server
   actions (orchestration). Machine à états des pronos/paris en trigger. ACTÉ.

6. [users world-readable] role et status lisibles publiquement (aucun secret) —
   ce qui rend la vue de classement possible en security_invoker. ACTÉ.
```

---

## 11. Correctif post-validation (23/07/2026) — visibilité universelle du classement

**Constat** (trouvé en testant l'écran Classement avec un vrai jeu de données,
pas seulement `tsc`/`eslint`/`next build`) : l'invariant D4/C-5 (§7) garantit que
la **valeur** d'un point visible est toujours juste, mais ne garantit PAS que le
**rang lui-même apparaisse** avant tout verrouillage de match — avant qu'un
match ne se verrouille, un joueur normal ne voit au classement QUE les lignes
avec qui il a une visibilité mutuelle (« valider = voir », par match). Un admin
voit tout ; un joueur normal peut se retrouver seul à son propre classement.

**Décision** : le classement (rang, points, badge « corrigé ») doit être visible
de TOUT LE MONDE en permanence, indépendamment de la confidentialité au cas par
cas des pronos/paris/picks (0.2.3 §9, INCHANGÉE). `user_scores` et
`user_recent_form` passent en `security_invoker = false` (migration #5) : elles
ne renvoient que des agrégats, jamais une ligne individuelle, donc aucune fuite
de détail. `admin_corrections_count` est en même temps intégré à `user_scores`
(auparavant 2 requêtes applicatives séparées, encore RLS-gatées après le
changement de sécurité des vues seul).

Ne rouvre pas la confidentialité par match (§4) : seule l'agrégation devient
publique, pas le détail qui l'alimente.

**T3 est VALIDÉ et figé.** Prochaine étape : la **migration #3** (correctif
join_code + fonctions SECURITY DEFINER + enable RLS + policies + triggers),
montrée en entier avant tout `db push`, puis le **plan de test §7** joué pour la
première vraie vérification de sécurité de bout en bout. Ensuite : T4 (synchro
API) et T5 (scoring), puis T6 (écrans).

## 12. Correctif post-audit (28/07/2026) — fonctions `SECURITY DEFINER` ajoutées après T3, rétro-actées

**Constat** (audit structurel du 28/07/2026, `GAPS_OUVERTS.md`) : après la
validation de T3 (18/07/2026) et son unique correctif tracé (§11,
23/07/2026), l'implémentation des écrans joueur a ajouté 4 fonctions
`SECURITY DEFINER` supplémentaires, chacune motivée et commentée dans sa
propre migration, mais jamais actée ici — un écart de PROCESS de cadrage
(la spec RLS n'était plus à jour avec la surface `SECURITY DEFINER` réelle
du projet), pas un écart de sécurité (aucune n'élargit une visibilité audelà
de ce que sa policy propre justifie, chacune contourne la RLS pour UNE
écriture précise et documentée, jamais pour une lecture).

Rétro-actées ici, par ordre chronologique :

```text
- count_committed_predictions(p_match)  — migration #6 (24/07/2026)
  Lecture seule : renvoie un ENTIER (compte de joueurs ACTIVE ayant commité
  un prono sur CE match), jamais une ligne. Même principe que
  has_committed_prediction() déjà actée en §2 — un simple comptage ne peut
  pas fuiter le contenu d'un prono individuel. Motivé par le même piège que
  D4/§11 (un COUNT() en session joueur sous-compte tant que l'appelant n'a
  pas lui-même validé sur CE match précis), mais PAR MATCH plutôt que
  globalement au classement.

- request_prediction_correction()  — migration #7 (24/07/2026)
  Écriture, voie A (0.2.3 §10.2) : crée une ligne match_predictions VIDE
  (DRAFT, aucun champ de contenu) si aucune n'existe encore pour
  (auth.uid(), match), puis pose la correction_requests liée — dans une
  seule transaction. Garde-fous : auth.uid() uniquement, joueur ACTIVE,
  match effectivement verrouillé, réutilisation si une ligne existe déjà
  (jamais de doublon), une seule requête PENDING à la fois. N'écrit JAMAIS
  de contenu de pronostic (P10) — seule fonction de ce groupe qui contourne
  une policy d'INSERT plutôt qu'une simple lecture agrégée.

- save_bet() / withdraw_bet()  — migration #10 (26/07/2026)
  Écriture des paris joueur. Justification structurante (pas un simple
  contournement de confort) : le cap « 3 paris MATCH par série » n'a aucun
  backstop d'index unique possible (contrairement aux 2 quotas « 1 pari
  actif », eux bien couverts par un index unique partiel) — seule une
  fonction SECURITY DEFINER peut fermer la fenêtre de course via un
  pg_advisory_xact_lock. Patron repris de request_prediction_correction.

- request_bet_correction()  — migrations #11/#12 (27/07/2026, #12 = correctif
  d'une colonne mal nommée dans #11, même jour)
  Écriture, même patron que request_prediction_correction() mais pour un
  pari VALIDATED jamais résolu (ne couvre PAS un refus ou une résolution
  déjà posée — enforce_bet_transitions traite REJECTED/WON/LOST comme des
  états terminaux, voir GAPS_OUVERTS.md).
```

**Aucune policy RLS existante n'est modifiée par ces 4 fonctions** — elles
s'ajoutent au socle §2, ne le remplacent pas. Chacune reste documentée en
premier lieu dans sa propre migration (justification, garde-fous) ; cette
section n'ajoute qu'un renvoi centralisé, pour que la liste des fonctions
`SECURITY DEFINER` du projet reste visible à un seul endroit sans avoir à
parcourir 12 fichiers de migration.

**T3 reste VALIDÉ et figé** — ce §12 est un rattrapage documentaire, pas une
réouverture de décision.
