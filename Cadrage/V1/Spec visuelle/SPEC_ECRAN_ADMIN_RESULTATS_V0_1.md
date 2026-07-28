# NBA Pronos — SPEC ÉCRAN SAISIE DES RÉSULTATS (ADMIN) V0.1

> **Statut : VALIDÉ (27/07/2026).** Lot 2/3 du chantier « Gestion des
> compétitions » (`SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md` §0/§8) — **le
> morceau le plus important avant le 30/10** : rien, à ce jour, ne fait
> avancer une équipe vers le tour suivant ni ne pose un résultat officiel
> (ni T4/synchro réelle, non codée, ni aucune action admin — le writer
> `series.official_*` de T5 existe mais aucun écran ne l'appelle). Deux
> points structurants tranchés AVEC l'utilisateur (AskUserQuestion,
> 27/07/2026) :
> 1. **Avancement automatique** — dès qu'une série devient officiellement
>    `FINISHED` avec un vainqueur (via les résultats de match saisis), le
>    vainqueur est propagé immédiatement vers `team1_id`/`team2_id` de la
>    série aval, dans la même action. Pas de bouton « Faire avancer »
>    séparé.
> 2. **A2 (série annulée / vainqueur désigné à la main sans match) HORS
>    PÉRIMÈTRE de ce lot** — reporté comme gap ouvert, cas rare. Ce lot ne
>    couvre que la saisie normale (créer des matchs, y saisir des scores).

---

## 0. Sources et cadre

```text
Données : SPEC_TECHNIQUE_MODELE_DONNEES_V0.1.md — matches (series_id,
  competition_id dénormalisé, game_number 1-7, scheduled_at NULLABLE,
  status, home_team_id/away_team_id, home_score/away_score) ; series
  (team1_id/team2_id, official_status/official_winner_team_id/
  official_score_format, next_series_id/next_series_slot).
Moteur : SPEC_TECHNIQUE_SCORING_V0_1.md §10 — `recomputeMatch` (score les
  pronos du match, re-dérive l'agrégat de série, écrit official_* via
  `writeSeriesOutcome`, cascade `recomputeSeries`). Explicitement HORS
  périmètre de `recomputeMatch`/`recomputeSeries` (commentaire du code,
  confirmé en écrivant ce lot) : l'avancement (écrire `series.team1_id/
  team2_id` de la série AVAL) — c'est une donnée OFFICIELLE réelle, jamais
  dérivée par le moteur pur. C'EST l'objet nouveau de ce lot.
RLS : `series_update`/`matches_update` existent déjà pour l'admin
  (`is_admin()`, migration `20260718110000_rls.sql`) — une UPDATE peut
  passer par la session admin normale. AUCUNE policy `matches_insert`
  n'existe (vérifié au pré-vol, même trouvaille que `series` au lot 1) :
  la CRÉATION d'un match passe par `service_role`, après re-vérification
  explicite de `is_admin()` — même patron que `createCompetition`.

**Trouvaille structurante (pré-vol de ce lot)** : à la création d'une
compétition (lot 1), SEULES les 15 lignes `series` sont créées — AUCUNE
ligne `matches`. Ce lot doit donc aussi permettre de CRÉER les matchs d'une
série (au fur et à mesure qu'ils sont programmés), pas seulement d'en
saisir le score — une série Playoffs peut se terminer en 4, 5, 6 ou 7
matchs, le nombre n'est jamais connu à l'avance.
```

---

## 1. Architecture

```text
app/(admin)/admin/competitions/results/page.tsx → composant serveur,
  lib/queries/admin-results.ts. Vue UNIQUE (une seule compétition ACTIVE à
  la fois, même invariant que /admin/competitions) groupée par tour
  (même vocabulaire que le Bracket joueur, lib/labels/rounds.ts), chaque
  série affichant ses 2 équipes (ou « à venir » si un slot est encore
  NULL), son statut officiel, la liste de ses matchs déjà créés (formulaire
  d'édition inline par match) et — seulement si les 2 équipes sont connues
  ET la série pas encore terminée/annulée ET < 7 matchs déjà créés — un
  formulaire compact « Ajouter un match ».

lib/actions/admin-results.ts → `createMatch` (INSERT, service_role) et
  `saveMatchResult` (UPDATE + `recomputeMatch` + `advanceWinnerIfDecided`),
  chacune avec sa variante `<form action={...}>` native (FormData +
  redirection avec erreur en query string — même patron que
  `admin-resolution.ts`/`admin-requests.ts`). AUCUN `"use client"` : tout
  est formulaire natif, pas d'état local nécessaire.

lib/scoring/advancement.ts → `advanceWinnerIfDecided(seriesId)`, NOUVELLE
  fonction, hors périmètre de T5 par design (§0 ci-dessus). Lit la série,
  si `official_status = FINISHED` et un vainqueur et une `next_series_id`
  existent, écrit ce vainqueur dans `team1_id` ou `team2_id` (selon
  `next_series_slot`) de la série aval — SEULEMENT si ce slot est encore
  NULL (idempotent, non destructif : ne jamais écraser un slot déjà rempli,
  une correction d'une série déjà avancée reste hors périmètre, voir §6).
```

---

## 2. Écran (`/admin/competitions/results`) — **acté**

```text
Aucune compétition active : message + lien vers /admin/competitions (même
  patron que l'écran de création si aucune compétition n'existe).

Compétition active : un bloc par tour (ordre topologique, ROUND_1 en haut),
  un bloc par série à l'intérieur :
  - En-tête de série : les 2 équipes (abréviation + nom) ou « Équipe à
    venir » pour un slot NULL ; statut officiel de la série (badge :
    Programmée / En cours / Terminée / Reportée / Annulée) ; si terminée,
    le nom du vainqueur.
  - Liste des matchs déjà créés (game_number croissant) : équipe domicile/
    extérieur, date programmée (ou « À définir »), formulaire d'édition
    inline (statut + 2 scores) avec bouton « Enregistrer ».
  - Formulaire « Ajouter un match » (conditionnel, §1) : choix de l'équipe
    à domicile (2 boutons radio parmi team1/team2), date/heure optionnelle
    (`<input type="datetime-local">`), bouton « Créer ». Le numéro de match
    (`game_number`) est calculé côté serveur (nombre de matchs déjà créés
    + 1), jamais saisi par l'admin.
  - Série CANCELLED/POSTPONED (posée manuellement ailleurs un jour, A2 hors
    périmètre ici) : aucun formulaire, juste le badge — cas qui ne peut pas
    encore se produire dans ce lot (aucun écran ne pose CANCELLED/POSTPONED
    à ce jour), mais le rendu doit rester correct s'il apparaît plus tard.
```

---

## 3. Écriture — `lib/actions/admin-results.ts`

```ts
export async function createMatch(input: {
  seriesId: string;
  homeTeamId: string;             // doit être team1_id ou team2_id de la série
  scheduledAt: string | null;     // ISO, ou null si pas encore connue
}): Promise<ActionResult>;

export async function saveMatchResult(input: {
  matchId: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | "POSTPONED" | "CANCELLED";
  homeScore: number | null;
  awayScore: number | null;
}): Promise<ActionResult>;
```

```text
createMatch : session admin re-vérifiée (getServerClient + is_admin()),
  puis TOUT le reste en service_role (même patron que
  `createPlayoffBracket`) : relit la série (équipes connues ? pas déjà
  terminée ? < 7 matchs ?), déduit l'équipe extérieure (l'AUTRE équipe de
  la série), calcule `game_number`, INSERT. `logAdminAction`
  ("CREATE_MATCH") après succès.

saveMatchResult : session admin re-vérifiée, puis service_role : UPDATE
  matches (status, home_score, away_score) — score final OBLIGATOIRE si
  status = FINISHED (validation serveur, pas de contrainte DB dédiée) ;
  PUIS `recomputeMatch(matchId)` (score les pronos, re-dérive et écrit
  l'agrégat de série si besoin, cascade `recomputeSeries`) ; PUIS
  `advanceWinnerIfDecided(seriesId)` (§1, propage vers la série aval SI
  applicable). `logAdminAction` ("SAVE_MATCH_RESULT", before/after)
  après succès — une seule entrée de journal couvre la saisie ET
  l'avancement éventuel qui en découle (pas 2 entrées séparées).

`revalidatePath` : `/admin/competitions/results` (soi-même), `/bracket`
  (série potentiellement avancée), `/leaderboard` (scores), `/play/matches`
  (fenêtre/statut de match), `/play/my-predictions` (verrouillage/badge
  EN DIRECT), `/home` (feed) — même ampleur que `lib/actions/bets.ts` pour
  son propre périmètre.
```

---

## 4. Avancement — `lib/scoring/advancement.ts`

```text
Nouvelle fonction, PAS un ajout à `lib/scoring/recompute.ts` (T5, déjà
VALIDÉ et clos — cette frontière n'est pas rouverte, elle est simplement
comblée par une brique séparée qui vit à côté, dans le même module
`lib/scoring`, cohérent avec `writeSeriesOutcome` déjà dans `lib/sync`).

Lit `official_status`/`official_winner_team_id`/`next_series_id`/
`next_series_slot` de la série qui vient d'être recalculée. Si la série
n'est pas `FINISHED`, ou n'a pas de vainqueur, ou n'a pas de série aval
(finale) : ne fait rien. Sinon, relit la série AVAL et n'écrit
(`team1_id`/`team2_id` selon le slot) QUE si ce slot est encore NULL —
non destructif par construction, jamais appelé en dehors de
`saveMatchResult`.
```

---

## 5. États et erreurs

```text
Ajout d'un match sur une série dont un slot d'équipe est encore NULL :
  action refusée, erreur portée par l'URL de redirection (même patron que
  §6 de SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1).
Ajout d'un 8e match (7 déjà créés) : refusé, message dédié.
Ajout sur une série déjà FINISHED/CANCELLED : refusé.
Score final manquant alors que le statut soumis est FINISHED : refusé,
  formulaire re-affiché (les valeurs déjà saisies ne sont PAS perdues :
  portées par les query params de redirection, comme les autres écrans
  admin).
```

---

## 6. Hors périmètre de CE lot

```text
- Résolution manuelle A2 (série CANCELLED, ou vainqueur désigné à la main
  sans résultat de match — forfait, erreur de saisie à corriger) —
  tranché AVEC l'utilisateur (AskUserQuestion, 27/07/2026) : reporté,
  cas rare, gap ouvert (`GAPS_OUVERTS.md`).
- Correction d'une série déjà avancée (le slot aval est déjà rempli,
  `advanceWinnerIfDecided` ne l'écrase jamais) — même famille que A2,
  hors périmètre.
- Mini-bracket NBA Cup (aucune série n'existe pour la Cup au-delà de la
  phase de groupes, hors pronostic — construit une fois les 8 qualifiés
  connus, lot séparé non tranché, `GAPS_OUVERTS.md`).
- Mapping automatique A7 / synchro T4 réelle — la saisie manuelle reste le
  seul chemin.
```
