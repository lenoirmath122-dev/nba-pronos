# Audit — Les 429 paris, un par un (24/08/2026)

> Chaque sous-catégorie du corpus de cadrage
> (`Cadrage/Stats/types_de_paris_playoffs_2026.md`, 429 paris, cadré le
> 23/08/2026) confrontée au code réellement en place au 24/08/2026 —
> géré, partiellement, ou pas du tout, et pourquoi. Établi juste après le
> chantier "pari période" (dernier morceau de la liste), à la demande de
> l'utilisateur pour faire le point avant de décider quoi reprendre
> ensuite.
>
> Version visuelle (tableau consultable) publiée en Artifact le
> 24/08/2026 : https://claude.ai/code/artifact/74681b94-e5a3-4566-b399-bef6cf98feb5

## Résumé

Sur les 393 paris réellement dans le périmètre du calcul automatique
(429 moins les 36 "Aucun pari"/"Fun"/"Invalide"/"Ambigu", hors périmètre
par conception, pas des trous) :

- **273 géré** (~69%) — même mécanisme déjà existant, souvent déjà testé
- **66 partiel** (~17%) — une partie des formulations passe, d'autres non
- **54 non géré** (~14%) — aucun mécanisme, retombe sur la validation
  manuelle admin

Les statuts "géré" s'appuient sur des tests réels déjà effectués (cette
session ou des chantiers précédents documentés dans
`JOURNAL_SESSIONS.md`) ; quelques cas "partiel" sont marqués comme tels
faute de test explicite plutôt que par certitude d'échec (signalé au cas
par cas ci-dessous).

## 10 causes racines

54 lignes "non géré" et 66 "partiel", mais seulement 10 raisons de fond
derrière — la plupart des trous sont la même limite qui revient sous un
autre habillage.

1. **Sous-ensemble de roster** — "le 5 majeur", "le banc", "les joueurs
   dont le nom commence par H" : aucun mécanisme ne définit un groupe de
   joueurs autrement qu'en les nommant un par un. (cat. 1, 5, 6, 7)
2. **Comptage sur tout le roster** — "au moins 8 joueurs marquent 11+
   points", "un joueur réalise un triple-double" (lequel ?) : compter
   combien de joueurs remplissent une condition n'existe pas comme
   opération. (cat. 6, 7, 8)
3. **Superlatif implicite** — "marque plus que tout autre joueur du
   match" compare contre un ensemble non borné, pas contre un seuil ou un
   adversaire nommé. (cat. 1, 4)
4. **Égalité exacte** — "le même nombre de minutes" : exclu explicitement
   du schéma duel dès sa conception, jamais construit. (cat. 4)
5. **OU logique** — entre 2 joueurs ("Hauser OU Pritchard") ou imbriqué
   dans un ET ("40pts ET (20reb OU 20pass)") : le schéma combo ne sait
   exprimer qu'un ET entre conditions. (cat. 1, 7)
6. **Stat jamais modélisée** — fautes techniques, temps morts, blessures,
   +/- : la donnée n'existe dans aucune table, pas juste absente du
   schéma IA. (cat. 5, 8)
7. **Événement granulaire play-by-play** — buzzer beater, "contre SUR un
   joueur précis", retour en zone : demande une attribution possession
   par possession jamais câblée côté paris. (cat. 4, 8)
8. **Comptage exact hors période** — score exact, "exactement 15 paniers
   à 3 points" : le mécanisme "exactement N" n'existe que pour les
   quarts-temps gagnés (chantier période), nulle part ailleurs. (cat. 3, 5)
9. **Combo mélangeant période et non-période** — "tirent à 32% ET
   remportent les 4 quarts-temps" : vérifié en conditions réelles ce
   jour, rejeté proprement, mais aucune des 2 briques ne sait accueillir
   l'autre. (cat. 5)
10. **Formulation vague — rejet voulu** — "la meilleure équipe gagne",
    "mauvaise performance", "action litigieuse constatée" : pas un manque
    technique, le principe du projet est de ne jamais forcer une
    extraction incertaine. (cat. 2, 5, 8 — par conception)

## 1 · Pari joueur — 163 paris (152 géré, 11 non géré)

| Sous-catégorie | N | Statut | Pourquoi |
|---|--:|---|---|
| Points joueur | 72 | Géré | bet_subject=PLAYER, stat=pts |
| Stat joueur combinée | 18 | Géré | PLAYER stat=td, ou COMBO pour les variantes multi-stats |
| Rebonds joueur | 9 | Géré | PLAYER stat=reb |
| 3 points joueur | 9 | Géré | PLAYER stat=fg3m |
| Pourcentage tir joueur | 9 | Géré | PLAYER stat=ft/fg/fg3 (Beta-Binomial) |
| Double-double | 8 | Géré | PLAYER stat=dd, ou COMBO (2 stats) |
| Triple-double | 7 | Géré | PLAYER stat=td |
| Meilleur marqueur | 6 | **Non géré** | superlatif implicite (03) — "plus que tout autre joueur" |
| Combo points + passes | 4 | Géré | COMBO, 2 conditions |
| Tentatives joueur | 3 | Géré | PLAYER stat=fga/fg3a |
| Cumul points joueurs | 3 | **Non géré** | sous-ensemble de roster (01) — nationalité, initiale du nom |
| Passes joueur | 2 | Géré | COMBO, somme sur 2 joueurs nommés |
| Contres joueur | 2 | Géré | PLAYER stat=blk |
| Cumul statistiques joueurs | 2 | Géré | COMBO, 2 conditions multi-joueurs |
| PRA joueur | 2 | Géré | COMBO, 1 condition 3 stats sommées |
| Combo multi-conditions | 2 | Géré | COMBO, 2 conditions même joueur |
| Pourcentage 3 points joueur | 1 | **Non géré** | OU logique (05) — "Hauser OU Pritchard" |
| Combo points + rebonds | 1 | Géré | COMBO, 2 conditions |
| Interceptions joueur | 1 | Géré | COMBO, somme sur 2 joueurs |
| Rebonds offensifs équipe* | 1 | Géré | *mal classé dans le corpus, en fait PLAYER stat=oreb |
| Performance joueur spécifique | 1 | **Non géré** | % des points PROPRES sur une période — testé ce jour, rejet confirmé (distinct d'un seuil brut) |

## 2 · Pari période — 47 paris (42 géré, 5 partiel)

Chantier livré et testé en conditions réelles le 24/08/2026 (équipe +
joueur) — le plus récent et le plus complètement vérifié de tout le
corpus.

| Sous-catégorie | N | Statut | Pourquoi |
|---|--:|---|---|
| Scénario mi-temps / fin de match | 11 | Géré | LEADS_HALF_RESULT — testé en prod (Cleveland) |
| Quarts-temps gagnés | 10 | Géré | QUARTERS_WON_COUNT — testé en prod |
| Vainqueur quart-temps | 6 | Géré | QUARTER_WINNER — testé en prod (Denver) |
| Performance quart-temps | 5 | Partiel | "gagne chacun des 4" géré (QUARTERS_WON_COUNT) ; "perd son avance OU mauvaise perf" rejeté (formulation floue + OU, 10) |
| Vainqueur mi-temps | 3 | Géré | HALF_WINNER — testé en prod |
| Prolongation | 3 | Géré | reste MATCH_TOTAL/went_to_ot — exclusion vérifiée en prod |
| Écart période | 3 | Géré | MARGIN ou HALF_WINNER selon formulation |
| Écart de points | 2 | Géré | MARGIN cumulatif — testé en prod (Minnesota/GSW) |
| Score exact | 1 | Géré | "égalité + prolongation" = trivialement went_to_ot |
| Cumul points joueurs* | 1 | Géré | *mal classé, en fait TOTAL_POINTS combiné sur la période |
| Répartition points équipe | 1 | Géré | POINT_SHARE_PCT — testé en prod (Lakers) |
| Total points période | 1 | Géré | TOTAL_POINTS — testé en prod |

## 3 · Score / total match — 39 paris (32 géré, 1 partiel, 6 non géré)

| Sous-catégorie | N | Statut | Pourquoi |
|---|--:|---|---|
| Total points match | 24 | Géré | MATCH_TOTAL stat=total_points |
| Score exact | 6 | **Non géré** | comptage exact hors période (08) — aucune prédiction jointe du score des 2 équipes |
| Total points équipe | 4 | Géré | TEAM_STAT stat=pts |
| Prolongation | 4 | Géré | MATCH_TOTAL went_to_ot |
| Points équipe | 1 | Partiel | plage "entre 101 et 110" — probablement exprimable en 2 conditions COMBO, jamais vérifié en réel |

## 4 · Comparaison / duel — 36 paris (25 géré, 6 partiel, 5 non géré)

| Sous-catégorie | N | Statut | Pourquoi |
|---|--:|---|---|
| Comparaison pourcentage tir | 7 | Géré | COMPARISON, stats équipe pct, DIFF_LT |
| Duel points | 6 | Géré | COMPARISON, GT/DIFF_LT |
| Duel statistiques | 5 | Partiel | stats croisées (blk vs stl) géré structurellement ; "même nombre de minutes" = égalité exacte, exclue (04) |
| Comparaison pourcentage 3 points | 3 | Géré | COMBO, 2 conditions équipe indépendantes |
| Meilleur marqueur | 3 | **Non géré** | superlatif implicite (03) |
| Points joueur | 2 | Géré | COMPARISON, joueur vs somme de 2 joueurs |
| Cumul points joueurs | 2 | Géré | COMPARISON, somme de 3 vs somme de 3 |
| Comparaison équipe | 2 | Géré | COMPARISON équipe, avec multiplicateur si besoin |
| Comparaison volume tirs | 1 | Partiel | DIFF_LT sur tirs tentés équipe — code fga à confirmer dans la liste comparaison équipe |
| Contres joueur | 1 | Géré | COMPARISON, blk vs blk |
| Égalité statistique | 1 | **Non géré** | comptage roster-wide (02) + égalité exacte (04) cumulés |
| Rebonds équipe | 1 | Géré | COMPARISON, reb vs reb |
| Duel contres | 1 | **Non géré** | événement granulaire (07) — "contre SUR un joueur précis" = attribution possession par possession |
| Duel rebonds | 1 | Géré | COMPARISON, reb vs reb |

## 5 · Pari équipe — 34 paris (15 géré, 14 partiel, 5 non géré)

| Sous-catégorie | N | Statut | Pourquoi |
|---|--:|---|---|
| Pourcentage tir équipe | 7 | Géré | TEAM_STAT ft/fg/fg3 |
| Performance collective | 6 | Partiel | "FG% > 50%" géré ; "la meilleure équipe gagne" = vague, rejet voulu (10) |
| Pourcentage 3 points équipe | 6 | Partiel | 2 conditions équipe indépendantes géré ; combo mélangeant période (09) rejeté — vérifié ce jour |
| Points équipe | 4 | Géré | TEAM_STAT stat=pts |
| Répartition points équipe | 2 | **Non géré** | sous-ensemble de roster (01) — "5 majeur", "titulaires" |
| Pourcentage lancers francs équipe | 2 | Partiel | comparaison FT% géré ; "LF suite à fautes personnelles" formulation ambiguë, à vérifier |
| Cumul points joueurs | 1 | **Non géré** | sous-ensemble de roster (01) — "5 majeur des Lakers" non nommé |
| 3 points joueur* | 1 | **Non géré** | *en fait équipe — "exactement 15" = comptage exact hors période (08) |
| Rebonds équipe | 1 | Géré | TEAM_STAT stat=reb |
| Interceptions équipe | 1 | Géré | TEAM_STAT stat=stl |
| Rebonds offensifs équipe | 1 | Géré | MATCH_TOTAL total_oreb |
| Combo multi-conditions | 1 | Géré | COMBO, 2 conditions équipe |
| Points du banc | 1 | **Non géré** | sous-ensemble de roster (01) — "le banc" non défini |

## 6 · Rotation / temps de jeu — 33 paris (25 partiel, 8 non géré)

| Sous-catégorie | N | Statut | Pourquoi |
|---|--:|---|---|
| Temps de jeu joueur | 14 | Partiel | seuil de minutes géré (PLAYER stat=min, y compris par période) ; "exactement 0 minute en Q4" = comptage exact hors période (08) |
| Temps de jeu cumulé | 7 | Partiel | joueurs nommés géré (COMBO) ; filtre par initiale du nom = sous-ensemble de roster (01) |
| Minutes jouées | 4 | Partiel | joueur nommé géré ; "les deux 5 majeurs" = sous-ensemble de roster (01) |
| Points du banc | 4 | **Non géré** | sous-ensemble de roster (01) |
| Nombre de joueurs utilisés | 3 | **Non géré** | comptage roster-wide (02) |
| DNP / joueur ne joue pas | 1 | **Non géré** | comptage roster-wide (02) |

## 7 · Combo multi-joueurs — 21 paris (3 géré, 15 partiel, 3 non géré)

| Sous-catégorie | N | Statut | Pourquoi |
|---|--:|---|---|
| Combo multi-conditions | 13 | Partiel | l'essentiel géré (ET entre conditions) ; OU imbriqué dans un ET explicitement exclu (05) |
| Cumul points joueurs | 2 | Partiel | 2 joueurs nommés géré ; "10 titulaires marquent chacun 8+" = sous-ensemble + comptage (01+02) |
| Nombre de joueurs avec seuil | 2 | **Non géré** | comptage roster-wide (02), explicitement exclu ; +/- n'est en plus pas une stat modélisée (06) |
| Stat joueur combinée | 1 | Géré | COMBO, 1 joueur 3 stats sommées |
| Pourcentage 3 points joueur | 1 | Géré | COMBO, 2 équipes |
| Points joueur | 1 | **Non géré** | "et au moins 2 AUTRES joueurs" non nommés = comptage roster-wide (02) |
| Cumul statistiques joueurs | 1 | Géré | COMBO, somme sur 2 joueurs nommés |

## 8 · Événement de match — 20 paris (4 géré, 16 non géré)

| Sous-catégorie | N | Statut | Pourquoi |
|---|--:|---|---|
| Fautes techniques | 3 | **Non géré** | stat jamais modélisée (06) |
| Événement arbitral | 2 | **Non géré** | aucune donnée + formulation souvent vague (10) |
| Blessure | 2 | **Non géré** | stat jamais modélisée (06) |
| Action rare | 2 | **Non géré** | panier à 4 points / retour de blessure — aucun mécanisme |
| Interceptions équipe | 2 | Géré | MATCH_TOTAL total_stl (combiné 2 équipes) |
| Buzzer beater | 2 | **Non géré** | événement granulaire play-by-play (07) |
| Contres joueur | 2 | Géré | MATCH_TOTAL total_blk (combiné 2 équipes) |
| Faute technique | 2 | **Non géré** | stat jamais modélisée (06) |
| Temps morts | 1 | **Non géré** | stat jamais modélisée (06) |
| Triple-double (joueur non nommé) | 1 | **Non géré** | comptage roster-wide (02) — "au moins un joueur", lequel ? |
| Violation de jeu | 1 | **Non géré** | événement granulaire play-by-play (07) |

## 9-12 · Hors périmètre par conception — 36 paris

Ces 4 catégories ne sont pas des trous — le principe du projet est de ne
jamais forcer une extraction incertaine (10). Rejetées volontairement dès
la conception du prompt IA.

- **Aucun pari** (15) — catégorie administrative (soumission vide/non-pari), sans objet.
- **Fun / hors terrain** (14) — pom-pom girl, mascotte, célébrités en tribune : hors du domaine sportif calculable par nature.
- **Invalide / impossible** (5) — discriminatoire, physiquement impossible, autre sport, non vérifiable.
- **Ambigu / non vérifiable** (2) — texte illisible ou incomplet.
