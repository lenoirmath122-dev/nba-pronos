# 09 — UX et interface

*S'appuie sur l'exploration directe des composants (Phase transverse) et sur deux audits UX internes antérieurs (`AUDIT_UX_16_08_2026.md`, `AVIS_EXPERT_16_08_2026.md`), dont les constats non revérifiés dans cette session sont explicitement signalés comme tels.*

## 1. Formulaires — état général

**Point fort constant** sur les 6 formulaires audités en détail (`LoginForm`, `SignupForm`, `BetForm`, `ChatComposer`, `BugReportButton`, `DeleteBetButton`) :
- Double-submit systématiquement empêché (bouton `disabled` piloté par `pending`/`isPending`, React 19 `useActionState`/`useTransition`).
- Erreurs affichées via `role="alert"` de façon cohérente.
- Saisie conservée en cas d'échec (champs non contrôlés + comportement natif des form actions, ou état contrôlé jamais réinitialisé sur erreur).
- États de succès dédiés plutôt qu'une fermeture automatique silencieuse (ex. `BugReportButton` affiche un état "Envoyé" explicite, avec un délai de 200ms avant fermeture pour éviter un flash visuel).

## 2. Navigation et retour arrière

- Redirection dure `/play/bracket` → `/bracket` après la deadline du bracket, **sans conserver les paramètres d'URL** (`?round=...` perdu) — constat de l'audit UX du 16/08, **non revérifié dans cette session**.
- Un ID de ligue invalide dans le chat renvoie désormais vers la liste des canaux (comportement changé depuis l'introduction de la liste de canaux le 27/08) plutôt qu'un repli silencieux — amélioration constatée par rapport au comportement plus ancien du classement (qui, lui, retombe silencieusement sur le classement Général).

## 3. Boutons d'action irréversible — bon niveau de friction

Patron de confirmation cohérent et systématique : dialogue `role="alertdialog"` + boutons Annuler/Confirmer tous deux désactivés pendant le traitement. Niveau de friction gradué selon la criticité :
- Suppression de pari, suppression de match, clôture de compétition : confirmation en un clic dans un dialogue avec libellé explicite ("Irréversible").
- **Suppression de compte** : friction volontairement plus élevée — confirmation par **saisie du pseudo exact**, pas un simple clic. Choix cohérent avec la criticité de l'action.

## 4. États vides / chargement

- Un seul composant `EmptyState` générique existe (`components/home/EmptyState.tsx`), réutilisé par son appelant avec titre/sous-titre personnalisés — pas de composant dédié équivalent trouvé dans `play/`, `leaderboard/`, `my-bets/` en propre.
- Pas de composant "Skeleton" — le chargement repose sur un `Spinner` générique (`role="status"`, `aria-label="Chargement"`, figé si `prefers-reduced-motion`) branché sur les `loading.tsx` de segments Next.js App Router. Certains segments (`my-bets`, `play` spécifique) n'ont pas de `loading.tsx` dédié et héritent du loader du groupe parent — cohérence globale correcte, granularité de feedback de chargement perfectible sur ces segments.

## 5. Responsive

**Constat majeur, catégorisé `UX-002`** : 0 classe Tailwind responsive (`sm:/md:/lg:/xl:`) dans tout le code, seulement 5 fichiers CSS Modules sur 120 avec une `@media` query. L'application fonctionne comme une app mobile à largeur plafonnée sur desktop, sans réel layout adaptatif. Cohérent avec le constat de l'avis qualitatif interne (16/08) : le Bracket "reste une pile de panneaux empilés par tour" plutôt qu'un arbre visuel qui tirerait parti d'un grand écran.

## 6. Identité visuelle — point fort confirmé

Un vrai design system existe (`app/tokens.css`, architecture à deux couches primitifs/sémantiques), avec un thème "photo/verre" (fresque, terrain vu du dessus) identifié comme un différenciateur net face à la concurrence directe regardée (HoopCall, Scorecast, ParidAmis — UI générique de type template selon l'avis qualitatif interne). Le système de badges (carte qui se retourne au clic, couleurs par palier) est également cité comme un niveau de polish supérieur à la concurrence.

## 7. Bugs UX connus (à statut non revérifié dans cette session)

| Constat (16/08/2026) | Fichiers | Statut dans cet audit |
|---|---|---|
| Bouton "Parier" affiché (mais non actionnable) sur une série terminée/annulée/reportée | `lib/queries/bracket.ts` (`myBetAction`) | **Non revérifié** — affordance trompeuse identifiée à l'époque, pas exploitable (le formulaire rejette la tentative) |
| Libellé "Hier" potentiellement inexact sur la tendance de classement si le cron quotidien a raté une exécution | `components/leaderboard/LeaderboardRow.tsx` | **Non revérifié** |
| Nœud de bracket sans conférence silencieusement supprimé du rendu (dormant, aucune donnée réelle ne déclenche ce cas aujourd'hui) | `components/bracket/SeriesDrillDown.tsx` | **Non revérifié**, risque jugé dormant |
| Lien "Parier" atteignable au clavier dans une carte marquée `aria-disabled` | `components/bracket/NodeCard.tsx` | **Non revérifié** — incohérence a11y |
| Erreur d'hydratation React sur `NotificationSettings` (état dépendant du navigateur lu pendant le rendu serveur) | `components/profile/NotificationSettings.tsx` | **Non revérifié** |

Ces points sont repris ici pour traçabilité (ils existaient dans la documentation interne et n'ont pas de preuve de correction trouvée dans cette session) — voir recommandation de re-vérification dans `PLAN_ACTION.md`.

## 8. Parcours par rôle

- **Visiteur (non connecté)** : Classement et Bracket publics accessibles sans compte, confirmé fonctionnel lors de l'audit du 16/08 (non revérifié ici).
- **Joueur** : parcours principal (pronostics, bracket, paris, classement, chat) couvert par les composants audités, bon niveau de finition sur les formulaires.
- **Admin** : panneau complet, gardes d'autorisation revérifiées côté serveur (Phase 7).

## Anomalies de cette phase

`UX-001` (absence de focus-trap dans les modales), `UX-002` (responsive quasi absent) — détaillées dans `ANOMALIES.md`.

## Limites de cette phase

Aucun test dans un vrai navigateur n'a été effectué dans cette session (pas d'accès navigateur dans cet environnement d'audit) — l'analyse repose sur la lecture du code des composants, complétée par les constats d'audits internes antérieurs eux-mêmes basés sur des parcours réels (Playwright, comptes réels), explicitement signalés comme non revérifiés ici lorsque c'est le cas.
