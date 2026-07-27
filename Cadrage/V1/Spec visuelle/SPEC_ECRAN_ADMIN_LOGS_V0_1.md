# NBA Pronos — SPEC ÉCRAN HISTORIQUE DES LOGS (ADMIN) V0.1

> **Statut : VALIDÉ (27/07/2026).** Quatrième écran du lot Admin. Choisi
> après le tableau de bord, la validation des paris et la gestion des
> joueurs — dernière page fille SANS AUCUNE dépendance sur le moteur de
> scoring T5 (écran de LECTURE pure, aucune écriture, 0.2.7 §8).
>
> Périmètre STRICT : `app/(admin)/admin/logs/page.tsx` — consultation
> filtrable d'`audit_logs`. PAS les 2 files restantes (résolution,
> requêtes), toutes deux partiellement bloquées par T5.

---

## 0. Sources et cadre

```text
Règles : nba_pronos_decisions_0_2_7_administration.md §8 (log interne
  d'audit : qui/quoi/quand/cible/motif/avant→après, jamais public, réservé
  aux admins, pas de purge en V1) ; nba_pronos_decisions_0_2_9_ux_ui.md §8
  (écran de consultation PURE, filtrable, AUCUNE action dessus).
Détail des filtres/tri — POINT DÉJÀ TRANCHÉ (pas un point ouvert, malgré ce
  que semblait indiquer 0.2.9 §11) : nba_pronos_PREP_SPEC_TECHNIQUE_V1.md
  §B5, validé le 17/07/2026 — « Tri par défaut = plus récent en premier.
  Filtres retenus : type d'action, admin (utile dès 2 admins actifs), ET
  filtre par date. » Trouvé en cherchant la source AVANT d'inventer un
  design de filtres — pas dans GAPS_OUVERTS.md (jamais réopéré depuis).
Donnée : SPEC_TECHNIQUE_MODELE_DONNEES_V0_1.md §3.12 (audit_logs : id,
  actor_user_id, action, target_type, target_id, reason, before_value
  jsonb, after_value jsonb, created_at — APPEND-ONLY, aucune colonne de
  purge en V1).
RLS : audit_select (migration #3) = is_admin() — lecture directe via
  getServerClient, AUCUNE fonction SQL, AUCUNE migration pour ce lot.
Contenu réel disponible aujourd'hui : 4 types d'action déjà journalisés par
  les 2 lots précédents (VALIDATE_BET, REJECT_BET, SET_PLAYER_ROLE,
  SET_PLAYER_STATUS) — libellés centralisés dans lib/labels/audit.ts
  (NOUVEAU, même rôle que lib/labels/bets.ts), à ÉTENDRE par chaque futur
  lot admin (résolution, requêtes) plutôt que dérivé dynamiquement — la
  liste des actions est un vocabulaire fermé décidé par le code, pas une
  donnée ouverte.
```

---

## 1. Architecture

```text
app/(admin)/admin/logs/page.tsx → composant serveur, lib/queries/
  admin-logs.ts. Filtres en `<form method="get">` natif (querystring), même
  patron que le filtre date de Mes pronos (`<input type="date">` littéral) —
  AUCUN "use client".
```

---

## 2. Contenu d'une ligne — **acté (0.2.7 §8)**

```text
Horodatage (created_at, JJ/MM HH:MM) ; acteur (pseudo, résolu depuis
  actor_user_id — "Système" si NULL, cas synchro non utilisé par les lots
  actuels mais prévu par le schéma) ; action (libellé humain via
  lib/labels/audit.ts, ex. "Pari validé") ; cible (target_type +
  target_id tronqué ; SI target_type = "user", pseudo résolu en plus —
  enrichissement bon marché, même join que l'acteur ; PAS de résolution
  pour "bet", qui demanderait des jointures série/match non justifiées
  pour un écran d'audit) ; motif (reason, si présent) ; avant → après
  (before_value/after_value, JSON brut mis en forme, <pre> monospace).
```

---

## 3. Filtres et tri — **acté (B5, 17/07/2026)**

```text
Tri : created_at DESCENDANT (plus récent en premier), non modifiable —
  pas un tableau triable comme le Classement, un JOURNAL se lit
  chronologiquement.
Filtres (querystring, formulaire GET natif) :
  - action  : <select> parmi les actions RÉELLEMENT présentes en base
    (DISTINCT action, libellé via lib/labels/audit.ts) — pas la liste
    figée entière si certaines n'ont encore jamais été journalisées ;
  - admin   : <select> parmi les acteurs RÉELLEMENT présents (DISTINCT
    actor_user_id, pseudo résolu) — dynamique par nature (0.2.9 : "utile
    dès 2 admins actifs"), ne peut pas être une liste figée ;
  - date    : <input type="date"> — filtre sur created_at::date, un seul
    jour (pas une plage, lecture littérale de "filtre par date" au
    singulier, même convention que le filtre date de Mes pronos).
Combinables (ET logique), tous optionnels.
```

---

## 4. Couche de lecture — `lib/queries/admin-logs.ts`

```ts
export type AuditLogRow = {
  id: string;
  createdAt: string;
  actorPseudo: string; // "Système" si actor_user_id NULL
  action: string;
  actionLabel: string;
  targetType: string;
  targetId: string | null;
  targetPseudo: string | null; // uniquement si targetType === "user"
  reason: string | null;
  beforeValue: unknown;
  afterValue: unknown;
};

export type AuditLogFilters = { action?: string; actorUserId?: string; date?: string };

export async function getAuditLogs(filters: AuditLogFilters): Promise<AuditLogRow[]>;
export async function getAuditLogFilterOptions(): Promise<{
  actions: { value: string; label: string }[]; // DISTINCT réel
  actors: { value: string; label: string }[];  // DISTINCT réel
}>;
```

```text
Plafond LIMIT 100 (pas de pagination dans ce lot — écran de test/V1 précoce,
  volume actuel très faible ; à revoir si le volume grossit réellement,
  noté dans GAPS_OUVERTS.md plutôt que deviné maintenant).
```

---

## 5. États vides

```text
Aucun log du tout : « Aucune action journalisée pour l'instant. »
Filtres actifs sans résultat : « Aucun résultat pour ces filtres. » + lien
  « Réinitialiser » (vide la querystring).
```

---

## 6. Règles de rendu (T7)

```text
- CSS Modules, tokens app/tokens.css exclusivement.
- Teinte admin (--color-trend) cohérente avec les 3 écrans précédents.
- JSON avant/après : <pre> en police monospace système (`ui-monospace,
  monospace`) — AUCUN token `--font-mono` dans app/tokens.css (vérifié),
  pas une "valeur de police en dur" au sens T7 (qui régit couleurs/espaces/
  rayons), un empilement de polices système fonctionnel comme ailleurs dans
  le CSS (bordures, box-sizing).
```

---

## 7. Hors périmètre

```text
- Résolution, requêtes : lots séparés, partiellement bloqués par T5.
- Purge des logs : explicitement hors V1 (0.2.7 §8).
- Export (CSV, etc.) : jamais mentionné, non demandé.
```
