# NBA Pronos — SPEC ÉCRAN FILE DES REQUÊTES (ADMIN) V0.1

> **Statut : VALIDÉ (27/07/2026).** Lot 4c du câblage admin (T5) — DERNIER
> morceau du chantier T5 ET du lot Admin. Après le bouton Recalculer (4a)
> et la file de résolution des paris (4b).
>
> Périmètre STRICT : `app/(admin)/admin/requests/page.tsx` — liste +
> traitement/refus des `correction_requests` (couvre MATCH_PREDICTION ET
> BET, 0.2.7 §6 : « 1 requête = 1 prono/pari », pas de distinction de file
> par type de cible).

---

## 0. Sources et cadre

```text
Règles : nba_pronos_decisions_0_2_7_administration.md §6 (workflow :
  EN_ATTENTE → TRAITÉE/REFUSÉE, motif admin obligatoire si refusée,
  traitement par n'importe quel admin SAUF l'auteur, pas de délai limite) ;
  0.2.3 §7 (correction transparente + tracée, marquage public).
Architecture : SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_b.md §5.3 —
  processCorrectionRequest({requestId, correctedValue, reason}) et
  rejectCorrectionRequest({requestId, reason}), catégorie B AVEC recompute
  pour le traitement (T6a §5.3).
Garde-fous DÉJÀ EN BASE (pré-vol, aucune migration pour ce lot) :
  - RLS cr_update_admin (migration #3) : is_admin() ET
    requester_user_id <> auth.uid() — un admin NE PEUT PAS traiter/refuser
    sa PROPRE requête, RLS bloque l'UPDATE de correction_requests, PAS
    besoin de re-vérifier applicativement.
  - RLS mp_update_admin (migration #3) : is_admin() peut modifier N'IMPORTE
    QUELLE ligne match_predictions.
  - Trigger enforce_prediction_correction (T-c, migration #3) : si
    corrected_by_admin_id posé, EXIGE corrected_by_admin_id ≠ user_id ET
    correction_request_id renseigné — GARDE-FOU RÉEL en base, l'action ne
    fait que fournir des valeurs cohérentes.
  - RLS bets_update_admin (migration #3) : is_admin() peut modifier
    N'IMPORTE QUELLE ligne bets. AUCUN trigger analogue à T-c pour bets
    (vérifié — pas de enforce_bet_correction) : la garde « admin ≠
    requérant » reste portée par cr_update_admin (correction_requests),
    suffisante puisque c'est LÀ que la garde métier compte (0.2.7 §6 parle
    de la requête, pas d'un 2e verrou redondant sur bets).

**DEUX cibles, DEUX comportements de traitement — asymétrie RÉELLE trouvée
au pré-vol, pas une invention** :
  - MATCH_PREDICTION : le joueur peut avoir proposé un vainqueur+écart
    (proposed_winner_team_id/proposed_margin, migration #7) — l'admin les
    voit en pré-remplissage, les CONFIRME ou les AJUSTE, ce sont ces
    valeurs qui sont ÉCRITES dans match_predictions (predicted_winner_
    team_id/predicted_margin). Correction RÉELLE de contenu.
  - BET : la migration #11 (workflow « pari oublié », déjà codé au lot
    Mes paris §2.19) ne collecte JAMAIS de valeur proposée
    (proposed_description/difficulty/category systématiquement NULL pour
    ce flux) — le signalement dit juste « ce pari attend une résolution ».
    « Traiter » une requête BET ne réécrit AUCUN champ métier du pari (la
    VRAIE correction est de RÉSOUDRE le pari, déjà possible via
    /admin/resolution, lot 4b — action séparée, pas dupliquée ici). Ce
    lot se contente de marquer is_admin_corrected/corrected_by_admin_id/
    correction_request_id/correction_reason sur `bets` (marquage PUBLIC de
    transparence, 0.2.3 §7 — la colonne existe, symétrique à
    match_predictions, jamais utilisée jusqu'ici) ET de clore la requête
    (PROCESSED).
```

---

## 1. Architecture

```text
app/(admin)/admin/requests/page.tsx → composant serveur, lib/queries/
  admin-requests.ts. Formulaires natifs — UNE feuille "use client"
  minimale pour le <select> d'équipe du formulaire MATCH_PREDICTION
  (fonctionne aussi nativement sans JS via <select> standard — en réalité
  AUCUN "use client" nécessaire, cf. §6).
```

---

## 2. Contenu d'une carte — **acté (0.2.7 §6, 0.2.3 §7)**

```text
Commun aux deux types : joueur (pseudo du requérant), cible (libellé
  série/match ou pari, comme les files précédentes), justification du
  joueur, horodatage de la requête.

MATCH_PREDICTION : prono ACTUEL (vainqueur/écart déjà en base, "—" si
  ligne vide voie A) ; proposition du joueur si fournie (badge « suggéré
  par le joueur ») ; formulaire de correction — <select> équipe (les 2
  équipes du match) + <input type="number"> écart, PRÉ-REMPLIS avec la
  proposition du joueur si présente, sinon vides.

BET : énoncé, catégorie/difficulté déjà validées, statut actuel (déjà
  VALIDATED par construction, migration #11) ; PAS de formulaire de
  valeur — juste un rappel « À traiter : résous ce pari via la file de
  résolution » + lien direct vers /admin/resolution.

Deux actions par carte (formulaires natifs indépendants) :
  - Traiter (motif recommandé) — écrit la correction pour MATCH_PREDICTION,
    marque seulement pour BET (§0) ; statut → PROCESSED.
  - Refuser (motif OBLIGATOIRE) — statut → REJECTED, AUCUNE écriture sur
    la cible.
```

---

## 3. Tri

```text
Plus ANCIENNE en premier (FIFO) — même raisonnement que validation/
résolution.
```

---

## 4. Écriture — `lib/actions/admin-requests.ts`

```ts
export async function processCorrectionRequest(input: {
  requestId: string;
  correctedWinnerTeamId?: string;   // MATCH_PREDICTION uniquement
  correctedMargin?: number;         // MATCH_PREDICTION uniquement
  reason?: string;
}): Promise<ActionResult>;

export async function rejectCorrectionRequest(input: {
  requestId: string; reason: string;
}): Promise<ActionResult>;
```

```text
processCorrectionRequest :
  1. Lit la requête (target_type, target_match_prediction_id OU
     target_bet_id, statut PENDING re-gardé dans le WHERE de l'UPDATE final).
  2. Si MATCH_PREDICTION : lit match_id depuis match_predictions, UPDATE
     predicted_winner_team_id/predicted_margin/is_admin_corrected=true/
     corrected_by_admin_id/correction_request_id/correction_reason (RLS
     mp_update_admin, trigger T-c re-vérifie côté base) ; PUIS
     recomputeMatch(matchId) (catégorie AVEC recompute).
     Si BET : UPDATE is_admin_corrected=true/corrected_by_admin_id/
     correction_request_id/correction_reason SEULEMENT (RLS
     bets_update_admin) — PAS de recompute ici (aucune donnée de scoring
     changée ; la résolution, séparée, appelle déjà recomputeBet).
  3. UPDATE correction_requests SET status='PROCESSED', handled_by_admin_id,
     handled_at — RE-GARDE status='PENDING' dans le WHERE (piège déjà
     connu). RLS cr_update_admin bloque déjà l'auto-traitement, mais on
     vérifie les lignes affectées (course entre deux admins).
  4. logAdminAction.

rejectCorrectionRequest :
  Motif OBLIGATOIRE (vérifié serveur). UPDATE correction_requests
  SET status='REJECTED', admin_reason, handled_by_admin_id, handled_at —
  re-gardé PENDING. AUCUNE écriture sur la cible. logAdminAction.
```

---

## 5. États et erreurs

```text
File vide : « Rien à traiter pour le moment. »
Erreur (requête déjà traitée entre-temps, motif de refus manquant) :
  portée par l'URL, rendue sur la bonne carte.
```

---

## 6. Règles de rendu (T7)

```text
- CSS Modules, tokens app/tokens.css exclusivement.
- Teinte admin (--color-trend) cohérente.
- <select> natif pour le vainqueur corrigé (2 options : les 2 équipes du
  match) — AUCUN "use client" nécessaire (formulaire natif standard).
```

---

## 7. Hors périmètre

```text
- Résoudre un pari depuis cette carte (lien vers /admin/resolution
  seulement, pas un formulaire dupliqué).
- Étendre le workflow BET pour transporter une vraie valeur proposée
  (description/difficulté/catégorie corrigées) : hors périmètre de
  migration #11, jamais demandé.
```
