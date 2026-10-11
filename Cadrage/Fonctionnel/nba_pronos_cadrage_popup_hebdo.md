# Cadrage — popup hebdomadaire (texte généré par LLM)

> Cadrage du 09/10/2026. Aucune ligne de code à ce stade. Point de départ :
> le prompt `Cadrage/DA/Résumés/prompt_popup_hebdo_v3.md` (ce dossier est
> ignoré par git, le prompt n'est donc pas versionné : le recopier ici ou le
> déplacer lors de la mise en œuvre). Distinct du récap hebdo existant
> (« Ta semaine », `lib/recaps/`, déterministe, sans LLM) : la popup est un
> texte humoristique, commun à tous, affiché à l'ouverture du site.

> **Mise à jour du 11/10/2026 — portée.** La popup sert à la pré-Cup
> (DAILY_MATCH) ET aux playoffs : c'est le format du récap hebdo envoyé
> depuis le bouton admin « figer la semaine et envoyer »
> (`Cadrage/Suivi/BACKLOG_V1.md`). Réglage par compétition. Conséquences :
> - point ouvert 3 sans objet (une seule compétition ACTIVE) ;
> - **bloc classement/champion** à ajouter à la présélection (code, source
>   `weekly_champions`, ex-aequo = co-champions, rien si le meilleur total
>   est <= 0) ;
> - **calendrier (décision 7)** : la semaine est lundi 10 h → lundi 10 h
>   Paris et le brouillon est généré au figement du lundi, plus « dimanche
>   soir » (les matchs du dimanche US finissent le lundi vers 5-6 h Paris) ;
> - bouton admin = figement + publication du brouillon relu ; en
>   pré-Cup l'envoi est **100 % manuel** (décidé le 11/10/2026) : la
>   décision 6 (publication auto du brouillon propre) est écartée pour la
>   pré-Cup, avec un rappel dans l'admin. Pour les playoffs, à retrancher le
>   moment venu.

## 1. Décisions prises (09/10/2026)

| # | Sujet | Décision |
|---|---|---|
| 1 | Sélection des paris | Le code présélectionne des candidats par bloc (top, flop, refusé) ; le LLM rédige. Le choix reste reproductible et vérifiable |
| 2 | Portée | Un seul texte pour toute la compétition. Découpage par ligue plus tard, si les ligues prennent de l'ampleur |
| 3 | Affichage | Une fois par joueur après publication. État « vu » stocké **en base, par joueur et non par appareil** (migration nécessaire ; déroge volontairement à la règle « état vu côté client ») |
| 4 | Semaine pauvre | Toujours une popup, avec un texte de repli (peu de paris ou catégorie vide) |
| 5 | Relecture | Brouillon généré, éditable / régénérable / publiable depuis l'admin |
| 6 | Brouillon non validé à l'heure prévue | Publication automatique du brouillon |
| 7 | Calendrier | Génération dimanche soir, publication lundi matin, sur la semaine lundi→dimanche précédente (aligné sur le récap hebdo) |
| 8 | Filtre amont | Un LLM séparé classe chaque pari candidat ok / bloqué (racisme, discrimination) avant la rédaction |
| 9 | Filtre aval | Aucun : la sortie n'est contrôlée que par le prompt et la relecture |
| 10 | Brouillon douteux (JSON invalide, échec LLM) | La publication est décalée jusqu'à relecture, **sans délai limite**. Pendant l'attente : **aucune popup** (le texte de repli ne sert que pour les semaines pauvres) |
| 11 | Échec d'appel LLM | 2 retries automatiques, puis brouillon douteux ; relance manuelle possible depuis l'admin |
| 12 | Alerte admin | Push + pastille dans l'admin + email (brouillon prêt ou bloqué) |

## 2. Articulation des règles (à ne pas contredire à l'implémentation)

- Brouillon propre non validé → publié automatiquement le lundi (décision 6).
- Brouillon douteux → jamais publié seul, attend la relecture (décision 10).
- Semaine pauvre → texte de repli publié, pas d'appel LLM nécessaire.
- Risque résiduel accepté : sans filtre aval, une vanne dérapante du
  rédacteur, ou un pari discriminatoire mal classé en amont, part tel quel si
  le brouillon est jugé propre et non relu. Mitigation prévue : filtre amont
  strict (bloquer au moindre doute plutôt que laisser passer).

## 3. Points encore ouverts

1. **Seuil de « semaine pauvre »** : nombre minimal de paris, et par bloc
   (un bloc sans candidat est-il omis ou remplacé ?).
2. **Contenu du texte de repli** : texte fixe sans pari cité, ou petite série
   tournante.
3. **Plusieurs compétitions actives** (Cup + Match du jour) : lecture retenue
   = l'ensemble des paris compte pour le texte ; à confirmer.
4. **Heure fixe de publication** du lundi, et fuseau (Paris). Cron Vercel
   (les crons GitHub partent avec 4 à 7 h de retard, voir `GAPS_OUVERTS.md`).
5. **Règles de présélection** par bloc : définition exacte de « le plus
   précis », « le plus improbable », « raté de plus peu » (écart réel),
   « le plus absurde » (le seul qui demande probablement le LLM).
6. **Mémoire de l'HISTORIQUE** : stockage des pseudos mis en avant sur les
   2 dernières semaines (nouvelle table ou colonnes du brouillon).
7. **Modèles LLM** (rédacteur, classifieur) et fournisseur ; coût négligeable
   à cette échelle, à chiffrer.
8. **Prompt v4** : exemple de sortie de référence, limite de longueur par
   bloc, cas « catégorie vide », forme de la sortie JSON validée par schéma.
9. **Paris refusés** : vérifier ce qui est conservé en base (texte, statut)
   pour qu'ils soient exploitables.
10. **Politique des pseudos nommés** : un joueur qui ne veut pas être
    moqué (désactivation ?) — non discuté.

## 4. Étapes suivantes (une par conversation)

1. Trancher les points ouverts 1 à 6 (produit).
2. Explorer l'existant (paris, statuts, refusés, admin, push, cron) pour
   vérifier la faisabilité de chaque décision.
3. Écrire le prompt v4 et le prompt du classifieur.
4. Plan technique (modèle de données, routes, écrans admin), puis
   implémentation par PR, une branche + PR comme d'habitude.
