# NBA Pronos — SPEC ÉCRAN FILE DE RÉSOLUTION (ADMIN) V0.1

> **Statut : VALIDÉ (27/07/2026).** Lot 4b du câblage admin (T5) — après le
> bouton Recalculer (lot 4a). Débloquée par l'orchestration T5 (lot 3,
> `recomputeBet` existe désormais réellement).
>
> Périmètre STRICT : `app/(admin)/admin/resolution/page.tsx` — liste +
> geste de résolution GAGNÉ/PERDU. PAS la file des requêtes (lot 4c,
> séparé).

---

## 0. Sources et cadre

```text
Règles : nba_pronos_decisions_0_2_7_administration.md §5 (file de
  résolution : paris VALIDÉS dont l'échéance est passée → GAGNÉ/PERDU,
  motif recommandé, obligatoire si contesté, journalisé) ;
  nba_pronos_decisions_0_2_9_ux_ui.md §8 (1 carte / pari échu, rappel des
  points en jeu, boutons Gagné/Perdu).
Architecture : SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_b.md §5.2 —
  resolveBet({betId, outcome, resolutionReason?}), catégorie B AVEC
  recompute (T6a §5.3, getServiceClient) : applique la transition PUIS
  recomputeBet (T5 §8/§10, lib/scoring/recompute.ts — CODÉ, lot 3).
Donnée : mêmes bets que le compteur du tableau de bord
  (lib/queries/admin-dashboard.ts::getPendingResolutionCount) — VALIDATED,
  échéance dépassée (bet_deadline_open() reproduit en TypeScript, même
  patron que lib/queries/{bets,home,admin-dashboard}.ts, PAS une 4e
  implémentation divergente — factorisé cette fois dans lib/scoring/
  bet-deadline.ts, réutilisé par le tableau de bord ET cet écran).
« Contesté » (motif obligatoire) : une requête de correction PENDING existe
  déjà pour ce pari précis (correction_requests, target_type=BET,
  target_bet_id=ce pari) — signalé visuellement, sans agir dessus (le
  TRAITEMENT de la requête elle-même reste au lot 4c, séparé). Résoudre le
  pari ici NE CLÔT PAS automatiquement la requête liée.
```

---

## 1. Architecture

```text
app/(admin)/admin/resolution/page.tsx → composant serveur, lib/queries/
  admin-resolution.ts. AUCUN "use client" : 2 formulaires natifs
  indépendants par carte (Gagné / Perdu), même patron que la validation.
lib/scoring/bet-deadline.ts (NOUVEAU, factorisation) → isBetDeadlinePassed(),
  extrait de la logique dupliquée dans lib/queries/{bets,home,
  admin-dashboard}.ts — reprise ici pour la 4e fois sans dupliquer une
  nouvelle fois (piège déjà noté pour bet_deadline_open, ETAT_ACTUEL §7).
```

---

## 2. Contenu d'une carte — **acté (0.2.7 §5, 0.2.9 §8)**

```text
Contexte complet SANS navigation : joueur (pseudo), cible (série/match),
  énoncé, catégorie/difficulté VALIDÉES (déjà figées, contrairement à la
  validation), « N points en jeu » (barème appliqué à validated_difficulty
  — lib/labels/bets.ts::BET_DIFFICULTY_POINTS, NOUVEAU export, même
  barème que lib/scoring/engine.ts mais côté AFFICHAGE — cohérence
  documentée, pas une 2e source de vérité du calcul réel qui reste
  scoreBet).
Badge « Contesté » si une requête de correction PENDING existe pour ce
  pari (§0) — motif alors OBLIGATOIRE au moment de résoudre.

Deux actions par carte, formulaires natifs indépendants :
  - Gagné (bouton direct, motif recommandé sauf si contesté) ;
  - Perdu (bouton direct, motif recommandé sauf si contesté).
Motif : champ texte optionnel révélé par <details> (comme le refus en
  validation), sauf si contesté → révélé OUVERT et requis.
```

---

## 3. Tri

```text
Échéance la plus ANCIENNE en premier (FIFO, même raisonnement que la file
  de validation §3 — traiter les paris en attente depuis le plus longtemps
  d'abord) — pas fixé littéralement par 0.2.9, interprétation cohérente.
```

---

## 4. Écriture — `lib/actions/admin-resolution.ts`

```ts
export async function resolveBet(input: {
  betId: string; outcome: "WON" | "LOST"; resolutionReason?: string;
}): Promise<ActionResult>;
```

```text
Re-garde le statut VALIDATED dans le WHERE de l'UPDATE (piège déjà connu,
  ETAT_ACTUEL §7) ; motif OBLIGATOIRE si une requête PENDING existe pour ce
  pari (vérifié côté serveur, pas seulement côté client). Après la
  transition bets (status, resolution_reason, resolved_at,
  resolved_by_admin_id), appelle recomputeBet(betId) (lib/scoring/
  recompute.ts) — catégorie AVEC recompute (T6a §5.3). logAdminAction
  ensuite (before/after), best-effort — même patron que validateBet/
  rejectBet/setPlayerRole.
```

---

## 5. États et erreurs

```text
File vide : « Rien à résoudre pour le moment. »
Motif manquant sur un pari contesté : erreur portée par l'URL de
  redirection, rendue sur la bonne carte.
```

---

## 6. Règles de rendu (T7)

```text
- CSS Modules, tokens app/tokens.css exclusivement.
- Teinte admin (--color-trend) cohérente avec les écrans précédents.
- Badge « Contesté » : --color-loss (signale une attention requise), pas
  une nouvelle couleur.
```

---

## 7. Hors périmètre

```text
- File des requêtes (traitement/refus des correction_requests elles-
  mêmes) : lot 4c, séparé.
- Clôture automatique d'une requête liée lors de la résolution : pas
  demandée, pas faite — les deux restent des actions distinctes.
```
