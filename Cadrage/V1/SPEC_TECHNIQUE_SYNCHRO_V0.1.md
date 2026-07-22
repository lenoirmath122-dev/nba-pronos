# NBA Pronos — SPEC TECHNIQUE T4 — SYNCHRO API V0.1

> **Nature** : fichier thématique T4 du découpage acté dans `SPEC_TECHNIQUE_V0.1.md`
> (§4). Couvre la couche de synchronisation avec l'API NBA réelle (Highlightly) :
> le client (C-1), le référentiel équipes, l'alimentation séries/matchs, les jobs
> de synchro, `sync_logs`, la couture avec le scoring (T5), et l'affichage live
> (Realtime). Ne contient **aucun moteur de scoring** (→ T5), **aucun écran** (→ T6).
>
> **Dépend de** : T1 (modèle), T3 (RLS — la synchro écrit en `service_role`, qui la
> contourne). Réutilise des décisions closes : 0.2.8 (données V1, mapping PENDING,
> synchro plusieurs fois/jour, verrouillage piloté par l'heure), et le **Bloc A de
> PREP_SPEC_TECHNIQUE_V1** (A6 Highlightly confirmé, A7 mapping en bloc, A8
> planificateur externe + heartbeat, A9 Realtime, B3 sync_logs, B4 logos, D6
> référentiel équipes indépendant, P2 service_role, P3 verrouillage par l'heure).
>
> **Statut** : **VALIDÉ** avec l'utilisateur le 18/07/2026. La réserve empirique
> initiale (branche A vs B de l'attache match → série, §5) a été **levée par le
> repérage API réel** (1 requête, §5.1) : **BRANCHE B confirmée** (l'API est
> match-centrique, aucun id de série exploitable). Les 6 points de §12 sont
> désormais tous actés, aucune réserve restante. Prochaine étape spec : T5
> (scoring).

---

## 0. Résumé du chantier T4

```text
1. LE point à sonder : forme d'un match de playoffs (id de série ?)   → §5
2. Architecture (modules C-1/C-2, planificateur externe, service_role) → §2
3. Client Highlightly : base URL, auth, timezone, SOMME du score       → §3
4. Référentiel équipes (GET /teams, global, logos hébergés)            → §4
5. Séries & matchs : structure admin + attache des matchs + mapping    → §5
6. Jobs : schedule (1x/j) / results (30-60min en fenêtre) / heartbeat  → §6
7. sync_logs + budget 100 req/jour                                     → §7
8. Couture scoring : « résultat changé → recalcul » (contrat vers T5)  → §8
9. Affichage live (Realtime) : ce que T4 pose, T6 consomme             → §9
```

Rien à coder tant que T4 n'est pas validé.

---

## 1. Décisions closes réutilisées (non rouvrables)

| Sujet | Décision | Source |
|---|---|---|
| Fournisseur | Highlightly, accès **direct** (pas RapidAPI), header `x-rapidapi-key` seul, base `https://nba.highlightly.net` | A6 |
| Fuseau | `timezone=America/New_York` sur **tout appel daté** ; la réponse garde `date` en UTC | A6 (Découverte 1) |
| Score | `state.score.homeTeam/awayTeam` = **tableau par quart-temps** → à **sommer** (4 valeurs, 5 en prolongation) | A6 (Découverte 2) |
| Rate limit | 100 req/jour, header `x-ratelimit-requests-remaining` | A6 |
| Référentiel équipes | GET /teams, **global**, synchronisé une fois, indépendant des compétitions | D6 |
| Logos | fournis nativement par équipe (GET /teams, champ `logo`), **hébergés en interne** (pas de hotlink) | B4 |
| Planificateur | **externe gratuit** (cron-job.org / GitHub Actions) appelant les routes de synchro par HTTP — pas de Cron Vercel | A8 |
| Fréquences | horaires 1×/jour ; résultats toutes les 30-60 min **seulement en fenêtre de match** | A8 |
| Anti-pause | job **heartbeat** léger, même planificateur, actif **toute l'année** | A8 |
| Live | **Supabase Realtime** (souscription client), pas de polling ; respecte la RLS | A9 |
| Mapping | ids internes stables + table de correspondance ; entité inconnue = **suggestion PENDING** jusqu'à confirmation admin (tracée) ; rien de PENDING n'entre dans le scoring/verrouillage | 0.2.8 §5 |
| Mapping en bloc | à l'ouverture du 1er tour, via l'écran `admin/competitions/new` pré-rempli des suggestions | A7 |
| Recalcul | synchro → un résultat a changé ? OUI → recalcul (idempotent) ; NON → rien | 0.2.8 §6 / 0.2.7 §7 |
| Verrouillage | piloté par l'**heure connue** du match, pas par la synchro | P3 / 0.2.8 §6 |
| service_role | réservé aux routes synchro/heartbeat/seed ; **contourne la RLS** | P2 |
| Écriture des données de jeu | `lib/sync/*` est le **seul** écrivain de teams/series/matches | C-2 |
| Appels API | `lib/nba/client.ts` est le **seul** appelant de l'API | C-1 |
| Box scores individuels | **hors périmètre V1** (vérif paris manuelle) | 0.2.8 §4 |

---

## 2. Architecture de la synchro

```text
Planificateur externe (cron-job.org / GitHub Actions)   ← hors app, gratuit
        │  appels HTTP authentifiés (secret partagé, §6)
        ▼
Routes /api/sync/* et /api/heartbeat   (App Router, runtime Node)
        │  utilisent service_role (P2, contournent la RLS)
        ▼
lib/sync/*   (SEUL écrivain de teams/series/matches — C-2)
        │  appelle
        ▼
lib/nba/client.ts   (SEUL appelant de l'API Highlightly — C-1)
        │
        ▼
sync_logs  (trace machine de chaque passe — B3)
        │
        └─(si un résultat a changé)→ signal de recalcul → moteur de scoring (T5, §8)
```

Principe : **une seule couche connaît la source** (le client C-1) ; **une seule
couche écrit les données de jeu** (lib/sync, C-2). Le reste de l'app ne voit que
des ids internes stables (0.2.8 §5) — c'est ce qui protège l'idempotence et rend
un changement de fournisseur indolore pour le scoring et les pronos figés.

---

## 3. Le client Highlightly (`lib/nba/client.ts`, C-1)

Signature indicative (l'implémentation vient après validation) :

```ts
// Seul module autorisé à appeler l'API (C-1). Clé lue côté serveur uniquement.
const BASE_URL = "https://nba.highlightly.net";

// Tout appel DATÉ passe timezone=America/New_York (A6, Découverte 1).
async function getMatchesByDate(date: string /* YYYY-MM-DD */): Promise<RawMatch[]>;
async function getTeams(): Promise<RawTeam[]>;

// SOMME du tableau par quart-temps (A6, Découverte 2). JAMAIS lire une valeur unique.
function sumQuarters(scoreArray: number[]): number; // 4 valeurs (5 en prolongation)
```

Règles du client :
- **Clé API** : `x-rapidapi-key` lu depuis une variable d'environnement **serveur**
  (jamais exposée au client). Un seul header, pas de `x-rapidapi-host` (accès direct, A6).
- **Fuseau** : `timezone=America/New_York` ajouté systématiquement aux appels
  datés. Le `date` renvoyé reste UTC → la conversion en heure locale d'affichage
  est côté écran (T6), pas ici.
- **Score** : le client **somme** le tableau par quart-temps avant de renvoyer un
  entier ; `home_score`/`away_score` (T1) stockent ce total. La gestion de la
  prolongation (5ᵉ élément) est incluse dans la somme (somme de tous les éléments).
- **Rate limit** : le client lit `x-ratelimit-requests-remaining` sur chaque
  réponse et le remonte à l'appelant (pour alimenter `sync_logs.requests_remaining`,
  §7). Si le quota est proche de 0, il journalise un avertissement (pas de blocage
  dur en V1 — 100/jour est large, §7).
- **Erreurs** : toute erreur (réseau, 4xx/5xx, JSON inattendu) est **capturée**,
  journalisée dans `sync_logs` (success=false + résumé), et **n'écrit rien** —
  une synchro ratée laisse la base dans son état précédent (jamais de données
  partielles). Le verrouillage étant piloté par l'heure (P3), une synchro
  manquée ne déverrouille ni ne reverrouille rien.

---

## 4. Référentiel des équipes (`GET /teams`, D6 / B4)

```text
- Job dédié /api/sync/teams, lancé UNE FOIS (hors compétition, D6), ré-exécutable
  à la demande (idempotent : upsert par mapping source→interne).
- Pour chaque équipe source : upsert dans teams (name, abbreviation, conference),
  et upsert du mapping TEAM (entity_mappings : internal_id ↔ source_ref,
  source_type='HIGHLIGHTLY', status='CONFIRMED' — les 30 équipes NBA sont
  déterministes, confirmation directe **actée**).
- Logos (B4) : le champ `logo` de chaque équipe est TÉLÉCHARGÉ et hébergé en
  interne (**bucket Supabase Storage dédié, public en lecture — acté**), puis
  teams.logo_url pointe vers l'URL interne — pas de hotlink vers highlightly.net.
```

Le référentiel est **global et persistant** : il ne fait pas partie du cycle de
vie d'une compétition, ne subit aucun wipe (rétention D2), et sert de cible aux
FK `favorite_team_id`, `team1_id`, etc.

> **Amendement 21/07/2026 (logos)** — le paragraphe « Logos » ci-dessus (téléchargement
> + bucket Supabase Storage + `teams.logo_url` → URL interne) est **remplacé** par des
> **SVG bundlés** dans `public/logos/teams/` (un fichier par franchise, nommé
> `teams.abbreviation` en MAJUSCULES), qui deviennent la **source unique** de
> l'affichage. `/api/sync/teams` **n'implémente pas** l'étape de téléchargement des
> logos ; `teams.logo_url` reste en base (upsert inchangé) mais **n'est pas lu** pour
> l'affichage (fallback théorique seulement — fallback réel = abréviation en texte).
> Motif : 30 franchises stables, rendu net, pas de round-trip bucket. Le *sourcing des
> logos* était explicitement un point d'itération ouvert de la synthèse — ce n'est donc
> pas une réouverture d'une décision figée. Le texte original du paragraphe « Logos »
> est conservé ci-dessus pour traçabilité ; c'est cet amendement qui prévaut.

---

## 5. Séries & matchs — le point délicat (repérage empirique en attente)

**Ce que l'API fournit à coup sûr** (A6) : des **matchs** (équipes, date/heure,
statut, score par quart-temps) et le **référentiel équipes**. Box scores hors
périmètre (0.2.8 §4).

**Ce que l'API ne fournit peut-être pas** : une notion de **série** de playoffs
(best-of-7, tour, numéro de match). Le test A6 a validé `/teams` et l'existence
de `/matches`, **pas la forme d'un match de playoffs**. D'où le repérage à faire.

### 5.1 Repérage effectué (1 requête, 18/07/2026)
```text
GET /matches sondé sur une date de playoffs passée (timezone=America/New_York),
payload d'un match inspecté : AUCUN identifiant de série / de tour / de game
number exploitable. → BRANCHE B retenue (§5.2).

Trouvailles complémentaires du repérage (client, §3) :
- Réponse enveloppée dans un champ "data" (pas un tableau nu en racine).
- /matches?date renvoie TOUTES les ligues confondues (pas seulement NBA) → le
  client DOIT filtrer league="NBA" explicitement, sinon des matchs d'autres
  ligues (ex. NCAA) sont ingérés par erreur.
- Le statut du match se lit dans state.description (pas un champ status/state
  à plat).
```

### 5.2 Branche retenue (confirmée par le repérage)
```text
BRANCHE B — l'API n'expose que des matchs (pas de série) :
  → la STRUCTURE des séries reste ADMIN (l'écran admin/competitions/new crée les
    8 affiches du 1er tour, A7). Un match synchronisé est rattaché à sa série
    interne par HEURISTIQUE (paire d'équipes non ordonnée + tour + fenêtre de
    dates), proposée puis CONFIRMÉE par l'admin (rien de PENDING n'entre dans le
    scoring, 0.2.8 §5). Le mapping MATCH (source match id ↔ internal match id)
    reste dans tous les cas.
```

> Branche A (id de série exploitable côté API) écartée : le repérage réel ne l'a
> pas trouvée. Le client (§3) devra donc gérer l'enveloppe `data`, le filtre
> `league="NBA"` et la lecture du statut via `state.description`.

### 5.3 Ce qui est commun aux deux branches
```text
- Le mapping MATCH est toujours présent (source match id ↔ internal id).
- Une entité non rapprochée reste PENDING : aucun scoring, aucun verrouillage,
  aucune écriture de jeu ne s'appuie dessus (0.2.8 §5 — règle de sûreté).
- Le VAINQUEUR / FORMAT / STATUT de série ne sont PAS lus comme un objet API : ils
  sont DÉRIVÉS des résultats de matchs (par le scoring T5) et/ou fixés par l'admin
  (0.2.7 §4, cascade d'annulation A2). L'API alimente les MATCHS ; la série est un
  agrégat interne.
- NBA Cup : une « série » = 1 match (T1). Une affiche Cup rattache donc 1 match
  synchronisé. Pas de traitement spécial au-delà des libellés de tour (CUP_*).
```

---

## 6. Les jobs de synchro (routes + fréquences A8)

Toutes ces routes tournent en **runtime Node**, utilisent **service_role** (P2,
contournent la RLS), et sont **authentifiées par un secret partagé** (le
planificateur externe envoie un jeton ; la route le vérifie contre une variable
d'env — sinon n'importe qui sur Internet pourrait déclencher une synchro).
**Acté : header Bearer + `SYNC_SECRET` en env, vérifié par la route.**

| Route | Fréquence (A8) | Rôle |
|---|---|---|
| `/api/sync/teams` | à la demande (rare) | référentiel équipes + logos (§4) |
| `/api/sync/schedule` | 1×/jour | horaires : upsert `scheduled_at`/statut des matchs à venir (fenêtre de N jours) ; crée/attache les matchs aux séries (§5) ; marque PENDING l'inconnu |
| `/api/sync/results` | 30-60 min **en fenêtre de match** | scores (somme du tableau) + statuts ; détecte les changements → signal de recalcul (§8) |
| `/api/heartbeat` | toute l'année | ping DB léger anti-pause Supabase (A8) ; **pas** d'appel API |

Notes :
- **Fenêtre de match** (`/api/sync/results`) : le planificateur ne déclenche cette
  route qu'aux plages où un match de la compétition active est en cours ou imminent
  (pas 24h/24). Le découpage horaire exact est une config du planificateur externe,
  pas du code. **Acté : horizon de 4 jours pour `/schedule`** (fenêtre 3 j + marge).
- **Idempotence** : rejouer `/schedule` ou `/results` sur le même état ne change
  rien (upsert par id, jamais de doublon ; une prédiction figée n'est jamais
  touchée — 0.2.2/0.2.3). C'est ce qui rend la synchro rejouable sans risque.
- **Heartbeat** : une simple requête (`select 1` ou lecture triviale) suffit à
  réinitialiser le compteur d'inactivité de 7 jours de Supabase (A8).

---

## 7. `sync_logs` (B3) & budget de requêtes

```text
Chaque passe écrit une ligne sync_logs (table T1) :
  sync_type (TEAMS/SCHEDULE/RESULTS/HEARTBEAT), competition_id (NULL pour TEAMS/
  HEARTBEAT), endpoint, success, summary (résumé de la réponse), requests_remaining
  (issu du header, §3), created_at.
Réservé au DIAGNOSTIC, non public (RLS : admin only, T3). Pas de purge auto (B3).
```

**Budget 100 req/jour (A6)** — vérification que le design tient :
```text
- /teams      : ~1 requête, très rare (référentiel).
- /schedule   : ~1 requête/jour (1 appel /matches par date d'horizon, ou quelques-uns).
- /results    : ~1 requête par déclenchement ; toutes les 30-60 min UNIQUEMENT en
                fenêtre de match. Ex. fenêtre de 5h, toutes les 30 min = ~10/jour.
- /heartbeat  : 0 requête API (ping DB).
Total en journée de matchs : ordre de 10-15 requêtes → LARGEMENT sous 100/jour.
requests_remaining est suivi dans sync_logs pour alerter si on s'en approche.
```

---

## 8. Couture avec le scoring (contrat vers T5)

```text
Règle (0.2.8 §6 / 0.2.7 §7) :
  /api/sync/results compare le résultat fraîchement lu à l'état en base.
  - Un score ou un statut de match a CHANGÉ (notamment passage à FINISHED) ?
      → déclenche le RECALCUL idempotent pour les entités affectées.
  - Rien n'a changé ?
      → aucun recalcul (on ne rejoue pas pour rien).
```

Contrat (ce que T4 garantit / ce que T5 fournit) :
- **T4 fournit** : des données officielles figées et à jour (matches.home_score/
  away_score sommés, matches.status, et la détection « a changé »), + le **signal**
  de recalcul pour les matchs/séries touchés.
- **T5 fournit** : le moteur `recompute(...)` idempotent qui, appelé avec ce
  signal, rejoue le barème 0.2.5 sur données officielles + prédictions figées.

**Acté : appel direct de la fonction de recalcul depuis `lib/sync`** (plus simple,
transactionnel) ; la forme exacte de la fonction appartient à T5.

> Ce qui compte pour T4 : la synchro **détecte le changement** et **déclenche** ;
> le *comment* du recalcul est le cœur de T5.

---

## 9. Affichage live (A9 — Supabase Realtime)

```text
- On ACTIVE la publication Realtime sur les tables matches (et series si utile) :
  quand /api/sync/results écrit un nouveau score/statut, les clients abonnés
  reçoivent le changement immédiatement (A9) — pas de polling.
- Realtime respecte NATIVEMENT la RLS (A9) : un client ne reçoit que les
  changements de lignes qu'il a le droit de lire. matches/series étant publics
  (T3), tout le monde reçoit les mises à jour de score — ce qui est voulu.
- Ce que T4 pose : l'activation de la publication Realtime côté base.
- Ce que T6 consomme : la souscription côté client + la micro-animation « donnée
  qui vient de changer » (B7). Hors T4.
```

---

## 10. Ce que T4 ne dit pas

```text
- Le moteur de scoring idempotent lui-même (barème 0.2.5)        → T5.
- Les écrans (fenêtre de pronos live, cartes de match, admin)     → T6.
- La config exacte du planificateur externe (horaires cron-job.org
  / workflow GitHub Actions)                                      → mise en place
  au déploiement (hors code applicatif, A8).
- Le seed du 1er admin (A4)                                       → migration au déploiement (T2).
```

---

## 11. Plan de test T4 (API + synchro)

Comme pour T3, un plan concret — mais ici certains tests **consomment le quota**
(marqués 🔸), donc à jouer avec parcimonie.

```text
CLIENT (lib/nba/client.ts)
1. 🔸 getTeams() sur l'API réelle → 30 équipes, chaque logo présent. (1 req)
2. 🔸 getMatchesByDate() sur une date de playoffs passée AVEC timezone=America/
   New_York → le match attendu apparaît au bon jour NBA (revalide Découverte 1). (1 req)
3. Sur la réponse du test 2 : sumQuarters(scoreArray) == score final réel connu
   (revalide Découverte 2, la SOMME). (0 req, sur données déjà en main)
4. 🔸 Repérage §5.1 : inspecter le payload d'un match de playoffs (id de série ?)
   → choisit la branche A ou B. (1 req) — FAIT, branche B confirmée (§5.1).

SYNCHRO (lib/sync/*, en base de test)
5. /api/sync/teams deux fois de suite → état identique (idempotence, upsert). 0 doublon.
6. Une équipe source inconnue → mapping PENDING, aucune donnée de jeu ne s'appuie
   dessus (0.2.8 §5).
7. /api/sync/results sur un match passé de SCHEDULED→FINISHED → home/away_score
   sommés corrects, statut FINISHED, ET signal de recalcul émis (§8).
8. Rejouer /api/sync/results sans changement → AUCUN recalcul déclenché.
9. Vérifier qu'une prédiction figée n'est jamais modifiée par une synchro (0.2.3).
10. sync_logs : chaque passe écrit une ligne (success + requests_remaining).

SÉCURITÉ / ROBUSTESSE
11. Appel d'une route /api/sync/* SANS le secret → refus (401/403), aucune écriture.
12. Simuler une erreur API (clé invalide) → sync_logs success=false, base inchangée.
13. /api/heartbeat → ping DB OK, 0 requête API consommée.
```

---

## 12. Décisions actées à la validation de T4 (18/07/2026)

```text
1. [REPÉRAGE — FAIT] Sondage §5.1 (1 requête) mené le 18/07/2026 : l'API
   n'expose aucun id de série exploitable → BRANCHE B retenue (séries admin +
   attache par heuristique). Trouvailles complémentaires actées : enveloppe
   "data", filtre league="NBA" obligatoire, statut via state.description (§5.1).

2. [SECRET SYNCHRO] Routes /api/sync/* et /api/heartbeat authentifiées par Bearer
   + variable d'env SYNC_SECRET, vérifié par la route. ACTÉ.

3. [LOGOS] Téléchargés au sync /teams, hébergés dans un bucket Supabase Storage
   (public en lecture), teams.logo_url → URL interne (B4, pas de hotlink). ACTÉ.
   > **Amendement 21/07/2026** : mécanique remplacée par des **SVG bundlés** dans
   > `public/logos/teams/` (clé = `teams.abbreviation`), source unique d'affichage ;
   > l'étape de téléchargement de `/api/sync/teams` n'est pas implémentée ;
   > `teams.logo_url` reste en base mais n'est pas lu pour l'affichage (fallback
   > théorique seulement). Voir détail §4. N'amende pas le reste du point 3 (bucket
   > non créé, décision devenue sans objet pour les logos).

4. [ÉQUIPES] 30 mappings TEAM confirmés automatiquement (référentiel NBA
   déterministe), pas de revue admin. ACTÉ.

5. [HORIZON /schedule] Fenêtre d'horizon des horaires = 4 jours (3 j de fenêtre de
   pronos + 1 j de marge). ACTÉ.

6. [SIGNAL RECALCUL] Appel direct de la fonction de recalcul depuis lib/sync ;
   décision finale portée à T5. ACTÉ.
```

**T4 est VALIDÉ et figé**, sans réserve restante (le point 1, branche A/B, a été
levé par le repérage §5.1). T4 ne produit **aucune migration** ; l'implémentation
(client, lib/sync, routes) viendra après T5. Prochaine spec : **T5 (scoring)** —
qui consomme le signal de recalcul de T4 — puis T6 (écrans + Realtime + server
actions).
