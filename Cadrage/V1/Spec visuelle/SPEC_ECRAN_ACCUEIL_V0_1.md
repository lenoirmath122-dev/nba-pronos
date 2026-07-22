# NBA Pronos — SPEC ÉCRAN ACCUEIL V0.1

> **Statut** : **complète** — aucun point produit ouvert (§10). Rédigée et close le
> 21/07/2026, phase V1 propre.
> **Décisions actées le 21/07/2026** : pas de mouvement de rang en V1 (§3) ; compte à
> rebours à bascule automatique sous 1 h (§4) ; feed 48 h / 5 items (§6).
> **Portée** : `app/(app)/layout.tsx` (nav 4 onglets) + `app/(app)/home/page.tsx`.
> Premier écran joueur codé : il coud ensemble données + layout + tokens.

## 0. Sources et cadre

| Sujet | Source | Ce qu'elle impose |
|---|---|---|
| Structure de l'écran | 0.2.9 §3 | en-tête rang/points ; « À traiter » trié par urgence ; « Ça vient de tomber » ; bloc admin selon rôle |
| Ordre d'urgence | 0.2.9 §3 | bracket > matchs > paris > feedback |
| Routes / layouts | T6a §3 | `(app)/layout.tsx` = nav 4 onglets + garde session ; bloc admin = **fragment** de `home/`, pas une route |
| Lecture des données | T6a §3.1 | lecture dans `lib/queries/*` appelée avec `getServerClient()` |
| Realtime | T6c §2 | surcouche optionnelle ; SSR = rendu initial ; **hors périmètre V1 de cet écran** (§9) |
| Compétition affichée | décisions multi-compétitions §1 | **une seule compétition ACTIVE à la fois** → pas de sélecteur |
| Couleurs / rayons | T7 + amendement V0.2 | vert/rouge = **résultat** uniquement ; or = champion (absent ici) ; tendance = `--color-trend` |
| Maquette de référence | `ecran-accueil.html` | disposition validée (jetable, hors prod) |

**Conventions** : TypeScript strict, composants serveur par défaut, commentaires FR,
noms de code EN, tous les styles via les tokens de `app/tokens.css` (aucune valeur en dur).

---

## 1. Architecture

```text
app/(app)/layout.tsx     → garde session (redirect /login si absente) ; nav 4 onglets
                           (Accueil · Jouer · Classement · Profil) avec les icônes
                           components/icons/nav-icons.tsx ; onglet actif = --color-accent,
                           inactif = --color-text-muted. Composant serveur ; seul l'état
                           « onglet actif » peut exiger un petit composant client.
app/(app)/home/page.tsx  → composant serveur. Appelle lib/queries/home.ts, compose les
                           blocs. Aucun fetch client, aucune clé service_role.
lib/queries/home.ts      → toute la lecture de l'écran (voir §7).
components/home/*        → composants de rendu (présentationnels, sans accès données).
components/home/Countdown.tsx
                         → SEULE feuille "use client" de l'écran (§4). Reçoit une
                           deadline ISO calculée serveur ; tout le reste de home/ demeure
                           composant serveur.
```

Le **bloc admin** est rendu conditionnellement dans `home/page.tsx` si `is_admin()` — jamais
une route séparée (T6a §3.1). La vérification de rôle est **serveur** ; on ne se fie
jamais à un état client.

---

## 2. Compétition affichée

Une seule compétition `ACTIVE` → l'écran la lit sans sélecteur. Trois cas :

1. **Aucune compétition active** → état vide global (§6.1). Cas réel aujourd'hui (base vide).
2. **Compétition active, joueur non participant** → **décision actée (21/07/2026)** : l'Accueil
   affiche **exactement la même chose** qu'à un participant. La « participation » n'est pas un
   état stocké : `user_scores` considère participant quiconque a au moins une ligne de prono,
   de pari ou de bracket. **Remplir un champ vaut donc inscription**, sans étape dédiée ni code
   spécifique (cohérent avec 0.2.1 : inscription libre, accès immédiat).
   - En-tête : 0 pt, **pas de rang** (voir §8), invitation à faire un premier prono.
   - Réserve : le **bracket** échappe à la règle — deadline unique (coup d'envoi du 1er match ;
     en Cup, du 1er quart), après quoi il est verrouillé et non modifiable. Un retardataire ne
     peut plus le remplir : l'item n'apparaît pas (condition §4) et il reste à **0 point de
     bracket** pour la compétition. Conséquence assumée du format, **pas** un cas à corriger.
3. **Compétition active + joueur participant** → cas nominal ci-dessous.

Le type de compétition (Playoffs vs NBA Cup) change **le contenu de l'item bracket**
(15 séries vs mini-bracket Cup), pas la structure de l'écran.

---

## 3. En-tête (rang / points)

| Élément | Donnée | Origine |
|---|---|---|
| Salutation + pseudo | `users.pseudo` | session |
| Rang | position du joueur dans `user_scores` triée (compétition active) | vue `user_scores` + tri de classement (0.2.6 §3 : total, puis départages) |
| Points | `total_points` | `user_scores` |
| Écart au leader | `total_points` du 1er − celui du joueur | `user_scores` |
| Élan 7 jours | `recent_form_points` | vue `user_recent_form` |
| Contexte | nom de la compétition (+ nb de matchs du jour, optionnel) | `competitions`, `matches` |

**Décision actée (21/07/2026)** : **pas de mouvement de rang en V1**. Le rang n'est jamais
stocké (P7) et il n'existe aucun historique en cours de compétition (seul
`competition_archives` fige un rang, à la clôture). L'emplacement de la maquette
(« ▲ +1 cette semaine ») porte donc **« +X pts cette semaine »** (élan 7 j), et l'écart au
leader reste affiché.

> **Trou laissé ouvert volontairement** : le type `HomeHeader` expose
> `rankMovement: RankMovement | null` (toujours `null` en V1) et le composant prévoit le
> slot. L'activer plus tard = table de snapshots additive + remplir le champ.
> ⚠️ **Non rétroactif** : aucun backfill possible, les deltas ne partiront que de la mise
> en place. Voir BACKLOG (courbe d'évolution / historique).

Rendu : chiffres en `font-variant-numeric: tabular-nums` (R-TYP1). L'élan 7 j utilise
`--color-text-secondary` ou `--color-trend` — **jamais** vert/rouge (réservés au résultat).

---

## 4. Bloc « À traiter »

Liste triée par **deadline la plus proche**, avec compte à rebours et action directe.
En cas d'égalité de deadline, on départage par l'ordre d'urgence 0.2.9 §3 :
**bracket > matchs > paris**.

| # | Item | Condition d'apparition | Cible du tap |
|---|---|---|---|
| 1 | Bracket / phase finale à compléter | bracket du joueur incomplet **et** deadline non dépassée | écran bracket |

**Libellé de l'item bracket — acté (21/07/2026)**, il dépend du type de compétition :

| Compétition | Libellé | Structure sous-jacente |
|---|---|---|
| Playoffs | « Complète ton bracket · **15 séries** » | séries au meilleur des 7 : vainqueur **+ format** |
| NBA Cup | « Complète ton bracket · **7 matchs de phase finale** » | 7 matchs secs, 3 tours, **aucune série** → pas de format à pronostiquer |

> **En NBA Cup, l'item n'existe pas avant fin novembre** : la phase de groupes est hors scope
> (aucun pronostic) et le mini-bracket ne s'ouvre qu'une fois les 8 qualifiés connus
> (~27-30 nov). L'Accueil d'une compétition Cup n'a donc simplement pas d'item bracket avant
> cette date — ce n'est pas un état vide à signaler.
| 2 | N matchs à pronostiquer | matchs à venir non verrouillés sans prono validé du joueur | écran matchs |
| 3 | N paris en brouillon / slot à reproposer | pari non soumis, ou slot libre reproposable, deadline non dépassée | écran paris |

Chaque item : icône, titre (« 3 matchs à pronostiquer »), sous-titre de contexte
(affiches concernées), **compte à rebours** vers la deadline la plus proche du lot, chevron.

### 4.1 Compte à rebours — décision actée (21/07/2026)

Le compte à rebours est un **composant feuille autonome** (`components/home/Countdown.tsx`,
`"use client"`) qui reçoit la **deadline ISO calculée côté serveur** et gère lui-même son
mode d'affichage :

| Temps restant | Affichage | Comportement |
|---|---|---|
| > 1 h | libellé large (« dans 3 h », « demain ») | figé, aucun minuteur actif |
| ≤ 1 h | décompte à la seconde (« 42:17 ») | minuteur actif |
| = 0 | **« verrouillé »** | action de l'item **désactivée sur place** |

**Bascule automatique** : le seuil d'1 h est évalué **par le composant**, pas une seule fois
au rendu serveur. Une page laissée ouverte à 3 h de la deadline passe donc d'elle-même en
décompte vivant le moment venu — c'est précisément le scénario visé.

Contraintes d'implémentation :

- **Aucun décalage d'hydratation** : le premier rendu client reproduit exactement le libellé
  calculé serveur ; le minuteur ne démarre qu'**après montage** (effet), jamais au rendu.
- `font-variant-numeric: tabular-nums` (R-TYP1) pour que le décompte ne tressaute pas.
- **`prefers-reduced-motion`** : le décompte reste une mise à jour de valeur nue, sans
  animation — donc rien à neutraliser (R-MOT1).
- Le minuteur est **nettoyé au démontage**.

**À l'expiration** : on ne re-déclenche **aucun rendu serveur depuis le client** (règle T6c :
le client met à jour son état local, jamais `revalidatePath`). L'item passe donc en
« verrouillé » et son action se désactive, mais la **liste réelle** ne se recompose qu'à la
prochaine navigation ou réouverture. Objectif : empêcher de taper sur un match dont le coup
d'envoi est passé.

**Deadlines** : les noms exacts des colonnes de verrouillage (match, bracket, pari) et les
valeurs de statut (brouillon / soumis / validé) **sont à lire dans le schéma réel** au moment
de l'implémentation — cette spec décrit l'intention, pas des noms de colonnes présumés.

---

## 5. Bloc « À traiter (admin) »

Rendu **uniquement** si `is_admin()` (vérification serveur). Visuellement distinct :
teinte `--color-trend`, tag « admin ». Contenu V1 : **paris en attente de revue** (à valider
ou ajuster avant le coup d'envoi), avec compte d'éléments et lien vers la file admin.

Il s'ajoute **sous** les items joueur, sans se mélanger au tri d'urgence joueur.

---

## 6. Bloc « Ça vient de tomber »

Feed de feedback récent, le plus récent en premier. **Événements retenus en V1** :

| Type | Donnée source | Rendu |
|---|---|---|
| Prono de match scoré | `match_predictions` (`scored_at`, `points_awarded`, `is_winner_correct`, `margin_diff`, `margin_bonus_points`) | score du match + issue du prono + points ; **vert = gagné / rouge = perdu** |
| Pari scoré | `bets` (`scored_at`, `points_awarded`) | libellé du pari + points |
| Pari statué par l'admin | `bets` (`resolved_at`) | « validé / ajusté », **neutre** (ni vert ni rouge : ce n'est pas un résultat) |

**Exclus de la V1** : mouvement de rang (§3), et tout item bracket tant que le scoring
bracket n'est pas codé.

**Règles de rendu** (T7 / T6c) :
- vert/rouge **strictement** réservés au résultat gagné/perdu ; jamais pour un statut ;
- **jamais de pénalité négative** : un prono raté vaut 0, pas un malus ;
- pivot A1 sur les points : `null` → « - » (rien joué), `0` → « 0 », en attente → marqueur
  neutre « en attente » ;
- un pari annulé/neutralisé s'affiche grisé (`--opacity-cancelled`), **jamais en rouge**.

**Paramètres actés (21/07/2026)** : fenêtre **48 h**, **5 items** maximum, plus récent en
premier. Choix « frais » assumé : le bloc sera **plus souvent vide** (jour off, entre deux
tours) qu'avec une fenêtre de 7 jours → l'état vide du §8 n'est pas un cas rare, il fait
partie du rendu normal et doit être soigné.

> Ces deux valeurs sont des **constantes nommées** dans `lib/queries/home.ts`
> (`FEED_WINDOW_HOURS = 48`, `FEED_MAX_ITEMS = 5`), pas des nombres dispersés dans le code :
> les ajuster après quelques semaines d'usage doit rester une édition d'une ligne.

---

## 7. Couche de lecture — `lib/queries/home.ts`

Un seul module, appelé par `home/page.tsx` avec `getServerClient()`. Les requêtes passent
par la RLS (jamais `service_role`). Squelette de contrat (types à figer maintenant,
implémentation contre le schéma réel) :

```ts
// lib/queries/home.ts — lecture de l'écran Accueil (composants serveur uniquement).

/** Mouvement de rang : non alimenté en V1 (aucun historique de rang). Slot réservé. */
export type RankMovement = { from: number; to: number; delta: number };

export type HomeHeader = {
  pseudo: string;
  competitionName: string;
  rank: number | null;              // null = joueur non encore classé
  totalPoints: number;
  pointsBehindLeader: number | null; // null si leader ou non classé
  recentFormPoints: number;          // élan 7 jours (user_recent_form)
  rankMovement: RankMovement | null; // TOUJOURS null en V1 (voir §3)
};

/** Un item actionnable du bloc « À traiter ». */
export type TodoItem = {
  kind: "bracket" | "matches" | "bets" | "admin_bet_review";
  title: string;
  subtitle: string | null;
  deadline: string | null;   // ISO ; null = pas de deadline (item admin)
  count: number;             // nb d'éléments concernés
  href: string;              // action directe
};

/** Un événement du bloc « Ça vient de tomber ». */
export type FeedItem = {
  kind: "match_scored" | "bet_scored" | "bet_resolved";
  label: string;
  detail: string | null;
  points: number | null;       // null = pas de points (pivot A1)
  outcome: "win" | "loss" | "neutral"; // win/loss = RÉSULTAT uniquement
  occurredAt: string;          // ISO
};

export type HomeData = {
  competitionId: string | null;  // null = aucune compétition active → état vide global
  header: HomeHeader | null;
  todo: TodoItem[];              // déjà trié (deadline, puis urgence 0.2.9)
  adminTodo: TodoItem[];         // vide si non-admin
  feed: FeedItem[];
};

export async function getHomeData(): Promise<HomeData>;
```

Le tri d'urgence et les libellés sont produits **côté serveur** dans ce module : les
composants de `components/home/*` ne font que rendre.

---

## 8. États vides (0.2.9 §11 les listait comme à écrire)

| Situation | Titre | Sous-titre |
|---|---|---|
| Aucune compétition active | **Aucune compétition en cours** | « La prochaine arrive bientôt. » |
| Rien à traiter | **Tout est à jour** | « Rien à pronostiquer pour le moment. » |
| Feed vide (48 h) | **Rien de neuf depuis 2 jours** | « Les résultats s'afficheront ici. » |
| Joueur non classé | *(pas de bloc vide)* | en-tête : 0 pt, pas de rang, pas d'écart au leader + « Fais ton premier prono pour entrer au classement. » |

**Libellés actés le 21/07/2026.** Le troisième est le plus fréquemment vu (fenêtre 48 h, §6) :
son sous-titre existe pour signifier que le vide est **normal**, pas une panne.

> Ces chaînes vivent au même endroit que les composants de `components/home/*` ; les retoucher
> reste une édition de texte, sans impact sur les requêtes.

---

## 9. Hors périmètre de cette V1 d'écran

- **Realtime** : l'Accueil est un digest, pas un écran live. La surcouche T6c s'appliquera
  d'abord à l'écran Matchs. Rien dans cette spec ne l'empêche d'être ajoutée ensuite.
- **Mouvement de rang** (§3) et **snapshots de rang**.
- Écran Jouer / Matchs / Classement / Bracket : lots suivants.
- Bascule de thème clair (les tokens existent ; le toggle est un lot séparé).

---

## 10. Points à confirmer avant implémentation

**Aucun point produit ouvert.** Tous tranchés le 21/07/2026 :

| Point | Décision | §  |
|---|---|---|
| Mouvement de rang | hors V1 ; slot `rankMovement` réservé, toujours `null` | §3 |
| Compte à rebours | feuille client autonome, bascule auto sous 1 h, « verrouillé » à 0 | §4.1 |
| Feed | fenêtre **48 h**, **5 items**, constantes nommées (ajustables, rétroactif) | §6 |
| Joueur non participant | même écran ; remplir vaut inscription ; bracket hors règle | §2 |
| Libellés d'états vides | fixés | §8 |
| Item bracket | libellé différencié Playoffs / NBA Cup | §4 |

> Rappel de méthode, pas une question : les **noms de colonnes** de deadline et les
> **valeurs de statut** (§4) sont à lire dans le schéma réel au moment de l'implémentation.
> Cette spec décrit l'intention ; elle ne présume aucun nom.
