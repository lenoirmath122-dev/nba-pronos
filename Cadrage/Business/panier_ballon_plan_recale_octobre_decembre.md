# Panier Ballon — Plan de communication recalé (oct.–déc. 2026)

> Créé le 05/10/2026, après l'alpha. Recale le calendrier et les objectifs de
> `panier_ballon_cadrage_business_communication.md` et de
> `panier_ballon_elargissement_octobre.md`, écrits avant l'alpha. Ces deux
> documents restent la source pour les messages-types, la structure Discord,
> les hashtags et le détail SEO/créateurs ; ce document ne les remplace pas, il
> en change le calendrier et les priorités.

---

## 1. Ce qui a changé depuis le cadrage

| Hypothèse du cadrage | Réalité au 05/10/2026 |
|---|---|
| Alpha : 10-20 testeurs actifs | 4 comptes classés (Leopoldinho, Rillettes-31, Nico, Rillettes-49) |
| Bêta sur la vraie NBA Cup « dès octobre-novembre » | **Décision du 05/10 : la bêta se joue sur la phase finale, du 4 au 11/12/2026** (quarts 4-5/12, demies 8-9/12, finale 11/12) |
| Phase de groupes jouable | Non : l'app est centrée sur les séries (voir §2) |
| Plan à plusieurs canaux en parallèle | Maintenu (choix du 05/10), mais dans **2 à 5 h par semaine** |

Conséquence : il reste **un peu moins de 2 mois (8 semaines) pour recruter**,
sans compétition à jouer pendant ce temps. Les nouveaux inscrits arrivent donc
dans une app vide jusqu'au 4/12 — voir §5, point ouvert n°1.

## 2. Pourquoi pas la phase de groupes

Vérifié dans le code le 05/10/2026 : `series_id` est obligatoire sur
`matches`, l'enum des tours n'a que des tours éliminatoires, la création de la
Cup ne génère qu'un arbre fixe (4 quarts, 2 demies, 1 finale). Prise en charge
complète des groupes estimée à 4-6 jours. Une piste moins lourde (une série à
un seul match par match de poule + une valeur d'enum) n'a pas été sondée.
Non retenu : trop coûteux pour le temps disponible.

## 3. Objectifs recalés

| Indicateur | Repère indicatif |
|---|---|
| Comptes actifs au 4/12 | 25-40 (cible haute 50 ; l'ancien repère 50-100 est abandonné) |
| Ligues créées | 3-5 (une par groupe de potes) |
| Abonnés Instagram fin novembre | à fixer avec le niveau actuel du compte (non relevé) |
| Membres Discord fin octobre | 15-30 (inchangé) |
| Occurrences de « paris » en production | Révisé le 05/10 : mot conservé volontairement (référencement), toujours avec « sans argent réel » |

Repères de départ, pas des promesses. Le premier levier est que chacun des 4
joueurs de l'alpha amène son propre groupe : 4 ligues de 8 personnes suffisent
à la cible basse.

## 4. Calendrier

Budget indicatif : 2-5 h par semaine. Ordre de priorité si la semaine est
courte : réseau perso, puis Instagram, puis socle SEO, puis Discord, puis
créateurs/comparatifs.

| Semaine | Réseau perso | Instagram | Socle / SEO | Discord et créateurs |
|---|---|---|---|---|
| **S1-2 · 5-18 oct.** | Les 4 joueurs de l'alpha deviennent ambassadeurs : message individuel « amène ton groupe pour la phase finale du 4/12 » | Post « retours de l'alpha » (ce qui a changé grâce aux testeurs) | Étape C : corriger « paris », page publique minimale, `sitemap.ts` + `robots.ts`, Search Console | Créer le serveur Discord |
| **S3-4 · 19-31 oct.** | Relance du premier cercle élargi (message « Élargissement » du cadrage) | Reel démo (Vidéo 1) + post « nouveautés » (récaps du matin, badges) | Suivi Search Console | Ouvrir Discord aux testeurs ; mails comparatifs pronor.fr / zikof.com ; premiers contacts Facebook et micro-créateurs (interactions avant tout pitch) |
| **S5-7 · 1-21 nov.** | Relance individuelle des contacts pas encore inscrits | 1 post/sem. : coulisses, captures de l'alpha, sondage en Story | — | Messages de présentation aux créateurs / BasketSession ; lien Discord en bio |
| **S8 · 22-30 nov.** | Dernier appel « les ligues se ferment le [date] » | Compte à rebours (Story + Reel) | — | TrashTalk en dernier palier ; relance unique des créateurs |
| **S9 · 1-3 déc.** | Rappel aux inscrits : onboarding, créer ou rejoindre sa ligue | Story quotidienne | — | Annonces Discord |
| **4-11 déc.** | — | Story par jour de match, résultats, classement | — | Débrief de la finale |

## 5. Points ouverts

1. **Les inscrits n'ont rien à jouer avant le 4/12.** Risque d'attrition entre
   l'inscription et le premier match. Pistes à trancher : (a) liste d'attente
   plus création de ligue avant la Cup, rien de plus ; (b) quelques vrais
   matchs de saison régulière pour tester les paris, comme évoqué dans la
   pause alpha/bêta (la piste « série à un match » le permettrait peut-être,
   non vérifiée) ; (c) accepter l'attrition et ne recruter qu'à partir de
   mi-novembre. À trancher en S1-2.
2. **Mapping A7** (détection des quarts et création des séries) : les quarts
   ne sont connus qu'après la fin des groupes (27/11). À sonder dès fin
   octobre, comme prévu dans `GAPS_OUVERTS.md`, mais construire seulement
   autour du 28/11.
3. **Récaps du matin jamais vus avec de vraies données** : ils sont un argument
   de contenu pour S3-4 ; ne pas les mettre en avant avant d'avoir été vus
   en conditions réelles.
4. **Landing page** : en p5-2 dans la feuille de route, alors que le socle SEO
   la demande dès octobre. Version minimale en étape C, version soignée plus
   tard.
5. **Christmas Day (25/12) et Play-In (avril)** : prévus par le cadrage du
   15/09, hors périmètre de ce plan, à reprendre après la Cup.

## 6. Étapes suivantes

Voir `GAPS_OUVERTS.md`, section « Plan de communication » : C (socle SEO et
vocabulaire, code), B (contenu Instagram), D (recrutement), chacune dans sa
propre conversation.

Mise à jour du 06/10/2026 : l'étape D est rédigée dans
`panier_ballon_plan_recrutement_octobre_decembre.md`, qui tranche le point
ouvert n°1 du §5 (quelques vrais matchs, dispositif à cadrer) et dont les
messages-types remplacent ceux du cadrage et de l'élargissement.
