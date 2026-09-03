# 14 — Documentation

## 1. Constat général

Situation atypique et à double tranchant. La documentation de **suivi de projet** (`Cadrage/Suivi/`) est exceptionnellement riche, précise et à jour — probablement plus rigoureuse que la moyenne des projets de cette taille. En revanche, la documentation **d'onboarding technique** (celle qu'un nouveau développeur ou qu'un outil consulterait en premier) est quasi absente ou trompeuse.

## 2. Onboarding développeur

| Élément attendu | État | Preuve |
|---|---|---|
| `README.md` | **Générique** — boilerplate `create-next-app` par défaut, aucune mention de Supabase, des variables d'environnement, ou des commandes spécifiques au projet | `README.md` (`DOC-001`) |
| Prérequis / variables d'environnement | Non documentées dans un fichier dédié (`.env.example` absent) — l'inventaire des variables n'existe que dans `.env.local` lui-même (non versionné) | Absence de `.env.example` constatée |
| Lancement / build / tests | Scripts npm standards (`dev`, `build`, `start`, `lint`, `test`) présents dans `package.json`, mais non explicités dans un README | `package.json` |
| Architecture | Documentée en profondeur mais dispersée dans `Cadrage/V1/SPEC_TECHNIQUE_*` (9 fichiers), sans point d'entrée unique qui les référence tous | `Cadrage/V1/` |
| Modèle de données | `Cadrage/V1/SPEC_TECHNIQUE_MODELE_DONNEES_V0.1.md` existe mais son degré de synchronisation avec les 85 migrations réelles n'a pas été vérifié exhaustivement dans cette session (échantillonné, non comparé ligne à ligne) | — |
| Rôles / permissions | Documentées dans `SPEC_TECHNIQUE_RLS_V0.1.md` et `SPEC_TECHNIQUE_AUTH_V0.1.md`, cohérentes avec le code au niveau des principes généraux vérifiés (Phase 7) | — |
| Procédures d'incident | Aucune procédure formelle trouvée (pas de runbook "que faire si Supabase est en pause", "que faire si le heartbeat s'est désactivé") — le risque `OPS-001` n'a pas de procédure de reprise documentée | — |
| Conventions de code | Implicites (cohérence observée dans le code : queries/actions séparées, CSS Modules) mais non écrites dans un `CONTRIBUTING.md` ou équivalent | Absence constatée |

## 3. Documentation métier / produit

Remarquablement complète et à jour, mais **volumineuse et non indexée** (`DOC-002`) :
- `Cadrage/Suivi/ETAT_ACTUEL.md` (7828 lignes), `JOURNAL_SESSIONS.md` (12617 lignes), `GAPS_OUVERTS.md` (4505 lignes) — journal chronologique inversé (plus récent en tête), riche en détails et en preuves, mais sans table des matières ni index par fonctionnalité qui permettrait une recherche ciblée sans lecture linéaire ou grep.
- `Cadrage/Fonctionnel/`, `Cadrage/V1/` — specs fonctionnelles/techniques, certaines explicitement signalées comme closes/figées, d'autres comme dépassées (l'équipe elle-même prévient que le document `nba_pronos_resume_cadrage_valide.md` est "largement dépassé").
- Audits ponctuels bien conservés (`AUDIT_UX_16_08_2026.md`, `AVIS_EXPERT_16_08_2026.md`, `AUDIT_TYPES_PARIS_24_08_2026.md`, `security-audit-report.md`, `BILAN_GLOBAL_01_09_2026.md`) — bonne pratique de traçabilité, chacun daté et contextualisé.

## 4. Documentation légale

`Cadrage/Juridique/` (CGU, mentions légales, politique de confidentialité, conseils juridiques de déploiement) — semble suivie avec sérieux (mise à jour de `politique_confidentialite.md` documentée au moment de l'ajout du self-service de suppression/export). Le point non résolu documenté (`Cadrage/Suivi/GAPS_OUVERTS.md`) est la base légale précise pour les 15-17 ans, explicitement notée comme nécessitant un avis juridique professionnel — non codable, correctement identifiée comme telle plutôt que contournée.

## 5. Contradictions / obsolescence identifiées

- `nba_pronos_resume_cadrage_valide.md` (cadrage initial) vs specs `V1`/décisions actées : l'équipe documente elle-même cette obsolescence relative — pas une contradiction non détectée, une hiérarchie de sources explicitement assumée.
- `security-audit-report.md` (29/08/2026) : toujours présent à la racine du dépôt en l'état d'origine, alors que la quasi-totalité de ses findings sont désormais corrigés (Phase 7) — le document lui-même n'a pas été mis à jour pour refléter les correctifs (c'est `ETAT_ACTUEL.md`/`GAPS_OUVERTS.md` qui portent cette information, ailleurs). Un lecteur qui ne consulterait que `security-audit-report.md` isolément se ferait une image datée et trop pessimiste de l'état de sécurité actuel.

## Anomalies de cette phase

`DOC-001`, `DOC-002` (détaillées dans `ANOMALIES.md`).

### DOC-003 — `security-audit-report.md` non mis à jour après correction de ses findings

- **Catégorie** : Documentation
- **Gravité** : P4 Mineur
- **Niveau de confiance** : Élevé
- **Statut de vérification** : Vérifié
- **Description** : le rapport d'audit sécurité du 29/08 reste dans son état d'origine (15 findings, dont 11 corrigés depuis d'après cette session) — un lecteur pressé pourrait le prendre pour l'état courant.
- **Solution recommandée** : ajouter un bandeau en tête du document renvoyant vers `audit/07-securite.md` (ce présent audit) pour l'état à jour, ou archiver le fichier avec une date claire dans son nom.

## Limites de cette phase

`Cadrage/V1/SPEC_TECHNIQUE_MODELE_DONNEES_V0.1.md` et les autres specs techniques `V1` n'ont pas été comparées ligne à ligne aux 85 migrations réelles dans cette session (l'essentiel de la vérification du modèle de données s'est appuyé directement sur le code SQL, jugé plus fiable — Phase 6). Le degré de dérive exact entre ces specs et l'implémentation n'est donc pas quantifié précisément.
