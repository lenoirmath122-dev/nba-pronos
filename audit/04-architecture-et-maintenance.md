# 04 — Architecture et maintenabilité

## 1. Séparation des responsabilités

**Globalement solide et cohérente.** Le code respecte une séparation nette :
- `lib/queries/*.ts` (lecture) vs `lib/actions/*.ts` (écriture) — jamais mélangés dans un même fichier.
- Logique métier pure (`lib/scoring/engine.ts`, testée isolément) vs orchestration (`lib/scoring/recompute.ts`) vs accès Server Action (`lib/actions/*.ts`) — trois couches distinctes, chacune avec sa propre responsabilité.
- Trois clients Supabase distincts et cloisonnés (`lib/supabase/{browser,server,service}.ts`), le client `service_role` protégé par `import "server-only"` — empêche structurellement un import accidentel côté client d'un module à privilèges élevés (le build échoue).
- Autorisation fine intégralement portée en base (RLS + `SECURITY DEFINER` + triggers), jamais un contrôle applicatif isolé — un contournement de la couche applicative (appel direct d'une Server Action) n'ouvre, dans la quasi-totalité des cas vérifiés, aucun accès non désiré (confirmé indépendamment par l'exploration architecture/sécurité de cet audit).

## 2. Couplage et cohésion

- Le pipeline IA (`lib/ai/*`, ~4000 lignes) est le module le plus couplé en interne (routage par mots-clés → 8 schémas dédiés → résolveurs dédiés), mais bien isolé du reste du code : aucun autre module n'importe directement ses internes, seule l'interface `structureAndScoreBet()` est exposée à `lib/actions/bets.ts`.
- Duplications identifiées et déjà cataloguées : barème d'écart et de difficulté dupliqués entre moteur de scoring et affichage (`ARCH-002`, `ARCH-003`), logique de deadline dupliquée en 4 endroits (`BUG-002`). Aucune de ces duplications ne menace la cohérence fonctionnelle actuelle (l'autorité de calcul reste unique), mais chacune est un point de divergence latente en cas de modification future non coordonnée.

## 3. Dépendances circulaires

Aucune dépendance circulaire évidente identifiée dans l'exploration (architecture en couches strictes `app/` → `lib/actions|queries` → `lib/scoring|ai|sync` → `lib/supabase`, sans remontée). **Non vérifié par un outil de détection automatique** (type `madge`) — absence d'un tel outil dans la CI, à ajouter en dette faible si le projet grossit.

## 4. Gestion de l'état / frontières frontend-backend

- Pas de state manager global côté client (pas de Redux/Zustand/Context complexe identifié au-delà de providers ciblés type `ChatSubscriber`) — cohérent avec une architecture Server Components/Server Actions où l'état vit majoritairement côté serveur et se rafraîchit par re-render de page.
- Le frontend **ne peut pas contourner** les règles métier critiques : les formulaires appellent des Server Actions qui elles-mêmes appellent des fonctions SQL `SECURITY DEFINER` revalidant systématiquement propriété et autorisation — vérifié explicitement sur `save_bet`, `withdraw_bet`, `delete_bet`, `request_*_correction`, `create_league`/`join_league` (re-scoping de la clause `WHERE` de l'écriture finale, pas seulement un contrôle logique en amont).

## 5. Isolation des services externes

- Anthropic, Highlightly, Cloud Run (stats), Web Push : chacun isolé dans son propre module `lib/{ai,nba,ai/statsService,push}` avec sa propre clé, jamais partagée entre modules.
- **Panne d'un service externe** : comportement vérifié différemment selon le service —
  - Anthropic (structuration IA) : panne capturée, `is_calculable=NULL`, jamais bloquant pour la soumission du pari (bon isolement).
  - Highlightly (sync) : réponse vide/partielle traitée sans erreur remontée, retentée au cycle suivant (bon isolement, mais silencieux — voir `08-api-et-integrations.md` pour le risque d'absence d'alerte).
  - Micro-service Cloud Run (proba) : appelé de façon synchrone dans le pipeline de structuration — une panne de ce service **avant** l'appel Claude n'a pas été vérifiée comme isolée dans cet audit (à confirmer, voir Phase 8).
- **Point unique de défaillance assumé** : Supabase (auth + données + RLS + Realtime). Aucun fallback documenté — cohérent avec l'échelle actuelle du projet (cercle fermé), mais à noter comme risque si le produit grandit.

## 6. Code mort / anciens composants

Peu de code mort résiduel identifié — le projet pratique un nettoyage systématique documenté (ex. retrait complet du tutoriel joueur le 21/08 : composants, migration, captures d'écran, tous supprimés le même jour plutôt que laissés en `// removed`). Points mineurs relevés par l'audit UX interne du 16/08 (non revérifiés dans cet audit) : classes CSS `.hero-banner-title`/`.hero-banner-subtitle` sans déclaration restante mais toujours posées dans le JSX de 4 écrans, et un wrapper `trendLine()` qui ne fait qu'appeler `trendTitle()` sans rien changer.

## 7. Testabilité

- Les modules les plus critiques (`lib/scoring/engine.ts`, `lib/ai/resolveCalculable*.ts`) sont écrits en fonctions pures, ce qui explique leur bonne couverture de test (224 tests, tous verts). C'est un signe de conception favorable à la testabilité, même si la couverture réelle reste étroite (voir `12-tests-et-strategie-qa.md`).
- À l'inverse, les Server Actions et routes API ne sont testables qu'en intégration (nécessitent une base Supabase) — aucun test de ce type n'existe (`TEST-001`), cohérent avec l'absence d'infrastructure de test d'intégration dans le projet à ce jour.

## 8. Concurrence et idempotence

Point fort général : la plupart des écritures sensibles sont protégées contre la concurrence par construction —
- `save_bet` : verrou `pg_advisory_xact_lock` pour le quota "3 paris MATCH/série".
- Résolution automatique de paris : chaque `UPDATE` conditionné `.eq("status","VALIDATED")` + vérification de ligne affectée → détection explicite de "déjà résolu entre-temps".
- Cycle NBA Cup Alpha (`autoReveal`/`autoCreateNextRound`) : idempotent par construction (filtre sur statut, vérification d'existence avant création).
- Recompute de scoring : idempotent par re-calcul intégral (jamais un incrément).

Point faible identifié : la suppression de compte (`deleteAccountFormAction`, ~20 opérations séquentielles sans transaction ni idempotence de rejeu) — voir `DATA-002`.

## 9. Architecture multi-utilisateur / montée en charge

Conçu et validé pour un cercle fermé d'amis (dizaines d'utilisateurs), pas pour une montée en charge significative :
- Pas de pagination sur plusieurs listes (`getChatMessages` : 200 derniers messages, pas de pagination — "simplification assumée" documentée).
- Pas de cache applicatif au-delà du cache de prompt Anthropic (`cache_control: ephemeral`).
- Aucun load-testing ou benchmark de charge documenté ou constaté.
- Ce n'est **pas un défaut** au stade actuel (le contexte d'usage — cercle fermé — est explicitement assumé par l'équipe), mais une limite à garder à l'esprit avant toute ouverture à un public plus large.

## 10. Compréhensibilité pour un nouveau développeur

Points positifs : conventions cohérentes (queries/actions séparées, CSS Modules par composant, commentaires expliquant le "pourquoi" plutôt que le "quoi" dans le code, ex. `proxy.ts` explique explicitement le modèle d'autorisation en tête de fichier). Points de friction : `AGENTS.md` prévient à raison que ce n'est "pas le Next.js standard" — un développeur non briefé sur `proxy.ts` (renommage de `middleware.ts`) ou sur le modèle "toute autorisation vit en RLS" pourrait chercher des contrôles d'accès au mauvais endroit. La documentation de contexte produit (`Cadrage/`) est riche mais volumineuse et non indexée (`DOC-002`).

## Anomalies de cette phase

Voir `ARCH-001`, `ARCH-002`, `ARCH-003`, `BUG-002` dans `ANOMALIES.md` (déjà détaillées). Aucune nouvelle anomalie d'architecture bloquante identifiée — le principal risque structurel de cette phase est la dette de gouvernance implicite si l'équipe passait d'un développeur unique + IA à une équipe distribuée (décisions actées en séance, non traçables ailleurs qu'un journal chronologique).
