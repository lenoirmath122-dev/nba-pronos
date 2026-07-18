# NBA Pronos — Synthèse pour Claude Project (développement)

> **Nature de ce document** : synthèse condensée et actionnable des décisions produit, à destination du Claude Project dédié au développement. Ne contient que des **règles**, pas de justification ni d'alternative écartée (celles-ci restent dans `SPEC_FONCTIONNELLE_V0.2.md` et les 10 fichiers `0.2.x`, à joindre en pièce jointe/knowledge du projet si besoin de contexte approfondi).
> **Ce document ne contient ni schéma de base de données, ni RLS, ni code** : c'est la dernière étape du cadrage fonctionnel, pas le début de la spec technique. La modélisation Supabase/Next.js reste entièrement à faire dans le Claude Project de développement.
> Statut du cadrage : **complet et clos** (0.1 → 0.2.10, tous validés).

---

## 1. Le produit en une minute

Application web privée de pronostics NBA entre amis (10-30 joueurs), sur les **playoffs uniquement**. Un classement unique agrège 3 sources de points :

```text
1. Bracket initial      (~30-35 % des points d'un joueur complet)
2. Pronos match/match   (~45-49 %)
3. Paris personnalisés  (~15-20 %)
```

Un rôle ADMIN supervise, corrige les données officielles, valide/résout les paris, journalise ses actions.

**Séquence de livraison** :

```text
1. Prototype jetable — simulation d'API, stack allégée, pas de RLS.
2. V1 propre — API NBA réelle, RLS complètes, architecture définitive.
```

Modèle Claude recommandé selon la phase : **Sonnet 5** pour le prototype (vitesse d'itération), **Opus 4.8** pour la V1 (rigueur RLS/architecture).

---

## 2. Stack

| | Prototype | V1 |
|---|---|---|
| Frontend | Next.js | Next.js |
| Backend | Supabase (Postgres) | Supabase (Postgres) |
| Auth | Simplifiée (juste distinguer profils/rôles) | Supabase Auth complète |
| Sécurité DB | **Pas de RLS** | **RLS complètes** |
| Déploiement | Vercel / GitHub → Vercel | Vercel / GitHub → Vercel |
| Tâches planifiées | Curseur de simulation, avance manuelle + auto débrayable | Vercel Cron Jobs |
| Données NBA | **Simulation déterministe** (seed + curseur, aucune vraie API) | **API NBA externe** (fournisseur à choisir en spec technique) |
| Box scores individuels | Hors périmètre | Hors périmètre V1 |

---

## 3. Utilisateurs, rôles, accès

```text
Rôles      : PLAYER (défaut), ADMIN (= PLAYER + droits admin).
Statuts    : ACTIVE, DISABLED (pas de PENDING, écarté définitivement pour l'instant).
Inscription: libre + immédiate, protégée par un CODE COMPÉTITION unique et partagé
             (un seul code pour toute la compétition, régénérable par l'admin).
```

Règles clés :

- `DISABLED` ≠ suppression : données de jeu et points conservés, comptabilisés, joueur marqué « inactif ».
- Un ADMIN ne peut **jamais** traiter sa propre requête de correction ni son propre pari → reste `EN_ATTENTE` s'il n'y a qu'un seul admin.
- Promotion/rétrogradation de rôle : pas d'auto-rétrogradation, dernier admin actif non rétrogradable.
- Visiteur non connecté (pas de rôle stocké) : voit classement + bracket global + tout le détail nominatif **après** deadline/verrouillage, jamais avant, jamais email/logs/données de sécurité.
- Profil joueur : pseudo (obligatoire), avatar/équipe favorite/bio (optionnels), email toujours privé.

---

## 4. Bracket initial

```text
Structure     : 15 séries, 4 tours (1er tour 8 / demi-finales conf. 4 /
                finales conf. 2 / finale NBA 1), ~86 matchs au total.
Ouverture     : dès que les 8 séries du 1er tour sont officiellement connues.
Deadline      : heure du 1er match des playoffs.
Modifiable    : jusqu'à la deadline, MÊME après une validation volontaire
                (différent des pronos match — pas de "figer" avant deadline).
Saisie        : vainqueur + score de série par boutons (4-0/4-1/4-2/4-3),
                jamais de saisie libre. Champion NBA = déduit automatiquement
                du vainqueur de la finale (pas de champ séparé).
```

Traitement à la deadline (par **série**, pas par bracket entier) :

```text
Série remplie (vainqueur + score)  → auto-validée.
Série non remplie                  → absence sur CETTE série, 0 point, pas de pénalité.
```

Scoring — indépendant de l'adversaire réel : les points « vainqueur de série » sont acquis si l'équipe désignée gagne réellement sa série à ce tour, quel que soit l'adversaire effectivement rencontré (une upset précoce ne détruit pas la branche).

Visibilité :

```text
Avant deadline : brackets des autres entièrement cachés.
Après deadline : bracket global public = état réel + tendances agrégées
                 (seuil dynamique : >10 brackets remplis → %, sinon nombre brut).
Clic sur une série (drill-down) = détail NOMINATIF complet (qui a mis quoi),
                 pour cette série uniquement — jamais le bracket entier d'un
                 joueur d'un seul coup.
```

---

## 5. Pronostics match par match

```text
Fenêtre affichée : glissante 3 jours, matchs bien identifiés uniquement,
                   triés par proximité temporelle.
Saisie           : vainqueur + écart, INDISSOCIABLES. Écart entier ≥ 1,
                   bornes 1 à 50 (garde-fou de saisie, sans impact scoring).
```

Cycle de vie :

```text
BROUILLON  → modifiable, ne voit pas les pronos des autres.
VALIDÉ     → IRRÉVERSIBLE. Voit alors les pronos validés des autres,
             mise à jour continue jusqu'au coup d'envoi.
VERROUILLÉ → coup d'envoi atteint, saisie fermée.
```

Principe : « voir les pronos des autres = accepter de figer le sien ». Option de confort : « Valider tous les matchs complets » (ignore les pronos partiels, confirmation listant le nombre de matchs concernés).

À la deadline :

```text
Brouillon COMPLET (vainqueur + écart) → auto-validé, compte pour le scoring.
Brouillon PARTIEL (un seul champ)     → absence, 0 point.
Absence totale                        → 0 point, jamais de pénalité négative.
```

Visibilité après verrouillage : **tous** les pronos deviennent publics (validés + auto-validés), y compris pour les visiteurs non connectés — aucun secret protégé après coup.

Match reporté (mêmes équipes) : pronos conservés, deadline recalée, brouillons rouverts jusqu'à la nouvelle deadline, validés restent validés. Match annulé : neutralisé, 0 point pour tous. Une mise à jour de données ne modifie **jamais** un prono déjà saisi.

Correction admin exceptionnelle : uniquement sur requête du joueur (jamais d'initiative spontanée), marquage public obligatoire (« saisi/corrigé par admin X sur requête de Y »), motif obligatoire, journalisé, un admin ne peut jamais corriger son propre prono.

---

## 6. Paris personnalisés

```text
Portée    : SÉRIE ou MATCH (choix du joueur à la création), modèle hybride.
Quotas    : 1 pari SÉRIE + 3 paris MATCH par joueur et par série
            (les 3 paris match visent 3 matchs différents, 1 max par match).
Deadline  : pari série → 1er match de la série. Pari match → début du match visé.
```

Workflow :

```text
BROUILLON → SOUMIS → VALIDÉ → GAGNÉ / PERDU
                   ↘ REFUSÉ (motif obligatoire, libère le slot si avant deadline)
        cas limite  → ANNULÉ (événement neutralisé, 0 point)
```

- `SOUMIS` non revu à sa deadline → **auto-validé** à la difficulté proposée par le joueur.
- Difficulté : 5 niveaux (1 = accessible, 5 = jackpot), proposée par le joueur, VALIDÉE (ou ajustée) par l'admin — c'est le niveau validé qui fait foi pour le scoring.
- Visibilité : chaque pari devient public à SA propre deadline, détail nominatif complet, y compris visiteurs non connectés.
- Vérification gagné/perdu en V1 : **manuelle par l'admin uniquement**. Un pré-remplissage IA est envisagé en évolution future (renvoyé à la spec technique), jamais autorité finale sur les paris flous/subjectifs.

---

## 7. Barème de scoring (source de vérité chiffrée)

**Matchs** — bon vainqueur = 10 pts fixes (tous tours), + bonus d'écart **si et seulement si vainqueur correct** :

| Écart | Bonus |
|---|---|
| 0 (exact) | +5 |
| 1-2 | +3 |
| 3-5 | +2 |
| 6-9 | +1 |
| 10+ | +0 |

**Bracket** — par tour, 3 composantes indépendantes et cumulables :

| Tour | Vainqueur | Score exact | Affiche |
|---|---|---|---|
| 1er tour | 25 | +10 | +0 |
| Demi-finales conf. | 45 | +20 | +15 |
| Finales conf. | 80 | +30 | +25 |
| Finale NBA (= champion) | 250 | +50 | +40 |

```text
Score exact : accordé seulement si vainqueur correct ET format (4-0…4-3) exact.
Affiche     : accordé si les 2 bonnes équipes s'affrontent, INDÉPENDAMMENT du vainqueur.
Finale NBA parfaite (vainqueur+score+affiche) = 340 points sur cette seule série.
Pas de bonus champion séparé (fusionné dans la finale).
```

**Paris personnalisés** — progression linéaire selon le niveau validé :

| Niveau | Points |
|---|---|
| 1 | 5 |
| 2 | 10 |
| 3 | 15 |
| 4 | 20 |
| 5 | 25 |

Jamais de points négatifs, nulle part dans le barème.

Recalcul : **idempotent**, rejoue tout le barème à partir des données officielles figées + prédictions figées. Déclencheurs : automatique après synchro/résolution, ou bouton admin manuel (filet de sécurité).

---

## 8. Classement

```text
UN SEUL classement, triable par colonne (clic) : Total | Matchs | Bracket
| Paris | Forme récente (fenêtre glissante 7 jours). Le Total reste toujours
affiché quel que soit le tri actif. Pas d'écrans de classement séparés.

Départage d'égalité (cascade) :
1. Total  2. Vainqueurs de MATCH  3. Écarts exacts  4. Points bracket  5. Ex-aequo assumé.

Chaque ligne dépliable en sous-totaux publics (Matchs/Bracket/Paris/Total).
```

Mobile : 3 colonnes max par ligne (Rang/Joueur, Total, puce de tri active), détail via le dépliable, jamais de scroll horizontal. Desktop : toutes colonnes affichées.

Consommation identique connecté/visiteur **après** verrouillage — seule différence : le connecté peut agir, et a l'accès conditionnel avant verrouillage (« valider = voir »).

---

## 9. Administration

```text
Gestion joueurs   : valider, désactiver, réactiver, promouvoir, rétrograder.
Données officielles: éditer match (horaire/score/statut) et série (affiche/
                     score/statut) — jamais les prédictions des joueurs.
Requêtes joueur→admin : EN_ATTENTE → TRAITÉE / REFUSÉE (motif obligatoire),
                     canal in-app uniquement, 1 requête = 1 prono/pari,
                     traitable par tout admin sauf l'auteur.
Files paris       : validation (SOUMIS→VALIDÉ/REFUSÉ) et résolution
                     (VALIDÉ échu → GAGNÉ/PERDU), contexte complet sans navigation.
```

Journalisation — deux natures **distinctes**, à ne jamais confondre :

```text
1. Log interne (audit) : jamais public, réservé admins. Acteur/action/cible/
   horodatage/motif/avant→après.
2. Marquage public de transparence : visible de tous sur l'objet concerné
   (ex. "prono corrigé par admin X sur requête de Y"). C'est un attribut de
   l'objet, pas le log d'audit.
```

Rétention logs : pas de purge en V1 (non bloquant).

---

## 10. Données NBA / simulation (frontière proto vs V1)

```text
PROTO : simulation déterministe (seed + curseur "où en est-on"), pas de table
        de résultats dédiée, pas de vraie API, pas de cron réel.
V1    : API NBA externe (fournisseur à choisir en spec technique) + Vercel
        Cron. Box scores individuels hors périmètre V1.
```

Cahier des charges de données V1 (dérivé du fonctionnel, à couvrir par le fournisseur choisi) :

```text
- Équipes qualifiées (16)
- Calendrier des séries + affiches
- Date/heure de chaque match
- Statut de match (programmé/en cours/terminé/reporté/annulé)
- Score final de match
- Format/score de série
- Statut de série
```

Mapping : identifiants internes **stables** + table de correspondance vers l'id source ; le reste de l'app ne travaille que sur les ids internes. Entité non reconnue automatiquement → reste `EN ATTENTE` (aucun scoring/verrouillage tant que non confirmée par l'admin), confirmation journalisée.

Verrouillage piloté par l'**heure connue du match**, jamais par la fraîcheur de la synchro.

---

## 11. Prototype jetable — périmètre exact

```text
JOUEUR : COMPLET, fidèle à 100 % des règles ci-dessus (bracket 15 séries,
         pronos match, paris série+match, scoring complet, classement
         triable, toutes les règles de visibilité).
ADMIN  : MINIMAL, mode debug — avancer le temps (manuel + auto débrayable,
         granularité jour par défaut / match en debug fin / série en saut
         rapide), déclencher à la main les cas limites (reporté/annulé),
         édition directe des paris/requêtes sans UI polie.

Hors périmètre proto (V1 uniquement) : API NBA réelle, RLS complètes,
écran de logs d'audit consultable, promotion/rétrogradation en UI,
logos officiels NBA.

Faux joueurs : 5 profils scriptés (complet, parieur, régulier, visionnaire,
casual — cf. section 7 simulation Monte-Carlo de la spec complète),
montée en charge progressive (démarrer sous 10 brackets remplis, dépasser
ensuite, pour tester les 2 modes d'affichage de tendance).
Mode de test : SOLO, bascule simple entre profils (pas de vrais comptes
multiples nécessaires à ce stade).
Fidélité UX : MOYENNE (direction visuelle de base, sans polish).
```

---

## 12. UX/UI — règles transverses à respecter dès le prototype

```text
Mobile d'abord. Direction "arène/broadcast", fond sombre par défaut + bascule clair.
Navigation mobile : 4 onglets (Accueil · Jouer · Classement · Profil).
Cartes de match  : vainqueur 2 boutons + écart pavé numérique.
Bracket mobile   : 1 série = 1 carte, tour par tour, tours suivants
                   pré-remplis auto, champion déduit, groupé par conférence,
                   progression X/15.
Paris annulés    : affichés barrés + grisés, mention "neutralisé", distincts
                   d'un "perdu", pas de section à part.
Live             : mise à jour silencieuse + repère horaire + badge "EN DIRECT",
                   dégradation propre si fraîcheur API limitée (V1).
```

---

## 13. Cas limites — table de référence rapide

| Cas | Règle |
|---|---|
| Série annulée/reportée | Décision admin manuelle, journalisée |
| Match reporté (mêmes équipes) | Pronos conservés, deadline recalée |
| Match annulé | Neutralisé, 0 point pour tous |
| Donnée API change en cours | Bracket/pronos déjà saisis restent figés |
| Erreur de donnée avant deadline | Admin peut rouvrir/corriger avant verrouillage |
| Pari devenu invérifiable | `ANNULÉ`, 0 point |
| Oubli total | 0 point, jamais de pénalité négative |
| Bracket partiellement rempli | Traitement par série (remplie=validée / non remplie=absence) |
| Joueur désactivé en cours de route | Données figées et comptabilisées |
| Un seul admin existant | Ses requêtes restent `EN_ATTENTE` |

---

## 14. Points encore ouverts pertinents pour le développement

Ces points ne bloquent pas le démarrage du développement, mais devront être tranchés **en spec technique**, pas redemandés en cadrage fonctionnel :

```text
- Règles d'arrondi/affichage des sous-totaux par source dans l'UI
- Gestion du scoring si une série est annulée/neutralisée vis-à-vis du bracket
- Confirmation : bonus affiche compare une PAIRE d'équipes, pas une position de slot
- Bootstrap technique du tout premier admin (seed)
- Faisabilité/périmètre exact d'un pré-remplissage IA gagné/perdu des paris
- Fournisseur d'API NBA réelle pour la V1 (horaires/statuts/scores fiables,
  fraîcheur compatible avec le verrouillage)
- Mécanisme technique du mapping en bloc des équipes à l'ouverture du 1er tour
- Fréquence précise de synchro et de rafraîchissement des horaires
- Fréquence de rafraîchissement de l'affichage live (dépend de l'API choisie)
```

Points non bloquants / itération future (liste complète : voir section 14.2 de `SPEC_FONCTIONNELLE_V0.2.md`) : statut PENDING réactivable un jour, purge des logs à très long terme, sourcing des logos officiels, micro-animations, libellés d'états vides définitifs, détails des scripts de profils de test, etc. — aucun n'empêche de commencer à coder.

---

## 15. Documents source (pour aller chercher le "pourquoi")

```text
SPEC_FONCTIONNELLE_V0.2.md                              — spec complète faisant foi
nba_pronos_decisions_0_2_1_acces_roles.md                — accès, rôles
nba_pronos_decisions_0_2_2_bracket_initial.md            — bracket
nba_pronos_decisions_0_2_3_pronostics_matchs.md          — pronos match
nba_pronos_decisions_0_2_4_paris_personnalises.md        — paris
nba_pronos_decisions_0_2_5_scoring_global.md             — scoring + Monte-Carlo
nba_pronos_decisions_0_2_6_classement_visibilite.md      — classement
nba_pronos_decisions_0_2_7_administration.md             — admin
nba_pronos_decisions_0_2_8_donnees_api_simulation.md     — données/API/simulation
nba_pronos_decisions_0_2_9_ux_ui.md                      — UX/UI
nba_pronos_decisions_0_2_10_prototype_jetable.md         — prototype
nba_pronos_decisions_multi_competitions_historique.md    — multi-compétitions, historique, NBA Cup (V1 scope)
nba_pronos_decisions_nba_cup_mecanique_scoring.md         — mécanique + barème NBA Cup (mini-bracket, 7 matchs)
```
