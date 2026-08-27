# SPEC — Chat / couche sociale in-app — V0.1

Fichier : `Cadrage/Proto/SPEC_CHAT_V0_1.md`
Motif : `BACKLOG_V1.md` § « Communication entre joueurs » — chat ajouté au
backlog le 27/08/2026, jusqu'ici "jugé utile, pas cadré ni codé"
(`GAPS_OUVERTS.md`, bloc du 16-18/08/2026). Gros morceau (nouvelle table,
RLS, temps réel, nouvel écran, impact sur la nav principale) → vrai cadrage
avant code, même patron que les ligues (30/07/2026) ou les badges permanents.

## 1. Décisions actées AVEC l'utilisateur (27/08/2026)

- **Portée : les deux.** Un canal **Général**, permanent, ouvert à tout
  joueur ACTIF (même esprit que le classement général) — ET un canal **par
  ligue** (réutilise le système de ligues existant, migration #16 :
  `leagues`/`league_memberships`, appartenance multiple, rejoint par code).
  Pas de nouvelle notion de "salon" à créer : le canal ligue est 1:1 avec
  une ligue existante, pas d'entité séparée.
- **Emplacement : page dédiée.** Une page `/chat` avec, à l'intérieur, la
  liste des canaux accessibles — **Général toujours affiché en premier**,
  puis un canal par ligue dont le joueur est membre, sélectionnable pour
  afficher ses messages. Réutilise tel quel le patron **`LeagueScopeChips`**
  déjà en place sur Classement/Bracket/Mes pronos/Profil (chip "Général" +
  une chip par ligue, `?ligue=<id>` dans l'URL, n'apparaît que si le joueur
  a au moins une ligue) — même composant visuel, adapté au chat plutôt qu'à
  un filtre de classement.
- **Modération : admin.** Un admin (`public.is_admin()`, déjà utilisé
  partout ailleurs dans le projet) peut supprimer n'importe quel message,
  dans n'importe quel canal. **Pas** de suppression/édition par l'auteur
  lui-même (option écartée par l'utilisateur au profit de la modération
  admin) — un message posté est donc immuable jusqu'à suppression admin.
- **Temps réel : oui**, via Supabase Realtime — brique déjà utilisée dans
  le projet (`LiveSubscriber.tsx`, `LiveSeriesSubscriber.tsx`), donc aucune
  dépendance technique nouvelle, seulement un nouveau canal d'écoute.

### Accès : 5ᵉ onglet dans la barre de nav (confirmé 27/08/2026)

La nav authentifiée (`TabBar.tsx`) est une barre **fixe à 4 onglets**
(Accueil · Jouer · Classement · Profil, spec T6a §3.1), commune à tous les
écrans connectés (`ScreenShell.tsx`). Confirmé avec l'utilisateur : Chat
devient un **5ᵉ onglet** dans cette barre (plutôt qu'un lien depuis
Accueil qui aurait laissé la barre à 4) — assumé plus dense sur mobile,
mais le plus visible et cohérent avec la demande initiale d'« onglet
dédié ».

## 2. Hors scope (V0.1, explicite)

- Pas d'édition ni de suppression par l'auteur (cf. décision modération).
- Pas de réactions/emoji, pas de mentions `@joueur`, pas de pièces jointes.
- Pas de chat privé 1-à-1 — uniquement Général + ligues.
- Pas de badge "messages non lus" dans la nav (chevauche l'idée séparée
  "notifications/popup à la connexion", déjà notée à part dans
  `GAPS_OUVERTS.md` — pas traitée ici).
- Pas de pagination/scroll infini : la page charge les **200 derniers
  messages** du canal actif (au-delà, l'historique plus ancien n'est
  simplement pas affiché). Simplification assumée pour un groupe d'amis —
  à complexifier seulement si un vrai besoin apparaît en usage réel.
- Longueur d'un message : 2000 caractères max (contrainte DB), pas de
  minimum autre que non-vide après `trim`.

## 3. Modèle de données

Une seule table neuve, aucune existante modifiée — même philosophie que
la migration ligues (30/07/2026) : pur ajout.

```sql
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('GLOBAL', 'LEAGUE')),
  league_id uuid references leagues(id) on delete cascade,
  user_id uuid not null references users(id),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint chat_messages_scope_consistency check (
    (scope_type = 'GLOBAL' and league_id is null)
    or (scope_type = 'LEAGUE' and league_id is not null)
  )
);

create index idx_chat_messages_global
  on chat_messages (created_at desc) where scope_type = 'GLOBAL';
create index idx_chat_messages_league
  on chat_messages (league_id, created_at desc) where scope_type = 'LEAGUE';
```

### RLS

```sql
alter table chat_messages enable row level security;

-- Lecture : Général ouvert à tout joueur authentifié ; canal ligue réservé
-- aux membres ; admin voit tout (même patron que brackets_select / bets_select).
-- Réutilise my_league_ids() (migration #17, correctif récursion RLS) plutôt
-- qu'un EXISTS direct sur league_memberships — league_memberships_select a
-- déjà mordu une fois sur la récursion RLS (sous-requête sur sa propre
-- table), my_league_ids() (SECURITY DEFINER) est le patron déjà validé pour
-- toute AUTRE table qui a besoin "des ligues de l'utilisateur courant".
create policy chat_messages_select on chat_messages for select using (
  scope_type = 'GLOBAL'
  or public.is_admin()
  or league_id in (select public.my_league_ids())
);

-- Écriture : l'auteur est toujours soi-même, compte ACTIVE, et membre de
-- la ligue ciblée si scope_type = 'LEAGUE' (même garde que
-- chat_messages_select, dupliquée côté insert — impossible de poster dans
-- une ligue dont on n'est pas membre même en forgeant la requête).
create policy chat_messages_insert on chat_messages for insert with check (
  user_id = auth.uid()
  and public.is_active()
  and (
    scope_type = 'GLOBAL'
    or league_id in (select public.my_league_ids())
  )
);

-- Suppression : admin uniquement (décision actée : pas de self-delete).
create policy chat_messages_delete_admin on chat_messages for delete using (
  public.is_admin()
);

-- Pas de policy update : un message posté est immuable.
```

Table ajoutée à la publication Realtime (`supabase_realtime`) pour les
événements INSERT/DELETE.

## 4. Temps réel — mécanisme ET point de vérification sécurité

Même patron que `LiveSubscriber.tsx` : un composant client unique
(`ChatSubscriber`) ouvre un canal Realtime `postgres_changes` sur
`chat_messages`, filtré côté serveur Realtime (`filter:
league_id=eq.<id>` pour un canal ligue, aucun filtre pour Général — les
lignes `GLOBAL` seules remontent par construction de la table).

**Point à vérifier explicitement pendant le dev, pas supposé acquis** :
c'est documenté comme acquis dans ce projet (« la RLS s'applique
nativement au canal Realtime », A9/T4 §9, cf. commentaire de
`20260724110000_realtime_matches.sql`), mais jamais réellement mis à
l'épreuve — les 2 tables déjà branchées sur Realtime (`matches`, `series`)
sont toutes les deux `using (true)`, donc rien n'a encore filtré quoi que
ce soit en pratique. `chat_messages` sera le premier test réel d'une
policy restrictive sur le canal Realtime. **Test explicite avant de
considérer le chantier fini** :
un joueur non membre d'une ligue ne doit recevoir AUCUN événement Realtime
pour les messages de cette ligue, même en écoutant le canal Realtime brut
sans passer par l'UI (vérification à la Playwright/console, pas juste "je
ne vois rien dans l'UI").

## 5. Écrans / composants

- **Route** : `app/(app)/chat/page.tsx`, lit `?ligue=<id>` (comme
  `/leaderboard`), résout la portée via `resolveLeagueScope()`
  (`lib/queries/leagues.ts`, déjà existant) — retombe silencieusement sur
  Général si l'id est invalide ou si le joueur n'est plus membre, même
  garantie que l'usage actuel.
- **Chips de canal** : composant `ChatScopeChips`, même patron visuel que
  `LeagueScopeChips` (`components/leaderboard/LeagueScopeChips.tsx`),
  alimenté par `getMyLeagues()` (déjà existant, aucune requête neuve à
  écrire pour la liste des ligues).
- **Liste de messages** : composant serveur pour le rendu initial (SSR,
  200 derniers messages du canal actif) + `ChatSubscriber` (client) pour
  les messages entrants en direct — même séparation Provider/consommateur
  que `LiveSubscriber`/`LiveBadgeAndScore`.
- **Formulaire d'envoi** : Server Action `postChatMessageFormAction`
  (`lib/actions/chat.ts`, même patron que `togglePinnedBadgeFormAction`) —
  insert via le client serveur scopé à la session (RLS seule autorité,
  jamais de `service_role` ici). Pas d'optimistic UI : le message revient
  par Realtime après confirmation DB, latence Realtime habituelle
  (<1s) jugée suffisante pour un chat entre amis.
- **Suppression admin** : bouton visible uniquement si `is_admin()` sur
  chaque message, Server Action `deleteChatMessageFormAction` (delete
  direct, RLS `chat_messages_delete_admin` comme seule garde). **Retrait
  local uniquement** (callback qui filtre l'état du `ChatSubscriber` côté
  admin qui supprime) — PAS de diffusion Realtime de la suppression aux
  autres joueurs connectés : un DELETE ne porte par défaut que la clé
  primaire (`REPLICA IDENTITY` par défaut), insuffisant pour que Postgres
  réévalue `chat_messages_select` dessus, donc pour que Realtime sache à
  qui le diffuser sans `REPLICA IDENTITY FULL` — mécanisme jamais éprouvé
  dans ce projet (seul `UPDATE` est utilisé ailleurs, `LiveSubscriber`).
  Écarté pour rester sur des briques déjà validées : un message supprimé
  disparaît pour les autres à leur prochain chargement de `/chat`, pas
  instantanément. Simplification assumée, pas un oubli.
- **Icône de nav** : un 5ᵉ tracé à ajouter à `components/icons/nav-icons.tsx`
  dans le même style "nette" (trait 1.8, `currentColor`) que les 4
  existantes — pas un import brut d'une icon library tierce, pour rester
  cohérent avec le jeu d'icônes déjà en place.

## 6. Plan d'implémentation (ordre)

1. Migration `chat_messages` + RLS + publication Realtime.
2. `lib/queries/chat.ts` (lecture des 200 derniers messages d'un canal).
3. `lib/actions/chat.ts` (poster / supprimer).
4. `ChatScopeChips` (adaptation de `LeagueScopeChips`).
5. `ChatSubscriber` + liste de messages + formulaire, `app/(app)/chat/page.tsx`.
6. Icône + entrée dans `TabBar.tsx` (**après confirmation du point ouvert
   §1**).
7. Vérification réelle : poster depuis 2 sessions différentes (Général),
   vérifier la réception temps réel des deux côtés ; vérifier qu'un
   message posté dans une ligue n'apparaît QUE pour ses membres (UI **et**
   canal Realtime brut, cf. §4) ; suppression admin visible/fonctionnelle
   uniquement pour un compte admin ; `tsc`/`vitest`/`next build` propres.
8. Journalisation (`JOURNAL_SESSIONS.md`, `ETAT_ACTUEL.md`) + retrait de
   l'entrée `GAPS_OUVERTS.md`.
