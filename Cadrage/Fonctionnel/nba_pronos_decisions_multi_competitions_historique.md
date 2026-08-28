# NBA Pronos — Multi-compétitions & historique — décisions

> Statut : décisions actées en discussion avec l'utilisateur le 16/07/2026.
> À renuméroter dans la séquence officielle `decisions_0_2_x` si souhaité
> (probablement 0.2.11 ou 0.2.12 selon l'existence du fichier
> `nba_pronos_decisions_0_2_11_points_ouverts_resolus.md` référencé dans la
> synthèse mais absent du Project à ce jour).
>
> Contexte : point de départ = vouloir tester le système de scoring sur la
> NBA Cup 2026 (30 oct → 11 déc), en vrai avec des amis, avant les Playoffs
> 2027. Ça a fait émerger un besoin réel de gérer plusieurs compétitions dans
> le temps, avec un historique consultable.

---

## 1. Principe général — une compétition ACTIVE à la fois

```text
Pas de participation concurrente à plusieurs compétitions en parallèle
(piste retenue face à un vrai système multi-compétitions simultané, écarté).

Justification calendrier : NBA Cup (oct-déc) et Playoffs (avril-juin) ne se
chevauchent jamais dans l'année — pas besoin de jeu concurrent.

Conséquence technique : `competition_settings` (aujourd'hui un singleton,
une seule ligne fixe) devient une vraie table à plusieurs lignes dans le
temps, avec un statut (ex. ACTIVE / ARCHIVED).
```

## 2. Création d'une compétition

```text
Nouvel écran admin "Nouvelle compétition", remplace le script SQL manuel
actuel (reset_simulation.sql lancé à la main dans l'éditeur Supabase).

Champs a minima :
  - nom / libellé (ex. "NBA Cup — Automne 2026"), choisi par l'ADMIN à la
    création (décision actée) ;
  - type de compétition (PLAYOFFS / NBA_CUP).

Selon le type choisi, montage automatique de la structure de jeu
correspondante :
  - PLAYOFFS : arbre de 15 séries (déjà connu, 0.2.2) ;
  - NBA_CUP : structure spécifique — VOIR POINT OUVERT §7, pas encore conçue.
```

## 3. Clôture et archivage

```text
Clôture = action MANUELLE et EXPLICITE de l'admin ("Clôturer et archiver"),
décidée pour garder le contrôle (pas de clôture automatique à un état final
détecté par l'app).

À la clôture :
  1. Capture d'un instantané du classement FINAL de TOUS les joueurs
     (total + sous-totaux par source, même détail que l'écran classement
     actuel, 0.2.6) dans une table d'archive dédiée.
  2. Reset ensuite, comme aujourd'hui (reset_simulation.sql, adapté pour
     démarrer la compétition suivante plutôt que juste rejouer la même).

Conséquence sur les corrections (0.2.7) : AUCUNE correction possible après
clôture. Cohérent par construction, puisque c'est l'admin qui déclenche la
clôture en connaissance de cause — pas besoin de red-tape supplémentaire.
```

## 4. Consultation de l'historique

```text
Nouvel onglet "Historique" dans le profil du joueur.
Menu déroulant : choix d'une compétition passée.
Affiche le classement FIGÉ de cette compétition-là.

Niveau de détail retenu (LÉGER) :
  - scores finaux uniquement (total + sous-totaux), pour SOI et pour TOUS
    les autres joueurs de cette compétition passée ;
  - PAS le détail des pronos/bracket/paris de l'époque (option plus riche
    explicitement écartée pour l'instant — coût architecture trop élevé
    pour le bénéfice, cf. discussion).

Aucune nouvelle règle de visibilité : le classement est déjà public par
nature (0.2.6), l'archive n'est qu'une vue supplémentaire sur une donnée
gelée dans le temps.
```

## 5. Séquencement V1 — scope volontairement réduit à la NBA Cup

```text
Décision de SÉQUENCEMENT, pas une nouvelle règle produit :
  - la V1 sera construite et jouée en vrai pour la NBA Cup 2026 en premier ;
  - la partie Playoffs V1 est reportée à son propre chantier, sans urgence
    (saison 2027, largement le temps) ;
  - le modèle de données (compétitions typées, archive générique) doit
    rester EXTENSIBLE pour accueillir PLAYOFFS plus tard sans tout refaire,
    même si son parcours complet n'est pas implémenté dans cette V1.
```

## 6. Sécurité V1 — RLS complètes incluses

```text
RLS complètes dès cette V1 scopée Cup — pas de version allégée.
Décision actée le 16/07/2026, en cohérence avec la définition standard de
la V1 du projet (RLS complètes, API NBA réelle, Vercel Cron).

Justification : usage réel avec de vrais amis (vraies identités, vrais
enjeux sociaux autour du classement) — le jeu "valider = voir" (0.2.3)
suppose une vraie étanchéité entre joueurs avant révélation, ce qui
nécessite une authentification réelle ET des RLS pour être fiable.

Bonne nouvelle : aucune nouvelle décision produit nécessaire pour écrire
ces policies — les règles de visibilité sont déjà toutes spécifiées
ailleurs (0.2.1 accès/rôles, 0.2.3 §9 visibilité des pronos, 0.2.6
classement, 0.2.9 UX). La RLS ne fait que les traduire techniquement.
```

## 7. Points ouverts (à trancher AVANT la spec technique V1)

```text
- Mécanique de jeu NBA Cup (poules + phase finale) : AUCUNE série sur toute
  la compétition (format 2026 confirmé — 6 groupes de 5, matchs uniques ;
  6 vainqueurs de groupe + 2 wild cards en quarts, élimination directe,
  matchs uniques jusqu'à la finale). Le "bracket" 0.2.2 (score de série
  4-0/4-1...) ne s'applique donc à RIEN dans ce format.
  À concevoir :
    (a) une mécanique de prédiction pour la phase de groupes (qui sort du
        groupe ? qui a la wild card ? ou rien de spécial, juste les pronos
        match ?) ;
    (b) une mécanique légère pour la phase à élimination directe (qui
        gagne le match, sans score de série puisqu'il n'y en a pas).
  Les pronos match (0.2.3/0.2.5, vainqueur + écart) se réutilisent tels
  quels pour chaque match, poule comme phase finale — pas un point ouvert.

- Barème de scoring Cup : 0.2.5 est calé sur 4 tours de playoffs
  (25/45/80/250). À recalibrer pour 3 tours de phase finale Cup
  (quarts/demies/finale) + éventuellement un bonus phase de groupes selon
  la mécanique retenue en (a) ci-dessus.

- Fournisseur d'API NBA réelle : déjà identifié comme point ouvert dans la
  synthèse (§14), devient BLOQUANT pour cette V1 (plus un "plus tard").

- Authentification réelle : mécanisme exact (lien magique par email, code
  d'accès, autre) à trancher en spec technique.
```

## 8. Roadmap indicative

```text
1. Décisions fonctionnelles (mi-juillet)
   Mécanique NBA Cup (poules + phase finale) + barème scoring Cup.

2. Enrichir le PROTOTYPE existant (2-3 semaines max, fin juillet → mi-août)
   Objectif UNIQUE : valider mécanique + équilibre du scoring + UX de
   l'historique. PAS pour jouer en vrai (toujours simulation, sans
   auth/RLS). Fidélité UX toujours MOYENNE (0.2.9/0.2.10), pas de polish.
   → Checkpoint explicite de fin : dès que ça tient, on bascule.

3. Spec technique V1 — scope réduit à NBA_CUP (mi-août)
   Modèle de données extensible + décisions bloquantes du §7 + RLS + choix
   d'authentification.

4. Implémentation V1 scope Cup (fin août → fin septembre)

5. Test à blanc + onboarding des amis (début-mi octobre)
   Les groupes 2026 sont déjà tirés (annoncés début juillet) — testable
   sans attendre le direct.

6. Lancement réel
   30 octobre : ouverture phase de groupes.
   4-11 décembre : phase finale (quarts 4-5/12, demies 8-9/12, finale
   11/12 à Hinkle Fieldhouse, Indianapolis).
   Puis clôture + archivage (§3).
```
