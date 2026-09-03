# 03 — Conformité fonctionnelle (intentions vs implémentation)

*Source de vérité pour les intentions : `Cadrage/Fonctionnel/*`, `Cadrage/V1/SPEC_TECHNIQUE_*` (specs closes/figées), et surtout `Cadrage/Suivi/GAPS_OUVERTS.md`/`JOURNAL_SESSIONS.md`, qui documentent déjà, lot par lot, chaque écart assumé entre la spec et le code livré — avec la justification et la validation explicite de l'utilisateur. Cette phase ne redécouvre donc pas ces écarts : elle les vérifie, les recoupe avec le code actuel, et les classe selon la taxonomie demandée.*

**Avertissement méthodologique** : `Cadrage/Fonctionnel/nba_pronos_resume_cadrage_valide.md` (cadrage initial) est explicitement signalé par l'équipe elle-même comme "largement dépassé" — les specs `Cadrage/V1/SPEC_TECHNIQUE_*` et les décisions `decisions_0.2.x` closes font autorité en cas de conflit, elles-mêmes parfois dépassées par des choix actés directement avec l'utilisateur en séance (non repris dans un document de spec formel). Le code réel est donc, par endroits, la seule source de vérité disponible — utilisé comme tel, sans le transformer en certitude sur l'intention d'origine.

## Catégorie 1 — Exigence documentée mais absente

| Exigence | Preuve documentaire | Constat | Risque | Recommandation |
|---|---|---|---|---|
| Auto-validation des pronostics à la deadline (`sealDeadlines`, T6b §2) | `Cadrage/Suivi/GAPS_OUVERTS.md` (§ Écran Mes pronos) | `sealDeadlines` n'est invoquée nulle part dans le code — la dérivation d'état se fait par **complétude** (DRAFT complet = figé), pas par un vrai passage en `VALIDATED`. Un `DRAFT` reste littéralement `DRAFT` en base indéfiniment. | Faible en pratique (le comportement visible correspond à l'intention), mais un futur traitement qui filtrerait strictement sur `status='VALIDATED'` sans tenir compte de la complétude produirait un résultat divergent. | Documenter explicitement cette équivalence "DRAFT complet ≡ VALIDATED" partout où `match_predictions.status` est lu, ou implémenter enfin `sealDeadlines` pour faire converger l'état réel et l'état affiché. |
| Base légale précise pour les utilisateurs de 15-17 ans (§8.5 `conseils_juridiques_deploiement_application.md`) | `Cadrage/Suivi/GAPS_OUVERTS.md` | Auto-certification d'âge ≥15 ans ajoutée côté signup (`age_confirmed_at`), mais la validation juridique de fond reste non traitée — explicitement noté "hors de portée d'un codage". | Réel si le produit s'ouvre au-delà du cercle d'amis actuel. | Faire trancher par un professionnel du droit avant toute ouverture à un public plus large ; ne pas coder de solution technique de contournement en l'absence de cette validation. |
| Notifications journalières programmées (`BACKLOG_V1.md`, section Tutoriel & notifications) | `Cadrage/Suivi/BACKLOG_V1.md` | Backlog jamais construit (canal/contenu/horaire "à définir en spec technique") — pas commencé. | Faible (fonctionnalité confort, pas un engagement produit ferme). | Rester en backlog, pas de priorité identifiée. |
| Export calendrier .ics des deadlines | `Cadrage/Suivi/BACKLOG_V1.md` | Non construit. | Faible. | Backlog. |
| Classement all-time toutes compétitions confondues | `Cadrage/Suivi/BACKLOG_V1.md` | Non construit — le document pose lui-même un garde-fou de conception à ne pas oublier (le barème doit rester stable entre compétitions, ou le classement all-time doit être normalisé). | Faible actuellement, mais un chantier à ne pas sous-estimer si repris tel quel. | Respecter le garde-fou déjà documenté au moment de la conception. |

## Catégorie 2 — Fonctionnalité présente mais différente de la spec

| Spec / intention | Implémentation réelle | Preuve | Risque | Recommandation |
|---|---|---|---|---|
| `BracketData.filledCount`/`totalCount` interprété comme "progression de MON bracket" (lecture naturelle du libellé) | Interprété comme la progression du **tournoi** (nombre de séries dont le résultat officiel est connu) — le contrat de type n'a pas de `userId` | `GAPS_OUVERTS.md`, section Bracket (session 22/07) | Faible — lecture alternative possible, non confirmée comme voulue autrement. | À confirmer une fois avec l'utilisateur si une autre lecture était réellement souhaitée ; sinon clore ce point. |
| Score de série réel affiché sur chaque carte (lecture littérale de "état réel de chaque série") | Seul le vainqueur est affiché (`actualWinnerAbbreviation`), jamais le score exact — le contrat `BracketNode` figé par la spec ne porte pas ce champ | `GAPS_OUVERTS.md`, section Bracket | Faible — pas un oubli de code, contrainte du contrat de types. | Rouvrir uniquement si le score de série réel doit vraiment être affiché (implique de faire évoluer le contrat). |
| "Or = champion" (§17) potentiellement lisible comme applicable à chaque série gagnée | Appliqué strictement à la finale uniquement — chaque série normale gagnée est rendue en vert | `GAPS_OUVERTS.md` | Nul — lecture littérale confirmée cohérente avec la spec. | Aucune action. |
| Validation par revue humaine avant qu'un pari personnalisé calculable ne compte (lecture naturelle de "validation admin") | Auto-validation immédiate si `is_calculable=true` (`validated_by_admin_id=NULL`), la revue humaine n'intervient qu'a posteriori via contestation | Migration `20260821160000_bets_ai_auto_validation.sql`, confirmée décidée avec l'utilisateur | Moyen — un pari mal structuré par l'IA peut être crédité de points avant toute vérification humaine, corrigible seulement après coup. | Décision produit déjà actée consciemment — surveiller le taux d'erreur réel (`BUG-003`) pour juger si le seuil de confiance de l'auto-validation doit être resserré. |
| "Vue A : progression X/15 ou X/7 = mon bracket rempli" (lecture alternative possible) | Voir ligne 1 ci-dessus (même point, deux angles). | — | — | — |

## Catégorie 3 — Fonctionnalité implémentée sans documentation formelle préalable

Ce cas est fréquent et **assumé explicitement** par la méthode de travail du projet (rédaction de mini-spec "en séance" avec l'utilisateur avant de coder, sans document figé a priori). Ce n'est pas un écart de gouvernance mais un mode de fonctionnement délibéré, documenté a posteriori dans `JOURNAL_SESSIONS.md`.

| Fonctionnalité | Statut documentaire | Preuve |
|---|---|---|
| Bracket personnel (écran de remplissage) | Aucune spec formelle préexistante — rédigée en séance, choix structurants actés avec l'utilisateur (écriture TypeScript pure vs SECURITY DEFINER) | `GAPS_OUVERTS.md` |
| Système de ligues | Idem — 3 choix structurants cadrés en séance avant code | `GAPS_OUVERTS.md`, `BACKLOG_V1.md` |
| Superlatifs + Historique | Idem — architecture snapshot décidée en 2 questions posées avant de coder | `GAPS_OUVERTS.md` |
| Chat + notifications par canal | Cadré via un addendum (`Cadrage/Suivi/SPEC_CHAT_V0_1.md`), écrit **avant** le code (cas le mieux documenté de cette catégorie) | `ETAT_ACTUEL.md` §2.98/2.99 |
| Suppression/export de compte self-service | Cadré par `conseils_juridiques_deploiement_application.md` §8.2, implémenté ensuite | `GAPS_OUVERTS.md` |

**Constat global** : cette pratique fonctionne bien pour un projet à un seul développeur (assisté IA) en dialogue continu avec l'unique partie prenante produit. Elle deviendrait un risque de gouvernance si l'équipe s'élargissait (décisions actées "en séance" non traçables autrement que dans un journal chronologique de 12 000+ lignes).

## Catégorie 4 — Comportement ambigu ou contradictoire

| Point | Description | Preuve | Recommandation |
|---|---|---|---|
| Décision d'auto-validation IA (Cat. 2) vs principe général "aucune extraction incertaine ne doit être forcée" (`AUDIT_TYPES_PARIS_24_08_2026.md`, cause racine 10) | Le principe de prudence s'applique à la **structuration** (refuser de structurer un pari trop vague) mais pas à la **confiance accordée après structuration** (un pari jugé calculable est crédité sans revue) — deux niveaux de rigueur différents, non contradictoires en soi mais pas explicitement mis en regard l'un de l'autre dans la documentation. | Croisement entre `bets_ai_auto_validation.sql` et `AUDIT_TYPES_PARIS_24_08_2026.md` | Documenter explicitement que la prudence porte sur la *décision de structurer*, pas sur la *confiance post-structuration* — pour éviter qu'un futur relecteur ne perçoive une incohérence de principe. |

**Point levé (03/09/2026, item A5)** : le statut `POSTPONED` d'un match a été vérifié — comportement correct, retiré de cette catégorie. `scoreMatchPrediction`/`scoreBracketPick` (`lib/scoring/engine.ts`) ne neutralisent explicitement que `CANCELLED` ; un match/série `POSTPONED` retombe sur la branche "pas encore `FINISHED`" → pronostic en attente (ni perdu ni neutralisé), exactement comme `SCHEDULED`/`IN_PROGRESS`. Comportement voulu : un report n'est pas une annulation. `recompute.ts` protège en plus `POSTPONED` de tout écrasement automatique.

## Synthèse

Le principal constat de cette phase n'est **pas** un manque de rigueur produit — c'est l'inverse : peu de projets de cette taille documentent aussi précisément leurs propres écarts à la spec. Le travail réel de cet audit sur cette phase a consisté à vérifier que les écarts déjà consignés dans `GAPS_OUVERTS.md` sont toujours d'actualité dans le code (échantillonnage confirmé cohérent) plutôt qu'à en découvrir de nouveaux. Le seul point neuf identifié par cet audit et absent du journal existant est la mise en regard explicite du principe de prudence de structuration vs la confiance post-structuration (Catégorie 4) — le traitement du statut `POSTPONED`, également soulevé, a depuis été vérifié correct (voir ci-dessus).
