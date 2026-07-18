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

## Reporté explicitement en V1 (hors périmètre prototype, ne pas implémenter maintenant)

- **RLS complètes** (remplacent l'absence actuelle de sécurité DB) :
  périmètre V1 déjà connu. Les **4 arbitrages fondateurs sont désormais
  tranchés** (session du 17/07/2026, voir `JOURNAL_SESSIONS.md`) : (A) toutes
  les lectures passent par la session utilisateur, `service_role` réservé à
  la synchro/au seed ; (B) la règle temporelle « public après deadline » vit
  dans les policies SQL, pas dans le code applicatif ; (C) détection admin
  via `is_admin()` SECURITY DEFINER STABLE lisant `users.role` ; (D) `users`
  reprend l'id de `auth.users` comme PK, `is_primary_human` disparaît en V1.
  Ce point reste néanmoins OUVERT tant que la spec n'est pas validée : les
  policies SQL elles-mêmes restent ENTIÈREMENT à écrire (contrairement à
  l'API NBA réelle et au mécanisme de cron/synchro, qui vivaient dans le même
  point et ont depuis été tranchés, voir `nba_pronos_PREP_SPEC_TECHNIQUE_V1.md`
  bloc A6/A8). La session du 17/07/2026 (4e de la journée) a ajouté **deux
  arbitrages de conception** aux 4 ci-dessus, toujours sans écrire aucune
  policy SQL : les vues de classement en `security_invoker = true` (elles ne
  contournent JAMAIS la RLS des tables sous-jacentes) et, en conséquence, la
  suppression de la colonne `email` de `public.users` (la RLS filtre des
  lignes, pas des colonnes ; l'email vit dans `auth.users`). Détail et
  motifs : `SPEC_TECHNIQUE_V0.1.md` §7, D4/D5. Le point reste OUVERT : c'est
  toujours le seul chantier technique entièrement à écrire du projet.

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
