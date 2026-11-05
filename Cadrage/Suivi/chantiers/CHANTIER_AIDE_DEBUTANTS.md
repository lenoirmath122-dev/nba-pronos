# Chantier — Aide aux débutants : forme des équipes et détail des effectifs

> **Nature** : vivant. Cadrage rédigé le 05/11/2026, **aucune ligne de code écrite**.
> Implémentation prévue dans Claude Code, **un lot = une branche = une PR**
> (méthode `Cadrage/Suivi/README.md`). Quand un lot est mergé, cocher sa case
> en §9 et faire la passation habituelle (`REPRISE.md`, `JOURNAL_SESSIONS.md`).
> **Partie visuelle volontairement non tranchée** : ce document fixe les données,
> les calculs, les contrats d'API et les comportements. Les composants livrés en
> lot 4 sont fonctionnels, avec un habillage minimal, qui sera repris dans une
> session « visuel » dédiée.

---

## 1. Objectif

Aider un joueur qui ne connaît pas bien la NBA à pronostiquer, sans quitter
l'écran Jouer :

1. **Sur chaque carte de match** : une indication de **forme récente** des deux
   équipes, visible sans aucun clic.
2. **Un bouton « Détail des équipes »** sur la carte, qui ouvre une **popup** avec,
   pour chacune des deux équipes : résumé de saison et liste des joueurs avec
   leurs stats phares de la saison.

## 2. Décisions déjà prises (05/11/2026, utilisateur)

| # | Décision |
|---|---|
| D1 | La forme est affichée **directement sur la carte du match**. Tout le reste est dans une **popup** ouverte par un bouton « Détail des équipes ». |
| D2 | Stats joueurs = **toute la saison en cours**, uniquement les matchs de **cette** saison, **même si le joueur a changé d'équipe** (ses matchs avec l'ancienne équipe comptent). Le joueur est **rangé dans sa dernière équipe** (celle de son match le plus récent). |
| D3 | **Pas de complément avec la saison passée**, même en tout début de saison : on affiche la saison en cours avec une mention « début de saison » tant que l'échantillon est faible (règle §5.4). |
| D4 | Données **pré-calculées** en base après chaque import de box scores ; aucune agrégation lourde à l'affichage. |
| D5 | Étiquettes de forme et de tendance **calculées côté TypeScript** à partir de chiffres bruts stockés en base, pour pouvoir ajuster les seuils sans migration. |

## 3. Hors périmètre v1

- **Blessures / indisponibilités** : aucune source dans la base. Point ouvert (§11).
- **Photos des joueurs** (`cdn.nba.com/headshots/...`) : même question d'usage commercial que nba_api (p8-3). Pas en v1.
- Fiche joueur détaillée, comparateur, historique match par match, classement complet de la ligue en page dédiée.
- Cartes de matchs verrouillés (`LockedRow`) et onglet Résultats : **pas d'indicateur ni de bouton en v1** (seulement `UpcomingRow`, voir §7.1). À rediscuter avec le visuel.
- Playoffs : la v1 affiche les stats de **saison régulière** même pendant les playoffs (§11, point ouvert).

## 4. État des données constaté (prod, 05/11/2026)

Projet Supabase `nba-pronos` (`lcldekiwinggyqgbmlwc`). Requêtes faites en lecture seule.

- **Source** : VM `nba-refresh` (nba_api), timer `Cadrage/Stats/vm/nba-refresh.timer` à **12h00 et 16h00 Europe/Paris**, point d'entrée `Cadrage/Stats/service/refresh_job.py`. Dernier import réussi : 05/11 08:44 UTC.
- **Saison 2026-27** : 121 matchs de saison régulière (du 20/10 au 04/11), 452 joueurs, ~2 700 lignes de box scores. 32 matchs de présaison, à exclure.
- **Tables utiles** (toutes en RLS **sans policy**, donc lisibles uniquement via le client service) :
  - `stats_matchs(game_id, game_date, season, season_type, home_team_id, away_team_id, …)` ; index `stats_matchs_season_idx (season)`.
  - `stats_box_scores(game_id, player_id, team_id, opponent_team_id, game_date, season, minutes text, pts, reb, ast, fg3m, fg3a, fgm, fga, ftm, fta, stl, blk, tov, pf, oreb, plus_minus, position, …)` ; index `stats_box_scores_team_date_idx (team_id, game_date desc)`, `stats_box_scores_player_opponent_idx`. **Pas d'index sur `season`.**
  - `stats_equipes(team_id int, tricode, city, name)` ; `stats_joueurs(player_id, first_name, family_name)`.
  - `teams(id uuid, name, abbreviation, conference EAST|WEST, logo_url)` : équipes de l'appli (Highlightly).
- **Correspondance équipes** : `teams.abbreviation = stats_equipes.tricode` pour les 30 équipes (vérifié le 28/10, `CHANTIER_DONNEES_NBA.md`).
- **Scores reconstitués** : la somme des `pts` des joueurs par `(game_id, team_id)` **égale le score officiel** sur les 22 matchs comparables avec `matches.home_score/away_score` (22/22 identiques). Le score d'un match peut donc se reconstituer depuis les box scores.
- **Types de saison** : préfixes de `game_id` `001` = Pre Season, `002` = Regular Season (les matchs de poule NBA Cup en font partie, comme dans le classement officiel), `004` = Playoffs, `005` = PlayIn. Aucune finale NBA Cup (`006`) n'est présente en base.
- **Box scores = joueurs entrés en jeu seulement** : aucune ligne pour un joueur resté sur le banc ou absent (`minutes` jamais vide, min observé `0:01`). Conséquence : un joueur blessé depuis le début de saison n'apparaît dans aucun effectif.
- **`minutes` est du texte `"MM:SS"`** (ex. `"34:12"`) : à convertir, ne jamais trier ni agréger le texte.
- **Titulaire** : `position` non vide (`F`, `G`, `C`) = titulaire, vide = remplaçant (migration `20260824181500`). Observé : ~2 F, ~2 G et ~1,1 C par équipe et par match. Le léger surplus de C est à vérifier en lot 1 (§9, critère L1-5).
- **Performance** : la moyenne des joueurs d'une seule équipe calculée en direct prend **2,6 s** (balayage complet de `stats_box_scores` filtré sur `season`, 143 728 lignes). D'où D4 et l'index du §5.1.

## 5. Modèle de données (lot 1)

Une migration : `supabase/migrations/<AAAAMMJJHHMMSS>_stats_aide_debutants.sql`.

### 5.1 Index

```sql
create index stats_box_scores_season_idx on stats_box_scores (season);
```

### 5.2 Table `stats_team_form` (1 ligne par équipe et par saison)

| Colonne | Type | Calcul |
|---|---|---|
| `season` | text | ex. `2026-27` |
| `team_id` | integer | FK `stats_equipes.team_id` |
| `tricode` | text | `stats_equipes.tricode`, sert de jointure avec `teams.abbreviation` |
| `conference` | conference (enum) | depuis `teams` par `abbreviation = tricode` ; `null` si pas de correspondance |
| `games_played` | integer | nb de matchs de saison régulière avec un score reconstitué |
| `wins` / `losses` | integer | score de l'équipe > score adverse |
| `home_wins` / `home_losses` / `away_wins` / `away_losses` | integer | via `stats_matchs.home_team_id` / `away_team_id` |
| `pts_for_avg` / `pts_against_avg` | numeric(5,1) | moyennes des scores marqués / encaissés |
| `point_diff_avg` | numeric(5,1) | moyenne de (marqués − encaissés) |
| `last5_results` | text | `V`/`D` des 5 derniers matchs, **le plus récent en premier** (ex. `VVDVV`) ; moins de 5 caractères si moins de 5 matchs |
| `last5_wins` | integer | nb de `V` dans `last5_results` |
| `last5_point_diff_avg` | numeric(5,1) | écart moyen sur ces mêmes matchs |
| `streak_type` | char(1) | `V` ou `D` = résultat du dernier match |
| `streak_length` | integer | nb de matchs consécutifs identiques depuis le plus récent |
| `conference_rank` | integer | rang dans la conférence (§5.5) ; `null` si `conference` est nulle |
| `last_game_date` | date | date du dernier match pris en compte |
| `computed_at` | timestamptz | `now()` au rafraîchissement |

Clé primaire `(season, team_id)`. Une équipe sans aucun match n'a **pas de ligne**, et le front affiche alors l'absence de données.

### 5.3 Table `stats_player_season` (1 ligne par joueur et par saison)

| Colonne | Type | Calcul |
|---|---|---|
| `season` | text | |
| `player_id` | integer | FK `stats_joueurs.player_id` |
| `first_name` / `family_name` | text | copie de `stats_joueurs`, pour éviter une jointure à la lecture |
| `current_team_id` | integer | `team_id` de la ligne de box score **la plus récente** du joueur dans la saison (D2). Égalité de date impossible en pratique, mais départager par `game_id` décroissant |
| `games_played` | integer | **tous** ses matchs de saison régulière de la saison, toutes équipes confondues (D2) |
| `games_with_current_team` | integer | sous-ensemble joué avec `current_team_id` (sert au filtre « joueurs clés », §5.4) |
| `games_started` | integer | lignes avec `position` non vide |
| `minutes_avg` | numeric(4,1) | moyenne des minutes en décimal : `split_part(minutes,':',1)::int + split_part(minutes,':',2)::int / 60.0`, lignes au format inattendu ignorées (`minutes ~ '^\d+:\d{2}$'`) |
| `pts_avg`, `reb_avg`, `ast_avg`, `stl_avg`, `blk_avg`, `tov_avg`, `fg3m_avg` | numeric(4,1) | moyennes simples par match joué |
| `fgm`, `fga`, `fg3a`, `ftm`, `fta` | integer | **totaux** de la saison, gardés pour recalculer les pourcentages |
| `fg_pct`, `fg3_pct`, `ft_pct` | numeric(4,3) | `sum(made) / nullif(sum(attempted), 0)` : pourcentages **sur les totaux**, pas moyenne des pourcentages ; `null` si 0 tentative |
| `ts_pct` | numeric(4,3) | `sum(pts) / nullif(2 * (sum(fga) + 0.44 * sum(fta)), 0)`, recalculé sur les totaux (ne pas moyenner `stats_box_scores.ts_pct`) |
| `last5_games` | integer | nb de matchs pris en compte (≤ 5) |
| `last5_minutes_avg`, `last5_pts_avg`, `last5_reb_avg`, `last5_ast_avg` | numeric(4,1) | mêmes calculs sur ses 5 derniers matchs joués, toutes équipes confondues |
| `last_game_date` | date | |
| `computed_at` | timestamptz | |

Clé primaire `(season, player_id)`. Index `(season, current_team_id)` pour la lecture par équipe.

### 5.4 Règles d'affichage dérivées (côté TypeScript, D5, pas en base)

Elles sont à coder dans un module pur `lib/teamInsights/labels.ts`, testé unitairement. Les seuils sont des constantes exportées en tête de fichier.

**Étiquette de forme d'équipe**, sur `n = min(5, games_played)` et `w = last5_wins` :

| Condition | Étiquette | Code |
|---|---|---|
| `games_played < 3` | Début de saison | `DEBUT` |
| `w / n ≥ 0,8` | En feu | `EN_FEU` |
| `w / n ≥ 0,6` | En forme | `EN_FORME` |
| `w / n ≥ 0,4` | Irrégulière | `IRREGULIERE` |
| sinon | En difficulté | `EN_DIFFICULTE` |

Sur 5 matchs, ça donne : 5 ou 4 V → En feu, 3 V → En forme, 2 V → Irrégulière, 1 ou 0 V → En difficulté. L'étiquette ne dépend **que** des victoires, l'écart moyen étant affiché à côté.

**Mention « début de saison » (D3)** : affichée dans la popup tant que `games_played` de l'équipe est `< 10`.

**Tendance d'un joueur** (`EN_HAUSSE` / `EN_BAISSE` / `STABLE`), calculée seulement si `games_played ≥ 8` et `last5_games = 5`, sinon `null` (pas d'affichage) :
- `EN_HAUSSE` si `last5_pts_avg − pts_avg ≥ 3` **et** `last5_pts_avg ≥ 1,2 × pts_avg` ;
- `EN_BAISSE` si `pts_avg − last5_pts_avg ≥ 3` **et** `last5_pts_avg ≤ 0,8 × pts_avg` ;
- sinon `STABLE`.

**Joueurs clés** (les 3 mis en avant en haut de chaque équipe) :
1. filtre : `games_with_current_team ≥ max(1, ceil(0,5 × games_played de l'équipe))` ;
2. tri : `pts_avg` décroissant, puis `minutes_avg` décroissant ;
3. les 3 premiers.

**Liste complète de l'effectif** dans la popup : tous les joueurs dont `current_team_id` est l'équipe, triés par `minutes_avg` décroissant. Ceux qui ne passent pas le filtre « joueurs clés » restent listés, avec leurs matchs joués visibles pour que l'échantillon soit lisible.

**Titulaire habituel** : `games_started / games_played ≥ 0,5`.

### 5.5 Classement en conférence

Il est calculé dans la fonction de rafraîchissement, dans chaque conférence, avec : pourcentage de victoires décroissant, puis `point_diff_avg` décroissant, puis `tricode` (pour un ordre stable). Ce classement est **indicatif** : il n'applique pas les départages officiels de la NBA (confrontations directes, etc.). L'UI dit donc « 3e à l'Est » sans prétendre au classement officiel, et la popup porte une note « classement indicatif ».

### 5.6 Fonction de rafraîchissement

```sql
create or replace function public.refresh_stats_aide_debutants(p_season text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
```

- `p_season` nul : la saison retenue est la plus récente de `stats_matchs` ayant au moins un match `season_type = 'Regular Season'`.
- Périmètre : uniquement les `game_id` de `stats_matchs` avec `season = p_season` et `season_type = 'Regular Season'`.
- Écriture **dans une transaction** : `delete` des lignes de la saison dans les deux tables, puis `insert ... select`. Idempotente et rejouable.
- Retour : `{"season": "...", "teams": n, "players": n, "duration_ms": n}`.
- Droits : `revoke execute on function ... from public, anon, authenticated;` (une fonction Postgres est exécutable par `public` par défaut), puis `grant execute ... to service_role;`.
- Tables : `enable row level security` **sans policy**, comme les autres `stats_*`. La lecture passe par le client service côté serveur.
- La migration se termine par un premier remplissage : `select public.refresh_stats_aide_debutants();`.

## 6. Rafraîchissement automatique (lot 2)

Fichier `Cadrage/Stats/service/refresh_job.py`.

1. Ajouter `refresh_aide_debutants(trigger) -> bool`, qui appelle `rd.get_supabase_client().rpc("refresh_stats_aide_debutants", {}).execute()`.
2. Ordre dans `main()` : import (`rd.run`) → **`refresh_aide_debutants`** → `resolve_bets`. Même règle que la résolution : on rafraîchit si l'import est incomplet (`SystemExit`), mais **pas** si l'import a planté sur une exception.
3. **Un échec du rafraîchissement ne change pas le code de sortie** : ces données sont un confort, pas un bloquant. Il est tracé dans `sync_logs` via `_log_failure(f"[{trigger}] aide-debutants : ...")`, ce qui le rend visible du watchdog sans faire passer la VM en rouge.
4. Après un rafraîchissement réussi, invalider le cache Next (§7.3) avec `POST {APP_URL}/api/revalidate/team-insights` et `Authorization: Bearer {SYNC_SECRET}` (même secret et même patron que `resolve_bets` : `allow_redirects=False`, timeout court, ~15 s). Un échec est seulement journalisé, et le cache expirera tout seul (§7.3).
5. Tests dans `Cadrage/Stats/service/tests/test_refresh_job.py`, avec la fixture `wiring` existante :
   - l'ordre des appels est import → rafraîchissement → revalidation → résolution ;
   - un échec du RPC donne un code de sortie inchangé, une trace `sync_logs` et une résolution quand même lancée ;
   - après une exception d'import, il n'y a ni rafraîchissement ni résolution ;
   - après un import incomplet, il y a rafraîchissement et résolution.
6. **Action manuelle de l'utilisateur après merge** : mettre à jour la VM (`git pull` + `install.sh`, cf. `Cadrage/Stats/vm/DEPLOIEMENT_VM.md`). À rappeler dans la PR.

## 7. Côté appli Next (lots 3 et 4)

> Rappel `AGENTS.md` : Next 16 a des changements cassants. Lire
> `node_modules/next/dist/docs/` **avant** d'écrire le cache, la route ou
> l'invalidation (`revalidateTag` / `updateTag` / `"use cache"` : vérifier l'API
> réellement disponible dans la version installée, 16.2.12).

### 7.1 Indicateur de forme sur la carte (lot 3, données)

- `lib/queries/play.ts::getPlayUpcoming` lit **une fois** les lignes `stats_team_form` de la saison courante (≤ 30 lignes, client service, via la fonction de §7.2). Il ajoute à chaque équipe des `UpcomingMatchRow` (`homeTeam`, `awayTeam`) un champ :

```ts
export type TeamFormSummary = {
  record: { wins: number; losses: number };
  last5: ("V" | "D")[];          // plus récent en premier
  streak: { type: "V" | "D"; length: number };
  pointDiffLast5: number;
  label: "DEBUT" | "EN_FEU" | "EN_FORME" | "IRREGULIERE" | "EN_DIFFICULTE";
  conferenceRank: number | null;
  conference: "EAST" | "WEST" | null;
};
// sur l'équipe : form: TeamFormSummary | null   (null = pas de ligne → rien affiché)
```

- La jointure se fait par `TeamRef.abbreviation === stats_team_form.tricode`.
- **Ne pas modifier `TeamRef`** lui-même, partagé par de nombreux écrans (cf. commentaire §18.1 dans `play.ts`). Étendre le type de ligne `UpcomingMatchRow`, par exemple `homeForm` / `awayForm`.
- Si la lecture échoue, `form` vaut `null` partout : l'écran Jouer ne doit **jamais** casser à cause de cette fonctionnalité.

### 7.2 Module de lecture `lib/queries/teamInsights.ts` (lot 3)

`import "server-only"`, client service (même approche que `lib/queries/betStatLines.ts`).

```ts
export async function getTeamFormBySeason(): Promise<Map<string /* tricode */, TeamFormSummary>>;
export async function getTeamInsights(teamIds: string[] /* teams.id uuid, 1 ou 2 */): Promise<TeamInsightsResponse>;
```

```ts
export type PlayerSeasonLine = {
  playerId: number;
  name: string;                 // "Prénom Nom"
  gamesPlayed: number;
  gamesWithTeam: number;
  isUsualStarter: boolean;
  minutes: number; pts: number; reb: number; ast: number; stl: number; blk: number; fg3m: number;
  fgPct: number | null; fg3Pct: number | null; ftPct: number | null; tsPct: number | null;
  trend: "EN_HAUSSE" | "EN_BAISSE" | "STABLE" | null;
  joinedMidSeason: boolean;     // gamesWithTeam < gamesPlayed (transfert, D2)
};

export type TeamInsights = {
  teamId: string;               // uuid appli
  tricode: string;
  form: TeamFormSummary | null;
  home: { wins: number; losses: number } | null;
  away: { wins: number; losses: number } | null;
  ptsForAvg: number | null; ptsAgainstAvg: number | null; pointDiffAvg: number | null;
  earlySeason: boolean;         // games_played < 10 (D3)
  keyPlayers: PlayerSeasonLine[];   // ≤ 3, règle §5.4
  roster: PlayerSeasonLine[];       // tri minutes décroissant
};

export type TeamInsightsResponse = {
  season: string;
  updatedAt: string | null;     // max(computed_at), affiché « mis à jour le … »
  teams: TeamInsights[];        // même ordre que teamIds
};
```

Tests vitest (`lib/queries/teamInsights.test.ts` et `lib/teamInsights/labels.test.ts`) :
- tous les seuils de §5.4 testés à leurs bornes ;
- un joueur transféré apparaît dans sa nouvelle équipe avec ses stats complètes et `joinedMidSeason = true` ;
- une équipe sans ligne donne `form: null`, `roster: []` ;
- un tricode inconnu ne lève pas d'erreur.

### 7.3 Route pour la popup (lot 3)

`app/api/teams/insights/route.ts` — `GET /api/teams/insights?ids=<uuid>,<uuid>`

- **Session obligatoire** (même garde que les autres routes de l'espace connecté) : sinon `401`.
- Validation zod : 1 ou 2 uuid, sinon `400`. Des uuid inconnus renvoient `200` avec `form: null` et `roster: []`, jamais `500`.
- Cache serveur par paire d'équipes, étiqueté `team-insights`, avec une durée de vie maximale d'**1 h** en filet de sécurité.
- `app/api/revalidate/team-insights/route.ts` — `POST`, `Authorization: Bearer SYNC_SECRET` (même contrôle que `/api/resolve-bets`), invalide l'étiquette `team-insights` et la lecture de forme de §7.1.
- Rate limit : pas nécessaire en v1 (données publiques NBA, lecture seule, cache). Le noter dans la PR.

### 7.4 Composants (lot 4, fonctionnels, habillage minimal)

- `components/play/TeamFormIndicator.tsx` : reçoit `TeamFormSummary | null`, rend `null` si `null`. Affiche le bilan, les 5 derniers et l'étiquette. **Le rendu final sera décidé en session visuel.** Exiger seulement : un `aria-label` complet (ex. « Lakers : 7 victoires 2 défaites, 4 victoires sur les 5 derniers matchs, en feu ») et aucune information portée par la couleur seule.
- Placement : dans `components/play/UpcomingRow.tsx`, sous ou à côté de chaque équipe.
- `components/play/TeamDetailsButton.tsx` (client) : reprend **exactement** le patron de `components/regles/RuleHelpButton.tsx` (`useState`, `ModalDialog` porté vers `document.body`, cible tactile 44 px `--tap-target-min`). Libellé « Détail des équipes ».
  - Au **premier** clic, `fetch('/api/teams/insights?ids=…')`. Le résultat est gardé en mémoire du composant, pour qu'une réouverture ne refasse pas l'appel.
  - États : chargement, erreur (« Impossible de charger le détail, réessaie plus tard » + bouton Réessayer), vide (« Pas encore de match joué cette saison »).
  - Contenu : 2 onglets ou 2 colonnes (une par équipe, choix visuel ultérieur) ; pour chacune, résumé de forme, « mis à jour le … » (format `lib/dates`), mention « début de saison » si `earlySeason`, les 3 joueurs clés, puis l'effectif complet.
  - Libellés des stats en français avec une **légende débutant** (PTS = points, REB = rebonds, PD = passes décisives, 3PTS = paniers à 3 points, % tir…). Le vocabulaire de l'appli dit « pronostiquer », jamais « parier / miser ».
  - Focus piégé dans la popup et retour du focus sur le bouton à la fermeture (cf. `e2e/t-ui-01-focus-trap.spec.ts`).
- Mesure d'usage : enregistrer l'ouverture de la popup, sans donnée personnelle au-delà de l'identifiant déjà connu, via le mécanisme d'analytics existant le plus simple (Vercel Analytics `track`, à vérifier dans le code). Cela permettra de savoir si les débutants s'en servent.

## 8. Captures d'écran pour le réel

**But** : constituer, au fil des lots, la matière d'un réel Instagram qui explique la fonctionnalité. Les captures sont prises **par Claude Code**, rangées dans un dossier dédié et décrites dans un manifeste.

### 8.1 Dossier et nommage

```
Cadrage/docs/reel-aide-debutants/
├── CAPTURES.md          # manifeste (tableau, voir 8.4) — créé au lot 4
├── captures/            # PNG
└── enregistrements/     # vidéos d'écran faites par l'utilisateur (8.5)
```

- Nom de fichier : `NN-<lot>-<ecran>-<etat>.png`, en minuscules et sans accents. Exemple : `03-l4-popup-joueurs-cles.png`. `NN` est l'ordre de lecture dans le réel, pas l'ordre de prise.
- Une capture refaite **écrase** la précédente du même nom ; on ne garde pas de versions.
- PNG compressé (ex. `pngquant` ou `sharp`), **≤ 1,5 Mo** par fichier, pour ne pas alourdir le dépôt.

### 8.2 Méthode

- Script **dédié et non testé en CI** : `scripts/reel-captures/aide-debutants.mjs`, avec Playwright (déjà en dépendance). Il est lancé à la main, jamais depuis `npm test`.
- Cible : le serveur de dev local (`npm run dev`) branché sur le **Supabase local** (comme la suite e2e). **Aucune capture sur la prod**, aucun compte réel.
- Données : un seed local `scripts/reel-captures/seed-aide-debutants.mjs` qui insère :
  - les lignes `stats_team_form` / `stats_player_season` d'**un extrait de la prod** pour 4 équipes, lu **en lecture seule** (ou un JSON figé sous `scripts/reel-captures/fixtures/`) ;
  - 2 matchs à venir dans la compétition locale, choisis pour que le contraste se voie : une équipe « En feu » contre une équipe « En difficulté », et un match serré entre deux équipes « En forme ».
- Compte de démo : pseudo inventé (ex. `Demo_Panier`), **jamais** un vrai pseudo de joueur sans son accord. Aucune donnée personnelle visible.
- Format :
  - viewport mobile **390 × 844**, `deviceScaleFactor: 3` (PNG de 1170 × 2532), `isMobile: true`, `hasTouch: true` ;
  - **thème sombre** de l'appli (cohérent avec le fond de marque `#191F2A`) ;
  - langue `fr-FR`, fuseau `Europe/Paris` ;
  - heure système figée pour un affichage stable : la page doit montrer une **date et une heure réalistes**, cohérentes entre la carte et le bandeau (leçon du réel V2).
- Zones de sécurité Instagram (`Cadrage/docs/reel-v2-pack/README.md`) : l'élément montré (indicateur, bouton, popup) doit être **lisible hors des ~250 px du haut, ~400 px du bas et ~150 px de droite**, une fois l'image ramenée en 1080 × 1920. Si besoin, faire défiler avant la capture plutôt que recadrer.
- Rien qui ressemble à une image de match NBA. Les logos d'équipe affichés par l'appli sont acceptables ; pas de photos de joueurs (hors périmètre, §3).

### 8.3 Liste des captures à produire

| # | Lot | Fichier | Ce qu'on voit | Pourquoi dans le réel |
|---|---|---|---|---|
| 1 | avant L4 | `01-l0-carte-avant.png` | Carte de match **actuelle**, sans indicateur | Le « avant » : un débutant ne sait pas qui est favori |
| 2 | L4 | `02-l4-carte-forme.png` | Même carte avec l'indicateur de forme des deux équipes (En feu vs En difficulté) | L'info visible sans clic |
| 3 | L4 | `03-l4-liste-matchs-forme.png` | Écran Jouer complet, plusieurs cartes avec leurs indicateurs | Vue d'ensemble de la soirée |
| 4 | L4 | `04-l4-bouton-detail.png` | Gros plan sur le bouton « Détail des équipes » | Montrer où toucher |
| 5 | L4 | `05-l4-popup-chargement.png` | Popup en état chargement | Optionnel, transition |
| 6 | L4 | `06-l4-popup-resume-equipe.png` | Haut de la popup : bilan, rang en conférence, 5 derniers, écart | « La forme en un coup d'œil » |
| 7 | L4 | `07-l4-popup-joueurs-cles.png` | Les 3 joueurs clés d'une équipe | « Qui surveiller » |
| 8 | L4 | `08-l4-popup-effectif.png` | Effectif complet, titulaires repérés, une tendance « en hausse » visible | Profondeur de l'info |
| 9 | L4 | `09-l4-popup-autre-equipe.png` | Même vue pour l'équipe adverse | Comparer les deux |
| 10 | L4 | `10-l4-popup-legende.png` | La légende débutant des abréviations | « Même si tu n'y connais rien » |
| 11 | L4 | `11-l4-carte-apres-prono.png` | La carte après avoir validé un prono (vainqueur + écart) | La conclusion : pronostiquer en connaissance de cause |
| 12 | L4 | `12-l4-debut-saison.png` | Popup d'une équipe avec moins de 10 matchs, mention « début de saison » | Cas limite, utile pour le cadrage visuel aussi |

La capture 1 se prend **avant** de toucher à `UpcomingRow` (début du lot 4). Les captures 2 à 12 se prennent à la fin du lot 4. Elles seront **refaites** après la session visuel : relancer le script, qui écrase les fichiers.

### 8.4 Manifeste `CAPTURES.md`

Un tableau mis à jour à chaque passage du script, avec les colonnes : fichier · date de prise · commit (`git rev-parse --short HEAD`) · données utilisées (équipes, match) · remarque (ex. « habillage provisoire, à refaire après visuel »). Le script peut l'écrire lui-même.

### 8.5 À faire par l'utilisateur (hors Claude Code)

- **Enregistrements d'écran sur iPhone**, déposés dans `enregistrements/` : ouverture de l'écran Jouer → défilement des cartes → toucher « Détail des équipes » → défiler la popup → fermer → valider un prono. Faire des gestes lents, activer Ne pas déranger, avoir une batterie et une heure propres (mêmes consignes que le réel V2), sur une **vraie soirée de match** une fois en prod.
- Le plan du réel (durée, textes, musique) fera l'objet d'un document à part, sur le modèle de `Cadrage/docs/reel-v2-pack/cadrage/plan-reel-panier-ballon-v2.md`, une fois le visuel arrêté.

## 9. Découpage en lots et critères d'acceptation

- [ ] **L1 — Socle données** (`feat/aide-debutants-donnees`) — appliqué en prod le 05/11 (version 20261105085229) : L1-2, L1-3, L1-6 (69 ms), L1-7 OK ; restent L1-4 (bilans vs classement NBA) et L1-5 (titulaires C)
  - L1-1 Migration §5 (index, 2 tables, fonction, droits, premier remplissage).
  - L1-2 Après application : 30 lignes dans `stats_team_form` pour `2026-27`, et ~450 dans `stats_player_season`.
  - L1-3 Contrôle de cohérence : pour chaque équipe, `wins + losses = games_played` ; somme des `wins` = somme des `losses` = nombre de matchs de saison régulière de la saison.
  - L1-4 Contrôle contre les scores officiels : bilan V-D d'au moins 5 équipes identique au classement NBA du jour (vérifié par l'utilisateur ou par recherche web).
  - L1-5 Vérifier le surplus de titulaires `C` (~1,1 par équipe-match, §4) : explication trouvée ou ticket ouvert. Ça n'empêche pas le merge.
  - L1-6 `refresh_stats_aide_debutants()` < 2 s en prod (mesurer avec `explain analyze` sur une copie ou mesurer `duration_ms`).
  - L1-7 Un appel avec la clé `anon` ou `authenticated` est refusé (droits).
  - **Application en prod** : par l'utilisateur ou avec son accord explicite, via le MCP Supabase (CLI absente de la machine), puis `supabase migration list` réaligné (piège noté dans `REPRISE.md`).
- [ ] **L2 — Rafraîchissement VM** (`feat/aide-debutants-refresh`) : §6, tests pytest verts dans le job CI `python-import`. Après merge : mise à jour de la VM par l'utilisateur, puis contrôle de `computed_at` après le passage de 12h ou de 16h.
- [ ] **L3 — Lecture et API** (`feat/aide-debutants-api`) : §7.1 (données seulement, pas d'affichage), §7.2, §7.3, tests vitest verts, `npm run lint` et `tsc` sans nouvelle erreur (erreurs connues dans `Cadrage/docs/reel-v2-pack`, hors sujet).
- [ ] **L4 — Composants fonctionnels + captures** (`feat/aide-debutants-ui`) : §7.4 + §8. Le test e2e d'ouverture de la popup et de piège du focus passe. Captures 1 à 12 et `CAPTURES.md` dans la PR.
- [ ] **L5 — Session visuel** (à cadrer plus tard) : rendu définitif de l'indicateur et de la popup selon `SPEC_VISUELS_INSTAGRAM.md` et les tokens de l'appli, puis captures refaites.

## 10. Pièges connus (à relire avant chaque lot)

- `minutes` est du **texte** : ne jamais faire `max(minutes)` ni trier dessus (le tri alphabétique met `"9:56"` après `"34:12"`).
- Exclure explicitement la présaison : filtrer sur `season_type = 'Regular Season'`, **pas** seulement sur `season`.
- Pourcentages : toujours `sum(made) / sum(attempted)`, jamais `avg(pct)`.
- Un match importé partiellement fausserait un score : `collect_game()` n'écrit `stats_matchs` que pour un match complet. Toujours partir de `stats_matchs` et non directement de `stats_box_scores`.
- **Décalage horaire** : le poller VM met les résultats à jour dans la nuit, mais les box scores n'arrivent qu'à **12h** (et 16h). Le matin, la forme n'intègre donc pas encore les matchs de la nuit. D'où le « mis à jour le … » obligatoire dans la popup.
- Joueur absent de longue date (blessé) = absent de l'effectif (§4). L'assumer dans l'UI, par exemple avec une phrase discrète « joueurs ayant joué au moins un match cette saison ».
- `structureBet` et la file des paris ne sont **pas** concernés par ce chantier : ne rien y toucher.
- Une branche par PR ; le classificateur bloque les merges et les écritures en prod. Demander à l'utilisateur.

## 11. Points ouverts

1. **Blessures** : aucune source. Pistes à étudier plus tard : rapport officiel NBA des blessures, ou champ d'un fournisseur déjà utilisé (Highlightly ?). Ne pas coder sans décision.
2. **Playoffs** : garder les stats de saison régulière, ou basculer sur les stats de playoffs une fois la série lancée ?
3. **Seuils** (§5.4) : à valider sur les vraies données de la session visuel. Ils sont modifiables sans migration (D5).
4. **Finale NBA Cup** : absente de la base (aucun `006`). À confirmer si on veut l'afficher un jour ; pas de changement pour la v1.
5. **Matchs verrouillés / résultats** : faut-il aussi l'indicateur sur `LockedRow` ? À trancher avec le visuel.
6. **Photos des joueurs** : liée à la question p8-3 (usage commercial des données NBA).
