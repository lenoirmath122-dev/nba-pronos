# NBA Pronos — Décisions validées 0.2.3

> Section : **Pronostics match par match**  
> Statut : **validé**  
> Objectif : cadrer les règles fonctionnelles des pronostics match par match avant de passer aux paris personnalisés.

---

## 1. Fenêtre de matchs affichée

Décision validée :

```text
Fenêtre par défaut : glissante sur 3 jours.
```

Conditions posées :

- n'afficher que les matchs **bien identifiés** (adversaire connu, date et heure confirmées) ;
- **tri par proximité temporelle** : le match le plus proche affiché en premier.

Conséquences :

- les matchs conditionnels non encore planifiés (matchs 5-6-7 d'une série tant que la date n'est pas fixée) n'apparaissent pas dans la fenêtre ;
- ordre chronologique croissant, le match le plus imminent en tête.

Sortie de la fenêtre de saisie :

```text
Dès qu'un match démarre ou que son prono est verrouillé,
il quitte la fenêtre de saisie et bascule dans "Mes pronos".
```

État vide :

```text
Si aucun match identifié sur les 3 prochains jours,
afficher le message « Aucun match à pronostiquer pour l'instant ».
```

Distinction d'écrans qui en découle :

- **Fenêtre de saisie** : les matchs pronosticables des 3 prochains jours ;
- **Mes pronos** : historique + matchs en cours ou verrouillés.

---

## 2. Contenu du prono

Décision validée :

```text
Prono match = vainqueur + écart, indissociables.
```

Règles :

- l'**écart est toujours obligatoire** : pas de prono validable sans écart ;
- l'écart est une **valeur entière positive** (≥ 1, pas de match nul en NBA) ;
- les points sont attribués selon la **précision** de l'écart (bonus décroissant à mesure qu'on s'éloigne de la marge réelle).

Exemple :

```text
Celtics gagnent de 8 points.
```

Renvoi :

- le **barème chiffré** du scoring d'écart est défini en section 0.2.5 (scoring global).

---

## 3. Mode de saisie de l'écart

Décision validée :

```text
Saisie de l'écart : champ numérique libre (entier).
```

Règles :

- bornes : minimum 1, maximum raisonnable (≈ 40-50, valeur exacte à caler en scoring / UX) ;
- scoring de **proximité** calculé sur la valeur exacte saisie ;
- UX : pavé numérique mobile, saisie rapide, garde-fou sur les valeurs hors bornes.

Objectif : maximiser la finesse du scoring tout en gardant une saisie simple, cohérente avec le principe « précision = points ».

---

## 4. Cycle brouillon / validation / verrouillage

Décision validée :

```text
Trois états d'un prono match :

BROUILLON  : rempli ou partiel, modifiable, non définitif.
             → le joueur ne voit PAS les pronos des autres.
VALIDÉ     : confirmé, définitif, non modifiable.
             → le joueur voit les pronos validés des autres.
VERROUILLÉ : heure de début du match atteinte, plus aucune saisie possible.
```

Principe produit fondateur :

```text
Voir les pronos des autres = accepter de figer le sien.
```

Validation irréversible :

```text
Une fois validé, ni modification ni retour en arrière,
même si le match n'a pas encore commencé.
```

Granularité de la validation :

- **validation match par match** ;
- option de confort : **« Valider tous les matchs complets »** pour valider d'un coup tous les matchs dont le prono est entièrement rempli (utile les soirs à plusieurs matchs).

Règle de l'option « Valider tous les matchs complets » :

```text
- ne concerne que les matchs vainqueur + écart entièrement renseignés ;
- ignore les matchs partiels (restent en brouillon) ;
- demande une confirmation explicite (rappel du nombre de matchs + irréversibilité).
```

Visibilité en continu :

```text
Après validation d'un match, l'écran ouvre les pronos déjà validés des autres,
et se met à jour à mesure que d'autres valident, jusqu'au verrouillage.
```

---

## 5. Prono rempli mais non validé à la deadline

Décision validée :

```text
À la deadline (heure de début du match) :

Brouillon COMPLET (vainqueur + écart)  → auto-validé, compte pour le scoring.
Brouillon PARTIEL (un seul des deux champs) → non scorable → traité comme absence (0 point).
```

Cohérence :

- même logique d'**auto-validation** que pour le bracket (section 0.2.2) ;

Vocabulaire de la deadline :

```text
Un prono peut être : validé volontairement, auto-validé (brouillon complet), ou absent.
Les deux premiers scorent, le troisième non.
```
Clarification apportée lors de l'implémentation du prototype (0.2.10) :

```text
La distinction entre « validé volontairement » et « auto-validé » n'a AUCUN
effet observable sur la visibilité (section 9) — dans les deux cas, le prono
est bien VALIDÉ, donc il ouvre l'accès aux pronos des autres au même titre.
Le vocabulaire de cette section sert uniquement à comprendre le scoring
(section 0.2.5), pas à distinguer deux niveaux de visibilité.
```

---

## 6. Absence totale de prono

Décision validée :

```text
Absence totale de prono à la deadline = 0 point.
```

Règles :

- **aucune pénalité négative** : jamais de score inférieur à 0 pour un oubli ;
- un rattrapage par l'admin reste possible → voir section 7.

---

## 7. Correction admin exceptionnelle

Décision validée (approche **confiance + transparence**) :

```text
Requête joueur : un joueur peut demander à un admin de saisir/corriger son prono.
La requête peut être envoyée même après le début ou la fin du match.

Sans requête = aucune modification admin (l'admin n'agit jamais de sa propre initiative).
L'admin peut traiter une requête même après le match.
```

Garde-fous :

- **transparence totale** : tout prono saisi/corrigé par un admin est marqué comme tel, visible de tous, avec l'auteur de la requête et l'admin ayant agi ;
- **motif obligatoire** + journalisation complète (qui, quoi, quand, quel match, quel joueur) ;
- le garde-fou principal est assumé comme **social** (transparence), pas technique.

Exception stricte — prono de l'admin lui-même :

```text
Un admin ne peut JAMAIS saisir/corriger son propre prono.
Il doit passer par une requête traitée par un AUTRE admin.
=> au moins deux comptes peuvent porter le rôle admin.
```

Réversibilité assumée :

```text
Si l'esprit du jeu se tend un jour, on pourra durcir la règle
(ex. exiger une requête antérieure au match). Décision reportée, non bloquante.
```

Renvois :

- le **workflow détaillé de la requête** (envoi, réception, statuts en attente / traitée / refusée) sera précisé en 0.2.7 (administration) ;
- la contrainte **« au moins deux admins »** remonte vers 0.2.1 (accès et rôles) et sera intégrée à la consolidation de la spec.

---

## 8. Match reporté ou annulé

Décisions validées :

```text
Match REPORTÉ (rejoué plus tard, mêmes équipes) :
- pronos conservés, aucune resaisie forcée ;
- deadline recalée automatiquement sur la nouvelle heure de début ;
- brouillons encore modifiables jusqu'à la nouvelle deadline ;
- pronos déjà validés restent validés (engagement maintenu) ;
- SOUPAPE : l'admin peut rouvrir la saisie si un cas exceptionnel le justifie
  (décision manuelle, motivée, journalisée).
```

```text
Match ANNULÉ (n'aura pas lieu) :
- match neutralisé : 0 point pour tout le monde, aucune pénalité ;
- pronos associés ignorés au scoring ;
- décision actée par l'admin, journalisée.
```

Règle transverse :

```text
Une mise à jour de données (API ou simulation) ne modifie jamais
les pronos déjà saisis (cohérent avec la règle bracket 0.2.2).
```

---

## 9. Visibilité des pronos

Décision validée :

```text
Avant le coup d'envoi :
  je vois les pronos validés des autres UNIQUEMENT si j'ai validé le mien ;
  mise à jour continue jusqu'au verrouillage.

Après le coup d'envoi (match verrouillé) :
  tous les pronos existants (validés + auto-validés) deviennent visibles de TOUS,
  y compris de ceux qui n'avaient pas validé (ouverture souple) ;
  détail nominatif visible AUSSI par les visiteurs publics non connectés.
```

Choix assumé :

- comme le jeu se joue entre amis et connaissances, **aucun secret n'est protégé après coup** : le détail nominatif des pronos est public une fois le match verrouillé.

Compteur de participation :

```text
Compteur « X/N ont pronostiqué » :
- visible en permanence (avant et après le match), pour tous ;
- révèle seulement le NOMBRE, jamais le contenu → aucune triche possible.

Détail au clic / survol (qui a mis quoi) :
- AVANT le coup d'envoi : visible seulement si le joueur a validé son propre prono
  (respect de la règle « valider = voir », section 4) ;
- APRÈS le verrouillage : visible par tous, connectés ET visiteurs publics.
```

Note : cette décision tranche le point ouvert laissé en 0.2.1 sur le niveau de détail des pronos individuels visible publiquement, dans le sens le plus ouvert.

---

## 10. Résumé court

```text
Fenêtre : glissante 3 jours, matchs bien identifiés, plus proche en premier.
Sortie fenêtre : match démarré ou verrouillé → bascule dans "Mes pronos".
Contenu : vainqueur + écart, indissociables. Écart obligatoire, entier ≥ 1.
Saisie écart : champ numérique libre, scoring de proximité.
Cycle : brouillon → validé (irréversible) → verrouillé. Validation match par match.
Option : « Valider tous les matchs complets » avec confirmation.
Visibilité avant match : valider = voir, mise à jour continue.
Non validé à la deadline : brouillon complet auto-validé, partiel = absence.
Absence : 0 point, pas de pénalité négative.
Correction admin : sur requête joueur uniquement (même après match), transparente et tracée.
Admin sur son propre prono : interdit, passe par un autre admin (≥ 2 admins).
Match reporté : pronos conservés, deadline recalée, admin peut rouvrir.
Match annulé : neutralisé, 0 point pour tous.
Visibilité après verrouillage : tout public, détail nominatif inclus.
Compteur X/N : public en permanence ; détail conditionné avant match, ouvert après.
```

---

## 11. Points ouverts liés à 0.2.3

À préciser dans les sections suivantes ou lors de la spec technique :

- valeur maximale exacte de l'écart saisissable (à caler en scoring / UX) ;
- barème chiffré du scoring vainqueur + écart (section 0.2.5) ;
- workflow détaillé de la requête de correction joueur → admin (section 0.2.7) ;
- intégration de la contrainte « au moins deux admins » dans 0.2.1 lors de la consolidation ;
- comportement d'affichage des joueurs absents (afficher « n'a pas pronostiqué » ou masquer) — détail UX à trancher en 0.2.9.

---

## 12. Suite du cadrage

Prochaine section :

```text
0.2.4 — Paris personnalisés
```

Objectifs de la section suivante :

- définir le moment de création des paris personnalisés ;
- définir le workflow exact des statuts (brouillon, soumis, validé, refusé, gagné, perdu, annulé) ;
- définir l'échelle de difficulté ;
- définir le scoring par difficulté ;
- définir le remplacement possible d'un pari refusé ;
- définir la visibilité des paris personnalisés ;
- définir la validation et la vérification admin (manuelle ou automatisable).
