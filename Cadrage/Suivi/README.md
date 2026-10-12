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

1. **Une seule étape par conversation** (un écran, un chantier, un correctif
   de fond). Si la prochaine étape n'est pas évidente, la soumettre à
   l'utilisateur plutôt que de la deviner.
2. **Début de session : lire uniquement [`REPRISE.md`](REPRISE.md)** (20
   lignes). Ouvrir ensuite seulement ce dont la tâche a besoin : la section
   utile d'`ETAT_ACTUEL.md`, le résumé du chantier dans `GAPS_OUVERTS.md`, le
   fichier du chantier dans `chantiers/`. Ne pas relire le dossier en entier,
   ne pas lancer de sous-agent pour le lire, ne jamais ouvrir `archive/`
   sauf demande explicite.
3. **Fin de session (passation), avant de s'arrêter** :
   - réécrire `REPRISE.md` en entier (20 lignes max : objectif, fait,
     prochaine étape, échéances, points ouverts, pièges) ;
   - ajouter **une ligne** à `JOURNAL_SESSIONS.md` (300 caractères max :
     `- Titre-résumé (JJ/MM/AAAA) — PR #n`) ;
   - `GAPS_OUVERTS.md` et `chantiers/` : seulement si un point est ouvert ou
     fermé (un point fermé est retiré, jamais barré) ;
   - `ETAT_ACTUEL.md` : seulement si l'architecture ou une fonctionnalité
     livrée change.
4. **Reprendre dans une nouvelle conversation.**

## Fichiers vivants

| Fichier | Rôle | Lu en début de session ? |
|---|---|---|
| [`REPRISE.md`](REPRISE.md) | Passation : où on en est, prochaine étape. Réécrit à chaque fin de session. | **Oui, seul fichier lu** |
| [`GAPS_OUVERTS.md`](GAPS_OUVERTS.md) | Points ouverts uniquement, avec un résumé de chaque chantier en cours. | Non, à la demande |
| [`chantiers/`](chantiers/) | Détail d'un gros chantier (un fichier par chantier). | Non, seulement le chantier en cours |
| [`ETAT_ACTUEL.md`](ETAT_ACTUEL.md) | Référence de l'état réel : architecture, fonctionnalités, conventions. | Non, section utile seulement |
| [`JOURNAL_SESSIONS.md`](JOURNAL_SESSIONS.md) | Une ligne par session, append-only. Le détail est dans `git log` et les PR. | Non |
| [`BACKLOG_V1.md`](BACKLOG_V1.md) | Backlog produit (idées). Items faits en `~~barré~~`. | Non |

**Seuils de taille** : `REPRISE.md` 20 lignes ; `GAPS_OUVERTS.md` ~20 Ko ;
`JOURNAL_SESSIONS.md` ~40 Ko ; un fichier de chantier ~20 Ko. Au-delà,
archiver la version complète (voir `archive/` ci-dessous) puis réécrire en
version courte.

## Fichiers figés (historique)

| Fichier | Date | Rôle |
|---|---|---|
| [`AUDIT_UX_16_08_2026.md`](AUDIT_UX_16_08_2026.md) | 16/08/2026 | Audit UX + revue de code ponctuelle (agents + clic réel). |
| [`AVIS_EXPERT_16_08_2026.md`](AVIS_EXPERT_16_08_2026.md) | 16/08/2026 | Avis subjectif/pistes de discussion, même session que ci-dessus — jamais tranché en l'état. |
| [`AUDIT_TYPES_PARIS_24_08_2026.md`](AUDIT_TYPES_PARIS_24_08_2026.md) | 24/08/2026 | Audit ponctuel : couverture réelle des types de paris personnalisés vs. code. |
| [`SPEC_CHAT_V0_1.md`](SPEC_CHAT_V0_1.md) | 27/08/2026 | Spec de la fonctionnalité chat (livrée depuis) — gardée comme mémoire de conception. |
| [`NBA_CUP_ALPHA_EFFECTIFS.md`](NBA_CUP_ALPHA_EFFECTIFS.md) + `.csv` | 28/08/2026 | Effectifs réels générés pour l'alpha NBA Cup fictive (rosters de test). |
| [`BILAN_GLOBAL_01_09_2026.md`](BILAN_GLOBAL_01_09_2026.md) | 01/09/2026 | Bilan global ponctuel — pour l'état courant, préférer `ETAT_ACTUEL.md` (les chiffres ici datent). |
| [`RETOURS_ALPHA_NBA_CUP.md`](RETOURS_ALPHA_NBA_CUP.md) + `.pdf` | 03/10/2026 | Retours joueurs de l'alpha NBA Cup (PDF source) confrontés au code et à la feuille de route. |

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

Dernier nettoyage : 12/10/2026 (journal d'octobre ramené à une ligne par
session, gros chantiers de `GAPS_OUVERTS.md` déplacés dans `chantiers/`,
`ETAT_ACTUEL.md` allégé) ; versions complètes d'avant dans `archive/*_2026-10-12.md`.
`archive/` n'est jamais lu sauf demande explicite.

Règle générale pour les fichiers vivants : quand un fichier redevient
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
