# NBA Pronos — Méthodo : optimisation des sessions & approche pré-code

> Document méthodologique (hors cadrage fonctionnel).
> Objectif : garder en mémoire comment travailler efficacement avec Claude
> (consommation, organisation des fichiers, phase d'architecture avant le code).
> Statut : notes de travail, à réutiliser dans le Claude Project.

---

## 1. Comment fonctionnent les limites d'usage

Deux limites distinctes à ne pas confondre :

```text
LIMITE D'USAGE   : quantité consommée dans le temps, au niveau du COMPTE.
                   C'est elle qui donne le "% d'utilisation".
LIMITE DE LONGUEUR : taille du contexte d'UNE conversation (fenêtre de contexte).
```

Points clés :

- le "%" persiste même dans une conversation neuve → c'est la limite de **compte**, pas de conversation ;
- rechargement sur une **fenêtre glissante de 5 h** (démarre au 1ᵉʳ message, se libère progressivement) ;
- il existe **aussi une limite hebdomadaire** en plus des 5 h ;
- ouvrir une nouvelle conversation ne **rembourse pas** le quota déjà consommé ;
  ça réduit seulement le coût des messages **futurs** (historique vide).

Vérification concrète :

```text
Réglages > Usage → barres de progression (session 5 h + hebdo) + heure de reset.
```

---

## 2. Ce qui consomme réellement

Le vrai poids n'est pas la sortie, mais le **contexte réinjecté à chaque tour** :

- Claude relit tout l'historique de la conversation à chaque réponse ;
- les gros fichiers collés dans une conversation libre sont rechargés à chaque message ;
- une conversation longue coûte de plus en plus cher message après message.

Conséquence : **conversations courtes et thématiques** = principal levier d'économie.

---

## 3. Projects & RAG : économe, mais pas gratuit

Ce que fait un Project :

- **RAG** : ne charge que les extraits **pertinents** des fichiers, pas tout ;
- **cache** : le contenu réutilisé du projet compte beaucoup moins dans les limites.

Nuances importantes (à ne pas oublier) :

```text
- "beaucoup moins cher" ≠ "gratuit".
- Le RAG peut RATER du contexte utile (chargement partiel).
  → pour un raisonnement transversal (cohérence entre sections), pointer les fichiers.
- Le RAG choisit selon le CONTENU (sémantique), pas selon le NOM du fichier.
```

Règle : travailler **dans le Project** > coller les fichiers dans une conversation libre.

---

## 4. Bonnes habitudes de session

```text
- Sessions courtes et thématiques (une session = un sujet).
- Repartir sur une conversation neuve en changeant de sujet.
- Éditer le message d'origine plutôt qu'empiler "non, plutôt..." (regénère sans gonfler l'historique).
- Pointer explicitement le(s) fichier(s) concerné(s) pour fiabiliser la récupération.
- Espacer les sessions dans la journée (profiter du rechargement glissant 5 h).
```

---

## 5. Génération de code

- Claude génère des **fichiers complets et directement utilisables** (pas de fragments à trous).
- Coût = **sortie** (proportionnelle à la longueur du fichier, incompressible)
  + **entrée** (contexte relu → c'est là que ça gonfle).
- Un petit fichier généré tôt dans une conversation ciblée coûte une fraction
  du même fichier généré au message 35 d'un fil qui traîne tout l'historique.

Stratégie économe :

```text
- Demander des fichiers CIBLÉS et complets, un par un (pas un dump de toute l'app).
- Itérer par modifications ponctuelles quand c'est possible ("change juste cette fonction").
- MAIS si les changements touchent partout : régénérer proprement peut être
  moins coûteux et plus fiable que 10 retouches qui rallongent l'historique.
- Pour du débogage précis : coller le bout de code concerné dans le chat
  est souvent plus fiable que d'espérer que le RAG aille le chercher.
```

---

## 6. Approche d'architecture AVANT de coder

Principe validé :

```text
Figer AVANT le code : ce qui est TRANSVERSAL et coûteux à changer après coup.
Laisser AU MOMENT du code : ce qui est LOCAL à un fichier (fonctions, implémentation).
```

À produire entre la fin du cadrage fonctionnel et le code :

1. **Modèle de données** (tables, relations, statuts, contraintes) → à figer sérieusement, c'est le socle.
2. **Carte des fichiers / arborescence** : chaque fichier + **une phrase** de responsabilité (pas les fonctions internes).
3. **Contrats d'interface entre modules** : ce qu'un module expose (entrées/sorties), pas son fonctionnement interne.
4. **Ordre de construction** : quoi coder en premier, dans quel enchaînement de dépendances.

Pièges à éviter :

```text
- Sur-cadrage : spécifier chaque fonction de chaque fichier AVANT de coder
  → temps + quota gaspillés sur des détails que le code va démentir.
- Confondre "document d'architecture détaillé" et "économie de contexte" :
  le document est un OUTIL DE DÉCOUPAGE, il n'économise que si on s'en sert
  pour charger des TRANCHES (spec du fichier X + ses dépendances directes),
  pas pour tout recharger à chaque génération.
```

Le détail des fonctions internes se décide **au moment de coder ce fichier**,
dans une session dédiée qui charge sa spec + ses dépendances directes.

---

## 7. À faire, plus tard (rappels)

```text
- Resynchroniser les plans de cadrage (0.2.5 / 0.2.6 / 0.2.7 encore marqués [À TRAITER]
  alors que les fichiers de décisions sont validés).
- Découper les futurs livrables techniques en fichiers THÉMATIQUES séparés
  (modèle de données, RLS, architecture Next.js, simulation d'API, roadmap...),
  pas un pavé unique.
- Garder les specs figées dans le Project comme référence stable (cache = économe).
```

---

## 8. Règle simple à retenir

```text
Le coût réel se joue moins sur la TAILLE d'un fichier
que sur COMBIEN DE FOIS on le fait relire/régénérer, et DANS QUEL CONTEXTE.
Découpage thématique + sessions courtes + travail dans le Project = le trio gagnant.
```
