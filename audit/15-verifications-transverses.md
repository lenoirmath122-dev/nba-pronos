# 15 — Vérifications transverses

*Dernière passe recherchant les incohérences entre couches (frontend/backend/base), les comportements différents selon le contexte, et les scénarios "correct isolément mais incompatible ensemble".*

## 1. Incohérences frontend/backend/base

Aucune incohérence bloquante identifiée dans le périmètre exploré. Le point le plus proche de cette catégorie est déjà catalogué : `ARCH-002`/`ARCH-003` (barèmes dupliqués entre le moteur de scoring, source de vérité, et l'affichage en `lib/labels/bets.ts`/`MatchBaremeGrid.tsx`) — un changement de barème côté moteur sans mise à jour manuelle de l'affichage produirait une page "Règles" qui mentirait sur le barème réellement appliqué.

## 2. Règles appliquées différemment selon les parcours

- **Deadline de pari** : 4 implémentations parallèles de la même règle (`BUG-002`) — risque concret que la règle diverge silencieusement d'un écran à l'autre (Accueil vs Dashboard admin vs module factorisé) si l'une est modifiée sans les 3 autres.
- **Repli sur "Général" en cas de ligue invalide** : comportement différent entre le classement (repli silencieux vers le classement Général) et le chat (redirection vers la liste des canaux depuis le 27/08) — **différence assumée et documentée** comme un choix ergonomique distinct par contexte (un filtre de classement vs une navigation entre canaux), pas une incohérence accidentelle.

## 3. Fuseaux horaires et minuit

- Architecture à double fuseau (`newyork.ts` pour l'API externe, `paris.ts` pour l'UI) — cloisonnement vérifié cohérent (Phase 6), aucune confusion identifiée dans les fichiers explorés.
- **Risque documenté mais non testé** : le cron `sync-schedule` tourne à 8h00 UTC — selon la saison (heure d'été/hiver), cela correspond à 9h ou 10h heure de Paris. Un match programmé tôt le matin heure de Paris pourrait, dans un scénario limite, ne pas encore être synchronisé au moment où un joueur consulte l'écran Matchs. **Non vérifié comme un problème réellement rencontré** — risque théorique documenté en commentaire par l'équipe elle-même.
- Verrouillage des pronostics piloté par `scheduled_at > now()` en base (`timestamptz`, donc comparaison en UTC, indépendante du fuseau d'affichage) — bonne pratique, le risque de fuseau horaire porte sur la fraîcheur de la donnée synchronisée, pas sur le calcul du verrouillage lui-même.

## 4. Concurrence entre utilisateurs / rafraîchissements simultanés

- Écritures sensibles protégées par construction (Phase 4/6) : verrous advisory, conditions d'état + vérification de ligne affectée sur la résolution de paris, machines à états strictes en trigger.
- **Bug réel déjà trouvé et corrigé** dans cette famille : l'auteur d'un message de chat ne recevait pas toujours son propre message en direct (effet de bord d'un re-render Server Action recréant la souscription Realtime) — corrigé par une ref stable. Cité ici comme preuve que ce type de bug de concurrence/réactivité *a été* activement chassé et corrigé par le passé, pas seulement documenté a posteriori sans y toucher.
- **Non testé automatiquement** : aucun test ne rejoue une double résolution concurrente ou un double achat de dernière place de pari (`TEST-003`) — la protection existe en code, pas en filet de non-régression.

## 5. Cache obsolète / données modifiées pendant l'affichage

- Le bug `BUG-001` (désynchronisation `isLive`/`isDecided` sur le Bracket) illustrait exactement ce scénario — **corrigé depuis le 16/08/2026** (vérifié 03/09/2026, voir `ANOMALIES.md`). Une nuance résiduelle du même type subsiste : le score chiffré par équipe reste un instantané non poussé en direct, seuls le statut et le vainqueur le sont.
- Le classement/bracket public (sans compte) n'a pas de push Realtime généralisé — rafraîchissement uniquement au rechargement de page, cohérent avec un choix de simplicité assumé plutôt qu'un oubli (documenté comme tel pour l'écran Bracket personnel : "aucun besoin live sur un écran de saisie personnelle").

## 6. Erreurs après retour arrière / rafraîchissement / liens directs

- Redirection dure `/play/bracket` → `/bracket` après deadline sans conserver les paramètres d'URL (`?round=...` perdu) — constat de l'audit UX du 16/08, non revérifié dans cette session (voir `09-ux-et-interface.md`).
- Un pari non éditable atteint via lien direct (`/play/bets/[id]/edit` sur un pari non-DRAFT/SUBMITTED ou n'appartenant pas à l'utilisateur) affiche un état inerte plutôt qu'une erreur ou une redirection — comportement documenté comme une conséquence du séquencement historique des livraisons (l'écran "Mes paris" n'existait pas encore au moment où ce comportement a été codé), signalé comme amélioration possible non faite faute de demande explicite.

## 7. Comptes supprimés / ressources supprimées

- La suppression de compte anonymise les références où l'utilisateur figure comme admin/auteur (ex. `resolved_by_admin_id`) avant de purger ses propres données — évite les références orphelines visibles côté admin.
- **Cas non vérifié dans cette session** : un pari ou un message d'un utilisateur supprimé, référencé depuis un écran tiers (ex. classement historique, superlatifs de fin de saison qui citent nommément un pseudo) — le comportement d'affichage après suppression du compte associé n'a pas été tracé explicitement.

## 8. Appels externes retournant des réponses incomplètes

Déjà traité en détail dans `08-api-et-integrations.md` : Highlightly (réponse vide/partielle traitée sans alerte), micro-service Cloud Run (comportement en cas de panne vérifié le 03/09/2026 — robuste, repli `null` uniforme + catch global), Anthropic (panne capturée et isolée). Les 3 intégrations externes du pipeline de paris IA gèrent donc correctement leur propre indisponibilité.

## 9. Tâches automatiques exécutées deux fois

Vérifié comme protégé par construction sur tous les crons examinés (Phase 8/13) — upsert, condition d'état, filtre d'existence. Aucune exécution en double documentée comme un incident réel dans le journal interne à ce jour.

## Synthèse de cette phase

Aucune incohérence transverse nouvelle et bloquante n'a été découverte au-delà de ce qui était déjà catalogué dans les phases précédentes — cette dernière passe confirme surtout que les anomalies déjà identifiées (`BUG-002`, `DATA-002`) sont bien celles qui concentrent le risque de comportement incohérent entre parcours/rôles/moments, plutôt que de révéler une nouvelle catégorie de problème (`BUG-001` s'est révélé déjà corrigé lors de la reprise du 03/09/2026).
