# NBA Pronos — SPEC ÉCRAN MES PARIS V0.1

> **Statut : VALIDÉ (27/07/2026).** Périmètre identifié dès le préambule de
> `SPEC_ECRAN_NOUVEAU_PARI_V0_1.md` (« deux autres surfaces du lot Paris sont
> hors de CETTE spec... « Mes paris » (consultation / quotas) »), jamais
> rédigé en détail avant cette session. Ferme le 8ème écran du hub joueur.
> Deux points fermés AVANT rédaction (AskUserQuestion) : révélation
> publique des AUTRES joueurs — REPORTÉE (reste personnel, comme le
> faisait le prototype) ; demande de correction sur un pari — INCLUSE
> (§7/§8, nécessite une nouvelle fonction SQL, migration #11 à écrire).
> Close après confirmation des 4 points du §14 (AskUserQuestion, même
> session) : portée « pari oublié » confirmée telle quelle, quota en
> bandeau global unique, bouton « Signaler à un admin », tri par défaut
> accepté tel que proposé. Implémentation autorisée sous réserve du
> pré-vol §13.
>
> Distinct de « Nouveau pari » (création/édition, déjà codé, `/play/bets/
> new` + `/play/bets/[id]/edit`) : cet écran est la **consultation** de TOUS
> mes paris (tous statuts) + mes quotas — aucune création ni édition ici,
> seulement des liens vers les écrans qui le font déjà.

---

## 0. Sources et cadre

```text
Règles fonctionnelles : nba_pronos_decisions_0_2_4_paris_personnalises.md
  (quota, deadline, statuts, visibilité, refus/annulation) — décision
  fonctionnelle de référence pour tout ce lot.
Données   : SPEC_TECHNIQUE_MODELE_DONNEES_V0.1.md §3.10 (table `bets`,
  colonnes de résolution/refus/correction) ; §3.11 (`correction_requests`,
  déjà prête pour `target_type='BET'` mais aucune fonction ne l'utilise).
RLS       : SPEC_TECHNIQUE_RLS_V0.1.md — `bets_select` (propriétaire, admin,
  ou public à sa deadline via `bet_is_public()`) ; ce lot ne lit QUE la
  branche propriétaire (`user_id = auth.uid()`), la révélation publique
  étant reportée (voir préambule).
Précédent (prototype, hors dépôt V1 mais lu pour cadrer) :
  Cadrage/OLD/ETAT_DEVELOPPEMENT_PROTOTYPE.md §9 — l'écran équivalent y
  était VOLONTAIREMENT personnel (mes brouillons/mes paris), un écran PUBLIC
  séparé (jamais construit en V1) portait la vue « tout le monde ». Même
  choix reconduit ici pour V1 (décision confirmée avec l'utilisateur, pas
  seulement copiée).
```

## 1. Architecture

```text
Route (T6a, groupe (app), gardée par proxy.ts) : /play/bets — l'INDEX du
  dossier existant (aujourd'hui seuls `new/` et `[id]/edit/` y vivent, pas
  de page.tsx à la racine).

Hub Jouer temporaire (app/(app)/play/page.tsx) : l'entrée « Paris » pointe
  aujourd'hui directement vers /play/bets/new (faute de mieux, posé lors du
  lot Nouveau pari). CORRIGÉ par ce lot : pointe désormais vers /play/bets
  (ce nouvel écran), qui porte lui-même le lien vers /play/bets/new — même
  patron que Matchs/Mes pronos/Bracket personnel (le hub pointe vers
  l'écran de consultation, pas directement vers un formulaire de création).

Composants serveur par défaut. Aucune écriture complexe sur cet écran (la
  seule action, §7, est une simple création de ligne côté SECURITY DEFINER)
  — pas de brouillon local, pas d'état à maintenir entre les frappes.
```

## 2. Périmètre — **acté (27/07/2026)**

```text
PERSONNEL uniquement : cet écran n'affiche QUE les paris du joueur connecté
  (tous statuts), jamais ceux des autres joueurs. La révélation publique
  d'un pari ouvert (0.2.4 §9 — actée fonctionnellement, JAMAIS construite à
  ce jour, ni ici ni sur Matchs/Mes pronos malgré ce que suggérait le
  préambule de SPEC_ECRAN_NOUVEAU_PARI_V0_1) reste un point ouvert DISTINCT,
  reporté à un lot futur (GAPS_OUVERTS.md). La RLS `bet_is_public()`
  existe déjà et fonctionne (T3) — c'est une brique d'ÉCRAN qui manque,
  pas une brique de base.
```

## 3. Contenu affiché

```text
Liste de TOUS les paris du joueur dans la compétition ACTIVE, tous statuts
  confondus (DRAFT, SUBMITTED, VALIDATED, REJECTED, WON, LOST, CANCELLED).

Par ligne :
  - Cible : libellé série ou match (même construction que
    lib/queries/bets.ts / lib/queries/my-predictions.ts — team1_id/team2_id
    de la série, jamais les home/away d'un match qui peuvent être inversés).
  - Énoncé (description), catégorie et difficulté — VALIDÉE si présente,
    sinon PROPOSÉE (même règle que AssociatedBetCard de Mes pronos, §7.1
    ETAT_ACTUEL.md : `validated_category ?? proposed_category`, la validée
    fait foi, 0.2.4 §7 — extension déjà actée pour la catégorie par
    cohérence, pas une nouvelle règle ici).
  - Statut, rendu selon §5.
  - Si REJETÉ : motif du refus (`refusal_reason`).
  - Si GAGNÉ/PERDU : motif de résolution s'il existe (`resolution_reason`),
    points marqués (`points_awarded`) si GAGNÉ.
  - Si corrigé par un admin (`is_admin_corrected`) : badge générique, MÊME
    contrat que le badge « corrigé par un admin » de l'écran Matchs (booléen
    seul, pas de rendu nominatif ici — cet écran ne montre que MES propres
    paris, la nuance nominative de Mes pronos §7.1 concernait la vue des
    AUTRES joueurs, absente ici par construction).
```

## 4. Quotas — affichage

```text
Résumé de quota par série (Playoffs) ou par match (NBA Cup), réutilisant
  EXACTEMENT MATCH_SLOT_CAP (lib/labels/bets.ts, déjà la source unique du
  chiffre 3) — AUCUNE 2e implémentation du calcul de quota, seulement son
  AFFICHAGE (la garde réelle reste dans save_bet, migration #10).

Playoffs (0.2.4 §2) : par série active (au moins un pari du joueur dessus) —
  « 1/1 pari série » (booléen, un slot série au plus) + « X/3 paris match »
  (X = paris MATCH actifs, RELEASED_BET_STATUSES exclu — même filtre que
  lib/queries/bets.ts : REJECTED/CANCELLED libèrent toujours le slot).
NBA Cup (amendement 20/07/2026, decisions_nba_cup_mecanique_scoring.md §6) :
  pas de quota « par série » — 1 pari MAX par match, jusqu'à 7 sur toute la
  Cup. Affiché par match (« 1/1 » ou « 0/1 »), pas agrégé.
```

## 5. Rendu par statut — **acté (0.2.4 §4, 0.2.9)**

```text
DRAFT      : « Brouillon » — lien direct vers /play/bets/[id]/edit.
SUBMITTED  : « En attente de validation » — lien vers /play/bets/[id]/edit
             (le retrait/la ré-édition restent possibles avant deadline,
             déjà géré par l'écran d'édition existant).
VALIDATED  : « Validé — en jeu », difficulté/catégorie VALIDÉES affichées.
             Si la cible est déjà TERMINÉE (match/série `status='FINISHED'`)
             sans résolution : voir §7 (correction « pari oublié »).
REJECTED   : « Refusé » + motif, GRISÉ (pas barré — distinct d'un ANNULÉ,
             cohérence avec le rendu déjà acté pour CANCELLED, T6c/T7).
WON        : « Gagné » + points marqués, mise en valeur positive
             (--color-win, déjà un token existant).
LOST       : « Perdu », rendu NEUTRE — un perdu est un résultat de jeu
             normal, ni barré ni grisé (RÈGLE DÉJÀ ACTÉE, T6c ligne 228-229 :
             « un perdu n'est ni barré ni grisé, il reste un résultat de jeu
             normal, un annulé l'est »).
CANCELLED  : « Neutralisé » + raison si disponible, BARRÉ ET GRISÉ, 0 point
             sans pénalité — PLACÉ DANS LA LISTE au fil, PAS dans une
             section séparée (règle déjà actée, T6c ligne 230-231, reprise
             ici à l'identique).
```

## 6. Groupement / segments — **acté (27/07/2026)**

```text
Deux segments (même patron d'implémentation que SegmentTabs de Mes pronos,
  état dans l'URL, liens serveur natifs — mais un découpage PAR STATUT, pas
  par récence, plus pertinent pour un portefeuille de paris qu'un
  historique de matchs) :
  - « En cours »  : DRAFT, SUBMITTED, VALIDATED non résolu.
  - « Terminés »  : WON, LOST, REJECTED, CANCELLED.
Résumé de quota (§4) affiché en BANDEAU GLOBAL UNIQUE en tête du segment
  « En cours » (une ligne récapitulative par série/match actif) — pas
  dépliable individuellement.
Tri : par date de cible (scheduled_at du match, ou 1er match de la série)
  — le plus PROCHE en premier dans « En cours », le plus RÉCENT en premier
  dans « Terminés ». Confirmé tel que proposé.
```

## 7. Correction — « pari oublié » — **acté (27/07/2026)**

```text
Cas visé : un pari VALIDATED dont la cible (match ou série) est déjà
  `status='FINISHED'` mais qui n'a JAMAIS été résolu (WON/LOST) par un
  admin — équivalent du « match oublié » de Mes pronos (§8, 0.2.3 §7), mais
  adapté aux paris : PAS de « voie A » (créer une ligne vide) nécessaire ici
  puisqu'un pari existe TOUJOURS complet dès sa création (description et
  proposed_difficulty NOT NULL en base, contrainte héritée du prototype) —
  la requête de correction porte sur une ligne DÉJÀ existante, jamais à
  créer.

Le joueur peut signaler ce cas via un bouton **« Signaler à un admin »** sur
  une ligne VALIDATED dont la cible est FINISHED — crée une
  correction_requests (target_type='BET', target_bet_id, justification
  obligatoire, AUCUNE valeur proposée nécessaire ici — l'admin résout
  normalement ensuite via VALIDATED→WON/LOST, transition DÉJÀ autorisée par
  enforce_bet_transitions, migration #9, AUCUN changement de trigger
  nécessaire pour ce cas précis).

HORS PÉRIMÈTRE explicite de cette version (à rouvrir séparément si besoin,
  §12) : contester un REJETÉ (transition impossible aujourd'hui — REJECTED
  est un état TERMINAL dans enforce_bet_transitions, aucune règle ne permet
  d'en sortir, contrairement à VALIDATED) ; contester une résolution
  GAGNÉ/PERDU déjà posée (même blocage : WON/LOST sont terminaux). Les deux
  nécessiteraient une extension de trigger, pas seulement une nouvelle
  fonction — jugé hors périmètre de ce lot, qui se limite au cas où AUCUNE
  résolution n'a jamais eu lieu.
```

## 8. Écriture — server action

```text
requestBetCorrection(betId, justification) :
  Nouvelle fonction SQL SECURITY DEFINER (migration #11, à écrire — montrée
  intégralement et confirmée avant push, même patron que
  request_prediction_correction, migration #7) :
  - Garde-fous : auth.uid() propriétaire du pari ciblé ; joueur ACTIVE
    (is_active()) ; pari au statut VALIDATED ; cible (match ou série)
    effectivement FINISHED ; justification obligatoire ; au plus une
    requête PENDING à la fois pour ce pari (même index unique partiel que
    match_predictions, ou contrôle applicatif équivalent — à vérifier au
    pré-vol, §13).
  - AUCUNE écriture sur `bets` lui-même : seulement une ligne
    `correction_requests` (target_type='BET', target_bet_id=p_bet,
    justification=p_justification). L'admin résout ensuite NORMALEMENT
    (transition déjà permise, aucun contournement de trigger nécessaire).

Formulaire natif SANS JS, même patron que
  requestPredictionCorrectionFormAction (lib/actions/corrections.ts) :
  FormData brut, redirect après écriture.
```

## 9. États vides

```text
Aucun pari du tout          : « Tu n'as encore aucun pari. » + lien vers
                               /play/bets/new (« Créer un pari »).
Segment « En cours » vide   : « Aucun pari en cours. » + même lien.
Segment « Terminés » vide   : « Aucun pari terminé pour l'instant. »
Aucune compétition active   : « Aucune compétition en cours. » (même
                               libellé que les autres écrans du hub).
```

## 10. Contrats de types (esquisse, à figer en codant)

```ts
export type MyBet = {
  betId: string;
  scope: "SERIES" | "MATCH";
  targetLabel: string; // « 1er tour — BOS vs MIA » ou « Match 2 — 25/07 21:00 »
  description: string;
  category: BetCategory;       // validated_category ?? proposed_category
  difficulty: BetDifficulty;   // validated_difficulty ?? proposed_difficulty
  status: "DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED" | "WON" | "LOST" | "CANCELLED";
  isAdminCorrected: boolean;
  refusalReason: string | null;
  resolutionReason: string | null;
  pointsAwarded: number | null;
  isForgottenResolution: boolean; // VALIDATED + cible FINISHED, éligible §7
  hasPendingCorrectionRequest: boolean;
};

export type QuotaSummary =
  | { kind: "PLAYOFFS"; seriesLabel: string; seriesSlotUsed: boolean; matchSlotsUsed: number }
  | { kind: "NBA_CUP"; matchLabel: string; matchSlotUsed: boolean };

export type MyBetsData = {
  competitionId: string | null;
  ongoing: MyBet[];
  finished: MyBet[];
  quotas: QuotaSummary[]; // uniquement pour "En cours"
};
```

## 11. Règles de rendu (T7 — non négociables)

```text
- CSS Modules colocalisés lisant EXCLUSIVEMENT les tokens de app/tokens.css.
- Composants serveur par défaut. Le formulaire de correction (§8) suit le
  même patron que CorrectionRequestForm (Mes pronos) — à vérifier en codant
  s'il peut rester sans "use client" propre (pas d'état local complexe
  attendu, un seul champ texte + bouton).
- Logos de franchise via components/ui/TeamLogo.tsx (déjà partagé).
- CANCELLED : barré ET grisé. LOST : rendu neutre (surtout PAS le même
  traitement visuel que CANCELLED — règle déjà actée, §5).
- Aucune valeur visuelle en dur.
```

## 12. Hors périmètre de cet écran

```text
- Révélation publique des paris des AUTRES joueurs (0.2.4 §9) : reportée
  (décision explicite, §2/préambule) — reste un point ouvert distinct dans
  GAPS_OUVERTS.md, quel que soit l'écran qui l'accueillera un jour (Matchs,
  Mes pronos, ou potentiellement ici).
- Contester un pari REJETÉ ou déjà résolu GAGNÉ/PERDU (§7) : nécessiterait
  une extension de trigger (enforce_bet_transitions), pas seulement une
  fonction — hors périmètre de cette version.
- Création/édition de pari : déjà couvert par /play/bets/new et
  /play/bets/[id]/edit (Nouveau pari, §2.15 ETAT_ACTUEL.md) — cet écran ne
  fait QUE lier vers eux, jamais dupliquer leur formulaire.
- Catégorisation avancée / tri par catégorie en onglet : évoqué dans le
  prototype (jamais implémenté, jamais repris en V1) — hors périmètre.
- Pré-remplissage IA gagné/perdu (0.2.4 §10) : renvoyé à une spec technique
  distincte, non traité ici (GAPS_OUVERTS.md).
```

## 13. Vérifications de dépôt — à lever **avant** la 1re ligne de code

```text
1. RLS `bets_select` (migration #3) : confirmer que la branche
   `user_id = auth.uid()` suffit pour ce lot (aucun besoin de
   `bet_is_public()`, révélation reportée).
2. `enforce_bet_transitions` (migration #9) : confirmer que
   VALIDATED → WON/LOST reste bien autorisé SANS modification — la
   correction §7/§8 ne doit RIEN changer à ce trigger.
3. Existence réelle de `correction_requests` avec `target_type='BET'` et
   les colonnes `target_bet_id`/`proposed_description`/
   `proposed_difficulty`/`proposed_category` (relire le schéma réel, pas
   seulement ce document).
4. Index unique partiel sur `correction_requests` pour la garde « une seule
   PENDING à la fois » : vérifier s'il couvre déjà `target_bet_id` ou
   seulement `target_match_prediction_id` (migration #1) — sinon l'ajouter
   ou le vérifier applicativement dans la nouvelle fonction (§8).
5. Route `/play/bets` (index) confirmée absente sur le disque (seuls
   `new/` et `[id]/edit/` existent).
6. `MATCH_SLOT_CAP` (lib/labels/bets.ts) et `RELEASED_BET_STATUSES`
   (lib/queries/bets.ts, dupliqué dans lib/queries/matches.ts) : confirmer
   qu'ils restent importables tels quels pour le calcul d'affichage des
   quotas (§4), sans une 3e implémentation du filtre de statuts libérés.
```

## 14. Récapitulatif des décisions actées (27/07/2026)

```text
A. Portée « pari oublié » (§7/§8) : CONFIRMÉE telle que proposée — contester
   un refus/une résolution déjà posée reste hors périmètre (§12).
B. Tri par défaut des deux segments (§6) : CONFIRMÉ tel que proposé (le
   plus proche d'abord en cours, le plus récent d'abord terminé).
C. Libellé du bouton de signalement (§7) : « Signaler à un admin ».
D. Résumé de quota (§4) : bandeau global unique, pas dépliable par
   série/match.
```
