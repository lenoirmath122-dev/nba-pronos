# NBA Pronos — SPEC ÉCRAN FILE DE VALIDATION (ADMIN) V0.1

> **Statut : VALIDÉ (27/07/2026).** Deuxième écran du lot Admin, après le
> tableau de bord (`SPEC_ECRAN_ADMIN_DASHBOARD_V0_1.md`). Choisie en premier
> parmi les 5 pages filles car SEULE, avec « Gestion des joueurs », à ne PAS
> dépendre du moteur de scoring T5 manquant (`validateBet`/`rejectBet` sont
> catégorie B **sans recompute**, T6a §5.3 — contrairement à la résolution,
> qui appelle `recomputeBet`).
>
> Périmètre STRICT : `app/(admin)/admin/validation/page.tsx` — liste + geste
> de validation/refus. PAS les autres files (lots séparés, toujours §10 de
> la spec dashboard).

---

## 0. Sources et cadre

```text
Règles : nba_pronos_decisions_0_2_7_administration.md §5 (file de
  validation : SOUMIS → VALIDÉ avec ajustement de difficulté, ou REFUSÉ avec
  motif obligatoire ; contexte complet sans navigation ; journalisé) ;
  nba_pronos_decisions_0_2_9_ux_ui.md §8 (1 carte / pari SOUMIS, réglette de
  difficulté 1-5 ajustable, boutons Valider/Refuser).
Architecture : SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_b.md §5.1 — signatures
  validateBet({betId, validatedDifficulty, validatedCategory}) et
  rejectBet({betId, refusalReason}), catégorie B SANS recompute (session
  user, getServerClient, RLS bets_update_admin = is_admin()) — AUCUNE
  fonction SQL SECURITY DEFINER nécessaire, contrairement à « Nouveau pari »
  (§2.15 ETAT_ACTUEL.md).
Donnée neuve trouvée au pré-vol (pas dans la prose 0.2.9, mais dans le
  schéma ET la signature T6b) : `bets.validated_category` existe et
  `validateBet` l'exige au même geste que la difficulté — la réglette seule
  ne suffit pas, un sélecteur de catégorie l'accompagne. Cohérent avec
  l'interprétation déjà actée en Mes pronos (§2.11 ETAT_ACTUEL.md :
  « catégorie suit la même règle que la difficulté »), pas une invention.
Labels réutilisés tels quels (aucune 2e convention) : lib/labels/bets.ts
  (BET_CATEGORY_OPTIONS, BET_DIFFICULTY_LABELS) ; construction targetLabel/
  seriesLabel/matchLabel — même patron que lib/queries/my-bets.ts, étendu
  ici à TOUS les joueurs (pas seulement `user_id = auth.uid()`) + pseudo.
Trigger enforce_bet_transitions (migration #3) : SUBMITTED → VALIDATED /
  REJECTED / CANCELLED déjà autorisé, rien à toucher.
RLS : bets_update_admin (migration #3) déjà en place, is_admin() suffisant —
  aucune migration pour ce lot.
```

---

## 1. Architecture

```text
app/(admin)/admin/validation/page.tsx → composant serveur, appelle
  lib/queries/admin-validation.ts. UNE feuille "use client" par carte pour
  la réglette de difficulté (contrôlée, comme MarginStepper/BetForm) —
  reste possible en formulaire natif sans JS (input type="range"/"number"
  avec défaut serveur, pas besoin de JS pour fonctionner, juste pour le
  retour visuel immédiat).
lib/queries/admin-validation.ts → getPendingValidationBets() : TOUS les
  bets SUBMITTED de la compétition ACTIVE, toutes compétitions confondues
  NON (contrairement aux requêtes de correction, §3.3 dashboard) — un pari
  SOUMIS n'a de sens qu'ADOSSÉ à une compétition active en cours (sinon la
  question ne se pose plus).
lib/actions/admin-validation.ts → validateBet, rejectBet (formulaires
  natifs, FormData + redirect, même patron que requestBetCorrectionFormAction).
lib/actions/audit.ts (NOUVEAU, PARTAGÉ) → logAdminAction(), réutilisé par
  TOUTES les actions admin futures (résolution, requêtes, joueurs) — pas une
  abstraction prématurée : explicitement prévue comme helper transverse par
  T6b §6, pas inventée ici.
```

---

## 2. Contenu d'une carte — **acté (0.2.7 §5, 0.2.9 §8)**

```text
Contexte complet SANS navigation :
  - joueur (pseudo) ;
  - série/match visé (même libellé que Mes paris : "<tour> — <team1> vs
    <team2>" pour un pari SÉRIE, "Match N — JJ/MM HH:MM" pour un pari MATCH) ;
  - énoncé (description) ;
  - catégorie PROPOSÉE (sélecteur, défaut = proposed_category, ajustable) ;
  - difficulté PROPOSÉE (réglette 1-5, défaut = proposed_difficulty,
    ajustable, libellés BET_DIFFICULTY_LABELS) ;
  - horodatage de soumission (submitted_at) — pas dans la prose 0.2.9, ajouté
    pour permettre le tri (§3) sans deviner un ordre implicite.

Deux actions par carte, dans un SEUL formulaire (la réglette/le sélecteur
  n'ont de sens qu'au moment de Valider, jamais au moment de Refuser) :
  - Valider (submit avec la difficulté/catégorie retenues) ;
  - Refuser (bouton distinct, révèle un champ motif OBLIGATOIRE avant envoi
    — même patron <details>/"required" que MyBetRow/CorrectionRequestForm).
```

---

## 3. Tri — interprétation d'implémentation (pas fixé par 0.2.9)

```text
submitted_at CROISSANT (le plus ancien en premier — file d'attente FIFO,
  cohérent avec "résolution rapide, peu de clics" 0.2.7 §5 : traiter dans
  l'ordre d'arrivée plutôt que de laisser un pari ancien s'enterrer sous des
  plus récents).
```

---

## 4. Écriture — `lib/actions/admin-validation.ts`

```ts
export type ActionResult = { success: true } | { success: false; error: string };

// SUBMITTED -> VALIDATED. Re-garde le statut dans le WHERE de l'UPDATE (pas
// seulement en lecture avant) — piège déjà rencontré (ETAT_ACTUEL §7) : une
// RLS/condition qui ne matche aucune ligne réussit SANS erreur, il faut
// vérifier les lignes réellement affectées via .select().maybeSingle().
export async function validateBet(input: {
  betId: string; validatedDifficulty: 1 | 2 | 3 | 4 | 5; validatedCategory: BetCategory;
}): Promise<ActionResult>;

// SUBMITTED -> REJECTED. refusalReason non vide, vérifié CÔTÉ SERVEUR (pas
// seulement l'attribut HTML required, contournable).
export async function rejectBet(input: { betId: string; refusalReason: string }): Promise<ActionResult>;

// Formulaires natifs (FormData + redirect), même patron que
// requestBetCorrectionFormAction (lib/actions/bet-corrections.ts).
export async function validateBetFormAction(formData: FormData): Promise<void>;
export async function rejectBetFormAction(formData: FormData): Promise<void>;
```

```text
Les deux (validateBet/rejectBet) : re-vérifient is_admin() implicitement via
  la RLS bets_update_admin (getServerClient, PAS de re-check applicatif
  redondant — la policy EST la garde, T6a §5.1) ; posent validated_at/
  validated_by_admin_id = auth.uid() ; appellent logAdminAction (§5)
  ENSUITE, best-effort (pas de transaction cross-appel PostgREST possible
  ici — catégorie SANS recompute, donc pas de fonction SQL unique comme
  save_bet/request_prediction_correction) — un échec du log est signalé
  côté serveur (console.error) mais NE fait PAS échouer la transition déjà
  posée, jugé préférable à annuler une action admin réelle pour un
  problème d'audit.
```

---

## 5. `lib/actions/audit.ts` (NOUVEAU, partagé) — **acté (T6b §6)**

```ts
export async function logAdminAction(
  supabase: SupabaseServerClient,
  input: {
    actorUserId: string; action: string; targetType: string; targetId: string;
    reason?: string; before?: unknown; after?: unknown;
  }
): Promise<void>;
// INSERT audit_logs — RLS audit_insert (migration #3) : is_admin() ET
// actor_user_id = auth.uid() (ou NULL pour système, non utilisé ici).
```

---

## 6. États vides et erreurs

```text
File vide : « Rien à valider pour le moment. » (même ton que les états vides
  joueur, cohérence T7).
Refus sans motif : erreur portée par l'URL de redirection (même patron que
  CorrectionRequestForm/MyBetRow — ?validationError=...&betId=...), rendue
  dans la bonne carte au rechargement.
Pari déjà traité par un autre admin entre l'affichage et le clic (0 ligne
  affectée) : « Ce pari a déjà été traité. », même mécanisme d'erreur.
```

---

## 7. Règles de rendu (T7)

```text
- CSS Modules colocalisés, tokens app/tokens.css exclusivement.
- Teinte admin (--color-trend) reprise du tableau de bord — cohérence de
  zone, pas une nouvelle couleur.
- Réglette de difficulté : <input type="range" min="1" max="5"> + libellé
  BET_DIFFICULTY_LABELS affiché en regard (pas juste le chiffre nu).
```

---

## 8. Hors périmètre

```text
- Les 4 autres files (résolution, requêtes, joueurs, logs) : lots séparés.
- Annuler une validation déjà posée : hors périmètre (le trigger n'autorise
  de toute façon VALIDATED que vers WON/LOST/CANCELLED, jamais retour à
  SUBMITTED — cohérent avec l'absence de ce besoin dans 0.2.7).
```
