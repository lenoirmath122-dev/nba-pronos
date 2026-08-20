# NBA Pronos — SPEC TECHNIQUE — PARIS PERSOS PILOTÉS PAR LA PROBA V0.1

> **Nature** : proposition d'évolution du mécanisme des paris personnalisés
> (`T5 §8`, `decisions_0.2.4`). Remplace le choix manuel d'une difficulté par
> une probabilité calculée automatiquement, pour les paris que le modèle
> sait calculer.
>
> **Statut : PROPOSITION, EN PAUSE — aucune implémentation commencée.**
> Décisions de principe actées avec l'utilisateur le 19/08/2026, mais la
> spec n'est **pas** finalisable tant qu'un modèle de probabilité ne tourne
> pas pour de vrai (dépendance : `Cadrage/Stats/projet-data-nba.md`,
> chantier Data NBA). Reprise prévue après un premier modèle jetable
> entraîné et vérifié sur un cas connu.
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
