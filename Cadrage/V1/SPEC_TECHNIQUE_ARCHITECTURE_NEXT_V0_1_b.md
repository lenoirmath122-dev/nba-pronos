# NBA Pronos — SPEC TECHNIQUE T6b — ARCHITECTURE NEXT V0.1 (b : écritures)

> **Nature** : deuxième des trois sous-specs de **T6**. T6b remplit la **couche
> d'écriture** dont T6a a posé les catégories et mécanismes : le **scellage de
> deadline** (`sealDeadlines`), les **server actions joueur** (catégorie A) + le
> **garde-fou anti-perte de saisie C2**, et les **actions admin** (catégorie B) avec
> **journalisation `audit_logs`**. Elle **ne contient aucune souscription Realtime
> ni rendu d'état** (→ T6c), **aucun design token** (→ T7). Elle décrit les
> **signatures, validations et transitions** ; les corps complets sont écrits après
> validation.
>
> **Dépend de** : T1 (tables/statuts), T2 (session), T3 (policies RLS + triggers
> T-a/T-b/T-c), T4 (routes de synchro, planificateur externe), T5 (moteur
> `recompute*`, `writeSeriesOutcome`), **T6a** (3 clients Supabase, frontière
> d'écriture Option A, arbre). Réutilise des décisions closes : 0.2.2 (bracket),
> 0.2.3 (pronos match), 0.2.4 (paris), 0.2.7 (admin, logs), C2, T5 §12.4 (contrat
> `validated_difficulty`).
>
> **Statut** : **VALIDÉ** avec l'utilisateur le 19/07/2026. Les 2 points ouverts
> (§9) sont actés : **remontée T3** (retrait de `not is_validated` sur l'UPDATE du
> bracket, correctif porté par la migration #3) et **`LOCKED` implicite** (état
> calculé, jamais écrit). Prochaine sous-spec : T6c (Realtime + rendu des états).
>
> **Périmètre** : toutes les écritures V1 (Playoffs + NBA Cup, joueur + admin).

---

## 0. Résumé du chantier T6b

```text
1. sealDeadlines : scellage de deadline idempotent, porté par le planificateur   → §2
2. Server actions JOUEUR (catégorie A) : pronos, bracket, paris, corrections      → §3
3. Garde-fou anti-perte de saisie C2 (mécanisme transverse)                        → §4
4. Actions ADMIN (catégorie B) : files, gestion joueurs, série/A2, recalcul, setup → §5
5. Journalisation audit_logs (helper transverse)                                   → §6
6. Ce que T6b ne dit pas (→ T6c, T7)                                              → §7
7. Plan de test T6b                                                                → §8
8. Points soumis à validation (dont remontée T3)                                   → §9
```

Rien à coder tant que T6b n'est pas validé.

---

## 1. Décisions closes réutilisées (non rouvrables)

| Sujet | Décision | Source |
|---|---|---|
| Pronos match | DRAFT → VALIDATED **irréversible** ; « valider = voir » ; auto-valid si complet à la deadline | 0.2.3 / synthèse §5 |
| Bracket | modifiable **jusqu'à la deadline même après validation** ; auto-valid si rempli ; champion déduit | 0.2.2 §3 |
| Paris | BROUILLON→SOUMIS→VALIDÉ→GAGNÉ/PERDU ; ↘REFUSÉ ; →ANNULÉ ; quotas 1 série + 3 match | 0.2.4 |
| Difficulté validée | fait foi ; auto-valid pose `validated_difficulty = proposed_difficulty` | 0.2.4 §7 / T5 §12.4 |
| Correction prono | sur **requête** joueur seulement ; admin ≠ auteur ; marquage public + motif | 0.2.3 §7 |
| Admin | files validation/résolution/requêtes ; gestion joueurs ; **tout journalisé** | 0.2.7 / 0.2.9 §8 |
| Verrouillage | piloté par l'**heure connue** du match, pas par la synchro | P9 |
| Frontière d'écriture | A joueur (session) / B admin-système (privilégié, `is_admin()`) / C externe (routes) | T6a §5 (Option A) |
| Écrivain unique de série | `writeSeriesOutcome` (lib/sync, `service_role`) | T5 §12 / T6a §5.2 |

---

## 2. `sealDeadlines` — scellage de deadline (décision d'entrée, actée le 19/07/2026)

**Problème résolu.** L'auto-validation (bracket 0.2.2 §2, prono 0.2.3, pari 0.2.4 §5)
doit produire une **vraie écriture de statut**, pas un calcul paresseux à la lecture :
deux mécanismes déjà figés lisent le **statut stocké**, pas `now()` —

```text
- Visibilité (T3 §4) : un prono devient public via status <> 'DRAFT'. Un brouillon
  complet jamais basculé resterait invisible après le coup d'envoi (contredit
  synthèse §5).
- Scoring (T5 §5) : ne score que si la prédiction est FIGÉE (VALIDATED/LOCKED). Un
  brouillon complet non basculé serait traité en ABSENCE, à tort.
```

**Solution actée : un scellage explicite, idempotent, porté par le planificateur
externe qui tourne déjà** (catégorie C, `service_role`), en tête du job de résultats.

```ts
// lib/sync/sealDeadlines.ts — écriture SYSTÈME (service_role), 0 requête API.
// Invoquée en PREMIER par /api/sync/results (T4), avant la lecture des scores.
// Idempotente : n'agit que sur les lignes encore dans l'état pré-deadline.
async function sealDeadlines(competitionId: string): Promise<SealReport>;
```

Transitions appliquées (toutes des transitions LÉGALES de la machine à états, trigger
T-b) :

```text
PRONO MATCH (deadline = scheduled_at du match, atteinte) :
  brouillon COMPLET (winner + margin) → VALIDATED, is_auto_validated = true.  [porteur]
  brouillon PARTIEL (un seul champ)   → reste DRAFT (absence, 0 — synthèse §5).

PARI (deadline = tip-off du match visé / du 1er match de la série) :
  SUBMITTED non revu → VALIDATED, validated_difficulty = proposed_difficulty,
                       is_auto_validated = true.                              [porteur]
  (DRAFT jamais soumis → reste DRAFT, hors jeu ; REJECTED/CANCELLED inchangés.)

BRACKET (deadline = competitions.bracket_deadline, atteinte) :
  bracket non explicitement validé → is_auto_validated = true.               [cosmétique]
```

Pourquoi ce modèle :

```text
- NE ROUVRE RIEN : status <> 'DRAFT' reste la clé de visibilité, VALIDATED/LOCKED la
  condition de scoring, la machine à états (T-b) ne voit que des transitions légales.
- IDEMPOTENT (P5) : n'agit que sur l'état pré-deadline → rejouable sans effet de bord,
  comme la synchro qui l'appelle.
- ZÉRO INFRA EN PLUS, reste gratuit (P14) : toute deadline est adossée à un
  scheduled_at de match (pari série = 1er match ; pari match = son match ; bracket =
  1er match des playoffs / des quarts Cup) → elle tombe dans une fenêtre de match, que
  /api/sync/results couvre déjà. sealDeadlines ne consomme AUCUN quota API (lecture DB).
- service_role : écriture système, pas action joueur → catégorie C, cohérent Option A / P2.
```

**Distinction porteur vs cosmétique** : les scellages *prono* et *pari* sont
**porteurs** (statut requis pour visibilité + scoring). Le scellage *bracket* est
**cosmétique** : la visibilité du bracket est gardée par `bracket_deadline_passed`
(temporel, T3), et le scoring par « série résolue + pick existant » (T5) — donc
`is_auto_validated` n'y est qu'un **libellé de traçabilité** (« auto-validé »), non
porteur. On l'écrit quand même pour la cohérence d'affichage, mais rien n'en dépend.

**Compromis assumé** : le planificateur tournant toutes les 30-60 min en fenêtre, un
brouillon *complet mais oublié* peut devenir public jusqu'à ~1 h après le coup d'envoi
(au lieu de l'instant exact). Sans effet sur le scoring (qui arrive à `FINISHED`, bien
plus tard) ni sur les pronos validés à la main (publics dès le clic). Précision au
coup d'envoi exact = un cron par événement, incompatible avec le palier gratuit —
écarté (P14).

---

## 3. Server actions joueur (catégorie A)

Toutes en **session utilisateur** (`getServerClient`, T6a §2.4). La **RLS (T3 §5) est
le garde-fou** ; le trigger T-b garde la machine à états ; la server action orchestre
et fait un `revalidatePath` **ciblé** (T6a §2.3). Aucune n'utilise `service_role`
(C-4). Signatures indicatives :

### 3.1 Pronos match (0.2.3)

```ts
// Écrit/écrase le brouillon du joueur (upsert). RLS mp_insert / mp_update_self
// (self, is_active(), status='DRAFT', match non verrouillé).
//
// CORRECTIF POST-VALIDATION (23/07/2026) — les deux champs sont désormais OPTIONNELS.
// Motif : le brouillon PARTIEL est un état produit acquis (0.2.3 §5, 0.2.9 §4 statut
// « incomplet », T1 §3.9 colonnes nullable) et le §2 de CE document le prévoit déjà
// (« brouillon PARTIEL → reste DRAFT »). La signature initiale, en exigeant les deux
// champs, rendait ce statut inatteignable. Aucune règle produit n'est modifiée :
// §3.1 est réaligné sur §2.
async function saveMatchPredictionDraft(input: {
  matchId: string;
  predictedWinnerTeamId?: string | null;   // null = champ explicitement vidé
  predictedMargin?: number | null;         // 1..50 si fourni
}): Promise<ActionResult>;

// INCHANGÉE — exige toujours les 2 champs complets.
async function validateMatchPrediction(matchId: string): Promise<ActionResult>;

// INCHANGÉE.
async function validateAllCompleteMatchPredictions(): Promise<{ validatedMatchIds: string[] }>;
```

```text
Les gardes ci-dessous s'appliquent à chaque champ FOURNI. Un champ absent (undefined)
n'est pas écrit ; un champ à null vide explicitement la valeur en base.

Validations serveur (avant écriture) :
- predictedWinnerTeamId ∈ { match.home_team_id, match.away_team_id } (sinon rejet).
- predictedMargin entier 1..50 (garde app + CHECK T1 ; borne UX 0.2.3).
- match non verrouillé (redondant avec la RLS match_is_locked, mais message clair).
- validate : les 2 champs présents, sinon rejet « prono incomplet ».
Post : revalidatePath('/play/matches') + '/home'.
```

### 3.2 Bracket (0.2.2)

```ts
// Crée le bracket au 1er pick (unique(user_id, competition_id)) puis upsert un pick.
// predicted_score_format : requis en Playoffs (4-0..4-3), NULL en NBA Cup.
// La CASCADE de pré-remplissage (le vainqueur d'un tour pré-remplit l'affiche du
// tour suivant côté saisie) est calculée à l'écriture : poser/relayer les picks aval.
async function saveBracketPick(input: {
  seriesId: string; predictedWinnerTeamId: string; predictedScoreFormat?: SeriesFormat;
}): Promise<ActionResult>;

// Validation VOLONTAIRE : is_validated = true. NE FIGE PAS le bracket (0.2.2 §3) :
// il reste modifiable jusqu'à la deadline. (Voir §9.1 — remontée T3.)
async function validateBracket(): Promise<ActionResult>;
```

```text
Validations serveur :
- predictedWinnerTeamId ∈ paire routée du joueur pour cette série (T1 §3.8 : team1/
  team2 officiels si connus, sinon la paire issue de la cascade des picks amont).
- Playoffs : predictedScoreFormat ∈ {4-0,4-1,4-2,4-3}. Cup : doit être NULL.
- Champion = déduit du vainqueur de la finale (NBA_FINALS / CUP_FINAL), jamais saisi
  séparément (0.2.2 §8).
- Édition autorisée tant que competitions.bracket_deadline non atteinte, is_validated
  ou non (0.2.2 §3 — cf. §9.1).
Post : revalidatePath('/play/bracket') + '/home'.
```

### 3.3 Paris (0.2.4)

```ts
// DRAFT → SUBMITTED (ou création directe en SUBMITTED). Quotas gardés par les index
// uniques T1 (1 SERIES + 3 MATCH par série) + garde app pour le message.
async function submitBet(input: {
  scope: 'SERIES' | 'MATCH'; seriesId: string; matchId?: string;   // requis si MATCH
  description: string; proposedCategory: BetCategory; proposedDifficulty: number; // 1..5
}): Promise<ActionResult>;
```

```text
Validations serveur :
- scope MATCH ⇒ matchId non NULL et match « bien identifié » (adversaire + date
  confirmés, 0.2.4 §1) ; scope SERIES ⇒ matchId NULL (CHECK T1 bet_match_scope_check).
- Quota : ≤ 1 pari SERIES et ≤ 3 paris MATCH (matchs distincts) par (user, série) —
  l'index unique T1 rejette le doublon ; l'action traduit en message lisible.
- Deadline non atteinte (série : 1er match ; match : tip-off du match) — RLS + garde.
- Le joueur NE fixe PAS la difficulté validée (proposed_* seulement) ; validated_* est
  admin (§5) ou sealDeadlines (§2).
Post : revalidatePath('/play/bets') + '/home'.
```

### 3.4 Requêtes de correction (0.2.3 §7)

```ts
// Le joueur demande une correction sur SON prono (ou pari) : crée correction_requests
// (PENDING). Aucune écriture de la prédiction elle-même ici (c'est l'admin, §5).
async function requestCorrection(input: {
  targetType: 'MATCH_PREDICTION' | 'BET'; targetId: string; justification: string;
  proposedCategory?: BetCategory;         // symétrie C3 (pari)
}): Promise<ActionResult>;
```

```text
Garde : une seule requête PENDING par cible (index uniq_pending_correction_*, T1).
Post : revalidatePath('/play/my-predictions' ou '/play/bets') + '/home'.
```

> **Aucun DELETE joueur nulle part** (rétention D2, T3 §5 point 4). On écrase un
> brouillon, on ne le supprime jamais.

---

## 4. Garde-fou anti-perte de saisie (C2)

Mécanisme **transverse** aux 3 écrans à saisie perdable (pronos match, paris, bracket)
— 0.2.9 / C2. Le *rendu* exact (wording du dialogue) est en T6c ; T6b pose le
**mécanisme**.

```text
- Un hook client `useUnsavedGuard()` expose un état « modifications non sauvegardées »
  (dirty), positionné dès qu'un champ change et remis à zéro après une server action
  réussie (§3).
- Fermeture d'onglet / rechargement : `beforeunload` natif tant que dirty (déjà géré
  au proto pour la fermeture d'onglet — C2).
- Navigation INTERNE à l'app (nouveau vs proto, C2) : intercepter la navigation
  (App Router) tant que dirty → dialogue de confirmation « quitter sans enregistrer ? ».
- La saisie vit en état LOCAL (client) ; elle n'est persistée qu'à « Enregistrer le
  brouillon » / « Valider » (server action). Pas d'auto-save silencieux (le brouillon
  est un acte explicite — cohérent avec le cycle 0.2.3).
- C2 est une garde d'ERGONOMIE, jamais de sécurité : la RLS + le verrouillage temporel
  restent l'autorité (une saisie tardive est refusée par la base, pas par ce garde).
```

---

## 5. Actions admin (catégorie B)

Toutes **re-vérifient `is_admin()` côté serveur** avant d'agir et **journalisent**
(§6). Deux sous-catégories selon Option A (T6a §5) : **sans recompute** (session user,
RLS `is_admin()`) vs **avec recompute / écriture officielle** (module privilégié
`getServiceClient`).

### 5.1 File de validation des paris (0.2.9 §8) — *sans recompute*

```ts
// SUBMITTED → VALIDATED (fixe validated_difficulty + validated_category) OU → REJECTED
// (refusal_reason OBLIGATOIRE). Session user, RLS admin (T3 §5). Journalisé.
async function validateBet(input: {
  betId: string; validatedDifficulty: number; validatedCategory: BetCategory;
}): Promise<ActionResult>;
async function rejectBet(input: { betId: string; refusalReason: string }): Promise<ActionResult>;
```

### 5.2 File de résolution des paris (0.2.9 §8) — *avec recompute*

```ts
// VALIDATED → WON / LOST (resolution_reason recommandé, obligatoire si contesté).
// Chemin PRIVILÉGIÉ : applique la transition PUIS recomputeBet (T5 §8/§10). Journalisé.
async function resolveBet(input: {
  betId: string; outcome: 'WON' | 'LOST'; resolutionReason?: string;
}): Promise<ActionResult>;
```

### 5.3 File des requêtes de correction (0.2.3 §7) — *avec recompute*

```ts
// PENDING → PROCESSED (applique la correction au prono/pari cible : is_admin_corrected,
// corrected_by_admin_id, correction_reason, lien correction_request_id) PUIS recompute
// de la cible. Garde trigger T-c : requête liée + admin ≠ auteur du prono. Journalisé.
async function processCorrectionRequest(input: {
  requestId: string; correctedValue: CorrectedPredictionValue; reason: string;
}): Promise<ActionResult>;
async function rejectCorrectionRequest(input: { requestId: string; reason: string }): Promise<ActionResult>;
```

```text
Marquage PUBLIC obligatoire (0.2.3 §7) : la correction pose un ATTRIBUT visible
(« saisi/corrigé par admin X sur requête de Y ») — c'est un attribut de la ligne, PAS
le log d'audit (qui reste privé, 0.2.7 §8). Rendu en T6c.
```

### 5.4 Gestion des joueurs (0.2.7 / 0.2.9 §8) — *sans recompute*

```ts
// role/status. Session user, RLS admin. Garde-fous FINS par trigger T-a :
// pas d'auto-rétrogradation, dernier admin actif non rétrogradable/désactivable.
async function setPlayerRole(input: { userId: string; role: 'PLAYER'|'ADMIN' }): Promise<ActionResult>;
async function setPlayerStatus(input: { userId: string; status: 'ACTIVE'|'DISABLED' }): Promise<ActionResult>;
```

```text
Le joueur DISABLED garde pronos + points et reste au classement (0.2.7 §3) : aucune
suppression, seul le droit d'ÉCRIRE est retiré (is_active() dans les policies).
Les garde-fous sont AUSSI reflétés dans l'UI (action grisée sur sa propre ligne / le
dernier admin — 0.2.9 §8), mais l'autorité reste le trigger T-a.
```

### 5.5 Résolution / override / A2 de série (T5 §9) — *avec recompute, privilégié*

```ts
// Écrit series.official_* via l'UNIQUE writeSeriesOutcome (T6a §5.2) PUIS recomputeSeries
// (T5 §10). Couvre : forcer un statut CANCELLED (neutralisation A2), désigner l'équipe
// qui avance (sortie de cascade A2), corriger une donnée officielle avant verrouillage
// (0.2.2 §11). Journalisé (résolution A2 = décision manuelle tracée, T5 §9).
async function resolveSeries(input: {
  seriesId: string; outcome: Partial<SeriesOutcome>; reason: string;
}): Promise<ActionResult>;
```

### 5.6 Bouton « Recalculer » (filet de sécurité, 0.2.9 §8) — *avec recompute, privilégié*

```ts
// recomputeCompetition (T5 §10) sur la compétition ACTIVE. Confirmation UI + journalisé.
async function recalculateCompetition(competitionId: string): Promise<ActionResult>;
```

### 5.7 Création / configuration de compétition (A7) — *privilégié, sans recompute*

```ts
// Crée competitions + competition_secrets(join_code) + les séries du 1er tour (8
// affiches Playoffs / 8 quarts Cup) + les mappings A7. L'écriture de series relève du
// module privilégié (T3 : series INSERT = service_role) — pas d'INSERT series joueur.
// Réutilise lib/competitionSetup (portage proto, D3). Journalisé.
async function createCompetition(input: CompetitionSetupInput): Promise<ActionResult>;
```

```text
Récapitulatif client par action (rappel T6a §5.3) :
  sans recompute (session user, RLS is_admin())      : validateBet, rejectBet,
    setPlayerRole, setPlayerStatus, rejectCorrectionRequest, éditions officielles
    purement descriptives (horaire).
  avec recompute / écriture officielle (privilégié)   : resolveBet,
    processCorrectionRequest, resolveSeries, recalculateCompetition, createCompetition.
```

---

## 6. Journalisation `audit_logs` (helper transverse, B2)

```ts
// Écrit une ligne audit_logs. Appelé par CHAQUE action admin (§5), dans la même
// transaction que l'action. RLS : insert is_admin() (actor = auth.uid()) ou système.
async function logAdminAction(input: {
  actionType: string; targetType: string; targetId: string;
  before: unknown; after: unknown; reason?: string;      // avant/après en JSON (B2)
}): Promise<void>;
```

```text
- actor = auth.uid() pour une action admin ; « système » pour une écriture déclenchée
  par la synchro (ex. recompute auto n'a pas d'entrée audit_logs joueur — c'est
  sync_logs, T4, qui trace la synchro).
- audit_logs est APPEND-ONLY et PRIVÉ (admin only, T3 §4) : l'écran /admin/logs est en
  lecture seule (0.2.9 §8), filtrable (B5) — rendu en T6c.
- Le motif (reason) est OBLIGATOIRE là où le cadrage l'exige : refus de pari, refus de
  requête, correction de prono ; recommandé ailleurs (résolution).
```

---

## 7. Ce que T6b ne dit pas

```text
- Les souscriptions Realtime + micro-animation « donnée qui vient de changer » (B7). → T6c
- Le RENDU des états : A1 (« - »/« 0 »), pari annulé barré+grisé, marquage « corrigé
  par admin », joueurs absents, barre « toi », bascule résumé/arbre, tendances %/brut,
  états vides + wording (B9), dialogue C2.                                            → T6c
- Les design tokens.                                                                  → T7
- Le SQL des triggers T-a/T-b/T-c (déjà cadrés).                                       → T3 (migration #3)
- La config du planificateur externe (fréquences cron).                               → T8/déploiement
```

---

## 8. Plan de test T6b

```text
sealDeadlines (§2)
1.  Brouillon prono COMPLET, deadline franchie → VALIDATED + is_auto_validated ;
    PARTIEL → reste DRAFT. Rejouer sealDeadlines → aucun changement (idempotent).
2.  Pari SUBMITTED non revu, deadline franchie → VALIDATED, validated_difficulty =
    proposed_difficulty, is_auto_validated (contrat T5 §12.4).
3.  0 requête API consommée par sealDeadlines (lecture DB seule).

ACTIONS JOUEUR (§3)
4.  saveMatchPredictionDraft : predictedMargin hors 1..50 → rejet ; winner hors paire → rejet.
4bis. saveMatchPredictionDraft avec UN SEUL des deux champs → ACCEPTÉ, la ligne reste
      DRAFT et le prono s'affiche « incomplet ». À la deadline, sealDeadlines (§2) la
      laisse en DRAFT = absence, 0 point, jamais de négatif.
5.  validateMatchPrediction sur brouillon incomplet → rejet ; sur complet → VALIDATED,
    puis re-validation impossible (irréversibilité, RLS status='DRAFT').
6.  validateAllComplete : ne bascule que les complets ; renvoie la liste.
7.  saveBracketPick APRÈS validateBracket, avant deadline → AUTORISÉ (0.2.2 §3, §9.1).
8.  submitBet : 2e pari SERIES sur la même série → rejet quota ; 4e pari MATCH → rejet.
9.  requestCorrection : 2e requête PENDING sur la même cible → rejet (index unique).
10. Toute action joueur utilise getServerClient (revue : jamais getServiceClient).

ACTIONS ADMIN (§5) + journalisation (§6)
11. resolveBet WON → points via recomputeBet (T5 §8) ; ligne audit_logs écrite.
12. processCorrectionRequest par l'admin AUTEUR du prono → refusé (trigger T-c).
13. rejectBet sans motif → rejet (motif obligatoire).
14. setPlayerRole sur sa propre ligne → refusé (trigger T-a) ; sur le dernier admin → refusé.
15. resolveSeries CANCELLED → recomputeSeries neutralise les picks (T5 §9) ; audit_logs.
16. resolveSeries écrit series.official_* UNIQUEMENT via writeSeriesOutcome (revue C-2).
17. recalculateCompetition → recomputeCompetition idempotent ; audit_logs.
18. Une action admin « avec recompute » forgée par un non-admin → is_admin() faux →
    refus AVANT tout appel privilégié ; aucune écriture.
```

---

## 9. Décisions actées à la validation de T6b (19/07/2026)

### 9.1 Remontée vers T3 — policy d'UPDATE du bracket (corrigée)

**Acté.** La garde **`not is_validated`** est **retirée** de l'UPDATE de `brackets` /
`bracket_picks` : elle contredisait 0.2.2 §3 (« modifiable jusqu'à la deadline même
après validation », clos) et la note de T3 §4. Policy corrigée, portée par la
**migration #3** (à régénérer avant tout `db push`) :

```sql
-- brackets / bracket_picks : éditables tant que la deadline n'est pas passée,
-- validé ou non (0.2.2 §3). is_validated = simple marqueur (confiance + trace),
-- il ne verrouille pas. Le verrouillage réel reste TEMPOREL (P9).
using ( self AND is_active() AND not bracket_deadline_passed(competition_id) )
```

### 9.2 `LOCKED` (pronos match) : état implicite, jamais écrit

**Acté.** `LOCKED` n'est **pas** écrit. « Verrouillé » est un état **calculé**
(`match_is_locked`, P9) ; `VALIDATED` est l'état terminal stocké d'un prono. L'enum
conserve `LOCKED` en réserve, inutilisé, sans dette ni seconde écriture datée.

### 9.3 Correctif post-validation (23/07/2026) — `saveMatchPredictionDraft`

Les deux champs de `saveMatchPredictionDraft` (§3.1) sont passés d'obligatoires à
**optionnels**. Motif : §3.1 contredisait §2 du même document, qui prévoit déjà
qu'un brouillon PARTIEL reste `DRAFT`. Sans ce correctif, le statut « incomplet »
de 0.2.9 §4 était inatteignable et un joueur ne pouvait pas enregistrer un prono à
moitié rempli pour le finaliser plus tard.

Aucune règle produit modifiée. Même traitement que les trois correctifs
post-validation de T6a. Trouvé à la rédaction de `SPEC_ECRAN_MATCHS_V0_1.md` (§18.1),
session du 23/07/2026.

---

**T6b est VALIDÉ et figé.** La policy bracket de la **migration #3** doit être
régénérée (§9.1) avant tout `db push` — jamais silencieusement. On enchaîne sur
**T6c** (Realtime + rendu de tous les états actés : A1, paris annulés, marquage
corrigé, absents, barre « toi », tendances, états vides, dialogue C2). T6b ne produit
aucune migration propre ; le seul SQL touché est la correction de policy du §9.1,
portée par la migration #3 existante.
