# NBA Pronos — SPEC TECHNIQUE T6a — ARCHITECTURE NEXT V0.1 (a : arbre, route groups, données)

> **Nature** : première des trois sous-specs de **T6** (découpage acté le
> 19/07/2026 : **T6a** arbre `app/` + route groups + stratégie de données ; **T6b**
> server actions joueur + garde-fou C2, puis actions admin ; **T6c** Realtime +
> rendu des états actés). T6a pose le **squelette** : arborescence App Router, les
> trois zones (public / connecté / admin), la stratégie de lecture, la frontière
> d'écriture, la protection des routes. Elle **ne contient aucun corps de server
> action** (→ T6b), **aucune souscription Realtime ni rendu d'état** (→ T6c),
> **aucun design token** (→ T7).
>
> **Dépend de** : T1 (modèle), T2 (auth/session), T3 (RLS/visibilité), T4 (routes
> de synchro, `writeSeriesOutcome`), T5 (moteur `recompute*`). Réutilise des
> décisions closes : maître §3 (P1/P2/P11/P12/P13), §5 (contrats C-4/C-5/C-6),
> 0.2.9 (navigation et inventaire des écrans), 0.2.1/0.2.6 (visibilité), et les
> deux arbitrages de session validés le 19/07/2026 : **stratégie de données
> (reco 1)** et **frontière d'écriture — Option A (reco 2)**.
>
> **Statut** : **VALIDÉ** avec l'utilisateur le 19/07/2026. Le seul point ouvert à
> la rédaction (partage public/connecté des écrans classement & bracket) est **acté**
> (§8) et a le même statut non rouvrable que les décisions de T1-T5. Prochaine
> sous-spec : T6b (corps des server actions joueur + garde-fou C2, puis actions
> admin et journalisation).
>
> **Périmètre** : structure et flux de données de **toute** la V1 (Playoffs + NBA
> Cup, joueur + visiteur + admin). Mobile d'abord (0.2.9 §1).

---

## 0. Résumé du chantier T6a

```text
1. Stratégie de données : rendu serveur, RLS seule autorité, Realtime en surcouche → §2
2. Les 3 clients Supabase (browser / server-session / privilégié)                  → §2.4
3. Route groups & arbre app/ mappés aux écrans 0.2.9                               → §3
4. Protection des routes (proxy, gardes de zone, DISABLED)                          → §4
5. Frontière d'écriture (Option A) : joueur / admin-système / système-externe       → §5
6. writeSeriesOutcome : point d'écriture unique de series.official_* (C-2/T5 §12)   → §5.2
7. Ce que T6a ne dit pas (→ T6b, T6c)                                              → §6
8. Plan de test T6a + point à valider                                              → §7/§8
```

Rien à coder tant que T6a n'est pas validé.

---

## 1. Décisions closes réutilisées (non rouvrables)

| Sujet | Décision | Source |
|---|---|---|
| RLS = seule autorité de visibilité | le code choisit **quoi afficher**, jamais **ce qu'il a le droit de lire** | P1 / C-6 |
| Composants **serveur** par défaut | `"use client"` seulement pour interaction ou Realtime | P12 |
| `service_role` restreint | jamais dans un composant ni une action joueur ; réservé synchro/heartbeat/seed **et** (reco 2, Option A) module privilégié d'écriture système déclenché par l'admin | P2 + reco 2 |
| Écritures | joueur = **server actions** (session user) ; système externe = **routes API** (secret) | P13 / C-4 |
| Lectures publiques (RLS `true`) | `users`, `teams`, `competitions`, `series`, `matches`, `competition_archives` | T3 §4 |
| Lectures gardées | `match_predictions` (« valider = voir »), `brackets`/`bracket_picks` (après deadline), `bets` (public à la deadline) | T3 §4 |
| Vues classement | `user_scores` / `user_recent_form`, `security_invoker` | D4 / C-5 |
| Session | anon + JWT ; rôle/statut en base, pas dans le JWT (promotion sans re-login) | T2 §7 |
| Navigation | 4 onglets Accueil / Jouer (hub) / Classement / Profil ; visiteur = nav réduite | 0.2.9 §3 |
| `writeSeriesOutcome` | **point d'écriture unique** de `series.official_*`, dans `lib/sync` | T5 §12.1/§12.2 |
| Recalcul | `recompute*` en contexte système ; jamais une action joueur | T5 §10 |

---

## 2. Stratégie de données (reco 1, actée)

### 2.1 Principe : rendu serveur, RLS arbitre

```text
- Chaque écran est rendu par un COMPOSANT SERVEUR qui lit la donnée via la SESSION
  utilisateur (clé anon + JWT en cookie). La RLS (T3) filtre : le composant reçoit
  déjà exactement ce que l'acteur a le droit de voir — visiteur, joueur ou admin.
- Le composant ne RE-FILTRE jamais pour la sécurité (P1/C-6). Il peut choisir la
  MISE EN FORME (masquer un panneau, agréger en %), jamais l'autorisation.
- Conséquence directe : un MÊME composant de lecture sert le visiteur et le joueur ;
  la différence de contenu vient de la RLS, pas d'un `if (role === ...)`.
```

### 2.2 Realtime en surcouche, pas source de rendu

```text
- Le rendu INITIAL est serveur (SSR), fidèle à l'instant de la requête.
- Sur les seuls écrans LIVE (carte de match, drill-down série, live des pronos qui
  se dévoilent), un composant client s'abonne à Supabase Realtime (A9, détail en
  T6c) et met à jour son ÉTAT LOCAL à réception d'un changement.
- Realtime NE DÉCLENCHE PAS de revalidation serveur (`revalidatePath`). On évite
  ainsi le double affichage (SSR + refetch) et un aller-retour serveur inutile :
  la donnée live vit dans l'état client, le SSR reste le point de départ.
- Realtime respecte nativement la RLS (A9) : un client ne reçoit que les lignes
  qu'il a le droit de lire. Rien à re-garder côté client.
```

### 2.3 Cache Next.js & revalidation

```text
- Les pages qui dépendent de la session (donc de cookies) sont rendues en DYNAMIQUE
  (pas de mise en cache statique d'une vue par-utilisateur). C'est le comportement
  attendu dès qu'on lit les cookies de session.
- Après une ÉCRITURE joueur (server action, T6b), on appelle un `revalidatePath`
  CIBLÉ sur les routes impactées (ex. après validation d'un prono → revalider
  /jouer/matchs et /accueil). Revalidation ciblée, jamais globale.
- Les écritures SYSTÈME (synchro, recompute) ne revalident rien côté Next : leur
  effet visible passe par Realtime (écrans live) et par le prochain rendu serveur.
```

### 2.4 Les trois clients Supabase (frontière P2 matérialisée)

```ts
// lib/supabase/*  — un client par CONTEXTE, jamais mélangés.

// 1. Navigateur (composants client) : clé anon, session en cookie. Lecture +
//    souscription Realtime. JAMAIS d'écriture privilégiée.
//    → createBrowserClient (@supabase/ssr)
export function getBrowserClient(): SupabaseClient;

// 2. Serveur en SESSION UTILISATEUR (composants serveur + server actions joueur/
//    admin non privilégiées) : clé anon + JWT lu des cookies. La RLS s'applique.
//    → createServerClient (@supabase/ssr), lié aux cookies de la requête
//    Correctif post-validation : `cookies()` est asynchrone depuis Next.js 15/16
//    (AGENTS.md) → signature ASYNC, pas synchrone comme écrit initialement.
export async function getServerClient(): Promise<SupabaseClient>;

// 3. Serveur PRIVILÉGIÉ (service_role, CONTOURNE la RLS). Réservé à :
//    - les routes /api/sync/* et /api/heartbeat (planificateur externe, T4) ;
//    - le module d'écriture système déclenché par l'admin (Option A, §5).
//    Clé service_role lue en env SERVEUR uniquement, jamais exposée au client.
//    → createClient avec la service key ; import INTERDIT côté "use client"
export function getServiceClient(): SupabaseClient;
```

> **Garde-fou de build** : `getServiceClient` vit dans un module marqué
> `server-only` (import interdit dans un composant client → erreur de compilation).
> C'est la matérialisation de P2 : impossible d'exposer `service_role` au navigateur
> par mégarde.

---

## 3. Route groups & arborescence `app/`

Trois **route groups** (parenthèses → n'affectent pas l'URL), chacun avec son
**layout** (donc sa navigation) :

```text
(public)  → visiteur non connecté + pages d'auth. Nav RÉDUITE (0.2.9 §3).
(app)     → joueur connecté. Nav 4 onglets. Garde : session requise (§4).
(admin)   → hub admin. Garde : session + is_admin() (§4).
```

Arbre (les écrans viennent de 0.2.9 ; les libellés d'URL sont en anglais — P11) :

> **Correctif post-validation (session du 19/07/2026, implémentation)** : l'arbre
> original plaçait `leaderboard/page.tsx` (et `bracket/page.tsx`) à la fois dans
> `(public)/` et dans `(app)/`. Les route groups étant invisibles dans l'URL, les
> deux fichiers auraient résolu la **même route `/leaderboard`** — erreur de build
> Next.js documentée (« Conflicting paths », route-groups.md), jamais testée avant
> le codage puisque T6a n'avait produit aucun code. Corrigé en **route physique
> unique, hors des deux groupes** (`app/leaderboard/page.tsx`, `app/bracket/page.tsx`)
> — la nav (réduite vs 4 onglets) est choisie côté serveur selon la présence d'une
> session, à l'intérieur de cette route unique. Aucune règle de lecture/RLS/rendu
> déjà actée n'est modifiée par ce correctif : seul l'emplacement physique de 2
> fichiers change, conformément à l'esprit déjà posé par §3.2 (un seul module de
> lecture + un seul composant de rendu, pas de duplication) — poussé jusqu'à une
> seule route au lieu de deux enveloppes.

```text
app/
├─ layout.tsx                      # racine : thème (0.2.9 §2, DARK défaut), providers
├─ proxy.ts                        # (à la racine du repo) session + gardes (§4) — AGENTS.md :
│                                  # middleware.ts renommé proxy.ts en Next.js 16 (export `proxy`)
├─ leaderboard/page.tsx            # classement, PUBLIC + connecté, route UNIQUE — voir §3.2 (corrigé)
├─ bracket/page.tsx                # bracket global, PUBLIC + connecté, route UNIQUE — voir §3.2 (corrigé)
│
├─ (public)/
│   ├─ layout.tsx                  # nav réduite (Classement · Bracket · Se connecter)
│   ├─ login/page.tsx              # connexion (T2)
│   ├─ signup/page.tsx             # inscription pseudo+email+password+code (T2 §4)
│   └─ reset-password/page.tsx     # reset Supabase standard (T2 §8)
│
├─ (app)/
│   ├─ layout.tsx                  # nav 4 onglets ; garde session (§4)
│   ├─ home/page.tsx               # Accueil : « À traiter » (tri urgence) + « Ça vient de tomber »
│   ├─ play/
│   │   ├─ page.tsx                # hub Jouer (pastilles « à faire » par univers)
│   │   ├─ matches/page.tsx        # fenêtre 3 j, saisie vainqueur+écart, « Tout valider »
│   │   ├─ bracket/page.tsx        # remplissage tour par tour + consultation (le MIEN, distinct du global)
│   │   ├─ bets/page.tsx           # création de pari + « Mes paris » (annulés barrés → T6c)
│   │   └─ my-predictions/page.tsx # « Mes pronos » : historique + en cours/verrouillés
│   └─ profile/page.tsx            # profil, préférences, thème, lien Admin si ADMIN
│
├─ (admin)/
│   └─ admin/
│       ├─ layout.tsx              # hub admin ; garde is_admin() (§4)
│       ├─ page.tsx                # tableau de bord admin (compteurs par file) + bouton Recalculer
│       ├─ validation/page.tsx     # file de validation (paris SOUMIS)
│       ├─ resolution/page.tsx     # file de résolution (paris échus → Gagné/Perdu)
│       ├─ requests/page.tsx       # file des requêtes de correction (joueur → admin)
│       ├─ players/page.tsx        # gestion joueurs (promouvoir/désactiver/réactiver/rétrograder)
│       ├─ logs/page.tsx           # consultation des audit_logs (filtrable, lecture seule)
│       └─ competitions/
│           ├─ page.tsx            # liste des compétitions
│           └─ new/page.tsx        # création (join_code, 8 affiches, mapping A7)
│
└─ api/
    ├─ sync/
    │   ├─ teams/route.ts          # (T4) service_role + secret partagé
    │   ├─ schedule/route.ts       # (T4)
    │   └─ results/route.ts        # (T4) → déclenche recomputeMatch (T5 §10)
    └─ heartbeat/route.ts          # (T4) anti-pause Supabase
```

### 3.1 Layouts et navigation (0.2.9 §3)

```text
(public)/layout : nav réduite — Classement, Bracket, bouton « Se connecter ».
                  Pas de hub Jouer, pas d'Accueil personnel.
(app)/layout    : barre 4 onglets Accueil · Jouer · Classement · Profil (mobile
                  d'abord). Le bloc « À traiter (admin) » de l'Accueil (0.2.9 §3)
                  n'apparaît que si is_admin() — c'est une SECTION conditionnelle
                  de home/, pas une route.
(admin)/layout  : hub admin distinct (0.2.9 §8), atteint depuis Profil (lien visible
                  si ADMIN) — ce n'est pas un 5e onglet.
```

### 3.2 Écrans publics vs connectés partagés (classement, bracket)

Le classement et le bracket global existent **pour le visiteur et pour le joueur**,
avec la **même donnée filtrée par la RLS** mais une **nav différente** (réduite vs
4 onglets). Pour éviter toute divergence :

```text
- La LECTURE vit dans un module partagé (ex. lib/queries/leaderboard.ts,
  lib/queries/bracketOverview.ts), appelé avec getServerClient()
  (la RLS applique la session : un visiteur voit le public, un joueur voit en plus
  ses propres lignes / le drill-down autorisé).
- Le RENDU vit dans un composant présentiel partagé (ex. components/leaderboard/*,
  components/bracket/*).
- app/leaderboard/page.tsx et app/bracket/page.tsx sont une ROUTE PHYSIQUE UNIQUE
  (corrigée §3, hors des deux route groups — deux fichiers y résolvant la même URL
  auraient été une erreur de build Next.js) : ce sont des ENVELOPPES FINES qui
  composent le même module + le même composant, et choisissent elles-mêmes la nav
  à rendre (réduite ou 4 onglets) selon la présence d'une session.
=> Une seule logique de lecture, de rendu ET de route. Pas de duplication de règle,
   pas de risque que public et connecté divergent.
```

> Le seuil « tendances en % au-delà de 10 brackets, nombre brut en dessous » (0.2.6
> §4 / 0.2.9 §5) et le drill-down nominatif au clic sont une **couche de rendu**
> au-dessus de la donnée RLS (T6c), pas une affaire de route.

---

## 4. Protection des routes

### 4.1 `proxy.ts` (racine)

> **Correctif post-validation** : Next.js 16 déprécie `middleware.ts` au profit de
> `proxy.ts` (export nommé `proxy`, comportement identique — AGENTS.md). Rôle et
> logique ci-dessous inchangés, seul le nom de fichier/export diffère de T6a
> originale.

```text
Rôle (minimal, P1 : la RLS reste l'autorité — le proxy ne fait que router) :
1. Rafraîchir la session Supabase (lecture/rotation des cookies via @supabase/ssr).
2. Rediriger selon la ZONE demandée :
   - route (app)/* ou (admin)/* SANS session → redirection vers /login.
   - route (public)/login|signup SI session déjà ouverte → redirection vers /home.
3. Il NE lit PAS le rôle pour (admin) (cf. §4.2) : la garde de rôle est côté
   layout/serveur, pas dans le proxy (is_admin() est une fonction DB, T3).
```

> Le proxy garde l'**authentification** (a-t-on une session ?), pas
> l'**autorisation fine** (rôle/statut), qui reste en base (RLS + `is_admin()`).
> Un contournement du proxy ne donne accès à **aucune donnée** : la RLS bloque.

### 4.2 Garde de zone `(admin)`

```text
Le layout (admin)/admin/layout.tsx (composant serveur) appelle is_admin() (via une
lecture users en session, ou un RPC is_admin()) AVANT de rendre :
  - non connecté → redirect /login ;
  - connecté non-admin → redirect /home (pas de fuite d'existence d'écran) ;
  - admin → rend le hub.
Défense en profondeur : même si un non-admin atteignait une page (admin)/*, toute
donnée admin-only (competition_secrets, audit_logs, sync_logs, entity_mappings) est
DÉJÀ protégée par la RLS (T3 §4) → la page serait vide/erreur, jamais une fuite.
```

### 4.3 Statut `DISABLED` (T2 §7.3)

```text
Un joueur DISABLED garde une session et peut LIRE (ses données/points restent et
comptent — 0.2.7 §3). Il ne peut plus ÉCRIRE : la RLS le bloque (policies gardées
par is_active(), T3). Côté écran : les CONTRÔLES de saisie sont désactivés/masqués
(choix d'affichage, pas de sécurité — l'autorité reste la RLS). Détail en T6b.
```

---

## 5. Frontière d'écriture (Option A, actée le 19/07/2026)

Trois catégories d'écriture, trois mécanismes. **Aucune** n'expose `service_role`
au navigateur (P2).

### 5.1 Les trois catégories

```text
A. ÉCRITURE JOUEUR (sur ses propres prédictions) — brackets, bracket_picks,
   match_predictions, bets, correction_requests.
   → SERVER ACTION en SESSION UTILISATEUR (getServerClient). La RLS (T3 §5) est le
     garde-fou. Jamais de service_role. Garde-fou anti-perte de saisie C2 (T6b).
   (C-4 : les server actions joueur n'écrivent QUE ces tables.)

B. ÉCRITURE ADMIN-SYSTÈME (déclenchée par un humain admin, mais qui est une
   opération SYSTÈME) — recompute (bouton « Recalculer » ; résolution de pari),
   dérivation/écriture de series.official_* (résolution de série, cascade A2).
   → SERVER ACTION ADMIN qui RE-VÉRIFIE is_admin() côté serveur, puis appelle le
     MODULE PRIVILÉGIÉ (getServiceClient) : writeSeriesOutcome (§5.2) et/ou
     recompute* (T5 §10). service_role est CONFINÉ à ce module serveur, jamais
     dans le composant. C'est la lecture retenue de P2 (Option A) : « pas de
     service_role dans une action JOUEUR sur ses propres données » — une opération
     système déclenchée par l'admin n'en est pas une.

C. ÉCRITURE SYSTÈME EXTERNE (planificateur) — synchro, heartbeat.
   → ROUTES /api/sync/* et /api/heartbeat (T4), service_role + secret partagé.
     Réservées au planificateur externe (P13), pas d'entrée UI.
```

### 5.2 `writeSeriesOutcome` : point d'écriture unique de `series.official_*`

Réconciliation C-2 (lib/sync seul écrivain de `series`) × T5 §12.1/§12.2 × Option A :

```text
- writeSeriesOutcome vit dans lib/sync et est le SEUL code qui écrit
  series.official_status / official_winner_team_id / official_score_format.
- Il s'exécute TOUJOURS en service_role (privilégié), donc contourne la RLS.
- Il a DEUX appelants légitimes, tous deux privilégiés :
    (1) la synchro /api/sync/results (catégorie C) — agrégat re-dérivé (T5 §4) ;
    (2) une server action admin (catégorie B) — résolution/override, cascade A2
        (T5 §9), après re-vérif is_admin().
- Dans les deux cas il enchaîne, dans la même transaction : écrire series.official_*
  → déclencher recomputeSeries (T5 §10).
```

> **Note sur la policy T3 `UPDATE ... using (is_admin())` de series/matches** : elle
> reste en base comme **backstop** DB. Sous Option A, les écritures officielles qui
> **déclenchent le scoring** (score/statut/résolution de série) passent par le
> chemin privilégié (service_role, qui bypass la RLS) car couplées à `recompute*` ;
> les éditions officielles **purement descriptives sans effet scoring** (ex.
> corriger un `scheduled_at`) peuvent rester une server action admin en session
> sous cette policy. **Aucune contradiction avec T3** : on choisit le chemin selon
> le couplage au scoring, la policy demeure valide.

### 5.3 Récapitulatif écriture → mécanisme

| Écriture | Catégorie | Client | Garde |
|---|---|---|---|
| Prono / bracket / pari (le mien) | A | `getServerClient` | RLS (T3 §5) + C2 |
| Requête de correction (la mienne) | A | `getServerClient` | RLS |
| Validation/refus d'un pari (admin) | B (sans recompute) | `getServerClient` | RLS `is_admin()` |
| Résolution d'un pari GAGNÉ/PERDU (admin) | B (recompute) | `getServiceClient` | server action + `is_admin()` |
| Traitement d'une requête de correction | B (recompute) | `getServiceClient` | server action + `is_admin()` (+ trigger T-c) |
| Résolution / override / A2 de série | B (recompute) | `getServiceClient` (writeSeriesOutcome) | server action + `is_admin()` |
| Bouton « Recalculer » (filet) | B | `getServiceClient` (recomputeCompetition) | server action + `is_admin()` |
| Promotion/désactivation joueur | B (sans recompute) | `getServerClient` | RLS `is_admin()` (+ trigger T-a) |
| Édition officielle sans scoring (horaire) | B (sans recompute) | `getServerClient` | RLS `is_admin()` |
| Synchro / heartbeat | C | `getServiceClient` | route + secret (T4) |

> Le **corps** de chacune de ces actions (validations, transitions d'état, C2,
> journalisation `audit_logs`) est spécifié en **T6b**. T6a n'en pose que la
> **catégorie** et le **mécanisme**.

---

## 6. Ce que T6a ne dit pas

```text
- Le corps des server actions joueur + le garde-fou anti-perte de saisie C2   → T6b.
- Le corps des actions admin (files validation/résolution/requêtes, gestion
  joueurs, journalisation audit_logs)                                          → T6b.
- Les souscriptions Realtime, la micro-animation « donnée qui vient de changer »
  (B7), et le rendu des états actés : A1 (« - » / « 0 », T5 §12.3), pari annulé
  barré+grisé, joueurs absents, barre « toi » collante (B8), bascule résumé/arbre
  (B6), tendances %/brut, états vides + libellés (B9)                          → T6c.
- Les design tokens (palette arène/broadcast, typo, espacements)               → T7.
- La config du planificateur externe                                           → T8/déploiement.
```

---

## 7. Plan de test T6a (structure & flux)

```text
STRUCTURE & PROTECTION
1.  Visiteur (pas de session) sur (app)/home ou (admin)/* → redirigé vers /login.
2.  Joueur connecté sur (admin)/* → redirigé vers /home (pas de fuite d'écran).
3.  Admin sur (admin)/* → accès au hub.
4.  Joueur connecté sur (public)/login → redirigé vers /home.
5.  Visiteur sur /leaderboard et /bracket (route unique, corrigée §3) → rendu public correct (données
    filtrées par la RLS : aucun brouillon d'autrui, aucun bracket avant deadline).

STRATÉGIE DE DONNÉES
6.  Un même composant de classement, rendu pour visiteur puis pour joueur → le
    joueur voit en plus SES lignes autorisées ; aucun `if(role)` de sécurité dans
    le composant (revue de code : seule la mise en forme diffère).
7.  getServiceClient importé depuis un composant "use client" → ERREUR de build
    (garde server-only) : la clé service_role ne peut pas fuiter au navigateur.
8.  Page dépendante de session → rendue en dynamique (pas de cache statique
    par-utilisateur).

FRONTIÈRE D'ÉCRITURE (squelette ; corps en T6b)
9.  Une server action joueur utilise getServerClient (jamais getServiceClient).
10. Une server action admin-système (résolution série) : re-vérifie is_admin()
    côté serveur AVANT d'appeler writeSeriesOutcome/recompute ; un non-admin qui
    forgerait l'appel est refusé (is_admin() faux) ET la RLS/So le module privilégié
    ne s'exécute pas.
11. series.official_* n'est écrit que par writeSeriesOutcome (revue : aucun autre
    write de ces colonnes dans le code — C-2).
```

---

## 8. Décision actée à la validation de T6a (19/07/2026)

### 8.1 Partage public/connecté des écrans classement & bracket (§3.2)

**Acté** : classement et bracket global reposent sur **un module de lecture partagé**
(`lib/queries/*`) **et un composant de rendu partagé** (`components/*`), les
`page.tsx` de `(public)` et `(app)` n'étant que des **enveloppes fines** sous leur
layout respectif (nav réduite vs 4 onglets). La duplication des pages est écartée :
une seule règle de lecture/rendu, aucune divergence possible entre la vue visiteur
et la vue joueur (la seule différence de contenu vient de la RLS appliquée à la
session, pas du code).

---

**T6a est VALIDÉ et figé.** On enchaîne sur **T6b** (corps des server actions joueur
+ garde-fou C2, puis actions admin et journalisation), qui remplit la couche
d'écriture dont T6a a posé les catégories et les mécanismes. T6a ne produit
**aucune migration** (les tables/policies existent — T1/T3) ; c'est du squelette
applicatif, écrit après ce feu vert (TypeScript strict, App Router, composants
serveur par défaut, commentaires FR, noms EN).
