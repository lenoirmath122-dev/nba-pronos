# NBA Pronos — SPEC TECHNIQUE — PARIS PERSOS PILOTÉS PAR LA PROBA V0.1

> **Nature** : proposition d'évolution du mécanisme des paris personnalisés
> (`T5 §8`, `decisions_0.2.4`). Remplace le choix manuel d'une difficulté par
> une probabilité calculée automatiquement, pour les paris que le modèle
> sait calculer.
>
> **Statut : PREMIÈRE VERSION CODÉE ET DÉPLOYÉE (21/08/2026)** — voir §7bis.
> Point 1 (modèle qui tourne), point 3 (pont contexte à jour) et point 4
> (structuration IA) sont FAITS. Points 2 (seuils calibrés — provisoires
> pour l'instant, à vue de nez) et 5 (barème du fallback — inchangé, pas de
> nouveau barème créé) restent ouverts, détail §7bis. Décisions de principe
> actées avec l'utilisateur le 19/08/2026 ; le modèle de probabilité tourne
> désormais pour de vrai (`Cadrage/Stats/projet-data-nba.md`, chantier Data
> NBA, service déployé §24 de ce document).
>
> **Dépend de** : `SPEC_TECHNIQUE_SCORING_V0_1.md` (T5 §8, moteur
> `scoreBet` — **reste intact**, non réouvert par cette spec) ;
> `decisions_0.2.4` (cycle de vie des paris persos, à amender) ;
> `Cadrage/Stats/projet-data-nba.md` (le modèle de probabilité lui-même,
> hors périmètre de cette spec — cette spec ne fait QUE consommer une proba
> déjà calculée).

---

## 1. Constat de départ

Aujourd'hui (`decisions_0.2.4`, `T5 §8`) : le joueur qui pose un pari perso
**propose** une difficulté (niveau 1 à 5), un admin la **valide**
(`validated_difficulty`), et le moteur pur `scoreBet(status,
validatedDifficulty)` transforme ça en points via un barème fixe :

```text
1 → 5 pts | 2 → 10 pts | 3 → 15 pts | 4 → 20 pts | 5 → 25 pts
```

Problème identifié par l'utilisateur : cette difficulté est **estimée à la
louche** par le joueur (ou l'admin), pas calculée — deux paris de même
"difficulté ressentie" peuvent avoir des probabilités réelles très
différentes.

## 2. Principe retenu

Remplacer l'estimation humaine par un calcul, **uniquement pour les paris
que le modèle sait calculer** (voir §4 pour le fallback) :

```text
Joueur saisit son pari perso (texte libre, inchangé)
        ↓
Joueur valide son pari
        ↓
[NOUVEAU] L'appli structure le pari (§3) et calcule sa probabilité (§5)
        ↓
[NOUVEAU] La probabilité choisit automatiquement le palier de difficulté (§5)
        ↓
scoreBet(status, validatedDifficulty) — INCHANGÉ (T5 §8)
```

**Le moteur T5 §8 n'est pas modifié.** Il continue de recevoir un
`validatedDifficulty` (1 à 5) et de produire des points selon le même
barème. Ce qui change se situe **entièrement en amont**, dans
`decisions_0.2.4` (comment `validated_difficulty` est déterminé) — T5 reste
validé et figé, non rouvert par cette spec.

## 3. Structuration du pari (texte libre → événement calculable)

**Décidé (19/08/2026)** : le joueur continue de saisir son pari en **texte
libre** (pas de formulaire guidé qui limiterait la créativité des paris) —
une **IA structure le pari** au moment de la validation, pour en extraire
un événement calculable : joueur/équipe concerné, statistique, seuil,
structure (seuil supérieur/inférieur, exact, combiné...).

Précédent connu : l'ancien suivi manuel des playoffs 2026 (classeur
`Cadrage/DA/🏀 NBA Pronos - 22_04_2026 (réponses) (1).xlsx`, feuille
`PARIS_PERSOS_CATEGORIES`) avait déjà ce besoin, avec des colonnes `Dernière
classification IA`/`Source classification`/`Erreur IA` — la structuration
IA d'un pari perso n'est donc pas une idée neuve, juste jamais automatisée
dans l'appli.

**Non tranché à ce stade** (à spécifier à la reprise) : quel modèle/prompt
exact, où vit cet appel dans le code (à la validation ? en tâche de fond
après ?), comment gérer une classification ambiguë ou ratée (cf. colonne
`Erreur IA` de l'ancien classeur — déjà un vrai problème observé).

## 4. Paris non calculables — fallback

D'après la taxonomie réelle du classeur (`Cadrage/Stats/projet-data-nba.md`
§8), environ **1/3** des paris persos historiques sont trop hétérogènes
pour être calculés automatiquement (Fun/hors terrain, Scénario, Combo
multi-conditions...).

**Décidé (19/08/2026)** : ces paris **retombent sur le mécanisme actuel**
(difficulté proposée par le joueur, validée par l'admin) — aucune
régression, la proba automatique s'ajoute pour les cas calculables sans
retirer la flexibilité existante.

**Non tranché** : le barème de ce fallback reste-t-il le même
(5/10/15/20/25) ou faut-il le revoir séparément, maintenant que le barème
"calculé" et le barème "manuel" coexistent ? Note explicite de
l'utilisateur : "à voir pour le barème" — question ouverte, pas une
décision.

## 5. Formule probabilité → points

**Décidé (19/08/2026)** : garder les **5 valeurs de points actuelles**
(5/10/15/20/25) — la probabilité calculée détermine automatiquement quel
palier s'applique, à la place d'un choix humain. Écarté : une formule
continue type cote de paris (points ∝ 1/proba) — changerait l'équilibre du
jeu (les paris persos plafonnent aujourd'hui à 25 pts, bien sous le
bracket) pour un gain de fidélité jugé pas prioritaire.

**Non tranché, bloquant pour finaliser cette spec** : les **seuils exacts**
entre paliers (à partir de quelle probabilité un pari est "niveau 5" /
25 pts, vs "niveau 1" / 5 pts). Nécessite une distribution réelle de
probabilités calculées sur un échantillon de paris historiques pour
calibrer (ex : quintiles de la distribution réelle, pour que chaque palier
soit utilisé à peu près aussi souvent) — impossible sans un modèle qui
tourne (`Cadrage/Stats/projet-data-nba.md` §11).

## 6. Figeage de la probabilité (P10)

**Décidé (19/08/2026)** : la probabilité calculée doit être **figée au
moment de la validation du pari**, jamais recalculée après coup (même si
les stats évoluent ensuite, même si le modèle est réentraîné) — même
logique que l'invariant **P10** de T5 (une prédiction figée est
intouchable). Le pari garde le palier qui lui a été attribué à sa
validation.

## 7. Ce qui manque avant de pouvoir coder

```text
1. Un modèle de probabilité qui tourne pour au moins 1 catégorie calculable
   (seuil de points joueur — la plus fréquente, cf. projet-data-nba.md §8).
2. Une distribution réelle de probas sur un échantillon de paris pour
   calibrer les seuils entre paliers (§5).
3. Le pont technique features "à jour" (pas seulement l'historique figé de
   nba.db) — pas construit, nécessaire pour calculer une proba au moment
   réel où un joueur valide un pari.
4. Le mécanisme exact de structuration IA (§3) — prompt, gestion d'erreur.
5. Le barème du fallback (§4) — question ouverte, pas juste un détail
   d'implémentation.
```

Cette spec sera complétée/validée point par point au fur et à mesure que
ces briques existeront, en commençant par le point 1 (voir
`Cadrage/Stats/projet-data-nba.md` §11 pour la suite prévue côté modèle).

## 7bis. Implémentation réelle (21/08/2026)

```text
Points 1/3/4 FAITS :
1. Modèle qui tourne : les 12 modèles (Cadrage/Stats/models/*.joblib),
   réentraînés sur 5 saisons (projet-data-nba.md §21).
3. Pont contexte à jour : micro-service Python déployé sur Google Cloud
   Run (§24), architecture sans état -- les stats vivent dans Supabase
   (stats_equipes/stats_joueurs/stats_matchs/stats_box_scores),
   rafraîchies chaque jour (§25/§26).
4. Structuration IA : Claude Opus 5 (lib/ai/structureBet.ts), sortie
   structurée via client.messages.parse() + zodOutputFormat -- extrait
   {calculable, player_name, stat, threshold, comparison, reasoning}.
   calculable=false pour tout ce qui sort des 12 stats du modèle (paris
   équipe, combo multi-joueurs, score total, fun/hors-terrain, scénario,
   formulation ambiguë) -- retombe alors intégralement sur le mécanisme
   manuel existant (§4), zéro changement de comportement dans ce cas.
```

**Où ça vit dans le code, décidé le 21/08/2026** (répond au point non
tranché de §3 -- "où vit cet appel ? à la validation ? en tâche de
fond ?") : **synchrone, à la SOUMISSION du pari** (`submitBet`,
`lib/actions/bets.ts`), pas à la validation admin. Orchestré par
`lib/ai/structureAndScoreBet.ts` : structuration IA -> appel au
micro-service (`lib/ai/statsService.ts`, `POST /predict`) -> conversion
proba->palier (`lib/ai/difficultyTiers.ts`) -> écriture figée via une
nouvelle fonction SQL `update_bet_structuration` (SECURITY DEFINER, même
patron que `save_bet`/`withdraw_bet`/`delete_bet` -- session utilisateur,
jamais service_role). **Best-effort de bout en bout** : toute panne (clé
API absente, timeout Cloud Run, joueur non trouvé, stat non calculable)
laisse le pari soumis normalement, avec le flux manuel existant intact --
rien de cette chaîne ne peut faire échouer une soumission de pari.

**Nouvelles colonnes** (migration `20260821150000_bets_ai_structuration.sql`,
toutes NULLABLES) : `structured_player_name`, `structured_stat`,
`structured_threshold`, `structured_comparison` (OVER/UNDER),
`is_calculable`, `calculated_proba`, `suggested_difficulty`. Figées à la
soumission (P10), jamais recalculées après (même si le modèle est
réentraîné ou la stat rejouée).

**UNDER approximé** : le micro-service ne calcule que P(stat > seuil). Pour
un pari UNDER, `statsService.ts` utilise `1 - P(stat > seuil)` -- ignore
`P(stat == seuil)` pile sur le seuil, écart mineur assumé pour ce 1er jet.

**Auto-validation, PAS "admin reste dans la boucle"** -- design révisé le
21/08/2026 en cours de vérification réelle : la 1re version (ci-dessus,
admin garde la main via `ValidationBetCard.tsx`) ne correspondait PAS à ce
que l'utilisateur avait en tête ("ça affiche au joueur la probabilité au
moment de la validation, auto-validation mais encore corrigable par
l'admin si besoin"). Corrigé : un pari calculable saute la file
d'attente admin -- `update_bet_structuration` (migration
`20260821160000_bets_ai_auto_validation.sql`) passe directement
SUBMITTED -> VALIDATED (`validated_category` = catégorie proposée,
`validated_difficulty` = palier suggéré, `validated_by_admin_id` = NULL --
signal distinctif "validé par l'IA, pas un humain"). 2 conséquences
actées avec l'utilisateur :
1. **La proba est montrée au JOUEUR, mais seulement une fois `VALIDATED`**
   (jamais avant, pour ne pas influencer son choix de pari) --
   `BetBlock.tsx` (onglet "Mes pronos"), pas la page profil public
   `/players/[userId]` (écartée : montre la même vue à tout le monde par
   principe documenté, et ne révèle un pari qu'à la deadline publique, pas
   à la validation -- mauvais timing).
2. **Correction admin après coup** : aucun mécanisme existant ne couvrait
   ce cas (le système de demande de correction est joueur-initié, ne
   permet pas de réviser une difficulté sur un pari qui RESTE VALIDATED) --
   nouvelle action `overrideAutoValidatedDifficulty`
   (`lib/actions/admin-validation.ts`), nouvelle section "Auto-validés par
   l'IA" sur `/admin/validation` (pas `/players/[userId]`, écarté pour la
   même raison "même vue pour tout le monde").

**Point 2 (seuils calibrés) -- PAS FAIT, provisoire assumé** : décidé avec
l'utilisateur de livrer une version qui marche maintenant plutôt que
d'attendre une vraie distribution de probas sur un échantillon de paris
réels. `lib/ai/difficultyTiers.ts` pose des seuils "à vue de nez" (>=80% ->
palier 1, >=60% -> palier 2, >=40% -> palier 3, >=20% -> palier 4, sinon
palier 5) -- À RECALIBRER une fois assez de paris réels structurés pour
observer la vraie distribution.

**Point 5 (barème du fallback) -- PAS TRANCHÉ, statu quo assumé par
défaut** : aucun nouveau barème créé pour les paris non calculables, ils
utilisent le mécanisme manuel existant tel quel (`proposed_difficulty`/
`validated_difficulty`, `BET_DIFFICULTY_POINTS`) -- la question "faut-il un
barème séparé ?" (notée "à voir" par l'utilisateur le 19/08) reste
explicitement ouverte, pas juste oubliée.

**Vérifié** : `tsc`/`eslint`/`vitest` (37/37)/`next build` (38 routes)
propres. Migration poussée sur la base réelle. **Pas encore vérifié en
conditions réelles au clic** : nécessite `ANTHROPIC_API_KEY` et
`STATS_SERVICE_URL` configurées (Vercel + `.env.local`), pas encore fait
par l'utilisateur -- voir `GAPS_OUVERTS.md`.
