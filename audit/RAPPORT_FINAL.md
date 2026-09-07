# Rapport final d'audit — nba-pronos

*Audit complet réalisé le 03/09/2026, en lecture seule, sur la branche `main` (commit `cf65483`). Voir `audit/COMMANDES_EXECUTEES.md` pour la traçabilité complète des vérifications effectuées.*

## 1. Résumé exécutif

nba-pronos est une application de pronostics NBA à jouer entre amis (Next.js 16, Supabase, Claude/Anthropic pour un moteur de paris personnalisés structurés par IA), développée en ~6-7 semaines par un développeur assisté d'IA, en dialogue continu avec l'unique partie prenante produit. L'application dispose déjà d'une base de sécurité et d'architecture nettement au-dessus de la moyenne pour un projet de cette taille et de cette vitesse : autorisation entièrement portée en base (RLS + fonctions `SECURITY DEFINER` + triggers d'invariants), un audit de sécurité antérieur (29/08/2026) dont 11 des 13 findings sont déjà corrigés et vérifiés indépendamment dans cette session, et une documentation de suivi produit d'une rigueur rare (journal chronologique de centaines de sessions, écarts spec/code systématiquement consignés et justifiés).

Le principal écart entre le niveau d'ingénierie du cœur du système (scoring, autorisation, modèle de données) et sa robustesse mesurable reste, comme l'équipe elle-même l'a déjà diagnostiqué, la **fiabilité/QA** : 0 test de composant, 0 end-to-end, 0 test d'intégration API ou de permissions, malgré un progrès net depuis le dernier bilan interne (18 fichiers de test contre 2 au 01/09). Aucune anomalie de gravité P0 (bloquant) ou P1 (critique) n'a été identifiée. Le produit est prêt pour son contexte actuel (cercle fermé d'amis, alpha) ; une ouverture à un public plus large mérite de traiter en priorité la suppression de compte non transactionnelle, le rate limiting applicatif, et l'absence de tests automatisés sur les permissions.

## 2. Périmètre réellement audité

- Intégralité du code applicatif TypeScript (`app/`, `components/`, `lib/`), 66 migrations SQL [le chiffre "85" initialement écrit ici était une erreur de comptage — corrigé le 07/09/2026, 69 migrations au 07/09/2026, voir `audit/ANOMALIES.md`], 9 workflows GitHub Actions, configuration de build/déploiement (`next.config.ts`, `vercel.json`, `package.json`).
- Documentation de suivi interne échantillonnée en profondeur (audits antérieurs intégraux, entrées les plus récentes des journaux volumineux).
- Exécution réelle : `tsc --noEmit`, `eslint`, `vitest run` (224 tests), `npm audit`, `npm run build` (production).
- 5 axes d'exploration indépendante en profondeur : architecture/authentification/autorisations, logique métier (scoring, IA, sync), modèle de données/RLS, état actuel des findings de sécurité antérieurs, frontend/UX/tests/CI.

## 3. Éléments non accessibles ou non vérifiables

- Configuration réelle du dashboard Supabase de production (rate-limiting, CAPTCHA serveur, plan de facturation, Leaked Password Protection) — accessible uniquement via le dashboard, hors périmètre de cet audit du dépôt de code.
- Code source du micro-service Python (Cloud Run) au-delà de sa documentation de déploiement et de son middleware d'authentification.
- `Cadrage/Suivi/ETAT_ACTUEL.md` (7828 lignes) et `JOURNAL_SESSIONS.md` (12 617 lignes) — échantillonnés, non lus intégralement.
- Aucun test dans un vrai navigateur (Lighthouse, lecteur d'écran réel, zoom/reflow) — pas d'accès navigateur dans cet environnement.
- Comportement réel en cas de panne HTTP du micro-service de calcul de probabilités (identifié comme point à vérifier, pas comme confirmé problématique).

## 4. Compréhension synthétique de l'application

Pronostics de matchs, remplissage de bracket de playoffs (+ format NBA Cup), paris personnalisés en texte libre structurés et résolus automatiquement par IA (fonctionnalité différenciante, ~4000 lignes, couverture réelle mesurée à 69% des formulations testées), classement avec ligues privées, badges à paliers, chat temps réel, panneau d'administration complet, self-service de suppression/export de compte (RGPD). Voir `01-inventaire-et-architecture.md` et `02-cartographie-fonctionnelle.md` pour le détail complet.

## 5. Architecture actuelle

Next.js 16 App Router (avec conventions propres à cette version, notées dans `AGENTS.md`), Server Actions pour l'écriture, requêtes dédiées pour la lecture, autorisation intégralement en base Postgres/Supabase. Trois clients Supabase cloisonnés, services externes (Anthropic, Highlightly, Cloud Run, Web Push) isolés chacun dans leur module `server-only`. Voir `04-architecture-et-maintenance.md`.

## 6. Parcours fonctionnels principaux

Détaillés dans `02-cartographie-fonctionnelle.md` avec matrice complète (frontend/backend/stockage/règle métier/tests/anomalies par fonctionnalité).

## 7. Niveau de qualité global

`tsc` et `eslint` propres à 100% sur le code applicatif, 224/224 tests verts, build de production sans erreur. Voir `05-qualite-du-code.md` et la `SCORECARD.md` pour le détail par axe.

## 8. Niveau de préparation à la production

**Pour le contexte actuel (cercle fermé, alpha)** : élevé. **Pour une ouverture à un public plus large** : des jalons concrets restent à franchir — voir Vague 1 de `PLAN_ACTION.md`.

## 9. Risques majeurs (les 5 plus significatifs)

1. **`DATA-002` (P2)** — suppression de compte non transactionnelle (~20 opérations séquentielles), risque d'état partiellement supprimé en cas d'interruption.
2. **`BUG-003` (P2)** — vérification de présence au roster dans le pipeline IA reposant uniquement sur la connaissance générale du modèle, sans donnée réelle injectée (2 erreurs déjà constatées sur 30 paris testés).
3. **`OPS-001` (P2)** — le workflow `heartbeat.yml` anti-pause peut s'auto-désactiver silencieusement après 60 jours sans commit, sans alerte, menaçant la disponibilité complète de l'application pendant les périodes creuses.
4. **`TEST-001`/`TEST-002` (P2)** — absence totale de tests automatisés sur les permissions/RLS et sur les parcours utilisateur (e2e/composants) : le mécanisme de sécurité le plus critique du projet et l'expérience utilisateur ne sont vérifiés qu'à la main.
5. **`SEC-001` (P3, mais à surveiller si le produit grandit)** — absence de rate limiting applicatif sur le chat, les paris et les signalements.

## 10. Vulnérabilités de sécurité

Aucune de gravité P0/P1/P2. 11 des 13 findings de l'audit sécurité antérieur (29/08/2026) sont pleinement corrigés et revérifiés indépendamment dans cette session (rotation de la clé `service_role`, protection du micro-service Cloud Run, CAPTCHA vérifié serveur, headers de sécurité HTTP complets, comparaison timing-safe, autorisations explicites, RGPD self-service). Détail complet dans `07-securite.md`.

## 11. Risques liés aux données

RLS activée sur 100% des 31 tables (vérifié exhaustivement). Point le plus significatif : absence de transaction SQL sur les opérations multi-tables les plus sensibles (suppression de compte), compensée ailleurs par une idempotence bien conçue (scoring, résolution de paris). Pattern récurrent à surveiller : 5 migrations correctives déjà nécessaires suite à l'ajout d'un nouveau statut/colonne sans revue systématique des objets dépendants. Détail dans `06-donnees-et-integrite.md`.

## 12. Bugs fonctionnels

`BUG-002` (deadline de pari dupliquée en 4 endroits), `BUG-003` (roster IA non vérifié). `BUG-001` (désync live du Bracket) s'est avéré déjà corrigé le 16/08/2026, vérifié le 03/09/2026. Détail dans `02-cartographie-fonctionnelle.md` et `ANOMALIES.md`.

## 13. Problèmes d'architecture

Aucun problème structurel majeur. Quelques duplications mineures cataloguées (`ARCH-001` à `ARCH-003`), toutes de gravité P4, aucune ne menaçant la cohérence actuelle du système. Détail dans `04-architecture-et-maintenance.md`.

## 14. Problèmes UX et accessibilité

Formulaires soignés, identité visuelle différenciante, friction de confirmation bien graduée. Deux limites concrètes : absence quasi totale de responsive desktop (`UX-002`) et absence de piège de focus dans les modales, y compris sur les actions les plus critiques (`UX-001`/lié à l'accessibilité). Aucun outil d'audit a11y automatisé en CI (`A11Y-002`). Détail dans `09-ux-et-interface.md` et `10-accessibilite.md`.

## 15. Problèmes de performance

Aucun problème mesuré activement dans cette session (build propre, ~30s, bundle JS d'ordre de grandeur raisonnable — 1.6 Mo total, code-splitté). Observation notable : toutes les routes sont rendues dynamiquement (aucune page statique/ISR). Plusieurs pistes d'optimisation identifiées par un audit interne antérieur n'ont pas été revérifiées ni mesurées avec des outils réels dans cette session. Détail dans `11-performances.md`.

## 16. État des tests

224 tests (18 fichiers), tous verts, couvrant la logique métier pure la plus critique (scoring, résolution de paris IA). Progrès net depuis le dernier bilan interne (2 fichiers au 01/09). Absence totale de tests de composant, e2e, d'intégration API, de permissions/RLS, de fuseau horaire ou de concurrence. Détail dans `12-tests-et-strategie-qa.md`.

## 17. État du déploiement et de l'observabilité

CI bloquante en place (lint/typecheck/test/build), déploiement Vercel automatique. Absence de garde-fou de séquencement code/migration (`OPS-004`, déjà rencontré en pratique une fois), absence d'alerte proactive et d'outil d'observabilité externe (`OPS-001`). Détail dans `13-production-et-exploitation.md`.

## 18. Dette technique

Modérée et bien identifiée : duplications documentées et assumées par l'équipe elle-même dans plusieurs cas (barèmes, deadline de pari), fonctions longues candidates à un découpage (`resolveCalculableBets.ts`, 2561 lignes), documentation d'onboarding technique quasi absente malgré une documentation produit exceptionnelle.

## 19. Points positifs de la V1

- Modèle d'autorisation en profondeur (RLS + `SECURITY DEFINER` + triggers) rare pour un projet de cette échelle.
- Réactivité et rigueur de correction : 11/13 findings de sécurité corrigés en quelques jours, avec vérification indépendante confirmant chaque correctif.
- Pipeline de paris personnalisés par IA : fonctionnalité différenciante réelle, avec une gestion de panne exemplaire (jamais bloquante) et une couverture de test désormais substantielle (16 fichiers dédiés).
- Documentation de suivi produit d'une rigueur rare — écarts spec/implémentation systématiquement consignés et justifiés, pas découverts après coup.
- Progrès mesurable et récent sur les tests (2 → 18 fichiers) et sur la conformité RGPD (self-service de suppression/export livré le jour même de sa dernière décision de cadrage).

## 20. Quick wins

- README réel + `.env.example` (`DOC-001`, effort XS).
- `npm audit` en CI + correction de la dérive `browserslist` (`OPS-003`/`SEC-002`, effort XS).
- Bandeau de mise à jour sur `security-audit-report.md` (`DOC-003`, effort XS).
- Rate limiting applicatif de base (`SEC-001`, effort S).
- Focus-trap sur `ModalDialog.tsx`, bénéficie à tous les dialogues qui le réutilisent (`UX-001`, effort S).

## 21. Actions obligatoires avant production (au sens : avant ouverture au-delà du cercle actuel)

Voir Vague 1 de `PLAN_ACTION.md` : suppression de compte transactionnelle (`DATA-002`), rate limiting applicatif (`SEC-001`), tests d'intégration RLS minimaux (`TEST-002`) — les 2 autres actions de cette vague (comportement de panne du micro-service Cloud Run, statut `POSTPONED`) se sont avérées déjà correctes et robustes, vérifiées le 03/09/2026 sans nécessiter de correctif.

## 22. Actions recommandées après lancement

Voir Vagues 2 à 4 de `PLAN_ACTION.md` : injection de données de roster réelles dans le pipeline IA, factorisation de la deadline de pari, alerte de disponibilité, suite e2e, décision produit sur le responsive, outillage d'accessibilité automatisé (le bug live du Bracket, initialement listé ici, s'est avéré déjà corrigé le 16/08/2026).

## 23. Conclusion générale

nba-pronos est un projet dont le cœur technique (sécurité, autorisation, modèle de données, logique métier) est significativement plus mature que ce que sa taille et son rythme de développement laisseraient attendre — confirmé par vérification indépendante, pas seulement par l'auto-évaluation de l'équipe. Le principal chantier restant, déjà identifié en interne et confirmé par cet audit, est de faire monter la fiabilité mesurable (tests automatisés de permissions et de parcours utilisateur) et l'observabilité au même niveau que le reste du système, avant d'envisager une ouverture au-delà du cercle fermé actuel. Aucune anomalie bloquante n'empêche la poursuite de l'usage actuel en l'état.

---

## Tableau de synthèse des anomalies

| ID | Titre | Priorité | Catégorie | Zone | Impact | Effort estimé | Confiance | Dépendances |
|---|---|---|---|---|---|---|---|---|
| DATA-002 | Suppression de compte non transactionnelle | P2 | Données | `lib/actions/account.ts` | Perte/incohérence de données possible | M | Élevé | — |
| BUG-003 | Roster IA non vérifié par données réelles | P2 | Bug | `lib/ai/structureBet.ts` | Paris légitimes jugés non calculables à tort | L | Élevé | — |
| OPS-001 | Heartbeat auto-désactivable après 60j | P2 | Exploitation | `.github/workflows/heartbeat.yml` | Indisponibilité totale silencieuse | S | Élevé | — |
| TEST-001 | 0 test composant/e2e/intégration API | P2 | Tests | Tout le frontend/API | Régressions non détectées | L | Élevé | — |
| TEST-002 | 0 test RLS/permissions | P2 | Tests | Modèle d'autorisation | Régression de sécurité non détectée | L | Élevé | A1 (Vague 1) |
| SEC-001 | Pas de rate limiting applicatif | P3 | Sécurité | Chat/paris/bug reports | Abus possible | S | Élevé | — |
| BUG-001 | Désync live Bracket — **corrigé le 16/08/2026**, vérifié 03/09 | P4 | Bug | `components/bracket/*` | Aucun (déjà résolu) | — | Élevé | — |
| BUG-002 | Deadline pari dupliquée x4 | P3 | Bug/dette | `lib/queries/{home,admin-dashboard}.ts` | Divergence silencieuse possible | S | Élevé | — |
| UX-001 | Pas de focus-trap modales | P3 | UX/A11y | `components/ui/ModalDialog.tsx` | Accessibilité clavier incomplète | S | Élevé | — |
| UX-002 | Responsive quasi absent | P3 | UX | Toute l'UI | Sous-exploitation desktop | Décision + L | Élevé | — |
| TEST-003 | 0 test fuseau/concurrence | P3 | Tests | `lib/dates/*`, résolution paris | Régression non détectée | M | Élevé | — |
| OPS-002 | Décision SMTP non tranchée | P3 | Exploitation | Auth signup | Échec d'inscription en rafale | Décision | Moyen | — |
| OPS-004 | Pas de garde-fou séquencement migration | P3 | Exploitation | Pipeline déploiement | Erreur applicative post-déploiement | M | Moyen | — |
| DATA-001 | Statuts ajoutés sans revue systématique | P3 | Données | `supabase/migrations/*` | Bug de contrainte récurrent | Process | Élevé | — |
| DATA-003 | Quota paris sans backstop index | P3 | Données | `save_bet` | Contournement théorique | S | Moyen | — |
| DATA-007 | `age_confirmed_at` horodaté inconditionnellement | P3 | Données/Légal | `lib/auth/actions.ts` | Preuve de conformité fragile | Décision légale | Élevé | — |
| SEC-002 à SEC-004, BUG-002, ARCH-001 à ARCH-003, A11Y-001/002, DATA-004/005/006, DOC-001/002/003, OPS-003 | (16 anomalies) | P4 | Divers | Divers | Mineur | XS-S | Élevé | — |

*(Détail complet des 31 anomalies dans `audit/ANOMALIES.md`.)*

## Contrôle final de cohérence

- Les 30 anomalies mentionnées dans ce rapport existent toutes dans `ANOMALIES.md` avec le même identifiant.
- Toutes les anomalies P2/P3 figurent dans `PLAN_ACTION.md` (Vagues 1-2) ; les P4 figurent en Vague 3-4.
- Aucune recommandation de ce rapport ne contredit une autre (vérifié par relecture croisée des 15 fichiers de phase).
- Chiffres vérifiés : 31 anomalies (0 P0, 0 P1, 5 P2, 9 P3, 17 P4 — `BUG-001` reclassé P3→P4/corrigé le 03/09/2026, voir `ANOMALIES.md`), 224 tests, 66 migrations [corrigé le 07/09/2026, "85" était une erreur de comptage], 18 fichiers de test, 5 agents d'exploration.
- **Vérification finale de l'état Git** effectuée après rédaction de ce rapport : voir ci-dessous.
