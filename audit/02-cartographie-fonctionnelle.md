# 02 — Cartographie fonctionnelle

*Reconstruction du fonctionnement métier réel à partir du code. Preuves fichier:ligne dans le corps du texte. Les passages marqués **[À VÉRIFIER]** ne sont pas confirmés par lecture complète du code.*

## 1. Pronostics de matchs

- **Objectif** : chaque joueur `ACTIVE` prédit le vainqueur + l'écart de points d'un match avant son coup d'envoi.
- **Verrouillage** : piloté par `scheduled_at > now()`, **jamais** par `matches.status` — un match commencé peut rester `SCHEDULED` en base près d'une heure (le planificateur tourne toutes les 30-60 min), donc le verrouillage réel est temporel, pas basé sur le live (`Cadrage/Suivi/GAPS_OUVERTS.md`, décision actée T6c §10.3).
- **Scoring** (`lib/scoring/engine.ts:125-180`) : 10 pts si bon vainqueur, bonus d'écart additionnel seulement si le vainqueur est correct (écart exact +5, ≤2 +3, ≤5 +2, ≤9 +1) → total 10-15 pts, jamais de valeur intermédiaire. Match `CANCELLED` → 0 pour tout le monde, y compris les pronos jamais remplis. Une égalité en `FINISHED` est une anomalie journalisée (le NBA ne connaît pas le nul), jamais devinée.
- **État "figé"** : un prono est figé (visible par les autres) s'il est `VALIDATED`/`LOCKED` **ou** `DRAFT` mais complet — dérivation **par complétude**, pas par statut brut. `sealDeadlines` (auto-validation attendue par le schéma initial) n'est invoquée nulle part dans le code — un `DRAFT` complet reste littéralement `DRAFT` en base indéfiniment (`recompute.ts:71-84`, confirmé par `GAPS_OUVERTS.md`).
- **Rôles** : joueur (saisie), tout joueur (lecture des autres une fois son propre prono figé — règle "valider débloque la vue"), admin (correction, vue "qui manque à l'appel" sur `/admin/missing`).
- **Statut `POSTPONED` clarifié (03/09/2026, item A5) : comportement correct, pas un trou.** `scoreMatchPrediction` (`lib/scoring/engine.ts:156-160`) ne neutralise explicitement que `CANCELLED` ; un match `POSTPONED` retombe sur la branche `match.status !== "FINISHED"` → `ABSENT_MATCH_PREDICTION` (pronostic en attente, ni perdu ni neutralisé), exactement comme `SCHEDULED`/`IN_PROGRESS`. C'est le comportement voulu : un report n'est pas une annulation, le prono doit rester valide jusqu'à ce que le match soit rejoué (→ `FINISHED`) ou officiellement annulé par un admin (→ `CANCELLED`, neutralisé à ce moment-là). Même logique symétrique côté bracket (`scoreBracketPick`, `engine.ts:246`). `recompute.ts` protège en plus `POSTPONED` de tout écrasement automatique (`ADMIN_LOCKED_STATUSES`) — un report reste un état piloté par un admin, jamais dérivé silencieusement.

## 2. Bracket de playoffs / NBA Cup

- **Objectif** : remplir un arbre de tournoi (vainqueur + score de série par série), sur toute la profondeur, avant le début du tournoi.
- **Barème Playoffs** (`engine.ts:184-201`) : vainqueur 25/45/80/250 pts selon le tour, score exact 10/20/30/50, affiche (matchup deviné) 0/15/25/40. **Barème NBA Cup** : vainqueur 20/50/150, affiche 0/15/25, **jamais** de bonus "score exact" (mécanique volontairement plus simple pour ce format).
- **Point d'affiche** : scoré dès que la paire officielle de la série est connue, indépendamment du fait que la série ait été jouée ou non.
- **Garde-fou historique explicite** : la cascade des candidats de tour 2+ dérive **toujours** du pick du joueur, jamais du résultat officiel (`computeCandidateTeamIds` ne lit même pas les colonnes de résultat) — protection structurelle contre un bug historique déjà rencontré sur le prototype.
- **Cycle de vie NBA Cup Alpha** (`lib/nbaCupAlpha/`) : reveal automatique (cron 30 min) de matchs empruntés à de vrais matchs NBA passés comme données de simulation, puis création automatique du tour suivant. **Mécanisme explicitement temporaire** ("NE PAS réutiliser pour la bêta"), avec 3 matchs de demi-finale/finale codés en dur (UUID de série, `game_id` réel, horaires). Idempotent par construction (filtre sur `status='SCHEDULED'`, vérification `existingCount > 0` avant création).
- **Bug UX trouvé le 16/08 puis corrigé le jour même** : désynchronisation `isLive`/`isDecided` sur le Bracket — une carte de série pouvait rester affichée "En cours" après que la série soit en réalité terminée, jusqu'au rechargement complet de la page (`AUDIT_UX_16_08_2026.md`). **Vérifié corrigé le 03/09/2026** par lecture directe de `components/bracket/NodeCard.tsx:143-155` et `SeriesDrillDown.tsx:53-58` (`useLiveSeriesStatus`/`useLiveSeriesMap`) — voir `BUG-001` dans le registre pour la nuance résiduelle (score chiffré non poussé en direct).

## 3. Paris personnalisés (texte libre → IA → résolution automatique)

**Fonctionnalité différenciante du produit**, la plus complexe du code (~4000 lignes).

- **Pipeline** : texte libre du joueur → routage par mots-clés (regex) vers l'un de 9 schémas de structuration dédiés → appel Claude Sonnet 5 avec sortie contrainte par schéma Zod strict → si `is_calculable=true`, calcul de probabilité par le micro-service ML → auto-validation immédiate (saute la file de modération admin) → résolution automatique post-match sur les stats box-score réelles.
- **Panne IA** (clé absente, timeout, JSON invalide) → `is_calculable` reste `NULL` (signal distinct de `false`), le pari retombe sur le mécanisme manuel existant (difficulté proposée/validée par un admin humain) — **jamais bloquant** pour la soumission du pari.
- **Pas de revue humaine obligatoire** pour un pari jugé calculable : passage automatique `SUBMITTED → VALIDATED` avec `validated_by_admin_id = NULL` — décision produit actée explicitement (migration `20260821160000_bets_ai_auto_validation.sql`), le contrôle humain n'intervient qu'a posteriori via une contestation (`correction_requests`).
- **Couverture réelle mesurée** (`AUDIT_TYPES_PARIS_24_08_2026.md`, 429 paris réels catégorisés) : sur les 393 dans le périmètre visé, **69% gérés**, 17% partiellement, 14% non gérés — 10 causes racines identifiées et documentées (sous-ensemble de roster non modélisable, comptage roster-wide, superlatif implicite, égalité exacte exclue, OU logique non supporté, stats jamais modélisées comme les fautes techniques ou blessures, granularité play-by-play absente, comptage exact hors période, combos mélangeant période/non-période, formulations volontairement rejetées).
- **Limite architecturale documentée (03/09/2026), non corrigée** : la vérification "ce joueur joue-t-il dans ce match" repose entièrement sur la connaissance générale du modèle Claude, **aucune donnée de roster réelle n'est injectée dans le prompt** — 2 erreurs réelles constatées sur un échantillon de 30 (joueurs jugés absents alors qu'ils jouaient). Le service de calcul de proba résout bien les joueurs par nom, mais seulement après que Claude ait déjà tranché `not_in_match` (proba forcée à 0% sans même interroger le service).
- **Quota/garde de concurrence** : cap "3 paris MATCH par série" fermé par un verrou `pg_advisory_xact_lock` dans la fonction SQL `save_bet` (`SECURITY DEFINER`) — pas de logique TypeScript, aucun index unique ne portant ce quota précis.
- **Contestation** : `request_bet_correction` (RPC) bloque toute résolution automatique tant qu'une requête est `PENDING`, garde-fou vérifié systématiquement dans chaque `resolveCalculableXxxBets`.

## 4. Synchronisation des données NBA (`lib/sync/`)

- Source externe : API Highlightly (tierce). `sync-teams` (mapping fixe des 30 franchises, déclenchement manuel uniquement) → `sync-schedule` (cron quotidien, fenêtre glissante de 4 jours) → `sync-results` (cron 30 min) → `refresh-stats-supabase` (cron quotidien, box-scores) → `resolve-bets` (chaîné après le refresh stats).
- **Rattachement match→série** déterministe par paire d'équipes : 0 ou 2+ séries candidates = **abandonné et journalisé**, aucune résolution automatique heuristique, aucun écran de reprise dédié constaté.
- **Réponse externe vide/partielle** : une réponse vide entraîne un retour sans effet (pas d'erreur) ; un match absent d'une réponse par ailleurs non vide est simplement ignoré ce cycle-là (aucune alerte spécifique) — retenté au cycle suivant.
- **Statuts non reconnus** : repli sur `IN_PROGRESS` avec un flag `recognized:false` journalisé (correctif d'un bug d'audit antérieur où ce signal était perdu silencieusement).

## 5. Ligues privées entre amis

- Ligue **permanente** (indépendante des compétitions), adhésion par **code** généré aléatoirement (pas un mot de passe choisi), appartenance à plusieurs ligues possible, écriture via fonctions SQL `SECURITY DEFINER` (`create_league`/`join_league`) pour ne jamais exposer le code par un INSERT ouvert.
- Rang recalculé dans le groupe filtré (pas le rang général conservé). Un ID de ligue invalide ou non membre retombe silencieusement sur le classement Général (choix d'ergonomie, la RLS garantit qu'aucune ligne ne fuite).
- **Bug réel trouvé et corrigé en conditions réelles** : récursion infinie sur la policy RLS `league_memberships_select` (sous-requête sur sa propre table), corrigée par une fonction `SECURITY DEFINER` dédiée (`my_league_ids()`).

## 6. Classement et superlatifs

- Départage à 4 critères en cascade : points totaux > bons vainqueurs > écarts exacts > points bracket. Ex-aequo : rang partagé, le suivant saute (1,2,2,4).
- Superlatifs (Nostradamus, Sniper, Meilleur bracket, etc.) calculés **une seule fois** à la clôture de compétition, jamais recalculés après ; tous les ex-aequo crédités, aucun titre décerné si la valeur max est nulle.
- Snapshot quotidien du classement (`leaderboard_snapshots`) nécessaire pour "plus grosse remontée" — si la compétition est close le jour même de sa création, ce titre n'est simplement jamais décerné (pas une erreur).

## 7. Badges / gamification

- ~30 badges à paliers (Bronze→Diamant) calculés **en lecture pure** à partir de vues SQL agrégées — **pas de table "badge débloqué" persistée**, recalcul implicite à chaque affichage à partir des compteurs à vie.
- Épinglage manuel (max 3, colonne `pinned_badge_ids`), affichage seul.

## 8. Chat

- Canal Général (permanent, tout joueur) + un canal par ligue existante, modération admin uniquement (pas de self-delete/self-edit), temps réel via Supabase Realtime, notifications push par canal (activé par défaut, sourdine en exception).
- **Bug réel trouvé et corrigé** : l'auteur d'un message ne recevait pas toujours son propre message en direct (effet de bord d'un `useEffect` dont la dépendance se recréait à chaque refresh de Server Action) — corrigé par une ref stable.
- **Choix assumé** : la suppression admin d'un message n'est pas diffusée en Realtime aux autres joueurs connectés (retrait local uniquement) — limitation documentée du mécanisme `REPLICA IDENTITY` sur un DELETE, jamais éprouvé sur ce projet.
- **Signalement de messages** (migration la plus récente, `chat_message_reports`) — fonctionnalité neuve, non explorée en détail dans cet audit — **[À VÉRIFIER]**.

## 9. Suppression de compte / export de données (self-service, 03/09/2026)

- **Export** (`GET /api/account/export`) : authentifié par session, scope strictement `eq(..., user.id)` sur toutes les requêtes — profil, paris, messages de chat, signalements de bug, appartenances aux ligues. JSON téléchargeable, pas de format d'interopérabilité normalisé.
- **Suppression** (`deleteAccountFormAction`) : cible toujours `user.id` de la session (jamais un paramètre externe), confirmation par saisie exacte du pseudo. Garde-fous : refus si `role=ADMIN`, refus si l'utilisateur a créé une ligue avec d'autres membres actifs. Anonymisation des colonnes de référence admin/auteur (FK circulaire gérée explicitement : `correction_request_id`) puis suppression en cascade feuilles→racines via `service_role`, terminée par `auth.admin.deleteUser`.
- **Reste hors périmètre codable** : base légale précise pour les 15-17 ans — nécessite un avis juridique, explicitement noté comme non traitable par du code (`GAPS_OUVERTS.md`).

## 10. Administration

- Panneau complet : validation des paris, résolution manuelle, gestion des joueurs (rôle/statut), gestion des compétitions, logs de synchro, vue "qui manque à l'appel" avant deadline, signalements de bug, signalements de chat.
- Toutes les mutations sensibles admin re-vérifient `is_admin()` explicitement côté Server Action **en plus** de la RLS (corrections apportées suite à l'audit du 29/08 sur `admin-players.ts`, `bug-reports.ts`, `chat.ts` — voir `07-securite.md`).

## Matrice synthétique

| Fonctionnalité | Rôle | Frontend | Backend | Stockage | Règle métier principale | Tests existants | Confiance | Anomalies détectées |
|---|---|---|---|---|---|---|---|---|
| Pronostic de match | Joueur | `components/matches/*` | `lib/actions/matches.ts`, `lib/queries/matches.ts` | `match_predictions` | Verrouillage temporel (`scheduled_at`), visibilité par complétude | `lib/scoring/engine.test.ts` (scoring pur) | Élevée | `sealDeadlines` jamais invoqué ; statut `POSTPONED` clarifié le 03/09 (comportement correct, non testé explicitement mais couvert par la même branche que SCHEDULED/IN_PROGRESS) |
| Bracket / NBA Cup | Joueur | `components/bracket-fill/*`, `components/bracket/*` | `lib/scoring/advancement.ts`, `lib/nbaCupAlpha/*` | `series`, `matches`, `bracket_picks` | Cascade dérivée du pick joueur, jamais du résultat officiel | `engine.test.ts` (barèmes) | Élevée (scoring), Moyenne (cycle Alpha temporaire) | Désync `isLive`/`isDecided` corrigée le 16/08/2026 (vérifié) ; valeurs codées en dur assumées (alpha) |
| Pari personnalisé (IA) | Joueur | `components/bets/BetForm.tsx` | `lib/ai/*`, `lib/actions/bets.ts` | `bets`, colonnes `bets_ai_*` | Auto-validation si calculable, jamais bloquant si l'IA échoue | 15+ fichiers `*.test.ts` dans `lib/ai/` | Élevée (mécanique), Moyenne (couverture réelle 69%) | Pas de données de roster réelles injectées dans le prompt (2 erreurs constatées) |
| Sync NBA externe | Système (cron) | — | `lib/sync/*` | `matches`, `series`, `entity_mappings`, `sync_logs` | Rattachement déterministe, jamais heuristique | **[À VÉRIFIER]** aucun test identifié à ce stade | Moyenne | Réponse partielle silencieuse, pas d'alerte dédiée |
| Ligues | Joueur | `components/leaderboard/*` (chips) | `lib/actions/leagues.ts` | `leagues`, `league_memberships`, `league_secrets` | Code d'adhésion, rang recalculé | **[À VÉRIFIER]** | Élevée | Récursion RLS déjà corrigée (historique) |
| Classement / superlatifs | Tous | `components/leaderboard/*` | `lib/scoring/ranking.ts`, `superlatives.ts` | `user_scores`, `leaderboard_snapshots`, `competition_superlatives` | Cascade 4 critères, ex-aequo créditeur | `engine.test.ts` | Élevée | — |
| Badges | Joueur | `components/profile/*` | `lib/queries/badges.ts` | Vues SQL (lecture pure) | Recalcul implicite, pas de persistance d'état débloqué | **[À VÉRIFIER]** | Moyenne | — |
| Chat | Joueur/Admin | `components/chat/*` | `lib/actions/chat.ts` | `chat_messages`, `chat_muted_channels`, `chat_message_reports` | Modération admin uniquement, temps réel | **[À VÉRIFIER]** | Moyenne | Suppression non diffusée en Realtime (assumé) |
| Suppression/export compte | Joueur (self) | `app/(app)/profile/*` | `lib/actions/account.ts`, `app/api/account/export` | Cascade multi-tables | Scope strict `user.id`, garde-fous admin/ligue | **[À VÉRIFIER]** | Élevée (revue de code), Faible (aucun test automatisé identifié) | Base légale mineurs hors périmètre code |
| Administration | Admin | `app/(admin)/admin/*` | `lib/actions/admin-*.ts` | multi-tables | `is_admin()` revérifié applicativement | **[À VÉRIFIER]** | Élevée | — |

## Éléments non vérifiés dans cette phase

- Couverture de test réelle de `lib/sync/*`, `lib/queries/leagues.ts`, `lib/queries/badges.ts`, `lib/actions/chat.ts` — à confirmer en Phase 12 (tests).
- Fonctionnalité `chat_message_reports` (signalement de messages, migration la plus récente) — non explorée en détail.
- Deuxième moitié de `resolveCalculableBets.ts` (2561 lignes, superlatifs/période) — patron vérifié cohérent sur la première moitié, non relu intégralement.
