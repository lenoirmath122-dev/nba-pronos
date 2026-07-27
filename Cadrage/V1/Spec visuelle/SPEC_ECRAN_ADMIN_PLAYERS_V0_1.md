# NBA Pronos — SPEC ÉCRAN GESTION DES JOUEURS (ADMIN) V0.1

> **Statut : VALIDÉ (27/07/2026).** Troisième écran du lot Admin, après le
> tableau de bord et la file de validation. Choisi car — comme la
> validation — `setPlayerRole`/`setPlayerStatus` sont catégorie B **sans
> recompute** (T6a §5.3) : aucune dépendance sur le moteur de scoring T5,
> toujours absent.
>
> Périmètre STRICT : `app/(admin)/admin/players/page.tsx` — liste + actions
> contextuelles. PAS les autres files (résolution, requêtes, logs).

---

## 0. Sources et cadre

```text
Règles : nba_pronos_decisions_0_2_7_administration.md §2/§3 (promotion/
  rétrogradation, pas d'auto-rétrogradation, dernier admin non
  rétrogradable, DISABLED conserve tout) ; nba_pronos_decisions_0_2_9_ux_ui.md
  §8 (actions contextuelles par ligne, garde-fous VISIBLES dans l'UI).
Architecture : SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_b.md §5 — setPlayerRole
  /setPlayerStatus, catégorie B SANS recompute, session admin (RLS
  users_update_admin = is_admin()).
GARDE-FOUS DÉJÀ EN BASE, pas à réécrire (trouvé au pré-vol, migration #3
  corrigée #4, fonction enforce_users_invariants, trigger
  trg_users_invariants before update on users) :
  - seul un admin peut modifier role/status (redondant avec la RLS, mais
    posé aussi en trigger — défense en profondeur) ;
  - un admin ne peut PAS se rétrograder lui-même (auth.uid() = old.id) ;
  - le dernier admin ACTIF ne peut être ni rétrogradé ni désactivé (compte
    les AUTRES admins actifs, exception si 0) ;
  - contexte système (auth.uid() NULL) laissé passer sans garde (seed,
    service_role) — sans effet ici, cet écran n'utilise QUE getServerClient.
CONSÉQUENCE : la couche d'écriture de ce lot est une UPDATE directe sur
  `users`, AUCUNE fonction SQL SECURITY DEFINER, AUCUNE migration — les
  messages d'erreur du trigger sont déjà rédigés pour un lecteur humain,
  remontés TELS QUELS (même patron que requestBetCorrection,
  lib/actions/bet-corrections.ts).
```

---

## 1. Architecture

```text
app/(admin)/admin/players/page.tsx → composant serveur, lib/queries/
  admin-players.ts. AUCUN "use client" : chaque action est un <form> natif
  indépendant par bouton.
lib/actions/admin-players.ts → setPlayerRole/setPlayerStatus + variantes
  FormData, session admin (getServerClient), journalisées via
  lib/actions/audit.ts (partagé, déjà créé au lot précédent).
```

---

## 2. Contenu de la liste — **acté (0.2.9 §8)**

```text
Une ligne par joueur : pseudo, badge rôle (PLAYER/ADMIN), badge statut
  (ACTIF/DÉSACTIVÉ).

Tri : ADMIN d'abord, puis PLAYER, alphabétique par pseudo dans chaque
  groupe — interprétation d'implémentation (pas fixée par 0.2.9), lisible
  pour repérer vite qui a des droits élevés.

Actions contextuelles par ligne, reflétant EXACTEMENT ce que le trigger
  autorise (pas plus, pas moins) :
  - PLAYER actif   : [Promouvoir admin] [Désactiver]
  - PLAYER désactivé : [Promouvoir admin] [Réactiver]
  - ADMIN actif    : [Rétrograder joueur] [Désactiver]
  - ADMIN désactivé  : [Rétrograder joueur] [Réactiver]

Garde-fous VISIBLES (0.2.9 §8), calculés en LECTURE pour griser plutôt que
  laisser échouer en silence (le trigger reste l'AUTORITÉ, l'UI ne fait que
  refléter) :
  - sur SA PROPRE ligne (userId = auth.uid()) : bouton "Rétrograder" toujours
    DÉSACTIVÉ (grisé, libellé « Toi-même »).
  - sur le DERNIER admin actif (role=ADMIN, status=ACTIF, aucun AUTRE admin
    actif) : "Rétrograder" ET "Désactiver" DÉSACTIVÉS (libellé « Dernier
    admin actif »).
  Auto-désactivation (rester ADMIN mais se désactiver soi-même, PAS un
  rétrogradation) : lecture littérale du trigger — PAS bloquée si l'admin
  n'est pas le dernier actif (le trigger ne l'interdit que via la garde
  "dernier admin", jamais explicitement pour "soi-même"). Comportement
  inhabituel mais réversible (un autre admin peut réactiver), reflété tel
  quel plutôt que d'inventer une garde supplémentaire non demandée.
```

---

## 3. Écriture — `lib/actions/admin-players.ts`

```ts
export type ActionResult = { success: true } | { success: false; error: string };

export async function setPlayerRole(input: { userId: string; role: "PLAYER" | "ADMIN" }): Promise<ActionResult>;
export async function setPlayerStatus(input: { userId: string; status: "ACTIVE" | "DISABLED" }): Promise<ActionResult>;
```

```text
UPDATE users SET role/status = ... WHERE id = userId — session admin
  (getServerClient), RLS users_update_admin. Erreur du trigger (message déjà
  rédigé, ex. "Un admin ne peut pas se retrograder lui-meme") remontée
  TELLE QUELLE, jamais réécrite. logAdminAction ensuite (before/after
  role+status), best-effort — même patron que validateBet/rejectBet.
Formulaires natifs (FormData + redirect), même patron que le lot précédent.
```

---

## 4. États et erreurs

```text
Liste vide : structurellement impossible (au moins 1 admin existe toujours,
  garanti par le trigger) — pas d'état vide à concevoir.
Erreur trigger (tentative bloquée malgré l'UI grisée — course entre deux
  admins) : portée par l'URL de redirection, rendue sur la bonne ligne.
```

---

## 5. Règles de rendu (T7)

```text
- CSS Modules, tokens app/tokens.css exclusivement.
- Teinte admin (--color-trend) cohérente avec les 2 écrans précédents.
- Badges rôle/statut : mêmes tokens de badge que le badge Admin du Profil
  (components/profile, --color-accent-soft/--color-accent-line).
```

---

## 6. Hors périmètre

```text
- Les 3 autres files (résolution, requêtes, logs) : lots séparés.
- Modification du pseudo/avatar/bio d'un joueur par un admin : jamais
  mentionnée par 0.2.7, hors périmètre.
```
