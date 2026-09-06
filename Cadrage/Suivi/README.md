# Cadrage/Suivi/ — quel fichier pour quoi

Ce dossier regroupe les documents de **suivi** du projet (état, décisions,
gaps, historique) — distinct de `Cadrage/Fonctionnel/` et `Cadrage/V1/`
(specs produit/techniques figées) et de `audit/` (audit indépendant
sécurité/qualité du 03/09/2026, périmètre et convention propres, voir sa
note en bas de page).

Deux natures de document coexistent ici, indiquées par un bloc **Nature**
en tête de chaque fichier quand il existe :

- **Vivant** — mis à jour en continu, censé refléter l'état courant.
- **Figé** — instantané daté d'une session/décision précise, jamais rouvert
  ensuite. Une info obsolète dans un fichier figé est normale et attendue,
  ce n'est pas un bug à corriger.

## Fichiers vivants

| Fichier | Rôle |
|---|---|
| [`ETAT_ACTUEL.md`](ETAT_ACTUEL.md) | Vue d'ensemble de l'état RÉEL du projet — architecture, fonctionnalités livrées, conventions. Réécrit entièrement à chaque mise à jour, jamais accumulé. Point d'entrée pour reprendre le projet à froid. |
| [`GAPS_OUVERTS.md`](GAPS_OUVERTS.md) | Liste des points fonctionnels/produit encore ouverts. Un point retiré = un point traité (la trace du traitement va dans `JOURNAL_SESSIONS.md`, pas ici). |
| [`JOURNAL_SESSIONS.md`](JOURNAL_SESSIONS.md) | Journal chronologique append-only : qui a changé quoi, quand, pourquoi. Jamais réécrit, seulement complété. |
| [`BACKLOG_V1.md`](BACKLOG_V1.md) | Backlog produit (idées/fonctionnalités à considérer). Garde les items faits en `~~barré~~` plutôt que de les retirer — accepté tel quel, volume encore gérable. |

## Fichiers figés (historique)

| Fichier | Date | Rôle |
|---|---|---|
| [`AUDIT_UX_16_08_2026.md`](AUDIT_UX_16_08_2026.md) | 16/08/2026 | Audit UX + revue de code ponctuelle (agents + clic réel). |
| [`AVIS_EXPERT_16_08_2026.md`](AVIS_EXPERT_16_08_2026.md) | 16/08/2026 | Avis subjectif/pistes de discussion, même session que ci-dessus — jamais tranché en l'état. |
| [`AUDIT_TYPES_PARIS_24_08_2026.md`](AUDIT_TYPES_PARIS_24_08_2026.md) | 24/08/2026 | Audit ponctuel : couverture réelle des types de paris personnalisés vs. code. |
| [`SPEC_CHAT_V0_1.md`](SPEC_CHAT_V0_1.md) | 27/08/2026 | Spec de la fonctionnalité chat (livrée depuis) — gardée comme mémoire de conception. |
| [`NBA_CUP_ALPHA_EFFECTIFS.md`](NBA_CUP_ALPHA_EFFECTIFS.md) + `.csv` | 28/08/2026 | Effectifs réels générés pour l'alpha NBA Cup fictive (rosters de test). |
| [`BILAN_GLOBAL_01_09_2026.md`](BILAN_GLOBAL_01_09_2026.md) | 01/09/2026 | Bilan global ponctuel — pour l'état courant, préférer `ETAT_ACTUEL.md` (les chiffres ici datent). |

## `archive/` — contenu pré-restructuration

`ETAT_ACTUEL.md` et `GAPS_OUVERTS.md` avaient dérivé en journaux
accumulés (respectivement 7 828 et 4 505 lignes), à rebours de leur propre
règle de fonctionnement — restructurés le 06/09/2026. Le contenu intégral
d'avant restructuration est conservé, non modifié, dans
[`archive/`](archive/) pour référence historique. Ne pas y ajouter de
nouveau contenu — `JOURNAL_SESSIONS.md` est la référence pour tout ce qui
est chronologique.

## Voir aussi `audit/`

`audit/` (racine du dépôt) est un audit indépendant sécurité/qualité/UX du
03/09/2026, avec son propre tracker d'anomalies (`ANOMALIES.md`) et son plan
d'action (`PLAN_ACTION.md`, 19 items en 4 vagues). Périmètre distinct de
`GAPS_OUVERTS.md` (produit/fonctionnel) — les deux ne sont pas dupliqués,
vérifier les deux pour une vue complète des points ouverts. `audit/` reste
un instantané figé de son propre jour d'exécution : ne pas y répercuter les
décisions/corrections ultérieures, elles vivent dans `ETAT_ACTUEL.md` et
`GAPS_OUVERTS.md`.
