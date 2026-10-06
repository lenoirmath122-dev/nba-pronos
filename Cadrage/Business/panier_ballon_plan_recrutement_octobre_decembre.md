# Panier Ballon — Plan de recrutement (oct.–déc. 2026)

> Créé le 06/10/2026, étape D du plan de communication. Complète
> `panier_ballon_plan_recale_octobre_decembre.md` (calendrier et objectifs) sans
> le remplacer. Les messages-types de ce document **remplacent** ceux du cadrage
> et de l'élargissement quand ils se contredisent : ces derniers disent « bêta
> ouverte en octobre », ce qui n'est plus vrai (la bêta se joue du 4 au 11/12).
> Le contenu Instagram (étape B), le SEO et la structure Discord restent dans
> leurs documents d'origine.

---

## 1. Décisions prises le 06/10/2026

| Question | Décision |
|---|---|
| Que jouent les inscrits avant le 4/12 ? | **Quelques vrais matchs** de saison régulière, pour tester les paris et garder les gens actifs (option (b) du plan recalé §5). Voir §8, point ouvert 1 : le dispositif reste à cadrer côté produit. |
| Qui crée les ligues ? | **Le commissaire** (l'ambassadeur ou l'organisateur du groupe). Le fondateur ne crée pas les ligues à leur place. |
| Contrepartie pour les ambassadeurs de l'alpha | **Statut « fondateur » symbolique**, sans coût. Il **n'existe pas encore dans l'app** : faisabilité à confirmer (§8, point ouvert 3), à ne pas promettre avant. |

## 2. Objectif et logique de calcul

Cible au 4/12 : **25-40 comptes actifs, 3-5 ligues** (plan recalé §3).

Comment y arriver, par ordre de poids :

| Source | Hypothèse | Apport visé |
|---|---|---|
| Ambassadeurs de l'alpha (4 joueurs, peut-être 3 personnes, voir §8) | 3 à 4 groupes de 6-8 personnes | 18-32 |
| Réseau perso élargi (contacts de contacts) | 20-40 contacts approchés, 1 sur 4 s'inscrit | 5-10 |
| Instagram, Discord, groupes Facebook, créateurs | Peu de rendement en 8 semaines, on ne compte pas dessus | 0-5 |

Total théorique : 23-47. La cible basse de 25 suppose que presque tous les
groupes se concrétisent, avec peu de marge. L'objectif repose donc sur les
ambassadeurs : si deux d'entre eux ne relaient pas, la cible basse n'est pas
atteignable. C'est le risque principal.

## 3. Le parcours d'un nouvel inscrit

C'est la partie où l'on perd le plus de monde si elle est floue. Chaque étape
a un responsable et un message.

| # | Étape | Qui s'en occupe | Support |
|---|---|---|---|
| 1 | Reçoit le lien `https://panierballon.fr` (toujours avec le schéma, sinon pas d'aperçu) | Ambassadeur ou fondateur | Message-type (annexe) |
| 2 | Crée son compte | L'inscrit | Mode d'emploi L2 |
| 3 | Rejoint une ligue existante, ou en crée une s'il est commissaire | L'inscrit (commissaire : lui-même) | Mode d'emploi L2 |
| 4 | Active les notifications | L'inscrit | Mode d'emploi L2 |
| 5 | Fait son premier prono | L'inscrit | Rappel du 1-3/12 |

**Ce que fait le code (vérifié par le reviewer le 06/10)** : le champ « Code
compétition » de l'inscription est **optionnel** (`components/auth/SignupForm.tsx`).
Sans code, le compte est rattaché à la compétition **active** ; s'il n'y en a
aucune, l'inscription échoue (« Aucune compétition active pour le moment. »).
Un code non vide mais invalide est refusé. Les ligues ont leur propre code de
8 caractères, distinct du code compétition : le second donne le droit de jouer,
le premier sert à rejoindre une ligue (`create_league`, `join_league`).

Le vrai blocage est donc l'existence d'une **compétition active** pour les
inscrits d'octobre, pas le code. Le mode d'emploi (L2) doit décrire le chemin
exact avec une capture par étape.

## 4. Les canaux, par ordre de priorité

Priorité si la semaine est courte : ambassadeurs, réseau perso, Instagram,
Discord, groupes Facebook et créateurs, comparatifs.

| Canal | À qui on parle | Message | Volume visé | Temps |
|---|---|---|---|---|
| Ambassadeurs | Les joueurs de l'alpha | Annexe, messages M1 et M2 | 3-4 groupes | 1 h/sem |
| Réseau perso | 20-40 noms, premier puis deuxième cercle | Annexe, M3 à M6 | 1 relance max par personne | 1 h/sem |
| Instagram | Abonnés, commissaires potentiels | Étape B. Ajouter un appel « commissaire » dans la bio et une Story « DM si ta bande veut sa ligue » | Continu | selon étape B |
| Discord | Testeurs et leurs groupes | Message d'accueil recalé (annexe, M7) | 15-30 membres fin oct. | 0,5 h/sem |
| Groupes Facebook, créateurs, comparatifs | 5 cibles max | Annexe, M8 | Pitchs du 1 au 21/11, TrashTalk en dernier | 0,5 h/sem |

**Plancher protégé** : 1 h par semaine de recrutement, quoi qu'il arrive. Le
contenu Instagram prend vite tout le temps disponible, mais il ne remplace pas
un message direct à un commissaire.

## 5. Calendrier semaine par semaine

Reprend les fenêtres du plan recalé, uniquement côté recrutement.

| Semaine | Actions | Temps estimé |
|---|---|---|
| **S1 · 6-11 oct.** | Cadrer le dispositif « vrais matchs » (§8.1). Écrire le mode d'emploi L2 avec captures. Créer le tableau de suivi (hors dépôt). Préparer le kit ambassadeur | 3-4 h |
| **S2 · 12-18 oct.** | Envoyer M1 aux ambassadeurs le 11/10. Relance M2 vers J+5. Premier point d'entonnoir le 18/10 (seuil d'alerte §7) | 2 h |
| **S3-4 · 19-31 oct.** | Constituer la liste du réseau perso (L6). Envoyer M3 au deuxième cercle. Ouvrir Discord aux testeurs et à leurs groupes. Premières interactions avec les cibles externes, sans pitch | 3 h |
| **S5-7 · 1-21 nov.** | Relance individuelle M4 des contacts non inscrits. Pitchs créateurs et BasketSession (M8). Point d'entonnoir le 21/11 (seuil d'alerte §7) | 2-3 h |
| **S8 · 22-30 nov.** | Dernier appel M5. TrashTalk en dernier palier. Relance unique des créateurs | 2 h |
| **S9 · 1-3 déc.** | Rappel M6 aux inscrits : créer ou rejoindre sa ligue, activer les notifications | 1 h |
| **4-11 déc.** | Pas de recrutement actif. Suivre l'activité, répondre aux questions | 1 h |
| **12-15 déc.** | Bilan (L9) | 1 h |

## 6. Livrables

| # | Livrable | Priorité | Échéance |
|---|---|---|---|
| L1 | Cadrage du dispositif « vrais matchs » avant le 4/12 | P0 | 09/10 |
| L2 | Mode d'emploi d'inscription, 5 étapes et une capture chacune | P0 | 10/10 |
| L3 | Kit ambassadeur : M1 + mode d'emploi + rôle du commissaire + date limite (statut fondateur seulement une fois confirmé, §8.3) | P0 | 10/10, envoi le 11/10 |
| L4 | Tableau de suivi des contacts (hors dépôt, voir §7) | P0 | 10/10 |
| L5 | Messages réseau perso recalés (M3 à M6) | P1 | M3 rédigé le 18/10 pour un envoi dès le 19/10, les autres avant leur fenêtre |
| L6 | Liste du réseau perso : 20-40 noms, cercle, commissaire potentiel oui/non | P1 | 18/10 |
| L7 | Ouverture de Discord avec le message d'accueil recalé | P1 | 25/10 |
| L8 | Messages externes recalés (M8) et liste des 5 cibles | P2 | 26/10 |
| L9 | Bilan après la Cup, une demi-page | P3 | 15/12 |

## 7. Entonnoir et suivi

**Le tableau de suivi vit hors dépôt** (Google Sheets ou OneDrive), parce qu'il
contient des noms de personnes. Ne pas le versionner.

Colonnes : Nom · Canal · Rôle (commissaire potentiel ou joueur) · Date du
contact · Date de la relance (une seule) · Statut · Ligue · Notes.

Statuts, dans l'ordre : contacté, a répondu, inscrit, dans une ligue,
notifications activées, actif au 4/12, actif à la finale.

**Cinq nombres à relever chaque semaine, pas plus :**

1. Contactés cumulés
2. Inscrits cumulés
3. Ligues avec au moins 5 membres
4. Ambassadeurs ayant effectivement relayé
5. Taux inscrit sur contacté, par canal, pour décider où mettre le temps

**Une fois au 4/12, puis au 11/12** : part des inscrits qui ont pronostiqué.
C'est la mesure de l'attrition.

**Seuils d'alerte :**
- Moins de 2 ambassadeurs actifs au 18/10 : avancer la relance du réseau perso.
- Moins de 15 inscrits au 21/11 : renforcer le dernier appel et lancer les
  pitchs créateurs sans attendre.

**Routine de 15 minutes par semaine** : mettre le tableau à jour, envoyer les
relances dues, prendre une décision.

## 8. Points ouverts et risques

**À cadrer ou à trancher :**

1. **Dispositif « vrais matchs »** : décision prise, mais pas conçu. Quels
   matchs, quelle compétition, quel code d'inscription, combien de temps de
   développement. Le plan recalé §2 note que l'app est centrée sur les séries
   (`series_id` obligatoire) et qu'une piste « une série à un match » n'a pas
   été sondée. À explorer en premier, dans une conversation dédiée : si c'est
   trop lourd, on retombe sur la liste d'attente (option (a)).
2. **Compétition active pour les inscrits d'octobre** : sans compétition
   active, l'inscription échoue (§3). À régler avec le dispositif « vrais
   matchs », avant d'envoyer M3 ; la Cup réelle n'apparaît qu'autour du 28/11
   (mapping A7).
3. **Statut « fondateur »** : aucune trace dans le code (grep du 06/10). Un badge
   demande donc du développement. Tant que ce n'est pas décidé, ne pas le
   promettre dans M1 ; la solution de repli est une mention dans le message
   d'accueil Discord.
4. **Combien d'ambassadeurs réels** : Rillettes-31 et Rillettes-49 sont peut-être
   la même personne. À vérifier avant de compter sur 4 groupes.
5. **Date de fermeture des ligues** annoncée dans le dernier appel : vraie
   limite technique ou simple argument ? À décider avant le 22/11.
6. **Discord** : ouvert à tous ou réservé aux testeurs et à leurs groupes
   avant le 4/12 ? Par défaut, réservé.
7. **Niveau de départ du compte Instagram** : non relevé, nécessaire pour fixer
   l'objectif d'abonnés de fin novembre.

**Risques :**
- Attrition entre l'inscription et le 4/12, même avec des vrais matchs.
- Dépendance à 3-4 ambassadeurs.
- Notifications reçues en retard quand l'app est fermée : c'est le retour
  principal de l'alpha (`RETOURS_ALPHA_NBA_CUP.md`). Ce n'est pas un sujet de
  recrutement, mais il pèse sur l'engagement pendant la semaine de bêta.
- Contacter un créateur trop tôt, sans interaction préalable, grille le contact.
- Envoyer par erreur un ancien message-type (voir l'en-tête).
- Le mot « paris » reste dans les messages publics (décision du 05/10), toujours
  accompagné de « sans argent réel ».

---

## Annexe — Messages-types recalés

Toujours écrire `https://panierballon.fr` avec le schéma. Remplacer `[lien]`.
Ces messages sont des points de départ : les réécrire dans ta voix avant envoi.

```
[M1 — aux ambassadeurs de l'alpha, le 11/10]
Merci d'avoir testé l'alpha, tes retours ont servi. Prochaine étape : la
vraie phase finale de la NBA Cup, du 4 au 11 décembre, en vrai.
Tu peux amener ta bande ? Tu crées ta ligue, tu invites tes potes, et je
te prépare un mode d'emploi en 5 étapes. Ça te dit ?

[M2 — relance ambassadeur, vers J+5]
Je reviens vers toi pour la ligue du 4/12. Dis-moi si tu veux que je
t'envoie le mode d'emploi, ou si c'est mieux de caler 10 minutes.
```

```
[M3 — réseau perso, deuxième cercle, à partir du 19/10]
On teste depuis quelques semaines une ligue de pronos NBA entre potes :
gratuite, aucun argent réel, que des points. La phase finale de la NBA Cup
se joue du 4 au 11 décembre. Ça te dit d'essayer avec ta bande ?
https://panierballon.fr

[M4 — relance individuelle, 1-21/11, une seule fois]
Je te relance sur la ligue de pronos pour la NBA Cup. Il faut juste un
commissaire pour lancer le groupe, le reste suit. Tu veux le mode d'emploi ?

[M5 — dernier appel, 22-30/11]
Les ligues se ferment le [date]. Si tu veux jouer la phase finale de la
NBA Cup avec ta bande, c'est maintenant : https://panierballon.fr

[M6 — rappel aux inscrits, 1-3/12]
Les quarts démarrent le 4 décembre. Dernière ligne droite : crée ou rejoins ta ligue, et active
les notifications pour ne rien rater.
```

```
[M7 — message d'accueil Discord, à utiliser à l'ouverture]
Bienvenue sur Panier Ballon. La phase finale de la NBA Cup se joue du 4 au
11 décembre : quarts, demies, finale, avec ta ligue. Ici, tu peux poser tes
questions, signaler un bug, et suivre les nouveautés.
```

```
[M8 — créateurs, groupes Facebook, BasketSession, 1-21/11]
Objet : Une appli de pronos NBA entre potes, pour la phase finale de la NBA Cup

Bonjour [prénom],

[Une phrase liée à un contenu précis d'eux — jamais un message générique.]

Je développe Panier Ballon, une appli pour organiser une ligue de pronostics
NBA entre amis : bracket, pronostics match par match, et des paris perso en
langage libre validés automatiquement avec les vraies stats du match. Aucun
argent réel, uniquement des points.

La bêta se joue sur la phase finale de la NBA Cup, du 4 au 11 décembre. Si ça
peut intéresser votre communauté, je serais content de vous faire tester en
priorité, sans obligation, juste pour avoir votre avis.

https://panierballon.fr
```

Pour les groupes Facebook, une version plus courte : remplacer le corps par deux
phrases et garder la même date. Ne jamais relancer plus d'une fois.
