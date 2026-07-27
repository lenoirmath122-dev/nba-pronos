# NBA Pronos — SPEC ÉCRAN TABLEAU DE BORD ADMIN V0.1

> **Statut : VALIDÉ (27/07/2026).** Premier écran du lot « Admin »
> (`GAPS_OUVERTS.md` : « prochaine étape à confirmer avec l'utilisateur »).
> Contrairement à Bracket personnel, **les décisions fonctionnelles ET
> techniques existent déjà en intégralité** — cette spec ne fait
> qu'assembler `nba_pronos_decisions_0_2_7_administration.md`,
> `nba_pronos_decisions_0_2_9_ux_ui.md` §8 et
> `SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md`/`_b.md` (arbre `app/(admin)/`,
> catégories d'écriture, signatures de server actions) au format écran, comme
> `SPEC_ECRAN_ACCUEIL_V0_1.md` l'a fait pour le hub joueur.
>
> Périmètre STRICT de ce lot : `(admin)/admin/layout.tsx` (garde de zone) +
> `(admin)/admin/page.tsx` (tableau de bord — compteurs par file + bouton
> Recalculer). **PAS** les pages filles (`validation/`, `resolution/`,
> `requests/`, `players/`, `logs/`, `competitions/`) — chacune son propre lot,
> sa propre spec, à la suite de celui-ci (§10).
>
> Close après confirmation des 2 points du §11 (AskUserQuestion, même
> séance) : sans compétition active, joueurs/logs restent ACCESSIBLES (§8) ;
> bouton Recalculer DÉSACTIVÉ mais VISIBLE (§4/§8), pas masqué.
>
> **Vérification de dépôt (27/07/2026, avant code) — 2 réalités trouvées, pas
> dans la spec initiale, tranchées AVEC l'utilisateur :**
> 1. **Aucune fonction `recompute*` n'existe en base** (ni migration ni
>    `lib/`) — le moteur de scoring T5 est spécifié mais jamais codé
>    (`GAPS_OUVERTS.md` le liste après les écrans admin). Le bouton
>    Recalculer (§4) est donc **OMIS de CE lot** — ajouté quand T5 sera codé,
>    voir §4/§7/§10.
> 2. **Aucune des 5 pages filles n'existe** (`/admin/{validation,resolution,
>    requests,players,logs}`). Les cartes/liens du tableau de bord sont donc
>    rendus **INERTES** (pas de `<Link>`, libellé « à venir »), même patron
>    que le hub Jouer temporaire (`ETAT_ACTUEL.md` §2.10) — retirés
>    individuellement au fur et à mesure que chaque page fille est codée.

---

## 0. Sources et cadre

```text
Règles fonctionnelles : nba_pronos_decisions_0_2_7_administration.md (modèle
  admin, règle « ≥2 admins » souple, 2 files de paris, workflow requête,
  recalcul idempotent, distinction log interne / marquage public) ;
  nba_pronos_decisions_0_2_9_ux_ui.md §8 (organisation UI : dashboard unique
  + compteurs → chaque file en page dédiée).
Architecture : SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md §3/§4 (arbre
  app/(admin)/admin/, garde is_admin() côté layout — PAS le proxy, §4.2 ;
  accès depuis Profil, pas un 5e onglet, §3.1) ;
  SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_b.md §5 (catégorie B — actions admin,
  signatures validateBet/resolveBet/processCorrectionRequest/setPlayerRole/
  setPlayerStatus/recalculateCompetition) + §6 (logAdminAction, audit_logs).
Données   : SPEC_TECHNIQUE_MODELE_DONNEES_V0_1.md §3.10 (bets, enum
  bet_status), §3.11 (correction_requests, enum correction_request_status :
  PENDING/PROCESSED/REJECTED — mappé EN_ATTENTE/TRAITÉE/REFUSÉE, même patron
  que Mes pronos §2.11 ETAT_ACTUEL.md), §3.12 (audit_logs, append-only,
  admin-only), §3.2 (users.role : PLAYER/ADMIN).
RLS       : SPEC_TECHNIQUE_RLS_V0_1.md — `is_admin()` (lit users.role, jamais
  un claim JWT) ; bets/correction_requests/audit_logs déjà lisibles par
  is_admin() (migration #1/#2, aucune migration nécessaire pour CE lot,
  lecture seule) ; bet_deadline_open(scope, series_id, match_id) (migration
  #1, `supabase/migrations/20260718110000_rls.sql:100`) déjà réutilisée en
  TypeScript par lib/queries/{bets,home}.ts — même patron repris ici (§6).
Précédent direct : lib/queries/home.ts::getAdminTodo() (§5 de
  SPEC_ECRAN_ACCUEIL_V0_1.md) calcule DÉJÀ le compteur « paris à valider »
  (bets SUBMITTED de la compétition active) et pointe vers `/admin/validation`
  — route et libellé RÉUTILISÉS tels quels, pas réinventés (§4).
```

---

## 1. Architecture

```text
app/(admin)/admin/layout.tsx → garde de zone (composant serveur) :
  - non connecté          → redirect /login
  - connecté, non-admin   → redirect /home (pas de fuite d'existence d'écran,
                             T6a §4.2 — même défense en profondeur que la RLS)
  - admin                 → rend le hub (pas de 5e onglet ; nav admin propre,
                             minimale : liens vers les 5 files/pages filles)

app/(admin)/admin/page.tsx   → tableau de bord : compteurs par file, liens
  inertes vers les pages filles (§3). ENTIÈREMENT composant SERVEUR dans CE
  lot (pas de "use client" : ni bouton Recalculer — omis, §4 — ni aucune
  autre interaction).

lib/queries/admin-dashboard.ts → toute la lecture de l'écran (§6).
(pas de lib/actions/admin.ts dans ce lot — voir §7)

Point d'entrée (T6a §3.1, déjà acté) : lien « Admin » sur l'écran Profil, visible
  uniquement si role=ADMIN — PAS un 5e onglet de la TabBar.
```

---

## 2. Garde de rôle — **acté (T6a §4.2)**

```text
Le proxy.ts NE lit PAS le rôle (authentification seulement, pas
  d'autorisation fine). La garde is_admin() vit dans (admin)/admin/layout.tsx,
  côté serveur, RE-VÉRIFIÉE à chaque navigation (jamais un état client mis en
  cache).
Défense en profondeur : même si un non-admin atteignait une page (admin)/*,
  toute donnée admin-only (audit_logs, correction_requests des autres,
  bets des autres) reste DÉJÀ protégée par la RLS — la page serait vide,
  jamais une fuite.
```

---

## 3. Contenu — trois compteurs de file + section joueurs/logs — **acté (0.2.9 §8)**

```text
Une carte par file, menant à sa page dédiée (lot séparé, §10) — **INERTE en
CE lot** (pas de `<Link>`, page cible inexistante, libellé « à venir »),
même patron que le hub Jouer temporaire (`ETAT_ACTUEL.md` §2.10) : marquée
TEMPORAIRE aux 3 endroits habituels (commentaire code, mention visible,
`GAPS_OUVERTS.md`), retirée dès que sa page fille existe :

1. FILE DE VALIDATION   → /admin/validation
   Compteur : bets.status = 'SUBMITTED', competition_id = compétition ACTIVE.
   Libellé  : « N pari(s) à valider » (RÉUTILISE le libellé de
              lib/queries/home.ts::getAdminTodo, §4).

2. FILE DE RÉSOLUTION   → /admin/resolution
   Compteur : bets.status = 'VALIDATED' ET échéance dépassée
              (bet_deadline_open(scope, series_id, match_id) = false,
              reproduit en TypeScript — §6), competition_id = compétition
              ACTIVE.
   Libellé  : « N pari(s) à résoudre ».

3. FILE DES REQUÊTES    → /admin/requests
   Compteur : correction_requests.status = 'PENDING' — PAS de filtre
              competition_id direct sur cette table (dénormalisation absente,
              §3.11 modèle de données) ; filtrée via la cible
              (match_prediction/bet → match/série → compétition), même
              jointure que la page /admin/requests elle-même effectuera
              (lot séparé). Couvre les DEUX target_type (MATCH_PREDICTION
              ET BET) dans UN SEUL compteur, conformément à 0.2.7 §6
              (« 1 requête = 1 prono/pari sur 1 match ou 1 série », pas de
              distinction de file par type de cible).
   Libellé  : « N requête(s) en attente ».

Chaque carte à 0 : toujours affichée (pas masquée), état neutre — voir §8.

Sous les 3 cartes, deux entrées SANS compteur (actions permanentes, pas des
files qui se vident) — INERTES pour la même raison :
4. GESTION DES JOUEURS   → /admin/players (lien simple, « à venir »)
5. HISTORIQUE DES LOGS   → /admin/logs (lien simple, lecture seule, « à venir »)
```

---

## 4. Bouton « Recalculer » — **OMIS de ce lot (dépendance manquante, voir en-tête)**

```text
Design cible, INCHANGÉ pour quand il sera codé (acté 0.2.7 §7, 0.2.9 §8) —
  conservé ici pour référence, mais AUCUNE ligne de code écrite dans CE lot :

Filet de sécurité, PAS une action de routine. Rendu en bas du tableau de
  bord, visuellement distinct (zone séparée, pas une carte de file).
Action : recalculateCompetition(competitionId) — catégorie B AVEC recompute
  (T6a §5.3), server action qui RE-VÉRIFIE is_admin() côté serveur puis
  appelle le module privilégié (getServiceClient → recomputeCompetition,
  T5 §10.1, IDEMPOTENT — rejouable sans risque de double comptage).
Confirmation AVANT exécution (popup, même patron que Bracket personnel §4) :
  explique que l'opération est SANS RISQUE (idempotente) mais peut prendre
  quelques secondes — PAS un avertissement destructeur, ce serait faux.
Journalisation : logAdminAction (T6b §6) écrit une ligne audit_logs
  (actor = auth.uid(), action = "RECALCULATE_COMPETITION", cible =
  competitionId, avant/après = agrégats de user_scores le cas échéant) dans
  la MÊME transaction que le recalcul.
Cible : la compétition ACTIVE (une seule à la fois, décisions
  multi-compétitions §1 — pas de sélecteur, cohérent avec l'Accueil §2 de
  SPEC_ECRAN_ACCUEIL_V0_1.md). Désactivé si aucune compétition active (§8).

RAISON DE L'OMISSION : recomputeCompetition (T5 §10.1) n'existe nulle part
  dans le dépôt (ni migration, ni lib/) — trouvé au pré-vol (27/07/2026).
  Coder ce bouton maintenant obligerait à construire tout ou partie du
  moteur de scoring T5 dans ce même lot, hors périmètre annoncé (« tableau
  de bord » seul). Tranché AVEC l'utilisateur : ajouté dans un lot ultérieur,
  quand T5 sera implémenté (GAPS_OUVERTS.md).
```

---

## 5. Ce que ce tableau de bord n'affiche PAS (renvois explicites)

```text
- Le CONTENU de chaque file (contexte du pari, formulaire de validation,
  réglette de difficulté, etc.) : lot séparé par file (§10).
- L'historique détaillé des logs (liste filtrable) : lot séparé /admin/logs
  (§10) — le tableau de bord ne fait QUE lier vers lui.
- La gestion des joueurs (promouvoir/désactiver/rétrograder, garde-fous
  visibles) : lot séparé /admin/players (§10).
- La création/gestion des compétitions (`(admin)/admin/competitions/`,
  présente dans l'arbre T6a §3 mais AUCUNE décision fonctionnelle relue à ce
  jour dans 0.2.7/0.2.9 pour son rendu précis) : HORS PÉRIMÈTRE explicite de
  TOUT le lot admin actuel, pas seulement de ce tableau de bord — à ouvrir
  séparément le moment venu, pas deviné ici.
- Vue « qui manque à l'appel avant une deadline » (idée notée dans
  BACKLOG_V1.md, jamais actée en décision V1) : backlog, pas ce lot.
```

---

## 6. Couche de lecture — `lib/queries/admin-dashboard.ts`

```ts
// lib/queries/admin-dashboard.ts — lecture du tableau de bord admin (serveur uniquement).
// Toutes les requêtes passent par la RLS en session admin (getServerClient),
// JAMAIS service_role (lecture seule, aucun besoin de bypass).

export type AdminDashboardData = {
  competitionId: string | null;       // null = aucune compétition active
  competitionName: string | null;
  pendingValidationCount: number;     // bets SUBMITTED (§3.1)
  pendingResolutionCount: number;     // bets VALIDATED + échéance dépassée (§3.2)
  pendingRequestsCount: number;       // correction_requests PENDING (§3.3)
};

export async function getAdminDashboardData(): Promise<AdminDashboardData>;
```

```text
pendingResolutionCount (§3.2) : PAS un simple .eq('status','VALIDATED').count()
  — nécessite de charger scope/series_id/match_id (+ matches.scheduled_at
  joint) pour les bets VALIDATED de la compétition active, puis de reproduire
  bet_deadline_open() en TypeScript et compter ceux où elle est FAUSSE — même
  fonction déjà écrite dans lib/queries/bets.ts:272 et lib/queries/home.ts:363,
  à FACTORISER en un helper partagé (lib/labels/bets.ts ou nouveau module
  neutre) plutôt que dupliquée une 3e fois — point d'implémentation, pas une
  décision produit.
```

---

## 7. Couche d'écriture — AUCUNE dans ce lot

```text
Pas de lib/actions/admin.ts dans ce lot : ce tableau de bord est un écran de
  LECTURE pure (compteurs + liens inertes). recalculateCompetitionAction
  (design cible ci-dessous, §4) est reporté au lot qui codera T5 :

// Catégorie B avec recompute (T6a §5.3/§5.1). RE-VÉRIFIE is_admin() côté
// serveur (jamais confié au layout seul), puis délègue à recomputeCompetition
// (T5 §10.1, getServiceClient) + logAdminAction (T6b §6), même transaction.
export async function recalculateCompetitionAction(): Promise<ActionResult>;
// Pas de paramètre competitionId côté formulaire : lit la compétition ACTIVE
// serveur (même principe que le reste de l'app, §4) — un client ne choisit
// jamais la cible d'une opération privilégiée.
```

---

## 8. États — libellés **actés (27/07/2026)**

```text
Aucune compétition active : les 3 compteurs affichent 0 (files vides par
  construction, rien n'est scopé), bandeau « Aucune compétition en cours. »
  au-dessus des cartes — même libellé que les écrans joueur (cohérence,
  SPEC_ECRAN_ACCUEIL_V0_1.md §8). Gestion des joueurs et historique des logs
  restent ACCESSIBLES (non scopés par compétition, §3 points 4/5) — **acté
  (§11.A)** : ces deux écrans n'ont pas besoin d'une compétition en cours
  pour être utiles (promouvoir un admin, consulter l'historique).
Bouton Recalculer sans compétition active : DÉSACTIVÉ mais VISIBLE (grisé,
  pas masqué) — **acté (§11.B)** : l'admin voit que l'action existe et
  comprend qu'il n'y a rien à recalculer, plutôt que de se demander où elle
  est passée.
File à 0 : carte affichée en état neutre, pas grisée/masquée — signale que
  tout est traité, pas une absence de fonctionnalité (même esprit que le
  bloc « Tout est à jour » de l'Accueil, §8 SPEC_ECRAN_ACCUEIL_V0_1.md).
```

---

## 9. Règles de rendu (T7 — non négociables)

```text
- CSS Modules colocalisés lisant EXCLUSIVEMENT les tokens de app/tokens.css.
- 100% composant serveur dans ce lot (aucune feuille "use client" — pas de
  bouton Recalculer, §4).
- Teinte distinctive de la zone admin déjà actée (0.2.9 §2) : --color-trend,
  tag « admin » — cohérent avec le bloc « À traiter (admin) » de l'Accueil
  (SPEC_ECRAN_ACCUEIL_V0_1.md §5), pas une nouvelle palette.
- Écran de LECTURE (pas un moment fort d'arène) : énergie calme, comme
  Classement/Mes pronos (0.2.9 §2), pas de bandeau parquet ici.
- Aucune valeur visuelle en dur.
```

---

## 10. Suite du lot admin (hors périmètre de CE tableau de bord)

```text
Dans l'ordre suggéré (pas figé, à reconfirmer à chaque lot comme d'habitude) :
1. Ce tableau de bord (CE document).
2. File de validation des paris (/admin/validation) — validateBet/rejectBet.
3. File de résolution des paris (/admin/resolution) — resolveBet WON/LOST.
4. File des requêtes de correction (/admin/requests) — processCorrectionRequest
   / rejectCorrectionRequest (couvre pronos ET paris, 0.2.7 §6).
5. Gestion des joueurs (/admin/players) — setPlayerRole/setPlayerStatus,
   garde-fous visibles (pas d'auto-rétrogradation, dernier admin protégé).
6. Historique des logs (/admin/logs) — consultation audit_logs, filtrable.
Chacun : sa propre spec d'écran, fermée avant code, comme tous les lots
  précédents.
```

---

## 11. Récapitulatif des décisions actées (27/07/2026)

```text
A. Sans compétition active : Gestion des joueurs et Historique des logs
   restent ACCESSIBLES (non scopés par compétition) — seuls les 3 compteurs
   de file retombent à 0. Voir §8.
B. Bouton Recalculer sans compétition active : DÉSACTIVÉ mais VISIBLE
   (grisé), jamais masqué. Voir §4/§8.
```
