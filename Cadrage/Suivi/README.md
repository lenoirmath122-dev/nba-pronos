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

## Méthode de travail

Toute reprise de développement suit la même règle, une étape à la fois :

1. **Une seule étape par conversation** (un écran, un chantier, un correctif
   de fond). Pas d'enchaînement de plusieurs étapes dans la même session. Si
   la prochaine étape n'est pas évidente, la soumettre explicitement à
   l'utilisateur plutôt que de la deviner.
2. **Documenter avant de s'arrêter, pas après coup** : mettre à jour
   `JOURNAL_SESSIONS.md` (nouvelle entrée), `ETAT_ACTUEL.md` et
   `GAPS_OUVERTS.md` pour refléter ce qui vient d'être fait et ce qui reste
   ouvert — avant de considérer la session terminée.
3. **Reprendre dans une nouvelle conversation**, en relisant d'abord ce
   fichier puis les 3 fichiers vivants ci-dessous.

## Fichiers vivants

| Fichier | Rôle |
|---|---|
| [`ETAT_ACTUEL.md`](ETAT_ACTUEL.md) | Vue d'ensemble de l'état RÉEL du projet — architecture, fonctionnalités livrées, conventions. Réécrit entièrement à chaque mise à jour, jamais accumulé. Point d'entrée pour reprendre le projet à froid. |
| [`GAPS_OUVERTS.md`](GAPS_OUVERTS.md) | Liste des points fonctionnels/produit encore ouverts. Un point retiré = un point traité (la trace du traitement va dans `JOURNAL_SESSIONS.md`, pas ici). |
| [`JOURNAL_SESSIONS.md`](JOURNAL_SESSIONS.md) | Journal chronologique append-only : qui a changé quoi, quand, pourquoi. Seulement complété — sauf compression périodique quand il devient trop long (voir `archive/` ci-dessous), qui réécrit le fichier en synthèse sans en changer le principe append-only pour la suite. |
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
règle de fonctionnement — restructurés le 06/09/2026. `JOURNAL_SESSIONS.md`
avait le problème inverse : sa règle (append-only) était respectée, mais
sans jamais être compressée il avait atteint 12 966 lignes — compressé à
son tour le 18/09/2026, en une ligne de synthèse par session (le titre de
chaque section, déjà rédigé comme un résumé). Le contenu intégral
d'avant restructuration/compression est conservé, non modifié, dans
[`archive/`](archive/) pour référence historique. Ne pas y ajouter de
nouveau contenu.

Règle générale pour les trois fichiers vivants : quand un fichier redevient
trop long pour être relu d'une traite en début de session, archiver sa
version complète sous `archive/NOM_FICHIER_archive_jusquau_AAAA-MM-JJ.md`
(jamais modifiée ensuite), puis réécrire le fichier actif en version
courte qui pointe vers l'archive pour le détail.

## Voir aussi `audit/`

`audit/` (racine du dépôt) est un audit indépendant sécurité/qualité/UX du
03/09/2026, avec son propre tracker d'anomalies (`ANOMALIES.md`) et son plan
d'action (`PLAN_ACTION.md`, 19 items en 4 vagues). Périmètre distinct de
`GAPS_OUVERTS.md` (produit/fonctionnel) — les deux ne sont pas dupliqués,
vérifier les deux pour une vue complète des points ouverts. `audit/` reste
un instantané figé de son propre jour d'exécution : ne pas y répercuter les
décisions/corrections ultérieures, elles vivent dans `ETAT_ACTUEL.md` et
`GAPS_OUVERTS.md`.
