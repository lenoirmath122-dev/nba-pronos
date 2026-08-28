# NBA Pronos — Décisions validées 0.2.10

> Section : **Prototype jetable**
> Statut : **validé**
> Objectif : cadrer le périmètre exact du prototype jetable, ses données fictives, sa fidélité UX, sa stack et le rôle de la simulation, avant de passer à la production des livrables consolidés (spec fonctionnelle, points ouverts, synthèse Claude Project).

---

## 1. Positionnement de la section

Décision validée :

```text
0.2.10 est la DERNIÈRE section du cadrage fonctionnel.
Elle ne modifie AUCUNE règle métier validée en 0.2.1 → 0.2.9.
Elle cadre uniquement le PÉRIMÈTRE DE TEST du prototype jetable.
```

Principe transverse rappelé (0.2.8) :

```text
« Prototype jetable » = simplifier la QUALITÉ (code, sécurité, UX),
                         PAS la STRUCTURE de jeu.
```

---

## 2. Périmètre exact du prototype

Décision validée :

```text
Côté JOUEUR : COMPLET, fidèle à toutes les règles validées (0.2.1 → 0.2.9).
  - inscription simple ;
  - bracket complet (15 séries) ;
  - pronostics match par match ;
  - paris personnalisés (série + match) ;
  - scoring complet (barème chiffré de 0.2.5) ;
  - classement triable/filtrable ;
  - toutes les règles de visibilité (« valider = voir », révélation post-verrouillage).
```

```text
Côté ADMIN : MINIMAL, en mode debug.
  - avancer le temps (manuel + auto débrayable) ;
  - déclencher à la main les cas limites (match reporté / annulé) ;
  - pas d'écran dédié pour les files de validation / résolution des paris,
    ni pour le workflow de requête de correction
    → gestion en édition directe (base / debug), sans UI polie.
```

Justification :

- l'objectif principal du prototype est de valider **le fun réel du concept** et **l'équilibre du scoring** en conditions réelles (au-delà du Monte-Carlo de 0.2.5) → cela exige une expérience joueur complète ;
- l'admin sera peu sollicité sur une session de test courte et solo → une interface soignée n'apporte pas de valeur de validation à ce stade.

Hors périmètre du prototype (V1 uniquement) :

```text
- API NBA réelle ;
- RLS (règles de sécurité) complètes ;
- écran de logs d'audit consultable ;
- promotion / rétrogradation de rôle en UI ;
- sourcing des logos officiels NBA.
```

---

## 3. Données fictives

Décision validée — faux joueurs :

```text
Montée en charge PROGRESSIVE.
  - démarrage sous le seuil de 10 brackets remplis (ex. 8 joueurs) ;
  - ajout progressif jusqu'à dépasser le seuil (ex. 12-15 joueurs) ;
  - permet de tester les DEUX affichages de tendance (0.2.6) :
    nombre brut (≤ 10 brackets remplis) puis pourcentage (> 10).
```

Décision validée — structure de jeu :

```text
Playoffs COMPLET : 15 séries, 4 tours, ~86 matchs (rappel 0.2.8).
Pas de simplification de la structure, seulement de la qualité d'implémentation.
```

Décision validée — mode de test :

```text
SOLO : c'est l'auteur du projet qui pilote tous les profils (simulation de
plusieurs joueurs), pas de vrais amis en parallèle à ce stade.
Conséquence : pas besoin de vrais comptes / emails distincts,
un mécanisme simple de bascule entre profils suffit.
```

---

## 4. Profils de faux joueurs

Décision validée :

```text
Les 5 profils déjà définis en 0.2.5 (complet, parieur, régulier, visionnaire, casual)
sont intégralement SCRIPTÉS.
  - remplissage automatique du bracket, des pronos match et des paris personnalisés,
    selon le comportement type de chaque profil ;
  - pilotage par la même SEED que la simulation (déterminisme, cohérent avec 0.2.8) ;
  - aucune intervention manuelle sur les profils.
```

```text
Pas de profil « joueur actif » incarné par l'auteur du projet dans cette itération :
il reste en position d'observateur / admin, pas de joueur parmi les 5 profils scriptés.
```

Objectif : rejouer en conditions réelles la simulation Monte-Carlo qui a validé l'équilibre du scoring (0.2.5), et vérifier que le classement se comporte comme prévu.

---

## 5. Niveau de fidélité UX

Décision validée :

```text
Fidélité MOYENNE.
  - direction visuelle de base appliquée (sombre / clair, cartes de match,
    structure du bracket, cf. 0.2.9) ;
  - PAS de polish : pas de logos officiels, pas de micro-animations,
    pas de détails fins ;
  - suffisant pour juger l'expérience réelle et l'équilibre du scoring,
    sans investir de temps sur du détail refait de toute façon en V1.
```

---

## 6. Stack du prototype

Décision validée :

```text
Stack IDENTIQUE à la cible V1, mais ALLÉGÉE.
  - Next.js + Supabase + Vercel ;
  - Auth simplifiée (pas de flux complet, juste de quoi distinguer profils / rôles) ;
  - PAS de RLS (règles de sécurité) → reporté à la V1.
```

Double objectif assumé :

```text
1. Valider le concept fonctionnel (cœur du prototype) ;
2. Se familiariser avec les outils cibles (Next.js, Supabase, Vercel)
   AVANT d'attaquer la V1 propre dans le Claude Project dédié.
```

Ajout au process (jalon de roadmap, pas une décision produit) :

```text
Une étape de PRÉSENTATION + MINI-TUTO APPLIQUÉ sur les outils
(Next.js, Supabase, Vercel) est intégrée en tête de la roadmap du prototype
(section 3.1 du plan détaillé), avant/pendant son développement.
```

---

## 7. Rôle de la simulation d'API

Décision validée :

```text
Le mécanisme posé en 0.2.8 est confirmé SANS MODIFICATION :
  - génération DÉTERMINISTE, pilotée par une seed + les fixtures figées ;
  - un curseur « où en est-on dans les playoffs simulés » (le temps) ;
  - deux modes d'avancement : MANUEL (bouton admin) + AUTO débrayable ;
  - granularité disponible : match / jour / série entière.
```

Décision validée — granularité par défaut :

```text
PAR JOUR par défaut.
  - cohérent avec la fenêtre glissante de 3 jours (0.2.3) ;
  - laisse les profils scriptés jouer plusieurs matchs d'un coup.
Granularité « match » disponible ponctuellement pour du debug fin.
```

---

## 8. Modèle Claude recommandé pour cette étape

```text
Développement du prototype (génération de code Next.js / Supabase, logique de
simulation scriptée) : Claude Sonnet 5.
  - bon compromis rapidité / coût pour itérer vite sur un livrable jetable ;
  - cohérent avec l'esprit « jetable, pas parfait » du prototype.

Claude Opus 4.8 est réservé à la V1 propre (Supabase, RLS, architecture définitive),
où la rigueur prime sur la vitesse d'itération.
```

---

## 9. Résumé court

```text
Périmètre    : joueur complet (0.2.1 → 0.2.9), admin minimal en debug.
Données      : montée en charge progressive (8 → 12-15 faux joueurs), structure
               complète (15 séries, 4 tours, ~86 matchs).
Mode de test : solo, auteur du projet en observateur / admin.
Profils      : 5 profils (0.2.5) intégralement scriptés, pilotés par la seed.
Fidélité UX  : moyenne — identité visuelle de base, sans polish.
Stack        : identique V1 (Next.js + Supabase + Vercel), allégée (pas de RLS,
               auth simplifiée) → double objectif concept + familiarisation outils.
Process      : étape présentation + mini-tuto outils, en tête de roadmap prototype.
Simulation   : seed + curseur (0.2.8 confirmé), granularité par défaut = jour.
Modèle       : Claude Sonnet 5 pour le développement du prototype.
```

---

## 10. Points ouverts liés à 0.2.10

À préciser lors de la spec technique ou de la roadmap détaillée :

- contenu exact du mini-tuto outils (Next.js / Supabase / Vercel) et son format ;
- mécanisme précis de bascule entre profils (sélecteur simple vs pseudo-login par profil) ;
- scripts de comportement détaillés des 5 profils (règles précises de décision par profil) ;
- nombre exact de faux joueurs à chaque palier de la montée en charge ;
- seeds pré-choisies pour des scénarios de test ciblés (rappel 0.2.8).

---

## 11. État du cadrage fonctionnel

```text
0.1 → 0.2.10 : TOUS VALIDÉS.
Le cadrage fonctionnel (vision produit + 0.2.x + prototype) est désormais COMPLET.
```

---

## 12. Suite du cadrage

Prochaine étape : production des livrables consolidés (dans une conversation dédiée du Claude Project) :

```text
1.1 — SPEC_FONCTIONNELLE_V0.1.md   (document consolidé de toutes les décisions)
1.2 — Liste des points ouverts     (ce qui reste à trancher, remontées diverses)
1.3 — Synthèse pour Claude Project (contexte optimisé pour le futur Claude Project)
```

La spec technique (architecture Next.js, modèle Supabase, RLS, etc.) viendra ensuite, une fois la spec fonctionnelle validée, dans le Claude Project dédié au développement.
