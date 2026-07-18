# Gaps ouverts — NBA Pronos (prototype)

> Liste vivante. Un point retiré = un point traité (voir JOURNAL_SESSIONS.md
> pour la trace de quand/comment). Ne pas laisser de points "résolus mais
> gardés pour mémoire" ici — c'est le rôle du journal.

## Gaps techniques du prototype (à corriger ou trancher dans son périmètre)

- **Performance de `lib/botScripting.ts`** : requêtes Supabase séquentielles
  non groupées par bot (pas de batch/`Promise.all`). Avec 16 bots, un
  "Avancer de N jours" avec N élevé (testé à 60) a saturé la mémoire du
  process Node et bloqué l'admin ~84 secondes. Contourné côté UI
  (`AdvanceManyDaysControl` avance jour par jour), code non optimisé.
  Jugé hors scope pour un prototype jetable — pas de correction prévue sauf
  gêne concrète en usage.

## Ouvert pour les phases suivantes de la V1 (T4-T8)

> La RLS (précédemment listée ici comme « reportée en V1 ») est FAITE et
> TESTÉE de bout en bout depuis la session du 18/07/2026 (migrations #3/#4,
> plan de test T3 §7) — retirée des points ouverts. Voir `JOURNAL_SESSIONS.md`
> et `ETAT_ACTUEL.md`.

- **Déclenchement exact du recalcul auto** (couture T4/T5) : la chaîne est
  actée au niveau fonctionnel — synchro → un résultat a-t-il changé ? oui →
  recalcul déclenché (idempotent), non → aucun recalcul
  (`nba_pronos_SPEC_FONCTIONNELLE_V0_2.md` §10.6) — mais le déclencheur
  technique précis (appelé depuis la route de synchro T4 ? un trigger DB ?
  une queue ?) n'est pas encore tranché, renvoyé à l'écriture de T4/T5.
- **Pré-remplissage IA gagné/perdu des paris** (reporté, non bloquant V1) :
  évolution envisagée pour suggérer gagné/perdu à partir des données du
  match (réaliste pour les paris déductibles de scores/box scores, inopérant
  pour les paris flous/subjectifs), l'IA ne restant qu'une aide, jamais
  l'autorité finale (`nba_pronos_SPEC_FONCTIONNELLE_V0_2.md` §6.7/§10.7).
  Faisabilité et périmètre exact toujours renvoyés à la spec technique — non
  traité par T1/T2/T3.
- **Affichage des joueurs absents / paris annulés** (UX, 0.2.9) : au
  classement, les joueurs inactifs doivent être conservés avec les absents
  en compteur (noms au clic) ; un pari ANNULÉ/neutralisé doit s'afficher
  barré + grisé, visuellement distinct d'un « perdu », dans la liste (pas de
  section séparée) — décidé fonctionnellement
  (`nba_pronos_SPEC_FONCTIONNELLE_V0_2.md` §7) mais aucun écran ne
  l'implémente encore, renvoyé à T6.
- **Barème stable pour un futur classement all-time** (backlog) : un
  classement all-time toutes compétitions confondues nécessite que le
  barème de scoring reste identique d'une compétition à l'autre, sinon il
  doit être construit d'une manière qui neutralise les changements de
  barème (ex. rang/points relatifs plutôt que total brut). Pas tranché,
  juste à ne pas oublier en conception si le barème change (`BACKLOG_V1.md`).

## Interprétations d'implémentation actées (pas des gaps — à connaître, et à
## reporter dans `decisions_0.2.x` si l'utilisateur le souhaite un jour)

- Seuil "10 brackets remplis" (0.2.6) compté SÉRIE PAR SÉRIE, pas sur le
  bracket entier à 15/15.
- Classement : rang affiché TOUJOURS calculé sur Total, peu importe la
  colonne triée à l'affichage.
- "dont Écarts" rendu triable au classement — pas une des 5 colonnes
  officielles listées par 0.2.6/0.2.9.
- Tri alphabétique du classement par pseudo : différé en V1.
- Révélation d'un prono dès `VALIDATED`, peu importe volontaire ou
  auto-validé — simplification assumée par rapport à 0.2.3 §5 (distinction
  jamais observable en pratique).
