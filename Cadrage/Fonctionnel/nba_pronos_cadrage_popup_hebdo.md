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

## 1 bis. Décisions du 11/10/2026 (après exploration de l'existant)

| Sujet | Décision |
|---|---|
| Point 1, semaine pauvre | Moins de 3 paris résolus ou refusés dans la semaine = repli, sans appel LLM. Un bloc sans candidat est omis, pas remplacé |
| Point 2, texte de repli | Petite série tournante (3 à 5 textes écrits à l'avance), suivie du bloc champion quand il existe |
| Point 4, heure de publication | Sans objet : envoi 100 % manuel, génération au figement du lundi |
| Point 9, paris refusés | Vérifié : `REJECTED` garde `description`, `user_id` et `refusal_reason` (UPDATE, pas de DELETE) |
| Écart réel | `structured_threshold` + `resolution_reason` passés tels quels au LLM, qui déduit l'écart. Pas de parsing ni de recalcul. Texte absent ou vide = pari écarté du bloc flop. Ne vaut que pour les résolveurs qui écrivent la valeur réelle (liste complète faite le 11/10/2026, voir §1 ter) |
| Décision 12, alerte admin | Push à l'admin + pastille dans l'admin. **Pas d'email en V1** (aucun service existant) |

Constats techniques : aucun état « vu » en base (migration nécessaire, décision 3) ; le client Anthropic de `lib/ai/structureBet.ts` renvoie `null` en silence, à ne pas réutiliser tel quel pour un contenu affiché (statut explicite requis) ; accroche de génération = retour `frozen: true` de `runWeeklyFreeze` (`lib/weekly/freezeWeek.ts`), commun au cron et au bouton admin ; il faudra une table de dédup type `recap_log`.

## 1 ter. Décisions du 11/10/2026 (points 5, 6, 10, prompts)

Exploration par `explorer` (résolveurs) et `architect` (présélection, historique), puis quatre décisions de l'utilisateur. Rien n'est codé.

| Sujet | Décision |
|---|---|
| Qui choisit | **Le LLM choisit parmi N candidats** présélectionnés par le code : top 5, flop 8, refusé 5, **2 au plus par joueur et par bloc**. La liste est stockée dans le brouillon (reproductible, vérifiable). Jamais un seul pari imposé par bloc. |
| Fenêtre | `[recapBoundaryIso(weekEnd - 7), recapBoundaryIso(weekEnd))` sur la compétition ACTIVE, lecture en `service_role` (les refusés des autres ne sont pas lisibles en RLS). |
| Date d'un pari | Gagnés et perdus : `resolved_at` (jamais `scored_at`, réécrit à chaque recalcul). Refusés : **nouvelle colonne `bets.rejected_at`**, posée dans `rejectBet` et dans `processCorrectionRequest` (nouveau statut REJECTED), remplie pour l'existant depuis `audit_logs` (`REJECT_BET`). Poser la colonne dans `processCorrectionRequest` n'est que de la cohérence : ces paris portent `is_admin_corrected` et sont exclus de la présélection. Un pari apparaît dans une seule semaine ; une résolution tardive le reporte à la suivante. |
| Top | WON, tri `validated_difficulty` décroissante puis `calculated_proba` croissante (NULL en dernier). « Le plus précis » n'est pas calculable (aucune valeur réelle en base) : jugé par le LLM sur le texte et la raison. |
| Flop | LOST avec `structured_threshold` non nul, `resolution_reason` non vide et `resolved_by_admin_id` nul ; tri `calculated_proba` décroissante pour couper à 8. L'écart est déduit par le LLM, jamais calculé ni parsé par le code. Le code calcule un `sens` (« plus de », « au moins », « moins de », « au plus », « exactement », depuis `structured_comparison`/`structured_negation` ou `count_relation` des fautes techniques) ; **un candidat flop sans `sens` est écarté**. |
| Refusé | Aucune heuristique de code fiable : le LLM choisit « le plus absurde » parmi 5, coupés par `rejected_at` croissant. `refusal_reason` n'est pas transmis (note d'admin destinée au joueur). |
| Départage | Date (`resolved_at` ou `rejected_at`) croissante, puis `bets.id`. |
| Exclusions | `is_admin_corrected`, compte `DISABLED`, description vide, `CANCELLED`, joueur désengagé (point 10), texte du pari contenant un `@pseudo` (V1, strict). Pari sans proba gardé (trié en dernier). Pour un pari résolu par un admin (`resolved_by_admin_id` non nul), `resolution_reason` n'est pas transmise (texte libre jamais classé) : il peut rester dans le top, jamais dans le flop. |
| Semaine pauvre (précise le §1 bis) | Niveau 1 : moins de 3 paris WON, LOST ou REJECTED dans la fenêtre = repli sans LLM. Niveau 2 : après exclusions et classifieur amont, trois blocs vides = repli aussi. |
| Bloc champion | Factuel, fourni par le code (`weekly_champions`) ; non compté dans l'HISTORIQUE (le balayage du texte ne porte que sur `top`, `flop` et `refuse`, jamais sur `champion`) ; non filtré par le désengagement (provisoire, à confirmer). |
| Point 6, HISTORIQUE | **Colonnes sur la table des brouillons** : `candidates jsonb` et `featured_user_ids uuid[]`. Est « mis en avant » qui est cité dans le texte final publié : à la publication, le code retient les candidats du brouillon dont le `@pseudo` figure dans le texte (recherche avec limite de mot), donc les retouches de l'admin comptent. Lecture sur les 2 dernières popups **publiées** de la compétition ; les régénérations n'ont aucun effet. Transmis au LLM par un drapeau `cite_recemment` par candidat, pas par une liste séparée. Avant la première popup : vide. |
| Point 10, désengagement | `users.popup_mentions_opt_out boolean not null default false` (modèle de `recap_enabled`) + une condition dans la présélection. L'interrupteur du Profil peut venir plus tard. Champion hors filtre : à confirmer. |

Conséquence des résolveurs (liste complète dans `GAPS_OUVERTS.md`) : aucun résolveur n'écrit le seuil ni l'écart. La valeur réelle n'apparaît dans `resolution_reason` que pour joueur simple (MATCH et NotInMatch SINGLE), total de points, stat équipe (sans dire quelle équipe), duel, période équipe, temps morts et fautes techniques. Roster count, superlatif et roster split donnent une valeur partielle ; série, prolongation, combo, période joueur, dernier panier et contre n'en donnent aucune. Le bloc flop ne peut vivre que de six familles : joueur simple (MATCH et NotInMatch SINGLE), `total_points`, stat équipe, période équipe, temps morts, fautes techniques, et seulement si `structured_threshold` est renseigné (à vérifier famille par famille au plan technique, notamment la période équipe, qui a sa propre structure). Le duel est exclu du flop (un duel « plus que » n'a pas de seuil, et la raison ne nomme pas les joueurs). Les paris perdus des autres familles sont écartés : flop plus pauvre que le top, ce qui compte pour la semaine pauvre.

Livrables de cette étape, dans `Cadrage/Fonctionnel/popup_hebdo/` : `prompt_redacteur_v4.md` (prompt, format des données, exemple, cas limites), `prompt_classifieur_v1.md`, `schema_sortie_v4.json`, `schema_classifieur_v1.json`. Choix de conception à relire : le rédacteur renvoie `paris_cites` (identifiants des candidats cités) en plus du texte, validés en code contre la liste transmise ; le classifieur échoue fermé (candidat sans verdict = bloqué) ; pseudo, texte, match et raison sont déclarés non fiables dans les prompts (injection) ; le classifieur reçoit le pseudo et le texte (le pseudo, recopié par le rédacteur, est classé comme le texte), ni match, ni `user_id`, ni raison ; le contrôle des `@pseudo` cités se fait sur l'ensemble fermé des candidats et du champion, sans faux positif sur le tiret (`@Rillettes` ≠ `@Rillettes-31`).

Points restants : 7 (choix des modèles et fournisseur, coût à chiffrer), périmètre du blocage du classifieur (seuls racisme et discrimination, comme la v3 ; menaces, harcèlement ou moquerie visant un joueur précis ne sont pas couverts), bloc champion et désengagement, pseudo d'un compte supprimé dans un texte déjà publié, premier essai réel des prompts (cas limites listés dans `prompt_redacteur_v4.md`, avec accord et données fictives).

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

1. ~~Trancher les points ouverts 1 à 6 (produit).~~ Fait (§1 bis et §1 ter).
2. ~~Explorer l'existant.~~ Fait le 11/10/2026.
3. ~~Écrire le prompt v4 et le prompt du classifieur.~~ Fait le 11/10/2026
   (`popup_hebdo/`), non essayés avec un vrai appel.
4. Choisir les modèles (point 7) et faire un premier essai réel sur données
   fictives, avec accord.
5. Plan technique avec l'`architect` (modèle de données : `rejected_at`,
   table des brouillons, `popup_mentions_opt_out`, état « vu » par joueur,
   `delete_account_data` ; routes ; écrans admin ; client Anthropic à statut
   explicite), puis implémentation par PR, une branche + PR comme d'habitude.
