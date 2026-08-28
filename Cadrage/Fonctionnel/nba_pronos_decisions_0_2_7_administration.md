# NBA Pronos — Décisions validées 0.2.7

> Section : **Administration**  
> Statut : **validé**  
> Objectif : consolider et compléter les règles d'administration éparses dans 0.2.1 → 0.2.6, fixer les décisions neuves (modèle admin, files de paris, workflow de requête, recalcul, logs), avant de passer aux données NBA et à la simulation.

---

## 1. Positionnement de la section

Décision validée :

```text
0.2.7 est majoritairement une CONSOLIDATION.
```

Une grande partie du comportement admin a déjà été tranchée ailleurs :

- correction sur requête uniquement, transparente et journalisée (0.2.3) ;
- un admin ne traite jamais son propre prono → nécessite un autre admin (0.2.3) ;
- auto-validation des paris soumis non revus, revue admin possible à tout moment (0.2.4) ;
- cas limites match/série (reporté, annulé, neutralisé) déjà cadrés (0.2.2, 0.2.3) ;
- une mise à jour de données ne modifie jamais une prédiction figée (0.2.2, 0.2.3) ;
- logs admin jamais exposés publiquement (0.2.1, 0.2.6).

Le travail neuf de 0.2.7 tient donc à : le modèle admin et la règle « ≥ 2 admins », l'abandon de `PENDING`, l'effet d'une désactivation sur le classement, les files de paris, le workflow de la requête de correction, le recalcul et la distinction log interne / marquage public.

Aucune décision de 0.2.7 ne contredit les sections antérieures.

---

## 2. Modèle admin, rôles et contrainte « au moins deux admins »

Rappel verrouillé :

```text
ADMIN = joueur + droits admin (0.2.1).
Un admin ne peut jamais traiter sa propre requête de correction (0.2.3).
```

Décisions validées :

```text
La contrainte « ≥ 2 admins » est une règle MÉTIER assumée, pas un verrou système bloquant.
```

Concrètement :

- le système ne force pas à toujours disposer de 2 admins ;
- il refuse seulement l'action « un admin résout sa propre requête » ;
- s'il n'existe qu'un seul admin, ses propres requêtes de correction restent **`EN_ATTENTE`** jusqu'à l'existence d'un 2ᵉ admin.

Promotion / rétrogradation :

```text
Un admin peut promouvoir un PLAYER en ADMIN.
Un admin peut rétrograder un ADMIN en PLAYER.
```

Garde-fous :

- un admin **ne peut pas se rétrograder lui-même** (évite le lock-out involontaire) ;
- un admin **ne peut pas être rétrogradé s'il est le dernier admin actif**.

Bootstrap du 1ᵉʳ admin :

```text
Hors périmètre fonctionnel : réglé à la main (seed / base) au proto et en V1.
Noté comme point technique, pas comme décision produit.
```

---

## 3. Gestion des joueurs

Rappel verrouillé :

```text
Inscription libre, ACTIVE par défaut, admin peut DISABLED / réactiver (0.2.1).
```

Décision validée — abandon de `PENDING` :

```text
PENDING est définitivement écarté pour le proto ET la V1.
Inscription libre + ACTIVE immédiat suffit.
Réactivable plus tard sans dette technique.
```

Décision validée — effet d'une désactivation :

```text
Un joueur DISABLED ne peut plus saisir ni valider.
MAIS ses pronos, brackets, paris et points déjà acquis restent
ET restent comptabilisés au classement.
```

Justification :

- désactiver ≠ effacer ;
- les données de jeu sont historisées et figées (cohérent avec 0.2.2 / 0.2.3) ;
- supprimer un joueur du classement fausserait rétroactivement les scores relatifs des autres.

Affichage :

- le joueur désactivé apparaît toujours au classement ;
- marquage « inactif » possible → rendu renvoyé à 0.2.9.

---

## 4. Supervision compétition / séries / matchs et corrections

Rappel verrouillé :

```text
Série annulée / reportée → décision admin manuelle (0.2.2).
Match reporté → deadline recalée, admin peut rouvrir (0.2.3).
Match annulé → neutralisé, 0 point pour tous (0.2.3).
Une MAJ de données ne modifie jamais un prono figé (0.2.2, 0.2.3).
```

Décisions validées — périmètre d'édition admin :

```text
Sur un MATCH : horaire / date, score final, statut
               (programmé / en cours / terminé / reporté / annulé).

Sur une SÉRIE : affiche officielle, format / score de série, statut
               (en cours / terminée / reportée / annulée).
```

Principe transverse rappelé :

```text
L'édition admin agit sur les DONNÉES OFFICIELLES (résultats),
JAMAIS sur les prédictions des joueurs.
```

Conséquences :

- toute correction de résultat déclenche un recalcul (voir section 6) ;
- toute correction est journalisée (voir section 7).

---

## 5. File d'attente des paris personnalisés

Rappel verrouillé :

```text
Workflow des statuts, auto-validation à la deadline, vérif manuelle en V1,
IA en pré-remplissage renvoyée à la spec technique (0.2.4).
```

Décision validée — deux files distinctes :

```text
FILE DE VALIDATION :
  paris SOUMIS à traiter → VALIDÉ (avec ajustement de difficulté)
                         ou REFUSÉ (motif OBLIGATOIRE).

FILE DE RÉSOLUTION :
  paris VALIDÉ dont l'échéance est passée → GAGNÉ / PERDU
  (motif recommandé, obligatoire si contesté).
```

Règles d'ergonomie fonctionnelle :

- chaque item affiche son **contexte complet sans navigation** (joueur, série / match, énoncé, difficulté proposée vs validée) ;
- résolution **rapide** (peu de clics) ;
- chaque action est **journalisée**.

---

## 6. Workflow de la requête de correction joueur → admin

Rappel verrouillé (0.2.3) :

```text
Correction admin UNIQUEMENT sur requête du joueur, possible même après le match.
Prono corrigé marqué public + tracé.
Admin jamais sur son propre prono.
```

Décisions validées — le workflow neuf :

Statuts de la requête :

```text
EN_ATTENTE → TRAITÉE
           ↘ REFUSÉE (motif admin OBLIGATOIRE)
```

Canal :

```text
Requête IN-APP (formulaire depuis le prono / match concerné).
Pas de canal externe.
Le joueur précise le prono visé + une justification.
```

Périmètre :

```text
1 requête = 1 prono / pari sur 1 match ou 1 série.
Pas de requête globale.
```

Traitement :

- par n'importe quel admin **sauf** l'auteur du prono si celui-ci est lui-même admin (renvoi section 2) ;
- **pas de délai limite** en V1 (cohérent avec « traitable même après le match ») ;
- durcissement éventuel (ex. exiger une requête antérieure au match) reporté, non bloquant.

---

## 7. Recalcul des scores

Rappel verrouillé :

```text
Barème complet figé (0.2.5), recalcul auto via cron prévu en V1,
correction manuelle possible.
```

Décision validée — nature du recalcul :

```text
Le recalcul est IDEMPOTENT.
Il rejoue intégralement le barème 0.2.5 à partir des
DONNÉES OFFICIELLES figées + PRÉDICTIONS figées,
et produit toujours le même résultat pour un même état.
=> pas de double comptage, rejouable sans risque.
```

Déclencheurs :

```text
(a) automatique après synchro / résolution d'un résultat officiel ;
(b) bouton admin « Recalculer » manuel (filet de sécurité).
```

Proto :

```text
Recalcul déclenché manuellement / par la simulation (pas de cron réel).
```

Traçabilité :

- chaque recalcul manuel est journalisé (qui, quand, périmètre).

---

## 8. Journalisation / logs admin

Rappel verrouillé :

```text
Liste des actions à tracer (0.2.1).
Logs admin JAMAIS exposés publiquement (0.2.1, 0.2.6).
Marquage public « corrigé par admin » pour la transparence (0.2.3, 0.2.4).
```

Décision validée — distinguer deux natures à ne pas confondre :

```text
1. LOG INTERNE (audit) :
   jamais public, réservé aux admins.
   Contenu : qui, quoi, quand, cible, motif, valeur avant / après.

2. MARQUAGE PUBLIC de transparence :
   visible de tous sur l'objet concerné.
   ex. « prono saisi / corrigé par admin X sur requête de joueur Y ».
   C'est un ATTRIBUT de l'objet, pas le log d'audit.
```

Entrée de log standard :

```text
acteur, action, cible (joueur / match / série / pari),
horodatage, motif, avant → après.
```

Consultation :

```text
Réservée aux admins (écran d'historique).
```

Rétention :

```text
Conservée toute la durée de la compétition.
Pas de purge en V1 (non bloquant).
```

Actions à journaliser (rappel consolidé de 0.2.1, enrichi) :

- correction de résultat (match / série) ;
- modification d'horaire, de statut, d'affiche ;
- validation, refus ou ajustement de difficulté d'un pari personnalisé ;
- décision gagné / perdu sur un pari personnalisé ;
- traitement ou refus d'une requête de correction joueur ;
- saisie / correction d'un prono sur requête ;
- désactivation / réactivation d'un joueur ;
- promotion / rétrogradation d'un rôle ;
- recalcul manuel des scores.

---

## 9. Résumé court

```text
Positionnement : consolidation des règles admin + fixation des décisions neuves.
≥ 2 admins     : règle métier souple ; requête propre reste EN_ATTENTE si un seul admin.
Rôles          : promotion / rétrogradation possibles ; pas d'auto-rétrogradation ;
                 dernier admin non rétrogradable.
PENDING        : abandonné (proto + V1). ACTIVE immédiat suffit.
Désactivation  : bloque la saisie, mais conserve pronos/points et maintient au classement.
Édition admin  : sur données officielles (match / série), jamais sur les prédictions.
Paris          : deux files — validation (SOUMIS→VALIDÉ/REFUSÉ) et résolution (→GAGNÉ/PERDU).
Requête        : in-app, 1 requête = 1 prono/pari ; statuts EN_ATTENTE→TRAITÉE/REFUSÉE ;
                 pas de délai limite en V1.
Recalcul       : idempotent (rejoue 0.2.5) ; auto + bouton manuel ; simulation au proto.
Logs           : log interne d'audit (privé) ≠ marquage public de transparence.
Rétention logs : toute la compétition, pas de purge en V1.
```

---

## 10. Points ouverts liés à 0.2.7

À préciser en 0.2.8, 0.2.9 ou lors de la spec technique :

- rendu UI des écrans admin (files de paris, historique de logs, gestion joueurs) → 0.2.9 ;
- marquage visuel « joueur inactif » au classement (renvoi 0.2.6 / 0.2.9) ;
- mécanisme technique du bootstrap du 1ᵉʳ admin (seed) → spec technique ;
- déclenchement exact du recalcul auto vis-à-vis du cron et de la synchro → 0.2.8 ;
- faisabilité et périmètre du pré-remplissage IA gagné / perdu (renvoi 0.2.4) → spec technique ;
- gestion du scoring en cas de série annulée / neutralisée vis-à-vis du bracket (renvoi 0.2.5) → spec technique ;
- format de stockage et de purge éventuelle des logs à très long terme (non bloquant).

---

## 11. Suite du cadrage

Prochaine section :

```text
0.2.8 — Données NBA, API et simulation
```

Objectifs de la section suivante :

- définir la simulation d'API pour le prototype (matchs, scores, statuts) ;
- définir le nombre de faux joueurs, séries et matchs simulés ;
- définir le choix futur d'API NBA réelle pour la V1 ;
- définir le mapping équipes et matchs ;
- définir la stratégie de cron Vercel et les logs de synchronisation ;
- définir le déclenchement du recalcul automatique (renvoi 0.2.7) ;
- étudier la faisabilité du pré-remplissage IA des paris personnalisés (renvoi 0.2.4).
