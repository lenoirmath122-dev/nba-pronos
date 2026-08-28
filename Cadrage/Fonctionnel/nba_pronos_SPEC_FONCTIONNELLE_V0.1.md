# NBA Pronos — Spécification Fonctionnelle V0.1

> **Statut : cadrage fonctionnel COMPLET (0.1 → 0.2.10, tous validés)**
> Ce document **remplace** `nba_pronos_plan_cadrage_titres.md`, `nba_pronos_plan_cadrage_detaille.md` et `nba_pronos_resume_cadrage_valide.md`, devenus obsolètes ou partiellement dépassés par les décisions ultérieures.
> Il consolide l'intégralité des décisions validées dans les 10 documents de décisions (`0.2.1` → `0.2.10`) en un seul document de référence, structuré pour être réutilisé tel quel dans un Claude Project dédié au développement.
> Les 10 documents de décisions détaillés restent disponibles comme **historique du raisonnement** (justifications, exemples, alternatives écartées) ; ce présent document en est la **synthèse faisant foi**.

---

## 0. Sommaire

```text
1.  Vision produit
2.  Périmètre (V1 et prototype)
3.  Utilisateurs, accès et rôles
4.  Bracket initial
5.  Pronostics match par match
6.  Paris personnalisés
7.  Scoring global (barème consolidé)
8.  Classement et visibilité
9.  Administration
10. Données NBA, API et simulation
11. UX / UI
12. Prototype jetable
13. Cas limites — récapitulatif transverse
14. Points ouverts — récapitulatif complet
15. Traçabilité documentaire
16. Prochaines étapes
```

---

## 1. Vision produit `[VALIDÉ — 0.1]`

Application web **privée** de pronostics entre amis, centrée uniquement sur les **playoffs NBA**.

Principes fondateurs :

- cible : **10 à 30 joueurs** ;
- stack cible V1 : **Next.js + Supabase (Auth, Postgres, RLS) + Vercel (Cron) + GitHub**, avec **API NBA externe** à terme ;
- un **prototype jetable** précède la V1, avec **simulation d'API** (pas de vraie API NBA) ;
- responsive **mobile + desktop**, simplicité d'usage prioritaire.

Le jeu repose sur quatre sources de points cumulées dans un classement unique :

```text
1. Bracket initial (vainqueur + score de série, par tour)
2. Pronostics match par match (vainqueur + écart)
3. Paris personnalisés (par joueur et par série)
4. → agrégés dans un classement global public
```

Une administration (rôle `ADMIN`) supervise la compétition, corrige les données officielles, valide/résout les paris personnalisés et trace ses actions.

---

## 2. Périmètre

### 2.1 — Périmètre V1

- Uniquement les **playoffs NBA** : pas de saison régulière, pas de play-in.
- Synchronisation automatique via **API NBA externe** (fournisseur à choisir en spec technique).
- **RLS** complètes, sécurité complète, architecture définitive.
- Cron Vercel pour la synchronisation régulière des données.

### 2.2 — Périmètre prototype jetable

Voir section 12 pour le détail complet. En résumé :

```text
Côté JOUEUR : complet et fidèle à toutes les règles de ce document.
Côté ADMIN  : minimal, en mode debug (pas d'écrans polis).
Données     : simulation déterministe (seed + curseur), pas d'API réelle.
Stack       : identique à la cible V1, mais allégée (pas de RLS, auth simplifiée).
```

---

## 3. Utilisateurs, accès et rôles

### 3.1 — Inscription et statuts

```text
Inscription libre, accès immédiat.
Nouvel inscrit = ACTIVE par défaut.
Admin peut passer un compte en DISABLED si nécessaire, et le réactiver.
```

Statuts retenus :

```text
ACTIVE   : joueur actif, peut participer.
DISABLED : désactivé par admin, ne peut plus saisir ni valider.
```

Le statut `PENDING` (joueur en attente de validation) est **définitivement écarté** pour le proto et la V1 — réactivable plus tard sans dette technique si le besoin apparaît, mais non retenu à ce stade.

Effet d'une désactivation (précisé en 0.2.7) :

```text
Un joueur DISABLED ne peut plus saisir ni valider.
Mais ses pronos, brackets, paris et points déjà acquis restent
et continuent d'être comptabilisés au classement (marqué « inactif »).
```
Désactiver ≠ effacer : les données de jeu sont historisées et figées, retirer un joueur du classement fausserait rétroactivement les scores relatifs des autres.

### 3.2 — Rôles applicatifs

```text
PLAYER  : rôle par défaut de tout inscrit.
ADMIN   : joueur + droits supplémentaires (ADMIN = PLAYER + droits admin).
```

Le visiteur non connecté n'est **pas un rôle stocké en base** : il est traité par les règles d'accès des pages publiques.

### 3.3 — Modèle admin et contrainte « au moins deux admins »

```text
Un admin ne peut JAMAIS traiter sa propre requête de correction
(ni son propre prono, ni son propre pari — cf. sections 5 et 6).
```

C'est une **règle métier assumée, pas un verrou système bloquant** :

- le système ne force pas l'existence permanente de 2 admins ;
- il refuse seulement l'action « un admin résout sa propre requête » ;
- s'il n'existe qu'un seul admin, ses propres requêtes restent `EN_ATTENTE` jusqu'à l'apparition d'un 2ᵉ admin.

Promotion / rétrogradation :

```text
Un admin peut promouvoir un PLAYER en ADMIN, et rétrograder un ADMIN en PLAYER.
Garde-fous :
  - pas d'auto-rétrogradation ;
  - le dernier admin actif ne peut pas être rétrogradé.
```

Le bootstrap du tout premier admin est un point technique (seed manuel), hors périmètre fonctionnel.

### 3.4 — Visiteurs publics (non connectés)

Peuvent voir, sans compte :

```text
- le classement général (avec sous-totaux par source) ;
- le bracket global (état réel + tendances) ;
- après verrouillage/deadline : le détail nominatif des pronos match,
  des brackets (via drill-down par série) et des paris personnalisés.
```

Ne voient **jamais** :

```text
- email ;
- identifiants internes ;
- logs / historiques d'actions admin ;
- données de sécurité ;
- toute information privée non destinée au classement.
```

Règle de synthèse (0.2.6) : **après coup** (match verrouillé, pari à sa deadline, bracket à sa deadline), la consommation de données est **identique** entre un visiteur et un joueur connecté. Seule différence : le connecté peut agir (saisir/valider/parier), et a l'accès conditionnel au pré-verrouillage (« valider = voir »), impossible pour un visiteur.

### 3.5 — Profil joueur

Champs :

```text
pseudo (obligatoire), avatar (optionnel), équipe favorite (optionnelle), bio (optionnelle).
Email : privé, jamais affiché publiquement.
```

Affichage public possible : pseudo, avatar, équipe favorite, score total, sources de points.

### 3.6 — Traçabilité (renvoi section 9.5)

Toute action admin sensible doit être journalisée (voir détail en section 9.5 — Logs).

---

## 4. Bracket initial

### 4.1 — Ouverture et cycle de vie

```text
Ouverture   : dès que toutes les séries du 1er tour sont officiellement connues
              (pas de bracket avec des équipes provisoires / seeds de play-in).
Deadline    : heure exacte du 1er match des playoffs.
Avant deadline : modifiable, y compris après validation volontaire.
À la deadline  : tout bracket rempli (validé ou non) est auto-validé et verrouillé.
Après deadline : verrouillé, non modifiable.
```

Spécificité du bracket (différente des pronos match) : il reste modifiable jusqu'à la deadline **même après une validation volontaire** — la logique « valider = figer » ne s'applique qu'aux pronostics match par match.

### 4.2 — Contenu

```text
Pour chaque série : vainqueur + score de série (format prédéfini).
Formats autorisés : 4-0, 4-1, 4-2, 4-3 (boutons, pas de saisie libre).
Champion NBA : déduit automatiquement du vainqueur de la finale NBA
               (pas de choix séparé, pas d'incohérence possible).
```

### 4.3 — Modèle de scoring : indépendant de l'adversaire

Décision fondamentale (0.2.5), qui précise et complète 0.2.2 :

```text
À chaque tour, les points « vainqueur de série » sont attribués si l'équipe
désignée gagnante à ce tour gagne réellement sa série à ce tour,
INDÉPENDAMMENT de l'adversaire réellement rencontré.
```

Exemple : pronostiquer « Lakers battent Denver » en demi-finale de conférence, puis voir les Lakers affronter et battre Memphis à la place → les points **vainqueur** sont acquis quand même. Objectif : éviter qu'une upset précoce ne détruise toute une branche du bracket.

Conséquence : le champion NBA n'est que le vainqueur de la finale NBA — **aucun bonus champion séparé**, il est fusionné dans la valeur de la finale.

### 4.4 — Les trois composantes de scoring par série

Chaque série se score sur **trois composantes indépendantes et cumulables** :

| Composante   | Condition                                                        |
|---|---|
| **Vainqueur** | La bonne équipe gagne sa série à ce tour (indépendant de l'adversaire) |
| **Score exact** | Vainqueur correct **ET** format (4-0…4-3) correspondant à la vraie série |
| **Affiche**   | Les deux bonnes équipes s'affrontent à ce tour (indépendant du vainqueur) |

Barème complet (points par tour) — voir tableau consolidé en section 7.2.

Cas extrême assumé — la « ligne finale NBA parfaite » (affiche + vainqueur + score exact sur la seule finale) peut valoir **340 points** à elle seule : rarissime, mais volontairement spectaculaire.

### 4.5 — Visibilité

```text
Avant la deadline du bracket : brackets des autres joueurs cachés (anti-copie).
Après la deadline : bracket global public = état réel des séries + tendances joueurs
                     (ex. « 70 % ont choisi Celtics »), sans exposer tous les
                     brackets individuels par défaut.
```

Détail (0.2.6) — seuil dynamique sur les tendances, calculé sur les **brackets effectivement remplis** :

```text
> 10 brackets remplis : affichage en POURCENTAGE.
≤ 10 brackets remplis : affichage en NOMBRE BRUT (plus parlant à petit effectif).
```

Vue publique par défaut = tendances agrégées ; un clic sur une série ouvre le détail de cette série (drill-down). Le niveau exact du détail au clic (nominatif « qui a mis quoi » ou distribution enrichie seule) reste un point ouvert (→ section 14).

### 4.6 — Cas limites

```text
Série annulée ou reportée      : décision admin manuelle, journalisée.
Donnée API qui change en cours : le bracket joueur déjà saisi reste figé.
Erreur de donnée avant deadline: admin peut rouvrir/corriger le bracket ou les données.
```

Point encore ouvert : traitement exact d'un bracket **partiellement rempli** à la deadline (auto-validation partielle ? invalidation ? validation uniquement des séries remplies ?) — non tranché, voir section 14.

---

## 5. Pronostics match par match

### 5.1 — Fenêtre de matchs affichée

```text
Fenêtre glissante de 3 jours, uniquement les matchs bien identifiés
(adversaire connu, date et heure confirmées), triés par proximité temporelle
(le plus proche en premier).
```

Dès qu'un match démarre ou que son prono est verrouillé, il quitte la fenêtre de saisie et bascule dans **« Mes pronos »** (historique + matchs en cours/verrouillés). État vide : « Aucun match à pronostiquer pour l'instant ».

### 5.2 — Contenu et saisie

```text
Prono = vainqueur + écart, INDISSOCIABLES. Écart obligatoire, entier ≥ 1
(pas de match nul en NBA). Saisie en champ numérique libre (pavé mobile),
bornes ≈ 1 à 40-50 (valeur exacte à caler, point ouvert).
```

### 5.3 — Cycle brouillon → validé → verrouillé

```text
BROUILLON  : modifiable, non définitif. Le joueur NE VOIT PAS les pronos des autres.
VALIDÉ     : irréversible, définitif. Le joueur VOIT les pronos validés des autres.
VERROUILLÉ : coup d'envoi atteint, plus aucune saisie possible.
```

Principe fondateur du produit : **« Voir les pronos des autres = accepter de figer le sien. »** Une fois validé, aucun retour en arrière possible, même si le match n'a pas commencé.

Granularité : validation match par match, avec une option de confort **« Valider tous les matchs complets »** (ne concerne que les pronos entièrement remplis, ignore les pronos partiels, demande confirmation explicite listant le nombre de matchs concernés).

Visibilité en continu : après validation d'un match, l'écran ouvre les pronos déjà validés des autres et se met à jour à mesure que d'autres valident, jusqu'au verrouillage.

### 5.4 — Comportement à la deadline (coup d'envoi)

```text
Brouillon COMPLET (vainqueur + écart) → auto-validé, compte pour le scoring.
Brouillon PARTIEL (un seul des deux champs) → non scorable → traité comme absence.
Absence totale → 0 point, JAMAIS de pénalité négative.
```

### 5.5 — Correction admin exceptionnelle

Approche **« confiance + transparence »** :

```text
Un joueur peut demander à un admin de saisir/corriger son prono,
même après le début ou la fin du match.
Sans requête = aucune modification admin (jamais d'initiative admin spontanée).
```

Garde-fous :

- **transparence totale** : tout prono saisi/corrigé par un admin est marqué comme tel, visible de tous, avec l'auteur de la requête et l'admin ayant agi ;
- **motif obligatoire** + journalisation complète ;
- un admin **ne peut jamais** corriger son propre prono → doit passer par un autre admin.

### 5.6 — Match reporté ou annulé

```text
REPORTÉ (rejoué plus tard, mêmes équipes) :
  pronos conservés, deadline recalée sur la nouvelle heure,
  brouillons modifiables jusqu'à la nouvelle deadline,
  pronos déjà validés restent validés,
  soupape : admin peut rouvrir la saisie si cas exceptionnel (motivé, journalisé).

ANNULÉ (n'aura pas lieu) :
  match neutralisé, 0 point pour tout le monde, aucune pénalité,
  décision actée par l'admin, journalisée.
```

Règle transverse : une mise à jour de données (API ou simulation) ne modifie **jamais** les pronos déjà saisis.

### 5.7 — Visibilité des pronos

```text
Avant le coup d'envoi :
  pronos des autres visibles UNIQUEMENT si j'ai validé le mien (mise à jour continue).

Après le coup d'envoi (verrouillé) :
  TOUS les pronos existants (validés + auto-validés) deviennent visibles de TOUS,
  y compris ceux qui n'avaient pas validé, ET des visiteurs publics non connectés.
```

Choix assumé : jeu entre amis → **aucun secret n'est protégé après coup**.

Compteur « X/N ont pronostiqué » : visible en permanence pour tous (le nombre seul, jamais le contenu — aucune triche possible). Détail au clic/survol : conditionné avant match (valider = voir), ouvert à tous après verrouillage.

---

## 6. Paris personnalisés

### 6.1 — Portée (modèle hybride)

```text
Un pari porte soit sur une SÉRIE, soit sur un MATCH précis — choix du joueur à la création.

Pari SÉRIE : ex. « La série va en 7 matchs », « Une équipe gagne un match à l'extérieur ».
Pari MATCH : porte sur un match bien identifié (adversaire, date, heure confirmés) ;
             ex. « Match 2 : Jaylen Brown marque 50 points ou plus ».
```

### 6.2 — Quota

```text
Par joueur et par série : 1 pari SÉRIE + 3 paris MATCH.
Quotas indépendants. Au plus 1 pari MATCH par match
(les 3 paris match visent 3 matchs différents de la série).
```

### 6.3 — Deadline différenciée

```text
Pari SÉRIE : verrouillé à l'heure de début du 1er match de la série.
Pari MATCH : verrouillé à l'heure de début du match visé
             (reste ouvert même si la série a déjà commencé).
```

### 6.4 — Workflow des statuts

```text
BROUILLON → SOUMIS → VALIDÉ → GAGNÉ / PERDU
                   ↘ REFUSÉ
        (cas limite) → ANNULÉ
```

```text
BROUILLON : rédaction, pas encore soumis.
SOUMIS    : en attente de revue admin (clarté, vérifiabilité, difficulté).
VALIDÉ    : admin approuve et fixe/ajuste la difficulté → pari « en jeu ».
REFUSÉ    : admin rejette (ambigu, invérifiable, déjà joué, doublon, hors-jeu).
GAGNÉ / PERDU : résolution admin après la fin du match/série.
ANNULÉ    : neutralisé (match/série annulé, pari devenu invérifiable) → 0 point.
```

Pari `SOUMIS` non revu à sa deadline → **auto-validé** à la difficulté proposée par le joueur (bénéfice du doute). L'admin peut revoir ce pari à tout moment, avant comme après la fin de l'événement.

Remplacement d'un pari refusé :

```text
Avant la deadline du pari : REFUSÉ libère le slot → reproposable.
Après la deadline du pari : slot perdu, 0 point, pas de remplacement.
```

### 6.5 — Échelle de difficulté

```text
5 niveaux : 1 (très accessible) → 5 (très difficile / « jackpot »).
Le joueur PROPOSE un niveau ; l'admin VALIDE ou AJUSTE.
C'est le niveau VALIDÉ par l'admin qui fait foi pour le scoring.
```

### 6.6 — Visibilité

```text
Chaque pari devient visible à SA propre deadline (série → 1er match ;
match → début du match visé). Détail nominatif complet (auteur + énoncé
+ difficulté validée), visible de tous, visiteurs publics inclus.
L'admin voit tous les paris en permanence.
```

### 6.7 — Vérification gagné/perdu

```text
V1 : vérification MANUELLE par l'admin (sa décision fait foi), journalisée.
```

Interface admin dédiée (détail en section 9.4) : file d'attente des paris `SOUMIS` à valider, puis liste des paris `VALIDÉ` à résoudre en `GAGNÉ`/`PERDU`, avec contexte complet sans navigation, action rapide, motif obligatoire en cas de refus.

Évolution non bloquante envisagée : une IA pourrait **pré-remplir** une suggestion gagné/perdu à partir des données du match (réaliste pour les paris déductibles de scores/box scores, inopérant pour les paris flous/subjectifs) — l'IA resterait une aide, jamais l'autorité finale. Faisabilité renvoyée à la spec technique.

---

## 7. Scoring global — barème consolidé

### 7.1 — Méthode : équilibre d'abord (top-down)

```text
On fixe d'abord le POIDS CIBLE de chaque source sur un playoffs complet,
puis on cale les valeurs chiffrées pour atteindre cette cible.
```

Cible d'équilibre retenue pour un joueur engagé (qui pronostique tout) :

```text
Matchs                : ~45-49 %
Bracket + séries      : ~30-35 %  (champion désormais intégré au bracket)
Paris personnalisés   : ~15-20 %
```

Équilibre **vérifié par simulation Monte-Carlo** (structure réaliste : 15 séries, ~86 matchs, 5 profils de joueurs types, 5 graines × 5000 saisons = 25 000 saisons/profil). Résultat obtenu pour le profil « complet » : **Matchs 47 % / Bracket 34 % / Paris 19 %**, variation ±0,2 à 0,5 point entre graines → très stable.

Classement des profils testés (stable sur toutes les graines) : le complet (gagne 100 % des cas) > parieur / régulier (au coude-à-coude) > visionnaire (bon bracket, zappe les matchs) > casual (peu engagé, toujours dernier). Conclusion : aucune stratégie mono-source ne domine, l'effort global sur toutes les sources est la meilleure stratégie.

### 7.2 — Barème complet

**Matchs :**

| Élément | Points |
|---|---|
| Bon vainqueur | 10 (fixe, constant sur tous les tours) |
| Bonus écart — écart exact (0) | +5 |
| Bonus écart — écart de 1 à 2 | +3 |
| Bonus écart — écart de 3 à 5 | +2 |
| Bonus écart — écart de 6 à 9 | +1 |
| Bonus écart — écart de 10 et + | +0 |
| Mauvais vainqueur | 0 (ni base, ni bonus d'écart) |

Le bonus d'écart n'est ajouté **que si le vainqueur est correct**. Un prono correct rapporte donc de 10 à 15 points. Points constants sur tous les tours (la progression « plus tard = plus de valeur » est déjà portée par le bracket).

**Bracket (par tour, trois composantes cumulables) :**

| Tour | Vainqueur | Score exact (bonus) | Affiche (bonus) |
|---|---|---|---|
| 1er tour | 25 | +10 | +0 (matchups officiels connus de tous) |
| Demi-finales de conférence | 45 | +20 | +15 |
| Finales de conférence | 80 | +30 | +25 |
| Finale NBA (= champion) | 250 | +50 | +40 |

- **Score exact** : accordé uniquement si le vainqueur est correct **et** le format (4-0…4-3) correspond à la vraie série.
- **Affiche** : accordé si les deux mêmes équipes s'affrontent à ce tour, **indépendamment** du vainqueur pronostiqué.
- Finale NBA parfaite (vainqueur + score exact + affiche) = 340 points sur cette seule série.

**Paris personnalisés (progression linéaire) :**

| Niveau de difficulté | Points |
|---|---|
| 1 | 5 |
| 2 | 10 |
| 3 | 15 |
| 4 | 20 |
| 5 | 25 |

Pari perdu = 0. Jamais de points négatifs. Le linéaire a été préféré à une progression exponentielle (« jackpot »), qui rendait un profil « gros parieur » quasi imbattable dans les simulations (jusqu'à 48 % de ses points via paris seuls) ; le linéaire garde le parieur compétitif sans stratégie dégénérée.

---

## 8. Classement et visibilité

### 8.1 — Consommation identique connecté / visiteur après coup

```text
Après verrouillage/deadline (match, pari, bracket) : visiteur = joueur connecté
pour toute donnée de jeu. Seules différences : le connecté peut AGIR, et a
l'accès conditionnel au pré-verrouillage (« valider = voir »).
```

### 8.2 — Départage des égalités

```text
1. Total de points
2. Nombre de bons VAINQUEURS DE MATCH (pas de série)
3. Nombre d'ÉCARTS EXACTS
4. Points BRACKET
5. Ex-aequo assumé si toujours à égalité
```

### 8.3 — Organisation du classement

```text
UN SEUL classement, triable/filtrable par colonne : Total | Matchs | Bracket
| Paris | Forme récente. Un clic sur une colonne réordonne tout le classement
selon cette source. Les « classements secondaires » deviennent de simples
vues triées du même tableau, pas des écrans distincts.
```

En cas d'égalité sur une colonne triée, la cascade de départage générale (8.2) s'applique. « Forme récente » : fenêtre glissante de **7 jours**, toutes sources confondues.

### 8.4 — Sources de points affichées

```text
Chaque ligne du classement est dépliable en sous-totaux PUBLICS :
Matchs / Bracket (vainqueur + score + affiche) / Paris / Total.
```

### 8.5 — Brackets individuels après deadline

```text
Vue publique par défaut = tendances agrégées (seuil dynamique : > 10 brackets
remplis → %, sinon nombre brut). Clic sur une série = détail (drill-down).
```

Point encore ouvert : rendu exact du drill-down (nominatif « qui a mis quoi » ou distribution enrichie seule) → renvoyé à l'UX/UI et à la spec technique.

---

## 9. Administration

### 9.1 — Gestion des joueurs

```text
Actions : valider explicitement, désactiver, réactiver, promouvoir (PLAYER→ADMIN),
rétrograder (ADMIN→PLAYER). Garde-fous : pas d'auto-rétrogradation, dernier
admin actif non rétrogradable.
```

### 9.2 — Supervision compétition / séries / matchs

```text
Sur un MATCH : horaire/date, score final, statut (programmé/en cours/terminé/
               reporté/annulé).
Sur une SÉRIE : affiche officielle, format/score de série, statut (en cours/
               terminée/reportée/annulée).
```

Principe transverse : l'édition admin agit sur les **données officielles**, **jamais** sur les prédictions des joueurs. Toute correction déclenche un recalcul et est journalisée.

### 9.3 — Workflow de requête de correction joueur → admin

```text
Statuts : EN_ATTENTE → TRAITÉE
                     ↘ REFUSÉE (motif admin obligatoire)
```

```text
Canal : in-app uniquement (formulaire depuis le prono/pari concerné).
Périmètre : 1 requête = 1 prono/pari sur 1 match ou 1 série (pas de requête globale).
Traitement : par n'importe quel admin sauf l'auteur s'il est lui-même admin.
Pas de délai limite en V1 (traitable même après le match).
```

### 9.4 — Files de traitement des paris personnalisés

```text
FILE DE VALIDATION : paris SOUMIS → VALIDÉ (ajustement difficulté possible)
                     ou REFUSÉ (motif obligatoire).
FILE DE RÉSOLUTION : paris VALIDÉ échus → GAGNÉ/PERDU (motif recommandé,
                     obligatoire si contesté).
```

Chaque item affiche son contexte complet sans navigation (joueur, série/match, énoncé, difficulté proposée vs validée). Résolution rapide, chaque action journalisée.

### 9.5 — Recalcul des scores

```text
Recalcul IDEMPOTENT : rejoue intégralement le barème (section 7) à partir
des données officielles figées + prédictions figées → même résultat pour un
même état, pas de double comptage, rejouable sans risque.
```

Déclencheurs : (a) automatique après synchro/résolution d'un résultat officiel ; (b) bouton admin « Recalculer » manuel (filet de sécurité). Au proto : déclenché manuellement ou par la simulation (pas de cron réel).

### 9.6 — Journalisation / logs

Deux natures **distinctes**, à ne jamais confondre :

```text
1. LOG INTERNE (audit) : jamais public, réservé aux admins.
   Contenu : acteur, action, cible, horodatage, motif, avant → après.

2. MARQUAGE PUBLIC de transparence : visible de tous sur l'objet concerné.
   ex. « prono saisi/corrigé par admin X sur requête de joueur Y ».
   C'est un attribut de l'objet, pas le log d'audit.
```

Actions à journaliser : correction de résultat (match/série), modification d'horaire/statut/affiche, validation/refus/ajustement de difficulté d'un pari, décision gagné/perdu, traitement/refus d'une requête de correction, saisie/correction d'un prono sur requête, désactivation/réactivation d'un joueur, promotion/rétrogradation de rôle, recalcul manuel.

Rétention : conservés toute la durée de la compétition, pas de purge en V1 (non bloquant).

---

## 10. Données NBA, API et simulation

### 10.1 — Frontière simulation / réel

```text
PROTO : simulation d'API, pas de NBA réelle, pas de cron réel.
V1    : API NBA externe, cron Vercel, synchro automatique.
```

Pas de format de données commun imposé au proto — la V1 adaptera son contrat de données au fournisseur choisi. Noms de champs sains et lisibles conservés malgré tout (équipes, date/heure, statut, score, format de série).

Stockage de la donnée de jeu au proto : **pas de table de résultats dédiée** — génération déterministe pilotée par une **seed** (fixtures figées) + un **curseur** (« où en est-on dans les playoffs simulés »). Garantit l'idempotence et la règle « une prédiction figée n'est jamais modifiée » sans avoir à stocker les résultats.

### 10.2 — Modèle de données de jeu simulé

```text
Structure identique à la V1 : playoffs COMPLET.
1er tour : 8 séries | Demi-finales conf. : 4 séries | Finales conf. : 2 séries
| Finale NBA : 1 série = 15 séries, 4 tours (~86 matchs).
```

« Prototype jetable » simplifie la **qualité** (code, sécurité, UX), pas la **structure de jeu** — nécessaire car le scoring (section 7) est câblé sur les 4 tours et l'équilibre 47/34/19 % n'a de sens que sur un playoffs entier.

Faux joueurs : comportements variés, calqués sur les 5 profils de la section 7.1 (complet, parieur, régulier, visionnaire, casual).

### 10.3 — Ce que produit la simulation

```text
Avancement du temps : MANUEL (bouton admin) + AUTO débrayable.
Granularité d'un cran : match (debug fin) / jour (défaut) / série entière (saut rapide).
```

La simulation auto ne produit que le **nominal** (programmé → terminé). Les cas limites (reporté/annulé) restent déclenchables **à la main** par l'admin, pour tester les règles des sections 4.6 et 5.6.

Résultats déterministes via seed, **pas de forçage** d'un résultat précis (casserait l'idempotence). Des seeds pré-choisies pour des scénarios ciblés (ex. « finale en 4-3 ») restent envisageables.

### 10.4 — API NBA réelle (V1)

Choix du fournisseur : reporté à la spec technique.

Cahier des charges de données V1 (dérivé des règles fonctionnelles) :

| Donnée | Usage |
|---|---|
| Équipes qualifiées (16) | Bracket, mapping |
| Calendrier des séries + affiches | Bracket, bonus affiche |
| Date/heure de chaque match | Fenêtre 3 jours, deadlines, verrouillage |
| Statut de match | Verrouillage, reporté/annulé |
| Score final de match | Scoring vainqueur + écart |
| Format/score de série | Scoring bracket (vainqueur, score exact) |
| Statut de série | Clôture série, paris série |

Box scores individuels : **hors périmètre V1** (la vérification des paris personnalisés reste manuelle, elle n'en a pas besoin).

### 10.5 — Mapping équipes et matchs

```text
Identifiants internes STABLES + table de correspondance vers l'id de la source.
Le reste de l'app ne travaille que sur les ids internes.
Même principe appliqué au proto (source = simulation).
```

Entité non reconnue : le rapprochement automatique est une **simple suggestion**. Tant que l'admin n'a pas confirmé, l'entité reste **EN ATTENTE** (aucun scoring, aucun verrouillage, aucune écriture de jeu ne s'appuie dessus). Toute confirmation est journalisée.

### 10.6 — Cron, synchro et logs de synchronisation

```text
Horaires des matchs : rafraîchis régulièrement à l'approche des matchs.
Verrouillage : piloté par l'heure connue du match, PAS par la synchro.
Synchro résultats : plusieurs fois par jour pendant la phase de matchs.
```

Chaîne de recalcul : synchro → un résultat a-t-il changé ? Oui → recalcul déclenché (idempotent). Non → aucun recalcul. Logs de synchro (traces machine : horodatage, données récupérées, succès/erreur) réservés au diagnostic, non publics, distincts des logs admin.

### 10.7 — Pré-remplissage IA gagné/perdu (paris personnalisés)

Principe acté comme évolution possible, non bloquante pour la V1 (vérification manuelle = référence). Faisabilité et périmètre exact renvoyés à la spec technique. Box scores individuels hors périmètre V1 tant que l'IA n'est pas décidée. Garde-fou maintenu dans tous les cas : l'IA ne tranchera jamais les paris flous ou subjectifs.

---

## 11. UX / UI

### 11.1 — Principes transverses

```text
Mobile d'abord. Jeu entre amis (10-30 joueurs).
Direction : Arène / broadcast. Fond sombre par défaut, bascule clair disponible.
Énergie « arène » concentrée sur les moments forts (carte de match, bracket,
champion) ; écrans de lecture (classement, mes pronos, admin) plus calmes.
Logos de franchise sur pastille neutre constante ; fallback abréviation.
```

### 11.2 — Navigation et dashboard joueur

```text
Barre mobile à 4 onglets : Accueil · Jouer (hub) · Classement · Profil.
```

- **Jouer** : hub regroupant Matchs, Bracket, Paris, Mes pronos, avec pastilles « à faire » par univers (rythmes différents : bracket une fois, matchs quotidien, paris occasionnel).
- **Accueil** : centre d'attention — bloc « À traiter » trié par urgence (bracket non validé > matchs > paris > feedback récent) avec compte à rebours et action directe ; bloc « Ça vient de tomber » (points gagnés, mouvement de rang) ; en-tête rang/points.
- Admin : bloc « À traiter (admin) » additionnel selon rôle. Visiteur non connecté : navigation réduite (classement + bracket global uniquement).

### 11.3 — Cartes de match et parcours de validation

```text
Saisie : vainqueur (2 boutons) + écart (pavé numérique).
Avant validation : pronos des autres masqués (panneau verrouillé explicite).
Compteur X/N : visible en permanence.
Validation : définitive, précédée d'une confirmation légère (rappel des
conséquences). Après validation : révélation (tendance + détail nominatif),
mise à jour continue jusqu'au coup d'envoi.
```

Écran « Matchs » : fenêtre 3 jours groupée par jour, 4 statuts visuels (validé / prêt / incomplet / à faire), bandeau « Tout valider » n'apparaissant que s'il existe des brouillons complets, avec confirmation listant les matchs concernés.

### 11.4 — Bracket mobile

```text
Remplissage tour par tour : une série = une carte (vainqueur 1 tap + score
en boutons). Tours suivants pré-remplis automatiquement. Champion déduit.
Groupé par conférence (Est puis Ouest au 1er tour). Progression X/15.
```

Consultation : Vue A « résumé par tour » par défaut (état réel + tendances, tap = drill-down) ; Vue B « arbre scrollable » en plein écran/paysage (effet poster).

### 11.5 — Classement (UI)

```text
Tri par puces : Total · Matchs · Bracket · Paris · Forme.
Le TOTAL reste toujours affiché, quel que soit le tri actif.
```

Joueur inactif (désactivé) : grisé + tag « inactif », conservé avec ses points. Absents sur un match : compteur neutre « X n'ont pas joué », noms révélés au clic/survol. Barre « toi » collante activée au-delà de 20 joueurs.

### 11.6 — Paris annulés et rafraîchissement live

```text
Pari ANNULÉ : affiché barré + grisé dans « Mes paris », mention « neutralisé »
+ raison, visuellement distinct d'un « perdu », dans la liste (pas de section à part).
```

Rafraîchissement live (cible) : mise à jour silencieuse en place + repère « mis à jour il y a… » + badge « EN DIRECT ». Au proto : piloté par le curseur de simulation. En V1 : dépend de la fraîcheur réelle de l'API — écran conçu pour dégrader proprement. Le verrouillage des pronos reste piloté par l'heure connue du match, jamais par le live.

### 11.7 — Écrans admin

```text
Entrée : tableau de bord admin unique (même patron que l'Accueil joueur),
compteurs par file → chaque file s'ouvre en page dédiée.
```

Files : validation (paris `SOUMIS`), résolution (paris échus `GAGNÉ`/`PERDU`), requêtes de correction (`EN_ATTENTE`/`TRAITÉE`/`REFUSÉE`) — chacune avec contexte complet sans navigation. Gestion des joueurs : actions contextuelles par ligne (promouvoir/désactiver/réactiver/rétrograder), garde-fous visibles. Historique des logs : écran de consultation pure (audit privé), filtrable. Bouton « Recalculer » : filet de sécurité avec confirmation.

---

## 12. Prototype jetable

### 12.1 — Périmètre

```text
Côté JOUEUR : COMPLET — fidèle à toutes les règles de ce document
  (inscription, bracket 15 séries, pronos match, paris série+match,
  scoring complet, classement triable, toutes règles de visibilité).

Côté ADMIN : MINIMAL, en mode debug —
  avancer le temps (manuel + auto débrayable), déclencher à la main les cas
  limites (match reporté/annulé), gestion des paris/requêtes en édition
  directe (base/debug), sans UI polie.
```

Hors périmètre du prototype (V1 uniquement) : API NBA réelle, RLS complètes, écran de logs d'audit consultable, promotion/rétrogradation de rôle en UI, sourcing des logos officiels.

### 12.2 — Données fictives

```text
Faux joueurs : montée en charge progressive — démarrage sous le seuil de
10 brackets remplis (ex. 8 joueurs), ajout progressif jusqu'à le dépasser
(ex. 12-15 joueurs), pour tester les deux affichages de tendance (section 8.5).

Structure de jeu : playoffs COMPLET (15 séries, 4 tours, ~86 matchs) —
aucune simplification de la structure, seulement de la qualité d'implémentation.

Mode de test : SOLO — l'auteur du projet pilote tous les profils,
pas de vrais amis en parallèle à ce stade. Pas besoin de comptes/emails
distincts, un mécanisme simple de bascule entre profils suffit.
```

### 12.3 — Profils scriptés

Les 5 profils de la section 7.1 (complet, parieur, régulier, visionnaire, casual) sont **intégralement scriptés** : remplissage automatique du bracket, des pronos et des paris selon le comportement type de chaque profil, piloté par la même seed que la simulation (déterminisme). Aucune intervention manuelle sur les profils. L'auteur du projet reste en position d'observateur/admin, pas incarné parmi les 5 profils.

### 12.4 — Fidélité UX

```text
MOYENNE : direction visuelle de base appliquée (sombre/clair, cartes de
match, structure du bracket), sans polish (pas de logos officiels, pas de
micro-animations, pas de détails fins).
```

### 12.5 — Stack

```text
Identique à la cible V1, ALLÉGÉE : Next.js + Supabase + Vercel,
auth simplifiée (juste de quoi distinguer profils/rôles), PAS de RLS.
```

Double objectif : valider le concept fonctionnel ET se familiariser avec les outils cibles avant d'attaquer la V1 propre. Une étape de présentation + mini-tuto appliqué sur les outils est intégrée en tête de la roadmap du prototype.

### 12.6 — Simulation d'API

```text
Génération déterministe (seed + fixtures figées) + curseur (« où en est-on »).
Deux modes : manuel (bouton admin) + auto débrayable.
Granularité par défaut : PAR JOUR (cohérent avec la fenêtre glissante 3 jours),
granularité « match » disponible ponctuellement pour du debug fin.
```

### 12.7 — Modèle Claude recommandé

```text
Développement du prototype (code Next.js/Supabase, logique de simulation) :
  Claude Sonnet 5 — bon compromis rapidité/coût, cohérent avec l'esprit
  « jetable, pas parfait ».
Claude Opus 4.8 réservé à la V1 propre (Supabase, RLS, architecture
  définitive), où la rigueur prime sur la vitesse d'itération.
```

---

## 13. Cas limites — récapitulatif transverse

| Cas | Règle |
|---|---|
| Série annulée/reportée | Décision admin manuelle, journalisée |
| Match reporté (mêmes équipes) | Pronos conservés, deadline recalée, admin peut rouvrir en cas exceptionnel |
| Match annulé | Neutralisé, 0 point pour tous, aucune pénalité |
| Donnée API change en cours | Bracket/pronos joueur déjà saisis restent figés |
| Erreur de donnée avant deadline | Admin peut rouvrir/corriger avant verrouillage |
| Pari devenu invérifiable (match/série annulé) | Statut `ANNULÉ`, 0 point, aucune pénalité |
| Oubli total (match, bracket) | 0 point, jamais de pénalité négative |
| Joueur désactivé en cours de compétition | Ses données restent figées et comptabilisées au classement |
| Un seul admin existant | Ses propres requêtes de correction restent `EN_ATTENTE` |

---

## 14. Points ouverts — récapitulatif complet

### 14.1 — À trancher lors d'un futur cadrage fonctionnel (non technique)

```text
- Faut-il un code compétition malgré l'inscription libre ? (0.2.1)
- Traitement exact d'un bracket PARTIELLEMENT rempli à la deadline :
  auto-validation partielle, invalidation, ou validation des seules séries
  remplies ? (0.2.2) — jamais tranché.
- Rendu exact du drill-down bracket au clic : nominatif « qui a mis quoi »
  par série, ou distribution enrichie seule ? (0.2.2 / 0.2.6 / 0.2.9)
- Valeur maximale exacte de l'écart saisissable sur un pronostic match
  (borne haute ≈ 40-50, à figer) (0.2.3 / 0.2.5)
- Colonnes visibles vs masquées sur mobile dans le tableau de classement (0.2.6)
```

### 14.2 — Renvoyés à la spec technique (Claude Project dédié au développement)

```text
- Règles d'arrondi et d'affichage des sous-totaux par source dans l'UI (0.2.5/0.2.6)
- Gestion du scoring en cas de série annulée/neutralisée vis-à-vis du bracket
  (0.2.5 / 0.2.7 / 0.2.8)
- Confirmation que le bonus affiche se compare par paire d'équipes et non
  par position de slot (0.2.5)
- Mécanisme technique du bootstrap du premier admin (seed) (0.2.7)
- Faisabilité et périmètre du pré-remplissage IA gagné/perdu des paris (0.2.4/0.2.7/0.2.8)
- Choix du fournisseur d'API NBA réelle pour la V1, et vérification qu'il
  couvre les exigences minimales (horaires fiables, statuts fiables,
  scores fiables, fraîcheur compatible verrouillage) (0.2.8)
- Mécanisme technique du mapping en bloc des équipes à l'ouverture du 1er tour (0.2.8)
- Fréquence précise de synchro et de rafraîchissement des horaires (0.2.8)
- Fréquence de rafraîchissement de l'affichage joueur en direct
  (dépend de l'API choisie) (0.2.8 / 0.2.9)
```

### 14.3 — Non bloquants / reportés à une itération future

```text
- Réactivation éventuelle d'un statut PENDING si le besoin apparaît un jour (0.2.1)
- Format de stockage et purge éventuelle des logs admin à très long terme (0.2.7)
- Format de stockage/rétention des logs de synchro (0.2.8)
- Sourcing des 30 logos officiels NBA et format d'intégration (V1) (0.2.9)
- Détail fin des écrans admin : filtres et tri de l'historique des logs (0.2.9)
- Comportement exact de la bascule vue résumé/arbre du bracket en
  plein écran/paysage (0.2.9)
- Micro-animations et seuils du rafraîchissement live selon la fréquence
  réelle de synchro (0.2.9)
- Rendu précis de la barre « toi » collante (0.2.9)
- États vides de chaque écran et libellés définitifs (0.2.9)
- Contenu exact du mini-tuto outils (Next.js/Supabase/Vercel) (0.2.10)
- Mécanisme précis de bascule entre profils de test au prototype
  (sélecteur simple vs pseudo-login) (0.2.10)
- Scripts de comportement détaillés des 5 profils (règles précises
  de décision par profil) (0.2.10)
- Nombre exact de faux joueurs à chaque palier de montée en charge (0.2.10)
- Seeds pré-choisies pour des scénarios de test ciblés (0.2.8 / 0.2.10)
```

---

## 15. Traçabilité documentaire

Ce document consolide les 10 documents de décisions suivants (tous `[VALIDÉ]`), conservés comme historique du raisonnement (justifications, exemples, alternatives écartées) :

```text
nba_pronos_decisions_0_2_1_acces_roles.md
nba_pronos_decisions_0_2_2_bracket_initial.md
nba_pronos_decisions_0_2_3_pronostics_matchs.md
nba_pronos_decisions_0_2_4_paris_personnalises.md
nba_pronos_decisions_0_2_5_scoring_global.md
nba_pronos_decisions_0_2_6_classement_visibilite.md
nba_pronos_decisions_0_2_7_administration.md
nba_pronos_decisions_0_2_8_donnees_api_simulation.md
nba_pronos_decisions_0_2_9_ux_ui.md
nba_pronos_decisions_0_2_10_prototype_jetable.md
```

Documents **remplacés** par le présent fichier (obsolètes) :

```text
nba_pronos_plan_cadrage_titres.md
nba_pronos_plan_cadrage_detaille.md
nba_pronos_resume_cadrage_valide.md
```

---

## 16. Prochaines étapes

```text
1.2 — Liste des points ouverts (déjà intégrée à ce document, section 14 ;
      un fichier séparé peut être extrait si utile pour le suivi).
1.3 — Synthèse pour Claude Project (contexte optimisé pour le futur
      Claude Project dédié au développement).

Puis, une fois ce document jugé stable :
  SPEC_TECHNIQUE_V0.1.md (architecture Next.js, modèle Supabase, RLS,
  types TypeScript, simulation, cron, déploiement) — à produire dans
  le Claude Project dédié au développement, PAS dans cette conversation.
```
