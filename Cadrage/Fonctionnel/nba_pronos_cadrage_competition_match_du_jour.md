# Cadrage — compétition « Match du jour »

> Cadrage du 06/10/2026, construit avec l'utilisateur. Aucun code écrit à ce
> stade. Objet : une compétition de test/recrutement qui occupe la pause entre
> l'alpha et la vraie NBA Cup (phase finale 4→11/12/2026). Contexte :
> `Cadrage/Business/panier_ballon_plan_recrutement_octobre_decembre.md`.

## 1. Principe

Un nouveau type de compétition, `DAILY_MATCH`. Chaque jour de la saison
régulière NBA (hors présaison), **un seul vrai match** est tiré au hasard
parmi ceux du jour. Les joueurs pronostiquent ce match (vainqueur + écart) et
peuvent poser **un pari personnalisé IA par match**. Un classement cumulé court
sur toute la période.

- **Début** : 20/10/2026 (ouverture de la saison). Repli : 01/11/2026.
- **Fin** : une semaine avant la phase finale de la Cup, soit ~27/11/2026.
  La compétition doit être clôturée avant la création de la vraie Cup (une seule
  compétition `ACTIVE` à la fois, `lib/actions/admin-competitions.ts:56-62`).
- **Pas de série ni de bracket côté joueur et admin** : aucun écran, libellé
  ou règle n'en parle. Seulement « le match du jour ».

## 2. Décisions prises (06/10/2026)

| Sujet | Décision |
|---|---|
| Modèle de données | Nouvelle valeur d'enum `DAILY_MATCH`. `series_id` reste `NOT NULL` : une ligne de série **technique, invisible** est créée en coulisse pour chaque match (option 1). Pas de refonte du modèle. |
| Barème | **Option B** : prono inchangé (10 pts vainqueur + 0 à 5 d'écart), **paris pondérés** (×0,6 pressenti, soit 3 à 15 pts au lieu de 5 à 25) pour que le prono reste le cœur du jeu. Coefficient exact à cadrer. |
| Paris personnalisés | Gardés, un par match (`uniq_active_match_bet` le garantit déjà). Pari scope SÉRIE interdit pour ce type. |
| Tirage | Script admin, sur le modèle de `scripts/nba-cup-*.mjs`, graine aléatoire journalisée, `--dry-run`, retirage d'un jour. Filtre sur les 30 franchises mappées et sur la date de début. |
| Jour de référence | Jour calendaire New York (Highlightly). Affichage en Europe/Paris : un match à 19h ET apparaît le lendemain côté Paris, à expliquer aux joueurs. |

## 3. Sondage Highlightly du 06/10/2026 (lecture seule, 11 appels)

- Le calendrier 2026-27 **est publié mais incomplet** : présent jusqu'au 07/11
  au moins (3 matchs le 20/10, 4 le 01/11, 14 le 04/11, 7 le 07/11), **vide du
  10/11 au 27/11** (6 dates sondées). Le 27/11 vide prouve que ce n'est pas un
  vrai jour sans match : Highlightly charge le calendrier par lots.
- **Aucun champ ne distingue présaison et saison régulière** : le 10/10
  (présaison) et le 20/10 portent tous deux `season: 2027`
  (`RawMatch`, `lib/nba/client.ts:32-45`). Le filtre se fait par date, début fixé
  à la main.
- Conséquence : le pré-tirage complet est impossible aujourd'hui. **Tirer par
  lots** (ce qui est publié), relancer quand Highlightly charge la suite ; cron
  de rattrapage à J-3 envisageable si le calendrier tarde.
- Quota consommé : 13 requêtes sur 100 ce jour-là (le tirage complet en demande
  ~38, à lancer en deux fois ou un jour où les crons consomment peu).

## 4. Pourquoi pas `NBA_CUP` tel quel (vérifié par l'architect)

- ~38 séries ouvertes sans `bracket_deadline` laisseraient écrire des picks de
  bracket indéfiniment (RLS, `20260718110000_rls.sql:74,216-229`), 20 pts par
  bon pick (`engine.ts:213`) en plus du prono.
- L'écran Jouer afficherait « 0/38 » et une pastille « 9+ »
  (`components/play/BracketEntry.tsx:36,54`).
- La synchro (`lib/sync/schedule.ts:60-67,146-160`) rattache un match inconnu à
  toute série ouverte ayant la même paire d'équipes : un second BOS-NYK serait
  inséré en `game_number 2` d'une autre série.

## 5. Fichiers à toucher (inventaire de l'architect, à reconfirmer à l'implémentation)

- **DB** : migration A `ALTER TYPE competition_type ADD VALUE 'DAILY_MATCH'`
  (seule dans sa transaction) ; migration B (`save_bet` interdisant SERIES hors
  PLAYOFFS, fermeture du bracket pour ce type, contrainte `game_number=1`).
  Après merge : `supabase migration list` puis push (voir
  `audit/RUNBOOK_MIGRATIONS.md`). Vigilance DATA-001 : revoir tous les objets
  dépendants de l'enum.
- **Sync** : `lib/sync/schedule.ts:139` — pour `DAILY_MATCH`, ne jamais créer
  de match inconnu, seulement mettre à jour ceux déjà mappés.
- **Scoring** : `engine.ts:23,79`, `recompute.ts:150`, `engine.test.ts` ;
  pondération des paris via un paramètre de `scoreBet`.
- **UI** : unions `"PLAYOFFS" | "NBA_CUP"` (`lib/queries/play.ts`,
  `match-bets.ts`, `bets.ts`, `BetForm.tsx`), bracket masqué
  (`BracketEntry.tsx`, `app/(app)/play/bracket/page.tsx`, `app/bracket/page.tsx`),
  libellés et règles (`lib/labels/rounds.ts`, `components/regles/*`, etc.).
- **Admin** : `lib/actions/admin-competitions.ts`, page de création,
  `lib/queries/admin-results.ts:142` (saisie manuelle des résultats).
- **Récaps, badges** : aucun changement de code ; les badges de bracket restent
  inactifs.

## 6. Cas particuliers

- **Annulation** : neutralisée, 0 point pour tous (`engine.ts:167`).
- **Report** : si Highlightly garde le même id, `scheduled_at` est mis à jour et
  le match change de jour. Si l'id change, le match reste `POSTPONED` : retirage
  manuel si aucun prono validé, sinon neutralisation. Statut jamais observé en
  vrai (`client.ts:106-116`).
- **Jour sans match** : journalisé et sauté.
- **Match terminé après minuit ET** : `syncResults` ne lit que la date du jour
  (`results.ts:53`), risque que ce match ne soit jamais relevé. **À vérifier
  avant de lancer.**

## 7. Effort estimé : 4 à 5 jours

DB 0,5 j · moteur et sync 0,5 j · script de tirage 1 j · UI et règles 1,5 j ·
admin 0,5 j · tests d'intégration 0,5-1 j (Docker : demander à l'utilisateur
avant, voir sa règle).

## 8. Points tranchés le 06/10/2026 (seconde session)

1. **Pondération des paris : ×0,6** (3 / 6 / 9 / 12 / 15 pts, entiers, un pari
   max = un prono max). Section dédiée « Match du jour » dans `/regles`,
   affichée seulement quand ce type de compétition est actif.
2. **Publication à 10h Paris le jour NY du match, avec notification push.**
   Tous les matchs NBA démarrent vers 18h Paris au plus tôt : la fenêtre est
   toujours d'au moins 8h, aucune règle spéciale pour un match tôt. Les matchs
   tirés pour des jours futurs doivent être **masqués côté joueur** (filtre de
   date : la RLS les laisserait visibles). Le push réutilise l'infrastructure
   des récaps (`lib/push/send.ts`, workflow à 10h Paris). À trancher à
   l'implémentation : un push séparé du récap, ou un seul push groupé, pour ne
   pas envoyer deux notifications à la même heure.
3. **Tirage aléatoire pur**, retirage admin possible avant publication
   (`--dry-run`, graine journalisée). Pas de pondération par intérêt.
4. **Décalage New York / Paris** : la carte affiche « Match du JJ/MM » (jour
   NY) et l'heure Paris ; si le coup d'envoi passe minuit à Paris, un
   sous-titre ajoute « dans la nuit du JJ au JJ+1 ». Une phrase d'explication
   dans les règles.
5. **Match fini après minuit ET : risque confirmé** (`lib/sync/results.ts:53`
   n'interroge que la date NY du jour, cron toutes les 30 min). Correctif
   retenu : interroger **aussi la veille NY** pendant les premières heures NY
   (~12 requêtes/jour de plus). Touche aussi les Playoffs : **PR séparée,
   avant le Match du jour**.
6. **Quota API : tirage par lots de 7 à 10 jours**, lancés un soir où les
   crons consomment peu. Premier lot avant le 20/10 (calendrier publié
   jusqu'au 07/11 au moins), second quand Highlightly charge la suite.

Effort : +0,5 j pour la notification (total estimé 4,5 à 5,5 jours) et une
petite PR distincte pour le correctif du point 5.

## 9. Suite

1. PR de correctif « veille NY » (point 5), indépendante.
2. Implémentation du type `DAILY_MATCH` (§5), conversation et branche dédiées.
3. Premier lot de tirage avant le 20/10, repli au 01/11 si l'implémentation
   n'est pas prête.
