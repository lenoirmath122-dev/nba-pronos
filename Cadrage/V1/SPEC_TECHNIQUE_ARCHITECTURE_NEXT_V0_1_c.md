# NBA Pronos — SPEC TECHNIQUE T6c — ARCHITECTURE NEXT V0.1 (c : Realtime + rendu des états actés)

> **Nature** : troisième et dernière sous-spec de **T6** (découpage acté le
> 19/07/2026 : **T6a** arbre `app/` + route groups + stratégie de données ; **T6b**
> server actions joueur + garde-fou C2, puis actions admin ; **T6c** Realtime +
> rendu des états actés). T6c pose la **couche de rendu** : souscriptions Supabase
> Realtime en surcouche du SSR, micro-animation « donnée qui vient de changer », et
> le **rendu de tous les états déjà actés** mais encore rendus nulle part (A1,
> paris annulés, marquage « corrigé par admin », absents/inactifs, barre « toi »,
> bascule résumé/arbre, tendances %/brut, drill-down, tri du classement, live,
> dialogue C2, états vides). Elle **ne contient aucun corps de server action**
> (→ T6b, figé), **aucune règle de visibilité** (→ T3, la RLS reste seule
> autorité), **aucun design token** (palette arène/broadcast, typo, espacements
> → T7).
>
> **Dépend de** : T1 (colonnes, convention NULL/0), T2 (session), T3 (RLS = filtre
> de ce qui arrive au composant, y compris via Realtime), T4 (§9 activation de la
> publication Realtime côté base), T5 (§12.3 convention NULL/0 → pivot A1 ; scoring
> idempotent), T6a (§2 stratégie de données, §3 arbre `app/` et écrans partagés),
> T6b (attributs de correction posés par `processCorrectionRequest` §5.3 ; paris
> `CANCELLED` neutralisés §5 ; `LOCKED` calculé jamais écrit §9.2). Réutilise des
> décisions closes : 0.2.6 (départage, seuil tendances, sous-totaux dépliables),
> 0.2.9 (rendu de tous les écrans), 0.2.3 §7 (marquage public de correction),
> 0.2.4 / 0.2.9 §7 (paris annulés), et le **Bloc B de PREP_SPEC_TECHNIQUE_V1**
> (B6 bascule résumé/arbre, B7 micro-animation, B8 barre « toi », B9 états vides).
>
> **Statut** : **VALIDÉ** avec l'utilisateur le 19/07/2026. Les deux points soumis à
> arbitrage à la rédaction (§14.1 révélation live des pronos qui se dévoilent ;
> §14.2 `series` dans la publication Realtime) sont désormais **actés** (§14) et ont
> le même statut non rouvrable que les décisions de T1-T5 et de T6a/T6b. Tout le
> reste de T6c était déjà une conséquence directe de décisions closes.
>
> **Périmètre** : rendu de **toute** la V1 (Playoffs + NBA Cup, joueur + visiteur +
> admin). Mobile d'abord (0.2.9 §1). T6c **ne produit aucune migration** : les
> tables, colonnes, policies et vues existent déjà (T1/T3) ; la publication
> Realtime est activée par T4 (§9). C'est du code applicatif de rendu, écrit
> **après** ce feu vert.

---

## 0. Résumé du chantier T6c

```text
1.  Realtime en surcouche : souscriptions matches/series, RLS native, pas de
    revalidatePath, micro-animation B7                                        → §2
2.  Convention A1 : « - » (absence) vs « 0 » (scoré-zéro) vs « en attente »    → §3
3.  Paris annulés : barré + grisé, « neutralisé », distinct d'un « perdu »     → §4
4.  Marquage public « saisi/corrigé par admin X sur requête de Y » (attribut)  → §5
5.  Joueurs absents (compteur, noms au clic) + joueur inactif grisé conservé   → §6
6.  Barre « toi » collante (B8)                                                → §7
7.  Bracket : bascule résumé/arbre (B6), tendances %/brut (seuil série-par-    → §8
    série), drill-down nominatif par série
8.  Classement : tri par puces, Total toujours visible, lignes dépliables      → §9
9.  Live : màj silencieuse + « mis à jour il y a… » + badge EN DIRECT,         → §10
    dégradation propre selon la fréquence de synchro
10. Dialogue du garde-fou C2 (wording) + états vides & libellés (B9)           → §11
11. Ce que T6c ne dit pas (→ T7)                                               → §12
12. Plan de test T6c                                                           → §13
13. Décisions actées à la validation (révélation non live ; series publié)     → §14
```

Rien à coder tant que T6c n'est pas validé.

---

## 1. Décisions closes réutilisées (non rouvrables)

| Sujet | Décision | Source |
|---|---|---|
| RLS = seule autorité | le composant reçoit déjà exactement ce qu'il a le droit de voir ; il choisit la **mise en forme**, jamais l'autorisation | P1 / C-6 / T6a §2.1 |
| Composants serveur par défaut | `"use client"` seulement pour interaction ou Realtime | P12 / T6a §1 |
| Realtime = surcouche | SSR = rendu initial ; Realtime met à jour l'**état local client**, **jamais** `revalidatePath` | reco 1 / T6a §2.2 |
| Publication Realtime | activée côté base sur `matches` (et `series`) | T4 §9 |
| Realtime respecte la RLS | un client ne reçoit que les lignes qu'il a le droit de lire | A9 / T4 §9 |
| Convention NULL/0 | NULL = non scoré / en attente ; 0 = scoré, zéro point ; les deux se somment à 0 | T5 §12.3 / T1 §6.1 |
| Pivot A1 | « - » si aucune participation à la source, « 0 » si participé mais 0 point | Bloc A / T5 §12.3 |
| Paris annulés | barré + grisé, « neutralisé » + raison, 0 point **sans pénalité**, distinct d'un « perdu », **dans la liste** | 0.2.4 / 0.2.9 §7 |
| Marquage de correction | **attribut public** « saisi/corrigé par admin X sur requête de Y » ; le log d'audit reste **privé** | 0.2.3 §7 / 0.2.7 §8 / T6b §5.3 |
| Départage | 1. Total 2. bons vainqueurs de **match** 3. écarts exacts 4. points bracket 5. ex-aequo | 0.2.6 §3 |
| Rang affiché | **toujours calculé sur Total**, quelle que soit la colonne triée | interprétation actée (GAPS) |
| Seuil tendances | **> 10 brackets remplis** sur **la série** → % ; sinon → nombre brut (compté **série par série**) | 0.2.6 §4 / GAPS |
| Sous-totaux | chaque ligne du classement dépliable en Matchs / Bracket / Paris / (Forme), **publics** | 0.2.6 §6 / 0.2.9 §6 |
| Forme récente | fenêtre glissante **7 jours**, toutes sources, par compétition (vue `user_recent_form`) | 0.2.6 §5 / T1 |
| Joueur inactif | grisé + tag « inactif », **conservé** au classement avec ses points | 0.2.7 §3 / 0.2.9 §6 |
| Verrouillage | piloté par l'**heure connue** du match, **jamais** par le live | P3 / P9 |
| `LOCKED` prono | état **calculé** (`match_is_locked`), jamais écrit ; `VALIDATED` = état terminal stocké | T6b §9.2 |
| Bascule bracket (B6) | défaut = résumé ; « arbre complet » : desktop direct, mobile = invitation à tourner le tél. | B6 |
| Micro-animation (B7) | flash/surbrillance ~1-2 s sur une donnée qui vient de changer | B7 |
| Barre « toi » (B8) | apparaît quand la ligne propre sort du viewport ; sticky au-dessus de la nav ; tap = scroll vers sa ligne ; active > 20 joueurs | B8 / 0.2.9 §6 |
| États vides (B9) | ton « entre potes », CTA si action possible, neutre sinon ; libellés **non figés** ici | B9 |

---

## 2. Supabase Realtime en surcouche (A9)

### 2.1 Principe (rappel T6a §2.2, non rouvert)

```text
- Le rendu INITIAL de chaque écran live est SERVEUR (SSR), fidèle à l'instant de la
  requête. Il donne la première image, référencée dans le composant serveur parent.
- Le composant CLIENT ("use client") s'abonne à Realtime et met à jour son ÉTAT
  LOCAL à réception d'un changement. Il NE déclenche PAS de revalidatePath (on évite
  le double affichage SSR + refetch, T6a §2.2).
- La RLS s'applique nativement au canal (A9) : le composant ne re-garde jamais pour
  la sécurité (P1). matches/series étant publics (T3), tout abonné reçoit les
  changements de score/statut — c'est voulu.
```

### 2.2 Périmètre des souscriptions (scopé matches/series)

```text
Tables souscrites en V1 : matches, series (publication activée par T4 §9).
  → matches : score courant (home_score/away_score sommés), status (→ EN DIRECT,
    FINISHED, POSTPONED, CANCELLED). Alimente les cartes de match et l'écran live.
  → series  : status, official_winner/official_score_format, matchs gagnés par camp.
    Alimente le drill-down série et le résumé bracket (état réel des séries).

NON souscrit en V1 : match_predictions, bets, brackets, bracket_picks, user_scores.
  → Conséquence (ACTÉE, §14.1) : le DÉVOILEMENT des pronos d'autrui avant coup
    d'envoi et les mouvements de classement ne sont PAS poussés en direct ; ils
    apparaissent au prochain rendu serveur (navigation, revalidatePath ciblé après
    une action joueur, T6a §2.3). La fraîcheur reste honnête (à jour dès l'ouverture
    de l'écran). C'est le choix retenu — cf. §14.1.
```

> **Note T4.** T4 §9 avait activé la publication « `matches` (et `series` si
> utile) ». T6c confirme que **`series` EST utile** (drill-down série + résumé
> bracket live) : la publication Realtime doit donc inclure `series`. C'est un
> resserrement cohérent de l'option « si utile » de T4, **pas** une réouverture ;
> à refléter dans l'activation DB au déploiement.

### 2.3 Forme du hook client (indicative — corps en phase de code)

```ts
// components/live/useRealtimeMatches.ts — "use client"
// S'abonne aux UPDATE de `matches` pour un ensemble d'ids. Fusionne le payload
// dans l'état local (seed = données SSR). Aucune écriture, aucune revalidation.
// Renvoie aussi la liste des ids « qui viennent de changer » pour la micro-anim B7.
function useRealtimeMatches(seed: MatchLive[]): {
  matches: MatchLive[];
  justChangedIds: Set<string>;   // vidé après la fenêtre d'animation (§2.4)
  lastEventAt: Date | null;      // horodatage du dernier événement reçu (→ §10)
};

// Idem pour les séries (drill-down + résumé bracket).
function useRealtimeSeries(seed: SeriesLive[]): {
  series: SeriesLive[];
  justChangedIds: Set<string>;
  lastEventAt: Date | null;
};
```

```text
- seed vient du SSR (le composant serveur passe les données initiales en props).
- À réception d'un UPDATE, on remplace la ligne par id (last-write-wins, cohérent
  avec l'idempotence du scoring : le serveur ne pousse jamais d'état partiel — T5
  §10.2, écriture transactionnelle).
- Nettoyage de l'abonnement au démontage (removeChannel). Un seul canal par écran,
  filtré sur les ids visibles pour limiter le trafic.
```

### 2.4 Micro-animation « donnée qui vient de changer » (B7)

```text
- Quand un id entre dans justChangedIds (diff SSR/payload), la cellule concernée
  reçoit un flash/surbrillance de ~1-2 s puis revient à l'état neutre (B7).
- Purement cosmétique : aucune dépendance métier, aucun son, aucune modale.
- Respecte prefers-reduced-motion : sous cette préférence, la valeur change SANS
  animation (mise à jour instantanée), jamais de clignotement.
- Le détail de l'effet (couleur, courbe, durée exacte) est un design token → T7 ;
  T6c ne fixe que le DÉCLENCHEUR (id vient de changer) et la CIBLE (la cellule).
```

---

## 3. Convention d'affichage A1 : « - » vs « 0 » vs « en attente »

Pivot posé en T5 §12.3 (NULL = en attente / non scoré ; 0 = scoré-zéro), décliné en
rendu. **Trois** cas au niveau d'une cellule de points (par source × entité) :

```text
ABSENCE        — aucune ligne de participation pour ce (joueur, source, entité).
                 Rendu : « - ». (Le joueur n'a pas pronostiqué / pas parié / pas
                 rempli cette série.)  ← A1 « - »

SCORÉ-ZÉRO     — ligne existe, scored_at NON NULL, points_awarded = 0
                 (mauvais pick, ou entité neutralisée A2).
                 Rendu : « 0 ».  ← A1 « 0 »

EN ATTENTE     — ligne existe, scored_at NULL (points NULL) : le joueur a participé
                 mais l'entité n'est pas encore résolue.
                 Rendu : marqueur NEUTRE « en attente » (ni « - » ni « 0 »), à côté
                 du pick affiché. Distinct des deux cas ci-dessus.
```

```text
Détection (lecture, jamais un if de sécurité — P1) :
  ABSENCE     : LEFT JOIN sans ligne côté source (row == null).
  SCORÉ-ZÉRO  : row != null AND row.scored_at != null AND row.points_awarded == 0.
  EN ATTENTE  : row != null AND row.scored_at == null.
```

> **Justification du 3e cas.** A1 nomme deux cas (« - » / « 0 ») ; T5 §12.3 nomme
> deux états (NULL / 0). « Participé mais pas encore scoré » (NULL avec ligne) est
> une **participation** — donc jamais « - » — sans être un **zéro scoré** — donc
> jamais « 0 ». Le rendre à part est la seule lecture fidèle des deux sources ; ce
> n'est **pas** une nouvelle règle produit, seulement l'application stricte de la
> convention NULL/0 au grain d'affichage. Le libellé exact (« en attente », « à
> venir »…) suit le principe B9 (§11.2), non figé ici.

```text
Au TOTAL et aux sous-totaux du classement (user_scores, coalesce) : ABSENCE et
SCORÉ-ZÉRO et EN ATTENTE se somment tous à 0 (T1 §6.1) — aucun impact sur le total.
La distinction A1 ne vit qu'au niveau CELLULE DE DÉTAIL, pas au total.
```

---

## 4. Paris annulés / neutralisés (0.2.4 / 0.2.9 §7)

```text
Un pari CANCELLED (neutralisé A2, ou match support annulé) — statut posé par
resolveSeries/resolveBet (T6b), points forcés à 0 SANS pénalité — se rend :
  - texte BARRÉ + grisé (line-through + opacité réduite) ;
  - mention « neutralisé » + la RAISON (resolution_reason / la cause, ex. « match
    annulé ») ;
  - « 0 pt » explicite, présenté comme neutre, PAS comme une perte ;
  - VISUELLEMENT DISTINCT d'un pari « perdu » (LOST) : un perdu n'est ni barré ni
    grisé (il reste un résultat de jeu normal), un annulé l'est.
  - PLACÉ DANS LA LISTE « Mes paris » (et la vue publique), au fil, PAS dans une
    section séparée.
Même traitement en vue publique (après deadline) qu'en vue joueur (0.2.6 §2).
```

```text
Jamais de pénalité négative (P6, invariant) : un pari annulé vaut 0, jamais < 0. Le
rendu ne doit nulle part afficher un signe négatif ni un « malus » sur un annulé.
```

---

## 5. Marquage public « saisi/corrigé par admin X sur requête de Y » (0.2.3 §7)

```text
La correction admin d'un prono/pari (processCorrectionRequest, T6b §5.3) pose sur
la ligne cible des ATTRIBUTS publics :
  is_admin_corrected = true, corrected_by_admin_id (→ X), correction_reason,
  correction_request_id (→ remonte à la requête, dont user_id = Y le demandeur).

Rendu : un petit MARQUEUR/badge sur la ligne du prono ou du pari concerné, visible
de tous après verrouillage (« saisi/corrigé par {X} sur requête de {Y} »), avec la
raison consultable (tap/hover). C'est un ATTRIBUT DE LA LIGNE, affiché comme tel.
```

```text
Frontière stricte (P1 / 0.2.7 §8) :
  - CE marquage est PUBLIC (attribut de la donnée de jeu, visible après coup).
  - Le LOG D'AUDIT (audit_logs) reste PRIVÉ (écran /admin/logs uniquement, §9 admin).
  - Le composant public ne lit JAMAIS audit_logs : il lit les attributs de la ligne.
    X et Y viennent de corrected_by_admin_id et de correction_request → user_id,
    pas du log. (La RLS interdit de toute façon la lecture d'audit_logs au public.)
  - Cas « saisi par admin » sans requête préalable (Y absent) : n'afficher que « X ».
```

---

## 6. Joueurs absents et joueur inactif

### 6.1 Absents sur un match (révélation nominative, 0.2.9 §5-6)

```text
Sur la carte de match révélée (après verrouillage / « valider = voir »), les joueurs
qui n'ont PAS pronostiqué ce match ne polluent pas la liste des pronos :
  - compteur NEUTRE « X n'ont pas joué » (ton factuel, aucune stigmatisation) ;
  - au clic / survol, DÉPLIER la liste nominative des absents.
« Absent » = aucune ligne match_predictions pour ce (match, joueur) parmi les
joueurs actifs de la compétition → c'est le cas ABSENCE de §3, décliné au compteur.
```

### 6.2 Joueur inactif / désactivé (DISABLED, 0.2.7 §3 / 0.2.9 §6)

```text
Un joueur DISABLED est CONSERVÉ au classement avec ses points (aucune suppression) :
  - ligne grisée + tag « inactif » ;
  - il compte dans le classement et le départage comme n'importe quel joueur ;
  - il n'a simplement plus le droit d'ÉCRIRE (is_active(), RLS T3) — invisible au
    rendu, qui ne fait qu'afficher l'état.
Le rendu lit users.status ; il ne re-décide rien (P1).
```

---

## 7. Barre « toi » collante (B8 / 0.2.9 §6)

```text
Objet : ne jamais perdre sa propre position dans un long classement.

Activation : SEULEMENT si la compétition compte > 20 joueurs classés (0.2.9 §6).
Affichage  : la barre n'apparaît QUE quand la ligne propre du joueur sort du
             viewport en scrollant (si elle est déjà visible, pas de barre — B8).
Position   : sticky en bas du viewport, AU-DESSUS de la barre de nav 4 onglets.
Contenu    : réutilise le FORMAT DE LIGNE MOBILE déjà validé (Rang/Pseudo, Total,
             valeur de la puce de tri active — B8 / 0.2.9 §11.5). Le rang reste le
             rang réel sur Total (§9).
Interaction: tap sur la barre = scroll direct vers sa ligne dans la liste complète.
Visiteur   : pas de « toi » (aucune session) → barre jamais rendue.
```

---

## 8. Bracket : bascule, tendances, drill-down

### 8.1 Bascule vue résumé / arbre plein écran (B6 / 0.2.9 §5)

```text
Vue A « RÉSUMÉ PAR TOUR » = DÉFAUT (portrait mobile ET desktop) :
  état réel de chaque série + tendances des joueurs ; tap sur une série = drill-down
  (§8.3). C'est la vue de consultation courante.

Vue B « ARBRE SCROLLABLE » (effet poster), via un bouton « voir l'arbre complet » :
  - Desktop : affiche directement l'arbre (défilement horizontal + zoom).
  - Mobile  : affiche un MESSAGE invitant à tourner le téléphone (B6). On NE force
    PAS la rotation par API (Fullscreen / Screen Orientation Lock jugées peu fiables
    cross-navigateurs, B6) : c'est une invitation, pas une contrainte.
```

### 8.2 Tendances : % vs nombre brut (seuil série par série, 0.2.6 §4)

```text
Pour CHAQUE série, la tendance des picks (qui a fait avancer qui) s'affiche :
  - en POURCENTAGE si > 10 brackets ont rempli CETTE série ;
  - en NOMBRE BRUT sinon.
Seuil compté SÉRIE PAR SÉRIE (interprétation actée, GAPS), pas sur le bracket entier
à 15/15 : au 1er tour beaucoup de séries dépassent 10, un tour avancé peut rester en
brut plus longtemps. Chaque série tranche indépendamment.
```

### 8.3 Drill-down nominatif par série (0.2.6 §4)

```text
Tap sur une série (depuis la vue résumé) = ouvre le détail de CETTE série :
  - l'état réel officiel (vainqueur, format, matchs joués) via series (Realtime, §2) ;
  - le détail NOMINATIF des picks des joueurs sur cette série (qui a pris qui, quel
    format) — visible après la deadline du bracket (RLS T3 : bracket_picks lisibles
    après bracket_deadline_passed).
Le drill-down est NOMINATIF par série (0.2.6 §4). Il respecte la RLS : avant la
deadline, un visiteur/joueur ne reçoit rien d'autre que le sien (P1).
```

---

## 9. Classement : tri par puces, Total permanent, lignes dépliables

### 9.1 Puces de tri (0.2.6 §6 / 0.2.9 §6)

```text
Un SEUL classement. Puces de tri : Total · Matchs · Bracket · Paris · Forme.
  - la puce active pilote le TRI et met en avant SA valeur par joueur ;
  - le TOTAL reste TOUJOURS affiché, même en tri par une autre colonne (repère du
    classement réel) ;
  - le RANG affiché est TOUJOURS calculé sur Total (interprétation actée, GAPS),
    quelle que soit la puce active — trier par « Matchs » ne renumérote pas.
  - « dont Écarts » (écarts exacts) est rendu TRIABLE en plus des 5 puces
    officielles (interprétation actée, GAPS) — ce n'est pas une 6e puce officielle,
    c'est une aide de lecture du détail.
```

### 9.2 Départage à l'affichage (0.2.6 §3)

```text
Ordre : 1. Total  2. bons vainqueurs de MATCH  3. écarts exacts  4. points bracket
        5. ex-aequo assumé. Les colonnes de départage viennent de user_scores
(correct_match_winners, exact_margins — T1/modèle). Le tri par une puce applique la
cascade générale en cas d'égalité SUR la colonne triée.
```

### 9.3 Lignes dépliables (0.2.6 §6 / 0.2.9 §6)

```text
Chaque ligne se déplie en sous-totaux PUBLICS : Matchs / Bracket / Paris / Forme.
  - Forme = fenêtre glissante 7 jours, toutes sources (vue user_recent_form).
  - Les cellules de détail appliquent la convention A1 (§3) : « - » / « 0 » /
    « en attente » selon la participation à chaque source.
```

### 9.4 Colonnes mobile vs desktop (0.2.9 §11.5)

```text
Mobile  : 3 colonnes max — (Rang/Joueur) · Total · valeur de la puce active. Le
          reste passe par le dépliable. JAMAIS de scroll horizontal.
Desktop : toutes les colonnes affichées.
Le composant de rendu est PARTAGÉ visiteur/joueur (T6a §3.2 / §8.1) : la seule
différence de contenu vient de la RLS (le joueur voit en plus « toi » §7 et ses
propres détails), pas d'un if(role).
```

---

## 10. Live : mise à jour silencieuse, fraîcheur honnête, badge EN DIRECT

### 10.1 Comportement (0.2.9 §7)

```text
- Mise à jour SILENCIEUSE en place : score et écart courant se mettent à jour via
  Realtime (§2) sans rechargement, sans modale, avec la micro-anim B7 (§2.4).
- Repère discret « mis à jour il y a … » : dérivé de lastEventAt (dernier événement
  Realtime reçu) — voir §10.2.
- Badge « EN DIRECT » sur un match dont le status est « en cours » (live) ; retiré
  au passage à FINISHED. Le badge signale « match en cours », pas « temps réel à la
  seconde » (cf. §10.3).
```

### 10.2 « Mis à jour il y a … » = fraîcheur RÉELLE, pas décorative

```text
Le repère affiche la fraîcheur VRAIE de la donnée :
  - à réception d'un événement Realtime → lastEventAt = now, le repère repart de
    « à l'instant » ;
  - entre deux synchros, le compteur monte honnêtement (« il y a 12 min »…).
On n'affiche JAMAIS une fraîcheur qu'on n'a pas. Source de vérité = l'horodatage du
dernier changement effectivement reçu, pas un simple timer d'UI.
```

### 10.3 Dégradation propre selon la fréquence de synchro (T6b §9.1 / T4)

```text
/api/sync/results ne tourne que toutes les 30-60 min EN FENÊTRE de match (budget API,
palier gratuit — T4/A8). Donc le score « live » peut avoir jusqu'à ~30-60 min de
retard. L'écran DÉGRADE PROPREMENT :
  - le repère « mis à jour il y a … » rend ce retard visible et honnête ;
  - aucun faux « live à la seconde » n'est promis ;
  - EN DIRECT = « match en cours d'après le dernier statut connu », cohérent avec le
    repère de fraîcheur.
Rappel P3/P9 : le VERROUILLAGE des pronos reste piloté par l'heure connue du match,
JAMAIS par le live. Un retard de synchro ne verrouille ni ne déverrouille rien.
```

---

## 11. Dialogue du garde-fou C2 et états vides (B9)

### 11.1 Dialogue C2 — avertissement de perte de saisie (wording)

```text
Portée (C2, corps en T6b) : les 3 écrans à saisie perdable — pronos match
(play/matches), paris personnalisés (play/bets), bracket (play/bracket).

Déclenchement du dialogue : le formulaire est « sale » (modifications non
sauvegardées) ET le joueur tente de quitter — fermeture d'onglet (beforeunload) OU
navigation interne à l'app (garde de navigation App Router).

Le dialogue :
  - rappelle qu'une saisie non sauvegardée sera perdue ;
  - propose « Rester » (par défaut) et « Quitter quand même » ;
  - ton « entre potes » (B9), sans dramatisation ni jargon.
  - il porte sur la PERTE DE SAISIE (brouillon non enregistré), à ne pas confondre
    avec la confirmation de VALIDATION définitive d'un prono (« valider = voir »,
    0.2.3), qui est un autre dialogue, déjà cadré côté action (T6b §3.1).

Wording exact NON figé ici (B9) : figé au moment de coder l'écran. Exemple
illustratif, non contractuel : « T'as des trucs pas encore enregistrés. Tu files
sans sauver ? » / [Rester] [Quitter quand même].
```

### 11.2 États vides & libellés (B9)

```text
Principe transversal (B9), le SEUL figé ici :
  - Ton convivial « entre potes », jamais un message froid générique.
  - TOUJOURS un appel à l'action quand une action est possible
    (ex. bracket vide avant deadline → « Remplis ton bracket » + bouton).
  - NEUTRE (juste confirmer l'absence, sans fausse incitation) quand aucune action
    n'est possible (ex. classement d'une compétition sans participant → constat
    simple, pas d'injonction).

Écrans concernés (inventaire, libellés à figer au code de chaque écran) : Accueil
(« À traiter » vide / « Ça vient de tomber » vide), Matchs (aucune affiche dans la
fenêtre 3 j), Bracket (pas encore ouvert / déjà validé), Paris (aucun pari),
Mes pronos (aucun prono), files admin (validation/résolution/requêtes vides), logs
(aucune entrée pour le filtre).

Cohérent avec la méthodo (figer le transversal, laisser le local au code —
methodo_optimisation_sessions §6). T6c fixe le PRINCIPE et l'INVENTAIRE, pas les
chaînes définitives.
```

---

## 12. Ce que T6c ne dit pas

```text
- Les design tokens : palette arène/broadcast (DARK défaut), typo, espacements,
  couleur/durée exactes du flash B7, forme visuelle des badges/puces.          → T7
- Le corps des server actions (figé T6b) et des lectures lib/queries (T6a).    → T6a/T6b
- Le SQL (aucune migration T6c) ; la publication Realtime est activée par T4.  → T4
- La config du planificateur externe (fréquences cron).                        → T8/déploiement
- Le 1er écran joueur codé : il vient APRÈS T7 (tokens) — B9/0.2.9 §2.          → post-T7
```

---

## 13. Plan de test T6c

```text
REALTIME (§2)
1.  Écran live ouvert, /api/sync/results écrit un nouveau score → la carte se met à
    jour SANS rechargement de page et SANS second fetch serveur (revue : aucun
    revalidatePath déclenché par Realtime).
2.  Deux onglets sur le même match → les deux reçoivent l'update (canal partagé RLS).
3.  Visiteur (pas de session) sur le classement/bracket public → reçoit les updates
    de matches/series publics (RLS true), rien de privé.
4.  Un changement de series.official_* → le drill-down série ET le résumé bracket
    reflètent le nouvel état sans reload.
5.  Démontage de l'écran → le canal est fermé (removeChannel), pas de fuite d'abo.
6.  prefers-reduced-motion actif → la valeur change sans flash (pas de clignotement).

CONVENTION A1 (§3)
7.  Joueur sans prono sur une source → cellule « - ». Avec prono mais mauvais pick,
    entité résolue → « 0 ». Avec prono, entité non résolue → « en attente ».
8.  Total du joueur inchangé quel que soit le cas ci-dessus (coalesce → 0/0/0).

PARIS ANNULÉS (§4)
9.  Pari CANCELLED → barré + grisé + « neutralisé » + raison + « 0 pt » ; rendu
    DISTINCT d'un pari LOST (non barré). Présent DANS la liste, pas à part.
10. Aucun signe négatif nulle part sur un annulé (P6).

MARQUAGE CORRECTION (§5)
11. Prono corrigé par admin sur requête → badge « corrigé par X sur requête de Y »
    visible après verrouillage ; raison consultable.
12. Le composant public n'interroge JAMAIS audit_logs (revue de code) ; X/Y viennent
    des attributs de ligne + correction_request. Correction sans requête → « X » seul.

ABSENTS / INACTIF (§6)
13. Carte de match révélée : « X n'ont pas joué » ; clic → liste nominative.
14. Joueur DISABLED → grisé + « inactif », TOUJOURS présent au classement avec points.

BARRE « TOI » (§7)
15. ≤ 20 joueurs → jamais de barre. > 20 joueurs, ligne propre hors viewport → barre
    visible ; ligne propre visible → barre masquée ; tap → scroll vers sa ligne.
16. Visiteur → jamais de barre « toi ».

BRACKET (§8)
17. Défaut = vue résumé. « Voir l'arbre complet » : desktop → arbre ; mobile →
    message « tourne ton téléphone » (aucune rotation forcée par API).
18. Série avec > 10 brackets remplis → tendance en % ; ≤ 10 → nombre brut (compté
    série par série : deux séries du même bracket peuvent différer).
19. Tap sur une série (après deadline) → drill-down nominatif ; avant deadline, un
    autre joueur ne voit que son propre pick (RLS).

CLASSEMENT (§9)
20. Puce « Matchs » → tri par matchs, MAIS Total toujours affiché et rang inchangé
    (calculé sur Total). Puce « Forme » → sous-totaux 7 jours.
21. Ligne dépliée → Matchs/Bracket/Paris/Forme, cellules en convention A1 (§3).
22. Mobile → 3 colonnes, pas de scroll horizontal ; desktop → toutes colonnes.
23. Même composant rendu visiteur puis joueur → seule la RLS change le contenu
    (revue : aucun if(role) de sécurité — T6a §2.1).

LIVE (§10)
24. Repère « mis à jour il y a … » repart de « à l'instant » à chaque événement reçu
    et monte honnêtement entre deux synchros.
25. Badge EN DIRECT présent en cours de match, retiré à FINISHED.
26. Retard de synchro (30-60 min) → aucun faux « temps réel » ; verrouillage des
    pronos inchangé (piloté par l'heure du match, pas par le live).

C2 & ÉTATS VIDES (§11)
27. Formulaire sale + fermeture d'onglet → dialogue (beforeunload). Idem navigation
    interne. Formulaire propre → aucun dialogue.
28. Écran vide AVEC action possible → CTA ; écran vide SANS action → message neutre.
    (Libellés non figés — on vérifie le comportement, pas la chaîne exacte.)
```

---

## 14. Décisions actées à la validation de T6c (19/07/2026)

### 14.1 Révélation des pronos qui se dévoilent : NON temps réel (option a) — *acté*

**Acté.** Les souscriptions Realtime restent scopées à **matches/series** ; on
**n'ajoute pas** de souscription `match_predictions`. Conséquence assumée : la
révélation d'un prono d'autrui (quand un autre joueur valide, avant coup d'envoi)
et les mouvements de classement ne sont **pas poussés en direct** — ils apparaissent
au **prochain rendu serveur** (navigation, ou `revalidatePath` ciblé après une action
joueur, T6a §2.3). Le score et l'écart courant du match, eux, restent bien live via
la souscription `matches`.

```text
Justification : cohérent avec le scoping matches/series ; la fraîcheur reste honnête
(l'état est à jour dès l'ouverture/rafraîchissement de l'écran) ; zéro activation DB
supplémentaire, zéro coût. « Mise à jour silencieuse » (0.2.9 §7) reste vraie pour
score/écart/statut ; la révélation des pronos d'autrui suit le rythme SSR, sans faux
temps réel.
Écartée : l'option (b) — étendre souscription ET publication Realtime à
match_predictions (RLS-safe via « valider = voir »). Non retenue en V1. Réserve
propre : si l'usage montre un vrai besoin de dévoilement live pré-coup d'envoi, (b)
reste faisable, mais elle rouvrirait l'activation de publication côté T4 §9 (bornée
à matches/series) — à traiter alors explicitement côté T4, jamais en douce.
```

### 14.2 `series` dans la publication Realtime — *acté*

**Acté.** T4 §9 avait laissé `series` en « si utile » ; T6c tranche : **`series` EST
utile** (drill-down série + résumé bracket live). La publication Realtime **inclut
donc `series`** en plus de `matches`. Resserrement d'une option laissée ouverte par
T4, **pas** une réouverture — à refléter dans l'activation DB au déploiement (aucune
migration T6c).

---

**T6c est VALIDÉ et figé.** T6 est désormais complet (T6a squelette + T6b écritures +
T6c rendu/Realtime). T6c ne produit **aucune migration** ; la publication Realtime
(`matches` + `series`, §14.2) est une activation DB portée par T4 au déploiement. La
suite est **T7 — design tokens** (`SPEC_DESIGN_SYSTEM_V0.1.md`), à écrire juste avant
le 1er écran joueur (B9 / 0.2.9 §2) : c'est T7 qui débloque le codage effectif des
écrans spécifiés ici. Conventions de code inchangées : TypeScript strict, App Router,
composants serveur par défaut (`"use client"` réservé à l'interaction/Realtime),
commentaires FR, noms EN, `service_role` jamais exposé au client.
