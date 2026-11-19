# Chantier : modifier un pari perso validé (1 fois, jusqu'au coup d'envoi)

Demande de Leopoldinho (chat Général, 18/11/2026) : pouvoir modifier un pari perso
après soumission (ex. pari à 6 pts qu'on veut rendre plus osé). Règle tranchée avec
l'utilisateur le 19/11/2026 : **une seule modification par cible (match ou série),
jusqu'au début du match / de la série.**

## Constat (étudié sur Opus le 19/11)
- L'IA valide le pari dès la soumission : il passe en `VALIDATED`, et ni
  `delete_bet` ni `withdraw_bet` ne l'acceptent (seulement `DRAFT`/`SUBMITTED`).
- Le trigger `enforce_bet_transitions` (dernière version : `20260728120000_contest_resolved_bet.sql`)
  interdit `VALIDATED → DRAFT`.
- `save_bet` (dernière version : `20261007100000_daily_match_guards.sql`) accepte de
  rééditer un `DRAFT` et remet `submitted_at = now()` à la soumission suivante.
- `update_bet_structuration` (`20261009090000_bets_calculability_diagnosis.sql`) écrase
  tous les champs `structured_*`, mais seulement sur un pari `SUBMITTED`.
- Le garde-fou de deadline existe déjà : `public.bet_deadline_open(scope, series_id, match_id)`.
- **La limite ne doit pas être une colonne de `bets`** : la policy `bets_update_self`
  (`20260718110000_rls.sql:254`) laisse un joueur modifier son pari DRAFT/SUBMITTED en
  REST, il pourrait donc remettre un compteur à zéro. Elle doit aussi survivre au
  contournement « supprimer puis recréer un pari sur le même match ».

## Étapes
1. **Migration** `supabase/migrations/20261119100000_bet_reopen.sql` :
   - table `bet_reopenings (id uuid pk, user_id uuid not null references users(id),
     bet_id uuid not null references bets(id), target_id uuid not null -- match_id si MATCH, series_id si SERIES,
     created_at timestamptz default now())`, avec un `unique (user_id, target_id)`.
     RLS activée, policy select `user_id = auth.uid()` seulement, aucune policy d'écriture.
   - `enforce_bet_transitions` redéfini en copie intégrale + une branche
     `old.status = 'VALIDATED' and new.status = 'DRAFT'`, autorisée seulement si
     `current_setting('app.bet_reopen', true) = 'on'` (posé en `set_config(..., true)`
     par `reopen_bet`), pour qu'un UPDATE REST ne puisse pas l'utiliser.
   - fonction `public.reopen_bet(p_bet_id uuid) returns void`, security definer,
     `search_path = public`. Elle vérifie : auth, `is_active()`, propriétaire, statut
     `VALIDATED`, `bet_deadline_open(...)`, et l'absence de ligne `bet_reopenings`
     pour (user, cible), sinon « Tu as déjà modifié ton pari sur ce match. ».
     Elle insère la ligne `bet_reopenings`, puis passe le pari en `DRAFT` en
     remettant à null `validated_category`, `validated_difficulty`, `validated_at`,
     `validated_by_admin_id`, `calculated_proba`, `suggested_difficulty`,
     `calculability_diagnosis`, tous les `structured_*` (`structured_negation` à null)
     et `is_calculable` (valeur par défaut). Elle garde la description.
   - `grant execute on function public.reopen_bet(uuid) to authenticated`, au même
     modèle que `delete_bet`.
   - Ensuite, vérifier qu'aucune requête de résolution ou de scoring (`lib/ai/resolve*.ts`)
     ne traite un pari DRAFT : elles filtrent normalement sur `VALIDATED`.
2. **Server action** `reopenBet(betId)` dans `lib/actions/bets.ts`, sur le modèle de
   `deleteBet` (rpc `reopen_bet`, puis revalidatePath `/play`, `/play/results`, `/home`).
3. **Données** : ajouter `canReopen: boolean` à `PlayAssociatedBet` (`lib/queries/play.ts:120`).
   Il vaut vrai si le statut est `VALIDATED`, la deadline encore ouverte (lignes à venir,
   `toPlayAssociatedBet` appelé l.604 avec `deadlineOpen=true`) et qu'aucune ligne
   `bet_reopenings` n'existe pour ce match. Une seule requête pour tous les matchs de la
   page, sans N+1. Toujours faux sur les lignes verrouillées (l.1036).
4. **Interface** `components/play/MatchBetZone.tsx`, état « soumis » :
   - un bouton « Modifier mon pari » si `serverSubmitted?.canReopen`, ou si
     `local?.validated` (stocker alors `betId` dans `LocalSubmission`) et `!locked` ;
   - au clic, une confirmation sur le modèle de `components/bets/DeleteBetButton.tsx` :
     « Tu ne pourras modifier ce pari qu'une seule fois. Il repasse en brouillon : pense
     à le resoumettre avant le coup d'envoi, sinon tu n'auras pas de pari sur ce match. » ;
   - si l'action réussit : `local = null`, `description` prérempli, `draftBetId = betId`,
     plus un état local `reopened` qui force l'état ouvert en attendant le rafraîchissement
     serveur. La resoumission passe par le `handleSubmit` existant.
   - Paris SÉRIE (Bracket, `FillSeriesCard`/`InlineBetForm`) : hors périmètre tant que
     les Playoffs n'ont pas commencé. Le SQL les couvre déjà.
5. **Tests** : un test unitaire sur `canReopen` si la logique est extraite en fonction
   pure. Lancer `npx tsc --noEmit`, `npm run lint` et `npx vitest run` (ignorer les
   erreurs préexistantes de `Cadrage/docs/reel*`). Pas de test Docker/e2e sans accord.

## Livraison
Branche `feat/modifier-pari-valide` partie de `origin/main`, puis une PR (l'utilisateur
merge lui-même). Revue `reviewer` avec model opus, car on touche aux données et au
trigger de statut. Après le merge, l'utilisateur lance `supabase db push --remote --yes`,
puis on vérifie avec `supabase migration list`.

## Risques
- Le joueur a déjà vu les paris des autres avant de modifier le sien. C'est accepté
  (une seule fois).
- Un joueur qui rouvre sans resoumettre perd son pari. Le dialogue le prévient.

## Critère de fin
Un pari validé peut être modifié une fois avant le coup d'envoi. Une deuxième tentative
(y compris après suppression puis recréation du pari) est refusée côté SQL. tsc, lint
et vitest sont au vert, et la PR est ouverte.

## Hors périmètre (signalé le 19/11)
La policy `bets_update_self` permet à un joueur, en REST, de faire passer son pari
`DRAFT → SUBMITTED → VALIDATED` avec la `validated_difficulty` de son choix. C'est une
faille préexistante, à traiter dans une PR séparée (toutes les écritures joueur passent
déjà par des RPC).
