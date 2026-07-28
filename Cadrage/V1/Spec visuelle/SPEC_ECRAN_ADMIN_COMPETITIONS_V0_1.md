# NBA Pronos — SPEC ÉCRAN GESTION DES COMPÉTITIONS (ADMIN) V0.1

> **Statut : VALIDÉ (27/07/2026).** Nouveau chantier, hors du lot Admin
> initial (T6a listait déjà `(admin)/admin/competitions/{page,new}` dans
> l'arbre, mais explicitement HORS PÉRIMÈTRE de tous les lots codés à ce
> jour — jamais spécifié au niveau écran). Découpé en 3 lots avec
> l'utilisateur (AskUserQuestion) : **1. Création** (CE document) —
> **2. Saisie manuelle des résultats** (remplace T4 tant que la synchro
> réelle n'existe pas, séparé, dure toute la compétition) —
> **3. Clôture/archivage**.
>
> Périmètre STRICT de ce lot : `app/(admin)/admin/competitions/page.tsx`
> (statut de la compétition active + point d'entrée) et
> `app/(admin)/admin/competitions/new/page.tsx` (création). PAS la
> clôture (bouton visible mais renvoyé au lot 3, même patron que le bouton
> Recalculer omis puis ajouté).

---

## 0. Sources et cadre

```text
Règles : nba_pronos_decisions_multi_competitions_historique.md §1 (une
  compétition ACTIVE à la fois — contrainte déjà en base,
  uniq_one_active_competition) et §2 (écran « Nouvelle compétition » :
  nom + type, montage automatique de la structure selon le type) ;
  nba_pronos_decisions_nba_cup_mecanique_scoring.md §1 (phase de groupes
  Cup HORS pronostic — aucune structure à monter à la création pour Cup).
Donnée : SPEC_TECHNIQUE_MODELE_DONNEES_V0_1.md — competitions (name, type,
  status, bracket_deadline NULL tant qu'inconnu) ; competition_secrets
  (join_code) ; series (round, conference, slot_index NOT NULL — trouvé
  au pré-vol, absent de mes notes jusqu'ici —, team1_id/team2_id,
  next_series_id/next_series_slot) ; teams (conference, déjà peuplé,
  30 lignes).

**Trouvaille structurante actée AVEC l'utilisateur (AskUserQuestion)** :
même une fois une compétition créée, RIEN ne fait aujourd'hui avancer une
équipe vers le tour suivant ni ne pose un résultat officiel — ni la
synchro (T4, non codée), ni aucune action admin (le writer
`series.official_*`, T5 lot 2, existe mais AUCUN écran ne l'appelle
encore pour un usage normal). D'où le découpage en 3 lots : la CRÉATION
seule ne suffit pas à faire vivre une compétition réelle, la saisie
manuelle de résultats (lot 2) est le morceau qui compte le plus pour être
prêt le 30 octobre — mais elle est SÉPARÉE de ce lot-ci.

**Décision actée AVEC l'utilisateur** : à la création, l'admin saisit les
équipes/affiches À LA MAIN (sélecteurs manuels), PAS d'attente de T4. Le
mapping automatique (A7, pré-remplissage depuis l'API) viendra plus tard
EN PLUS de la saisie manuelle, jamais à sa place.

**Topologie du bracket Playoffs — FIXE, pas une saisie admin** : la forme
de l'arbre (quelle paire de séries ROUND_1 alimente quelle CONF_SEMIS, etc.)
suit la structure NBA réelle, identique chaque année — codée en dur, PAS
un champ du formulaire. L'admin ne choisit QUE les équipes des 8 affiches
du 1er tour (4 par conférence) ; les 7 séries des tours suivants
(4 CONF_SEMIS + 2 CONF_FINALS + 1 NBA_FINALS) sont créées VIDES
(team1_id/team2_id NULL), liées par next_series_id/next_series_slot,
peuplées plus tard par le lot 2 (avancement manuel) — jamais à la création.
```

---

## 1. Architecture

```text
app/(admin)/admin/competitions/page.tsx → composant serveur, lib/queries/
  admin-competitions.ts. Affiche la compétition ACTIVE (s'il y en a une) :
  nom, type, code de compétition (join_code, affiché en clair — déjà le
  patron du seed, à partager aux amis). Bouton « Clôturer et archiver » —
  VISIBLE mais DÉSACTIVÉ, libellé « bientôt » (lot 3, même patron que le
  bouton Recalculer omis puis ajouté au lot Admin). Lien « Créer une
  nouvelle compétition » — DÉSACTIVÉ si une compétition est déjà ACTIVE
  (contrainte uniq_one_active_competition, le formulaire échouerait sinon).

app/(admin)/admin/competitions/new/page.tsx + lib/actions/
  admin-competitions.ts → formulaire de création. AUCUN "use client" —
  <select> natifs, formulaire natif classique.
```

---

## 2. Écran liste (`/admin/competitions`) — **acté**

```text
Aucune compétition active : « Aucune compétition en cours. » + lien actif
  « Créer une nouvelle compétition ».
Compétition active : nom, type (libellé « Playoffs » / « NBA Cup »), code
  de compétition en évidence (à copier/partager), bouton Clôturer DÉSACTIVÉ
  (lot 3).
PAS de liste des compétitions ARCHIVÉES ici (0.2.9 : l'historique est un
  besoin JOUEUR, onglet Profil §4 de decisions_multi_competitions — pas un
  besoin admin distinct, pas dupliqué ici).
```

---

## 3. Formulaire de création (`/admin/competitions/new`) — **acté**

```text
Champs communs :
  - Nom (texte libre, ex. "NBA Cup — Automne 2026") — obligatoire.
  - Type : PLAYOFFS / NBA_CUP (2 boutons radio, pas de <select> pour 2
    options).

Si PLAYOFFS sélectionné (révélé par le type, formulaire natif — un simple
  <fieldset> conditionnel affiché par défaut si Playoffs est le radio par
  défaut, JAMAIS masqué par JS puisque les 2 jeux de champs sont dans LE
  MÊME formulaire, inutilisés silencieusement ignorés côté serveur selon
  le type effectivement soumis) :
  - 8 affiches du 1er tour, groupées par conférence (4 Est, 4 Ouest) —
    16 <select> d'équipe (une par slot), PAS de sélecteur de conférence
    séparé (déduite de l'appartenance de l'équipe, teams.conference déjà
    peuplé) ; validation SERVEUR : chaque équipe utilisée AU PLUS UNE FOIS
    sur les 16, les 2 équipes d'une même affiche DOIVENT partager la même
    conférence (cohérence avec teams.conference, erreur sinon).

Si NBA_CUP sélectionné : AUCUN champ supplémentaire — la compétition est
  créée SANS série (mini-bracket monté plus tard, une fois les 8 qualifiés
  connus fin novembre, hors périmètre de ce lot ET du lot 2).

Actions serveur à la soumission :
  1. INSERT competitions (name, type, status='ACTIVE', bracket_deadline=NULL
     — inconnu tant qu'aucun match n'est saisi, lot 2, cas déjà géré par
     l'Accueil : item bracket absent si bracket_deadline NULL).
  2. INSERT competition_secrets (join_code = code aléatoire 8 caractères,
     même génération que le seed — randomUUID().slice(0,8).toUpperCase()).
  3. Si PLAYOFFS : INSERT des 15 lignes series (8 ROUND_1 avec team1_id/
     team2_id remplis + slot_index séquentiel + conference déduite ; 4
     CONF_SEMIS + 2 CONF_FINALS + 1 NBA_FINALS VIDES), cascade next_series_
     id/next_series_slot posée selon la topologie FIXE (§0).
  4. Redirection vers /admin/competitions (succès) ou formulaire re-affiché
     avec erreur (doublon d'équipe, conférences incohérentes, nom vide).
```

---

## 4. Écriture — `lib/actions/admin-competitions.ts`

```ts
export async function createCompetition(input: {
  name: string;
  type: "PLAYOFFS" | "NBA_CUP";
  // Playoffs uniquement — 8 paires [team1Id, team2Id], EST puis OUEST,
  // dans l'ordre fixe de la topologie (§0).
  round1Matchups?: [string, string][];
}): Promise<ActionResult>;
```

```text
Session admin (getServerClient, RLS competitions_insert = is_admin() déjà
  en place, migration #3 — AUCUNE migration pour ce lot). Re-vérifie
  is_admin() implicitement via la RLS, pas de re-check applicatif redondant
  (même principe que validateBet). Toutes les INSERT (competitions,
  competition_secrets, series) dans le MÊME appel serveur — pas de vraie
  transaction multi-tables côté supabase-js (même limitation déjà
  documentée pour l'orchestration T5, §2.26) : idempotence PAS garantie
  ici (créer une compétition n'est PAS une opération rejouable comme un
  recompute) — en cas d'échec partiel, l'admin devra nettoyer à la main
  (cas rare : cet écran n'est utilisé qu'à quelques reprises par saison,
  pas un chemin chaud). logAdminAction ("CREATE_COMPETITION") après succès.
```

---

## 5. Topologie fixe des Playoffs (§0) — table de référence

```text
8 ROUND_1 (4 EST : E1-E4, 4 OUEST : W1-W4) →
  4 CONF_SEMIS : ES1 (E1+E2), ES2 (E3+E4), WS1 (W1+W2), WS2 (W3+W4) →
  2 CONF_FINALS : EF (ES1+ES2), WF (WS1+WS2) →
  1 NBA_FINALS : (EF+WF)
Ordre de saisie du formulaire = E1..E4 puis W1..W4 (8 affiches), qui
détermine mécaniquement les 15 lignes `series` et leurs liens
next_series_id/next_series_slot — l'admin ne voit jamais cette mécanique,
seulement les 8 sélections d'équipes.
```

---

## 6. États et erreurs

```text
Nom vide, équipe dupliquée, conférences incohérentes sur une affiche :
  erreurs portées par l'URL de redirection, formulaire re-rendu avec les
  sélections déjà faites préservées (pas de ressaisie complète).
```

---

## 7. Règles de rendu (T7)

```text
- CSS Modules, tokens app/tokens.css exclusivement.
- Teinte admin (--color-trend), énergie calme (écran de LECTURE/saisie
  technique, pas un moment fort — 0.2.9 §2).
```

---

## 8. Hors périmètre de CE lot

```text
- Saisie manuelle des résultats de match/avancement de série (lot 2,
  séparé, dure toute la compétition) — VOIR SPEC_ECRAN_ADMIN_RESULTATS_V0_1.md.
- Clôture et archivage (lot 3, séparé) — VOIR §9 CI-DESSOUS (ajouté le
  27/07/2026, suite, débloqué par un besoin réel : impossible de créer une
  2e compétition tant que la 1re reste ACTIVE sans mécanisme de clôture).
- Mini-bracket NBA Cup (monté une fois les 8 qualifiés connus — lot 2 ou
  un lot dédié, pas tranché ici).
- Mapping automatique A7 (pré-remplissage depuis la synchro T4) — la
  saisie manuelle reste le seul chemin tant que T4 n'existe pas.
```

---

## 9. Lot 3/3 — Clôture et archivage (`/admin/competitions`) — **acté 27/07/2026**

```text
Motif de la reprise : en testant la création d'une 2e compétition (avant
de brancher T4, pour repartir sur des équipes/matchs alignés avec ce que
l'API renvoie réellement), l'utilisateur a buté sur
`uniq_one_active_competition` — sans clôture, aucune nouvelle compétition
n'est possible. Décision AVEC l'utilisateur (AskUserQuestion) : construire
le lot 3/3 pour de bon plutôt qu'un contournement jetable.

Source : `nba_pronos_decisions_multi_competitions_historique.md` §3 —
« Clôture = action MANUELLE et EXPLICITE de l'admin... 1. Capture d'un
instantané du classement FINAL... 2. Reset ensuite ». Lecture actée du
« reset » (pas précisée plus loin dans la décision d'origine) : dans le
modèle V1 (contrairement au prototype et son `reset_simulation.sql`), RIEN
n'est supprimé — chaque ligne `series`/`matches`/`match_predictions`/
`brackets`/`bracket_picks`/`bets` reste rattachée pour toujours à son
`competition_id` (nécessaire à un futur historique joueur, `decisions_
multi_competitions_historique.md` §4, GAPS_OUVERTS.md). « Reset » = passer
`competitions.status` à `ARCHIVED`, ce qui SEUL libère le slot de l'index
partiel `uniq_one_active_competition` — aucun DELETE, aucun TRUNCATE.

Écriture (`lib/actions/admin-competitions.ts`, `closeCompetition`) :
session admin normale (`getServerClient`), AUCUN `service_role` nécessaire
— RLS déjà ouvertes pour l'admin (`archives_insert`/`competitions_update`,
migration RLS #3, is_admin()) :
  1. Lit `user_scores` pour la compétition (agrégats déjà en base, mêmes
     colonnes que `competition_archives` — vue non-invoker, migration #5).
  2. Calcule le rang via `lib/scoring/ranking.ts` (`assignRanks`, NOUVEAU
     module — extrait de `lib/queries/leaderboard.ts` pour que l'archive
     gèle EXACTEMENT le même départage que le classement affichait en
     direct, pas une règle recopiée à la main qui pourrait diverger un
     jour) : Total, puis bons vainqueurs de match, puis écarts exacts,
     puis points bracket ; ex-aequo = même rang (1, 2, 2, 4).
  3. INSERT `competition_archives` (1 ligne par joueur ayant au moins une
     ligne de scoring — mêmes participants que `user_scores`), avec
     `pseudo_snapshot` (figé, lu sur `users.pseudo` au moment de la
     clôture).
  4. UPDATE `competitions.status = 'ARCHIVED'` — gardé par
     `.eq("status", "ACTIVE")` + vérification de la ligne retournée
     (refuse une double clôture, message dédié).
  `logAdminAction` ("CLOSE_COMPETITION") après succès.

UI (`components/admin/CloseCompetitionButton.tsx`) : SEULE feuille
`"use client"` de l'écran, même patron que `RecalculateButton.tsx`
(dialogue de confirmation — action IRRÉVERSIBLE, `decisions_multi_
competitions_historique.md` §3 : « AUCUNE correction possible après
clôture »). Remplace le bouton DÉSACTIVÉ posé au lot 1.

Hors périmètre de CE lot (toujours ouvert, `GAPS_OUVERTS.md`) : l'onglet
Historique côté Profil joueur qui LIRAIT `competition_archives` — cette
table est désormais alimentée, mais rien ne l'affiche encore côté joueur.
```
