# NBA Pronos — État actuel (V1)

> **Nature** : instantané de l'état RÉEL au moment de la dernière session — réécrit
> entièrement à chaque fois, jamais complété. Pour l'historique, voir
> `JOURNAL_SESSIONS.md`. Pour les points en suspens, voir `GAPS_OUVERTS.md`.
> Ne contient pas les règles fonctionnelles (synthèse + `decisions_0.2.x`).
>
> Dernière mise à jour : session du 29-30/08/2026 — **§2.128 : audit de
> sécurité complet + remédiation critique/élevé/moyen (rotation de la clé
> `service_role` fuitée, verrouillage du service Cloud Run, 6 correctifs
> code, migration de limites de taille), bandeau LiveTicker épinglé
> au-dessus de la TabBar sur l'écran Jouer.**
>
> **Audit de sécurité** (`/security-audit`, `security-audit-report.md`,
> commité) — 15 findings (1 critique/1 élevé/6 moyen/6 faible/1 info).
> **6 correctifs code** (commit `36c86f7`) : headers de sécurité HTTP
> (`next.config.ts`) ; helper d'erreur générique (`lib/actions/errors.ts`,
> nouveau) sur toutes les écritures brutes qui renvoyaient `error.message`
> au client — les `.rpc()` vers les fonctions SECURITY DEFINER
> (`save_bet`, `request_bet_correction`, etc.) gardent volontairement leur
> message tel quel, déjà rédigé pour le joueur ; garde `is_admin()`
> explicite + vérification de ligne affectée sur `setPlayerRole`/
> `setPlayerStatus`/`resolveBugReportFormAction`/`deleteChatMessageFormAction` ;
> limites de taille (bio/pari/justification 2000, signalement 5000 —
> migration `20260829090000_input_length_limits.sql`, appliquée en prod) ;
> dépendances de build à jour (`npm audit` 3→0) ; comparaison timing-safe
> du `SYNC_SECRET`. Bonus : secret partagé `STATS_SERVICE_SECRET`
> (fail-closed) ajouté au service Cloud Run (`app.py`, `statsService.ts`).
>
> **Critique, traité** : `SUPABASE_SERVICE_ROLE_KEY` (fuite documentée le
> 21/08, jamais rotée) — migré vers les nouvelles clés Supabase
> `sb_publishable_`/`sb_secret_` (`.env.local`, Vercel ×3 environnements,
> Google Secret Manager), PUIS les clés API legacy désactivées côté
> Supabase pour neutraliser définitivement l'ancienne clé fuitée (le
> secret JWT qui la signait restait valide pour la vérification malgré une
> migration antérieure du projet vers des clés de signature asymétriques).
>
> **Élevé, traité** : service Cloud Run `nba-pronos-stats`
> (`--allow-unauthenticated`, détenait `service_role`) — vérifie désormais
> un header `Authorization: Bearer STATS_SERVICE_SECRET` sur toutes les
> routes `/predict*` (`/health` reste ouvert). 3 accrocs réels en route
> (détail complet dans `JOURNAL_SESSIONS.md`) : `gcloud run services
> update` ne redéploie pas le code (il a fallu un vrai `gcloud run deploy`
> pour que le nouveau `app.py` soit pris en compte) ; virgule perdue dans
> `--set-secrets` sous PowerShell sans guillemets autour de toute la
> valeur ; `\n` invisible ajouté par un pipe PowerShell vers
> `gcloud secrets create --data-file=-`, diagnostiqué en comparant des
> LONGUEURS de valeurs sans jamais les afficher. Vérifié bout en bout
> (logs Cloud Run 401→200, vrai pari IA soumis avec proba calculée).
>
> **Garde-fou constaté** : le classifieur auto-mode bloque toute écriture
> directe (infra `gcloud`, `DELETE` REST via `service_role`) même
> confirmée par l'utilisateur — diagnostic en lecture seule côté Claude,
> écritures faites par l'utilisateur (PowerShell / SQL Editor Supabase).
> Points de l'audit non traités cette session (rate-limiting/CAPTCHA
> login, cookies non-HttpOnly, énumération signup, RGPD) : dans
> `GAPS_OUVERTS.md`.
>
> **LiveTicker épinglé au-dessus de la TabBar** (commit `992718e`, écran
> Jouer) — demande utilisateur : le bandeau "en direct"/"prochain à
> pronostiquer" reste maintenant visible en permanence (`position: fixed`)
> au lieu de défiler dans le flux de la page. Nouveau token
> `--tabbar-height` (`app/tokens.css`, calculé depuis la vraie boîte de
> TabBar plutôt que codé en dur) pour ne pas dériver si `TabBar.module.css`
> change. Toujours "à l'essai" (retrait possible après l'alpha) — seul le
> positionnement a changé.
>
> `tsc --noEmit`/`eslint .`/`vitest` (37/37) propres à chaque étape de code
> de cette session.
>
> Dernière mise à jour précédente : session du 28/08/2026 (suite, fin de
> journée) — **§2.127 : demies/finale NBA Cup alpha pré-sélectionnées, visuels
> Instagram convertis en 4:5, stratégie hashtags intégrée, nouvelle
> fonctionnalité "Signaler" (bug report) + 2 bugs mobiles trouvés et
> corrigés, confirmation du mot de passe à l'inscription.**
>
> **NBA Cup alpha — demies/finale pré-sélectionnées** (commit `dafc9a5`) —
> possible par anticipation : les 4 quarts empruntent des vrais matchs déjà
> joués, donc leurs vainqueurs sont déjà déterministes (Celtics, Lakers,
> Nuggets, Bucks). Appariement du bracket vérifié en base (`series.
> slot_index`/`next_series_id`) avant de proposer les candidats à
> l'utilisateur : Demi 1 Celtics-Lakers, Demi 2 Nuggets-Bucks, Finale
> pressentie Celtics-Nuggets. Vrais matchs choisis et documentés
> (`GAPS_OUVERTS.md` : game_id + ID de série + marche à suivre exacte pour
> le jour J) mais PAS ENCORE créés en base — `nba-cup-create-match.mjs`
> exige que les équipes de la série soient déjà remplies par la cascade
> d'avancement, qui n'a lieu qu'à la révélation du tour précédent.
> `NBA_CUP_ALPHA_EFFECTIFS.md` complété pour les 2 demies + la finale.
>
> **Visuels Instagram — polices installées, format converti en 4:5** :
> Oswald/Sora installées pour l'utilisateur (zip Google Fonts déposé dans
> `Cadrage/DA/`, script PowerShell, install par utilisateur Windows sans
> droits admin) — 1er essai raté (bug de variable réutilisée dans une
> boucle, associait le mauvais nom à 4 polices sur 5 dans le registre ; un
> appel `SendMessage` de notification système a aussi timeout) corrigé par
> un mapping statique fichier→nom. `post-1.svg` audité contre un RENDU RÉEL
> (Chromium headless via Playwright, jamais une estimation de largeur) :
> le titre débordait de 18px à droite (84px trop large pour ce texte précis),
> corrigé à 81px. Puis converti, à la demande de l'utilisateur, de 1080×1080
> (carré) à 1080×1350 (portrait 4:5) — bloc bas décalé de +270px en bloc,
> même règle des 88px du bas ; l'espace vide qui en résulte (~700px) est un
> choix de composition assumé (ancrage bas, pas un centrage vertical comme
> le ferait le format Story) confirmé avec l'utilisateur. `post-2.svg` et
> `post-gabarit.svg` alignés au même format 1080×1350 pour rester des
> gabarits cohérents. `SPEC_VISUELS_INSTAGRAM.md` réécrite en conséquence,
> avec une note explicite : 84px n'est PAS une garantie universelle pour un
> titre 2 lignes, à revérifier au cas par cas avec un rendu réel. (Tous ces
> fichiers vivent dans `Cadrage/DA/`, gitignored — aucun commit.)
>
> **Stratégie hashtags Instagram** — recherche déléguée à un outil externe
> avec accès web (prompt rédigé par moi, fourni par l'utilisateur à un
> outil tiers, résultat sauvegardé dans `Cadrage/DA/instagram/strategie-
> hashtags-instagram-panier-ballon.md`, gitignored) plutôt qu'inventée sans
> vraies données. Intégrée dans les légendes des Posts 1/2/3 du doc business
> (commit `4ae5f24`) : `#NBAPlayoffs` volontairement écarté des posts liés
> à l'alpha (format NBA Cup fictif, pas les vrais playoffs) au profit de
> `#NBACup`, pour ne pas contredire le message du Post 3 qui explique
> justement cette distinction.
>
> **Nouvelle fonctionnalité : bouton "Signaler" (bug report)** — demandé
> par l'utilisateur pour l'alpha/bêta (crainte réelle qu'un petit souci ne
> remonte jamais par DM — un bouton toujours visible capture ce qui se
> perdrait sinon). Migration #33 (`bug_reports`) : table + RLS, distincte
> de `correction_requests` (qui conteste un score déjà calculé, aucune
> logique de scoring en jeu ici). Bouton flottant sur tout l'espace joueur,
> texte libre uniquement (pas de pièce jointe, décision utilisateur),
> contexte capturé automatiquement (joueur/écran/heure). File admin
> `/admin/bug-reports` (onglets Ouverts/Résolus, "Marquer résolu" + note
> optionnelle). Commit `d2d914d`.
>
> **2 bugs réels trouvés en testant sur mobile, corrigés dans la foulée**
> (commit `dfe7267`) : le bouton était invisible sur Classement/Bracket/
> Règles/le profil joueur public — ces 4 écrans vivent hors du groupe
> `(app)` (routes physiques partagées visiteur/connecté, `ScreenShell.tsx`
> choisit leur nav), `app/(app)/layout.tsx` ne les couvre pas — corrigé en
> posant le bouton dans `ScreenShell.tsx` à la place, uniquement côté
> connecté. Le clic zoomait l'écran sur mobile : le textarea de la pop-up
> était à 14px, sous le seuil de 16px qui déclenche le zoom automatique
> iOS Safari au focus d'un champ (`autoFocus` posé dessus) — corrigé en
> 16px (`--font-size-base`).
>
> **Signup : champ de confirmation du mot de passe** (même commit
> `dfe7267`, demandé par l'utilisateur) — vérification purement client
> (`onSubmit`), aucun changement de `lib/auth/actions.ts` : le champ
> `confirmPassword` n'est jamais lu côté serveur.
>
> `tsc --noEmit`/`eslint .`/`vitest` (37/37)/`next build` propres à chaque
> étape de code de cette session.
>
> Plus tôt (session du 28/08/2026, suite) — **§2.126 : audit et
> correction de `/regles` contre le code réel, bug de puces corrigé,
> boutons d'aide contextuels "?" (RuleHelpButton) posés sur 5 écrans.**
>
> **Audit de `/regles` contre le code réel** (agent Explore, pas les docs de
> `Cadrage/` — trop susceptibles d'être obsolètes) : la page affichait déjà
> l'essentiel correctement, mais 3 erreurs et 3 manques réels trouvés.
> **Corrigé** : « Bracket parfait : 340 points » clarifié comme le score
> maximum d'une SEULE série (Finale NBA, 250+50+40), pas du bracket entier
> (qui vaudrait ~1210 pts) ; la validation des paris personnalisés reformulée
> (un pari jugé calculable par l'IA est validé directement, SANS geste admin
> — migration `20260821160000_bets_ai_auto_validation.sql`, déjà en place
> mais jamais reflétée dans `/regles` ; l'admin ne garde qu'un droit de
> correction après coup, et ne valide vraiment que les paris non
> calculables) ; le « sans comparaison entre joueurs » des badges nuancé
> (exception réelle : Podiumista compte les jours passés dans le top 3,
> donc PAR RAPPORT aux autres). **Ajouté** : barème chiffré de la NBA Cup
> (20/50/150 vainqueur, 0/15/25 affiche, 3 tours — jusque-là seule la phrase
> générique « barème différent » sans les chiffres, contrairement à tous les
> autres barèmes) ; mention de la demande de correction d'un prono après
> verrouillage (fonctionnalité déjà shippée, jamais documentée côté joueur) ;
> nouvelle section « Superlatifs de fin de compétition » (Nostradamus/
> Sniper/Meilleur bracket/Meilleur 1ᵉʳ tour/Plus grosse remontée —
> `lib/scoring/superlatives.ts`, calculés une fois à la clôture d'une
> compétition, jamais mentionnés nulle part avant). Commit `d6d95a7`.
>
> **Bug réel corrigé au passage : puces des listes à puces** — `.listItem::
> before` n'avait pas de `height`. En élément flex sans `align-items`
> explicite (repli `stretch`), la puce s'étirait sur toute la hauteur de la
> ligne (barre verticale) au lieu d'être un petit point. Corrigée en carré
> net 5×5px (`--radius-sm`, cohérent avec `--radius-chip` déjà utilisé pour
> les « puces de tri » du classement — le vocabulaire de tokens en garde
> trace), aligné en haut de la 1ʳᵉ ligne de texte via `align-items: flex-
> start` + `margin-top`. Même commit `d6d95a7`.
>
> **Boutons d'aide contextuels « ? » (`RuleHelpButton`)** — accompagnement
> d'un nouveau joueur EN COMPLÉMENT de `/regles`, PAS un nouveau tutoriel
> (celui-ci avait été entièrement retiré le 21/08/2026, §2.97 — décision non
> remise en cause, juste un rappel local à l'endroit où la règle s'applique,
> pas de flag « vu » ni de wizard). Cadré avec l'utilisateur via
> `AskUserQuestion` : 4 écrans retenus, contenu « factorisé quand c'est la
> même donnée partout, dédié quand le contexte le justifie ». Réalisé :
> - `components/regles/RuleHelpButton.tsx` : pastille ouvrant le
>   `ModalDialog` déjà existant (même coquille que `BetFormModal`/
>   `InlineBetForm` en mode modal) avec le contenu de règle concerné.
> - 4 barèmes/listes EXTRAITS de `/regles` en composants partagés, SOURCE
>   UNIQUE (`MatchBaremeGrid`, `BetDifficulteGrid`, `BracketBaremeContent` —
>   filtre automatiquement Playoffs/NBA Cup selon l'écran appelant,
>   `RankingTiebreakList`) : `/regles` importe désormais ces mêmes
>   composants au lieu d'avoir le texte en dur à 2 endroits.
> - `BetWritingTips` : volontairement PAS partagé avec `/regles` (décision
>   explicite de l'utilisateur) — version courte dédiée (4 exemples ciblés
>   au lieu des 8 catégories exhaustives), plus actionnable au moment de
>   rédiger un pari qu'une liste complète à parcourir.
> - Posé à 5 endroits : les 2 formulaires de pari qui existent en parallèle
>   (`InlineBetForm.tsx`, utilisé par Matchs/Bracket, ET `BetForm.tsx`,
>   l'écran dédié « Nouveau pari » — les deux avaient un champ Énoncé
>   séparé) ; l'en-tête de l'écran Jouer ; l'en-tête Bracket dans SES 2
>   modes de rendu (`FillPosterView.tsx`, mode par défaut depuis le
>   17/08/2026, ET `BracketFillView.tsx`, flux normal par onglets toujours
>   accessible via « Quitter ») ; l'en-tête Classement.
> - Style ajusté par itérations à la demande de l'utilisateur : 1er essai
>   44px contour discret jugé pas assez voyant → pastille pleine couleur
>   accent 22px (zone tactile étendue à 44px via un `::after` invisible en
>   inset négatif, §11.3 respecté sans grossir la puce visuellement) →
>   opacité 70% au repos, 100% au survol/focus (retour d'interaction).
>
> `tsc --noEmit` et `eslint .` propres sur tout le dépôt à chaque étape
> (`vitest`/`next build` pas relancés cette fois — aucun changement de
> logique de scoring, uniquement de l'UI/contenu). Commit `316b23d`.
>
> Plus tôt (session du 28/08/2026, tôt) — **§2.125 : notif de chat en icône
> (bug de stacking corrigé au passage), policy UPDATE manquante sur
> `push_subscriptions` corrigée, réorganisation de `Cadrage/` (`Proto/` →
> `Suivi/`/`Fonctionnel/`/`OLD/`/`Business/`), domaine `panierballon.fr`
> acheté et pointé vers Vercel, compétition NBA Cup alpha entièrement
> préparée (4 quarts créés, effectifs générés), bug réel corrigé (matchs
> créés loin à l'avance invisibles dans "Mes pronos" — fenêtre glissante de
> 3 jours remplacée par un repli `daysBeyondWindow`), barres de scroll
> masquées partout. Commits `3332159`/`4705508`/`e7b438b`/`291215f`/
> `14f46e4`/`974856d`/`609af66`/`0f7c617`/`e9ed76a`.
>
> Plus tôt (session du 27/08/2026) — **§2.124 : badges épinglés dans le
> bandeau du profil, codé et vérifié au clic** (`users.pinned_badge_ids`,
> `PinnedBadges.tsx`, bouton « épingler » sur `BadgeCard.tsx`, max 3 en ligne
> avec le pseudo — cadré avec l'utilisateur avant de coder). `tsc`/`eslint`/
> `vitest`/`next build` propres, migration poussée en prod, vérifié au clic
> en conditions réelles (Playwright temporaire, compte TestJoueur1).
>
> Encore avant (session du 26/08/2026) — **rattrapage
> complet de ce fichier — §2.122 ci-dessous**, plus le gap `not_in_match`
> COMPARISON/COMBO corrigé le même jour. Ce fichier n'avait pas bougé depuis
> le 21/08/2026 (§2.97 ci-dessous, tutoriel retiré) alors que 82 commits
> avaient été poussés depuis — repéré en répondant à la question de
> l'utilisateur « on en est où ? », même pattern que les rattrapages du
> 16/08 et du 18/08. **§2.100 à §2.121 ci-dessous reconstruits à partir de
> `git log` et `JOURNAL_SESSIONS.md`** (déjà fiable et à jour en continu
> tout du long) -- ils condensent au format « instantané » de ce fichier,
> sans répéter le détail intégral déjà disponible dans le journal.
>
> **Gap `not_in_match` COMPARISON/COMBO, CORRIGÉ le 26/08/2026** — un pari
> COMPARISON/COMBO nommant un joueur absent des 2 équipes du match retombait
> en repli manuel (`calculable=false`) au lieu de résoudre trivialement à
> 0%/100%, contrairement au mécanisme déjà existant côté `bet_subject=PLAYER`
> (§2.100 ci-dessous). Corrigé 100% côté Python
> (`Cadrage/Stats/service/supabase_context.py`) : le service vérifiait déjà
> le vrai roster pour chaque joueur nommé, seulement pour lever une erreur —
> change désormais la valeur en 0/100% déterministe (0 pour les stats
> comptées et dd/td/tech ; les stats à pourcentage ft/fg/fg3 gardent le
> repli manuel, taux indéterminé sans tentative). Aucun changement de schéma
> IA. Testé en HTTP local réel (Lakers/Celtics, Jokic hors match) sur
> COMPARISON (2 sens) et COMBO (OVER/UNDER/dd/somme multi-joueurs/stat %) —
> tous corrects, non-régression confirmée sur des cas normaux. Commité et
> poussé (`ab236e5`). **§2.123 — Redéployé sur Cloud Run et vérifié en prod
> le même jour** (`gcloud run deploy nba-pronos-stats --source . --region
> europe-west1`, lancé par l'utilisateur) : `/predict-comparison` rejoué en
> conditions réelles avec les mêmes paramètres exacts que le test local
> (LeBron/Lakers vs Jokic hors match) — résultat BIT-IDENTIQUE
> (`proba=0.9999877254348636`, Jokic résolu à mean=0.0). Détail complet dans
> `GAPS_OUVERTS.md`/`JOURNAL_SESSIONS.md` (26/08/2026).
>
> Restent hors de ce rattrapage, notés dans `GAPS_OUVERTS.md` : tester un
> vrai pari COMPARISON/COMBO sur un joueur hors match depuis l'appli
> elle-même (seul l'appel HTTP direct au service est confirmé pour
> l'instant), et les « 4 cas explicitement différés » (3e des « 3 points
> hors plan » du 26/08) — détail définitivement perdu (recherche exhaustive
> + l'utilisateur ne l'a plus), mis de côté explicitement plutôt que deviné.
>
> Plus tôt (session du 26/08/2026) — **§2.121 : modèle joueur+période
> entraîné, remplace l'approximation v1.** 2e des « 3 points hors plan »
> repris après la clôture du plan de reprise post-audit (§2.120) : le
> backfill `stats_box_scores_by_period` (Supabase, confirmé terminé le
> 24/08, 6602/6602 matchs) permettait enfin d'entraîner un vrai modèle
> plutôt que l'approximation "part fixe 25%/50% de la moyenne pleine partie"
> posée le 24/08. Nouveau `train_player_period_model.py` (`Cadrage/Stats/
> scripts/`), seul script du dossier à interroger Supabase directement (la
> cible par période n'existe que là) — features pré-match restent 100%
> locales (`features_joueur`), jointes sur `(game_id, player_id)`. 10
> modèles entraînés (`period_{pts,reb,ast,fg3m,stl,blk,fga,fg3a,oreb,min}
> .joblib`, `plus_minus` exclu — jamais backfillé par période), même
> pooling par one-hot période que le modèle équipe déjà en prod. Dataset :
> 477 276 lignes Q1-Q4 → 730 381 après jointure, ~1h50 d'entraînement.
> Incident réel : 1er lancement en tâche de fond tué par erreur (bufferisation
> stdout, même piège que `backfill_game_events.py` le 25/08) alors qu'il
> progressait — relancé en `python -u` avec suivi `Monitor`, succès au 2e
> essai. `supabase_context.py::_compute_player_period_proba_once()`
> réécrite pour charger les vrais modèles (contrat HTTP inchangé, rien côté
> TypeScript). Testé en conditions réelles (Jokic Q1/H1/H2, Wembanyama
> blocks Q4, garde `plus_minus`/période invalide) + HTTP local + **redéployé
> sur Cloud Run et revérifié en prod** (révision `nba-pronos-stats-00027-b2m`
> — 1er essai `gcloud` échoué sans conséquence réelle, infra validée en
> `dryRun`, refait avec succès au 2e essai). Commité (`d5c2738`, doc
> `f421b26`).
>
> Plus tôt (session du 25-26/08/2026) — **§2.120 : plan de reprise post-audit,
> étapes 6/7/8 — LES 8 ÉTAPES SONT CLOSES.** Étape 6 (événements granulaires :
> buzzer beater, dernier panier, contre sur un joueur précis) codée et
> **testée de bout en bout via l'appli réelle** (4 vrais paris soumis par
> l'utilisateur sur des matchs NBA réels, résolution forcée) — 3/4 corrects
> du premier coup, le 4e a révélé un vrai bug (les stats `MATCH_TOTAL` sans
> seuil comme `had_buzzer_beater` ne savaient pas exprimer la NÉGATION d'un
> événement, "aucun panier au buzzer" résolvait comme si l'événement avait
> eu lieu) — corrigé (`negation`/`structured_negation`, `13f095a`),
> commitée/poussée avec l'étape 5 (`4efa285`). Étape 7 (OU imbriqué dans un
> ET, seul exemple réel : "triple-double + 40pts + (20reb OU 20pas)") : 1re
> tentative dans le schéma partagé a reproduit le mur `400 compiled grammar
> too large` déjà vu sur PERIOD le 24/08 — reverti, nouveau schéma dédié
> `structureComboBet.ts` routé par mot-clé, modèle de données en groupes
> (`{or: Condition[]}[]`) (`a579173`). Bug réel trouvé par l'utilisateur en
> testant (Jamal Murray "triple-double + 25pts + 8reb-ou-8pas" → 0.04%,
> incohérent) : traiter dd/td comme indépendant des catégories qui le
> composent effondre la proba — 1re tentative de correctif (recalculer dd/td
> depuis les catégories) ABANDONNÉE (pire que le bug) ; correctif retenu :
> ne jamais retoucher P(dd/td), appliquer un facteur conditionnel par
> catégorie (`849b5c7`, Cloud Run redéployé, cohérence revérifiée sur Jokic).
> Étape 8 (guide de rédaction des paris) : intégrée dans `/regles` plutôt
> qu'un doc séparé (demande explicite), 8 familles illustrées par de VRAIES
> formulations du corpus + un paragraphe sur le non-calculable (`dde8f13`).
>
> Plus tôt (session du 25/08/2026) — **§2.119 : plan de reprise, étape 5 —
> événements de match.** Fautes techniques joueur (`tech`, nouveau
> `CLASSIFIER_STAT` calqué sur dd/td), temps morts et retour en zone
> (`total_timeouts`/`had_backcourt_turnover`, nouveaux `MATCH_STAT_CODES`)
> se glissent dans l'infrastructure existante SANS nouveau schéma IA ; seul
> le comptage de fautes techniques ÉQUIPE ("exactement N") a demandé un
> schéma dédié, réutilisant le patron multi-classe déjà construit pour
> `QUARTERS_WON_COUNT`. Play-by-play déjà téléchargé localement pour les
> 6602 matchs — `refresh_daily.py` étendu (`PlayByPlayV3`) pour que ça
> marche aussi sur les matchs à venir, pas seulement l'historique (décision
> explicite de l'utilisateur, impact opérationnel réel). Pièges réels
> trouvés en explorant les données AVANT de coder : une faute technique
> d'ENTRAÎNEUR a `teamId="0"` (exclue) ; les temps morts n'ont aucune
> attribution structurée, résolus via le nom d'équipe en texte libre dans
> `description`. 5 modèles entraînés en réutilisant tel quel l'existant
> (aucune nouvelle fonction d'entraînement) — qualité honnêtement mitigée
> pour `total_timeouts` (R²=0.010, dépend du déroulé temps réel, pas du
> contexte pré-match), documenté plutôt que caché. Testé (7 vrais appels
> Claude + 7 appels HTTP réels, routage par mot-clé vérifié sans collision
> AVANT tout commit — leçon retenue de l'étape 3 ci-dessous). Commitée avec
> l'étape 6 (`4efa285`).
>
> Plus tôt (session du 25/08/2026) — **§2.118 : plan de reprise, étapes 3
> et 4 — comptage roster-wide + meilleur marqueur.** Étape 3
> (`bet_subject=ROSTER_COUNT`, "au moins N joueurs remplissent une
> condition") : Poisson-binomiale calculée EXACTEMENT (DP, pas une
> approximation normale comme le reste du projet), `count_relation` à 3
> valeurs (AT_LEAST/MORE_THAN/FEWER_THAN) plutôt que l'OVER/UNDER habituel.
> Découverte de conception : `stats_box_scores` ne contient QUE des lignes
> "a joué" (DNP filtrés à l'ingestion) — le bassin de joueurs se résout par
> fréquence d'apparition récente (`_team_rotation()`, top 15/équipe), un DNP
> traité comme 0 (pas une donnée manquante), divergence assumée et
> documentée par rapport au reste du projet. Bug réel de routage (regex
> "joueurs"..."chacun" trop courte de 1 caractère pour une phrase réelle du
> corpus) trouvé EN VÉRIFIANT avant commit, corrigé. Testé (8 vrais appels
> Claude + 8 appels HTTP réels). Committée et poussée (`94db7a4`). Étape 4
> (superlatif "meilleur marqueur", ensemble de comparaison NON borné) :
> calcul EXACT par intégration numérique (`scipy.integrate.quad`,
> P(X>max(Y₁..Yₙ))) plutôt qu'un produit naïf d'indépendances. Bug réel
> trouvé EN CONSTRUISANT (pas dans le code de cette session) : `plus_minus`
> (pariable depuis l'étape 2) n'avait jamais été ajoutée aux colonnes de
> résolution (`resolveCalculableBets.ts`) — tout pari `+/-` retombait
> silencieusement sur `actual=0`, donc toujours LOST, en prod depuis le
> 24/08/2026. Corrigé. Testé (6 vrais appels Claude + HTTP réel). Committée
> et poussée (`332ac92`).
>
> Plus tôt (session du 24/08/2026) — **§2.117 : plan de reprise post-audit,
> étapes 1 et 2.** Utilisateur dépose l'audit annoté des 429 paris
> (`Paris gérés_non gérés - Feuille 1.csv`) — plan en 8 étapes validé, 4
> points différés notés, 5 vraiment impossibles écartés (blessures, score
> exact, panier à 4 points...). Étape 1 ("5 majeur/banc",
> `bet_subject=ROSTER_SPLIT`) : colonne `position` (déjà dans les CSV NBA
> bruts, jamais capturée) ajoutée à la synchro + backfillée pour les 6602
> matchs (`backfill_starter_position.py`) ; titulaires approximés par
> fréquence d'apparition (pas de confirmation officielle de composition
> dans ce projet). Nouveau schéma IA séparé routé par mot-clé (même patron
> que PERIOD). Committée (`4ff0a44`). Étape 2 ("petits gains groupés") :
> OU logique sur COMPARISON (`relation="OR"`) + pari "fourchette" (juste un
> exemple de prompt ajouté à COMBO, pas un nouveau mécanisme) d'abord
> (`1a6f36a`), puis `+/-` (joueur) et `fga` (équipe) entraînés comme
> stats pariables après requalification (aucun modèle n'existait encore
> pour ces 2, contrairement à l'hypothèse initiale du plan) — 2 bugs réels
> trouvés en câblant (`plus_minus_moy10` jamais calculé ; `fga` manquant des
> colonnes `own_`/`opp_` attendues) tous deux corrigés (`714e45f`). Impact
> sur la taille du schéma IA partagé mesuré à chaque étape (jamais supposé)
> — resté loin sous le plafond qui avait cassé PERIOD.
>
> Plus tôt (session du 24/08/2026) — **§2.116 : pari période (équipe +
> joueur), dernier chantier de la liste des 429 paris.** Score par
> quart-temps déjà dans le payload live Highlightly, juste jamais persisté
> (`matches.quarter_scores`) — 6 modèles équipe par famille de résultat.
> Joueur+période : `play_by_play` LOCAL insuffisant (contres/passes/
> interceptions en texte libre) — nouvelle table `stats_box_scores_by_period`
> alimentée par l'API officielle (`BoxScoreTraditionalV3` par période),
> backfill historique lancé en tâche de fond (~6600 matchs, ~8-11h estimées),
> approximation v1 assumée en attendant (remplacée le 26/08, §2.121
> ci-dessus). **Incident réel** : ajouter `period_bet` au schéma Zod
> PARTAGÉ a cassé TOUS les paris (`400 compiled grammar too large`, même mur
> que déjà pressenti) — schéma séparé et minimal créé
> (`structurePeriodBet.ts`), routé par mot-clé, schéma principal restauré
> à l'identique (non-régression reconfirmée). Testé sur les 47 exemples
> réels du corpus (17/20 matchent, 5 "faux positifs" vérifiés un par un,
> aucune mauvaise proba). Committée (`2efaf9e`, fix regex QT/MT `dcb4927`).
> **2 bugs réels trouvés en testant via l'appli** après redéploiement :
> `LEADS_HALF_RESULT` rejeté à tort (garde-fou ne gérait que 2 des 3
> catégories réelles) et paris joueur+période systématiquement rejetés
> (`comparison` jamais envoyé au service côté `predictPlayerPeriodStat`) —
> les deux corrigés et revérifiés directement contre le service déployé.
>
> Plus tôt (session du 24/08/2026) — **§2.115 : % tir équipe (ft/fg/fg3) +
> gap noté (pertes de balle).** 5e chantier de la liste des 429 : nouveau
> `TEAM_PERCENTAGE_STATS`, résolution par agrégation makes/attempts sur
> tous les joueurs de l'équipe (aucune colonne pré-calculée). Modèle Python
> même principe que côté joueur (rétrécissement bayésien + Binomiale/
> Beta-Binomiale). Bug réel trouvé EN CODANT : `build_team_context()`
> agrégeait sur une liste de stats codée EN DUR à 7 — plafonnait
> silencieusement dès une 8e stat, cassant même des endpoints déjà en prod
> sans erreur visible ; rendu dynamique. Committée (`e95cc68`), redéployée
> et vérifiée en prod le même jour (`4fc110a`). Gap noté séparément (pas
> codé) : pertes de balle (`tov`) demandées par l'utilisateur en testant —
> donnée déjà en base localement, jamais exposée comme stat pariable, même
> patron que `oreb` avant son chantier — à reprendre plus tard (`b581fce`).
>
> Plus tôt (session du 24/08/2026) — **§2.114 : prolongation (overtime) +
> fix catégorie auto-validée.** Nouveau `bet_subject=MATCH_TOTAL`,
> `match_stat="went_to_ot"` (probabilité directe, sans seuil). Reformulation
> trouvée en scopant : le payload live Highlightly a déjà 5 valeurs de score
> en prolongation (`wentToOvertime()`), aucune synchro `play_by_play`
> nécessaire côté prod. Instabilité numérique déjà connue (chantiers SÉRIE/
> total_points) reproduite ICI AUSSI sur un CLASSIFIEUR PUR — l'hypothèse
> initiale ("jamais observée sauf régression+norm.cdf") était fausse.
> Committée (`001b18a`). **Bug réel trouvé par l'utilisateur le même jour**,
> présent depuis la toute 1re auto-validation (21/08) : `validated_category`
> recopiait le défaut du formulaire (`PLAYER_PROP`) au lieu du vrai
> `bet_subject` déterminé par l'IA — un pari "prolongation" s'affichait
> "Pari joueur". Corrigé (nouveau `p_category` sur `update_bet_structuration`,
> pas rétroactif) (`d081727`).
>
> Plus tôt (session du 24/08/2026) — **§2.113 : combo multi-conditions +
> refactor schéma imbriqué/cache de prompt.** 3e chantier de la liste des
> 429 : ET de N conditions, simples ou sommées (réutilise le mécanisme du
> duel). Fait DANS LA FOULÉE d'une discussion coût (mesuré : +50% d'input
> tokens depuis COMPARISON, dominé par le schéma Zod lui-même, pas
> compressible par cache) : schéma IA passé en objets imbriqués (contourne
> la limite "16 champs racine union/nullable" de l'API, sans réduire les
> tokens en soi) + cache de prompt Anthropic (bloc statique séparé du
> dynamique, ~80% de réduction du coût d'entrée dès le 2e appel, TTL 5min
> choisi explicitement par l'utilisateur). Regroupement des paris en envois
> différés ÉTUDIÉ ET DÉCLINÉ (casserait l'auto-validation instantanée,
> rentable seulement à 10+ paris/lot). Testé (12 vrais appels Claude + HTTP
> réel). Vrai gap trouvé en testant (pas prévu) : un joueur hors match dans
> COMPARISON/COMBO retombe en repli manuel plutôt qu'en 0%/100% trivial
> (même gap que côté COMPARISON du chantier précédent, jamais remarqué avant)
> — noté, **corrigé le 26/08/2026 (§2.122 ci-dessus)**. Committée
> (`a734fc2`).
>
> Plus tôt (session du 24/08/2026) — **§2.112 : comparaison/duel
> (COMPARISON).** 2e chantier de la liste des 429 : scope réduit au "duel
> simple" (joueur vs joueur/somme/équipe, avec multiplicateur) — "meilleur
> marqueur" (ensemble non borné) et 2 cas explicitement exclus (contre sur
> un joueur précis, égalité exacte) confirmés avec l'utilisateur avant de
> coder. Nouvelle colonne `structured_duel` jsonb, approximation normale de
> la différence (indépendance assumée, même pour les stats Poisson).
> Découverte utile en lisant le code : `supabase_context.py` avait déjà tout
> pour calculer une moyenne/dispersion SANS seuil — extraites en
> `_player_stat_mean_scale()`/`_team_stat_mean_scale()`, réutilisées par
> l'existant ET le nouveau calcul (refactor, pas de duplication). **Vrai
> problème trouvé en testant le schéma** : le 1er jet à champs plats (19
> champs) a été REJETÉ par l'API Claude ("too many parameters with union
> types... limit 16"), jamais rencontré avant — compressé à 13 champs.
> Testé (8 vrais appels Claude + HTTP réel). Committée (`ad8172e`).
>
> Plus tôt (session du 23/08/2026) — **§2.111 : audit complet des 429 paris
> + extensions faciles.** L'utilisateur dépose la liste réelle des 429
> paris personnalisés joués la saison passée (12 catégories) — vérification
> FACTUELLE (pas supposée) de ce que le pipeline supporte déjà sur 6 points
> précis. Résultat présenté en 4 paliers (déjà couvert / extension
> mécanique / nouveau mécanisme réutilisable / gros chantier d'infra) + 36
> paris non-automatisables par design. Ordre de traitement confirmé
> (faciles → comparaison/duel → combos → quart-temps, "on fera tout au
> final"). Extensions faciles enchaînées le jour même : `team_pts` (dédup
> générique des colonnes déjà présentes depuis `home_win`), `fga`/`fg3a`
> (donnée déjà là pour les modèles de %, juste pas exposée comme stat à
> seuil — un seul endroit à étendre suffit, `supabase_context.py` importe
> directement du script CLI local), `oreb` (les 3 formes, seul à toucher le
> schéma Supabase, migration additive + backfill complet relancé). Testé (9
> vrais appels Claude + HTTP local). Committée (`988af8c`).
>
> Plus tôt (session du 23/08/2026) — **§2.110 : paris équipe — total_points,
> rebonds, généralisation à 4 stats.** `bet_subject=TEAM_STAT` (nouveau,
> distinct de `MATCH_TOTAL` combiné) : total_points d'abord (`c37cb02`,
> réutilise `entrainement_matchs` déjà prêt), puis rebonds sous 2 formes —
> équipe précise ET combiné (`a30a1e3`, nouvelle table
> `entrainement_equipe`, perspective "own"/"opp" plutôt que domicile/
> extérieur pour rester valide qu'une équipe reçoive ou se déplace). Vrai
> manque de conception trouvé EN CONCEVANT : rien ne mémorisait quelle
> équipe un pari `TEAM_STAT` vise — `structured_team_id` ajoutée
> (migration `20260823140000`). Généralisée le même jour à ast/fg3m/stl/blk
> (`e22a461`) : 2 scripts d'entraînement en boucle sur la liste de stats
> plutôt que dupliqués, les fonctions dédiées rebonds remplacées par des
> versions paramétrées (revérifié bit-identique). Testé à chaque étape (10
> prédictions directes + HTTP local + 10 vrais appels Claude, tous
> corrects).
>
> Plus tôt (session du 23/08/2026) — **§2.109 : paris SÉRIE, chantier
> complet pour les paris JOUEUR (pièces a0 à e).** Cadrage en 2 temps :
> longueur de série via une vraie loi binomiale négative (pas du ML),
> décision de construire d'abord un modèle de victoire PAR MATCH
> (`train_home_win_model.py`, jamais utilisé jusqu'ici) plutôt que partir de
> p=0.5. Pièce a0 (modèle + calcul récursif de série, `simulate_series()`,
> vérifié EXACT contre la formule classique p=0.5) : `3b73efa`. Bloquant
> Supabase trouvé (pas de `team_id`/stats avancées) puis levé (`339083c`) :
> migration + backfill + `build_team_context()`. Pièce (c) (agrégation
> générique "au moins une fois sur la série", DP, indépendance stat/issue
> assumée, vérifiée par cross-check exact) : `a315173`. Pièce (d)
> (extraction IA + endpoint `/predict-series`) : bug de Dockerfile trouvé
> AVANT de tester (fichiers manquants dans l'image), correctif de
> conception réel (inverser la proba PAR MATCH avant la simulation, pas
> après), et **1re apparition documentée de l'instabilité numérique**
> (~1/10-15 appels, cause exacte jamais trouvée, mitigée par
> `_compute_with_consistency_check()` — généralisée aux chantiers suivants)
> : `29667b6`. Pièce (e) (résolution automatique SÉRIE) : `40775a6`. **3
> essais réels via l'appli, 3 bugs réels trouvés et corrigés** : deadline
> série basée sur tous les matchs connus (pas juste le match 1) ; vrai trou
> de conception ("sur la série" a 2 lectures, resté sur "au moins une
> fois") ; déduction de saison fausse en intersaison (`_latest_known_season()`
> remplace une règle calendaire) + tolérance de cohérence recalibrée 1e-6→1e-2
> (`b842722`). Bug préexistant sans rapport trouvé au passage : un pari
> série VALIDATED devenait invisible partout depuis la refonte du 18/08 —
> corrigé en réutilisant `BetBlock` (`045d126`). Pièce (a) (modèle équipe
> pour paris équipe/total sur SÉRIE) reste hors périmètre, non construite.
>
> Plus tôt (session du 22-23/08/2026) — **§2.108 : Phase 6, résolution
> automatique des paris IA calculables — COMPLÈTE ET VÉRIFIÉE.** Scope
> MATCH uniquement (SÉRIE trop ambigu pour ce 1er jet). Pont entre les
> matchs de l'appli (Highlightly) et les vraies stats NBA (`nba_api`) via
> `entity_mappings`, nouveau `source_type=NBA_API`, rapprochement
> déterministe date+équipes. 4 blocs : capture du vrai `player_id` à la
> structuration (`332cbc9`) ; `resolveNbaGameId()`/`computeOutcome()`/
> `resolveCalculableBets()`, nouvelle route `/api/resolve-bets` chaînée au
> cron quotidien (`2336329`) ; vérification complète (`611faaa`). **Testé
> en conditions réelles avec un vrai match/pari temporaires** (Atlanta
> Hawks @ New York Knicks, 23/04/2026, Jalen Johnson, accord explicite de
> l'utilisateur, données supprimées après coup) : résolu WON, points
> corrects, un pari en attente correctement ignoré. Limite documentée :
> LA compétition de test active (dates fictives d'août, hors saison NBA)
> ne pourra jamais servir à tester ce mécanisme de bout en bout — seule une
> vraie compétition alignée sur le calendrier NBA le pourra.
>
> Plus tôt (session du 22/08/2026) — **§2.107 : fixes UI (bracket NBA Cup,
> affichage écart, cartes Mes pronos) + chaîne de bugs Risacher.** Repli
> automatique des cartes prono/pari après soumission (`69bebbe`).
> Superposition des demi-finales NBA Cup dans l'arbre du bracket : règle
> "même ligne" du 17/08 (correcte en Playoffs, 2 colonnes différentes)
> empilait littéralement les 2 demies en NBA Cup (colonne unique) —
> corrigée par `columnKeyById` (`3e26d89`). Affichage "✓ CHI −4" trompeur
> (lu comme un déficit) → "+4" partout, 6 endroits corrigés par grep
> exhaustif (`4ee6421`). **Chaîne de 3 bugs réels liés à "Zaccharie
> Risacher non reconnu"** : `find_player()`/`find_team()` non paginés
> (>1000 lignes dans `stats_joueurs`, mêmes ~52 derniers joueurs invisibles
> quelle que soit l'orthographe, `106e6e8`) → un pari CANCELLED restait
> affiché au lieu de libérer la place (`89de328`) → resoumission bloquée
> par une contrainte unique jamais mise à jour pour le statut CANCELLED
> (migration corrective appliquée via le dashboard Supabase, `dae9ee4`).
> Chaîne entièrement résolue et confirmée en conditions réelles.
>
> Plus tôt (session du 22/08/2026) — **§2.106 : Phase 5 clôturée + coût des
> appels IA optimisé.** Point 5 (barème du fallback) explicitement PARQUÉ
> par décision de l'utilisateur, pas tranché. Cache de prompt écarté après
> mesure réelle (schéma sous le seuil minimum) — optimisation trouvée à la
> place : Claude Opus 5 → Sonnet 5 (~2.6x moins cher, résultats identiques
> sur 7 cas dont les 2 bugs de session) + descriptions du schéma condensées
> (`309cdf9`).
>
> Plus tôt (session du 21-22/08/2026) — **§2.105 : Phase 5, structuration
> IA des paris persos — raccordement réel dans l'appli.** Chaîne complète :
> migration (7 colonnes `bets` + RPC `update_bet_structuration`), 5
> fichiers `lib/ai/*` (Claude Opus 5 via `client.messages.parse()` +
> `zodOutputFormat`, appel synchrone à la soumission, best-effort de bout
> en bout — aucune panne de cette chaîne ne peut faire échouer un pari)
> (`6ae813a`). **Design révisé en cours de route** : l'utilisateur révèle
> un malentendu (proba visible au joueur APRÈS validation, auto-validation
> pour les calculables, admin corrige après coup) différent de ce qui avait
> été codé (admin garde la main) — réajusté (`59b459f`). **6 bugs réels
> trouvés et corrigés en testant** : dd/td rejetés à tort (`comparison`
> exigé partout) ; "Junior" vs "Jr." jamais matché par `find_player()`
> (`8a0738f`) ; aucune vérification que le joueur nommé joue dans le match
> visé, corrigée en donnant à Claude le contexte des 2 équipes (`b0d5f1f`) ;
> `is_calculable=false` jamais écrit explicitement (indistinguable d'une
> panne) (`f63df21`) ; joueur hors match calculait une vraie proba au lieu
> de forcer 0% (`63805d0`) ; seuils proba→difficulté provisoires calibrés
> sur 868 joueurs réels/62280 probas simulées (`5c3de08`). `ANTHROPIC_API_KEY`/
> `STATS_SERVICE_URL` configurées par l'utilisateur.
>
> Plus tôt (session du 21/08/2026) — **§2.104 : Data NBA Phase 4 ENTIÈREMENT
> CLOSE.** 1er run réel du cron GitHub Actions : succeeded mais ~10min
> presque entièrement des timeouts hors-saison — timeout/tentatives réduits
> uniquement pour la détection de saison (10min→8s hors-saison, aucune
> perte de fiabilité en saison pleine) (`74daf64`).
>
> Plus tôt (session du 21/08/2026) — **§2.103 : Data NBA, déploiement Cloud
> Run réel + rafraîchissement quotidien.** Service déployé et VÉRIFIÉ EN
> LIGNE par l'utilisateur (`https://nba-pronos-stats-*.run.app`), guidé pas
> à pas — 2 bugs réels de déploiement corrigés (commande multi-lignes mal
> découpée en PowerShell, permission Secret Manager manquante par défaut)
> (`7b342ca`). Incident mineur : clé Supabase apparue en clair dans la
> conversation (rotation proposée, déclinée). Rafraîchissement quotidien
> (`refresh_daily.py`, nouveau `service/refresh_daily.py`) : 3 bugs réels
> trouvés en testant contre 2 vrais matchs supprimés/réinsérés (pagination
> PostgREST tronquée à 1000, mauvaise liste de colonnes, filtre DNP
> insuffisant en direct) — reproduction EXACTE confirmée après correctifs,
> workflow GitHub Actions ajouté (`ec7bac5`).
>
> Plus tôt (session du 21/08/2026) — **§2.102 : Data NBA Phase 4, architecture
> sans état + Cloud Run + Supabase (migration #31).** Reconsidération avant
> de s'engager : `nba.db` (575 Mo) ne pèse autant que par le play-by-play
> jamais lu par l'inférence (110 Mo sans cette table) — design "disque
> persistant" abandonné pour une architecture SANS ÉTAT (données dans
> Supabase déjà en place, modèles embarqués dans l'image au build),
> hébergée gratuitement sur Google Cloud Run (comparé explicitement à
> Render et une fonction Vercel, écartés). Migration #31 (3 tables
> `stats_*`) pousse enfin sans blocage classifieur — débloque au passage 2
> migrations en attente depuis plusieurs jours. Bug réel de backfill (pandas
> 3.0 renvoie des floats natifs, rejetés par une colonne Postgres integer)
> corrigé. Service réécrit contre la vraie base Supabase, résultats
> rigoureusement identiques à la version SQLite (`a487ba1`).
>
> Plus tôt (session du 21/08/2026) — **§2.101 : Data NBA, réentraînement 5
> saisons + micro-service FastAPI local.** Réentraînement sur 5 saisons
> (56938→140933 lignes) : amélioration nette sans régression. Biais
> résiduel FT% (~4%) diagnostiqué comme un artefact de granularité (1-6
> tentatives réelles/match), pas un bug à corriger. Décisions d'architecture
> Phase 4 posées : micro-service Python (FastAPI) plutôt que réimplémenter
> l'inférence en TypeScript, cron quotidien pour la fraîcheur de `nba.db`.
> `compute_proba()` extraite pour être partagée CLI/service (résultats
> identiques confirmés). Nouveau `service/app.py` (`GET /health`,
> `POST /predict`), vérifié en HTTP local — réponses identiques au CLI déjà
> validé (`43b8c28`).
>
> Plus tôt (session du 21/08/2026) — **§2.100 : Data NBA Phase 3, overdispersion
> FT%/FG%/3P% — Beta-Binomial adopté sur FT%.** Résiduel de calibration
> ±4-9% laissé ouvert le 20/08 : cause identifiée AVANT de tester (la proba
> finale écrasait le postérieur Beta sur le taux à sa seule moyenne avant
> injection dans la Binomiale, jetant l'incertitude sur le taux lui-même).
> Testé Beta-Binomial prédictif vs Binomial plug-in sur les 3 stats de
> taux : gain net sur FT% (5.4%→4.1%, la moins tentée), négligeable sur
> 3P%, légèrement pire sur FG% (déjà quasi parfait) — adopté UNIQUEMENT sur
> FT% (`BETABINOM_STATS={"ft"}`), même patron ciblé que `POISSON_STATS`.
> ~24% de réduction du résiduel, ~4% de biais résiduel non conditionnel
> resté ouvert (signe inversé selon le seuil, jamais creusé, pas bloquant)
> (`0babb8a`).
>
> Plus tôt (session du 20/08/2026, soir, suite) — **Login/
> Signup/Reset : photo forcée même sans session — §2.95 ci-dessous.**
> Après le fix §2.94, l'utilisateur signale que le fond restait sombre uni
> (pas la photo attendue) — comportement d'origine, pas un nouveau bug :
> `.photo-page` n'affiche une image que sous `[data-theme="photo"]`, jamais
> posé pour un visiteur non connecté. Décision (confirmée avec
> l'utilisateur, 3 options proposées) : forcer la photo sur ces 3 écrans
> uniquement (1er contact d'un nouveau venu), `/leaderboard`/`/bracket`
> restent liés à la préférence utilisateur. Nouvelle classe `.force-photo`.
> Committé et poussé (`fd44b84`). `tsc`/`eslint`/`next build` (36 routes)
> propres.
>
> Plus tôt (session du 20/08/2026, soir) — **Fix fond blanc
> Login/Signup/Reset en prod Vercel — §2.94 ci-dessous.** Signalé par
> l'utilisateur après déploiement : `body` gardait un reliquat du scaffold
> create-next-app (`--background`/`--foreground`, jamais branché sur le
> vrai système `[data-theme]`) qui masquait le fond sombre correct posé
> sur `html` — invisible jusqu'ici sur les écrans avec `ScreenShell`, rendu
> visible par le restyling Login/Signup/Reset (§2.93) qui n'a pas ce
> wrapper. Corrigé (`body` reprend les tokens de `html`, reliquat mort
> supprimé entièrement). Committé et poussé (`8aeb6f9`). `tsc`/`next build`
> (36 routes) propres.
>
> Plus tôt (session du 20/08/2026) — **Ajustements visuels
> validés, implémentation.** Reprise d'une session de design séparée
> (Cowork, analyse + maquettes sur le code source réel, consignée dans
> `Cadrage/DA/AJUSTEMENTS_VISUELS_20_08_2026.md`) : les chantiers marqués
> VALIDÉ ont été codés, un commit par chantier, dans l'ordre suggéré au
> §6/§11 du document — **§2.93 ci-dessous**. En bref : police Sora +
> Oswald (fondation, posée en premier), restyling complet Login/Signup/
> Reset password, profil joueur public aligné sur le reste de l'app,
> onglet Stats du Profil rendu repliable, badge "En cours" du Bracket
> recoloré, et un ticker "en direct" sur Jouer/Mes pronos posé À L'ESSAI
> (commit séparé, explicitement réversible). §12 (photo de profil) et §13
> (identité de marque) du document PAS codés cette session — voir
> `GAPS_OUVERTS.md` pour pourquoi. 6 commits poussés sur `main`
> (`a3f43ed..0214914`). `tsc`/`eslint`/`vitest` (37/37)/`next build`
> (36 routes) propres après chaque commit.
>
> Plus tôt (session du 19-20/08/2026) — **pointeur seulement,
> PAS de réécriture complète cette fois** : le travail de cette session
> (projet Data NBA, `Cadrage/Stats/`, et une proposition de paris persos
> pilotés par la proba) est un chantier séparé de l'implémentation V1
> ci-dessous (aucun écran/code appli touché), documenté en entier dans
> `Cadrage/Stats/projet-data-nba.md` (§7-§16, bandeau 🔴 REPRISE en tête du
> fichier avec la marche à suivre précise) et
> `Cadrage/V1/SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md` (statut
> PROPOSITION, en pause). Signalé explicitement à l'utilisateur : ce fichier
> fait 6750+ lignes portant sur l'état de l'appli elle-même, une vraie
> réécriture intégrale n'a pas été refaite pour ce chantier hors-app — voir
> `GAPS_OUVERTS.md` pour le résumé à jour de ce chantier. **Fin de session
> du 20/08 : 8 modèles jetables construits/sauvegardés (`Cadrage/Stats/
> models/*.joblib`), fetch des 2 saisons laissé tourner en tâche de fond,
> réentraînement complet prévu à la reprise (commandes exactes dans le
> bandeau de `projet-data-nba.md`).**
>
> Plus tôt (session du 18/08/2026) — **rattrapage de suivi :
> ce fichier et `GAPS_OUVERTS.md` n'avaient pas suivi depuis le 15/08/2026**,
> alors que `JOURNAL_SESSIONS.md` (append-only) était lui à jour jusqu'au
> 17/08/2026 inclus — repéré en répondant à la question de l'utilisateur
> « tout est documenté ? » en fin de session du jour. Signalé explicitement
> avant d'agir (`AskUserQuestion`) : rattrapage complet choisi plutôt que de
> ne documenter que la session du jour. **7 entrées ajoutées** (§2.64→§2.70),
> reconstruites à partir de `JOURNAL_SESSIONS.md` (déjà fiable et détaillé
> pour le 16-17/08, contrairement au rattrapage du 16/08 ci-dessous qui,
> lui, partait de commentaires de code faute de trace de session) :
> **audit UX + code** (§2.64, `1f4847a`→`be31785`, 16/08) ; **Bracket, arbre
> visuel connecté devenu le mode principal partout** (§2.65,
> `5e7c806`→`f23a1ba`, 16-17/08) ; **admin, suppression manuelle d'un match**
> (§2.66, `4e21c00`, 17/08) ; **Bracket, remise à zéro + correctifs
> remplissage** (§2.67, `b48112b`, 17/08) ; **paris en pop-up + score en
> menu déroulant sur le poster** (§2.68, `6396f1d`/`978fa97`, 17/08) ;
> **Accueil, polish visuel** (§2.69, `b91df40`, 18/08 — voir aussi la piste
> notifications/popup à la connexion toujours pas cadrée, `GAPS_OUVERTS.md`) ;
> **Mes paris, suppression d'un pari + boutons harmonisés** (§2.70,
> `91f398a`, 18/08). Détail de chaque session déjà connu dans
> `JOURNAL_SESSIONS.md` — ces 7 entrées le condensent au format « instantané »
> de ce fichier, sans le répéter intégralement.
>
> Plus tôt (session du 16/08/2026) — **rattrapage de suivi :
> 9 commits des 14 et 15/08/2026, committés et poussés, jamais documentés
> ici** (même pattern que le rattrapage du 06/08/2026 ci-dessous, ou celui
> du 13/08/2026 juste en dessous). Repéré en tout début de session à la
> simple question de l'utilisateur « où en est-on dans le projet ? », en
> recoupant `git log` avec ce fichier (`git status` : rien en attente, tout
> committé/poussé). Point notable, vérifié explicitement avec l'utilisateur
> avant de documenter : 7 des 9 commits n'ont PAS la mention
> `Co-Authored-By: Claude Sonnet 5` (seuls `a5c618e` et `82952a4` l'ont) —
> confirmé qu'il s'agit bien de code produit via Claude Code, la mention a
> juste sauté sur ces 7 commits (pas du code écrit sans Claude). 4 nouvelles
> entrées ajoutées ci-dessous : **Bracket Playoffs refonte 2 colonnes +
> score en direct + script de simulation** (§2.60, `a5c618e`/`82952a4`,
> 14/08 après-midi) ; **refonte du tri du Classement** — en-têtes
> cliquables, tendance de rang, top 3 (§2.61, `c55e170`, 14/08 nuit) ;
> **Classement bandeau enrichi + création de paris déplacée vers
> Matchs/Bracket** (§2.62, `b173f75`/`8765d60`/`c7fa6ac`, 15/08) ; **bandeau
> `.hero-banner` retiré de sa photo puis réaligné theme-aware** (§2.63,
> `51bdb37`/`e2c63ef`, 15/08 soir). **Reconstruites à partir des commits et
> de leurs commentaires de code**, PAS d'une note de session en temps réel
> — contrairement aux rattrapages précédents (06/08, 13/08) où
> `JOURNAL_SESSIONS.md` gardait déjà le fil : la méthodologie réelle de
> cadrage/vérification (tours d'`AskUserQuestion`, test au clic) n'est pas
> connue pour ces 9 commits et n'est donc PAS affirmée dans le détail
> ajouté (voir §2.60→§2.63). `tsc`/`eslint` (4 warnings de variables
> inutilisées dans `scripts/seed-playoffs-simulation.mjs`, script jetable
> hors app, sinon propre)/`vitest` (37/37)/`next build` (36 routes) tous
> revérifiés propres sur l'état ACTUEL du dépôt à cette occasion.
>
> Plus tôt (session du 13/08/2026) — **rattrapage de suivi :
> reprise après la pause du 10/08/2026, dernier bloc de travail committé et
> poussé** (`JOURNAL_SESSIONS.md`, entrée dédiée) : `git status` en tout
> début de session a révélé que la fusion Pilier→Fidèle (migration #28,
> `lib/badges/*`/`lib/queries/badges.ts`), les renommages de badges
> (Chirurgien→Victorieux, Horloger→Buzzer-beater, Œil de lynx→Money-time,
> Complétiste→Avant-gardiste, etc.), les puces couleur d'équipe + logo en
> filigrane sur l'écran Matchs (`MatchRow.tsx`), et le `RevealPanel`
> redescendu en bas de carte (`PredictionForm.tsx`) — tout ça codé lors de
> la session du 10/08/2026 (suite) — n'avaient jamais été committés ni
> poussés. Signalé explicitement à l'utilisateur avant d'agir ; choix :
> committer et pousser directement. `tsc`/`eslint`/`vitest`/`next build`
> revérifiés propres. **Bug réel trouvé en poussant la migration #28** :
> `CREATE OR REPLACE VIEW` refusé par Postgres (SQLSTATE 42P16, retire une
> colonne) — corrigé en `DROP VIEW` + `CREATE VIEW`, repoussé avec succès,
> `migration list` confirme `local`/`remote` synchronisés.
>
> Plus tôt (sessions du 08-10/08/2026) — **badges permanents :
> CHANTIER ENTIÈREMENT CLOS** (§2.59) : 3e et dernier chantier prioritaire
> du reclassement du 30/07/2026, jusque-là non cadré. Spec dédiée
> (`Cadrage/V1/Spec visuelle/SPEC_BADGES_PERMANENTS_V0_1.md`) : 36 badges
> sur 6 axes, paliers Bronze→Diamant, principe de permanence (aucune
> régression). Codé et poussé du 09 au 10/08/2026 : **3 phases** (phase 1 —
> 25 badges hors streaks, migration #25, vue `user_badges_lifetime` ;
> phase 2 — Métronome/Pilier, migration #26, 1er usage de gaps-and-islands
> SQL dans ce dépôt ; phase 3 — Fidèle, migration #27, règle d'union
> pronostic OU pari MATCH rattaché au match précis) ; **rendu visuel par
> palier** (tokens `--color-tier-*`) ; **interaction "carte retournée" au
> clic** (`BadgeCard` en `"use client"`) + astuce de découverte ; **icône
> par badge** (`lucide-react`, `lib/badges/icons.tsx`, mapping 1:1 des 36
> badges). Toutes les étapes vérifiées en conditions réelles (décomptes
> manuels concordants, rendu au clic via Playwright temporaire).
> `tsc`/`eslint`/`vitest`/`next build` propres tout du long. Committé et
> poussé (`08aa817` → `8834596`, 10 commits). Seul le badge Grimpeur
> (progression de rang) reste hors périmètre, écarté par choix explicite.
>
> Plus tôt (session du 06/08/2026, suite) — **thème à 3 choix
> Sombre/Clair/Photo** (§2.58) : le thème Clair, testé juste après le
> rattrapage de suivi ci-dessous, s'est révélé illisible sur les 9 écrans
> photo/verre — corrigé en fusionnant Sombre/Clair/Photo en un seul réglage
> à 3 choix mutuellement exclusifs (2 migrations, `AskUserQuestion` + mode
> Plan) plutôt que d'inventer une variante claire du style photo. **Bug réel
> trouvé en testant** : les pseudo-éléments décoratifs de `.photo-page`
> interceptaient les clics sur les 9 écrans migrés, tous thèmes confondus,
> depuis leur création le matin même — corrigé (`pointer-events: none`),
> confirmé par un nouveau test au clic. Migrations poussées sur la vraie
> base après confirmation explicite. `tsc`/`eslint`/`vitest`/`next build`
> propres. **Committé et poussé** (`e35f7b0` puis `1e8d296` pour la
> documentation) — retrouvé déjà fait via `git log`/`git status` en tout
> début de la session du 08/08/2026, alors que ce fichier disait encore
> « pas encore committé » (mention laissée obsolète en fin de session
> précédente).
>
> Plus tôt (rattrapage de suivi du 06/08/2026) — **§2.54→§2.57
> documentés a posteriori** : couleurs d'équipe sur Profil (§2.54, reprise
> cadrée par maquettes), nouvel onglet Stats (§2.55), total de points en
> grand (§2.56), et **DA fond photo plein écran + cartes en verre sur 9
> écrans + fond personnalisable** (§2.57, `fc6fc43`) — ces 4 chantiers avaient
> été codés/committés entre le 04/08 et le 06/08/2026 SANS que ce fichier ni
> `JOURNAL_SESSIONS.md`/`GAPS_OUVERTS.md` ne soient mis à jour. Repéré en
> recoupant `git log` avec ces 3 fichiers en tout début de la session du
> 06/08/2026 (l'utilisateur demandait juste « où en est-on dans le projet ? »).
> §2.54/§2.55 documentés à partir du détail déjà présent dans
> `JOURNAL_SESSIONS.md` (donc fiables) ; §2.56/§2.57 documentés directement à
> partir du code et de ses commentaires, faute de tout autre historique — le
> cadrage réel de §2.57 en particulier n'est pas connu, voir §2.57 et
> `GAPS_OUVERTS.md`. `tsc`/`eslint`/`vitest`/`next build` revérifiés propres
> sur l'état actuel du dépôt à cette occasion.
>
> Plus tôt (session du 02/08/2026) — **stepper d'écart repensé
> sous l'équipe vainqueur, écran Matchs** (§2.53, correctif post-validation
> `SPEC_ECRAN_MATCHS_V0_1.md` §22) : demandé par l'utilisateur (« gérer
> l'écart pronostiqué par un bouton + disponible sous chaque équipe, pour
> incrémenter de 1 pour une des équipes »). Choix structurel clarifié par
> `AskUserQuestion` avant de coder : le vainqueur reste choisi via le
> `TeamPicker` existant (pas un compteur indépendant par équipe, l'autre
> lecture possible de la demande) — seul le stepper `−/+` de §6 change de
> forme, scindé sur les 2 colonnes du `TeamPicker`, `−`/valeur/`+`
> n'apparaissant plus que sous la colonne du vainqueur déjà choisi. Toutes
> les règles de §6 inchangées (case vide, bornes 1-50, pavé numérique au
> tap). Aller-retour dans la même session : le `−` d'abord retiré à la
> demande de l'utilisateur (« seulement le + »), puis réintroduit à
> l'identique une fois le nouveau positionnement validé à l'usage (« il
> manque juste le bouton − »). Testé au CLIC en conditions réelles à chaque
> étape (compte `TestJoueur1`, Playwright réinstallé temporairement puis
> retiré à chaque fois, même patron que le tutoriel joueur §2.51) : domicile
> ET visiteur, bascule de colonne en changeant de vainqueur avec valeur
> conservée, aucune erreur console. `tsc`/`eslint` propres. Committé et
> poussé en 2 temps (`939f3f9` puis `139de16`).
>
> Plus tôt (session du 02/08/2026) — **création de compétition NBA Cup
> (§2.52) committée et poussée** (`6f591b0`) : chantier construit et vérifié
> en conditions réelles la session précédente (31/07/2026, resté en attente
> de confirmation avant commit) — confirmé par l'utilisateur en tout début
> de cette session, aucun changement de code depuis le dry-run. Détail
> complet ci-dessous, inchangé.
>
> Plus tôt (session du 31/07/2026, suite) — **création de
> compétition NBA Cup construite et vérifiée en conditions réelles** (§2.52,
> correctif post-validation `SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md` §10) :
> mini-bracket 4 quarts/2 demies/finale (topologie bottom-up identique aux
> Playoffs, mais SANS conférence — le schéma T1 le prévoyait déjà ainsi),
> demandé par l'utilisateur (« retravailler sur la création de compétition et
> importation des matchs »). Dry-run réel en 2 passes successives
> (`scripts/dryrun-cup-sync-test.mjs`, conservé dans le dépôt) sur la vraie
> compétition ACTIVE temporairement archivée : prouve pour la 1re fois que la
> synchro capture les matchs Cup AU FUR ET À MESURE (pas tout d'un coup) et
> qu'une série à 1 seul match (agrégat Cup, jamais exercé bout-en-bout avant
> ce jour) passe bien à `FINISHED` et propage son vainqueur automatiquement,
> sur 2 tours d'affilée (quarts→demies→finale). Incident de nettoyage trouvé
> et corrigé (un vrai bracket joueur créé pendant le test bloquait la
> suppression par FK, erreurs de `.delete()` pas vérifiées jusque-là) ;
> compétition réelle restaurée en ACTIVE, vérifiée intacte. `SYNC_SECRET`
> exposé en clair dans le chat par l'utilisateur (même famille que les
> incidents précédents) — régénération recommandée, pas encore confirmée
> faite (toujours vrai, voir `GAPS_OUVERTS.md`). ~~PAS committé ni déployé à
> ce stade~~ — committé et poussé depuis, voir plus haut (`6f591b0`).
>
> Plus tôt (session du 31/07/2026) — **tutoriel joueur codé,
> capturé et déployé** (§2.51, `SPEC_TUTORIEL_JOUEUR_V0_1.md`) : 2e des 3
> chantiers prioritaires retenus le 30/07/2026 (après la refonte du Bracket),
> avant les badges permanents (toujours non cadrés). Cadré en séance avec
> l'utilisateur (3 tours d'`AskUserQuestion` : déclenchement/format/contenu,
> puis ajout des paris MATCH+SÉRIE à l'étape 3, puis code-vs-note-de-cadrage
> avant d'écrire une ligne) — bannière de proposition à la 1re connexion
> (flag `users.tutorial_seen_at`, migration #21) + wizard modal 7 étapes,
> lien permanent « Comment jouer ? » dans Profil > Compte. Les 5 dernières
> étapes portent de VRAIES captures d'écran de l'interface (`public/
> tutorial/*.png`), capturées via Playwright (installé temporairement en
> dev dependency puis retiré) sur le compte de test `TestJoueur1`
> (mot de passe désormais connu : `TutoTest2026!`, posé par l'utilisateur
> lui-même — le classificateur de permissions bloque cette action pour
> Claude). Matchs/Bracket n'avaient rien à montrer (aucun match proche, `
> bracket_deadline` passée) : la VRAIE compétition ACTIVE de l'utilisateur
> (« Test ») a été temporairement ajustée (1 match ajouté, deadline reculée)
> puis EXACTEMENT restaurée juste après (vérifié par relecture séparée).
> Committé et déployé (`34e179a`, Vercel production `nba-pronos.vercel.app`
> vérifiée `200` après build). Détail complet dans `JOURNAL_SESSIONS.md`.
>
> Plus tôt (session du 30/07/2026) — **filtre par ligue ajouté
> sur Mes pronos + Bracket** (demandé par l'utilisateur, même patron chips
> `?ligue=` que Classement) : `resolveLeagueScope()` extrait dans
> `lib/queries/leagues.ts` (jusque-là dupliqué, refactoré depuis
> `leaderboard.ts`) — filtre others/absenteeCount/otherBets (Mes pronos) et
> groups/players + %/dénominateur recalculé (Bracket, confirmé avec
> l'utilisateur). Mon propre prono/pari n'est jamais filtré. **+ replis
> "Plus d'options"** sur Mes pronos (Voir les paris des autres/Demander une
> correction/Voir les pronos des autres regroupés sous un seul `<details>`
> par match, fermé par défaut — ces 3 lignes restaient visibles en
> permanence sur chaque match). Les 2 lots confirmés fonctionnels par
> l'utilisateur. Committé/déployé (`fc06837`, `ec698e9`).
>
> Plus tôt la même session — **reclassement du backlog**
> (3 chantiers retenus dans l'ordre : refonte Bracket → Tutoriel joueur →
> "Fun/esprit ligue" redéfini en badges PERMANENTS visibles en continu, pas
> seulement à la clôture ; le reste reporté) **+ refonte lisibilité du
> Bracket** (`SeriesDrillDown.tsx`/`NodeCard.tsx`) : distinction Est/Ouest
> jusque-là invisible (existait dans les données, jamais montrée) —
> Vue A scindée en sous-groupes Ouest/Est par tour ; Vue B (arbre plein
> écran) réordonnée en poster miroir pour les Playoffs (Ouest à GAUCHE,
> Finale au CENTRE, Est à DROITE — sens confirmé/corrigé par l'utilisateur),
> sans trait de connexion (scope réduit, acté avec l'utilisateur). 2
> ajustements demandés après test, tous deux confirmés : colonnes centrées
> en hauteur, carte entière surlignée quand une série est terminée (vert
> gagné / or champion, jamais de rouge). Committé/déployé (`ac36ce8`,
> `3a43455`, `95381ce`).
>
> Plus tôt la même session — **sélecteur d'équipe
> favorite transformé en menu déroulant** (`TeamPicker.tsx`, BACKLOG_V1.md
> « Personnalisation du profil ») : la liste fixe des 30 boutons radio
> prenait trop de place, remplacée par un menu flottant fermé par défaut.
> **Bug réel trouvé en testant** : fermer le menu retirait le radio coché
> du DOM avant la soumission — la sélection revenait systématiquement à
> "Aucune" en enregistrant. Corrigé : la liste reste toujours montée, seule
> sa visibilité CSS change. Confirmé fonctionnel par l'utilisateur.
> Committé/déployé (`917d324`, `6a1e7a8`).
>
> Plus tôt la même session — **« Couleurs d'équipe sur
> Profil » essayée puis ABANDONNÉE le jour même** par l'utilisateur ("je ne
> pense pas que ça ait d'importance"). Construite en 2 passes (accents
> doux, puis fonds + bandeau teintés), entièrement retirée ensuite : revert
> complet du code (`git revert`, historique jamais réécrit) + migration
> #20 (`DROP COLUMN use_team_colors`, migration #19 gardée dans le dépôt
> — déjà appliquée en base au moment du revert, ne doit jamais disparaître
> du dépôt sous peine de casser `supabase db push`, erreur rencontrée puis
> corrigée). État final : aucune trace dans le code ni en base. Committé/
> déployé (`33c9574`). Détail complet dans `JOURNAL_SESSIONS.md`.
>
> Plus tôt la même session — **écran Profil réorganisé
> en 4 sous-onglets** (Compte/Ligues/Historique/Admin, ce dernier visible
> seulement pour un admin) : l'écran avait grossi toute la session (Thème,
> Préférences, Rappels, Mes ligues, Historique, Administration,
> Déconnexion), demandé par l'utilisateur juste après le lot "profil
> joueur" ci-dessous. Même patron `?tab=` que `SortChips`/`LeagueScopeChips`
> (Classement), aucun état client. Déconnexion reste EN DEHORS des onglets,
> toujours visible. Confirmé fonctionnel par l'utilisateur. Committé/
> déployé (`74de402`).
>
> Plus tôt la même session — **page "profil joueur"
> construite** (`/players/[userId]`, suite de la discussion nav) : agrège
> classement/bracket/pronostics/paris déjà visibles ailleurs par la RLS
> existante, rien de nouveau exposé. Nav INCHANGÉE (toujours 4 onglets) —
> se rejoint en cliquant un pseudo. **Câblé sur TOUTES les pages du site**
> (demandé explicitement) via un composant partagé `PlayerLink` : Classement
> (restructuré bouton→div, un lien imbriqué dans un bouton étant invalide),
> Bracket (contrat `SeriesPickGroup.players` étendu de façon additive),
> Mes pronos, Matchs, 6 écrans admin, Historique/superlatifs — 23 fichiers,
> chaque type étendu additivement (jamais de champ retiré). Confirmé
> fonctionnel par l'utilisateur (bracket 15/15 réel de `Rillettes-31`
> consultable). Committé/déployé (`57cd191`).
>
> Plus tôt la même session — **2 bugs réels trouvés et corrigés** en
> creusant cette même discussion nav (voir `JOURNAL_SESSIONS.md` pour le
> détail complet) :
> 1. `competitions.bracket_deadline` restait `NULL` à vie — jamais posée
>    nulle part dans le code réel (ni `createMatch`, ni T4), alors que le
>    drill-down nominatif du Bracket, le rappel push bracket, le bloc
>    bracket de `/admin/missing` et l'item Accueil en dépendent tous.
>    Corrigé : recalculée en entier à chaque création de match
>    (`recomputeBracketDeadline`, `lib/actions/admin-results.ts`) — défini
>    AVEC l'utilisateur comme "le début du premier match de la compétition,
>    tous tours confondus". Committé (`e9a4829`).
> 2. `<input type="datetime-local">` (écran Résultats) interprétait l'heure
>    saisie par l'admin (Paris) selon le fuseau du SERVEUR (Vercel, UTC) —
>    décalage de 1h/2h selon la saison, jamais remarqué avant faute d'un
>    admin qui recoupe l'heure affichée avec l'heure murale réelle. Corrigé
>    sans librairie (`parisLocalToUtcIso`, `Intl.DateTimeFormat`, décalage
>    déduit dynamiquement — jamais +1/+2 en dur). Committé (`8bf74d8`).
>
> Les 2 matchs déjà saisis dans la VRAIE compétition "Test" de l'utilisateur
> (créée pour explorer ces sujets) ont été corrigés rétroactivement (-2h),
> `bracket_deadline` recalculée derrière — passe désormais dans le passé,
> le bracket est verrouillé pour de vrai.
>
> Avant ça, même session — **test au CLIC en
> conditions réelles FAIT** pour les 2 derniers lots (`/admin/missing` §2.49
> et superlatifs/Historique §2.50, jusque-là vérifiés par script jetable
> seulement) : l'utilisateur a créé lui-même une vraie compétition ACTIVE
> de test (« Test 30 juillet 2026 »), 8 matchs + 4 comptes de test préparés
> entre les deux, résultats saisis PAR L'UTILISATEUR via le vrai écran
> Résultats (`recomputeMatch` réellement exécuté). `/admin/missing` confirmé
> exact — trouvaille en cours de route : l'utilisateur a lui-même déposé un
> vrai prono sur son compte réel, correctement exclu de la liste en temps
> réel. Clôture réelle ensuite : les 3 superlatifs attendus générés
> (Nostradamus/Sniper/Meilleur 1er tour, tous à TestJoueur1), les 2 cas
> limites confirmés (Meilleur bracket absent, Plus grosse remontée absente
> faute de snapshot). Compétition + les 4 comptes de test GARDÉS à la
> demande de l'utilisateur (même choix que les 3 autres compétitions TEST).
> Aucun code changé dans cette étape, uniquement des données réelles créées
> en base — voir `JOURNAL_SESSIONS.md` pour le détail complet.
>
> Avant ça, même session — **4e point du BACKLOG codé ET validé (par
> script) en conditions RÉELLES : superlatifs de fin de compétition + écran
> Historique** (§2.50). Nostradamus, Sniper, Meilleur bracket,
> Meilleur 1er tour, Plus grosse remontée — calculés et figés à la clôture,
> tous les ex-aequo crédités, aucun titre décerné si la valeur max est
> nulle. "Plus grosse remontée" nécessitait un historique de classement qui
> n'existait pas : ajout d'un snapshot QUOTIDIEN (`leaderboard_snapshots`,
> nouveau cron, socle réutilisable pour le futur "courbe d'évolution").
> **Correctif trouvé en construisant** : `competitions.archived_at` posée
> depuis le schéma initial (T1) mais jamais écrite — remplie désormais à la
> clôture. Vérifié en conditions réelles par script jetable (compétition
> ACTIVE temporaire, scores construits à la main pour couvrir ex-aequo,
> absence de titre, ET une vraie inversion de classement) : 12/12
> assertions passent, base revérifiée identique après nettoyage. Rendu réel
> de la section Historique (avec de vrais titres) reste à observer à la
> prochaine clôture — même réserve que §2.49. **Committé et déployé**
> (`7bdffc7`).
>
> Plus tôt la même session : **petit correctif remonté par l'utilisateur en
> testant** — aucun moyen de sortir du panneau admin vers `/home`/`/profile`
> depuis sa création (§2.20). Lien "← Retour à l'app" ajouté au layout admin
> partagé. Committé/déployé (`0e7c233`).
>
> Avant ça (§2.49, CLOS) : **3e point du backlog, vue admin "Qui manque à
> l'appel"** (`/admin/missing`) — lecture seule, un bloc par échéance à
> venir (matchs fenêtre 3 jours, bracket si sa deadline approche), liste
> nominative des joueurs manquants PAR match. Vérifié par script jetable
> (compétition ACTIVE temporaire, matchs à J+2 pour écarter tout risque de
> rappel push réel pendant le test) — 6/6 assertions passent. Committé/
> déployé (`e934085`).
>
> Avant ça (§2.48, CLOS) : **2e point du backlog, Système de ligue** —
> groupement d'amis façon MPP (vue filtrée sur le classement, aucun système
> de scoring séparé), ligue PERMANENTE, appartenance à plusieurs ligues,
> adhésion par code généré aléatoirement, rang recalculé dans le groupe.
> Migration #16 + migration #17 (correctif d'une récursion RLS trouvée en
> testant, PAS en relisant le code). Confirmé fonctionnel par l'utilisateur
> avec 2 vrais comptes. Committé/déployé (`95edf7e`, `d1fde4f`).
>
> Avant ça (29/07/2026, fin de journée, §2.46/§2.47, CLOS) : **1er point du
> backlog, Rappels ciblés (canal Push)** — infra Web Push complète + 2
> déclencheurs cron, testée par l'utilisateur sur son VRAI compte, PC ET
> iPhone, 3 bugs réels trouvés et corrigés (réglage Windows, multi-appareils
> sur un même compte, VAPID rejeté par Apple). Committé/déployé jusqu'à
> `18ffe7c`.
>
> Avant ça (28/07/2026, CLOS) : audit structurel T1→T8/D1-D6 (7 écarts
> trouvés, tous corrigés — aucune des 6 décisions structurantes D1-D6
> violée silencieusement), T8 rendu réellement opérationnel (3 actions
> externes faites par l'utilisateur), 2 points backlog "confort" codés
> (révélation publique des paris, contestation d'un pari refusé/résolu),
> Realtime activé sur `series` (migration #14) — détail §2.38→§2.45,
> `JOURNAL_SESSIONS.md`.
>
> **Tout est committé et déployé jusqu'à `ec698e9` inclus.**
>
> Prochaine étape à confirmer avec l'utilisateur : la suite du backlog
> (export .ics, courbe d'évolution du classement — le socle existe déjà,
> face-à-face entre joueurs, personnalisation du profil, partage, etc. —
> voir `BACKLOG_V1.md`), ou un nettoyage mineur (3 abonnements Apple
> dupliqués sur `Demo_Amis`, sans conséquence — voir §2.47).
>
> **Trouvailles distinctes des sessions précédentes, toujours vraies** : les
> emails `@nba-pronos.test` des comptes de seed sont REJETÉS par le
> validateur Supabase Auth (TLD `.test` non accepté) ; **3 compétitions
> ARCHIVÉES** (« TEST NBA CUP », « TEST playoff 28/07/2026 », « TEST T4 sync
> — Playoffs 2026 (réel) ») restent en base, gardées comme historique de
> test à la demande explicite de l'utilisateur — SANS superlatifs (closes
> avant que ce mécanisme existe, non recalculé rétroactivement, pas demandé).
>
> **État de la base** (30/07/2026, fin de session) : `Demo_Amis`/
> `Rillettes-31` intacts, plus une ligue de test créée puis rejointe par
> l'utilisateur lui-même (non nettoyée, légitime). **4e compétition
> ARCHIVÉE** : « Test 30 juillet 2026 » (4 comptes `TestJoueur1-4` gardés
> avec elle, décision explicite de l'utilisateur — même famille que les 3
> compétitions TEST déjà archivées, voir plus bas). Aucune compétition
> ACTIVE en ce moment.

---

## 1. Contexte technique

```text
Stack       : Next.js 16.2.10 (Turbopack, App Router, TypeScript) + Supabase
              (Postgres). Next.js 16 a des ruptures par rapport aux
              conventions plus anciennes (AGENTS.md) — vérifié dans
              node_modules/next/dist/docs/ avant chaque brique de code
              nouvelle (ex. middleware.ts renommé proxy.ts, cookies()
              asynchrone, searchParams désormais une Promise, onNavigate sur
              <Link> pour bloquer une navigation interne — §2.8, next/image
              qui refuse d'optimiser un SVG sans dangerouslyAllowSVG — §2.9).
Dépôt local : C:\dev\nba-pronos (sorti de OneDrive) — dépôt Git NEUF, projet
              Supabase NEUF (D1, session du 17/07/2026), distinct du
              prototype (`nba-pronos-proto`), qui reste intact et inchangé en
              référence.
Auth        : Supabase Auth (email + mot de passe), pont École A vers
              public.users via trigger SQL (T2) — voir §3. Flux d'inscription
              + connexion CODÉS et vérifiés (§2.1). Comptes de TEST créés via
              l'API Admin (auth.admin.createUser), seule voie propre puisque
              public.users n'accepte aucun INSERT direct (§2.6). Déconnexion :
              voir §2.9 (bouton TEMPORAIRE, aucun écran ne la portait avant).
RLS         : ACTIVE sur les 15 tables publiques, testée de bout en bout (T3).
              Consommée directement par les écrans de lecture (Accueil,
              Classement, Bracket, Matchs, Mes pronos) via getServerClient()
              — JAMAIS service_role. Deux vues (`user_scores`/
              `user_recent_form`) et deux fonctions (`count_committed_
              predictions`, `request_prediction_correction`) sont
              volontairement en dehors du régime « invoker » (§2.7/§2.8/
              §2.11) : `request_prediction_correction` (migration #7) est la
              SEULE écriture qui contourne une policy (`mp_insert`, pour la
              voie A du §2.11) — elle n'écrit jamais de contenu de
              pronostic, seulement une ligne vide + sa requête liée. Les
              deux vues/fonctions restantes n'exposent QUE des agrégats
              (points, compteurs), jamais une ligne individuelle — la
              confidentialité par match/pari/pick, elle, reste entièrement
              portée par la RLS des tables sources, inchangée.
Realtime    : publication `supabase_realtime` activée sur `matches`
              UNIQUEMENT (migration #8, §2.11) — `series` reste à activer au
              lot Bracket personnel (GAPS_OUVERTS.md). Souscription unique
              côté client dans `LiveSubscriber.tsx` (Mes pronos), RLS native
              (matches_select = `using (true)`, rien de privé n'y transite).
Styles      : CSS Modules colocalisés par composant (`*.module.css`), lisant
              exclusivement les tokens sémantiques de `app/tokens.css` (aucune
              valeur en dur) — convention posée par l'écran Accueil,
              reconduite sur Classement/Bracket/Matchs puis le hub Jouer
              temporaire (§2.10). Tailwind (présent au projet) reste utilisé
              tel quel pour les écrans PAS ENCORE stylés selon T7
              (login/signup, non retouchés).
```

## 2. Avancement

```text
Phase V1 — la série de specs techniques T1 → T7 est VALIDÉE. Le socle de
données (modèle + auth + RLS) est posé et codé (§3). CODÉS ET VÉRIFIÉS avec
un vrai jeu de données : les HUIT écrans du hub joueur (Accueil, Classement,
Bracket vue globale, Matchs §2.8, Mes pronos §2.11, Nouveau pari §2.15,
Bracket personnel §2.16, Mes paris §2.19), logos de franchise câblés sur
Bracket/Matchs/Mes pronos/Bracket personnel. Le VRAI hub Jouer (§2.35,
`SPEC_ECRAN_HUB_JOUER_V0_1.md`) remplace désormais le hub temporaire
(§2.10) — grille 2×2, pastilles + aperçu par carte. **Centralisation
prono/pari** (§2.36, demandée par l'utilisateur) : validation synchronisée
sur Matchs, paris SÉRIE désormais dans Bracket, décomptes sur le hub et
l'Accueil.

**Le lot ADMIN est ENTIÈREMENT CLOS (6/6 écrans)** : tableau de bord
(§2.20, `/admin`), validation des paris (§2.21), Gestion des joueurs
(§2.22), Historique des logs (§2.23), résolution des paris (§2.28),
requêtes de correction (§2.29, DERNIER écran fermé) — tous CODÉS et
VÉRIFIÉS en conditions réelles.

**Le CHANTIER T5 (moteur de scoring) est ENTIÈREMENT CLOS (4/4 lots)** :
moteur pur (§2.24, `lib/scoring/engine.ts`, 26 tests `vitest`), writer
`series.official_*` (§2.25, `lib/sync/writeSeriesOutcome.ts`),
orchestration (§2.26, `lib/scoring/recompute.ts` — `recomputeMatch`/
`recomputeSeries`/`recomputeBet`/`recomputeCompetition`), câblage admin
(§2.27/§2.28/§2.29 — bouton Recalculer, résolution, requêtes). Le moteur
de scoring est FONCTIONNELLEMENT COMPLET ET UTILISABLE de bout en bout
depuis l'UI admin.

**Gestion des compétitions — chantier ENTIÈREMENT CLOS (3/3 lots)** (§2.30,
§2.33) : création, saisie des résultats + avancement automatique du
bracket, clôture/archivage — tous codés, vérifiés, testés en conditions
réelles par l'utilisateur.

**T4 (synchro API Highlightly) — CODÉE ET TESTÉE EN CONDITIONS RÉELLES**
(§2.34) : client, `lib/sync/*`, 4 routes. Dry-run complet sur de vraies
données NBA 2026 (création de matchs, scores, recalcul, idempotence) —
voir §2.34 pour le détail.

**Ordre de reprise, PROCHAINE SESSION** (voir GAPS_OUVERTS.md) :
1. **Décider avec l'utilisateur du sort de la compétition de dry-run**
   (laissée ACTIVE à sa demande) et committer/pousser le lot T4.
2. **Vrai hub Jouer** — remplace le hub temporaire (§2.10), aucune spec
   d'écran encore écrite.
3. **Le reste** : Realtime + rendu des états au-delà de ce qui existe déjà
   (T6c) ; mini-bracket NBA Cup (reporté, voir GAPS_OUVERTS.md) ;
   planificateur externe réel (cron-job.org/GitHub Actions) à configurer
   au déploiement pour que T4 tourne en continu.
```

### 2.1 Ce qui est CODÉ et VÉRIFIÉ (session du 19/07/2026, inchangé depuis)

```text
.env.local (hors dépôt, déjà couvert par .gitignore) : URL + anon key +
  service_role key du projet Supabase V1 (saisies par l'utilisateur
  directement dans l'éditeur, jamais collées dans le chat) ; SYNC_SECRET
  généré côté Claude (crypto.randomBytes(32), 64 caractères hex).

Paquets installés : @supabase/ssr, @supabase/supabase-js, server-only.
AUCUNE nouvelle dépendance ajoutée depuis (écrans Accueil, Classement/
Bracket, Matchs compris, hub Jouer temporaire §2.10) — le seed et les scripts
de vérification jetables utilisent les mêmes paquets, rien de plus.

lib/supabase/{browser,server,service}.ts (T6a §2.4) : les 3 clients —
  getBrowserClient (anon, navigateur), getServerClient (anon + JWT cookies,
  ASYNC — correctif post-validation, cookies() est asynchrone en Next.js
  15/16), getServiceClient (service_role, module server-only, garde de build
  contre toute fuite côté navigateur). getServiceClient n'est utilisé QUE par
  le script de seed (§2.6) — jamais par un écran ni une server action.

proxy.ts (racine du repo) : garde d'AUTHENTIFICATION (T6a §4.1) — zones
  protégées /home, /play, /profile (app), /admin (admin) → redirigées vers
  /login sans session ; /login et /signup → redirigées vers /home AVEC
  session. Utilise supabase.auth.getUser() (revalidé serveur, pas
  getSession()). Nommé proxy.ts et pas middleware.ts : renommage Next.js 16
  (AGENTS.md), comportement strictement identique. Ne garde PAS
  /leaderboard ni /bracket (routes physiques hors des groupes (public)/(app),
  T6a §3.2/§8.1) — ces deux écrans lisent la session eux-mêmes pour choisir
  leur nav, jamais pour filtrer leurs données (la RLS s'en charge).

lib/auth/actions.ts + components/auth/{LoginForm,SignupForm}.tsx +
  app/(public)/{layout,login/page,signup/page}.tsx : flux complet de
  connexion et d'inscription (T2 §4). Formulaires minimalistes (pas encore
  les tokens visuels T7 — non retouchés). `logout()` existe dans ce fichier
  depuis le début mais n'était câblé sur AUCUN écran avant §2.9.
```

### 2.2 Correctif de conception trouvé et tranché (T6a §3, session du 19/07/2026)

```text
L'arbre app/ validé par T6a plaçait leaderboard/page.tsx (et bracket/page.tsx)
à la fois dans (public)/ et dans (app)/ — conflit de route Next.js. Tranché :
route physique UNIQUE, hors des deux route groups (app/leaderboard/page.tsx,
app/bracket/page.tsx). SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md corrigé en
conséquence, correctifs marqués explicitement « post-validation ». 2 autres
correctifs mineurs du même ordre : middleware.ts → proxy.ts (Next.js 16),
getServerClient() rendu async (cookies() asynchrone).
```

### 2.3 Consolidation design + tokens (session du 20-21/07/2026)

```text
Passe maquettes (20/07/2026) : T7 éprouvée sur des maquettes HTML jetables,
hors dépôt. Amendement V0.2 de SPEC_DESIGN_SYSTEM_V0_1.md (§15 : accent figé,
rayons « niveau C / net », nouveau token --color-trend).

Consolidation (21/07/2026, avant le lot Accueil) :
- Logos de franchise → 30 SVG déposés par l'utilisateur dans
  public/logos/teams/ (nommés par abréviation), déjà committés depuis cette
  session-là. RESTÉS NON CÂBLÉS par aucun écran jusqu'au 24/07/2026 (§2.9) —
  fallback texte utilisé partout entre-temps, pas parce que les fichiers
  manquaient mais parce qu'aucun composant ne les référençait encore.
- Icônes de nav CRÉÉES (components/icons/nav-icons.tsx), câblées par
  components/nav/TabBar.tsx, toujours utilisées telles quelles depuis.
- app/tokens.css ÉCRIT (P-DS7, dark sur :root + override [data-theme="light"]),
  importé par app/globals.css — consommé par tous les écrans codés depuis
  (Accueil, Classement, Bracket, Matchs, hub Jouer temporaire §2.10).
- public/brand/ : convention posée pour hero-parquet.webp, aucun binaire
  ajouté (pas utilisé par les écrans codés à ce jour).
```

### 2.4 Écran Accueil (session du 21/07/2026, inchangé depuis)

```text
Périmètre : app/(app)/layout.tsx (nav 4 onglets + garde session) et
app/(app)/home/page.tsx (SPEC_ECRAN_ACCUEIL_V0.1.md, Cadrage/V1/Spec visuelle/).

Fichiers : app/(app)/layout.tsx + layout.module.css (étendu §2.8/§2.9) ;
components/nav/TabBar.tsx (+ .module.css, étendu §2.8) ; lib/queries/home.ts
(getHomeData(), types HomeHeader/TodoItem/FeedItem/HomeData) ;
components/home/{HomeHeader,TodoList,TodoRow,Feed,FeedRow,EmptyState}.tsx
(+ .module.css chacun, tous serveur) ; app/(app)/home/page.tsx + page.module.css.

Countdown : components/ui/Countdown.tsx (déplacé depuis components/home/ le
22/07/2026), partagé Accueil + Bracket avant deadline.

Pas de logo ici (§2.9) : les équipes n'apparaissent que dans du texte déjà
formaté (TodoItem.subtitle, FeedItem.label), pas d'objet équipe structuré —
décision explicite de ne pas restructurer ce contrat pour l'instant, voir
GAPS_OUVERTS.md.

Vérifié en conditions réelles avec le jeu de données de test (session du
23/07/2026) : en-tête chiffré, items « À traiter » et feed rendus
correctement pour un joueur réel — non testé auparavant (base vide).
```

### 2.5 Écrans Classement + Bracket (session du 22/07/2026, complété §2.9)

```text
Périmètre : SPEC_ECRAN_CLASSEMENT_BRACKET_V0_1.md (close, 11 décisions actées
§19) appliquée telle quelle. Écrans PARTAGÉS visiteur/joueur connecté : même
lecture, même rendu, seule la RLS filtre le contenu.

Nav des routes partagées (T6a §3.2/§8.1) : /leaderboard et /bracket vivent
hors des groupes (public)/(app). components/nav/PublicNav.tsx (nav réduite,
visiteur) + components/nav/ScreenShell.tsx (choisit TabBar ou PublicNav selon
la session) — TabBar étendu §2.8, sans effet ici tant que rien ne déclare de
saisie sale (ces deux écrans n'écrivent rien).

lib/queries/leaderboard.ts : getLeaderboard(sortKey), types figés à
l'identique de la spec §15.1. Lit `user_scores`/`user_recent_form` — CORRIGÉ
en security_invoker=false le 23/07/2026 (§2.7). `adminCorrectionsCount`
désormais directement porté par `user_scores` (colonne
`admin_corrections_count`, migration #5) — les 2 requêtes séparées sur
match_predictions/bets qui existaient ont disparu. Pas de logo ici non plus
(le Classement n'affiche aucune équipe).

lib/queries/bracket.ts : getBracket(), types figés à l'identique de la spec
§15.2. CONFIDENTIALITÉ PRÉ-DEADLINE : bracket_picks/brackets pas interrogées
tant que isDeadlinePassed est faux — patron repris tel quel pour l'écran
Matchs (§2.8, others/absentees). `components/bracket/NodeCard.tsx` affiche
désormais le logo de chaque équipe (§2.9, `components/ui/TeamLogo.tsx`),
avant l'abréviation.

Composants — feuilles client EXACTEMENT celles listées par la spec §3 :
components/ui/Countdown.tsx ; components/leaderboard/{LeaderboardRow,
StickyMeBar}.tsx ; components/bracket/{SeriesDrillDown,TreeView}.tsx. Le
reste (SortChips, LeaderboardTable, ProgressBar, SeriesGroups, NodeCard,
RotateInvite, BracketSummary, les 2 page.tsx) est serveur — NodeCard reste
sans "use client" malgré l'ajout du logo (TeamLogo porte son propre état
d'erreur, transitivement bundlé client, même mécanisme que MarginStepper §2.8).

Vérifié en conditions réelles avec le jeu de données de test (session du
23/07/2026) : tableau de classement rempli (6 joueurs, avant ET après le
correctif §2.7), les deux vues du bracket, drill-down nominatif avec picks
réels, bascule pré/post-deadline. Logos vérifiés le 24/07/2026 (§2.9) :
présents dans le HTML rendu pour un vrai visiteur authentifié, fichier SVG
effectivement servi (200, image/svg+xml).
```

### 2.6 Jeu de données de TEST (seed, session du 23/07/2026, inchangé depuis)

```text
Constat de départ : les 3 écrans de lecture codés n'avaient jamais été
observés qu'en état vide global — aucune preuve que le rendu « rempli »
fonctionne. Script `scripts/seed-playoffs-test-data.mjs`, HORS
supabase/migrations/ (décision explicite, deux raisons) :
(a) la création de comptes passe par l'API Admin Supabase
    (auth.admin.createUser), non exprimable en SQL portable — public.users
    est alimentée par un TRIGGER depuis auth.users, pas par un INSERT direct ;
(b) ce dépôt n'a qu'UN SEUL projet Supabase lié (`npx supabase db push`
    cible potentiellement la future prod) — un jeu de données jetable ne doit
    pas vivre dans l'historique de migrations rejouable.

Contenu : 30 équipes NBA (référentiel complet) ; 1 compétition PLAYOFFS
ACTIVE de TEST (« Playoffs NBA (test) ») ; bracket complet 15 séries (8
réelles au 1er tour, squelette non résolu pour la suite — aucun résultat
officiel nulle part, aucun score, RIEN qui relève du moteur de scoring T5 ou
de la synchro T4, non codés) ; 9 matchs de 1er tour (fenêtre 3 jours +
au-delà + un `scheduled_at` NULL) ; 7 comptes de test (`seed-*@nba-pronos.test`,
mot de passe posé ponctuellement pour vérification, jamais commité) dont
Sofia_Admin (promue ADMIN après coup, service_role + migration #4), Marco_D
(désactivé APRÈS son prono validé, teste la conservation au classement),
Tariq_M (aucune participation, teste l'absence « jamais joué »). États
couverts : brouillon complet/partiel (le cas exact du correctif T6b §3.1),
prono validé, prono corrigé par un admin (workflow complet rejoué : requête
PENDING → correction → PROCESSED, trigger enforce_prediction_correction
réellement exercé), pari CANCELLED/REJECTED/DRAFT.

Découverte en testant (pas en lisant la spec) : le Classement était quasi
vide pour un joueur normal — corrigé en §2.7, le MÊME défaut existait sur le
compteur X/N de l'écran Matchs, anticipé cette fois AVANT de coder (§2.8).

Réversibilité : script non idempotent (garde anti double-exécution), aucun
script de nettoyage écrit à ce jour — à faire avant tout lancement réel
(§6). Les comptes de test ont un mot de passe temporaire posé à la demande
pour vérification manuelle (jamais affiché dans le chat qu'à titre de
test jetable) ; supprimer via auth.admin.deleteUser le moment venu, pas par
un simple DELETE SQL.
```

### 2.7 Correctif RLS — visibilité universelle du Classement (migration #5, 23/07/2026)

```text
Trouvé en testant le Classement avec le jeu de données de test (§2.6) : un
joueur normal n'y voyait QUE lui-même, alors qu'un admin voyait les 6
joueurs. Cause : `user_scores`/`user_recent_form` étaient en
security_invoker=true (D4/T3 §7) — l'agrégation hérite donc de la RLS des
tables sources, qui ne révèle la ligne d'un AUTRE joueur qu'après
verrouillage du match ou commitment mutuel sur ce MÊME match (« valider =
voir », par match). L'invariant D4/C-5 garantissait que la VALEUR affichée
est toujours juste, pas que le ROSTER complet apparaisse avant tout
verrouillage.

Décision (demandée explicitement par l'utilisateur, pas trouvée seule) : le
Classement doit être visible de tous, tout le temps, indépendamment de la
confidentialité par match/pari/pick — qui reste, elle, INCHANGÉE. Mécanisme :
`user_scores`/`user_recent_form` passent en security_invoker=false
(migration #5, `supabase/migrations/20260723130000_leaderboard_universal_
visibility.sql`) — leur propriétaire contourne déjà la RLS des tables qu'il
possède (pas de FORCE ROW LEVEL SECURITY), une vue non-invoker en hérite,
quel que soit l'appelant. Les deux vues ne renvoient que des agrégats
(points, compteurs), jamais une ligne individuelle — aucune fuite de détail.
`admin_corrections_count` intégré à `user_scores` au passage (§2.5).

Documenté comme correctif post-validation dans
`Cadrage/V1/SPEC_TECHNIQUE_RLS_V0.1.md` §11 (même traitement que les
correctifs T6a/T6b déjà tracés).
```

### 2.8 Écran Matchs (session du 23/07/2026, complété §2.9)

```text
Périmètre : SPEC_ECRAN_MATCHS_V0_1.md (Cadrage/V1/Spec visuelle/, close, 16
décisions actées §19) appliquée telle quelle. Quatrième écran du hub Jouer,
premier écran qui ÉCRIT (brouillon, validation irréversible, garde C2).

Fichiers : app/(app)/play/matches/page.tsx (+ .module.css) ;
lib/queries/matches.ts (getMatches(), types figés à l'identique de la spec
§13) ; lib/actions/matches.ts (saveMatchPredictionDraft/
validateMatchPrediction/validateAllCompleteMatchPredictions, T6b §3.1
corrigé §18.1 — les 2 champs sont optionnels) ; lib/hooks/useUnsavedGuard.tsx
(garde C2, TRANSVERSE — voir plus bas) ; components/matches/* (8 fichiers).
`components/matches/{TeamPicker,MatchRow}.tsx` affichent désormais le logo
de chaque équipe (§2.9).

Fenêtre : `scheduled_at IS NOT NULL AND scheduled_at > now() AND <= now() +
3 jours`, JAMAIS sur `matches.status` (§2/§18.2 — le planificateur, 30-60
min, laisserait un match commencé en SCHEDULED près d'une heure). Groupement
par jour en fuseau Europe/Paris (aucune convention de fuseau n'existait
ailleurs dans le code — choix explicite et documenté, pas deviné).

Trois feuilles client EXACTEMENT (MatchRow, PredictionForm,
ValidateAllBanner) ; TeamPicker/MarginStepper/RevealPanel/BetShortcut/
MatchDayGroup SANS "use client" propre (rendus par un parent client, même
mécanisme que NodeCard/SeriesGroups du bracket — MarginStepper et RevealPanel
portent quand même leur propre useState local, ce que permet ce mécanisme).

Deux points BLOQUANTS trouvés et tranchés AVEC l'utilisateur avant de coder
(pas en silence) :
- Compteur « X/N ont pronostiqué » (§8) : même défaut que §2.7, mais PAR
  MATCH — un simple count() en session joueur sous-compte tant que
  l'appelant n'a pas lui-même validé sur CE match précis. Corrigé par une
  fonction SECURITY DEFINER dédiée (migration #6,
  `count_committed_predictions(p_match)`, même principe que
  `has_committed_prediction()` déjà en base) — ne renvoie qu'un entier.
- Raccourci pari (§10), règle « REJECTED avant/après sa deadline » :
  aucune colonne ne capture le moment d'un rejet (pas de `rejected_at`, et
  `rejectBet` n'existe pas encore, lot « Paris »). Tranché : un pari REJECTED
  est TOUJOURS considéré libéré (cas normal — sealDeadlines auto-valide tout
  SUBMITTED à la deadline, donc un rejet après coup est un cas limite hors
  fonctionnement normal). Documenté dans le code, pas deviné en silence.

Confidentialité — même patron que getBracket() : `others`/`absentees` sont
VIDES côté serveur tant que `isRevealed` est faux (la requête n'est pas
lancée). Sur cet écran, `isRevealed` se simplifie à `isAdmin OR statut ===
VALIDATED` — le verrouillage temporel (autre branche RLS) ne peut
structurellement jamais se produire ICI (l'écran ne montre que des matchs à
venir, jamais verrouillés, §2/§18.2).

Garde C2 (`lib/hooks/useUnsavedGuard.tsx`, extension acceptée avec
l'utilisateur AVANT de coder, pas décidée seule) : Context + Provider,
drapeau `dirty` AGRÉGÉ au niveau de l'écran (plusieurs MatchRow peuvent être
ouvertes et sales simultanément, §3/§12). Utilise `onNavigate` sur <Link>
(API officielle Next.js 16, pas un hack) pour intercepter une navigation
interne. Étend DEUX fichiers partagés par tous les écrans, changement inerte
tant que rien ne déclare de saisie sale :
- components/nav/TabBar.tsx : `onNavigate` sur les 4 onglets.
- app/(app)/layout.tsx : monte `UnsavedGuardProvider` autour de {children} +
  <TabBar/>.
ATTENTION trouvée en cours de route : TabBar est AUSSI rendu par ScreenShell
(/leaderboard, /bracket — hors de app/(app)/layout.tsx, donc sans provider).
`useGuardedNavigation()` se dégrade en no-op si le contexte est absent,
plutôt que de lever une erreur — sinon ces deux écrans auraient cassé pour
un visiteur connecté. Vérifié après coup : /home, /leaderboard, /bracket
répondent toujours 200 avec du contenu réel (pas de page d'erreur).

Interprétations d'implémentation (pas des choix produit — la spec ne
précisait pas l'exact mécanisme) :
- Stepper d'écart : le « pavé numérique » (§6) est un `<input type="number"
  inputMode="numeric">` — déclenche le clavier numérique natif du système
  sur mobile, pas une grille de touches maison.
- Statuts de prono (§4) : rendus en CSS pur (bordures/fonds tokens), coche
  ✓ et flèche → en caractères, aucune icône SVG créée — la spec elle-même
  écrit « ✓ LAL −8 » en toutes lettres.
- Badge « corrigé par un admin » : le contrat de types figé (§13) ne porte
  qu'un booléen `isAdminCorrected` (pas de nom d'admin ni de requérant, que
  la prose §8 mentionne) — le type fait autorité, badge générique.
- Destination du raccourci pari (§10, non fixée par la spec, §18.3) :
  pointe vers `/play` (hub existant) en attendant que `/play/bets/new`
  existe — inchangé par le hub temporaire §2.10 (toujours `/play`, la vraie
  route de création de pari n'existe pas plus qu'avant).

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` tous propres,
aucun conflit de route. Testé en conditions réelles avec de VRAIES sessions
authentifiées (cookies SSR générés via @supabase/ssr — pas de navigateur
disponible, donc pas de clic réel sur les boutons ; les mécaniques d'écriture
— upsert partiel, RLS post-validation — ont été rejouées directement en
session RLS réelle, hors des boutons de l'UI, résultat identique) : fenêtre
3 jours correcte (5 des 9 matchs, le NULL et les 3 hors fenêtre absents) ;
regroupement par jour correct (« Demain », « Samedi 25 », « Dimanche 26 ») ;
4 statuts distincts observés (à faire / incomplet / prêt / validé) sur des
joueurs réels différents ; brouillon partiel confirmé persistant (le cas
T6b §3.1) ; confidentialité confirmée des deux côtés (Amine92 : 3 matchs
révélés seulement, absents corrects, aucune fuite sur les 2 non révélés ;
Sofia_Admin : tout révélé) ; bandeau « Tout valider » apparaît bien
uniquement quand readyCount > 0 (Chloe_B) ; RLS confirmée bloquant une
ré-écriture après validation (0 ligne affectée — piège trouvé en testant,
voir §7) ; /home, /leaderboard, /bracket non régressés.

Confirmé par l'utilisateur en testant lui-même dans un vrai navigateur
(24/07/2026) : rendu visuel « top », clics et saisie fonctionnels. Deux
remontées traitées en §2.9 (logos absents, pas de déconnexion possible).
```

### 2.9 Compléments post-test utilisateur (session du 24/07/2026)

```text
L'utilisateur a testé l'écran Matchs lui-même (premier vrai test au clavier/
souris de toute la V1) et a remonté deux points.

Logos de franchise absents partout — d'abord mal diagnostiqué : la première
réponse (« les fichiers ne sont pas déposés ») était FAUSSE, basée sur une
note de suivi obsolète plutôt que sur une vérification du disque. Corrigé
après relecture directe de public/logos/teams/ : les 30 SVG existent bien
et sont déjà committés depuis le 21/07/2026 — la vraie cause est qu'aucun
écran ne les référence jamais dans son code (0 occurrence de `logos/teams`
ou `logo_url` avant ce jour, vérifié par recherche globale). Décision avec
l'utilisateur : câbler UNIQUEMENT Bracket et Matchs maintenant (les 2 seuls
écrans avec un objet équipe structuré, `TeamRef`/`BracketNode.teamA/teamB`).
Accueil et Classement laissés de côté et documentés dans GAPS_OUVERTS.md —
Accueil ne porte les équipes que dans du texte déjà formaté, Classement n'en
affiche aucune. `components/ui/TeamLogo.tsx` (NOUVEAU, partagé) : chemin
déduit de `{abbreviation}.svg`, AUCUN champ ajouté aux contrats de types
figés, AUCUNE colonne base consommée (`teams.logo_url` reste vide, non
utilisée). `next/image` avec `unoptimized` (Next.js bloque l'optimisation
SVG par défaut, nécessiterait `dangerouslyAllowSVG` + CSP dans next.config —
évité) ; repli sur l'abréviation texte via `onError` si un fichier venait à
manquer pour une équipe. Câblé dans `NodeCard.tsx` (Bracket) et
`TeamPicker.tsx`/`MatchRow.tsx` (Matchs). Vérifié avec de vraies sessions
authentifiées : chemins corrects dans le HTML rendu, fichier réellement
servi (200, image/svg+xml).

Aucun moyen de se déconnecter — remonté par l'utilisateur en testant.
Vérifié : `logout()` existe dans `lib/auth/actions.ts` depuis le tout début
mais n'était câblée sur AUCUN bouton, AUCUN écran. Ajout d'un bouton
TEMPORAIRE dans `app/(app)/layout.tsx` (coin haut-droit, hors design system
— bordure pointillée, texte muted, volontairement pas fini), demandé
explicitement par l'utilisateur en attendant l'écran Profil. Couvre
uniquement la zone `(app)` (Accueil/Jouer/Matchs/Profil), pas
`/leaderboard`/`/bracket` (ScreenShell). Testé de bout en bout SANS
JavaScript, en rejouant le vrai POST de formulaire (multipart, champ caché
`$ACTION_ID_...` extrait du HTML rendu — voir §7 pour la technique) : 303 →
/login, cookie de session effacé (Max-Age=0). Tracé dans GAPS_OUVERTS.md
comme « à retirer » — ne doit pas survivre jusqu'à la V1 finale.

Aucune migration, aucun changement de schéma dans ce lot. `npx tsc --noEmit`,
`npx eslint .`, `npx next build` propres après chaque changement.
```

### 2.10 Hub Jouer temporaire (session du 24/07/2026, nouveau)

```text
Problème posé : l'écran Matchs (§2.8/§2.9) est codé et vérifié, mais
l'onglet « Jouer » de la nav pointait sur app/(app)/play/page.tsx, resté un
stub « à venir » depuis le tout début — cul-de-sac, aucun moyen d'y accéder
depuis l'UI.

Fait : app/(app)/play/page.tsx remplacé par un hub MINIMAL et
VOLONTAIREMENT TEMPORAIRE, en attendant le vrai hub Jouer (spec d'écran
dédiée, non écrite, hors périmètre de ce lot). Composant SERVEUR (aucun
"use client", rien ici n'en a besoin) : liste de 4 entrées reprises de
l'arbre app/ de SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md — « Matchs » en
<Link> actif vers /play/matches ; « Mes pronos » (/play/my-predictions),
« Mon bracket » (/play/bracket), « Paris » (/play/bets) rendues INERTES
(PAS de <Link>, pour éviter un 404 puisque ces 3 routes n'existent pas
encore), libellé « à venir ». app/(app)/play/page.module.css colocalisé,
lisant exclusivement les tokens sémantiques de app/tokens.css (aucune valeur
en dur) — même convention que tous les écrans codés depuis Accueil (§2.3).

Marqué TEMPORAIRE aux trois endroits, même patron que le bouton de
déconnexion (§2.9) : commentaire dans le code (page.tsx, page.module.css),
mention visible dans le rendu (« Hub temporaire — sera remplacé »), entrée
dans GAPS_OUVERTS.md. Aucune pastille « à faire » calculée (hors périmètre,
rôle du vrai hub, qui devra probablement l'afficher). Aucun autre fichier
touché : TabBar, layout, migrations et dépendances inchangés.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres,
aucun conflit de route (/play toujours listé seul dans la carte des routes
générée par le build, à côté de /play/matches). Aucune migration, aucun
changement de schéma.

À RETIRER dès que le vrai hub Jouer existe (voir GAPS_OUVERTS.md et §6
ci-dessous) — ne doit pas survivre jusqu'à la V1 finale, même remarque que
le bouton de déconnexion temporaire (§2.9).
```

### 2.11 Écran Mes pronos (session du 24/07/2026, CLOSE)

```text
Périmètre : SPEC_ECRAN_MES_PRONOS_V0_1.md (Cadrage/V1/Spec visuelle/, close,
31 décisions actées §19) appliquée telle quelle. Cinquième écran du hub
joueur, DEUXIÈME écran qui ÉCRIT (une seule écriture : la requête de
correction), PREMIER écran qui porte le LIVE (badge EN DIRECT, retiré de
l'écran Matchs). Ancré sur les MATCHS VERROUILLÉS (scheduled_at <= now()),
jamais sur matches.status — aucun recouvrement avec Matchs (scheduled_at >
now()), même horloge, deux sens.

ÉTAPE 0 (vérification de dépôt, §18, lecture seule) : les 3 points étaient
tous déjà corrects, rien à corriger dans la migration #7 —
`TeamRef` (lib/queries/matches.ts) importable tel quel ; la policy SELECT
sur correction_requests EXISTAIT DÉJÀ (migration #3, `correction_requests_
select`) ; les triggers T-b/T-c (migration #3) acceptent bien un UPDATE admin
sur une ligne vide (aucun contrôle de complétude dans leur code, seulement
la machine à états DRAFT/VALIDATED et la cohérence requête↔admin) ;
`count_committed_predictions` (migration #6) filtre bien `status <> 'DRAFT'`.
Requête réelle en base : 0 match avec scheduled_at <= now() — écran
invérifiable en l'état. Décidé AVEC l'utilisateur : étendre le seed plutôt
que ne rien coder. `scripts/seed-playoffs-test-data.mjs` étendu (3 matchs
existants passés dans le passé plutôt que d'en inventer : CLE-ORL#1 FINISHED
101-97, prono Yanis44 corrigé — teste le rendu nominatif §7.1 ; DEN-SAC#1
IN_PROGRESS 58-52, prono Marco_D (désactivé) — teste le badge EN DIRECT + la
conservation ; MIN-GSW#1 laissé SCHEDULED malgré une date passée — teste le
MatchLiveState 'STARTED', latence assumée §5.4 — + 1 prono partiel Nina_R
ajouté dessus, seul cas INCOMPLETE du lot). Le script a été mis à jour ET la
base déjà seedée a été alignée directement (3 UPDATE + 1 INSERT ciblés,
non destructifs — pas de wipe/reseed complet, qui aurait exigé de supprimer
et recréer les 7 comptes auth).

ÉTAPE 1 : `lib/labels/rounds.ts` créé (extraction PURE de `ROUND_LABELS`,
portée en dur jusque-là par `lib/queries/bracket.ts`), importé par Bracket ET
Mes pronos (§16.5). Aucun libellé changé.

ÉTAPE 2 — 2 migrations, montrées intégralement et confirmées avant push :
- **migration #7** (`20260724100000_request_prediction_correction.sql`) :
  fonction `request_prediction_correction()` SECURITY DEFINER, voie A (§10.2)
  — si aucune ligne (user_id, match_id) n'existe, en crée une VIDE (DRAFT,
  les deux champs NULL) puis pose la `correction_requests` liée, dans une
  seule transaction. Garde-fous (§10.3) : auth.uid() uniquement, joueur
  ACTIVE, match effectivement verrouillé, réutilisation si une ligne existe
  déjà (jamais de doublon), justification obligatoire, une seule requête
  PENDING à la fois (déjà imposé par un index unique partiel du schéma,
  contrôle applicatif redondant pour un message clair). Justification du
  contournement RLS documentée EN COMMENTAIRE dans le fichier de migration.
- **migration #8** (`20260724110000_realtime_matches.sql`) :
  `alter publication supabase_realtime add table matches;` — UNIQUEMENT
  `matches`, jamais `series` (reporté au lot Bracket personnel, chaque table
  publiée quand un écran en a besoin).
Les deux vérifiées après push par appel direct (garde d'authentification
confirmée en aveugle) — voir aussi le test en conditions réelles plus bas.

ÉTAPE 3 : `lib/queries/my-predictions.ts` (`getMyPredictions()`, types §13
recopiés à l'identique, `TeamRef` réimporté) + `lib/actions/corrections.ts`
(`requestPredictionCorrection()`, appel `.rpc()` uniquement). Dérivation
d'état (§8) PAR COMPLÉTUDE UNIQUEMENT (§10.4), jamais par présence ni statut
brut. **Décision tranchée AVEC l'utilisateur** (ambiguïté trouvée en codant,
non couverte par le tableau §8 fermé) : `sealDeadlines` (l'auto-validation
DRAFT complet → VALIDATED décrite par T6b §2) n'est INVOQUÉE NULLE PART dans
le code — aucun cron, aucune fonction de ce nom n'existe, seulement des
commentaires qui la mentionnent. Une ligne DRAFT aux DEUX champs remplis
(joueur qui a rempli son prono sans cliquer « Valider » avant le
verrouillage) est donc un 4e cas non prévu par le tableau. Tranché : la
complétude prime sur le statut brut → rendu FROZEN, appliqué symétriquement
à MON prono et à ceux des AUTRES joueurs (RevealPanel). Filtres date/série
(§4.2) calculés en Europe/Paris sans librairie externe (offset recalculé à
midi UTC du jour visé, même contrainte que `lib/queries/matches.ts`).

ÉTAPE 4 : `app/(app)/play/my-predictions/page.tsx` + `components/my-
predictions/*` (MatchRowStatic, PredictionSummary, RevealPanel,
AssociatedBetCard, SeriesBetHeader, FilterBar, SegmentTabs,
CorrectionRequestForm — tous SERVEUR ; `urls.ts`, utilitaire pur sans JSX).
**Un seul fichier `"use client"` : `LiveSubscriber.tsx`**, qui exporte à la
fois le Provider (souscription Realtime unique, Context React) ET un
consommateur (`LiveBadgeAndScore`, lu depuis les lignes SERVEUR) — toujours
dans le même fichier, donc une seule frontière client pour l'écran (§1.1).

**Point touché hors périmètre strict de la spec, décidé AVEC l'utilisateur
en cours de route** : `components/ui/TeamLogo.tsx` (partagé Bracket/Matchs
depuis §2.9) n'avait jamais sa PROPRE directive `"use client"` — il ne
fonctionnait que parce que ses 2 points d'appel existants sont TOUJOURS
atteints via un ancêtre client (`NodeCard` rendu exclusivement par
`SeriesDrillDown`/`TreeView`, `MatchRow` lui-même client). Sur Mes pronos,
`MatchRowStatic` (serveur, sans ancêtre client) l'utilise directement pour
la première fois — cas jamais rencontré. Choix (recommandé, validé par
l'utilisateur plutôt que de vérifier empiriquement d'abord) : ajouter
`"use client"` directement à `TeamLogo.tsx`. Aucun changement de rendu pour
Bracket/Matchs (déjà dans ce cas en pratique), confirmé par `next build`
sans régression.

Formulaire de correction (`CorrectionRequestForm`) : `<form action={...}>`
natif (§1.1 point 3), wrapper `requestPredictionCorrectionFormAction`
(`lib/actions/corrections.ts`) qui reçoit un `FormData` brut et REDIRIGE
(succès ou échec) — un formulaire sans JS ne peut pas lire une valeur de
retour, l'erreur est donc portée par l'URL de redirection
(`?correctionError=...&correctionMatchId=...`) et rendue par la page au
rechargement, dans la bonne ligne (`<details open>` forcé).

**Vérifications ÉTAPES 1-4** : `npx tsc --noEmit`, `npx eslint .`,
`npx next build` tous propres après chaque étape, aucun conflit de route
(`/play/my-predictions` listé seul).

**Test en conditions réelles (ÉTAPE 5, même session)** : serveur local
(`next start`) + sessions authentifiées réelles obtenues en rejouant le vrai
POST sans JS du formulaire de connexion (React 19/Next 16 encode désormais
ce cas avec 3 champs cachés `$ACTION_REF_N` / `$ACTION_N:0` / `$ACTION_N:1` /
`$ACTION_KEY`, PAS le champ unique `$ACTION_ID_...` observé jusqu'ici sur
`logout()` — la différence tient au fait que `login`/`signup` sont liées via
`useActionState`, avec un état lié en argument, contrairement à `logout()` ou
`requestPredictionCorrectionFormAction`, actions SANS état lié). Deux mots de
passe temporaires posés via l'API Admin sur Amine92/Marco_D (jamais affichés
dans le chat), re-randomisés en fin de session.

Résultats, tous conformes : fenêtre Récent correcte (2 des 3 matchs
verrouillés, le plus ancien exclu mais présent dans les filtres) ; badge EN
DIRECT + score et score final rendus correctement ; prono FROZEN de Marco_D
(désactivé) bien conservé et affiché ; panneau des autres joueurs avec le
rendu NOMINATIF exact du §7.1 (« Saisi par Sofia_Admin à la demande de
Yanis44 — … ») ; **écriture réelle testée** : dépôt d'une requête de
correction par Amine92 sur un match MISSING → ligne `match_predictions` vide
créée + `correction_requests` PENDING créée exactement selon la voie A,
rechargement affichant bien « Requête en attente. » ; **cas négatif testé** :
la même tentative par Marco_D (désactivé) bloquée par la garde `is_active()`
de la fonction SQL, erreur affichée dans la bonne ligne au rechargement.
Aucune régression sur `/home`, `/leaderboard`, `/bracket`, `/play`,
`/play/matches`.

**Trouvaille distincte, hors périmètre du lot mais vérifiée à la demande de
l'utilisateur** : le vrai flux d'INSCRIPTION (`/signup`) a été testé pour la
première fois de bout en bout sur ce projet (les 7 comptes de seed avaient
tous été créés via l'API Admin, qui ne passe jamais par l'envoi d'email). Le
code est correct (code compétition vérifié, unicité du pseudo vérifiée,
appel `signUp()` dans le bon ordre) mais échoue avec `429 — email rate limit
exceeded` côté Supabase : conséquence DIRECTE du point déjà connu §6
ci-dessous (« Confirm email » toujours actif) — tant qu'il ne l'est pas
désactivé, chaque inscription réelle tente d'envoyer un email de
confirmation et sature vite le mailer par défaut. Aucun compte orphelin
créé (vérifié via l'API Admin). Non corrigible par le code, action dashboard
seule.

Reste en base, artefact de test légitime non nettoyé : 1 requête PENDING
(Amine92/DEN-SAC) + sa ligne `match_predictions` vide associée.
```

### 2.12 Correctif pastille de logo (session du 25/07/2026)

```text
Remonté par l'utilisateur en testant l'écran Mes pronos (visible aussi sur
Bracket/Matchs, même composant partagé) : SPEC_DESIGN_SYSTEM_V0_1.md §10.1
(acté §14.3) exige une pastille neutre CONSTANTE (`--color-logo-pastille`,
#EDF1F7, cercle `--radius-full`, identique dark/clair) DERRIÈRE chaque logo
— jamais implémentée depuis la création de `TeamLogo.tsx` (§2.9) : le logo
(et son repli abréviation) s'affichait nu, sans fond.

Corrigé en 2 étapes montrées et validées séparément :
1. `app/tokens.css` : nouveau token `--color-logo-pastille-text` (texte du
   repli, `var(--c-navy-900)` — sombre CONSTANT sur la pastille claire
   constante, jamais un token qui suit le thème, §10.3).
2. `components/ui/TeamLogo.module.css`/`.tsx` réécrits : nouveau conteneur
   `.pastille` (fond + `border-radius: var(--radius-full)` + padding
   `--space-1`, `size` = diamètre de la pastille, `box-sizing: border-box`
   pour ne pas changer l'empreinte visuelle) enveloppant le logo OU le
   repli abréviation, qui remplissent désormais 100% du conteneur au lieu
   de porter leur propre fond/couleur.

Aucun autre fichier touché (aucun appelant de `TeamLogo` modifié — le
changement est interne au composant). Vérifié : `npx tsc --noEmit`,
`npx eslint .`, `npx next build` tous propres. Gap retiré de
`GAPS_OUVERTS.md`.
```

### 2.13 Refonte de l'entête Matchs + correctif des 30 logos (session du 25/07/2026, suite)

```text
Suite de petites retouches demandées par l'utilisateur en testant l'écran
Matchs, conduites une par une, chacune montrée en diff et vérifiée
(tsc/eslint/build) avant la suivante. Rien de committé à ce stade.

TeamPicker.tsx (carte dépliée, PredictionForm) :
- Logo agrandi 32 → 48px (seule cette carte ; MatchRow replié et NodeCard du
  bracket gardent leurs tailles).
- Abréviation retirée de l'affichage (ne restent QUE le logo et le nom
  complet en petit) — l'abréviation vit désormais uniquement dans l'entête
  replié (ci-dessous), plus besoin de la répéter ici. Classe .abbrev, devenue
  inutilisée, retirée de TeamPicker.module.css.

MatchRow.tsx (+ .module.css) — refonte de l'entête REPLIÉ, variante A « split
neutre » (demandée explicitement, comportement d'ouverture inchangé) :
- Les 2 <TeamLogo> disparaissent de l'entête replié (recentrés ailleurs, cf.
  ci-dessous) ; remplacés par un split 2 colonnes (grosse abréviation par
  équipe, séparateur vertical 1px) — import TeamLogo retiré de MatchRow.tsx
  (plus utilisé dans ce fichier après ce changement).
- Nouvelle structure : .split (grille 3 colonnes équipe/séparateur/équipe) au-
  dessus, .metaRow (heure+verrou à gauche, statut+chevron à droite, séparée
  par une bordure horizontale) en dessous — remplace l'ancienne grille à 4
  colonnes sur une seule ligne.
- Token de taille de l'abréviation repris À L'IDENTIQUE de TeamPicker
  (--font-size-lg), pas réinventé.
- .status/.status*/.chevron/.chevron Open/.time/.lock/.row inchangés (mêmes
  règles, juste redistribués dans la nouvelle disposition).

Correctif des 30 logos de franchise (public/logos/teams/*.svg) — remonté par
l'utilisateur en testant Mes pronos : les logos paraissaient décentrés dans
leur pastille (certains « trop hauts », d'autres « trop à gauche »), variable
selon l'équipe. Diagnostic (pas supposé, vérifié fichier par fichier) : ce
n'était PAS un bug de TeamLogo.tsx/.module.css (le centrage CSS via
object-fit:contain + flex était déjà correct), mais un défaut des fichiers
SVG eux-mêmes — chaque `viewBox` réservait un canevas plus grand que le
dessin réel (ex. SAS.svg : viewBox déclaré 420×399.5, mais tous les tracés du
fichier restent sous y≈180 — plus de la moitié du canevas est du vide jamais
dessiné, poussant visuellement le logo en haut de sa pastille). Neuf fichiers
(ATL/DEN/DET/IND/LAC/MIN/PHI/TOR/WAS) partagent un viewBox absolument
identique (`420 514.7`) — signe d'un gabarit d'export commun, pas d'un
défaut isolé.

Corrigé par un script Node jetable (aucune dépendance ajoutée, aucun
navigateur) : parseur de tracés SVG maison (commandes M/L/H/V/C/S/Q + Z,
échantillonnage à 32 points par courbe de Bézier pour l'approximation —
aucune commande d'arc rencontrée dans ces 30 fichiers, vérifié par recherche
avant d'écrire le parseur) + polygones/rects/cercles, calcule la boîte
englobante RÉELLE du dessin de chaque logo, puis réécrit son `viewBox` pour
qu'il colle au dessin (marge uniforme de 4 % de la plus grande dimension).
Diff complet (30 lignes, une par équipe) montré et confirmé par l'utilisateur
AVANT toute écriture — passe dry-run puis passe d'écriture séparées. Chaque
fichier n'a qu'UNE seule ligne changée (l'attribut viewBox), rien d'autre
dans le XML. Confirmé visuellement par l'utilisateur après coup : logos bien
centrés.

Vérifié après chaque étape : `npx tsc --noEmit`, `npx eslint .`,
`npx next build` tous propres. Aucun autre fichier touché (TeamPicker/
MatchRow restent les 2 seuls fichiers de code modifiés ; les 30 SVG sont les
seuls assets modifiés). Committé et poussé sur `main` sur demande explicite
de l'utilisateur (« Commit tout et push ») — voir §2.14.
```

### 2.14 Commit/push du lot logos + amendements de specs (session du 25/07/2026, suite)

```text
Le lot §2.13 (entête Matchs + correctif des 30 logos) a été committé
(`5956966`) et poussé sur `main` sur demande explicite de l'utilisateur
(« Commit tout et push »), à la suite du commit du correctif de pastille
(`483a9fb`, §2.12) et du lot « Mes pronos » (`d73498b`, §2.11).

Une expérimentation intermédiaire, demandée puis explicitement ABANDONNÉE
dans la foulée, n'a laissé AUCUNE trace dans le code committé : un fond de
pastille à 50 % d'opacité (`color-mix(in srgb, var(--color-logo-pastille)
50%, transparent)` dans `TeamLogo.module.css`) a été essayé, montré en diff,
puis retiré sur demande avant tout commit — retour au fond plein d'origine.
Consigné ici pour mémoire, mais ce n'est PAS un amendement de §10.1/§14.3 de
`SPEC_DESIGN_SYSTEM_V0_1.md` : rien n'a changé sur ce point.

**Amendements consignés dans les specs elles-mêmes** (pas seulement ici —
demandé explicitement par l'utilisateur, pour que les fichiers de cadrage
restent la source de vérité au-delà de ce fichier d'état) :
- `SPEC_DESIGN_SYSTEM_V0_1.md` §16 (nouveau) : le tier `--logo-size-lg`
  (48px, « moment fort », §10.2) se déplace de l'entête de match (qui perd
  son logo) vers la carte-sélecteur `TeamPicker` ; provenance réelle des
  logos clarifiée (déposés à la main par l'utilisateur, indépendants de
  Highlightly/B4 cité au préambule de §10) ; test de pastille à 50 %
  documenté comme abandonné, pas comme amendement.
- `SPEC_ECRAN_MATCHS_V0_1.md` §20 (nouveau) : l'entête replié (§3.1) passe du
  mockup `[logo] BOS – MIA …` à un split neutre deux abréviations sans logo ;
  annotation inline ajoutée directement sous le mockup d'origine (même
  patron que l'amendement V0.2 de T7) ; ligne 17 ajoutée au récapitulatif
  §19.

Clarification demandée par l'utilisateur avant d'écrire quoi que ce soit dans
`GAPS_OUVERTS.md` (AskUserQuestion) : le décentrage des logos (§2.13) est
bien réglé et confirmé — le point resté réellement ouvert est différent
(tailles inégales entre logos faute de viewBox uniformément carré, cf.
`GAPS_OUVERTS.md`), pas le décentrage lui-même. Une reformulation naïve
aurait rouvert à tort un point déjà fermé et confirmé par l'utilisateur.
```

### 2.15 Écran Nouveau pari + saisie inline dans Matchs (sessions du 26-27/07/2026)

```text
Périmètre : SPEC_ECRAN_NOUVEAU_PARI_V0_1.md (Cadrage/V1/Spec visuelle/,
CLOSE) — premier écran du lot « Paris », ferme la destination du raccourci
pari (SPEC_ECRAN_MATCHS_V0_1.md §18.3, GAPS_OUVERTS.md). Sixième écran du
hub joueur, TROISIÈME écran qui ÉCRIT.

Spec livrée en statut BROUILLON : Claude s'est arrêté avant tout code (règle
du dépôt) et a signalé le blocage plutôt que de deviner. Close en clarifiant
3 points de son §16 (AskUserQuestion, pas tranchés seul) : défauts de
brouillon (catégorie PLAYER_PROP, difficulté 3, §5.4) ; cible figée en
édition — scope/série/match non modifiables une fois le pari créé, un
nouveau pari pour viser ailleurs (§9.2) ; libellés d'états vides/erreurs du
§12 actés tels quels.

Pré-vol §15 (avant la 1re ligne de code) : trigger `enforce_bet_transitions`
(migration #3) ne whitelistait pas `SUBMITTED → DRAFT` (le geste « retirer »,
§9) — BLOQUANT, migration dédiée requise (voir plus bas). `bet_deadline_open`
(migration #3) confirmée réutilisable, sa réplique TypeScript existait déjà
dans `lib/queries/home.ts` — pas une 3e implémentation. Routes `/play/bets/*`
confirmées absentes du disque. `TeamLogo` confirmé réutilisable, tier 20px
retenu pour les sélecteurs de cet écran.

**Décision structurante confirmée AVEC l'utilisateur** : les 3 server actions
suivent le patron `request_prediction_correction` (fonction SQL `SECURITY
DEFINER`, migration #7) plutôt qu'une logique TypeScript pure
(`lib/actions/matches.ts`) — la garde de quota « 3 paris MATCH/série » (0.2.4
§6) n'a aucun backstop d'index unique, contrairement aux deux quotas « 1
actif » ; un `SELECT count` puis `INSERT` en deux allers-retours TypeScript
laisserait une fenêtre de course entre deux soumissions quasi simultanées.

Migration #9 (`20260726120000_bet_withdraw_transition.sql`) : ajoute
`SUBMITTED → DRAFT` à `enforce_bet_transitions` (`create or replace
function`, trigger existant inchangé). Migration #10
(`20260726130000_bet_write_functions.sql`) : `save_bet(...)` (création OU
édition, DRAFT/SUBMITTED selon `p_submit` ; refuse `p_submit=false` sur un
SUBMITTED — le retrait passe exclusivement par l'autre fonction) et
`withdraw_bet(p_bet_id)`, toutes deux `SECURITY DEFINER`, reproduisant
ELLES-MÊMES chaque garde du §11 (propriétaire, statut, deadline, cible
identifiée, quota, scope interdit en NBA Cup — RLS contournée par le rôle
propriétaire, rien ne lui est délégué, comme migration #7). Messages
d'erreur des cas produits repris mot pour mot du §12.
**`pg_advisory_xact_lock`** (clé = user × série) ajouté par Claude AVANT le
comptage du cap « 3 MATCH/série » (pas demandé explicitement, nécessaire
pour que le choix SECURITY DEFINER tienne sa promesse d'atomicité — sans
lui, deux créations concurrentes sur la même série auraient pu chacune lire
« 2 existants » et produire 4 paris actifs). Les deux migrations montrées
intégralement, confirmées, poussées par l'utilisateur lui-même (`npx
supabase db push` bloqué pour Claude par le classificateur de permissions de
l'environnement — pas un refus de Claude).

Code : `lib/labels/bets.ts` (catégories/difficultés/défauts/cap de quota,
SANS dépendance serveur — importable par le composant `"use client"` sans
faire fuiter `next/headers` dans son bundle, piège trouvé EN écrivant le
formulaire, corrigé avant qu'il ne casse le build) ; `lib/queries/bets.ts`
(`getNewBetFormData`/`getEditBetFormData`, dispos recalculées serveur en
reproduisant `bet_deadline_open`) ; `lib/actions/bets.ts`
(`saveDraftBet`/`submitBet`/`withdrawBet`, relais fins vers `.rpc()`) ;
routes `app/(app)/play/bets/new/` et `.../[id]/edit/` + `components/bets/
BetForm.tsx` (SEULE feuille `"use client"`, sélecteurs série/match en listes
de boutons + logos, catégorie/difficulté en `<select>` natifs). Hub
temporaire (§2.10) et `BetShortcut` (écran Matchs) mis à jour pour pointer
vers la vraie route — gap fermé.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` propres à
chaque étape. **Test en session authentifiée réelle** (script Node jetable,
service_role pour la préparation + `signInWithPassword` pour la vraie
session testée) : 26 vérifications passées — cycle de vie complet (créer,
soumettre, ré-écrire un SUBMITTED sans toucher `submitted_at`, retirer,
re-soumettre avec `submitted_at` renouvelé) + 5 cas négatifs (retrait d'un
DRAFT, brouillon d'un SUBMITTED, pari d'un AUTRE joueur, cible déjà
commencée, doublon sur un match, cap 3 MATCH/série). Fixtures de test
(dates de matchs, paris jetables) nettoyées, base vérifiée identique à
l'état seedé après coup.

**Test manuel navigateur** (session du 27/07/2026, suite) : aucun skill
projet pour lancer l'app, `chromium-cli` indisponible — `playwright`
installé temporairement (`--no-save`, retiré après, `package.json` jamais
touché), pilotant le serveur `next dev` DÉJÀ EN COURS (réutilisé plutôt que
d'en relancer un second). 6 scénarios rejoués avec captures : entrée libre,
création, édition→soumission, ré-édition→retrait, raccourci réel depuis
Matchs, raccourci vers un match fermé (repli + message discret §2) — tous
conformes. Un faux résultat (état d'un test précédent semblant subsister
après un chaînage de navigations dans le même onglet) écarté en isolant la
navigation dans un contexte navigateur neuf — le rendu serveur était en
réalité correct.

**Deux évolutions demandées après le test, mêmes conventions** :
- **Bandeau sticky** : la zone de saisie (énoncé/catégorie/difficulté/
  boutons, pas seulement les boutons) reste `position: fixed` en bas du
  viewport dans `BetForm.module.css`, plutôt qu'à atteindre en scrollant.
  Bug trouvé en MESURANT (`getBoundingClientRect`, pas une capture d'écran —
  biaisée en plein-page à cause du repositionnement temporaire du viewport
  par l'outil de capture) : l'offset copié du patron `StickyMeBar`
  (56px) chevauchait de ~11px la barre d'onglets (hauteur RÉELLE ~67px,
  supérieure à ce que le calcul supposait) — corrigé (`+var(--space-6) +
  env(safe-area-inset-bottom, 0px)`, ~76px), marge confirmée après coup.
- **Saisie inline dans Matchs** : élargissement RÉEL du périmètre acté par
  la spec §1 (confirmé explicitement avec l'utilisateur avant de coder,
  pas deviné) — `BetShortcut.tsx` remplacé par `components/matches/
  InlineBetForm.tsx`, formulaire complet ciblé sur CE match (scope MATCH
  figé, pas de sélecteur série/match), pré-rempli si un DRAFT/SUBMITTED
  existe déjà. `lib/queries/matches.ts` étendu : nouveau type `MyMatchBet`
  (contenu du pari actif du joueur sur ce match), requête `bets` élargie
  (portait avant seulement scope/statut). Les routes dédiées restent en
  place pour les paris SÉRIE et l'entrée libre. Testé en navigateur réel :
  création inline, pré-remplissage, soumission, retrait — confirmés.

**Point laissé ouvert, signalé explicitement, pas tranché** : le bandeau
sticky n'a pas été reproduit pour la version inline (collision possible si
plusieurs lignes de match sont dépliées simultanément) — voir
`GAPS_OUVERTS.md`.

Vérifié à nouveau après les 2 évolutions : `npx tsc --noEmit`, `npx eslint .`,
`npx next build` propres. Toutes les fixtures de test (mots de passe, dates
de matchs, paris jetables) nettoyées et vérifiées restaurées à l'identique ;
dépendance `playwright` retirée. Aucune migration pour ce complément.
```

### 2.16 Écran Bracket personnel (remplissage) (session du 27/07/2026)

```text
Périmètre : SPEC_ECRAN_BRACKET_PERSONNEL_V0_1.md (Cadrage/V1/Spec visuelle/,
CLOSE) — écran de remplissage du bracket, laissé HORS PÉRIMÈTRE par
SPEC_ECRAN_CLASSEMENT_BRACKET_V0_1.md §18 (« lot ultérieur »). Septième écran
du hub joueur, DISTINCT de /bracket (vue globale de consultation partagée,
déjà codée, INCHANGÉE) : ici, saisie PERSONNELLE d'un joueur connecté.

Aucune spec n'existait pour cet écran (contrairement à Nouveau pari, qui
avait au moins un brouillon) — rédigée EN SÉANCE avec l'utilisateur, appuyée
sur des décisions déjà actées (nba_pronos_decisions_0_2_2_bracket_initial.md,
nba_pronos_decisions_0_2_9_ux_ui.md §5) et sur un enseignement retenu du
PROTOTYPE (Cadrage/OLD/ETAT_DEVELOPPEMENT_PROTOTYPE.md §7.2/§7.4) : un bug
réel y avait fait primer le résultat OFFICIEL sur le pronostic du joueur pour
dériver les équipes candidates des tours 2+, et validait un pick contre les
colonnes officielles (`series.team1_id/team2_id`, toujours NULL avant le vrai
résultat) au lieu des candidats dérivés — corrigé à l'époque, explicitement
consigné comme garde-fou à ne pas perdre pour cette réécriture V1.

Close en confirmant 4 points (AskUserQuestion) : Realtime `series` REPORTÉE
(aucun besoin live sur cet écran précis) ; libellés des états vides actés
tels quels ; contenu du popup de validation rédigé et validé ; structure de
fichiers séparée de lib/queries/bracket.ts (vue globale, pas d'écriture).

Pré-vol (avant tout code) : RLS `brackets_insert/update` et
`bracket_picks_insert/update` (migration #3) confirmées EXISTANTES et
SUFFISANTES (propriétaire + `is_active()` + `not bracket_deadline_passed()`)
— **aucune migration nécessaire pour ce lot**, contrairement à « Nouveau
pari ». `bracket_deadline_passed(competition_id)` confirmée réutilisable.
Route `/play/bracket` confirmée absente (seule `/bracket`, vue globale,
existait). Jeu de données de test : bracket d'Amine92 (11/15, volontairement
incomplet) confirmé intact, exploitable pour tester la cascade sans y
toucher.

Code : `lib/queries/bracket-fill.ts` — `computeCandidateTeamIds(series,
myWinnerBySeriesId, competitionType)`, fonction PURE qui dérive les 2 équipes
CANDIDATES de chaque série (officielles pour le tour racine — ROUND_1 en
Playoffs, CUP_QUARTERS en Cup — dérivées du PICK du joueur sur les séries
`next_series_id`/`next_series_slot` pour les tours suivants, JAMAIS du
résultat officiel) + `getBracketFillData()` (bootstrap complet : séries
groupées par tour/conférence, pick du joueur, statut validé/auto-validé).
`lib/actions/bracket-fill.ts` — `saveBracketPick`/`validateBracket` :
AUCUNE garde de propriétaire/deadline réécrite (déjà portée par la RLS) ;
seule garde applicative ajoutée = validité du vainqueur soumis contre les
candidats, recalculée avec EXACTEMENT la même fonction pure que la lecture
— jamais une 2e implémentation qui pourrait diverger (le bug retenu
ci-dessus). Route `app/(app)/play/bracket/` (`?round=` pour la navigation
par tour, Next.js 16 Promise) + `components/bracket-fill/{RoundTabs,
BracketFillBoard}` (BracketFillBoard = SEULE feuille `"use client"`, tap
vainqueur + boutons de score sauvegardent IMMÉDIATEMENT, pas de brouillon à
confirmer séparément — 0.2.9 §5). `ProgressBar` réutilisé tel quel depuis
components/bracket/ (vue globale) — composant déjà pur, sans changement.
Hub temporaire (`app/(app)/play/page.tsx`) mis à jour : les 4 entrées sont
désormais TOUTES actives (plus aucune entrée inerte) — code CSS mort
(`.entryInert`/`.soon`) retiré au passage.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` propres.
**Test de la cascade en isolation** (script jetable, `npx tsx`, AUCUNE base
de données) : 5/5 vérifications passées, dont la plus significative —
un résultat officiel simulé DIFFÉRENT du pick du joueur pour une série
ROUND_1, confirmant que la série CONF_SEMIS dérive bien du PICK, jamais du
résultat officiel. **Test en session authentifiée réelle** (navigateur,
compte Tariq_M — aucun bracket existant, jeu de données propre) : la
deadline du bracket, datant du seed, était déjà passée (même piège que les
matchs testés au lot précédent) — avancée temporairement, restaurée après.
Round 1 rendu correctement (8 séries, logos, 4 boutons de score) ; pick
d'un vainqueur + score sauvegardé et vérifié en base ; navigation vers
« Demi-finales de conférence » confirmant la cascade EXACTE (les 2 équipes
picked apparaissent comme candidates de la bonne série, « Équipe à définir »
pour les 3 autres) ; validation du bracket à 2/15 réussie (aucune garde de
complétude, conforme à §4) — confirmée en base (`is_validated=true`,
`validated_at` posé). Toutes les fixtures nettoyées après coup (picks,
bracket, deadline restaurée, mot de passe réinitialisé) — base vérifiée
identique à l'état seedé.
```

### 2.17 Déploiement Vercel + activation de l'inscription (session du 27/07/2026, suite)

```text
Périmètre : premier déploiement public du projet, hors périmètre de tout
lot d'écran — décidé par l'utilisateur pour montrer une démo à ses amis,
avant de reprendre le codage (« Mes paris »/admin, §2.19).

Commit/push : les lots « Nouveau pari » (§2.15) et « Bracket personnel »
(§2.16), codés/testés mais jamais poussés, groupés en UN commit (`d051097`,
tsc/eslint/build revérifiés propres avant push) — `Cadrage/nba-pronos.lnk`
(raccourci Windows accidentel, pas du contenu projet) exclu. Confirmation
explicite requise avant ce push : un premier « ok » était arrivé noyé dans
une notification système de tâche en arrière-plan (donc NON un message
utilisateur réel) — signalé comme suspect plutôt que traité comme une
autorisation, l'utilisateur a reconfirmé directement ensuite.

Vercel : CLI connectée (`vercel login`, OAuth par appareil). Nouveau projet
`lenoir-nba/nba-pronos` lié et connecté au dépôt GitHub existant
(`lenoirmath122-dev/nba-pronos`, remote déjà en place). Les 4 variables de
`.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SYNC_SECRET`) poussées sur Production/Preview/
Development via une commande qui les lit directement depuis le fichier —
jamais exposées en clair dans une commande visible. Déployé en production
(`vercel --prod`) → **https://nba-pronos.vercel.app**.

Bug trouvé au premier chargement réel (signalé par l'utilisateur) :
`app/page.tsx` était resté le scaffold `create-next-app` par défaut depuis
la création du projet (18/07/2026) — jamais retouché, jamais remarqué car
tous les tests précédents visitaient des routes précises, jamais la racine
nue. Corrigé (`redirect("/login")`, qui renvoie lui-même vers `/home` si une
session est active, logique déjà portée par `proxy.ts`) — commit `6ff2a68`,
re-déployé, vérifié (`curl` → 307 vers `/login`).

Activation de l'inscription réelle — épisode PAS totalement élucidé (voir
GAPS_OUVERTS.md) : dans le dashboard Supabase (Sign In / Providers →
Supabase Auth → Confirm email), un premier essai de désactivation n'a
apparemment pas pris effet à temps — le tout premier compte réel (celui de
l'utilisateur, `lenoir.math122@gmail.com`, pseudo **Rillettes-31**) a reçu un
email de confirmation avant de pouvoir se connecter (vérifié via les
métadonnées `auth.users` : `confirmation_sent_at` quasi simultané à
`created_at`, connexion seulement après le clic sur le lien). Capture
d'écran ensuite : le toggle était bien décoché et sauvegardé (bouton Save
grisé, rien à enregistrer) — mais un test contrôlé (compte jetable via l'anon
key, supprimé aussitôt après) a de nouveau buté sur
`over_email_send_rate_limit`, et une vraie tentative `/signup` de
l'utilisateur a échoué avec le message générique catch-all de `signup()`
(`lib/auth/actions.ts`). Hypothèse retenue mais NON confirmée : le quota du
mailer par défaut Supabase (partagé entre tous les types d'email, pas
seulement la confirmation) était encore épuisé par le tout premier envoi —
alternative non exclue : un envoi de courtoisie indépendant du caractère
« obligatoire » ou non de la confirmation. Resend évoqué comme solution
durable (SMTP personnalisé) mais écarté pour l'instant : nécessite un nom de
domaine vérifié que l'utilisateur ne possède pas, sans quoi Resend ne permet
d'envoyer qu'à l'adresse du compte Resend lui-même.

Contournement retenu pour la démo : compte créé directement via l'API Admin
(`email_confirm: true`, même mécanisme que les 7 comptes de seed, AUCUN envoi
d'email possible par construction) — **UN SEUL compte PARTAGÉ**, décision
explicite de l'utilisateur après qu'on lui a signalé le compromis (un seul
bracket/jeu de pronos pour tout le monde, pas de vraie compétition entre
amis tant que ce compte est partagé) : `Demo_Amis` /
`demo-amis@nba-pronos.test`, rôle PLAYER. Passage à un compte par ami prévu
explicitement APRÈS la fin de la V1.

1er admin réel : le compte de l'utilisateur (Rillettes-31) promu ADMIN par
`UPDATE public.users SET role='ADMIN'` direct via service_role — PAS par une
migration dédiée (contrairement à ce qu'anticipait le point ouvert du §6
ci-dessous), et PAS par un écran admin de promotion (aucun n'existe encore,
« écrans admin » reste un lot à coder, §2.19). Le compte cumule donc les
deux rôles (joueur Rillettes-31 + admin) pour l'instant.

Code de compétition communiqué (pour une inscription individuelle
ultérieure, hors du compte partagé) : `EBC67AAD` — compétition « Playoffs
NBA (test) », seule ACTIVE en base à ce jour.

Aucun changement de schéma, aucune migration dans ce lot (2 commits
applicatifs seulement : logique app/, pas de fichier `supabase/migrations/`).
```

### 2.18 Écran Profil (session du 27/07/2026, suite, CLOSE)

```text
Périmètre : SPEC_ECRAN_PROFIL_V0_1.md (Cadrage/V1/Spec visuelle/, CLOSE) —
4ème onglet de la nav, remplace le stub « à venir » (22/07/2026) ET le
bouton de déconnexion temporaire (§2.9). AUCUNE spec détaillée n'existait
avant cette session (même situation que Bracket personnel, §2.16) —
rédigée en séance, close après 3 points tranchés (AskUserQuestion) : pseudo
NON modifiable (identité publique déjà affichée ailleurs) ; avatar HORS
PÉRIMÈTRE (pas de Supabase Storage introduit) ; thème clair/sombre INCLUS
dans ce lot (câblage explicitement laissé en attente par app/tokens.css
depuis la consolidation des tokens, §2.3).

Pré-vol (avant tout code) : RLS `users_update_self` (migration #3)
confirmée SANS restriction de colonne (`id = auth.uid()`, aucune liste de
colonnes) — couvre favorite_team_id/bio/theme_preference sans y toucher ;
trigger `enforce_users_invariants` (T-a) confirmé NE PORTANT QUE sur
role/status, aucun risque de blocage sur les 3 colonnes de ce lot ;
`is_admin()` confirmée réutilisable pour le lien Admin conditionnel ; 30
lignes dans `teams` confirmées (référentiel global D6, stable).

Code : `lib/queries/profile.ts` (getProfileData/getTeamOptions) ;
`lib/actions/profile.ts` (updateThemePreference/updateProfile, FormData
brut + redirect("/profile"), même patron que
requestPredictionCorrectionFormAction) ; `app/(app)/profile/page.tsx` (+
page.module.css) ; `components/profile/TeamPicker.tsx` (+ .module.css).

Sélecteur d'équipe favorite : PAS un `<select>` natif (ne peut pas afficher
de logo, piège déjà rencontré §2.15) mais, contrairement aux sélecteurs de
BetForm.tsx (`role="radio"` sur des `<button>`, nécessitant du client-side
state), de VRAIS `<input type="radio">` natifs — ce picker n'a AUCUNE
dépendance entre champs à gérer en direct, donc zéro `"use client"` pour
tout l'écran (surlignage de la ligne sélectionnée en CSS pur, `:has()`).
Interprétation trouvée en codant, pas fixée par la spec (qui laissait le
point ouvert, §10).

Thème clair/sombre : lu et posé dans `app/layout.tsx` (racine, hors des
deux route groups (app)/(public) — s'applique à TOUT le site, visiteur
non connecté inclus). Pas de session → défaut DARK (aucune préférence à
lire). `<html data-theme="light">` posé seulement si LIGHT — sinon
l'attribut est omis (cohérent avec le CSS, dark par défaut sur :root).
Écriture suivie d'un `redirect("/profile")` (pattern déjà utilisé PARTOUT
dans ce projet, jamais dévié pour ce lot) : la redirection retraverse
`app/layout.tsx`, qui relit la préférence fraîche — bascule effective dès
la page suivante, sans JS supplémentaire, sans `router.refresh()`.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` propres.
Toutes les routes deviennent DYNAMIQUES (`ƒ`) après ce lot — y compris `/`,
`/login`, `/signup`, auparavant statiques (`○`) — conséquence ATTENDUE de
la lecture de session dans `app/layout.tsx` (cookies), pas une régression.

**Test en session authentifiée réelle** (serveur `next dev` déjà en cours
sur le port 3001, réutilisé — piège déjà rencontré §2.15, toujours vérifier
qui sert quoi avant de relancer quoi que ce soit) : login réel sans JS
(compte Demo_Amis, replay du POST avec les 4 champs `$ACTION_*` d'un
formulaire lié à `useActionState`, même technique que §2.11) ; toggle
thème réellement posé (POST du formulaire théorique sans JS, champ
`$ACTION_ID_...` unique comme pour `logout()`) et vérifié PROPAGÉ à
`/home` sans reconnexion ; visiteur déconnecté vérifié TOUJOURS en dark
(aucun attribut `data-theme`) ; sélection d'équipe favorite persistée en
base ET re-rendue avec le bon radio `checked` au rechargement ;
déconnexion réelle testée (cookie effacé, 303 → `/login`) ; tentative
d'escalade `role` par la même session confirmée BLOQUÉE par le trigger
existant (message inchangé). Aucune régression sur `/`, `/login`,
`/signup`, `/leaderboard`, `/bracket`. Toutes les valeurs de test
restaurées après coup (compte Demo_Amis identique à son état d'avant test).

Déployé en production (`vercel --prod`) juste après, vérifié en ligne
(`curl` → 307 sur `/` et `/profile`).
```

### 2.19 Écran Mes paris (session du 27/07/2026, suite, CLOSE)

```text
Périmètre : SPEC_ECRAN_MES_PARIS_V0_1.md (Cadrage/V1/Spec visuelle/, CLOSE)
— consultation PERSONNELLE de tous les paris du joueur (tous statuts) +
quotas, ferme le 8ème écran du hub joueur. Aucune spec détaillée
n'existait avant cette session (seulement identifié comme « hors
périmètre » dans le préambule de SPEC_ECRAN_NOUVEAU_PARI_V0_1.md). Deux
points fermés AVANT rédaction (AskUserQuestion) : révélation publique des
AUTRES joueurs (0.2.4 §9, jamais construite nulle part malgré la décision
actée — vérifié dans le code réel d'AssociatedBetCard, qui ne lit que
`user_id = auth.uid()`) — REPORTÉE, reste un point ouvert distinct
(GAPS_OUVERTS.md) ; demande de correction sur un pari — INCLUSE mais
restreinte au cas « pari VALIDATED dont la cible est déjà terminée et
jamais résolu » (contester un REFUS ou un résultat déjà posé nécessiterait
d'étendre `enforce_bet_transitions`, REJECTED/WON/LOST étant des états
TERMINAUX aujourd'hui — hors périmètre de ce lot).

Pré-vol : `bets_select` (migration #3) confirmée suffisante côté
propriétaire ; `enforce_bet_transitions` confirmé laissant déjà
VALIDATED→WON/LOST ouvert (aucune modification nécessaire pour la
correction) ; `correction_requests` confirmée déjà prête pour
`target_type='BET'` — et l'index unique partiel `uniq_pending_correction_
per_bet` (garde « une seule requête PENDING ») EXISTAIT DÉJÀ depuis la
toute première migration (#1), anticipé avant même que la fonctionnalité
ne soit spécifiée.

Code : `lib/queries/my-bets.ts` (`getMyBets`, réutilise `MATCH_SLOT_CAP`
de lib/labels/bets.ts pour l'affichage du quota, aucune 2e implémentation
du calcul) ; `lib/actions/bet-corrections.ts`
(`requestBetCorrectionFormAction`, même patron FormData + redirect que
`requestPredictionCorrectionFormAction`) ; `app/(app)/play/bets/page.tsx`
(l'INDEX du dossier existant, `new/` et `[id]/edit/` inchangés) ;
`components/my-bets/{SegmentTabs,QuotaBanner,MyBetRow}.tsx` — statuts/
couleurs REPRIS À L'IDENTIQUE d'`AssociatedBetCard` (Mes pronos), pas une
2e convention divergente pour le même statut. Migration #11
(`request_bet_correction`, SECURITY DEFINER, SANS « voie A » — un pari
existe TOUJOURS complet dès sa création, contrairement à un prono).

**Bug trouvé en testant, corrigé par migration #12** (même patron que la
migration #4 historique — patch via un NOUVEAU fichier, jamais une
réécriture de la migration déjà appliquée) : la migration #11 lisait
`series.status`, colonne qui N'EXISTE PAS — la vraie colonne est
`series.official_status` (`matches`, elle, porte bien `status`). Aurait
fait échouer TOUTE requête de correction sur un pari SÉRIE. Trouvé en
appelant la fonction en conditions réelles, pas en relisant le code.

Hub Jouer temporaire : l'entrée « Paris » pointait vers `/play/bets/new`
depuis le lot Nouveau pari — corrigée pour pointer vers `/play/bets` (ce
nouvel écran), qui porte lui-même le lien vers `/play/bets/new`, même
patron que les autres entrées du hub.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` propres.
**Test en session authentifiée réelle** (compte Demo_Amis, serveur `next
dev` déjà en cours réutilisé) : 7 paris de test créés via service_role
couvrant les 7 statuts (dont un VALIDATED ciblant un match déjà FINISHED
— cas « oublié »), tous rendus correctement dans le bon segment (En
cours/Terminés), bandeau de quota vérifié (« 1/1 série · 1/3 match ») ;
formulaire « Signaler à un admin » réellement soumis sans JS, ligne
`correction_requests` vérifiée en base, page rechargée affichant bien
« Requête en attente » ; 3 cas négatifs testés en session réelle (2e
requête sur le même pari, tentative sur un DRAFT, tentative sur un
SUBMITTED — tous bloqués avec le bon message). Toutes les données de test
supprimées après coup (7 paris + 1 requête de correction), compte
Demo_Amis vérifié identique à son état d'avant test. Aucune régression
sur les 10 autres routes de l'app. Déployé en production (`vercel
--prod`), vérifié en ligne.
```

### 2.20 Prochaine étape

```text
Restent à confirmer avec l'utilisateur : les écrans admin (aucune spec
n'existe). « Mes paris » (§2.19) et Profil (§2.18) sont désormais CODÉS,
retirés de cette liste — Bracket personnel (§2.16) l'était déjà. Deux
points ouverts distincts identifiés en codant « Mes paris », toujours non
traités : révélation publique des paris des autres joueurs (0.2.4 §9) ;
contester un pari REJETÉ ou déjà résolu GAGNÉ/PERDU (nécessiterait
d'étendre enforce_bet_transitions) — voir GAPS_OUVERTS.md pour le détail.
Publication Realtime de `series` (T4 §9) : reste REPORTÉE (§2.16) faute
de besoin live identifié sur un écran codé à ce jour. Même conventions
reconduites (composants serveur par défaut, CSS Modules + tokens, RLS/
fonctions dédiées comme seule autorité de lecture ; vérifier D'ABORD si
la RLS existante suffit avant d'ajouter une fonction SECURITY DEFINER).
Le vrai hub Jouer (§2.10) reste à SPÉCIFIER (spec d'écran dédiée) avant
d'être codé — aucune date arrêtée. Puis T8 (déploiement — §6 à faire
avant, dont l'effacement du jeu de données de test ET du compte de démo
partagé §2.17, ET le retrait du hub Jouer temporaire §2.10).
```

## 3. État actuel de la base de données

```text
12 migrations appliquées (supabase/migrations/, via `npx supabase db push`,
chacune montrée intégralement et confirmée par l'utilisateur avant
application) — les 6 premières inchangées depuis le 23/07/2026 (les lots
logos/déconnexion/hub temporaire du 24/07, §2.9/§2.10, étaient purement
applicatifs) ; #7 et #8 ajoutées par le lot « Mes pronos » (§2.11) ; #9 et
#10 ajoutées par le lot « Nouveau pari » (§2.15, poussées par l'utilisateur
lui-même — `db push` bloqué pour Claude par le classificateur de permissions
de l'environnement) ; #11 et #12 ajoutées par le lot « Mes paris » (§2.19,
`db push` NON bloqué cette fois, poussées directement) :

1. 20260718090000_initial_schema.sql — schéma complet.
2. 20260718100000_auth_join_code_and_profile.sql — code compétition,
   verify_join_code(), trigger handle_new_user.
3. 20260718110000_rls.sql — competition_secrets, fonctions SECURITY DEFINER,
   RLS activée + policies, triggers d'invariants.
4. 20260718120000_fix_users_trigger_system_context.sql — correctif contexte
   système (auth.uid() NULL laissé passer).
5. 20260723130000_leaderboard_universal_visibility.sql — user_scores/
   user_recent_form en security_invoker=false + admin_corrections_count
   intégré à user_scores (§2.7).
6. 20260724090000_match_predictions_committed_count.sql —
   count_committed_predictions(p_match), SECURITY DEFINER, un entier
   uniquement (§2.8).
7. 20260724100000_request_prediction_correction.sql —
   request_prediction_correction(p_match, p_justification, p_proposed_*),
   SECURITY DEFINER, voie A (§2.11/§10.2 de la spec) : crée une ligne
   match_predictions VIDE si aucune n'existe puis la correction_requests
   liée, dans une seule transaction. Garde-fous complets §10.3. N'écrit
   JAMAIS de contenu de pronostic.
8. 20260724110000_realtime_matches.sql — publication supabase_realtime
   étendue à `matches` UNIQUEMENT (§2.11) ; `series` toujours PAS activée —
   le lot Bracket personnel (§2.16) n'en avait finalement pas besoin
   (aucun contenu live sur cet écran précis), reportée encore une fois.
9. 20260726120000_bet_withdraw_transition.sql — ajoute `SUBMITTED → DRAFT`
   au trigger `enforce_bet_transitions` (le geste « retirer » d'un pari
   soumis, §2.15 / SPEC_ECRAN_NOUVEAU_PARI_V0_1 §9).
10. 20260726130000_bet_write_functions.sql — `save_bet(p_bet_id, p_scope,
   p_series_id, p_match_id, p_description, p_category, p_difficulty,
   p_submit)` et `withdraw_bet(p_bet_id)`, SECURITY DEFINER (§2.15) :
   reproduisent ELLES-MÊMES toutes les gardes §11 (propriétaire, statut,
   deadline, cible identifiée, quota, scope interdit en NBA Cup) — RLS
   contournée par le rôle propriétaire, comme #7. `pg_advisory_xact_lock`
   (clé user × série) avant le comptage du cap 3 MATCH/série, qui n'a aucun
   backstop d'index unique — ferme une fenêtre de course entre deux
   créations concurrentes.
11. 20260727100000_request_bet_correction.sql — `request_bet_correction(
   p_bet, p_justification)`, SECURITY DEFINER (§2.19) : SANS voie A
   (contrairement à #7, un pari existe toujours complet dès sa création) —
   crée une correction_requests (target_type='BET') sur une ligne bets DÉJÀ
   existante, restreint aux paris VALIDATED dont la cible est FINISHED.
12. 20260727110000_fix_request_bet_correction_series_column.sql — correctif
   trouvé en testant #11 en conditions réelles : lisait `series.status`
   (colonne inexistante) au lieu de `series.official_status`. Même patron
   que la migration #4 (patch via un nouveau fichier, #11 jamais réécrite).

**Toujours 10 migrations après le lot Bracket personnel (§2.16)** : la RLS
`brackets_insert/update`/`bracket_picks_insert/update` (migration #3)
couvrait déjà tout le nécessaire pour ce lot — aucune migration ajoutée,
contrairement aux deux lots précédents.

RLS vérifiée de bout en bout via le plan de test T3 §7, puis re-testée avec
un vrai jeu de données (§2.6) — un piège trouvé à cette occasion (§7).
Consommée directement (sans service_role) par tous les écrans joueur via
getServerClient(). Les fonctions #7, #10 et #11/#12 sont les seules à
opérer en SECURITY DEFINER (contournent une policy/la RLS) — chacune
justifiée en commentaire dans son fichier de migration et testée en
conditions réelles (§2.11/§2.15/§2.19). #9 modifie seulement la whitelist
du trigger existant
(`enforce_bet_transitions`, PAS security definer, inchangé sur ce point).

Données : compétition Playoffs de TEST active (§2.6) — 30 équipes, 15
séries, 9 matchs, 7 comptes. JETABLE, pas une vraie compétition — à
distinguer et à effacer avant tout lancement réel (§6). Étendue le
24/07/2026 (§2.11) : 3 des 9 matchs sont désormais VERROUILLÉS
(scheduled_at passé) — CLE-ORL#1 (FINISHED, prono Yanis44 corrigé),
DEN-SAC#1 (IN_PROGRESS, prono Marco_D désactivé), MIN-GSW#1 (SCHEDULED
malgré une date passée, latence délibérée + prono partiel Nina_R) —
nécessaire pour que l'écran Mes pronos, ancré sur les matchs verrouillés,
soit vérifiable. Porte aussi, depuis le test en conditions réelles du
24/07/2026 : 1 requête de correction PENDING (Amine92 sur DEN-SAC#1) + sa
ligne match_predictions vide associée — artefact de test légitime, non
nettoyé.

Tests du 26-27/07/2026 (§2.15, écran Nouveau pari) : mots de passe
temporaires posés sur Tariq_M puis Nina_R (API Admin, jamais affichés dans
le chat, re-randomisés en fin de session) ; dates `scheduled_at` de
NYK-ATL#1/BOS-MIA#1/MIL-CHI#1 temporairement avancées pour les tests puis
RESTAURÉES à leur valeur seedée d'origine ; matchs jetables (games 2/3/4 de
la série NYK-ATL) et paris créés pendant les tests, tous supprimés après
coup. Base vérifiée par requête directe : identique à l'état seedé, aucun
résidu de ces deux sessions de test.

Test du 27/07/2026 (§2.16, écran Bracket personnel) : `competitions.
bracket_deadline` (datant du seed, déjà passée) temporairement avancée puis
RESTAURÉE à sa valeur d'origine ; mot de passe temporaire posé sur Tariq_M
(aucun bracket existant avant le test, re-randomisé après) ; bracket +
2 bracket_picks créés pendant le test (BOS-MIA, NYK-ATL), tous supprimés
après coup. Le bracket d'Amine92 (11/15, volontairement incomplet, §2.6)
n'a jamais été touché. Base vérifiée par requête directe : identique à
l'état seedé.

`teams.logo_url` : colonne existante, TOUJOURS VIDE (jamais remplie par le
seed) — les logos affichés (§2.9) ne dépendent pas de cette colonne, le
chemin est déduit de `teams.abbreviation` côté rendu.
```

## 4. Fichiers du projet — carte rapide

```text
app/
  layout.tsx, favicon.ico, page.tsx — scaffold create-next-app, non modifiés.
  tokens.css, globals.css — inchangés depuis §2.3.
  (public)/ — inchangé depuis §2.1 (login/signup pas encore stylés T7).
  (app)/
    layout.tsx + layout.module.css — garde session + nav 4 onglets + monte
      UnsavedGuardProvider (§2.8) + bouton de déconnexion TEMPORAIRE (§2.9,
      à retirer, voir GAPS_OUVERTS.md).
    home/page.tsx + page.module.css — écran Accueil. CODÉ.
    play/
      page.tsx + page.module.css — hub Jouer TEMPORAIRE (§2.10, à retirer,
        voir GAPS_OUVERTS.md) : liste 4 entrées, TOUTES actives depuis
        §2.16 (Matchs, Mes pronos, Paris → /play/bets/new, Mon bracket →
        /play/bracket) — plus aucune entrée inerte, code CSS mort retiré.
        PAS l'écran hub définitif (spec dédiée à écrire).
      matches/
        page.tsx + page.module.css — écran Matchs. CODÉ (§2.8).
      my-predictions/
        page.tsx + page.module.css — écran Mes pronos. CODÉ (§2.11).
      bets/
        new/page.tsx + page.module.css — écran Nouveau pari, création
          (contexte libre ou ?matchId=). CODÉ (§2.15).
        [id]/edit/page.tsx + page.module.css — écran Nouveau pari, édition
          d'un DRAFT/SUBMITTED du joueur. CODÉ (§2.15). Si le pari n'existe
          pas / n'appartient pas au joueur / n'est plus éditable ici : état
          inerte (pas de redirection vers « Mes paris », qui n'existe pas
          encore).
      bracket/
        page.tsx + page.module.css — écran Bracket personnel (remplissage).
          CODÉ (§2.16). `?round=` sélectionne le tour affiché. Deadline
          passée → bandeau lecture seule + lien vers /bracket (vue globale),
          pas de formulaire figé affiché pour rien.
    profile/page.tsx  — stub « à venir », PAS stylé. Portera la vraie
      déconnexion un jour (§2.9).
  leaderboard/page.tsx  — Classement. CODÉ (§2.5), lib mise à jour §2.7.
  bracket/page.tsx      — Bracket. CODÉ (§2.5), logos §2.9.
  (admin)/               — PAS ENCORE CRÉÉ.

proxy.ts               — garde d'authentification (T6a §4.1). CODÉ.

lib/
  supabase/{browser,server,service}.ts — les 3 clients. CODÉ.
  auth/actions.ts                      — login/signup/logout. CODÉ ; logout
    câblée pour la 1re fois §2.9 (bouton temporaire).
  actions/
    matches.ts — saveMatchPredictionDraft/validateMatchPrediction/
      validateAllCompleteMatchPredictions + type ActionResult (local à ce
      fichier — pas encore partagé). CODÉ §2.8.
    corrections.ts — requestPredictionCorrection() (appel .rpc() vers la
      migration #7) + requestPredictionCorrectionFormAction() (wrapper
      FormData → redirection, pour le <form> natif sans JS). CODÉ §2.11.
    bets.ts — saveDraftBet/submitBet/withdrawBet, relais fins vers
      .rpc('save_bet'|'withdraw_bet') (migration #10) — aucune écriture
      directe sur `bets`. CODÉ §2.15.
    bracket-fill.ts — saveBracketPick/validateBracket, écriture DIRECTE sur
      brackets/bracket_picks (RLS migration #3 suffit, aucun .rpc()) — seule
      garde applicative ajoutée : validité du vainqueur contre les candidats
      de la cascade, recalculée avec computeCandidateTeamIds
      (lib/queries/bracket-fill.ts), jamais une 2e implémentation. CODÉ §2.16.
  hooks/
    useUnsavedGuard.tsx (+ .module.css) — Garde C2 TRANSVERSE :
      UnsavedGuardProvider, useUnsavedGuard(key), useGuardedNavigation().
      CODÉ §2.8. Non étendu par Mes pronos NI par Nouveau pari (aucune garde
      de saisie sale demandée sur ces deux écrans).
  labels/
    rounds.ts — ROUND_LABELS, PARTAGÉ Bracket + Mes pronos (§16.5). NOUVEAU
      §2.11, extrait de lib/queries/bracket.ts qui le portait en dur.
    bets.ts — BET_CATEGORY_OPTIONS/BET_DIFFICULTY_LABELS/DEFAULT_BET_*/
      MATCH_SLOT_CAP + types BetCategory/BetDifficulty. NOUVEAU §2.15,
      SANS dépendance serveur (contrairement à lib/queries/bets.ts) — seul
      moyen pour components/bets/BetForm.tsx ("use client") d'importer ces
      constantes sans faire fuiter next/headers dans le bundle client.
  queries/
    home.ts        — getHomeData(). CODÉ.
    leaderboard.ts — getLeaderboard(). CODÉ §2.5, MODIFIÉ §2.7 (lit
      admin_corrections_count depuis user_scores, 2 requêtes en moins).
    bracket.ts     — getBracket(). CODÉ, MODIFIÉ §2.11 (importe ROUND_LABELS
      depuis lib/labels/rounds.ts au lieu de le porter en dur). Vue GLOBALE
      de consultation uniquement, pas d'écriture — DISTINCT de
      bracket-fill.ts (§2.16), volontairement pas fusionnés (contrats de
      types différents : groupes/pourcentages ici, pick personnel là-bas).
    matches.ts     — getMatches() + types figés MatchCard/MatchDay/
      MatchesData/TeamRef/OtherPrediction/BetSlotIndicator/
      PredictionViewStatus (spec §13, recopiés à l'identique). CODÉ §2.8.
      MODIFIÉ §2.15 : nouveau type MyMatchBet (contenu du pari MATCH actif
      du joueur sur ce match, DRAFT/SUBMITTED uniquement) + champ MatchCard.
      myBet — alimente la saisie inline InlineBetForm ; requête `bets` du
      fichier élargie (portait avant seulement scope/statut).
    my-predictions.ts — getMyPredictions() + types figés MyPredictionsMode/
      MatchLiveState/MyPredictionState/AdminCorrection/MyPrediction/
      RevealedPrediction/CorrectionRequestState/AssociatedBet/
      MyPredictionRow/SeriesBetHeader/MyPredictionsData (spec §13, recopiés
      à l'identique ; TeamRef réimporté depuis matches.ts, jamais redéfini).
      Dérivation d'état PAR COMPLÉTUDE uniquement (§10.4), y compris pour le
      4e cas DRAFT-complet tranché avec l'utilisateur (§2.11). CODÉ §2.11.
    bets.ts — getNewBetFormData(matchIdParam)/getEditBetFormData(betId) +
      types figés BetFormBootstrap/SeriesOption/MatchOption/NewBetContext/
      EditableBet/NewBetFormData/EditBetFormData (spec §10). Dispos
      (seriesBetOpen/matchBetOpen/matchSlotsUsed/*SlotTaken) recalculées
      serveur en reproduisant bet_deadline_open — jamais lues du client.
      CODÉ §2.15.
    bracket-fill.ts — getBracketFillData() + computeCandidateTeamIds
      (fonction PURE, exportée et réutilisée à l'identique par
      lib/actions/bracket-fill.ts — jamais une 2e implémentation de la
      cascade) + types figés BracketFillCandidate/BracketFillSeries/
      BracketFillRound/BracketFillData (spec §7). CODÉ §2.16.
  scoring/, sync/ — PAS ENCORE CRÉÉS.

components/
  auth/{LoginForm,SignupForm}.tsx — pas encore stylés selon T7.
  icons/nav-icons.tsx — 4 icônes de nav.
  ui/
    Countdown.tsx (+ .module.css) — partagé Accueil + Bracket.
    TeamLogo.tsx (+ .module.css) — NOUVEAU (§2.9). Logo déduit de
      l'abréviation, repli texte via onError. Partagé Bracket + Matchs +
      Mes pronos. Directive "use client" PROPRE ajoutée §2.11 (jusque-là
      transitivement bundlé client via ses 2 seuls appelants, tous deux
      atteints depuis un ancêtre client — devenu insuffisant sur Mes pronos,
      qui l'utilise depuis un composant serveur sans ancêtre client). Pastille
      neutre constante (`--color-logo-pastille`) implémentée §2.12 — absente
      depuis la création du composant, remontée par l'utilisateur en testant
      Mes pronos.
  nav/
    TabBar.tsx + .module.css — onNavigate (useGuardedNavigation) sur les 4
      onglets, inerte par défaut. CODÉ §2.8. Non modifié par le hub Jouer
      temporaire (§2.10) — le lien « Jouer » continue de pointer sur /play.
    PublicNav.tsx / ScreenShell.tsx (+ .module.css chacun) — inchangés.
  home/ — inchangé depuis §2.4 (EmptyState réutilisé par Classement,
    Bracket ET Matchs). Pas de logo ici (§2.9, GAPS_OUVERTS.md).
  leaderboard/ — inchangé depuis §2.5. Pas de logo ici (aucune équipe affichée).
  bracket/ — NodeCard.tsx affiche désormais TeamLogo (§2.9). Vue GLOBALE
    uniquement (lecture, consultation partagée) — ProgressBar.tsx RÉUTILISÉ
    tel quel par l'écran Bracket personnel (§2.16, aucun changement, déjà
    pur/générique filledCount/totalCount).
  bracket-fill/ — NOUVEAU §2.16, 2 fichiers + leurs .module.css :
    RoundTabs.tsx              — serveur, liens ?round= (même patron que
      SegmentTabs de Mes pronos, pas de client nécessaire pour changer d'onglet).
    BracketFillBoard.tsx       — SEULE feuille "use client" de l'écran :
      tap vainqueur + boutons de score (SeriesPickCard, sous-composant
      interne) sauvegardent IMMÉDIATEMENT (saveBracketPick), pas de
      brouillon local à confirmer séparément (0.2.9 §5). Porte aussi le
      bouton + dialogue de confirmation « Valider mon bracket »
      (validateBracket) — même patron de dialogue que PredictionForm
      (écran Matchs), backdrop + alertdialog.
  matches/ — 8 fichiers + leurs .module.css (BetShortcut REMPLACÉ par
    InlineBetForm §2.15, décompte inchangé) :
    MatchDayGroup.tsx        — serveur, regroupement par jour.
    MatchRow.tsx              — "use client" (1/3) : ouverture de la ligne,
      repère de verrouillage + décompte animé. Entête replié refondu §2.13
      (variante « split neutre » : grosses abréviations + séparateur, plus
      de logos ici — TeamLogo retiré de ce fichier, recentré sur la carte
      dépliée uniquement).
    PredictionForm.tsx        — "use client" (2/3) : saisie, drapeau C2,
      2 CTA, dialogue de validation (distinct du dialogue C2). MODIFIÉ §2.15 :
      rend désormais InlineBetForm (matchId/seriesId/betSlot/myBet) au lieu
      de BetShortcut.
    TeamPicker.tsx             — sans "use client", tap direct sur l'équipe,
      logo agrandi à 48px §2.13 (abréviation retirée de cette carte, ne reste
      que logo + nom complet — l'abréviation vit désormais dans l'entête
      replié de MatchRow).
    MarginStepper.tsx          — sans "use client" (porte son propre
      useState local — permis, transitivement bundlé client).
    RevealPanel.tsx            — sans "use client" : compteur X/N toujours
      affiché, contenu seulement si isRevealed.
    InlineBetForm.tsx (+ .module.css) — NOUVEAU §2.15, REMPLACE
      BetShortcut.tsx (supprimé) : sans "use client" propre (rendu par
      PredictionForm, qui porte déjà la frontière cliente de l'écran) —
      formulaire complet de saisie/édition d'un pari MATCH ciblé
      automatiquement sur CE match (pas de sélecteur série/match), appelle
      saveDraftBet/submitBet/withdrawBet (lib/actions/bets.ts). Pré-rempli
      si MatchCard.myBet n'est pas null ; simple texte désactivé si un pari
      existe mais n'est plus éditable ici.
    ValidateAllBanner.tsx      — "use client" (3/3) : bandeau + confirmation
      « Tout valider », état local (pas remonté à la page serveur).
  bets/ — NOUVEAU §2.15, 2 fichiers :
    BetForm.tsx (+ .module.css) — SEULE feuille "use client" de l'écran
      Nouveau pari (§1.1 de la spec). Gère les 3 contextes (création libre,
      création via raccourci ?matchId=, édition à cible figée) et les 3
      gestes (saveDraftBet/submitBet/withdrawBet). Sélecteurs série/match en
      listes de boutons internes (SeriesPicker/MatchPicker, mêmes fichier,
      logos via TeamLogo) — pas de <select> natif pour eux (ne peut pas
      afficher d'image). Zone de saisie (énoncé/catégorie/difficulté/
      actions) en `position: fixed` (bandeau sticky, §2.15 suite 27/07),
      offset vérifié contre la hauteur RÉELLE de TabBar (mesurée, pas
      supposée).
  my-predictions/ — NOUVEAU §2.11, 9 fichiers + leurs .module.css :
    urls.ts                   — utilitaire pur (aucun JSX), construction des
      URL de vue (segment/filtre/pagination), partagé par plusieurs
      composants serveur.
    SegmentTabs.tsx            — serveur, liens Récent/Historique.
    FilterBar.tsx              — serveur, formulaire GET natif (date/série)
      + puce de filtre actif.
    SeriesBetHeader.tsx        — serveur, en-tête de pari SERIES (§11.2,
      uniquement en mode filtré sur une série).
    MatchRowStatic.tsx         — serveur, ligne de match (logos, prono,
      pari, requête de correction, panneau des autres).
    PredictionSummary.tsx      — serveur, rendu de MON prono (3 états +
      marquage de correction nominatif "à ta demande").
    RevealPanel.tsx            — serveur, <details> natif, TOUJOURS rendu
      avec son contenu (aucune confidentialité pré-verrouillage ici, §12) —
      marquage de correction nominatif complet ("à la demande de <pseudo>").
    AssociatedBetCard.tsx      — serveur, rappel de pari en lecture seule,
      tous statuts affichés (§11.3).
    CorrectionRequestForm.tsx  — serveur, <form action={...}> natif, seule
      écriture de l'écran ; erreur rendue au rechargement (portée par l'URL).
    LiveSubscriber.tsx         — "use client" (1/1, SEUL fichier client de
      l'écran) : exporte le Provider (souscription Realtime unique sur
      `matches`, Context React) ET un consommateur (LiveBadgeAndScore, lu
      depuis les lignes serveur).

public/
  logos/teams/ — 30 SVG (+ 30 PNG), déposés et committés depuis le
    21/07/2026, câblés depuis le 24/07/2026 (§2.9). `viewBox` des 30 SVG
    recalculé §2.13 (chaque fichier réservait un canevas plus grand que son
    dessin réel, logos décentrés dans leur pastille — corrigé par un script
    de bounding box, confirmé visuellement par l'utilisateur). brand/ :
    convention posée, hero-parquet.webp toujours pas déposé.

scripts/
  seed-playoffs-test-data.mjs — Script de seed, HORS migrations, usage :
    `node --env-file=.env.local scripts/seed-playoffs-test-data.mjs`. Non
    idempotent, pas de script de nettoyage écrit à ce jour.

Cadrage/
  V1/     — specs techniques V1 validées (T1→T7) + Spec visuelle/
            SPEC_ECRAN_ACCUEIL, SPEC_ECRAN_CLASSEMENT_BRACKET (close ; vue
            globale, §2.5 — distincte du remplissage §2.16),
            SPEC_ECRAN_MATCHS (close, §2.8 ; amendée §20 le 25/07/2026,
            §2.14 — entête replié sans logo), SPEC_ECRAN_MES_PRONOS (close,
            §2.11), SPEC_ECRAN_NOUVEAU_PARI (close §2.15, 26/07/2026 —
            livrée BROUILLON, close en séance en clarifiant ses 3 points
            §16 avant tout code), SPEC_ECRAN_BRACKET_PERSONNEL (close §2.16,
            27/07/2026 — AUCUNE spec n'existait, rédigée ET close en séance
            avec l'utilisateur, appuyée sur 0.2.2/0.2.9 §5 + le prototype).
            SPEC_TECHNIQUE_RLS_V0.1.md complétée §11 (correctif §2.7).
            SPEC_DESIGN_SYSTEM_V0_1.md amendée §16 le 25/07/2026 (§2.14 —
            tailles/provenance des logos). Aucune spec pour le hub Jouer
            définitif (§2.10) ni pour « Mes paris » (consultation/quotas) à
            ce jour — à écrire avant de les coder.
  Proto/  — fichiers de suivi (ce fichier, JOURNAL_SESSIONS.md,
            GAPS_OUVERTS.md) + cadrage fonctionnel hérité du prototype.
  OLD/    — cadrage antérieur, non consulté activement.

supabase/
  migrations/  — 10 migrations versionnées, voir §3.
  config.toml  — supabase link vers le projet Supabase NEUF de la V1.
```

## 5. Conventions de travail — l'essentiel (détail complet dans JOURNAL_SESSIONS.md)

```text
- Utilisateur DÉBUTANT (découvre Supabase/Next.js/VS Code/Git au fil du
  prototype) : chaque action expliquée (quoi/pourquoi/comment), une à la
  fois, confirmation avant de continuer. Commandes Git une par une — sauf
  accord explicite ponctuel pour que Claude committe lui-même (posé le
  23/07/2026, reconduit depuis, toujours rappelé comme un écart à la norme).
- Toute migration SQL passe par supabase/migrations/ (fichier versionné,
  nommage `<timestamp>_nom.sql`) + `npx supabase db push`, jamais par un
  copier-coller manuel dans l'éditeur SQL Supabase. Toujours montrer le
  contenu intégral de la migration et attendre une confirmation EXPLICITE
  avant `db push` — y compris pour une fonction SECURITY DEFINER minuscule,
  pas seulement pour un chantier RLS complet.
- Toute validation serveur doit recalculer ses propres garde-fous depuis la
  base, jamais supposer que l'affichage client correspond aux données
  officielles.
- Fichiers de suivi (dont celui-ci) : toujours régénérés en entier au moment
  où on les met à jour, jamais résumés/coupés silencieusement — y compris
  pour un lot « petit » (§2.9, §2.10) : la mise à jour de GAPS_OUVERTS.md
  seul, sans toucher à celui-ci ni au journal, a été un oubli réel lors du
  lot §2.9, corrigé seulement quand l'utilisateur a demandé de vérifier.
- Une note de suivi (« pas encore déposé », etc.) est un ÉTAT PASSÉ, pas une
  preuve présente : avant d'affirmer qu'un fichier n'existe pas, VÉRIFIER LE
  DISQUE (`ls`/`find`), pas seulement relire `ETAT_ACTUEL.md`. Erreur commise
  et corrigée le 24/07/2026 (§2.9, logos de franchise) — la doc peut devenir
  obsolète plus vite qu'on ne le pense.
- Claude ne committe jamais automatiquement (sauf accord explicite ponctuel)
  — l'utilisateur committe lui-même, une commande à la fois, rappelée en fin
  de session.
- Clés/secrets API : jamais collés en clair dans le chat. Un mot de passe de
  test posé sur un compte JETABLE (seed-*@nba-pronos.test) n'est pas un
  secret de production — nuance à garder.
- Avant d'écrire du code Next.js, vérifier node_modules/next/dist/docs/ pour
  les ruptures de convention propres à cette version.
- Aucun asset binaire n'est ajouté par Claude au dépôt.
- Écrans de lecture ET d'écriture : AUCUNE valeur visuelle en dur — tokens
  de app/tokens.css uniquement, via CSS Modules colocalisés. Composants
  serveur par défaut ; un "use client" doit être justifié explicitement — un
  fetch de données n'est jamais une justification.
- Noms de colonnes/valeurs de statut absents d'une spec produit : LIRE le
  schéma réel avant d'écrire la moindre requête, jamais deviner.
- En cas d'ambiguïté réelle (spec contradictoire, RLS qui ne couvre pas un
  cas d'usage qu'un TEST révèle, périmètre qui déborde d'un écran vers un
  fichier partagé) : s'ARRÊTER et demander plutôt que choisir en silence —
  même en plein codage.
- Un jeu de données de TEST révèle des défauts qu'une lecture de spec seule
  ne révèle pas : tester avec de vraies données, pas seulement
  `tsc`/`eslint`/`next build`, fait partie du travail.
- Un changement volontairement TEMPORAIRE (§2.9 bouton de déconnexion, §2.10
  hub Jouer) doit être marqué comme tel dans le CODE (commentaire), dans le
  RENDU (libellé visible « temporaire », style volontairement pas fini) ET
  dans le SUIVI (`GAPS_OUVERTS.md`) — les trois, pas seulement un des trois.
```

## 6. Config à faire au déploiement — PARTIELLEMENT FAITE (§2.17, 27/07/2026)

```text
- Vercel : FAIT (§2.17, 27/07/2026). Projet `lenoir-nba/nba-pronos` lié au
  dépôt GitHub, 4 variables d'env poussées (Production/Preview/Development),
  déployé en production → https://nba-pronos.vercel.app.
  **Correctif de région (27/07/2026, suite)** : latence perceptible après
  chaque clic remontée par l'utilisateur — diagnostiquée comme les fonctions
  Vercel tournant en `iad1` (Washington D.C., région par défaut de tout
  nouveau projet Vercel), alors que la base Supabase est en `eu-west-1`
  (Dublin) et l'utilisateur en France. `vercel.json` ajouté
  (`regions: ["dub1"]`, Dublin — même région que Supabase, recommandation
  officielle Vercel : « les fonctions doivent s'exécuter dans la même
  région que la base de données »), pas Paris malgré la localisation de
  l'utilisateur — une page fait souvent plusieurs allers-retours vers la
  base PAR requête (fonction↔base), contre un seul aller-retour
  navigateur↔fonction.
- Dashboard Supabase : désactiver « Confirm email » (accès immédiat au
  compte après inscription, C4 — rappel laissé dans la migration #2).
  DEVENU CONCRET le 24/07/2026 (§2.11) : le vrai flux /signup, testé pour la
  première fois de bout en bout, échoue avec « 429 — email rate limit
  exceeded » tant que ce réglage n'est pas désactivé (chaque inscription
  réelle tente d'envoyer un email de confirmation). Les comptes de seed y
  échappent (créés via l'API Admin, email_confirm:true, aucun email envoyé)
  — ce n'est donc apparu qu'en testant la vraie inscription publique.
  TENTÉ le 27/07/2026 (§2.17) : réglage décoché et sauvegardé (confirmé par
  capture d'écran), mais comportement PAS totalement élucidé — un test
  contrôlé et une vraie tentative ont quand même buté sur le même mur
  après coup. Toujours listé ici tant que non confirmé fiable — voir
  GAPS_OUVERTS.md pour le détail et la piste retenue (SMTP personnalisé,
  ex. Resend, nécessite un nom de domaine vérifié — non disponible à ce
  jour).
- Écrire la migration de seed du 1er admin RÉEL (A4), une fois le 1er
  pseudo réel connu — DISTINCT du compte Sofia_Admin du jeu de test (§2.6),
  qui n'est qu'un admin de test jetable. FAIT DE FAÇON AD HOC le 27/07/2026
  (§2.17) : compte Rillettes-31 promu ADMIN par UPDATE SQL direct, PAS par
  une migration ni un écran dédié (aucun n'existe encore) — cumule les deux
  rôles (joueur + admin) en attendant un vrai mécanisme.
- NOUVEAU (27/07/2026, §2.17) : compte de démo PARTAGÉ créé pour la
  démonstration aux amis de l'utilisateur (`Demo_Amis` /
  `demo-amis@nba-pronos.test`, rôle PLAYER, via API Admin) — à supprimer ou
  reconvertir quand le passage à un compte par ami sera fait (prévu
  explicitement après la fin de la V1), et à ne pas oublier lors du
  nettoyage du jeu de données de test (ne correspond PAS au motif
  `seed-*@nba-pronos.test` des 7 comptes de test originels, donc pas couvert
  par le même script de nettoyage sans ajustement).
- EFFACER le jeu de données de test (§2.6) avant tout lancement réel :
  compétition « Playoffs NBA (test) » + ses séries/matchs/pronos/paris (DELETE
  SQL, en respectant l'ordre des FK composites — séries du 1er tour avant les
  tours suivants), et les 7 comptes seed-*@nba-pronos.test via
  auth.admin.deleteUser (jamais un DELETE direct sur auth.users). Aucun
  script de nettoyage écrit à ce jour.
- Bouton de déconnexion temporaire : RETIRÉ (§2.18, 27/07/2026) — l'écran
  Profil porte désormais la vraie déconnexion.
- RETIRER le hub Jouer temporaire (§2.10, app/(app)/play/page.tsx +
  page.module.css) dès que le vrai hub Jouer (spec d'écran dédiée à écrire)
  existe.
- Activer la publication Realtime côté base sur `series` (T4 §9, resserré
  par T6c §14.2) — `matches` est FAIT (migration #8, §2.11) ; `series`
  reporté au lot Bracket personnel (drill-down/résumé live), chaque table
  publiée quand un écran en a réellement besoin.
- Configurer le planificateur externe gratuit (cron-job.org / GitHub
  Actions) pour appeler /api/sync/teams, /api/sync/schedule,
  /api/sync/results et /api/heartbeat aux fréquences actées par T4/T8.
- Déposer l'image réelle de public/brand/hero-parquet.webp (les logos
  d'équipe, eux, sont déjà déposés — §2.3/§2.9).
```

## 7. Pièges techniques déjà rencontrés (V1)

```text
- Un trigger BEFORE UPDATE en SECURITY DEFINER qui vérifie is_admin() via
  auth.uid() est bloquant en contexte SYSTÈME (auth.uid() NULL) — la garde
  doit explicitement laisser passer ce cas. Trouvé au test RLS T3 §7
  (migration #4).

- Next.js 16 renomme middleware.ts en proxy.ts (export nommé `proxy`).
  Toujours vérifier node_modules/next/dist/docs/ avant d'écrire un fichier
  dont le nom fait partie des conventions Next.js.

- cookies() de next/headers est asynchrone depuis Next.js 15/16 : toute
  fonction qui l'utilise doit être async. Idem pour `searchParams`.

- Route groups Next.js : deux fichiers page.tsx dans des groupes différents
  qui résolvent à la MÊME URL font planter le build (« Conflicting paths »).

- Compte à rebours hydraté (Countdown.tsx, session du 21/07/2026, reconduit
  sur MatchRow §2.8) : ne JAMAIS lire l'horloge pendant le rendu (état
  `null` jusqu'au montage, vraie valeur via useEffect) — sinon décalage
  d'hydratation serveur/client.

- ESLint `react-hooks/set-state-in-effect` (trouvé en écrivant MatchRow,
  session du 23/07/2026) : un appel `setState(...)` DIRECTEMENT dans le
  corps d'un `useEffect` (même dans un simple `if`) est une ERREUR de lint,
  y compris pour le patron « lire l'horloge seulement après montage » déjà
  utilisé par Countdown.tsx. Countdown.tsx y échappait car son setState vit
  dans une fonction NOMMÉE (`tick`) appelée depuis l'effet, pas au premier
  niveau du corps de l'effet — la règle ne remonte pas dans les fonctions
  imbriquées. Solution reconduite partout : envelopper tout setState d'effet
  dans une petite fonction nommée, même pour un calcul qui ne s'exécute
  qu'une fois.

- RLS qui bloque une écriture ne renvoie PAS toujours une erreur PostgREST
  (trouvé en testant les mécaniques d'écriture de l'écran Matchs, session du
  23/07/2026) : un `UPDATE` dont la clause `USING` de la policy ne matche
  AUCUNE ligne (ex. tentative de modifier un prono déjà `VALIDATED`, policy
  `mp_update_self` qui exige `status='DRAFT'`) réussit silencieusement avec
  ZÉRO ligne affectée — `error` reste `null`. Un test qui ne vérifie que
  `error` peut donc croire à tort qu'une écriture interdite est passée.
  Toujours vérifier le nombre de lignes réellement affectées (`.select()` +
  compter, ou `count: 'exact'`), jamais seulement l'absence d'erreur.

- Agrégat RLS confidentiel par construction (Classement §2.7, compteur X/N
  de l'écran Matchs §2.8) : une vue/fonction en `security_invoker` (ou un
  simple `count()` en session joueur) hérite silencieusement de la RLS des
  tables sources, MÊME quand l'intention produit est un chiffre PUBLIC
  (rang, total, "X ont pronostiqué"). Symptôme : correct pour un admin (qui
  contourne la RLS), sous-compté pour un joueur normal — invisible sans un
  VRAI jeu de données multi-joueurs, indétectable en lisant juste le code ou
  la spec. Solution reconduite deux fois : une fonction/vue SECURITY
  DEFINER dédiée qui n'expose QUE l'agrégat (jamais les lignes sources) —
  jamais désactiver la RLS des tables elles-mêmes.

- Next.js 16 documente officiellement le blocage de navigation interne via
  la prop `onNavigate` de `<Link>` + un contexte React partagé (pas un hack
  ad hoc) — utilisé pour la garde C2 (§2.8). Piège trouvé en le câblant : un
  composant partagé par PLUSIEURS points de montage (TabBar, rendu à la fois
  sous app/(app)/layout.tsx ET sous ScreenShell) peut se retrouver SANS le
  contexte selon la route — le hook consommateur doit se dégrader en no-op,
  jamais lever, sous peine de casser les écrans qui n'ont pas ce contexte.

- `next/image` refuse d'optimiser un SVG par défaut (trouvé en câblant les
  logos, session du 24/07/2026) : nécessiterait `dangerouslyAllowSVG` +
  `contentSecurityPolicy` dans next.config (config partagée, surface de
  sécurité en plus). Contourné avec la prop `unoptimized` (documentée par
  Next.js pour ce cas précis, `<Image src="....svg" unoptimized />`) — zéro
  changement de config, l'image est juste servie telle quelle.

- Tester une Server Action réellement, sans navigateur ni JS (trouvé en
  vérifiant le bouton de déconnexion temporaire, session du 24/07/2026) :
  un `<form action={monAction}>` sans amélioration progressive JS poste en
  RÉEL vers l'URL courante (`action=""`), `method="POST"`,
  `encType="multipart/form-data"`, et porte un `<input type="hidden"
  name="$ACTION_ID_...">` dont la VALEUR est vide — c'est le NOM du champ
  qui identifie l'action à exécuter. Technique reproductible avec curl :
  récupérer le HTML rendu authentifié, extraire ce nom de champ exact, puis
  `curl -F "$ACTION_ID_...=" URL` avec les cookies de session. Confirme que
  la déconnexion fonctionne réellement (cookie effacé, 303 vers /login) sans
  jamais ouvrir de navigateur.

- Déduction de schéma — deadline du bracket absente : `competitions.
  bracket_deadline` est nullable. Tant que NULL, l'item bracket de l'Accueil
  n'apparaît pas. Décision d'implémentation, pas une spec (item ouvert dans
  GAPS_OUVERTS.md).

- Ambiguïté de spec résolue avec l'utilisateur (AskUserQuestion, 21/07/2026) :
  SPEC_ECRAN_ACCUEIL §6 nomme `bets.resolved_at` pour l'item « Pari statué »
  mais illustre par « validé/ajusté » (workflow de VALIDATION, colonne
  différente). Tranché : lecture littérale de la colonne citée → paris
  ANNULÉS (CANCELLED), libellé « Neutralisé ».

- Rotation d'écran ET routage client (TreeView.tsx, 22/07/2026) : agir
  seulement sur l'ÉVÉNEMENT de changement d'orientation, jamais sur l'état
  constaté au montage ; une `ref` (pas un `useState`) pour éviter une
  fermeture périmée dans le listener.

- Colonne absente pour une règle de spec (raccourci pari, écran Matchs,
  §2.8) : `bets` n'a aucune colonne `rejected_at` — la règle « REJECTED
  avant/après sa deadline » (0.2.4 §6) n'est donc pas calculable telle
  quelle. Signalé et tranché AVEC l'utilisateur (toujours considéré
  « libéré », cas normal compte tenu de sealDeadlines) plutôt que de deviner
  une colonne de repli (`updated_at`) ou d'élargir le schéma pour un lot pas
  encore codé (Paris).

- Composant client SANS sa propre directive (`TeamLogo.tsx`, trouvé en
  codant Mes pronos, §2.11) : un composant qui utilise un hook (`useState`)
  mais n'a pas sa PROPRE `"use client"` ne fonctionne que « transitivement
  bundlé » — c'est-à-dire uniquement si TOUS ses points d'appel sont déjà
  atteints via un ancêtre `"use client"` (ce qui était vrai par coïncidence
  pour `NodeCard`/`MatchRow`, jamais vérifié explicitement). Dès qu'un
  composant SERVEUR sans ancêtre client veut le rendre directement (`Match
  RowStatic` sur Mes pronos), il faut lui donner sa propre directive —
  sans changement de rendu pour les appelants existants, qui étaient déjà
  dans ce cas en pratique.

- Un canal Realtime unique pour toute une liste rendue par des composants
  SERVEUR (`LiveSubscriber.tsx`, Mes pronos, §2.11) : un seul composant
  client peut porter la souscription ET rester la seule frontière
  `"use client"` de l'écran, à condition d'exporter DEUX éléments du MÊME
  fichier — un Provider (Context React, souscription unique) qui ENVELOPPE
  la liste des lignes serveur (passées en `children`, patron RSC officiel :
  un Server Component peut être passé en enfant d'un Client Component sans
  jamais s'exécuter côté client), et un petit consommateur (`useContext`)
  que CES lignes serveur peuvent instancier directement à l'endroit précis
  où le badge/score doit se mettre à jour.

- Tester un formulaire natif `useActionState` (login/signup) SANS JS, VS un
  simple `<form action={fn}>` sans état lié (logout, requête de correction) :
  React 19/Next 16 encodent les deux cas DIFFÉREMMENT en repli
  progressive-enhancement. Le 2e cas porte un unique champ caché `<input
  name="$ACTION_ID_...">` (technique déjà connue, §7 plus haut, logout). Le
  1er cas (état précédent lié en argument via `useActionState`) porte 4
  champs cachés distincts — `$ACTION_REF_N` (vide), `$ACTION_N:0` (JSON
  `{id, bound}`), `$ACTION_N:1` (JSON du/des argument(s) lié(s)),
  `$ACTION_KEY` — les 4 doivent être renvoyés tels quels dans le POST
  multipart pour que l'action s'exécute. Trouvé et vérifié en rejouant un
  vrai login sans navigateur (§2.11), même esprit que la technique déjà
  utilisée pour la déconnexion.

- Rate limit d'email Supabase sur l'inscription réelle (`/signup`, trouvé en
  testant Mes pronos en conditions réelles, §2.11) : tant que « Confirm
  email » n'est pas désactivé côté dashboard (§6, point déjà connu mais
  jamais concrètement rencontré), CHAQUE appel réel à `supabase.auth.signUp()`
  tente d'envoyer un email de confirmation — le mailer par défaut sature vite
  (`429, over_email_send_rate_limit`). Invisible tant que les comptes de test
  sont créés via l'API Admin (`email_confirm:true`, aucun envoi) : ce n'est
  apparu qu'en testant pour la première fois le vrai formulaire public.
  SUITE le 27/07/2026 (§2.17) : même en décochant « Confirm email » (vérifié
  décoché ET sauvegardé), un test contrôlé et une vraie tentative ont quand
  même re-buté sur le même mur peu après. PAS élucidé : soit le quota
  minuscule du mailer par défaut (souvent ~2 emails/heure, partagé entre
  TOUS les types d'email, pas seulement la confirmation) était encore
  épuisé par un envoi précédent, soit Supabase tente un email de courtoisie
  indépendamment du caractère obligatoire ou non de la confirmation. Seule
  solution de contournement fiable trouvée : créer les comptes via l'API
  Admin (`email_confirm:true`), qui ne déclenche structurellement aucun
  envoi — pas une vraie résolution du mystère, un contournement.

- Route racine jamais câblée (`app/page.tsx`, trouvé au premier déploiement
  Vercel réel, §2.17, 27/07/2026) : le fichier était resté le scaffold
  `create-next-app` par défaut depuis la création du projet (18/07/2026) —
  jamais retouché, jamais remarqué en dev/test car TOUS les tests précédents
  visitaient des routes précises (`/login`, `/home`, etc.), jamais la racine
  nue (`/`). Un site tout juste déployé mérite un tour rapide de sa racine
  avant de le considérer vérifié, pas seulement des routes déjà connues.
  Corrigé par un simple `redirect("/login")`, qui délègue à `proxy.ts`
  (déjà testé) le renvoi vers `/home` si une session est active.

- Logo décentré dans sa pastille malgré un CSS correct (trouvé en testant Mes
  pronos, §2.13) : `object-fit: contain` centre fidèlement la boîte du
  `viewBox` déclaré — mais si ce `viewBox` réserve un canevas plus grand que
  le dessin réel (marge non désirée laissée par l'export du fichier), le
  logo VISIBLE se retrouve décalé même si le CSS, lui, est irréprochable. Pas
  détectable en lisant le composant : il faut ouvrir le SVG et regarder où se
  trouvent réellement les tracés par rapport au `viewBox` déclaré. Corrigé en
  recalculant la boîte englobante réelle de chaque fichier (tokenizer de
  commandes de tracé SVG écrit à la main — M/L/H/V/C/S/Q/Z, échantillonnage
  des courbes de Bézier — aucune dépendance, aucun navigateur nécessaire) et
  en réécrivant le `viewBox` en conséquence. Diagnostic AVANT correctif :
  toujours vérifier l'hypothèse (ouvrir le fichier réel) avant de proposer un
  correctif CSS qui n'aurait rien changé.

- Constante partagée serveur+client qui casse le build (`lib/queries/bets.ts`
  → `components/bets/BetForm.tsx`, écran Nouveau pari, §2.15) : un module qui
  importe `getServerClient()` (donc `next/headers`) ne peut pas être importé
  au RUNTIME (valeurs, pas seulement des types) par un composant `"use
  client"` — Next.js refuse le build (« next/headers dans un composant
  client »), même si le composant client n'utilise en pratique que 2-3
  constantes du fichier. Solution reconduite : extraire les constantes SANS
  dépendance serveur dans un module neutre (`lib/labels/bets.ts`, même rôle
  que `lib/labels/rounds.ts`), consommé par la lecture serveur ET le
  composant client. Les imports `import type {...}` restent sûrs dans les
  deux sens (effacés à la compilation), seuls les imports de VALEURS posent
  problème.

- Garde de quota SANS backstop d'index unique, dans une fonction SECURITY
  DEFINER (`save_bet`, migration #10, §2.15) : un simple `SELECT count(*)`
  suivi d'un `INSERT`, même regroupés dans une seule fonction/transaction,
  ne ferme PAS une course entre deux appels CONCURRENTS (deux transactions
  peuvent chacune lire le même count avant que l'une des deux ne committe).
  Contrairement aux quotas « 1 pari actif » (protégés par un vrai index
  unique partiel, backstop atomique quel que soit le code applicatif), le
  cap « 3 paris MATCH/série » n'a aucun équivalent en base (T1 le note
  explicitement) — sans mesure supplémentaire, le choix même d'une fonction
  SECURITY DEFINER n'aurait fermé cette course qu'en apparence. Fermé par un
  `pg_advisory_xact_lock` (clé = user × série, portée à la transaction)
  AVANT le comptage, qui sérialise les créations concurrentes visant la même
  série pour le même joueur.

- Bandeau `position: fixed` : l'offset ne se COPIE pas d'un autre composant
  sans vérifier (trouvé en réutilisant le calcul de `StickyMeBar`, §2.15
  suite 27/07/2026) — la hauteur réelle rendue de `TabBar` (padding + bordure
  inclus) ne correspondait pas à ce que l'autre composant supposait,
  provoquant un chevauchement de quelques pixels invisible à l'œil nu sur une
  capture d'écran ordinaire. Mesuré via `getBoundingClientRect()` des deux
  éléments en conditions réelles (pas une capture d'écran) pour trouver la
  vraie valeur. Piège annexe : une capture d'écran PLEINE PAGE (`fullPage`)
  fausse le rendu d'un élément `position: fixed` — l'outil de capture
  redimensionne temporairement le viewport à la hauteur totale du document,
  et l'élément fixe s'ancre alors à CE viewport élargi, pas à la fenêtre
  réelle. Toujours vérifier un `position: fixed`/`sticky` avec une capture
  VIEWPORT (non pleine page) avant/après un scroll réel, ou par mesure directe.

- `<select>` natif ne peut pas afficher de logo (écran Nouveau pari, §2.15) :
  la spec demandait des logos de franchise sur les sélecteurs série/match
  (T7 §15.8-style) — un `<option>` HTML ne rend que du texte. Les
  sélecteurs concernés (`SeriesPicker`/`MatchPicker`, `components/bets/
  BetForm.tsx`) sont donc des listes de boutons (`role="radio"`), pas des
  `<select>` — réservés aux listes fermées SANS logo (catégorie, difficulté).

- Serveur de dev déjà lancé (trouvé en testant l'écran Nouveau pari en
  navigateur, §2.15 suite 27/07/2026) : `npm run dev` a échoué silencieusement
  en détectant un verrou d'instance existant pour le même dossier (Next.js 16
  refuse deux serveurs dev concurrents sur un même projet) — un port
  totalement différent (3000) répondait par ailleurs pour un projet SANS
  RAPPORT, source de confusion transitoire. Toujours vérifier QUEL processus
  sert réellement le contenu attendu (`curl` + inspection du HTML rendu, pas
  seulement un code 200) avant de tuer/relancer quoi que ce soit ; réutiliser
  un serveur déjà actif plutôt que d'en imposer un second.

- Cascade dérivée du résultat OFFICIEL au lieu du pick du joueur (leçon du
  PROTOTYPE, réappliquée en écrivant l'écran Bracket personnel, §2.16) :
  pour un tour 2+ d'un bracket, les équipes "candidates" doivent être
  dérivées UNIQUEMENT du pronostic du joueur sur les séries qui alimentent
  la série courante — jamais du résultat officiel de ces séries, même si ce
  résultat est déjà connu en base au moment du calcul. Une 1ère version (hors
  V1, dans le prototype) faisait l'inverse et ne remplissait donc JAMAIS
  correctement les tours 2+. Techniquement, le cas "résultat officiel connu
  alors que le bracket est encore modifiable" ne peut de toute façon jamais
  survenir (le bracket se verrouille au 1er match, avant tout résultat de
  tour 2+) — mais le CODE ne doit pas dépendre de cette impossibilité pour
  être correct : `computeCandidateTeamIds` (lib/queries/bracket-fill.ts) ne
  lit même pas les colonnes de résultat officiel, structurellement incapable
  de reproduire le bug. Corollaire retenu du même endroit : la validation
  serveur d'un pick soumis (lib/actions/bracket-fill.ts) doit recalculer les
  candidats avec la MÊME fonction que la lecture, jamais les revérifier
  contre `series.team1_id/team2_id` (toujours NULL pour les tours 2+ avant
  le vrai résultat) — sinon toute écriture sur ces tours échoue à coup sûr.

- Ne pas supposer qu'une migration/fonction SECURITY DEFINER est nécessaire
  sans vérifier la RLS existante d'abord (comparaison entre les lots §2.15 et
  §2.16) : « Nouveau pari » a eu besoin d'une migration (trigger) + de deux
  fonctions SECURITY DEFINER (quota non exprimable en index) ; « Bracket
  personnel », lu au pré-vol AVANT de coder, n'en a eu besoin d'AUCUNE — la
  RLS `brackets_insert/update`/`bracket_picks_insert/update` (migration #3)
  couvrait déjà tout le nécessaire (propriétaire, actif, deadline). Deux
  lots voisins, deux besoins différents : le pré-vol (lire les policies
  RÉELLES avant d'écrire une seule ligne de garde applicative) est ce qui
  a évité soit une migration inutile, soit — pire — une garde dupliquée qui
  aurait pu diverger de la RLS.

- Nom de colonne supposé par analogie, jamais vérifié (migration #11, §2.19,
  27/07/2026) : `matches` porte une colonne `status`, mais `series` porte
  `official_status` — deux tables voisines, deux noms différents pour un
  concept similaire. Une fonction SQL écrite par analogie (« matches.status
  existe, donc series.status doit exister aussi ») a fait planter TOUTE
  requête de correction sur un pari SÉRIE (« column series.status does not
  exist »), trouvé seulement en appelant la fonction en conditions réelles,
  jamais en relisant le code. Corrigé par la migration #12 (même patron que
  #4). Leçon reconduite : même quand une colonne « doit sûrement exister »
  par cohérence avec une table voisine, vérifier le VRAI schéma (fichier de
  migration réel) avant de l'utiliser dans du SQL — l'analogie n'est pas une
  preuve.

- Rejouer le formulaire de login (`useActionState`, sans JS) échoue parfois
  avec « Failed to find Server Action » même en réextrayant les 4 champs
  `$ACTION_*` juste avant de poster (trouvé en testant le tableau de bord
  admin, §2.20, 27/07/2026) — cause non élucidée avec certitude (dev server
  très sollicité par de nombreuses recompilations pendant la session,
  suspecté mais pas prouvé). Contournement plus ROBUSTE pour tester une
  garde d'accès sans dépendre du flux de login lui-même (déjà éprouvé par
  ailleurs) : produire directement un cookie de session compatible via
  `@supabase/ssr` — `createServerClient()` avec un cookie store maison +
  `signInWithPassword()`, MÊME librairie que `lib/supabase/server.ts`/
  `proxy.ts`, donc byte-compatible avec ce que le vrai serveur attend, sans
  reproduire à la main l'encodage React 19 des server actions. À préférer
  à la technique `$ACTION_*` quand ce n'est PAS le formulaire de login
  lui-même qui est testé.

Pièges génériques du prototype (Postgres/Git/PowerShell, toujours valables en
principe) non recopiés ici pour éviter la duplication — voir l'historique du
dépôt `nba-pronos-proto` s'ils resurgissent en V1.
```

### 2.20 Tableau de bord admin (session du 27/07/2026, premier écran du lot Admin)

```text
Périmètre : SPEC_ECRAN_ADMIN_DASHBOARD_V0_1.md (Cadrage/V1/Spec visuelle/,
nouveau fichier, close en séance) — STRICTEMENT app/(admin)/admin/{layout,
page}.tsx (garde de rôle + compteurs), PAS les 5 pages filles (lots
séparés). Premier écran de la zone (admin), distincte de (app) — pas un 5e
onglet, atteint depuis Profil (lien câblé, remplace l'entrée inerte posée
le même jour lors du lot Profil, §2.18).

Contrairement à Bracket personnel (§2.16, aucune décision n'existait), la
zone admin était déjà entièrement architecturée par T6a/T6b (validées le
19/07/2026, jamais relues depuis) : arbre app/(admin)/admin/* complet,
garde is_admin() côté layout, signatures des actions admin. Ce lot n'a donc
fait qu'ASSEMBLER l'existant (0.2.7 + 0.2.9 §8 + T6a/T6b) au format écran.

Découpage du lot Admin décidé AVEC l'utilisateur (AskUserQuestion) :
tableau de bord d'abord, une page fille à la fois ensuite — pas tout
spécifié d'un coup, pas une file précise en premier.

2 points fermés avec l'utilisateur avant rédaction (AskUserQuestion) : sans
compétition active, Gestion des joueurs et Historique des logs restent
ACCESSIBLES (seuls les 3 compteurs de file retombent à 0) ; bouton
Recalculer sans compétition active — DÉSACTIVÉ mais VISIBLE, jamais masqué.

**Vérification de dépôt AVANT code, 2 réalités trouvées et signalées avant
d'écrire quoi que ce soit** (AskUserQuestion, pas devinées) :
- `recomputeCompetition` (T5 §10.1) N'EXISTE NULLE PART (ni migration, ni
  lib/) — le moteur de scoring T5 est spécifié mais jamais codé. Bouton
  Recalculer OMIS de ce lot (design conservé dans la spec §4, à coder avec
  T5) plutôt que de construire un bout du moteur de scoring en douce.
- Aucune des 5 pages filles n'existe : les 3 cartes de file + les 2
  entrées (joueurs/logs) sont INERTES (pas de <Link>, libellé « à venir »),
  même patron que le hub Jouer temporaire (§2.10) — retirées une à une au
  fur et à mesure que chaque page fille est codée.

Fichiers : app/(admin)/admin/layout.tsx (+ .module.css, garde is_admin(),
redirect /home si non-admin — défense en profondeur, le proxy ne garde que
la SESSION, pas le RÔLE, T6a §4.2) ; app/(admin)/admin/page.tsx (+
.module.css, 100% composant serveur, AUCUN "use client" dans ce lot) ;
lib/queries/admin-dashboard.ts (getAdminDashboardData — 3 compteurs :
validation = bets SUBMITTED ; résolution = bets VALIDATED dont l'échéance
est passée, bet_deadline_open() reproduit en TypeScript, même patron que
lib/queries/{bets,home}.ts, pas une 3e implémentation divergente ;
requêtes = correction_requests PENDING, TOUTES compétitions confondues —
pas de délai limite en V1, 0.2.7 §6). AUCUNE migration.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres
(un premier tsc a achoppé sur des types de routes Next.js pas encore
régénérés — résolu après un next build). Aucun conflit de route.

Test en conditions réelles — TECHNIQUE NOUVELLE cette session (voir §7) :
la technique habituelle (rejouer le POST useActionState de /login sans JS)
a échoué de façon répétée (« Failed to find Server Action ») malgré une
extraction correcte des champs $ACTION_*, cause non élucidée avec
certitude. Contournée en produisant un cookie de session directement via
@supabase/ssr (createServerClient + signInWithPassword, MÊME librairie que
lib/supabase/server.ts/proxy.ts) plutôt que de rejouer le formulaire —
teste directement la garde is_admin(), sans dépendre du flux de login
(déjà éprouvé par ailleurs). Résultats : Amine92 (PLAYER) sur /admin →
307 /home (garde refuse bien) ; Sofia_Admin (ADMIN) → 200, « Administration »
rendu, compteurs 0/0/1 — le 1 correspond EXACTEMENT à la requête de
correction PENDING laissée en base depuis la session Mes pronos (§2.11),
confirmation forte que le compteur est juste ; bandeau « Aucune compétition
en cours » absent à raison (compétition ACTIVE présente). Mots de passe
temporaires posés via l'API Admin sur Sofia_Admin/Amine92 (jamais affichés
dans le chat), re-randomisés en fin de vérification. Scripts jetables de
test créés puis supprimés, non committés.

PAS committé ni déployé à ce stade (à confirmer avec l'utilisateur).
```

### 2.21 File de validation des paris (session du 27/07/2026, suite)

```text
Périmètre : SPEC_ECRAN_ADMIN_VALIDATION_V0_1.md (Cadrage/V1/Spec visuelle/,
nouveau fichier, close en séance) — app/(admin)/admin/validation/page.tsx.
Deuxième écran du lot Admin, choisi en premier parmi les 5 pages filles :
SEULE avec « Gestion des joueurs » à ne PAS dépendre du moteur de scoring
T5 manquant (validateBet/rejectBet sont catégorie B SANS recompute, T6a
§5.3 — contrairement à resolveBet, qui appelle recomputeBet).

Trouvaille au pré-vol (pas dans la prose 0.2.9, mais dans le schéma ET la
signature T6b) : validateBet exige AUSSI une catégorie validée, pas
seulement la difficulté — sélecteur de catégorie ajouté à la carte en plus
de la réglette, cohérent avec l'interprétation déjà actée en Mes pronos
(§2.11 : « catégorie suit la même règle que la difficulté »).

Fichiers : lib/queries/admin-validation.ts (getPendingValidationBets — TOUS
les joueurs de la compétition active, pas seulement auth.uid(), même
construction de libellés que lib/queries/my-bets.ts) ; lib/actions/
admin-validation.ts (validateBet/rejectBet + variantes FormData, session
admin via getServerClient, RLS bets_update_admin — AUCUNE fonction SQL
SECURITY DEFINER, AUCUNE migration) ; lib/actions/audit.ts (NOUVEAU,
PARTAGÉ — logAdminAction, écrit audit_logs, réutilisable par les 4 lots
admin restants) ; components/admin/ValidationBetCard.tsx (+ .module.css,
100% composant serveur — 2 formulaires natifs indépendants par carte,
Valider/Refuser, <select> natifs pour catégorie/difficulté, aucun JS
requis). Carte « à valider » du tableau de bord rendue <Link> actif vers
/admin/validation (les 2 autres cartes + les 2 entrées restent inertes).

Garde-fou repris (piège déjà rencontré, §7) : validateBet/rejectBet
re-vérifient le statut SUBMITTED dans le WHERE de l'UPDATE (pas seulement
en lecture avant), puis .select().maybeSingle() pour détecter 0 ligne
affectée (pari déjà traité par un autre admin) — jamais seulement l'absence
d'erreur.

logAdminAction (lib/actions/audit.ts) : appelée APRÈS la transition,
best-effort (pas de transaction cross-appel PostgREST possible ici,
catégorie SANS recompute donc pas de fonction SQL unique) — un échec de log
ne fait PAS échouer l'action déjà posée, juste signalé en console serveur.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres,
aucun conflit de route (/admin/validation listé).

Test en conditions réelles (même technique @supabase/ssr que §2.20) : 2
paris de test SUBMITTED créés via service_role (un à valider, un à
refuser) ; carte rendue avec le bon contexte (joueur, cible, énoncé,
catégorie/difficulté proposées) ; formulaire Valider soumis réellement
(POST sans JS, technique $ACTION_ID_ déjà connue) → bets.status=VALIDATED,
validated_category/validated_difficulty/validated_by_admin_id posés
correctement, ligne audit_logs "VALIDATE_BET" créée ; formulaire Refuser
soumis → status=REJECTED, refusal_reason posé, ligne audit_logs
"REJECT_BET" créée. Piège rencontré en testant (pas un bug du code, un bug
du script de test) : les 2 formulaires d'une même carte partagent le même
hidden betId — un script de test qui n'extrait l'ACTION_ID qu'en cherchant
ce betId récupère le MAUVAIS formulaire ; corrigé en désambiguïsant par un
2e champ propre à chaque formulaire (validatedCategory vs refusalReason).
2 paris de test + leurs lignes audit_logs supprimés après vérification,
mot de passe temporaire re-randomisé.

PAS committé ni déployé à ce stade (à confirmer avec l'utilisateur).
```

### 2.22 Gestion des joueurs (session du 27/07/2026, suite)

```text
Périmètre : SPEC_ECRAN_ADMIN_PLAYERS_V0_1.md (Cadrage/V1/Spec visuelle/,
nouveau fichier, close en séance) — app/(admin)/admin/players/page.tsx.
Troisième écran du lot Admin, choisi (comme la validation) car
setPlayerRole/setPlayerStatus sont catégorie B SANS recompute (T6a §5.3) —
aucune dépendance sur le moteur de scoring T5 manquant.

Bonne surprise au pré-vol : les garde-fous fins (pas d'auto-rétrogradation,
dernier admin actif non rétrogradable/désactivable) étaient DÉJÀ posés en
base par un trigger (`enforce_users_invariants`, migration #3 corrigée #4)
— la couche d'écriture de ce lot est une simple UPDATE directe sur `users`
via la RLS `users_update_admin`, AUCUNE fonction SQL, AUCUNE migration. Les
messages d'erreur du trigger, déjà rédigés pour un lecteur humain (ex.
« Un admin ne peut pas se retrograder lui-meme »), sont remontés tels
quels, même patron que `requestBetCorrection`.

Fichiers : lib/queries/admin-players.ts (getPlayers — tous les joueurs,
ADMIN d'abord puis PLAYER alphabétique, calcule isSelf/isLastActiveAdmin en
lecture pour griser les actions AVANT le clic) ; lib/actions/
admin-players.ts (setPlayerRole/setPlayerStatus + variantes FormData,
journalisées via lib/actions/audit.ts déjà partagé) ; components/admin/
PlayerRow.tsx (+ .module.css, 2 formulaires natifs indépendants par ligne,
boutons `disabled` natifs HTML — fonctionnent sans JS). Carte « Gestion des
joueurs » du tableau de bord rendue `<Link>` actif.

Décision d'implémentation actée dans la spec (§2, pas une invention) :
l'auto-désactivation (rester ADMIN mais se désactiver soi-même, PAS une
rétrogradation) n'est PAS bloquée par le trigger sauf si c'est le dernier
admin actif — reflété tel quel dans l'UI plutôt que d'inventer une garde
supplémentaire que ni 0.2.7 ni le trigger n'exigent.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres,
aucun conflit de route (/admin/players listé).

Test en conditions réelles (même technique @supabase/ssr) : ligne de
Sofia_Admin (soi-même) confirmée avec boutons `disabled` dans le HTML rendu ;
promotion de Tariq_M en ADMIN puis rétrogradation en PLAYER — les deux
soumises réellement (POST sans JS) et vérifiées, aller-retour sans effet
résiduel (état final identique à l'état initial) ; **cas négatif réel** :
tentative de forcer l'auto-rétrogradation de Sofia_Admin en construisant le
POST directement (contournant le bouton désactivé côté UI, qui n'est qu'un
confort, pas la vraie frontière de sécurité) — bloquée CÔTÉ SERVEUR par le
trigger, message d'erreur exact remonté par l'URL de redirection. Confirme
que la garde réelle est bien en base, pas seulement cosmétique dans l'UI.
2 lignes audit_logs de test (promotion/rétrogradation de Tariq_M)
supprimées après vérification, mot de passe temporaire re-randomisé.

PAS committé ni déployé à ce stade (à confirmer avec l'utilisateur).
```

### 2.23 Historique des logs (session du 27/07/2026, suite — DERNIÈRE page sans dépendance T5)

```text
Périmètre : SPEC_ECRAN_ADMIN_LOGS_V0_1.md (Cadrage/V1/Spec visuelle/,
nouveau fichier, close en séance) — app/(admin)/admin/logs/page.tsx.
Quatrième écran du lot Admin, écran de LECTURE PURE (0.2.7 §8) — aucune
dépendance sur T5, ferme la liste des pages filles « faciles ».

Trouvaille au pré-vol : le détail des filtres/tri (0.2.9 §11 le listait
comme « à préciser ») était en réalité DÉJÀ tranché — retrouvé dans
`nba_pronos_PREP_SPEC_TECHNIQUE_V1.md` §B5 (validé le 17/07/2026, jamais
réouvert dans GAPS_OUVERTS.md depuis) : tri = plus récent d'abord, filtres
= type d'action, admin, date. Trouvé en CHERCHANT la source avant d'inventer
un design de filtres.

Fichiers : lib/labels/audit.ts (NOUVEAU — vocabulaire fermé des actions
journalisées, à étendre par chaque futur lot admin, même rôle que
lib/labels/bets.ts) ; lib/queries/admin-logs.ts (getAuditLogs +
getAuditLogFilterOptions — options de filtre DÉRIVÉES des valeurs
RÉELLEMENT présentes en base, pas une liste figée) ; components/admin/
AuditLogRow.tsx (+ .module.css, consultation pure, aucun formulaire) ;
app/(admin)/admin/logs/page.tsx (filtres en `<form method="get">` natif,
querystring, aucun "use client"). Carte « Historique des logs » du tableau
de bord rendue `<Link>` actif.

Refactor mineur SANS changement de comportement, en cours de route :
`parisDayBoundsUtc` (calcul de bornes UTC d'un jour calendaire Europe/Paris,
écrit pour Mes pronos §2.11) déménagée de lib/queries/my-predictions.ts vers
un nouveau module neutre lib/dates/paris.ts (aucune dépendance next/headers)
— 2e utilisateur (le filtre date des logs), pour éviter une 3e
implémentation divergente de la même fonction (piège déjà noté pour
bet_deadline_open, §7). Mes pronos re-vérifié après coup (tsc/eslint/build +
next build listant toujours /play/my-predictions sans erreur) — aucun
changement de comportement, juste un déplacement de fonction pure.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres,
aucun conflit de route (/admin/logs listé).

Test en conditions réelles (même technique @supabase/ssr) : 2 vraies
entrées de log générées via Gestion des joueurs (promotion/rétrogradation
réelle de Tariq_M, déjà le cas de test du lot précédent) ; écran /admin/logs
sans filtre : acteur (Sofia_Admin), libellé d'action (« Rôle modifié »),
cible (Tariq_M, pseudo résolu) tous corrects ; filtre par action
(SET_PLAYER_ROLE) : n'affiche QUE les bonnes entrées ; filtre par admin :
correct ; filtre par date (aujourd'hui vs une date sans log) : les deux
comportements corrects, y compris l'état vide filtré (« Aucun résultat pour
ces filtres. ») ; contenu avant/après (before_value/after_value JSON)
vérifié directement en base, cohérent avec ce que le rendu affiche. 2 lignes
de test supprimées après vérification, mot de passe temporaire
re-randomisé.

COMMITTÉ et POUSSÉ sur `main`.
```

### Correctif région Vercel (session du 27/07/2026, entre §2.23 et le chantier T5)

```text
Latence après chaque clic remontée par l'utilisateur. Diagnostiquée :
fonctions Vercel en iad1 (Washington D.C., région par défaut de tout
nouveau projet Vercel), base Supabase en eu-west-1 (Dublin). `vercel.json`
ajouté (`regions: ["dub1"]`, Dublin — même région que Supabase, pas Paris
malgré la localisation de l'utilisateur : une page fait souvent plusieurs
allers-retours fonction↔base PAR requête, contre un seul aller-retour
navigateur↔fonction — recommandation officielle Vercel confirmée par
recherche web avant d'agir). Committé, poussé, redéployé et vérifié
(`vercel inspect` confirme `[dub1]` sur toutes les fonctions).
```

### Chantier T5 — Moteur de scoring (session du 27/07/2026, suite)

```text
Découpage en 4 lots confirmé AVEC l'utilisateur (AskUserQuestion), un lot à
la fois avec vérification entre chaque, même discipline que le lot Admin :
  1. Moteur pur (lib/scoring/engine.ts) — CE lot.
  2. Writer minimal series.official_* (lib/sync/writeSeriesOutcome.ts) —
     SEULE la fonction d'écriture, PAS le reste de T4 (pas de route API,
     pas de client Highlightly, pas de cron).
  3. Orchestration (lib/scoring/recompute.ts) — recomputeMatch/Series/
     Bet/Competition.
  4. Câblage admin — bouton Recalculer, résolution des paris, traitement
     des requêtes de correction.

**Framework de test ajouté** : `vitest` (devDependency NOUVELLE — la
première du projet ; jusqu'ici tout vérifié par scripts jetables/tests
manuels). Confirmé AVEC l'utilisateur (AskUserQuestion) : la spec T5 §11
décrit elle-même le moteur pur comme testable « sans base, sur cas de
table » — 32 cas déjà listés, dont 26 relevant du moteur pur (lot 1).
`npm test` (`vitest run`) ajouté aux scripts.
```

### 2.24 Lot 1/4 T5 — Moteur pur (`lib/scoring/engine.ts`)

```text
Périmètre : SPEC_TECHNIQUE_SCORING_V0_1.md §3-§9 — les 4 fonctions PURES
(deriveSeriesOutcome, scoreMatchPrediction, scoreBracketPick, scoreBet).
AUCUNE I/O, AUCUNE dépendance getServerClient/next-headers (C-3). Spec déjà
VALIDÉE et figée (19/07/2026) — aucune nouvelle décision produit, portage
fidèle des signatures et barèmes du §3.

**Point d'interprétation trouvé et documenté dans le code** (pas une
nouvelle décision, une clarification de lecture) : le §4 de T5 dit que
`deriveSeriesOutcome` "renvoie tel quel" un statut CANCELLED/POSTPONED déjà
présent — mais la signature figée du §3 ne prend QUE `matches` +
`competitionType`, aucun statut existant en entrée. Ces deux phrases sont
incompatibles littéralement. Tranché : la signature du §3 (le contrat
figé) fait autorité — `deriveSeriesOutcome` reste STRICTEMENT pure et
calcule toujours depuis les matchs ; le respect d'un CANCELLED/POSTPONED
déjà posé par un admin est un garde-fou de l'ORCHESTRATION (lot 2/3, avant
d'appeler deriveSeriesOutcome + writeSeriesOutcome), pas de cette fonction.
Documenté en commentaire dans engine.ts ; le cas de test #5 de la spec (qui
testait ce point) est donc déplacé au lot 3 (orchestration) plutôt que
testé ici.

**Clarification trouvée en écrivant le code** (pas un point produit, une
lecture précise du §6.3) : la composante AFFICHE d'un pick de bracket se
score dès que la PAIRE OFFICIELLE de la série est connue — INDÉPENDAMMENT
du fait que la série elle-même soit FINISHED. Un joueur peut donc voir son
affiche scorée (bonne ou mauvaise) avant même que la série ne soit jouée,
pendant que vainqueur/score-exact restent encore NULL (en attente). Les
cas de test #26/#27 de la spec confirment cette lecture (« sera scorée
quand la paire officielle sera connue »).

Fichiers : lib/scoring/engine.ts (4 fonctions + types + helpers internes
non exportés) ; lib/scoring/engine.test.ts (26 tests, cas 1-4/6-27 du §11 —
tous PASSENT).

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres
(aucune route impactée, engine.ts/.test.ts hors app/) ; npm test → 26/26.

COMMITTÉ et POUSSÉ sur `main`.
```

### 2.25 Lot 2/4 T5 — Writer `series.official_*` (`lib/sync/writeSeriesOutcome.ts`)

```text
Périmètre : SPEC_TECHNIQUE_SCORING_V0_1.md §12.1/§12.2 (C-2) — UNIQUEMENT
la fonction d'écriture, PAS le reste de T4 (aucune route /api/sync/*, aucun
client Highlightly, aucun cron — ces pièces restent à construire
séparément le jour où la vraie synchro API est câblée).

Fonction fine (un seul UPDATE service_role sur `series.official_status/
official_winner_team_id/official_score_format`), SANS garde de
"changement" — réécrit toujours ce qu'on lui donne (idempotent) ; la
décision d'appeler ou non revient à L'APPELANT (recomputeMatch, lot 3 —
"on ne rejoue pas pour rien", §10.3). Ne re-vérifie PAS is_admin()
elle-même (contexte système, service_role) — c'est la responsabilité de
l'appelant (action admin re-vérifiée AVANT d'appeler, T6a §5.1).

Vérifié : npx tsc --noEmit, npx eslint ., npx next build tous propres.
Test en conditions réelles (service_role, sur une série "sans rôle
particulier" du jeu de test) : écriture des 3 colonnes vérifiée, puis
revert vérifié (état final identique à l'état initial). PAS de test
`vitest` pour ce module (touche une vraie base, pas une fonction pure —
vérifié en conditions réelles comme le reste du projet, pas mockée).

COMMITTÉ et POUSSÉ sur `main`.
```

### 2.26 Lot 3/4 T5 — Orchestration (`lib/scoring/recompute.ts`)

```text
Périmètre : SPEC_TECHNIQUE_SCORING_V0_1.md §10 — recomputeMatch/
recomputeSeries/recomputeBet/recomputeCompetition, adaptateur IMPUR autour
du moteur pur (lot 1) + du writer (lot 2). Contexte système (service_role),
jamais appelée par une action joueur (P2). PAS l'avancement des équipes
vers la série suivante (écrire series.team1_id/team2_id) : donnée
OFFICIELLE réelle, fournie par la synchro T4 (hors périmètre) ou une
résolution admin A2 (lot 4) — jamais dérivée en interne ici.

**vitest.config.ts créé** (alias `@/*` requis pour que les modules
lib/ s'importent entre eux sous vitest comme dans l'app ; alias
`server-only` → module vide, car ce garde-fou choisit son export via la
condition de résolution `react-server` posée par le bundler Next.js,
absente sous vitest — neutralisé UNIQUEMENT pour les tests, intact dans le
vrai build).

**Garde-fou d'orchestration implémenté** (interprétation actée au lot 1,
§2.24) : `recomputeMatch` ne réécrit JAMAIS `series.official_*` si le
statut actuellement stocké est déjà CANCELLED/POSTPONED (posé par un
admin) — appelle directement `recomputeSeries` sur l'état existant dans ce
cas, sans re-dériver.

**Décision d'implémentation** (transaction, §10.3) : la spec demande une
seule transaction Postgres par passe. `supabase-js` (REST, pas de
transaction multi-requêtes côté client) ne le permet pas nativement sans
écrire une fonction RPC dédiée pour CHAQUE recompute — jugé hors périmètre
de ce lot. Accepté comme simplification, compensée par l'IDEMPOTENCE (P5) :
une passe interrompue est rejouable sans risque, le pire cas est un état
transitoirement incomplet entre deux requêtes, jamais un état FAUX ou
doublé.

**Décision d'implémentation** (scored_at) : posé dès qu'AU MOINS une
composante d'un pick de bracket est déterminée (l'affiche peut se scorer
avant le vainqueur, cf. lot 1) — NULL seulement si les 3 composantes
restent en attente. Pas fixé littéralement par la spec, cohérent avec la
convention NULL/0 actée (§12.3).

Vérifié : npx tsc --noEmit, npx eslint ., npx next build, npm test (26/26)
tous propres.

**Test d'intégration en conditions réelles** (fichier JETABLE, supprimé
après vérification — pas un test vitest permanent, car il crée/détruit une
VRAIE compétition ARCHIVED isolée, nécessite service_role) : bracket à 3
séries (2× ROUND_1 alimentant 1× CONF_SEMIS), 2 joueurs de test
(Amine92/Chloe_B réutilisés), 4 matchs joués 4-0. 5 vérifications, TOUTES
PASSENT :
1. recomputeMatch score correctement les pronos de match (10+5 pour un bon
   vainqueur + écart exact, 0 pour un mauvais vainqueur).
2. La série ROUND_1 est correctement dérivée FINISHED/4-0/bon vainqueur,
   ET la cascade vers recomputeSeries score bien les picks de bracket
   (vainqueur 25 pts pour ROUND_1, affiche 0 car ROUND_1 sans matchup).
3. La série CONF_SEMIS avale (paire officielle pas encore connue) laisse
   bien l'affiche EN ATTENTE (NULL), aucun point fantôme.
4. Une fois la paire officielle de la série avale renseignée (simulation
   d'une résolution admin/avancement réel), l'affiche se score
   correctement SANS AUCUN code spécial — confirme littéralement
   l'interprétation actée au lot 1 (affiche indépendante de FINISHED).
5. recomputeBet : WON niveau 4 → 20 pts, LOST → 0.
6. recomputeCompetition rejouée DEUX FOIS de suite sur toute la
   compétition de test → résultat rigoureusement identique (idempotence
   P5, vérifiée en conditions réelles, pas seulement sur le moteur pur).

Compétition de test + toutes ses données enfants supprimées après
vérification (confirmé : 0 ligne restante). Aucune trace laissée.

**LE MOTEUR DE SCORING EST DÉSORMAIS FONCTIONNELLEMENT COMPLET** — reste
uniquement le câblage admin (lot 4/4) pour le rendre utilisable depuis
l'UI (bouton Recalculer, résolution des paris, traitement des requêtes).

COMMITTÉ et POUSSÉ sur `main`.
```

### 2.27 Lot 4a T5 — Bouton « Recalculer » (premier morceau du câblage admin)

```text
Périmètre : SPEC_ECRAN_ADMIN_DASHBOARD_V0_1.md §4/§7 (design cible déjà
figé au lot 1 du lot Admin, §2.20 — enfin codable maintenant que
recomputeCompetition existe, T5 lot 3). Lot 4/4 de T5 scindé en 3
morceaux (bouton, résolution, requêtes) — CE morceau : le bouton seul.

Fichiers : lib/actions/admin.ts (recalculateCompetition — re-vérifie
is_admin() en session, PUIS délègue à recomputeCompetition, PUIS
logAdminAction "RECALCULATE_COMPETITION") ; components/admin/
RecalculateButton.tsx (+ .module.css, SEULE feuille "use client" du
tableau de bord — dialogue de confirmation, MÊME patron que
components/bracket-fill/BracketFillBoard.tsx, déjà le patron cité par la
spec) ; app/(admin)/admin/page.tsx (bouton câblé, désactivé si aucune
compétition active, `.footnote` devenue orpheline retirée du CSS).

Vérifié : npx tsc --noEmit, npx eslint ., npx next build, npm test
(26/26) tous propres.

**Limite de vérification assumée et signalée** (pas de conditions réelles
complètes pour CE morceau précis, contrairement à tous les lots
précédents) : `recalculateCompetition` est appelée par le client (JS,
`startTransition`) et non par un `<form action>` natif — le mécanisme
Next.js sous-jacent (Server Reference résolue via le bundle client) est
plus complexe à rejouer à la main que la technique `$ACTION_ID_` utilisée
jusqu'ici pour les formulaires natifs. La fonction APPELÉE
(`recomputeCompetition`) est déjà prouvée par 5 tests d'intégration réels
(lot 3, §2.26) ; le MÉCANISME d'appel (composant client + `useTransition`
+ appel direct d'une server action) est déjà prouvé ANALOGUE et
fonctionnel dans ce même dépôt (`validateBracket`, Bracket personnel,
§2.16). Seule la COMPOSITION propre à ce lot (is_admin + recherche de la
compétition active + logAdminAction, tous individuellement déjà prouvés
ailleurs) n'a pas été cliquée en vrai. Signalé explicitement plutôt que
prétendu vérifié — à confirmer par l'utilisateur en cliquant lui-même
(`/profile` → « Tableau de bord admin » → bouton « Recalculer » en bas).

**Bug RÉEL trouvé par l'utilisateur en testant** (premier vrai regard
navigateur sur la zone admin — les lots précédents, §2.20-§2.23, n'avaient
été vérifiés que par fetch HTML, jamais visuellement) : `app/(admin)/
admin/layout.module.css` `.shell` ne fixait NI fond NI couleur de texte via
les tokens — retombait sur `--background` de `globals.css` (blanc, sauf
`prefers-color-scheme` OS sombre), rendant le texte clair du thème sombre
de l'app quasi invisible. Corrigé en ajoutant `background: var(--color-
surface-base); color: var(--color-text-primary); font-family: var(--font-
ui);` — EXACT même correctif que `app/(app)/layout.module.css` avait déjà
dû appliquer (commentaire déjà présent là-bas : « quel que soit ce que
définit globals.css par ailleurs »), que je n'avais pas répliqué en créant
la coquille admin (§2.20). Une SEULE coquille partagée par les 4 écrans
admin → corrige les 4 d'un coup. Confirmé lisible par l'utilisateur après
coup, sur les 4 pages.

Bouton Recalculer ET ce correctif : COMMITTÉS et POUSSÉS sur `main`.
```

### 2.28 Lot 4b T5 — File de résolution des paris (`/admin/resolution`)

```text
Périmètre : SPEC_ECRAN_ADMIN_RESOLUTION_V0_1.md (Cadrage/V1/Spec visuelle/,
nouveau fichier, close en séance) — deuxième morceau du câblage admin,
après le bouton Recalculer (lot 4a).

Factorisation faite (annoncée depuis §7 ETAT_ACTUEL, jamais faite avant
faute d'un 4e utilisateur réel) : `lib/scoring/bet-deadline.ts` —
`computeBetDeadlinesPassed`, extrait de la logique dupliquée 3 fois
(`lib/queries/{bets,home,admin-dashboard}.ts`) — ces 3 sites NE SONT PAS
retouchés (code déjà testé/committé, zéro risque pris pour un lot qui n'en
avait pas besoin).

Fichiers : lib/queries/admin-resolution.ts (bets VALIDATED + échéance
dépassée de TOUS les joueurs, enrichi d'un flag `isContested` — requête de
correction PENDING déjà déposée sur ce pari précis) ; lib/actions/
admin-resolution.ts (resolveBet — motif OBLIGATOIRE côté SERVEUR si
contesté, re-garde le statut VALIDATED dans le WHERE, appelle
recomputeBet ENSUITE) ; components/admin/ResolutionBetCard.tsx (+
.module.css, UN SEUL formulaire natif à 2 boutons submit `name="outcome"
value="WON"/"LOST"` — pas 2 formulaires séparés comme la validation,
plus simple ici car le motif est partagé). lib/labels/bets.ts étendu
(`BET_DIFFICULTY_POINTS`, affichage seulement — l'autorité du calcul
reste `scoreBet`). Carte « à résoudre » du tableau de bord rendue `<Link>`
actif.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build, npm test
(26/26) tous propres, aucun conflit de route.

Test en conditions réelles (même technique @supabase/ssr) : 2 paris de
test VALIDATED créés sur une série déjà passée (CLE-ORL, sans toucher aux
pronos/paris réels qui y sont déjà rattachés — nouveaux paris ajoutés,
rien modifié) + 1 requête de correction PENDING sur le second (pour tester
« contesté »). Rendu vérifié (badge Contesté, description, catégorie/
difficulté) ; **cas négatif réel** : tentative de résoudre le pari
contesté SANS motif → refusée côté serveur (« Un motif est obligatoire
pour un pari contesté. ») ; résolution avec motif → acceptée. Résultats en
base 100% corrects : pari normal → WON, points_awarded=20 (barème
difficulté 4, calculé par recomputeBet, pas deviné) ; pari contesté →
LOST, points_awarded=0, resolution_reason enregistré. Données de test +
requête de correction + logs supprimés après vérification, mot de passe
temporaire re-randomisé.

COMMITTÉ et POUSSÉ sur `main`.
```

### 2.29 Lot 4c T5 — File des requêtes de correction (`/admin/requests`) — DERNIER LOT DE T5

```text
Périmètre : SPEC_ECRAN_ADMIN_REQUESTS_V0_1.md (Cadrage/V1/Spec visuelle/,
nouveau fichier, close en séance) — DERNIER morceau du câblage admin
(lot 4c) ET du chantier T5 tout entier. Après le bouton Recalculer (4a) et
la file de résolution (4b).

**Asymétrie RÉELLE trouvée au pré-vol, documentée dans la spec (§0), pas
une invention** : les requêtes MATCH_PREDICTION (migration #7, voie A)
peuvent porter une proposition du joueur (proposed_winner_team_id/
proposed_margin) que l'admin confirme ou ajuste — correction RÉELLE de
contenu. Les requêtes BET (migration #11, « pari oublié ») ne portent
JAMAIS de valeur proposée — la vraie correction est de RÉSOUDRE le pari
(déjà fait ailleurs, /admin/resolution, lot 4b) ; « traiter » une requête
BET ici se contente de marquer is_admin_corrected/corrected_by_admin_id/
correction_reason sur `bets` (marquage public de transparence, 0.2.3 §7,
colonnes symétriques à match_predictions jamais utilisées jusqu'ici) et de
clore la requête — DEUX comportements de traitement bien réels, pas un
oubli de symétrie.

Garde-fous DÉJÀ EN BASE (pré-vol, AUCUNE migration pour ce lot) :
RLS cr_update_admin (admin ≠ requérant, bloque déjà l'auto-traitement au
niveau de correction_requests) ; RLS mp_update_admin + bets_update_admin
(is_admin() peut modifier n'importe quelle ligne) ; trigger
enforce_prediction_correction (T-c, migration #3) — re-vérifie EN BASE
qu'un admin ne corrige jamais son propre prono, INDÉPENDAMMENT de la
garde côté correction_requests.

Fichiers : lib/queries/admin-requests.ts (TOUTES les correction_requests
PENDING, MATCH_PREDICTION et BET dans une seule file — 0.2.7 §6) ;
lib/actions/admin-requests.ts (processCorrectionRequest — branche
MATCH_PREDICTION/BET, recomputeMatch UNIQUEMENT pour MATCH_PREDICTION,
aucun recompute pour BET — rien de scorable n'y change ; rejectCorrection
Request — motif obligatoire, aucune écriture sur la cible) ;
components/admin/RequestCard.tsx (+ .module.css, rendu DIFFÉRENT selon
targetType, 2 formulaires natifs indépendants — Traiter/Refuser — AUCUN
"use client", même un <select> d'équipe fonctionne nativement). Carte
« requêtes » du tableau de bord rendue `<Link>` actif — LES 5 PAGES
FILLES SONT DÉSORMAIS TOUTES CÂBLÉES, page.tsx simplifié (plus aucune
branche « inerte »).

Vérifié : npx tsc --noEmit, npx eslint ., npx next build, npm test
(26/26) tous propres, aucun conflit de route (6 routes /admin/* au total).

**Test en conditions réelles le plus complet de tout le lot Admin** (même
technique @supabase/ssr), 4 scénarios :
1. MATCH_PREDICTION « voie A » (Tariq_M, jamais pronostiqué) avec
   proposition du joueur — traité par Sofia_Admin avec vainqueur+écart
   corrigés → match_predictions bien écrit, is_admin_corrected=true,
   ET recomputeMatch a réellement scoré le prono corrigé
   (is_winner_correct=true, winner_points=10, vérifié en base).
2. **Cas négatif réel, garde-fou EXISTANT (pas codé par ce lot)** :
   Sofia_Admin tente de traiter SA PROPRE requête MATCH_PREDICTION → le
   TRIGGER enforce_prediction_correction (pas la RLS de
   correction_requests, contrairement à l'hypothèse de départ — le
   trigger sur match_predictions a tranché en premier) bloque avec le
   message exact « Un admin ne peut pas corriger son propre prono »,
   remonté tel quel ; le prono de Sofia reste vide, sa requête reste
   PENDING — confirmé en base.
3. BET (Chloe_B, « pari oublié ») traité → bets marqué is_admin_corrected/
   corrected_by_admin_id/correction_reason, statut du PARI inchangé
   (VALIDATED, la résolution reste une action séparée, comme voulu) ;
   requête → PROCESSED.
4. BET (Amine92) refusé avec motif → requête REJECTED, admin_reason
   enregistré, AUCUNE écriture sur le pari (statut/is_admin_corrected
   inchangés) — confirmé en base.
Nettoyage : cycle de FK circulaire rencontré en supprimant les données de
test (match_predictions.correction_request_id ↔ correction_requests.
target_match_prediction_id) — résolu en vidant les FK avant suppression,
pas un bug de l'écran, un artefact du script de nettoyage jetable. Tout
confirmé supprimé après coup, mot de passe temporaire re-randomisé.

**CHANTIER T5 ENTIÈREMENT CLOS** (moteur pur, writer, orchestration,
câblage admin — les 4 lots) **ET LOT ADMIN ENTIÈREMENT CLOS** (6 écrans :
tableau de bord, validation, résolution, requêtes, joueurs, logs).

COMMITTÉ et POUSSÉ sur `main`.
```

### 2.30 Gestion des compétitions — lot 1/3 : création (session du 27/07/2026, suite)

```text
Périmètre : SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md (nouveau fichier, close
en séance) — nouveau chantier, DISTINCT du lot Admin et de T5, ouvert
suite à une question directe de l'utilisateur (« on doit pouvoir switcher
Playoffs/Cup, c'est prévu ? »). `app/(admin)/admin/competitions/{page,
new}.tsx` — CE lot ne couvre QUE la création. Découpé en 3 avec
l'utilisateur : 1. création (CE lot) — 2. saisie manuelle des résultats
(remplace T4 tant qu'elle n'existe pas, dure toute la compétition,
PROCHAIN morceau) — 3. clôture/archivage.

**Trouvaille structurante, changé le cadrage de la conversation** : en
retraçant `decisions_multi_competitions_historique.md`, le plan d'origine
(16/07/2026) visait la NBA Cup EN PREMIER pour la V1 (lancement réel visé
30/10/2026), Playoffs reporté « sans urgence, saison 2027 » — mais le jeu
de données de test créé le 23/07/2026 a silencieusement dérivé vers
Playoffs, jamais recroisé avec cette décision. Le moteur de scoring (T5)
n'a lui jamais dérivé : les deux barèmes sont pleinement codés. Décision
de l'utilisateur suite à cette découverte : laisser le jeu de TEST tel
quel, mais construire l'écran de gestion des compétitions pour être prêt
en vrai le moment venu — d'où ce chantier.

**Trouvaille au pré-vol, avant tout code** : même une fois une compétition
créée, RIEN ne fait aujourd'hui avancer une équipe vers le tour suivant ni
ne pose un résultat officiel — ni T4 (non codée), ni aucune action admin
(le writer `series.official_*` de T5 existe mais aucun écran ne l'appelle
pour un usage normal). C'est ce qui a motivé le lot 2 (saisie manuelle)
comme le morceau le plus important pour le 30 octobre, séparé de celui-ci.

**Décision actée AVEC l'utilisateur** : saisie manuelle des équipes par
l'admin à la création (pas d'attente de T4/du mapping automatique A7).

**2e trouvaille au pré-vol** : AUCUNE policy RLS d'INSERT n'existe sur
`series` (seules `series_select`/`series_update` existent) — la création
du bracket Playoffs (15 lignes) passe donc par `getServiceClient()`
(catégorie B, écriture admin-système, même famille que `recomputeCompetition`
/`writeSeriesOutcome`), après re-vérification explicite de `is_admin()` en
session, PLUTÔT qu'une nouvelle migration RLS pour un cas d'usage rare
(quelques fois par saison). `competitions`/`competition_secrets` restent en
session admin (RLS `competitions_insert`/`secrets_all`, déjà en place).

Fichiers : lib/queries/admin-competitions.ts (compétition active + code de
compétition ; liste des équipes) ; lib/actions/admin-competitions.ts
(`createCompetition` — topologie du bracket Playoffs FIXE et codée en dur,
bottom-up NBA_FINALS→CONF_FINALS→CONF_SEMIS→ROUND_1 pour toujours connaître
l'id de la série aval avant de créer la série amont ; validations
serveur : 16 équipes distinctes, conférences cohérentes par affiche) ;
app/(admin)/admin/competitions/page.tsx (statut + code de compétition,
bouton Clôturer VISIBLE mais DÉSACTIVÉ, lot 3) ; app/(admin)/admin/
competitions/new/page.tsx (formulaire natif, 100% composant serveur — les
2 jeux de champs Playoffs/Cup cohabitent dans UN SEUL formulaire, celui
non pertinent est ignoré côté serveur). Carte « Compétitions » ajoutée au
tableau de bord.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build, npm test
(26/26) tous propres, 24 routes sans conflit.

**Test en conditions réelles avec une précaution particulière** (touche la
VRAIE compétition active utilisée par les amis de l'utilisateur) : cas
négatif testé SANS aucun risque (tentative de création alors qu'une
compétition est déjà active → refusée avec le bon message, rien touché) ;
cas de succès testé en ARCHIVANT TEMPORAIREMENT la vraie compétition
(service_role), créant une compétition de test isolée avec 16 vraies
équipes (8 affiches), vérifiant les 15 séries (8 ROUND_1 remplies +
7 vides des tours suivants, cascade next_series_id/slot correcte,
NBA_FINALS sans next_series_id ni conférence), PUIS supprimant la
compétition de test ET restaurant IMMÉDIATEMENT la vraie compétition en
ACTIVE (bloc try/finally, restauration garantie même en cas d'échec d'une
assertion). Confirmé après coup : compétition réelle intacte (ACTIVE,
mêmes données), `/leaderboard` et `/bracket` répondent normalement, aucune
compétition de test résiduelle.

PAS committé ni déployé à ce stade (à confirmer avec l'utilisateur).
```

### 2.31 Correctif — dialogue de validation Matchs (session du 27/07/2026, suite)

```text
Remonté par l'utilisateur en test réel mobile sur le déploiement Vercel
(écran /play/matches, LAL–HOU) : sélection complète à l'écran (Lakers +
écart 6) mais clic sur « Valider le prono » rejeté avec « Choisis un
vainqueur et un écart avant de valider. ». Diagnostic : le bouton s'active
sur la saisie LOCALE (React state), mais `validateMatchPrediction`
(lib/actions/matches.ts) relit le brouillon PERSISTÉ en base — jamais la
saisie locale. Cliquer « Valider » sans être passé par « Enregistrer le
brouillon » échouait donc systématiquement, alors que l'écran semblait
prêt. Vrai bug, pas une fausse manip.

Correctif décidé avec l'utilisateur (pas de disable supplémentaire sur le
bouton) : `components/matches/PredictionForm.tsx`, dialogue de
confirmation à deux variantes selon que la saisie locale diffère du
brouillon enregistré (`isUnsaved`) — brouillon à jour : dialogue inchangé
(Annuler/Valider) ; brouillon non enregistré : corps de dialogue explicite
+ 3 actions (Retour / Enregistrer le brouillon / Valider définitivement,
qui enregistre puis valide en un seul clic explicite). Spec amendée en
miroir : SPEC_ECRAN_MATCHS_V0_1.md §21.

Vérifié : npx tsc --noEmit, npx eslint, npx next build tous propres.
Action `useTransition` (comme RecalculateButton) : pas rejouable en
headless, test réel laissé à l'utilisateur sur le déploiement.

PAS committé ni déployé à ce stade (à confirmer avec l'utilisateur).
```

### 2.32 Correctif des 12 vulnérabilités npm (session du 27/07/2026, suite — PRIORITÉ 1 de l'ordre de reprise)

```text
Objet : les 12 vulnérabilités `npm audit` trouvées en fin de session
précédente (§2 ci-dessus, `GAPS_OUVERTS.md`) — deux chaînes indépendantes,
`next` figé à 16.2.10 et `eslint` en v9.

`next` 16.2.10 → **16.2.12** (`eslint-config-next` assorti à l'identique,
16.2.12 — convention du projet, même version que `next`) : corrige les 9
CVE directes de Next.js (Middleware/Proxy bypass, DoS/SSRF Server
Actions, SSRF rewrites, disclosure endpoints). Vérifié après coup dans
`npm audit --json` : l'entrée `next` ne référence plus aucune CVE propre,
seulement un héritage transitif via `postcss`/`sharp` (ci-dessous).

`eslint` 9 → 10 **TENTÉ PUIS ABANDONNÉ, trouvaille bloquante** (pas une
simple histoire de règles à réajuster, contrairement à l'hypothèse posée
dans `GAPS_OUVERTS.md`) : `eslint-plugin-react@7.37.5` (embarqué par
`eslint-config-next@16.2.12`, aucune version stable publiée à ce jour ne
déclare de compatibilité eslint 10 dans son `peerDependencies`, vérifié
sur le registre npm) plante avec `TypeError: contextOrFilename.getFilename
is not a function` — API supprimée par ESLint 10, pas contournable par la
config. **Flag explicite fait AVANT de continuer** (AskUserQuestion) :
l'utilisateur a choisi de rester sur eslint 9 plutôt que de casser le lint
en attendant qu'`eslint-config-next` mette à jour ses plugins embarqués.
Point réouvert ci-dessous (`GAPS_OUVERTS.md`) pour reprise quand ce sera
possible en amont.

Les 6 vulnérabilités restantes après le bump `next` seul (toutes dans
l'arbre de dépendances embarqué par `eslint-config-next` — outillage dev,
jamais exécuté en production) tracent TOUTES à un seul nœud :
`brace-expansion <=5.0.7` (DoS, `GHSA-mh99-v99m-4gvg`) remonté via
`minimatch@3.1.5`. Un override direct de `brace-expansion` seul CASSE
`minimatch@3.1.5` (`TypeError: expand is not a function` — `brace-expansion`
5.x a changé la forme de son export, incompatible avec l'API attendue par
les `minimatch` anciens). Corrigé par `overrides` npm ciblant les DEUX
niveaux ensemble (`package.json`) : `minimatch: ^10.2.6` (dernière version,
construite pour la nouvelle forme) + `brace-expansion: ^5.0.8` — cohérent
entre eux, vérifié par relecture des `peerDependencies`/`dependencies`
publiés avant d'appliquer. Overrides ajoutés au passage pour la chaîne
`next`/`postcss`/`sharp`, embarqués par `next` en version FIGÉE dans son
propre `package.json` (pas résolue par le bump de version de `next` seul) :
`postcss: ^8.5.18` (3 CVE : XSS stringify, lecture arbitraire de fichier
via sourceMappingURL, path traversal du même ordre) et `sharp: ^0.35.0`
(CVE libvips héritées).

Résultat final : `npm audit` → **0 vulnérabilité** (contre 12). `npx tsc
--noEmit`, `npx eslint .`, `npm test` (26 tests `vitest`), `npx next build`
tous propres après le dernier `npm install` — 24 routes toujours sans
conflit, aucune régression.

Committé et poussé sur `main` (2 commits : dépendances, puis doc).
```

### 2.33 Gestion des compétitions — lots 2/3 (résultats) ET 3/3 (clôture) CODÉS ET VÉRIFIÉS EN CONDITIONS RÉELLES (session du 27-28/07/2026, suite)

```text
Objet : PRIORITÉ 2 de l'ordre de reprise (§2.32) — le morceau signalé « le
plus important avant le 30/10 » (§2.30). Spec écrite EN SÉANCE (aucune
n'existait, même patron que Bracket personnel), deux points structurants
tranchés AVEC l'utilisateur (AskUserQuestion) AVANT de coder : avancement
AUTOMATIQUE du vainqueur vers le tour suivant (pas de bouton séparé) ; A2
(série annulée/vainqueur désigné à la main sans match) HORS périmètre,
reporté en gap.

**Trouvaille structurante au pré-vol** (documentée
`SPEC_ECRAN_ADMIN_RESULTATS_V0_1.md` §0) : la création d'une compétition
(lot 1) ne crée QUE les 15 lignes `series` — AUCUN `matches`. Ce lot doit
donc aussi permettre de CRÉER les matchs d'une série au fur et à mesure
(1 à 7, jamais connu à l'avance), pas seulement en saisir le score.

**Code (lot 2/3)** : `lib/scoring/advancement.ts` (`advanceWinnerIfDecided`,
NOUVELLE fonction, volontairement SÉPARÉE de `lib/scoring/recompute.ts` —
T5 est VALIDÉ et clos, cette frontière n'est pas rouverte — propage le
vainqueur d'une série `FINISHED` vers `team1_id`/`team2_id` de la série
aval, SEULEMENT si ce slot est encore NULL, non destructif) ;
`lib/queries/admin-results.ts` (lecture groupée par tour, sans la
confidentialité du Bracket joueur — un admin voit tout) ;
`lib/actions/admin-results.ts` (`createMatch` en service_role — AUCUNE
policy RLS `matches_insert` n'existe, même trouvaille que `series` au lot
1 — et `saveMatchResult` en service_role, qui enchaîne UPDATE →
`recomputeMatch` → `advanceWinnerIfDecided`, une seule entrée
`logAdminAction` pour les deux) ; `app/(admin)/admin/competitions/
results/page.tsx` + `components/admin/SeriesResultsCard.tsx` — formulaires
natifs uniquement, aucun `"use client"`.

**Bug trouvé par l'utilisateur en testant, corrigé dans la foulée** : les
champs de score n'avaient qu'un `placeholder` (abréviation d'équipe,
disparaît au clic) comme seule indication, largeur 5 caractères — illisible.
Corrigé : vrai `<label>` visible au-dessus de chaque champ (abréviation
persistante), largeur portée à 3.5rem.

**Débloqué en cours de route : lot 3/3 (clôture/archivage), pas prévu à ce
stade** — l'utilisateur, en testant la création d'une 2e compétition
(avant de brancher T4), a buté sur `uniq_one_active_competition` : sans
clôture, impossible d'en créer une nouvelle. Décidé AVEC l'utilisateur de
construire le lot pour de bon plutôt qu'un contournement jetable. Lecture
actée du « reset » (`decisions_multi_competitions_historique.md` §3, pas
précisée au-delà) : contrairement au prototype (`reset_simulation.sql`),
RIEN n'est supprimé en V1 — chaque ligne reste rattachée à son
`competition_id` pour toujours (nécessaire à un futur historique joueur).
« Reset » = `competitions.status` → `ARCHIVED`, ce qui SEUL libère le slot
de l'index partiel. **Code** : `lib/actions/admin-competitions.ts`
(`closeCompetition`, session admin normale — RLS `archives_insert`/
`competitions_update` déjà ouvertes, AUCUN service_role nécessaire —
snapshot `competition_archives` puis `ARCHIVED`, gardé contre une double
clôture) ; `components/admin/CloseCompetitionButton.tsx` (dialogue de
confirmation, même patron que `RecalculateButton`, action IRRÉVERSIBLE).
**Nouveau module partagé** `lib/scoring/ranking.ts` (`assignRanks`,
extrait de `lib/queries/leaderboard.ts`) : le départage de rang (Total,
bons vainqueurs, écarts exacts, points bracket ; ex-aequo = même rang)
doit produire EXACTEMENT le même résultat au classement live et dans
l'archive figée — `leaderboard.ts` a été migré dessus au passage (aucun
changement de comportement, juste la même règle à un seul endroit).

**Point réel non tranché, remonté par l'utilisateur en testant** (« l'API
peut détecter les matchs Cup automatiquement ? ») : la spec T4 dit
l'API match-centrique, jamais série-centrique (branche B, empiriquement
confirmée) — détecter les matchs de quarts Cup est plausible, mais
construire les 7 séries du mini-bracket à partir de ça n'a jamais été
sondé empiriquement (contrairement à la branche A/B des Playoffs). Reporté
à une fois la clé API Highlightly en main, sur la fenêtre Cup réelle de
décembre 2025 — voir `GAPS_OUVERTS.md`.

**Test en conditions réelles, PAR L'UTILISATEUR lui-même** (pas de session
HTTP rejouée par Claude cette fois — bloqué par le mode auto, changer un
mot de passe de compte de test a été refusé par le classifieur ;
l'utilisateur a testé directement dans son navigateur, connecté en
`Rillettes-31`, 2e compte ADMIN du jeu de données, distinct de
`Sofia_Admin`) : création d'une compétition NBA_CUP bloquée en pratique
(AUCUNE série créée pour ce type, comme documenté §3 de
`SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md` — pas un bug, jamais construit) ;
clôturée puis recréée en PLAYOFFS (« TEST playoff 28/07/2026 », code
`78D0EE7C`) ; série ATL–BOS jouée à 4 matchs réels, ATL gagnant les 4 →
vérifié directement en base par Claude (service_role, lecture seule) :
série passée à `FINISHED`, vainqueur ATL, ET propagé correctement dans
`team1_id` de la bonne série CONF_SEMIS (ES1) — `team2` de cette série
reste NULL, attendu, l'autre série qui l'alimente (BKN–CHA) n'est pas
encore jouée.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npm test` (26 tests),
`npx next build` tous propres après chaque étape (lot 2/3, lot 3/3,
correctif score) — 25 routes (`/admin/competitions/results` nouvelle),
aucun conflit.

Committé et poussé sur `main` (3 commits : lot 2/3, lot 3/3, doc).
Prochaine étape actée AVEC l'utilisateur : T4 (vraie
synchro API Highlightly) — déjà entièrement spécifié et validé le
18/07/2026, aucune réserve ouverte, jamais codé. Remplace « vrai hub
Jouer » comme priorité suivante (`GAPS_OUVERTS.md`). Bloquant : clé API
Highlightly, à obtenir et poser par l'utilisateur directement dans
`.env.local` (jamais dans le chat).
```

### 2.34 T4 — synchro API Highlightly, CODÉE et testée en conditions réelles (session du 28/07/2026)

```text
Clé Highlightly posée par l'utilisateur dans `.env.local`
(`HIGHLIGHTLY_API_KEY`). Avant de coder, l'utilisateur a soulevé un vrai
problème : on est le 28/07/2026, en pleine intersaison NBA, aucun match
réel dans l'horizon "aujourd'hui" pendant plusieurs mois — le pipeline
`schedule`/`results` est pensé `now()`-relatif (§6 de la spec). Décidé
(AskUserQuestion) : les deux routes acceptent un `?date=YYYY-MM-DD`
optionnel (`lib/sync/devDateOverride.ts`), DEV/TEST UNIQUEMENT, jamais
envoyé par le vrai planificateur externe, toujours derrière le Bearer
`SYNC_SECRET`.

**Avant de coder les types du client**, 2 appels réels effectués (`GET
/teams`, `GET /matches?date=2025-06-08&timezone=America/New_York` — vrai
jour de Finals 2025) plutôt que de deviner au-delà de ce que le repérage
§5.1 de la spec avait sondé. Révèle 3 trouvailles non anticipées,
flaguées à l'utilisateur AVANT de coder (AskUserQuestion) :
- `/teams` = tableau nu en racine (pas d'enveloppe `data`, contrairement à
  `/matches`) ;
- `league="NBA"` (53 entrées) mélange les 30 vraies franchises avec des
  entités hors référentiel (équipes All-Star, une internationale, "World")
  — même en filtrant sur "logo présent", 37 passent au lieu de 30 ;
- 6 abréviations Highlightly diffèrent des nôtres déjà committées (NY/GS/
  NO/SA/UTAH/WSH vs NYK/GSW/NOP/SAS/UTA/WAS).
**Décision actée** : table d'alias figée (`lib/nba/teamAliases.ts`,
construite à la main depuis le payload réel) plutôt qu'un filtre
heuristique — `/api/sync/teams` n'écrit donc plus jamais `teams` (nos 30
lignes existantes, câblées aux SVG et à tous les FK de l'app, restent la
source de vérité), seulement `entity_mappings`.

**Avant de coder l'attache match→série**, flagué et tranché AVEC
l'utilisateur : le flux PENDING de 0.2.8 §5 ne peut pas s'appliquer
littéralement (`entity_mappings.internal_id` est `NOT NULL` — un match
jamais vu n'a aucune ligne interne à pointer), et aucun écran de revue de
mapping n'a jamais été spécifié (A7 concerne le pré-remplissage à la
CRÉATION d'une compétition, pas l'attache des matchs individuels
ensuite). L'attache est en réalité déterministe (le bracket est déjà
entièrement construit par l'admin, `team1_id`/`team2_id` toujours connus
avant qu'un match soit joué — une paire d'équipes ne peut être active que
dans UNE série à la fois). Le cas résiduel (0 ou 2+ séries candidates, ne
devrait structurellement jamais arriver) est ignoré + journalisé dans
`sync_logs`, **volontairement passif** (pas de badge d'alerte — confirmé
explicitement avec l'utilisateur) ; rattrapage via le bouton « Ajouter un
match » déjà existant.

**Code** : `lib/nba/client.ts` (C-1, `getTeams`/`getMatchesByDate`/
`sumQuarters`/`normalizeMatchStatus` — ce dernier ne repose que sur
"Finished" comme statut réellement confirmé, les autres sont des
hypothèses de vocabulaire, marquées `recognized:false` si non reconnues) ;
`lib/nba/teamAliases.ts` ; `lib/dates/newyork.ts` (même patron que
`lib/dates/paris.ts`, jour calendaire America/New_York via
`Intl.DateTimeFormat("en-CA", ...)`, nécessaire car `schedule.ts`/
`results.ts` calculaient d'abord la date du jour en UTC — corrigé avant
tout bug réel) ; `lib/sync/{teams,schedule,results,auth,logging,
devDateOverride}.ts` ; `app/api/sync/{teams,schedule,results}/route.ts` +
`app/api/heartbeat/route.ts` (Bearer `SYNC_SECRET`, `sync_logs`, runtime
Node). `results.ts` réutilise le patron déjà établi par
`admin-results.ts::saveMatchResult` : update `matches` → `recomputeMatch`
→ `advanceWinnerIfDecided` (T5 inchangé). Aucune migration (T4 n'en
produit pas, schéma déjà posé par la migration #1).

Vérifié : `tsc --noEmit`, `eslint`, `next build` (4 routes, aucun
conflit), `vitest run` (26/26, aucune régression).

**Test en conditions réelles (dry-run complet)** : la compétition de test
précédente (« TEST playoff 28/07/2026 », ATL-BOS, testée par l'utilisateur
au lot compétitions) a été clôturée POUR DE VRAI (script service_role
reproduisant exactement `closeCompetition()` — même `assignRanks`, même
snapshot `competition_archives` — décidé avec l'utilisateur en l'absence
de session navigateur disponible pour Claude) pour libérer le slot
`uniq_one_active_competition`. Une nouvelle compétition PLAYOFFS créée
(« TEST T4 sync — Playoffs 2026 (réel) ») avec les 8 VRAIES affiches du
1er tour des Playoffs NBA 2026 (Est : NYK-ATL, CLE-TOR, BOS-PHI, DET-ORL ;
Ouest : LAL-HOU, DEN-MIN, OKC-PHX, SAS-POR), trouvées via 2 appels réels
à l'API (dates 2026-04-18/19). Serveur `next start` lancé localement,
routes appelées avec le Bearer `SYNC_SECRET` réel :
- `/api/sync/teams` : 30/30 équipes mappées.
- `/api/sync/schedule?date=2026-04-18` (horizon 4 jours) : **14 matchs
  créés automatiquement** (8 Game 1 + 6 Game 2 tombant dans la fenêtre),
  attachés à la bonne série par la recherche déterministe — 0 ignoré.
- `/api/sync/results` sur les 4 dates concernées : **14/14 scores réels
  synchronisés** (ex. NYK 113-102 ATL, score exact), séries passées à
  `IN_PROGRESS` via `recomputeMatch` (moteur T5 non modifié).
- **Idempotence vérifiée** : rejouer les deux jobs → 0 création/changement
  en trop (juste des mises à jour/inchangés).
- **Cas ignoré passif vérifié en vrai** : un appel hors fenêtre a
  rencontré 2 vrais matchs sans rapport → ignorés proprement, tracés dans
  `sync_logs`, rien cassé.
- Garde d'auth : 401 sans secret / avec mauvais secret, confirmé.
  `/api/heartbeat` : `{"ok":true}`, ping DB, 0 requête API.
- Quota API consommé pendant toute la session (repérage + implémentation
  + dry-run) : environ 20 requêtes sur 100/jour.

Serveur de test arrêté, scripts jetables de mise en place (clôture,
création de la compétition de dry-run, inspection) écrits UNIQUEMENT dans
le scratchpad de session, jamais committés au dépôt.

**Décidé avec l'utilisateur** : la compétition de dry-run reste ACTIVE
(pas archivée) pour qu'il aille la consulter lui-même dans son navigateur
avant qu'on décide de la clôturer. Un appel `schedule` de plus (ancré
2026-04-22) a découvert 12 matchs réels non résolus (Game 2/3/4 de 6
séries) — décalés artificiellement vers "maintenant + 3 jours" (statut
repassé `SCHEDULED`) pour apparaître comme pronostiquables dans Jouer >
Matchs, sans consommer le quota d'une simulation complète (~120-150
requêtes pour tout le tournoi, hors budget). Serveur de test laissé actif
sur le port 3100 pour consultation navigateur.

**2 points trouvés par l'utilisateur en testant la saisie d'un pari sur
cette compétition, TOUS DEUX CORRIGÉS** (détail complet
`JOURNAL_SESSIONS.md`) : `assertNotOwnBet()` bloque désormais un admin qui
tenterait de valider/rejeter son PROPRE pari
(`lib/actions/admin-validation.ts`, par symétrie avec la règle déjà actée
pour les requêtes de correction 0.2.3) ; `<InlineBetForm>` est désormais
rendu même une fois le prono validé (`PredictionForm.tsx`) — plus besoin
de repasser par l'onglet Paris dédié.

**Compétition de dry-run ARCHIVÉE** (script service_role reproduisant
`closeCompetition()`, avec cette fois un vrai snapshot
`competition_archives` — l'activité de test sur les paris avait généré
des scores). Serveur de test arrêté. **Aucune compétition active
actuellement.**

**Suivi mis à jour en miroir** : `SPEC_TECHNIQUE_SYNCHRO_V0.1.md` (4
amendements post-validation §3/§4/§5.2/§6/§12) ; `JOURNAL_SESSIONS.md` ;
les 2 gaps retirés de `GAPS_OUVERTS.md` (résolus).

**Commits `3f228d5` (T4) et `ace0d46` (correctifs) faits ET POUSSÉS sur
`main`.**
```

### 2.35 Vrai hub Jouer (session du 28/07/2026, suite)

```text
Périmètre : SPEC_ECRAN_HUB_JOUER_V0_1.md (nouvelle, rédigée en séance —
0.2.9 §3 posait déjà la règle fonctionnelle non rouvrable : « Jouer = HUB
regroupant Matchs, Bracket, Paris, Mes pronos, avec pastilles "à faire" par
univers », mais aucune spec visuelle n'existait). Remplace ENTIÈREMENT le
hub temporaire (§2.10) — app/(app)/play/page.tsx + page.module.css réécrits.

Layout : grille 2×2 fixe (2 colonnes même en mobile, contrainte demandée) —
Matchs / Mes pronos en haut, Mon bracket / Paris en bas (décidé avec
l'utilisateur). État vide (décidé avec l'utilisateur) : une carte sans rien
à montrer affiche SEULEMENT son titre, jamais de libellé de substitution
type « Rien à faire ».

Contenu par carte (pastille + 0-2 lignes d'aperçu, décidé avec
l'utilisateur) :
- Matchs : pastille = nombre de matchs de la fenêtre 3 jours pas encore
  VALIDATED ; aperçu = le prochain match (équipes + heure).
- Mes pronos : PAS de pastille (écran de consultation) ; aperçu = le
  dernier prono verrouillé et scoré (équipe, écart, gagné/perdu, points).
- Mon bracket : pas de badge séparé (le ratio "X/15" EST la pastille, porté
  par la 1ère ligne) ; 2e ligne = compte à rebours si la deadline est à
  moins de 2 jours.
- Paris : pastille = brouillons + en attente d'admin ; aperçu = décompte
  par catégorie, jamais un total brut.

Code : lib/queries/play-hub.ts (NOUVEAU — lectures LÉGÈRES dédiées par
carte, PAS de réutilisation des requêtes complètes des écrans cibles, sauf
UNE exception assumée : la carte Bracket réutilise directement
getBracketFillData() — dupliquer la dérivation des candidats de tour 2+
pour économiser quelques colonnes aurait été un vrai risque de divergence,
cf. la leçon retenue de SPEC_ECRAN_BRACKET_PERSONNEL_V0_1 §0, pour un gain
de perf négligeable sur une seule compétition de 15 séries) ;
components/play/PlayHubCard.tsx (+ .module.css, carte générique serveur,
badge optionnel + jusqu'à 2 lignes) ; app/(app)/play/page.tsx +
page.module.css réécrits.

Vérifié : npx tsc --noEmit, npx eslint ., npx next build (29 routes, /play
toujours seul, aucun conflit), npx vitest run (26/26, aucune régression).
PAS de test visuel en conditions réelles peuplées cette fois (aucune
compétition active à ce stade, dry-run T4 archivée juste avant) — la
logique de chaque état vide/actionnable a été relue ligne à ligne contre la
spec plutôt que vérifiée à l'écran.

L'utilisateur a annoncé vouloir détailler chaque écran cible un peu plus à
une prochaine session (pas un gap, une suite explicitement annoncée par
lui).

PAS encore committé à ce stade — committé et poussé depuis (`277313e`),
voir §2.36.
```

### 2.36 Centralisation prono/pari — validation synchronisée + paris séries dans Bracket (session du 28/07/2026, suite)

```text
Périmètre : demandé par l'utilisateur en reprenant les gaps ouverts — pas une
correction de bug, une évolution fonctionnelle ("tout centraliser dans
Matchs et Bracket"). Deux points confirmés avec lui avant de coder : pari
SÉRIE inline sur la carte de série dans Bracket (même principe que le pari
MATCH inline dans Matchs, §2.15) ; validation SYNCHRONISÉE prono+pari quand
les deux sont prêts en même temps sur un match (sinon comportement
inchangé). Écran « Nouveau pari » gardé TEL QUEL comme option secondaire —
pas retiré, décision explicite.

**Validation synchronisée (`components/matches/PredictionForm.tsx`)** :
`InlineBetForm` GÉNÉRALISÉ et DÉPLACÉ vers `components/bets/InlineBetForm.tsx`
(scope MATCH/SERIES, `matchId` nullable, `hasBet`/`triggerLabel`/`myBet`
calculés par l'appelant — volontairement DÉCOUPLÉ du contrat figé
`MatchCard.betSlot`, spec Matchs §13). Nouvelles props `hideSubmit`/
`onFieldsChange` : `PredictionForm` maintient un miroir d'état des champs du
pari (`betFields`) et n'affiche qu'UN bouton "Valider" quand prono ET pari
sont prêts ensemble. `handleValidate`/`handleValidateDefinitively`
enchaînent alors `validateMatchPrediction` PUIS `submitBet` — un échec de
soumission du pari APRÈS un prono déjà validé ne masque jamais le succès du
prono (message d'erreur dédié, jamais un rollback silencieux). Dialogue de
confirmation étendu (mention du pari si `betFields` non NULL).

**Paris SÉRIE dans Bracket (`lib/queries/bracket-fill.ts`,
`components/bracket-fill/BracketFillBoard.tsx`)** : `BracketFillSeries`
étendu de `hasBet`/`myBet` (type dédié `MySeriesBet`, même patron que
Matchs sans partager son contrat). `<InlineBetForm scope="SERIES">` posé sur
chaque carte de série SÉLECTIONNABLE, **PLAYOFFS uniquement** — NBA Cup
exclue (une série y est 1 seul match ; `save_bet`, migration #10, refuse
déjà ce scope en Cup, pas la peine d'offrir une action vouée à l'échec).

**Décompte "paris séries restants" (hub Jouer + Accueil)** : nouveau champ
`isBetDeadlinePassed` par série (`bracket-fill.ts`, reproduit
`public.bet_deadline_open(SERIES,...)` — coup d'envoi du 1er match de la
série ; calcul du plus proche coup d'envoi généralisé aux Playoffs, plus
seulement calculé pour l'ordre d'affichage NBA Cup comme avant). Nouvelle
fonction PURE exportée `getRemainingSeriesBets(data)` (séries sélectionnables,
sans pari, deadline pas passée, PLAYOFFS uniquement) — réutilisée par :
- `lib/queries/play-hub.ts` : carte Bracket du hub, ligne "N paris séries
  restants", INDÉPENDANTE de `isActionable` (un pari série reste possible
  même après la deadline du bracket lui-même, pour les tours pas encore
  commencés) ;
- `lib/queries/home.ts` : nouvelle section Accueil **« Paris séries non
  remplis »** (libellé ajusté sur demande explicite après un 1er essai),
  type dédié `SeriesBetTodoItem` (liste chaque série individuellement,
  contrairement à `TodoItem` qui agrège) + nouveau composant
  `components/home/SeriesBetList.tsx`. Section **retirée entièrement**
  quand la liste est vide — jamais un état vide affiché, contrairement aux
  2 sections existantes (« À traiter », « Ça vient de tomber »).

Ancre `#series-<id>` posée sur chaque carte de `BracketFillBoard.tsx` (+
`scroll-margin-top`) pour que chaque lien Accueil→Bracket pointe directement
sur la bonne carte de série.

**Test en conditions réelles** : compétition minimale créée pour l'occasion
(« Test UI Matchs », script jetable service_role — 1 série ROUND_1 LAL-BOS +
1 match dans les heures suivantes). Serveur `next start` relancé après
chaque changement de build (port 3100). **Confirmé fonctionnel par
l'utilisateur lui-même, dans son navigateur** — validation synchronisée,
pari série sur Bracket, décomptes hub/Accueil, tous vérifiés visuellement.

Vérifié à chaque étape : `npx tsc --noEmit`, `npx eslint .`, `npx next build`
(29 routes, aucun conflit), `npx vitest run` (26/26, aucune régression).

**Trouvaille distincte, sans rapport avec ce lot** : `components/home/
TodoRow.module.css` porte une modification non committée déjà présente AVANT
cette session (commentaire vide `/*  */` remplaçant une ligne blanche) —
Claude ne l'a pas produite. Laissée telle quelle (ni committée, ni annulée) —
à statuer avec l'utilisateur.

Compétition de test (« Test UI Matchs ») toujours ACTIVE en base à ce stade
— pas archivée.

PAS encore committé à ce stade — committé et poussé depuis (`b1cd597`),
vérifié en ligne sur Vercel (déploiement de prod déclenché automatiquement
par le push, ● Ready en ~35s).
```

### 2.37 Largeur d'écran resserrée sur desktop (session du 28/07/2026, suite)

```text
Demandé par l'utilisateur : réduire la largeur de l'appli sur desktop, "à
mi-chemin entre mobile et desktop", plutôt que de l'étirer bord à bord.

Nouveau token `--layout-max-width: 640px` (`app/tokens.css`) — sans effet
sur mobile (viewport déjà plus étroit). `body` contraint + centré
(`app/globals.css`, `max-width` + `margin-inline: auto`) : suffit pour tout
le contenu en flux normal (tous les layouts — app/public/admin — en
héritent automatiquement, aucun autre fichier à toucher).

Les barres en `position: fixed` ignorent le max-width du body (elles se
positionnent par rapport au VIEWPORT, pas au flux normal) — alignées une
par une avec le même token, DISTINGUÉES des fonds de dialogue
(`position: fixed; inset: 0` + overlay semi-transparent, laissés intacts,
correctement plein viewport pour un fond de modale) :
- `components/nav/TabBar.module.css` (nav 4 onglets, `inset-inline: 0`) ;
- `components/leaderboard/StickyMeBar.module.css` (barre "toi", `left/right:
  var(--space-4)` — le max-width prime une fois le viewport plus large que
  la colonne, `margin-inline: auto` recentre dans cet espace) ;
- `components/bets/BetForm.module.css` (bandeau collant du formulaire de
  pari, `inset-inline: 0`).

**Remontée immédiate de l'utilisateur en testant (capture d'écran)** : les
bandes latérales de part et d'autre de la colonne centrée étaient dans la
couleur de fond PAR DÉFAUT du navigateur — `<html>` n'avait jamais de fond
posé explicitement (seul `.shell` de chaque layout, contenu DANS le body
désormais rétréci, porte `--color-surface-base`). Corrigé :
`html { background: var(--color-surface-base); }` dans `app/globals.css` —
respecte `data-theme` (attribut posé sur `<html>` par `app/layout.tsx`),
jamais une couleur figée.

Vérifié : `next build` propre à chaque étape. Confirmé visuellement par
l'utilisateur dans son navigateur (serveur `next start` relancé 3 fois, port
3100) — validé "parfait" après le correctif de fond.

**`components/home/TodoRow.module.css`** — modification non committée
PRÉEXISTANTE à cette session (commentaire vide `/*  */` sans aucun effet
visuel/fonctionnel, pas produite par Claude). Reposée à l'utilisateur
(AskUserQuestion) : ANNULÉE (`git checkout`) plutôt que committée à
l'aveugle — recommandation de Claude, suivie telle quelle.

Compétition de test (« Test UI Matchs ») toujours délibérément LAISSÉE
ACTIVE (décision explicite de l'utilisateur, "on laisse pour le moment").

PAS encore committé à ce stade.
```

### 2.38 Audit structurel T1→T8 / D1-D6 (session du 28/07/2026, suite)

```text
Demandé par l'utilisateur avant de continuer à détailler les écrans un par
un : une passe de VÉRIFICATION STRUCTURELLE croisant chaque chantier
technique (T1-T8) et chaque décision structurante (D1-D6) du document maître
(SPEC_TECHNIQUE_V0.1_1.md) avec le VRAI code — pas seulement les docs de
suivi. Lecture seule, aucune modification pendant l'audit lui-même (les
corrections sont un chantier séparé, à trancher avec l'utilisateur).

Méthode : lecture directe du document maître + ETAT_ACTUEL.md +
GAPS_OUVERTS.md par Claude, puis 5 agents lancés EN PARALLÈLE (chacun avec
un périmètre précis, des chemins de fichiers exacts, consigne « lecture
seule, aucune modification ») :
- Agent 1 : T1 (modèle de données) + D2/D5/D6 vs les 12 migrations réelles.
- Agent 2 : T2 (auth) + T3 (RLS) + D4 vs migrations + lib/supabase/ +
  lib/auth/ + proxy.ts.
- Agent 3 : T4 (synchro Highlightly) — chantier prioritaire de l'audit
  (codé le 28/07/2026, jamais encore audité), avec vérification explicite
  des 4 amendements post-validation §3/§4/§5.2/§6 de
  SPEC_TECHNIQUE_SYNCHRO_V0.1.md.
- Agent 4 : T5 (scoring) + D3 (portage, principes P5/P6).
- Agent 5 : T6a/T6b/T6c (architecture Next) + T7 (design system), avec
  consigne explicite de CONFIRMER (pas redécouvrir) que Realtime sur
  `series` jamais activée est bien le seul écart T6c.
T8 (déploiement) et D1 (nouveau dépôt/projet) vérifiés directement par
Claude (pas d'agent) : vercel.json, .vercel/project.json, absence de
.github/workflows, absence de script de nettoyage sous scripts/, grep des
artefacts du prototype (botScripting/simulation_state/is_primary_human)
dans le code réel, git remote + premier commit.

VERDICT GLOBAL : aucune des 6 décisions structurantes D1-D6 n'a été violée
silencieusement. Sur les 8 chantiers T1-T8 : T1, T2, T3, T5, T6b, T6c, T7
CONFIRMÉS COHÉRENTS (T3 et T5 avec des réserves mineures non bloquantes,
détaillées ci-dessous et dans GAPS_OUVERTS.md) ; T4, T6a, T8 avec un écart
réel chacun.

**T1 (modèle de données) — CONFIRMÉ COHÉRENT.** Migration initiale
(20260718090000_initial_schema.sql) = transcription fidèle de
SPEC_TECHNIQUE_MODELE_DONNEES_V0.1.md (17 enums, 16 tables, mêmes FK
composites, mêmes CHECK >=0, mêmes vues security_invoker). Les 11 migrations
suivantes n'étendent jamais le schéma T1 de façon contradictoire.

**T2 (auth) — CONFIRMÉ COHÉRENT.** Flux d'inscription en 3 temps
(verify_join_code → unicité pseudo → signUp), pont École A
(handle_new_user), séparation des clients (browser/server/service),
proxy.ts — tout conforme ligne à ligne à SPEC_TECHNIQUE_AUTH_V0.1.md.

**T3 (RLS) — CONFIRMÉ COHÉRENT, réserve mineure.** 15 tables couvertes,
fonctions SECURITY DEFINER (is_admin/is_active/match_is_locked/
has_committed_prediction/bracket_deadline_passed/bet_is_public) et policy
match_predictions_select identiques à SPEC_TECHNIQUE_RLS_V0.1.md. Réserve :
les fonctions SECURITY DEFINER ajoutées après le 18/07/2026
(count_committed_predictions, request_prediction_correction, save_bet/
withdraw_bet, request_bet_correction) ne sont pas rétro-actées dans la spec
T3 (qui s'arrête à son §11 du 23/07) — chacune documente pourtant son motif
dans sa propre migration. Écart de PROCESS de cadrage, pas de sécurité (voir
GAPS_OUVERTS.md).

**T4 (synchro Highlightly) — ÉCART.** Globalement fidèle : timezone
America/New_York sur les appels datés, date API jamais reconverti, somme du
tableau par quart-temps, C-1 (lib/nba/client.ts seul fichier connaissant
Highlightly) et C-2 (lib/sync/* seul écrivain teams/series/matches/
entity_mappings, jamais une prédiction) respectés, secret Bearer vérifié sur
les 4 routes, verrouillage piloté par l'heure connue. Les 4 amendements
§3/§4/§5.2/§6 de SPEC_TECHNIQUE_SYNCHRO_V0.1.md sont bien codés — SAUF un
point précis de l'amendement §3 : `normalizeMatchStatus()`
(lib/nba/client.ts:106) promet qu'un statut Highlightly non reconnu remonte
`recognized: false` pour être journalisé dans sync_logs ; en réalité ce
booléen n'est JAMAIS consommé (lib/sync/schedule.ts:110,
lib/sync/results.ts:82 ne lisent que `.status`), et aucune route ne
journalise ce cas. Un statut imprévu de l'API basculerait donc
silencieusement en IN_PROGRESS sans trace — ÉCART SILENCIEUX, priorité la
plus haute de cet audit (voir GAPS_OUVERTS.md). Point mineur additionnel,
hors des 4 amendements : pas d'avertissement journalisé sur quota API bas
(`requestsRemaining` jamais comparé à un seuil).

**T5 (scoring) — CONFIRMÉ COHÉRENT, 2 réserves mineures.** Moteur pur
(lib/scoring/engine.ts) sans I/O, barèmes MATCH/BRACKET Playoffs+Cup/PARIS
conformes chiffre pour chiffre à SPEC_TECHNIQUE_SCORING_V0_1.md,
neutralisation A2 nativement gérée par les branches NULL, orchestration
(recompute.ts) avec les 4 fonctions attendues. Réserves : (1) le garde-fou
« respecte un CANCELLED/POSTPONED déjà posé » vit dans l'orchestration
(recompute.ts:136-143, ADMIN_LOCKED_STATUSES) et non dans la fonction pure
deriveSeriesOutcome comme la lettre du §4 le suggère — documenté en
commentaire dans le code, pas un oubli ; (2) les cas 28-32 du plan de test
§11 (idempotence/orchestration en base, dont la vérification transverse P6)
n'existent dans aucune suite vitest permanente — vérifiés une seule fois via
un test jetable supprimé après coup (voir GAPS_OUVERTS.md).

**D3 (portage, P5/P6) — CONFIRMÉ COHÉRENT.** P5 (idempotence) garanti
doublement : colonnes `points_awarded` en `generated always as (...) stored`
en base + recompute.ts qui ne fait que des UPDATE réécrivant toutes les
colonnes de scoring (jamais d'incrément). P6 (jamais négatif) garanti
doublement : logique du moteur structurellement incapable de produire une
valeur négative + CHECK >=0 en base sur toutes les colonnes de points.

**T6a (arbre app/, route groups) — ÉCART.** Tout l'arbre prescrit par
SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md est en place (routes physiques
uniques /leaderboard et /bracket, proxy.ts, frontière service_role confinée
à lib/sync|scoring|actions), SAUF `app/(public)/reset-password/page.tsx`
(ligne 177 de la spec, « reset Supabase standard (T2 §8) ») qui n'existe
pas — aucun lien « mot de passe oublié » sur /login. Jamais tracé avant cet
audit (voir GAPS_OUVERTS.md).

**T6b (server actions + garde C2) — CONFIRMÉ COHÉRENT.**
useUnsavedGuard.tsx (beforeunload + interception onNavigate + agrégation
multi-clés), policy bracket corrigée (plus de `not is_validated`),
audit_logs bien appelés par les actions admin — tout conforme.

**T6c (Realtime + rendu des états) — CONFIRMÉ COHÉRENT, confirmation
explicite obtenue.** Grep exhaustif des 12 migrations : un seul hit
`supabase_realtime` (20260724110000_realtime_matches.sql, sur `matches`
uniquement) — Realtime sur `series` jamais activée EST bien le SEUL écart
T6c, comme déjà su. Toutes les autres règles de rendu d'état vérifiées et
codées : paris annulés barrés/grisés (MyBetRow.module.css), joueurs absents
comptés (RevealPanel des 2 écrans), marquage public de correction admin
(générique sur Matchs, nominatif sur Mes pronos — divergence déjà connue,
voir GAPS_OUVERTS.md), joueur inactif conservé au classement
(lib/queries/leaderboard.ts, isInactive jamais utilisé pour filtrer).

**T7 (design system) — CONFIRMÉ COHÉRENT.** app/tokens.css fidèle à
SPEC_DESIGN_SYSTEM_V0_1.md §3/§5/§15 (amendement V0.2 inclus). Les 3 points
déjà connus et non bloquants (contraste AA --color-trend sur fond clair,
police Inter auto-hébergée, asset hero-parquet.webp) confirmés toujours dans
le même état — pas de nouveauté.

**T8 (déploiement) — vérifié directement par Claude, PARTIEL confirmé.**
Projet Vercel bien lié (.vercel/project.json) et déployé. Aucun
planificateur externe configuré (pas de .github/workflows, pas de clé
`crons` dans vercel.json), aucun script de nettoyage du jeu de test
(scripts/ ne contient que le seed). Point nouveau : aucun fichier
SPEC_TECHNIQUE_DEPLOIEMENT_V0.1.md n'a jamais été écrit, alors que le
document maître (§4) en prévoit un dédié pour T8 comme pour T1-T7 — le
déficit de ce chantier n'est donc pas que d'implémentation.

**D1 (nouveau dépôt/projet Supabase) — CONFIRMÉ COHÉRENT.** git remote
distinct (lenoirmath122-dev/nba-pronos), premier commit du 18/07/2026,
aucun artefact du prototype (botScripting/simulation_state/
is_primary_human) dans le code réel — ces termes n'apparaissent que dans
Cadrage/ (références historiques attendues, pas du code).

**D2 (rétention, pas de suppression) — CONFIRMÉ COHÉRENT.** competition_id
NOT NULL structurel sur series/brackets. Recherche exhaustive de
DELETE/DROP/TRUNCATE sur tout le repo (hors node_modules/.next) : zéro
résultat sur le domaine métier. closeCompetition
(lib/actions/admin-competitions.ts:204-272) fait bien un snapshot dans
competition_archives puis une bascule de statut, jamais un effacement.

**D4 (security_invoker vues classement) — CONFIRMÉ COHÉRENT.** Le passage
en security_invoker=false (migration #5, 23/07/2026) est réellement
documenté en §11 de SPEC_TECHNIQUE_RLS_V0.1.md comme correctif
post-validation (jamais appliqué en silence), et les deux vues ne renvoient
que des agrégats — aucune fuite de ligne individuelle.

**D5 (aucune colonne email sur public.users) — CONFIRMÉ COHÉRENT** sur les
12 migrations.

**D6 (NBA Cup, synchro connaît seulement les 8 qualifiés) — principe
respecté, réserve déjà connue.** Aucune synchro n'ingère de phase de
groupes (lib/sync/schedule.ts ne fait que rattacher des matchs à des séries
DÉJÀ existantes). Mais la moitié « saisie manuelle des 8 qualifiés via
l'écran de création » n'est pas codée (createCompetition ne construit un
bracket que pour PLAYOFFS) — déjà tracké comme gap ouvert (mini-bracket NBA
Cup), pas un écart caché.

LISTE PRIORISÉE DES 7 ÉCARTS TROUVÉS (détail complet, avec fichier:ligne,
dans GAPS_OUVERTS.md nouvelle section dédiée) :
1. T4 — `recognized: false` jamais consommé ni journalisé (silencieux,
   priorité la plus haute).
2. T6a — `app/(public)/reset-password/page.tsx` manquant, jamais tracé.
3. T5 — trou de couverture vitest sur l'idempotence/orchestration en base.
4. T8 — aucune spec SPEC_TECHNIQUE_DEPLOIEMENT_V0.1.md n'a jamais existé.
5. T3 — fonctions SECURITY DEFINER post-18/07 non rétro-documentées.
6. T5 — garde CANCELLED/POSTPONED dans l'orchestration plutôt que la
   fonction pure (documenté en commentaire, pas silencieux).
7. T4 — pas d'avertissement sur quota API bas (mineur, hors amendements).

Aucune modification de fichier de code pendant cet audit. Résolution des 7
points : à trancher avec l'utilisateur (ordre, périmètre de chacun — voir
GAPS_OUVERTS.md).
```

### 2.39 Résolution de 5 des 7 écarts de l'audit (session du 28/07/2026, suite)

```text
Demande de l'utilisateur juste après l'audit (§2.38) : « on commence à
résoudre ces points si ça te paraît cohérent ». Vu l'hétérogénéité des 7
points (correctif d'une ligne vs script à écrire vs spec entière à
rédiger), découpage proposé et confirmé par l'utilisateur (AskUserQuestion)
avant de coder : les 4 correctifs sûrs d'abord, reset-password (T6a) et la
spec T8 ensuite (chacun touchant une vraie décision — config Supabase Auth,
rédaction d'un document dédié).

**T4 — `recognized` propagé jusqu'à `sync_logs`** (le plus prioritaire,
écart silencieux) : `lib/sync/schedule.ts` et `lib/sync/results.ts`
collectent désormais chaque statut Highlightly non reconnu
(`UnrecognizedStatus[]`, nouveau champ `unrecognizedStatuses` sur
`SyncScheduleResult`/`SyncResultsResult`) ; `app/api/sync/schedule/route.ts`
et `app/api/sync/results/route.ts` les ajoutent au `summary` écrit dans
`sync_logs` (« Statuts Highlightly non reconnus (retombés sur
IN_PROGRESS) : #123 ("texte inconnu"); ... »). Un statut imprévu de l'API
laisse désormais une trace exploitable, plus jamais silencieux.

**T4 — avertissement quota API bas** (mineur, hors des 4 amendements déjà
actés) : `lib/sync/logging.ts` (`writeSyncLog`, seul point d'écriture
partagé par les 4 routes de synchro) compare désormais
`requestsRemaining` à un seuil (`LOW_QUOTA_THRESHOLD = 10`, 10% du quota
journalier de 100 — la spec ne chiffre pas « proche de 0 », seuil choisi et
documenté en commentaire, pas un choix produit) : sous ce seuil, un
avertissement est préfixé au `summary` ET journalisé via `console.warn`.

**T5 — `lib/scoring/recompute.test.ts` écrit** (trou de couverture des cas
28-32 du plan §11, dont P6) : contre une FAKE Supabase en mémoire
(`FakeBuilder`/`FakeSupabase`, colocalisées dans le fichier de test —
reproduisent uniquement le sous-ensemble .from/.select/.update/.eq/.in/
.single/.maybeSingle réellement utilisé par `recompute.ts` et
`writeSeriesOutcome.ts`, mockée via `vi.mock("@/lib/supabase/service")`),
JAMAIS une vraie instance Supabase. Horloge figée (`vi.useFakeTimers()`)
pour comparer deux passes successives sans faux-positif sur `scored_at`.
11 nouveaux tests : idempotence de `recomputeMatch` (pronos seuls, puis
série complétée + bracket picks), garde CANCELLED (cas 5 du plan §11,
annoncé par le commentaire d'`engine.test.ts` mais jamais écrit avant ce
jour), idempotence de `recomputeBet` (WON/LOST/CANCELLED/VALIDATED),
idempotence de `recomputeCompetition` (rejeu intégral + vérification
transverse P6 sur tout l'état final), idempotence de `recomputeSeries`
appelée seule. 37/37 tests au total (26 existants + 11 nouveaux),
`tsc`/`eslint`/`next build` tous propres après coup.

**T3 — fonctions SECURITY DEFINER rétro-actées** (écart de PROCESS de
cadrage, pas de sécurité) : nouveau §12 dans `SPEC_TECHNIQUE_RLS_V0.1.md`
(« Correctif post-audit — fonctions SECURITY DEFINER ajoutées après T3,
rétro-actées ») listant les 4 fonctions ajoutées après le 18/07
(`count_committed_predictions`, `request_prediction_correction`, `save_bet`/
`withdraw_bet`, `request_bet_correction`), chacune avec sa migration et son
motif — sans toucher au code (aucune de ces fonctions n'élargissait une
visibilité, juste jamais actée formellement dans la spec).

**T5 — garde CANCELLED/POSTPONED rétro-actée** (lettre de la spec vs
emplacement réel du code) : nouveau §13 dans
`SPEC_TECHNIQUE_SCORING_V0_1.md` clarifiant que `deriveSeriesOutcome` (§3,
signature `(matches, competitionType)`) ne peut structurellement PAS
« respecter » un statut existant (elle ne le reçoit jamais) — le garde-fou
vit dans `recomputeMatch` (`ADMIN_LOCKED_STATUSES`), qui court-circuite
l'appel à `deriveSeriesOutcome` avant même qu'elle soit invoquée. Décision :
pas un bug, l'emplacement réel est le seul cohérent avec C-3 (moteur pur
sans connaissance de l'état persisté) — le §4 décrit l'intention produit, le
§13 fait foi pour l'implémentation. Testé explicitement dans le nouveau
`recompute.test.ts` (cas 5).

**GAPS_OUVERTS.md mis à jour** : les 5 bullets résolus retirés (convention
du fichier : un point retiré = un point traité, la trace vit ici et dans
JOURNAL_SESSIONS.md) ; ne restent que T6a (reset-password) et T8 (spec
déploiement jamais écrite), chacun explicitement noté comme nécessitant une
décision avant de coder plutôt qu'un simple correctif.

Vérifié après CHAQUE étape (pas seulement à la fin) : `npx tsc --noEmit`,
`npx eslint .` (0 warning), `npx vitest run` (37/37), `npx next build` (29
routes, aucun conflit) — tous propres. Aucune migration, aucun changement de
schéma. PAS ENCORE COMMITTÉ à ce stade.
```

### 2.40 T6a — écran reset-password (session du 28/07/2026, suite)

```text
Dernier des 2 écarts nécessitant une décision avant de coder (l'autre, T8,
reporté en session dédiée). Périmètre : SPEC_TECHNIQUE_AUTH_V0.1.md §8
(« Reset password : flux Supabase standard par email... Écrans en T6 ») +
l'unique route prescrite par SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md §3
(`app/(public)/reset-password/page.tsx`).

**Choix de conception (interprétation d'implémentation, pas un choix
produit — la spec ne détaille pas le mécanisme)** : UNE seule route gère les
2 étapes (demande d'email, puis choix du nouveau mot de passe), distinguées
par la présence ou non d'une session de récupération détectée côté client —
jamais par un paramètre d'URL lu à la main. Mécanisme : le lien reçu par
email dépose un jeton dans le FRAGMENT d'URL (`#access_token=...&type=
recovery`), que `getBrowserClient()` (`lib/supabase/browser.ts`,
`createBrowserClient` de `@supabase/ssr`, session en cookie) détecte
automatiquement au chargement et persiste en cookie — c'est l'événement
`onAuthStateChange` `PASSWORD_RECOVERY` qui fait basculer l'écran, jamais un
`?code=` lu côté serveur. Conséquence : AUCUNE route supplémentaire
(`/auth/confirm` ou équivalent) n'était nécessaire — le fragment n'atteint
jamais le serveur, tout se résout côté navigateur, cohérent avec l'unique
route prescrite par l'arbre T6a.

**Écriture 100% côté client, PAS de server action** (à la différence de
login/signup/logout, `lib/auth/actions.ts`) : demande
(`resetPasswordForEmail`) et confirmation (`updateUser({password})`) sont 2
appels directs au SDK Supabase depuis `ResetPasswordForm.tsx` — aucune
donnée applicative à nous à valider avant (pas de code compétition, pas de
pseudo), contrairement à signup. Message de la demande volontairement
GÉNÉRIQUE que l'email corresponde ou non à un compte (D5 : l'email reste un
identifiant privé, cet écran ne doit jamais confirmer/infirmer l'existence
d'un compte). Après confirmation réussie : déconnexion puis redirection
`/login?resetSuccess=1` (bandeau de courtoisie affiché par `LoginForm.tsx`,
lu via `useSyncExternalStore` plutôt qu'un `useEffect` + `setState` — évite
la nouvelle règle ESLint `react-hooks/set-state-in-effect`, découverte en
codant ce lot, qui bloquait le build sur ce point précis).

**Fichiers** : `components/auth/ResetPasswordForm.tsx` (nouveau, "use
client") ; `app/(public)/reset-password/page.tsx` (nouveau, serveur, calque
de `login/page.tsx`) ; `components/auth/LoginForm.tsx` (lien « Mot de passe
oublié ? » + bandeau de succès). Aucune migration, aucun changement de
schéma, aucune modification de `proxy.ts` (`/reset-password` n'était déjà ni
dans `APP_ZONE_PREFIXES` ni dans `AUTH_PAGES` — un visiteur avec une session
de récupération n'est donc jamais rebondi vers `/home` en arrivant dessus,
vérifié par lecture du fichier avant de coder, pas supposé).

**Testé en conditions réelles** : serveur `next start` (port 3101, 3100
déjà occupé par un reliquat d'une session précédente), `/reset-password`
répond 200 avec le bon titre et l'état « Chargement… » attendu au tout
premier rendu serveur (avant hydratation) ; lien « Mot de passe oublié ? »
confirmé présent dans le HTML de `/login` ; `/leaderboard`, `/bracket`,
`/home` (redirection 307 attendue), `/signup` non régressés. Appel réel
`resetPasswordForEmail()` exécuté contre le VRAI projet Supabase (script
jetable, supprimé après coup) : **rejeté pour un email de seed**
(`seed-amine92@nba-pronos.test`, `400 — invalid email`, TLD `.test` non
accepté par le validateur Supabase — trouvaille distincte, tracée dans
GAPS_OUVERTS.md, sans rapport avec le code de ce lot) puis **accepté sans
erreur** pour l'email personnel de l'utilisateur (redirectTo déjà autorisé
côté dashboard Supabase, aucune erreur de quota rencontrée cette fois) — un
vrai email de réinitialisation a donc été envoyé à cette adresse ; à
l'utilisateur de confirmer la réception et de dérouler le clic jusqu'au bout
si un test manuel complet au clavier/souris est voulu (hors de portée d'un
script jetable, pas de navigateur disponible dans cet environnement).

Vérifié : `npx tsc --noEmit`, `npx eslint .` (0 warning après le correctif
`useSyncExternalStore`), `npx vitest run` (37/37, aucune régression), `npx
next build` (30 routes, `/reset-password` listée, aucun conflit). PAS
ENCORE COMMITTÉ à ce stade.
```

### 2.41 T8 — spec Déploiement rédigée, planificateur + nettoyage codés (session du 28/07/2026, suite)

```text
Dernier écart de l'audit (§2.38). Contrairement à T1-T7, la spec T8 n'avait
jamais été écrite alors que le déploiement Vercel était déjà partiellement
fait (§2.17, 27/07/2026) — brouillon rédigé par Claude (ce qui est déjà
fait + points de décision), 3 décisions tranchées AVEC l'utilisateur
(AskUserQuestion) avant tout code, comme pour chaque autre chantier T :
1. Planificateur externe : **GitHub Actions** (pas cron-job.org) — reste
   dans le dépôt, pas de tiers de confiance en plus pour SYNC_SECRET.
2. Fréquence de `/api/sync/results` : **fixe toute l'année** (pas de plage
   bornée aux horaires plausibles de matchs) — plus simple, quota large.
3. Nettoyage des données de test : **même lot** que le reste de T8, pas une
   session séparée.

`Cadrage/V1/SPEC_TECHNIQUE_DEPLOIEMENT_V0.1.md` (nouveau) : documente ce qui
était déjà fait (Vercel lié, 4 des 5 secrets poussés), les 4 routes à
appeler et leurs fréquences (T4/doc maître §2 A8), les 3 décisions
ci-dessus tranchées, et un inventaire des secrets. Statut VALIDÉ.

**Trouvaille concrète en vérifiant l'état réel de Vercel avant d'écrire la
spec** (`npx vercel env ls`) : `HIGHLIGHTLY_API_KEY` (ajoutée en local avec
T4 le 28/07) N'EST PAS poussée sur Vercel — les 4 variables du déploiement
initial (27/07) y sont, celle-ci jamais répercutée depuis. Conséquence
concrète : `/api/sync/schedule`/`results` échoueraient en production
aujourd'hui. Signalé à l'utilisateur avec la commande exacte à taper
lui-même (`vercel env add`, jamais la valeur collée dans le chat).

**4 workflows GitHub Actions** (`.github/workflows/`) :
- `sync-teams.yml` : AUCUN `schedule` — `workflow_dispatch` seul (référentiel
  fixe, jamais planifié, T4 §4).
- `sync-schedule.yml` : `0 8 * * *` (1x/jour) + `workflow_dispatch`.
- `sync-results.yml` : `*/30 * * * *` (fréquence fixe, décision ci-dessus) +
  `workflow_dispatch`.
- `heartbeat.yml` : `0 6 * * *` (1x/jour) + `workflow_dispatch`. Limite
  connue documentée en tête de fichier : GitHub désactive un workflow
  planifié après 60 jours SANS commit sur le dépôt — un creux de saison NBA
  peut dépasser ce délai, le heartbeat s'arrêterait alors silencieusement.
  Pas de parade automatisée à ce stade, juste documentée.

Chacun appelle sa route via `curl --fail` (échec bruyant, visible dans
l'onglet Actions) avec `Authorization: Bearer ${{ secrets.SYNC_SECRET }}` —
`SYNC_SECRET` doit être ajouté comme secret GitHub par l'utilisateur (pas
encore fait à ce stade), sans quoi les 4 workflows échoueraient tous en 401
à leur premier déclenchement.

**`scripts/cleanup-test-data.mjs`** (nouveau, symétrique du seed) :
dry-run PAR DÉFAUT (n'affiche que ce qui serait supprimé), `--confirm`
requis pour exécuter réellement. Périmètre EXPLICITE (jamais un motif large
`.test`, qui attraperait `demo-amis@nba-pronos.test` à tort) : compétitions
« Playoffs NBA (test) » ET « Test UI Matchs » (cette 2e trouvée en écrivant
le script, pas anticipée à la rédaction de la spec — même famille
d'artefact, ajoutée à la liste) ; les 7 comptes `seed-*@nba-pronos.test`
(via `auth.admin.deleteUser`, jamais un DELETE SQL direct). EXCLU
délibérément : `demo-amis@nba-pronos.test` (compte encore utilisé par les
amis de l'utilisateur) et le compte réel (Rillettes-31).

Ordre de suppression respecte les FK réelles du schéma T1 (pas de cascade
sauf `competition_secrets`/`public.users`, vérifiées dans les migrations
avant d'écrire le script, pas supposées) : casse la FK circulaire
`correction_requests` ↔ `match_predictions`/`bets` en premier (met
`correction_request_id` à NULL), puis feuilles vers racines par
compétition, comptes en tout dernier (`auth.admin.deleteUser` cascade vers
`public.users`, D5).

**Bug trouvé et corrigé EN TESTANT** (pas en relisant le code) : mauvaise
destructuration du retour de la fonction `ok()` (`const { data: X } =
ok(...)` alors que `ok()` retourne `data` directement, pas `{data}`) — le
tout premier dry-run affichait "2 compétitions trouvées" dans son propre
log de lecture puis "Aucune compétition trouvée" juste après, contradiction
qui a permis de repérer le bug immédiatement. Corrigé sur les 5 points
concernés, revérifié.

**Dry-run testé contre la vraie base** (28/07/2026) : 2 compétitions de test
trouvées avec des décomptes cohérents avec ce qui est déjà documenté
ailleurs (9 matchs / 15 séries / 45 picks / 6 paris / 11 pronos pour
« Playoffs NBA (test) » ; 1 match / 1 série / 1 pick pour « Test UI
Matchs ») ; 7 comptes de seed retrouvés par pseudo avec leurs vrais UUID.
**PAS ENCORE EXÉCUTÉ EN VRAI** (`--confirm` jamais passé) — décision
d'exécution réelle laissée à l'utilisateur.

Vérifié : `npx tsc --noEmit`, `npx eslint .` (0 warning) — les fichiers
`.mjs`/`.yml` de ce lot ne sont pas dans le périmètre TypeScript/Next mais
n'introduisent aucune régression sur le reste. Aucune migration, aucun
changement de schéma. PAS ENCORE COMMITTÉ à ce stade.
```

### 2.43 Révélation publique des paris + contestation d'un pari refusé/résolu (session du 28/07/2026, suite)

```text
2 points du backlog "confort/reporté" (recensé en fin d'audit), demandés par
l'utilisateur pour être traités maintenant plutôt que plus tard.

**Lot 1 — Révélation publique des paris des autres joueurs (0.2.4 §9)**

Décision produit confirmée par l'utilisateur, AVANT de coder : réutiliser le
patron déjà en place (RevealPanel), mais sous forme d'un déclencheur
cliquable dédié « Voir les paris des autres joueurs » ouvrant une POPUP à 2
colonnes (Joueur / Pari) — pas une extension du RevealPanel des pronos
existant, un composant séparé.

**Raffinement décidé par Claude en cours de route, signalé ici plutôt que
silencieux** : la proposition initiale citait « Matchs et Mes pronos »
(les 2 écrans qui ont déjà un RevealPanel) comme candidats. En regardant le
calcul réel de `bet_is_public()` (VALIDATED/WON/LOST + deadline passée),
l'écran Matchs ne montre QUE des matchs à venir (`scheduled_at > now()`) —
un pari MATCH n'y est donc JAMAIS public (sa deadline = le coup d'envoi de
CE match précis, toujours futur sur cet écran). Implémenté UNIQUEMENT sur
Mes pronos (matchs verrouillés, `scheduled_at <= now()`), le seul endroit où
la donnée peut réellement exister.

Code : `lib/queries/my-predictions.ts` — nouveau type `OtherBet` ; requête
`bets` du match SANS filtre `user_id` (RLS `bet_is_public()` fait déjà le tri
— mon pari + les paris publics des autres, jamais un pari privé d'un autre,
C-6) ; `getSeriesBetHeader` étendue de la même façon (2e requête série,
propre lookup de pseudos). `components/my-predictions/OtherBetsModal.tsx`
(nouveau, "use client", SEULE feuille client de ce lot) : même patron de
dialogue que `components/admin/RecalculateButton.tsx` (backdrop + div
role="dialog"), adapté en lecture seule. Câblé dans `MatchRowStatic.tsx`
(paris MATCH) et `SeriesBetHeader.tsx` (paris SERIES).

Testé en conditions réelles (pas de compétition active à ce stade — jeu de
données jetable créé et détruit par script, 2 vrais comptes, vraie session
signInWithPassword du joueur A, PAS service_role) : le pari MATCH et le pari
SERIES du joueur B remontent bien pour le joueur A via la requête exacte
utilisée par le code (RLS confirmée, pas supposée).

**Lot 2 — Contester un pari REFUSÉ ou déjà résolu (0.2.7 §6)**

Trouvaille en relisant le cadrage AVANT de coder : 0.2.7 §6 dit "correction
possible même après le match" et "1 requête = 1 prono/pari sur 1 match ou
1 série", sans exclure aucun statut — l'exclusion de REJECTED/WON/LOST
(migration #11) était un raccourci TECHNIQUE pris en codant, jamais une
décision produit. Confirmé avec l'utilisateur : l'admin tranche directement
dans `/admin/requests`, pas de détour par `/admin/resolution` pour ce cas.

Migration #13 (`20260728120000_contest_resolved_bet.sql`), poussée
(`npx supabase db push`) : (1) `enforce_bet_transitions` — nouvelle branche
autorisant REJECTED/WON/LOST → VALIDATED/WON/LOST/REJECTED, UNIQUEMENT si
`correction_request_id` + `corrected_by_admin_id` (≠ auteur du pari) sont
renseignés dans le même UPDATE — même garde que `enforce_prediction_
correction` (T-c) pour les pronos, transposée dans ce trigger plutôt qu'un
trigger séparé ; (2) `request_bet_correction` élargie à REJECTED/WON/LOST
(pas seulement VALIDATED), contrôle "cible terminée" retiré pour REJECTED
(le grief porte sur le refus lui-même, pas sur une résolution).

Code : `lib/queries/admin-requests.ts` (+ `status`/`validated_difficulty`/
`proposed_difficulty` du pari) ; `lib/actions/admin-requests.ts`
(`processCorrectionRequest` — nouveaux `newBetStatus`/`newBetDifficulty`
optionnels ; si fournis, UN SEUL update pose statut + difficulté + champs de
correction, PUIS `recomputeBet` — sinon comportement de la migration #11
INCHANGÉ, toujours réservé à VALIDATED jamais résolu) ; `components/admin/
RequestCard.tsx` (`BetFields` — 2 rendus selon `currentStatus` : VALIDATED
= UI d'origine inchangée ; REJECTED/WON/LOST = sélecteur du nouveau statut,
+ sélecteur de difficulté SI `validated_difficulty` est NULL — un pari
refusé avant toute validation n'en a jamais eu, pré-rempli sur
`proposedDifficulty`, même patron que `MatchPredictionFields`).

Testé en conditions réelles (2 scripts jetables successifs, données créées
et détruites) : (a) `request_bet_correction()` sur un pari REJECTED réussit
en vraie session joueur ; (b) 2e appel immédiat bloqué (requête déjà
PENDING) ; (c) garde admin≠auteur vérifiée EN PREMIER (avant toute
correction réussie, pour ne pas fausser le test) : un `corrected_by_admin_id`
égal à l'auteur du pari est bien rejeté, pari inchangé ; (d) un VRAI second
compte admin, en vraie session, transitionne REJECTED → VALIDATED avec la
bonne difficulté ; (e) test e2e séparé (vitest, DB réelle, `recomputeBet`
réel importé — pas mocké) : REJECTED → WON avec difficulté 4 produit bien
`points_awarded = 20` (barème `BET_DIFFICULTY_POINTS`), `scored_at` posé.
2 bugs de script jetable trouvés et corrigés EN COURS DE TEST (mauvaise
destructuration du retour service-role, ordre de nettoyage FK circulaire
`bets.correction_request_id`/`correction_requests.target_bet_id`) — aucun
des deux n'était un bug du code produit, uniquement des scripts de
vérification eux-mêmes.

Vérifié : `npx tsc --noEmit`, `npx eslint .` (0 warning), `npx vitest run`
(37/37, aucune régression), `npx next build` (30 routes, aucun conflit).
Migration #13 poussée sur la vraie base. Code applicatif committé (`dc1e991`)
et poussé — déploiement Vercel revérifié sans régression après coup
(`/login`, `/leaderboard`, `/admin/requests` répondent 200/307 comme
attendu).
```

### 2.42 Commit/push du lot audit + les 3 actions externes T8 (session du 28/07/2026, fin)

```text
Commit unique (`9caee5f`, 20 fichiers) regroupant tout le lot de la session :
audit structurel (§2.38), 5 correctifs (§2.39), écran reset-password (§2.40),
spec + code T8 (§2.41) — `Cadrage/nba-pronos.lnk` (raccourci Windows
accidentel, déjà exclu par le passé) laissé hors du commit. Poussé sur
`main`. Déploiement Vercel automatique déclenché par le push, vérifié en
ligne sans régression (`/reset-password` 200, `/login` avec le lien reset,
`/home` 307, `/leaderboard`/`/bracket`/`/signup` 200).

**Les 3 actions externes de T8, faites par l'utilisateur lui-même dans son
terminal/les dashboards, une à une** :
1. `HIGHLIGHTLY_API_KEY` poussée sur Vercel (production, preview,
   development) — la valeur est apparue EN CLAIR dans le terminal au moment
   de l'ajout "development" (contrairement à production/preview, marquées
   "Sensitive"), donc visible dans l'historique de cette session. Signalé à
   l'utilisateur (même famille que les 2 incidents précédents sur ce
   projet) ; décision explicite de l'utilisateur : PAS de régénération de
   la clé cette fois (« on zappe »).
2. `SYNC_SECRET` ajouté comme secret GitHub Actions (Settings → Secrets and
   variables → Actions). Guidé pas à pas (l'utilisateur n'avait jamais fait
   ça). **2 échecs successifs, diagnostiqués en conditions réelles avant de
   deviner** : le 1er run manuel (`sync-teams.yml`) a échoué ; l'appel exact
   du workflow rejoué depuis un terminal local avec la vraie valeur de
   `.env.local` a RÉUSSI (200, 30 équipes) — ce qui a immédiatement écarté
   Vercel/HIGHLIGHTLY_API_KEY et pointé vers le secret GitHub lui-même.
   2e essai : `curl: (43) Failed sending HTTP request` — signature connue
   d'un header HTTP contenant un retour à la ligne (le secret collé avec un
   `\n` de fin). Cause réelle, confirmée après coup par l'utilisateur : la
   toute première tentative avait collé le CONTENU ENTIER de `.env.local`
   au lieu de la seule valeur de `SYNC_SECRET`. Corrigé (sélection précise
   Maj+Fin dans l'éditeur, sans le saut de ligne) — reconfirmé vert. Les 4
   workflows partagent le même secret GitHub : corrigé une fois, corrigé
   pour les 4.
3. `scripts/cleanup-test-data.mjs --confirm` exécuté POUR DE VRAI par
   l'utilisateur (dry-run déjà vérifié en §2.41). Résultat vérifié
   directement en base par Claude après coup (script jetable, lecture
   seule, supprimé après) plutôt que de se fier à la description du script :
   « Playoffs NBA (test) » et « Test UI Matchs » bien absentes ;
   `Demo_Amis`/`Rillettes-31` intacts, comme prévu ; les 7 comptes de seed
   absents.

**Trouvaille en vérifiant le résultat du nettoyage** : 3 compétitions
ARCHIVÉES restent en base, jamais documentées dans aucun fichier de suivi
avant ce jour et donc jamais dans le périmètre du script — « TEST NBA CUP »,
« TEST playoff 28/07/2026 », « TEST T4 sync — Playoffs 2026 (réel) »,
laissant 30 matchs/30 séries/15 picks de bracket/2 pronos/1 pari en base
(status ARCHIVED, aucun impact sur le jeu réel — une seule compétition
ACTIVE possible à la fois, contrainte DB). Signalé explicitement à
l'utilisateur plutôt que nettoyé en silence ou re-signalé comme un gap.
**Décision explicite de l'utilisateur : gardées comme historique de test.**
`GAPS_OUVERTS.md` mis à jour en conséquence (nouvelle entrée dédiée, pas un
gap à rouvrir).

**Le chantier T8 est désormais réellement opérationnel** (pas seulement
codé) : les 4 workflows GitHub Actions peuvent authentifier leurs appels,
les 5 secrets sont alignés partout (local/Vercel/GitHub), et la base ne
porte plus que des données réelles + les 3 archives de test conservées à
dessein.

Aucun changement de code dans ce lot (uniquement des actions
config/exécution + vérifications en lecture seule). Rien à committer côté
code — le commit `9caee5f` couvrait déjà tout le code produit cette
session.
```

### 2.44 T6c — Realtime sur `series` (session du 29/07/2026)

```text
Dernier écart connu de T6c (§14.2, GAPS_OUVERTS.md) : la publication
Realtime n'incluait que `matches` (migration #8) — `series` restait
délibérément non publiée, faute d'écran qui en avait besoin. L'écran
Bracket (vue globale, /bracket) a désormais ce besoin : refléter un
official_winner_team_id qui change SANS reload, dans le résumé (NodeCard)
ET le drill-down (SeriesGroups reste, lui, non-live — cf. §14.1, seul le
résultat officiel de la série est concerné, jamais les picks des joueurs).

**Point structurant flagué et tranché AVEC l'utilisateur avant de coder**
(AskUserQuestion) : résoudre un UPDATE brut Realtime (id + 
official_winner_team_id) en abréviation d'équipe demande l'id de chaque
équipe — que `BracketNode`/`BracketData` (contrat FIGÉ, spec écran §15.2)
ne portent jamais (seulement l'abréviation). Choix retenu : une fonction
SÉPARÉE, `getSeriesLiveSeed(competitionId)` (lib/queries/bracket.ts),
qui refait une petite requête series+teams (≤ 15 lignes) dédiée au seed du
live — `getBracket()`/`BracketNode`/`BracketData` restent EXACTEMENT comme
figés par la spec, aucune extension du contrat. Cohérent avec T6c §2.3, qui
anticipait déjà un type `SeriesLive` séparé du contrat de lecture SSR.

Fichiers :
- `supabase/migrations/20260729090000_realtime_series.sql` (migration #14) :
  `alter publication supabase_realtime add table series;` — RLS déjà
  `using (true)` (`series_select`), aucune policy touchée.
- `lib/queries/bracket.ts` : type `SeriesLiveSeed` + `getSeriesLiveSeed()`.
- `components/bracket/LiveSeriesSubscriber.tsx` (NOUVEAU, seul fichier
  `"use client"` de ce lot) : Provider + hook `useLiveWinnerAbbreviation()`,
  même patron que `components/my-predictions/LiveSubscriber.tsx` (Provider +
  consommateur dans le même fichier, seed = état SSR, aucun
  `revalidatePath`). Souscription UPDATE sur `series` sans filtre serveur
  (résolution en mémoire via le seed, même choix que LiveSubscriber pour
  `matches`).
- `components/bracket/NodeCard.tsx` : lit le contexte via
  `useLiveWinnerAbbreviation(node.nodeId, node.actualWinnerAbbreviation)` —
  AUCUNE directive `"use client"` propre ajoutée : NodeCard n'est jamais
  importé que sous un ancêtre client (`SeriesDrillDown`), même mécanisme
  déjà établi pour MarginStepper/RevealPanel (§2.8) et TeamLogo (§2.11).
- `components/bracket/BracketSummary.tsx` : monte `<LiveSeriesSubscriber>`
  en enveloppe (nouvelle prop `liveSeed`), autour de `TreeView` ET
  `SeriesDrillDown` — une seule frontière live pour tout l'écran.
- `app/bracket/page.tsx` : appelle `getSeriesLiveSeed(data.competitionId)`
  quand la structure est connue, la passe à `BracketSummary`.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` tous propres,
aucun conflit de route (`/bracket` inchangé dans la carte des routes).

**Test en conditions réelles (migration poussée + bout-en-bout)** :
`npx supabase db push` (dry-run puis réel) — seule cette migration en
attente, appliquée sans erreur. Aucune compétition ACTIVE en base au moment
du test (les 3 restantes sont ARCHIVED depuis le nettoyage T8, §2.42) :
flagué à l'utilisateur avant d'agir, qui a choisi de réactiver
TEMPORAIREMENT « TEST T4 sync — Playoffs 2026 (réel) » pour un test réel
plutôt que de se contenter du niveau code. Script jetable (client ANON,
comme un vrai visiteur non connecté — RLS `series_select using(true)`) :
souscription Realtime ouverte, écriture `official_winner_team_id` via
service_role pendant que la souscription écoute, payload reçu côté client
avec la bonne valeur en moins d'une seconde. **Confirme la publication
migration #14 de bout en bout**, indépendamment du rendu visuel (pas de
navigateur disponible dans cet environnement pour driver /bracket
lui-même). État restauré immédiatement après (official_winner_team_id
remis à `null`, compétition remise en `ARCHIVED`) — vérifié après coup,
script de vérification/restauration supprimé, rien laissé en base.

Non couvert par ce lot, hors périmètre décidé avec l'utilisateur (§14.1,
non rouvert) : `match_predictions`/`brackets`/`bracket_picks` restent NON
publiées — la révélation des pronos d'autrui et les mouvements de
classement suivent toujours le rythme SSR, jamais le live.
```

### 2.45 4 points UI mineurs (session du 29/07/2026, suite)

```text
Demandé par l'utilisateur après un état des lieux général (GAPS_OUVERTS.md +
BACKLOG_V1.md) : nettoyer 4 points UI ouverts depuis plusieurs sessions,
chacun confirmé/tranché AVEC l'utilisateur avant de coder (AskUserQuestion),
pas de choix silencieux.

**1. Tailles de logo entre écrans.** Constat élargi en creusant : les tokens
`--logo-size-sm/md/lg` (24/32/48px, SPEC_DESIGN_SYSTEM_V0_1.md §10.2)
n'avaient JAMAIS été créés en CSS — chaque écran passait une valeur littérale
en dur, la plupart ne correspondant à AUCUN palier (NodeCard=18, MatchRowStatic/
BetForm=20, Profil=28). `GAPS_OUVERTS.md` affirmait même à tort que NodeCard
était "tier lg" (48) alors que le code portait 18 — écart doc↔code, pas
juste une taille à harmoniser. Corrigé : les 3 tokens créés dans
`app/tokens.css` ; NodeCard/MatchRowStatic/BetForm/Profil passés à `sm`=24px
(les 4 qui ne respectaient aucun palier) ; TeamPicker (Matchs, lg=48) et
BracketFillBoard (md=32) inchangés, déjà conformes.

**2. Aspect ratio inégal des 30 logos — ÉVALUÉ, LAISSÉ TEL QUEL.** Écart réel
(SAS ≈2:1 large, LAL quasi carré → SAS parait plus petit/fin dans sa pastille
avec `object-fit: contain`). Testé visuellement AVANT de choisir : un harnais
HTML autonome (les vraies pastilles/SVG, Playwright headless — aucune donnée
de test n'affiche SAS/LAL en ce moment, donc pas testable dans l'app réelle)
comparant `contain` (actuel) vs `cover` (variante candidate). Capture
concluante : `cover` uniformise bien la taille mais **coupe visiblement le
texte du wordmark** sur tous les logos larges (« SAN ANTONIO SPURS » →
« AN ANTONI »/« PUF », idem LAL/ORL/NOP/HOU). Remède pire que le problème.
Décision explicite de l'utilisateur : ne rien changer, documenter la
conclusion plutôt que laisser le gap ouvert comme si rien n'avait été
essayé.

**3. Badge de correction de Matchs harmonisé sur le rendu nominatif de Mes
pronos.** Correctif post-validation confirmé AVEC l'utilisateur avant de
coder : `OtherPrediction.isAdminCorrected: boolean` (lib/queries/matches.ts,
contrat figé SPEC_ECRAN_MATCHS_V0_1.md §13) remplacé par
`adminCorrection: AdminCorrection | null`, même type que Mes pronos. Pour
éviter un import circulaire (`my-predictions.ts` importe déjà `TeamRef`
depuis `matches.ts`), le type + la fonction `toAdminCorrection()` ont été
extraits dans un nouveau fichier partagé `lib/queries/adminCorrection.ts`,
importé par les deux modules. `components/matches/RevealPanel.tsx` rend
désormais « Saisi par X à la demande de Y — motif », identique à Mes pronos.
Vérifié : `tsc`/`eslint`/`next build` propres. Pas testé en conditions
réelles (contrairement aux autres lots) : une correction admin ne peut
exister que sur un match déjà VERROUILLÉ, or Matchs ne montre que des
matchs À VENIR (fenêtre 3 jours, `scheduled_at > now()`) — les deux
conditions semblent structurellement ne jamais pouvoir se rencontrer, donc
ce badge n'a probablement jamais eu l'occasion de s'afficher, avant comme
après ce correctif. Non creusé plus loin (hors périmètre de ce lot).

**4. Bandeau parquet (§15.7) câblé sur les 9 écrans joueur.** Portée et
thème clair tranchés AVEC l'utilisateur : le thème clair n'était en réalité
PAS un vrai gap (§15.7 l'avait déjà tranché — bande toujours sombre, les
deux thèmes, texte figé en clair) ; la portée, elle, a été confirmée écran
par écran : Accueil, Classement, Bracket, Matchs, Mes pronos, Nouveau pari,
Bracket personnel, Mes paris, Profil — PAS admin/login/signup. En creusant
le câblage, constat supplémentaire flagué avant de coder : 4 de ces 9 écrans
(Matchs, Mes pronos, Nouveau pari, Bracket personnel) n'avaient AUCUN titre
de page — l'utilisateur a confirmé vouloir leur en créer un minimal
(« Matchs », « Mes pronos », « Nouveau pari », « Mon bracket ») en plus du
câblage du bandeau.

Implémentation : classes GLOBALES (pas des CSS Modules) `.hero-banner`/
`.hero-banner-title`/`.hero-banner-subtitle` dans `app/globals.css` — un
choix délibéré pour que « une seule variable à éditer » (`--hero-image`,
déjà acté §15.7) reste vrai pour les 9 écrans en même temps, plutôt que 9
copies de traitement CSS. Mécanique en 2 pseudo-éléments (`::before` porte
l'image + le filtre assombri/désaturé, `::after` porte le voile dégradé) :
le filtre ne s'applique jamais au texte réel, qui reste un enfant DOM
normal. Nouveau token `--color-hero-text` (`app/tokens.css`, constante hors
thème) ; `color`/`text-shadow` en `!important` sur `.hero-banner-title/
-subtitle` — nécessaire car l'ordre de bundling entre ce fichier global et
les CSS Modules de chaque écran n'est pas garanti, et cette couleur figée
doit TOUJOURS l'emporter sur le token de couleur propre à l'écran. Chaque
écran garde SA PROPRE classe `.header` (mise en page : flex/gap/
justify-content, ex. Bracket a un `ProgressBar` à côté du titre) — composée
avec `.hero-banner`, qui reste purement visuel.

Accueil (`HomeHeader.tsx`) : cas particulier, la carte de rang/points
existante n'a pas de titre séparé du corps. Bandeau appliqué seulement au
bloc salutation+compétition (nouveau conteneur `.greetingBlock`, bleed hors
du padding de la carte avec coins arrondis alignés sur le haut) — le bloc
stats/forme en dessous garde son fond de carte normal, pas de bandeau sur
TOUTE la carte.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx next build` tous propres,
aucun conflit de route. Mécanique CSS vérifiée visuellement (harnais
Playwright, image placeholder générée localement — layering
image/dégradé/texte, lisibilité, coins arrondis Accueil, tous confirmés).
**Point bloquant restant** : `public/brand/hero-parquet.webp` n'a toujours
pas été déposé par l'utilisateur (demandé explicitement en cours de lot) —
tant que le fichier est absent, le token pointe vers un asset inexistant
(aucune erreur de build, juste pas d'image visible à l'écran). Pas de test
en conditions réelles avec la vraie photo, à refaire dès qu'elle est
déposée.

Aucune migration, aucun changement de schéma. Committé (`ef5b305`) et poussé,
déployé sans régression (`tsc`/`eslint`/`next build` propres avant push ;
build Vercel confirmé `Ready` via `vercel ls`, `/leaderboard`/`/bracket`/
`/login`/`/signup` revérifiés 200 en prod).

**Correctif immédiat (même session)** : l'utilisateur a remarqué que le
bandeau n'apparaissait que quand une compétition existe — Classement,
Bracket, Accueil et Mes paris masquaient le bandeau dans leur état vide
(« Aucune compétition en cours »), contrairement aux 4 écrans qui l'avaient
déjà (Matchs, Mes pronos, Nouveau pari, Bracket personnel). Corrigé : un
bandeau titre-seul (sans sous-titre de compétition, qui n'existe pas dans ce
cas) ajouté aux 4 états vides concernés. Accueil : `HomeHeader` (carte
personnalisée rang/points) reste inchangé, remplacé par un bandeau générique
« Accueil » seulement dans l'état vide (pas de pseudo/points disponibles
sans compétition, contrat `HomeData` non touché). Bracket : n'avait jamais
son propre `page.module.css` (dépendait entièrement de `BracketSummary`) —
créé pour porter `.header`/`.title`. `tsc`/`eslint`/`next build` propres,
committé et poussé dans la foulée.

**Asset réel déposé (même session)** : `public/brand/hero-parquet.jpg`
fourni par l'utilisateur — format réel `.jpg`, pas `.webp` comme le nom du
token l'anticipait (fichier initialement nommé `images.jpg`, renommé).
`--hero-image` (`app/tokens.css`) et `public/brand/README.md` ajustés pour
suivre le fichier réel plutôt que l'inverse. Rendu vérifié visuellement
(harnais Playwright, cette fois avec le vrai fichier) : image + voile
dégradé + texte lisibles, registre arène/broadcast conforme à l'intention
§15.7. `tsc`/`eslint`/`next build` propres. **Dernier point bloquant du lot
levé.**

**Point focal réajusté (retour utilisateur, même session)** : le cadrage
`background-position: center` montrait surtout le ballon en gros plan —
recentré en `center 75%` pour montrer le parquet + la ligne de terrain,
réglage réévalué visuellement (harnais Playwright, plusieurs valeurs
comparées : 65/75/85 %/bottom) avant de choisir. `--hero-image` reste la
SEULE variable propre à l'asset (§15.7) ; le point focal, lui, est une
propriété de mise en page globale (`.hero-banner::before`), pas du token.

**10ᵉ écran oublié du périmètre initial : le hub Jouer** (`app/(app)/play/
page.tsx`, remonté par l'utilisateur) — la liste des 9 écrans convenue avec
lui en début de lot omettait ce hub (grille 2×2 Matchs/Mes pronos/Mon
bracket/Paris, §2.35). Nouveau titre « Jouer » + bandeau ajoutés, même
patron que les 4 écrans qui n'avaient aucun titre (nouvelles classes
`.header`/`.title` dans `app/(app)/play/page.module.css`, qui n'en avait pas
non plus). Cet écran ne dépend d'aucune compétition pour son rendu (chaque
carte gère son propre état interne) : pas de branche vide séparée à traiter,
contrairement à Accueil/Classement/Bracket/Mes paris. `tsc`/`eslint`/
`next build` propres.
```

### 2.46 Rappels ciblés — canal Push (session du 29/07/2026, suite)

```text
Premier point du BACKLOG (« Rappels ciblés », marqué PRIORITÉ par
l'utilisateur) : « tu n'as pas encore pronostiqué le match de ce soir »,
« la deadline du bracket approche ». AUCUNE spec n'existait — canal,
modèle de données et déclencheurs tranchés AVEC l'utilisateur avant de
coder (AskUserQuestion), même patron que les lots jamais spécifiés
(Bracket personnel, §7 `GAPS_OUVERTS.md`).

**Canal retenu** : Push d'abord, Email plus tard (bloqué sur un nom de
domaine vérifié pour un SMTP personnalisé — gap « Confirm email »). Le
modèle de préférence couvre déjà les DEUX canaux pour ne pas le refaire :
`users.notification_preference` (enum `NONE`/`PUSH`/`EMAIL`, migration #15,
`20260729100000_push_notifications.sql`) — `EMAIL` reste sélectionnable
dans l'UI mais désactivé (« bientôt disponible »).

**Infra Web Push (nouvelle, aucune existante avant ce lot)** :
- Migration #15 : `push_subscriptions` (un joueur, plusieurs appareils —
  RLS self-only, select/insert/delete) ; `reminder_log` (déduplication —
  UNIQUE (user_id, kind, ref_id), RLS active SANS AUCUNE policy : verrouillée
  par défaut, seul service_role y accède, aucun écran ne doit la lire).
- Paire de clés VAPID générée localement (`web-push.generateVAPIDKeys()`),
  écrites directement dans `.env.local` (jamais affichées en clair dans le
  chat, même précaution que SYNC_SECRET) : `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  (exposée au client, sans risque) et `VAPID_PRIVATE_KEY` (serveur
  uniquement).
- `public/sw.js` (NOUVEAU, JS brut hors bundling Next.js — contrainte de la
  Push API, un service worker doit être un fichier statique à URL fixe) :
  affiche la notification à la réception, ouvre/focus l'app au clic.
- `components/profile/NotificationSettings.tsx` (NOUVEAU, SEUL fichier
  client de l'écran Profil jusqu'ici — la permission navigateur +
  l'abonnement Push ne sont atteignables qu'en JS client, contrairement au
  reste de l'écran, formulaires natifs) : 3 radios Aucun/Push/Email,
  demande de permission → enregistrement du service worker → abonnement →
  sauvegarde côté serveur, tout enchaîné avant d'écrire la préférence.
- `lib/actions/notifications.ts` (NOUVEAU) : 3 actions qui RENVOIENT un
  résultat typé au lieu de rediriger (contrairement à
  `lib/actions/profile.ts`) — appelées programmatiquement depuis le
  composant client, pas via un simple `<form action>`.
- `lib/push/send.ts` (NOUVEAU, `import "server-only"` — même garde que
  `getServiceClient()`, `VAPID_PRIVATE_KEY` ne doit jamais atteindre le
  navigateur) : enveloppe `web-push`, renvoie les abonnements MORTS
  (404/410, expirés côté navigateur) à nettoyer par l'appelant.

**Déclencheurs** (2 routes `/api/reminders/*`, même garde d'authentification
Bearer `SYNC_SECRET` que `/api/sync/*` — réutilisée telle quelle, pas de
nouveau secret) :
- `lib/reminders/matchesReminder.ts` : matchs dont le coup d'envoi tombe
  dans les 4 prochaines heures (fenêtre choisie, non fixée par le backlog —
  « le QUOI, pas le QUAND », en-tête `BACKLOG_V1.md`), joueurs `ACTIVE` en
  préférence `PUSH` sans prono committé sur ce match, dédoublonné par
  `reminder_log` (kind `MATCH_TONIGHT`, ref = match_id).
- `lib/reminders/bracketReminder.ts` : compétitions `ACTIVE` dont
  `bracket_deadline` tombe dans les 24 prochaines heures (fenêtre choisie),
  joueurs `ACTIVE` en préférence `PUSH` dont le bracket n'est pas complet
  (même règle de complétude que `getBracketTodo`, `lib/queries/home.ts`),
  dédoublonné par `reminder_log` (kind `BRACKET_DEADLINE`, ref =
  competition_id).
- `.github/workflows/reminder-matches.yml` (toutes les heures) et
  `reminder-bracket.yml` (toutes les 6h) — même patron que les workflows
  `sync-*.yml` existants, réutilisent le secret GitHub `SYNC_SECRET` déjà en
  place (aucun secret à ajouter).

**Vérifié** : `npx tsc --noEmit`, `npx eslint .`, `npx next build` tous
propres, aucun conflit de route (2 nouvelles routes `/api/reminders/*`).

**Test de bout en bout, en conditions RÉELLES** (`next start` en local,
port 3100 — pas de navigateur disponible dans cet environnement, conduit
via un harnais Playwright avec un VRAI navigateur Chromium, contexte
PERSISTANT et non incognito — Chrome désactive délibérément la Push API en
navigation privée, https://crbug.com/41124656, trouvé en cours de route) :
- Compte de test jetable créé via l'API Admin (`auth.admin.createUser` +
  `user_metadata.pseudo`, seule voie propre, §2.6), connexion réelle via le
  vrai formulaire de login (clic + saisie, pas un replay de POST cette
  fois — Playwright pilote un vrai navigateur).
- Activation Push : permission accordée, service worker enregistré, VRAI
  abonnement FCM créé (`https://jmt17.google.com/fcm/send/...`), sauvegardé
  en base, `notification_preference` passé à `PUSH` — confirmé par requête
  directe en base après coup.
- Envoi réel testé séparément (script jetable, `web-push.sendNotification`
  directement contre l'abonnement FCM créé) : **accepté par FCM (201)** —
  preuve que les clés VAPID et le format du payload sont corrects de bout
  en bout, indépendamment de l'UI.
- Désactivation testée : abonnement supprimé côté navigateur ET en base,
  `notification_preference` repassé à `NONE` — confirmé par un RELOAD
  complet de la page (rendu SSR, pas l'état client transitoire) montrant
  bien le radio « Aucun » correctement coché.
- Les 2 routes `/api/reminders/*` exécutées contre la vraie base (garde
  d'authentification vérifiée : 401 sans secret/mauvais secret, 200 avec le
  bon) — 0 notification envoyée à ce test précis (aucun joueur réel n'a
  encore la préférence PUSH, normal).
- Compte de test + ses données (abonnement, éventuelles lignes
  `reminder_log`) supprimés après coup via l'API Admin, scripts de
  vérification jetables supprimés.

Migration #15 poussée sur la vraie base. Paquets ajoutés : `web-push`,
`@types/web-push` (dev). **Committé (`b7061ae`) et poussé**, déployé.
L'utilisateur a ajouté `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`
sur Vercel (Production + Preview ; Development impossible pour la clé
privée — Vercel interdit `Sensitive` + `Development` ensemble, sans
conséquence puisque le dev local lit `.env.local` directement).

**Hors périmètre de ce lot, à reprendre plus tard** : canal Email (bloqué
sur un domaine vérifié) ; contenu/horaires des 2 fenêtres de rappel
(4h/24h) sont des choix d'implémentation, pas produit — à ajuster si
l'usage montre qu'il faut un délai différent.
```

### 2.47 Rappels ciblés — validation en conditions RÉELLES + 3 correctifs (session du 29/07/2026, fin de journée)

```text
Demandé par l'utilisateur juste après le déploiement : « on peut tester
rapidement les notifs ? ». Test mené sur le VRAI compte de l'utilisateur
(`Rillettes-31`), PC (Chrome/Windows) ET iPhone (Safari) — pas un compte de
test jetable cette fois, la démo réelle. A trouvé 3 bugs réels, chacun
corrigé et revérifié en conditions réelles avant de passer au suivant.

**1. Réglage Windows.** Premier envoi (`web-push` direct, script jetable)
accepté par FCM (201) mais rien reçu sur PC. Cause : notifications Chrome
désactivées au niveau de Windows lui-même (Paramètres → Système →
Notifications), pas un problème du code. Une fois réactivé côté
utilisateur, la notif est arrivée (deux fois — les 2 abonnements PC
existants, un résidu du test précédent avec un compte jetable, voir
§2.46).

**2. iPhone — restriction Apple, pas un bug.** Confirmé que le téléphone
est un iPhone : sur iOS, AUCUN navigateur (Chrome inclus, qui utilise le
moteur WebKit d'Apple) ne peut recevoir de notifications web dans un onglet
classique — seule une app ajoutée à l'écran d'accueil via Safari le peut
(restriction plateforme, actée depuis iOS 16.4). Ajouté pour rendre ça
possible :
- `app/manifest.ts` (convention Next.js, auto-lié) : nom, icônes, 
  `display: "standalone"` — nécessaire pour qu'iOS reconnaisse l'app comme
  installable avec le plein support notifications.
- `app/apple-icon.png` + `public/icons/icon-{192,512}.png` : icône
  PLACEHOLDER générée (monogramme "NP", tokens `--color-accent`/fond arène)
  via un script jetable (`sharp`) — à remplacer par un vrai logo si besoin,
  aucun impact fonctionnel.
- Committé (`d712012`) et poussé.
- Premier essai de l'utilisateur toujours sans effet : il avait ajouté
  l'icône à l'écran d'accueil AVANT que le manifest existe — Safari n'avait
  donc pas pu reconnaître le mode standalone à ce moment-là. Correction :
  supprimer l'ancienne icône, refaire "Sur l'écran d'accueil" une fois le
  manifest en place. Reste alors introuvable un 2e problème, structurel
  celui-là (point 3 ci-dessous).

**3. Bug réel — multi-appareils sur le même compte.** `notification_
preference` est un champ du COMPTE, pas de l'appareil. Le compte de
l'utilisateur étant déjà en `PUSH` (activé depuis le PC), le radio "Push"
s'affichait déjà coché sur iPhone — cliquer sur un `<input type="radio">`
déjà sélectionné ne déclenche AUCUN `onChange` (comportement natif du
navigateur, pas un choix de code) : impossible d'abonner un 2e appareil du
même compte, quoi qu'on fasse depuis l'UI existante. Corrigé
(`components/profile/NotificationSettings.tsx`) : détection côté client de
l'état RÉEL de CET appareil précis (`navigator.serviceWorker` +
`PushManager.getSubscription()`, indépendant de la préférence serveur) ;
si le compte est en Push mais que l'appareil courant n'a pas d'abonnement
local, un bloc dédié apparaît (« Push activé sur ton compte, mais pas
encore sur cet appareil ») avec un bouton « Activer sur cet appareil » qui
appelle directement `enablePush()`, hors du mécanisme radio/onChange.
Committé (`4124e27`) et poussé. Au passage, ajout des `catch` manquants
sur `enablePush`/`disableNotifications` (aucune gestion d'erreur avant —
un échec aurait échoué en silence sans aucun message) + un nouvel essai
automatique sur `subscribe()` (constaté : peut échouer une première fois
juste après l'enregistrement du service worker). Committé (`2201484`).

**4. Bug réel — Apple rejette le sujet VAPID factice.** Une fois le bouton
dédié cliqué sur iPhone, un VRAI abonnement `web.push.apple.com` a bien été
créé et sauvegardé — mais **sous le compte `Demo_Amis`**, pas
`Rillettes-31` : l'utilisateur était connecté avec le compte partagé sur
son téléphone, pas son compte personnel (aucun bug, juste une confusion de
compte, précisée en testant). Premier envoi vers cet abonnement Apple :
rejeté, `403 BadJwtToken`. Recherche web ciblée (`WebSearch`) : Apple valide
strictement le sujet du JWT VAPID (`sub`), contrairement à Google/FCM — un
domaine factice type `.invalid` (ce que `lib/push/send.ts` utilisait,
`mailto:contact@nba-pronos.invalid`) est rejeté, même famille que `.test`
déjà rejeté par Supabase Auth ailleurs dans ce projet. Corrigé : sujet
remplacé par l'URL réelle du site (`https://nba-pronos.vercel.app`),
valide pour les deux services. Revérifié par un envoi direct (script
jetable) : accepté (201) ET reçu sur l'iPhone, confirmé par l'utilisateur.
Committé (`18ffe7c`) et poussé.

**État final vérifié par l'utilisateur lui-même** : notifications reçues
sur PC ET iPhone, sur son propre compte réel. `tsc`/`eslint`/`next build`
propres après chaque correctif, chaque déploiement Vercel revérifié sans
régression (`vercel ls` + routes clés).

**Résidu mineur non nettoyé, non bloquant** : le compte `Demo_Amis` a 3
abonnements Apple dupliqués (Safari en crée un nouveau à chaque tentative,
contrairement à Chrome/FCM qui réutilise le même) — sans conséquence
(l'envoi boucle sur tous, un joueur recevrait juste 3 notifs identiques
au lieu d'une). À dédupliquer si observé gênant en usage réel.
```

### 2.48 Système de ligue (session du 30/07/2026)

```text
2e point du backlog codé (BACKLOG_V1.md « Système de ligue »). Aucune spec
d'écran n'existait — 3 choix structurants cadrés AVEC l'utilisateur avant
de coder (mêmes AskUserQuestion que pour le Bracket personnel, 27/07/2026) :
ligue PERMANENTE (indépendante des compétitions, contrairement aux
brackets/pronos — le filtre s'applique au classement de la compétition
ACTIVE courante, quelle qu'elle soit) ; appartenance à PLUSIEURS ligues
simultanément ; création ouverte à N'IMPORTE QUEL joueur ACTIVE (pas
réservée à l'admin), pour l'instant depuis Profil (un futur onglet "Autre"
en bas de nav est évoqué par l'utilisateur, explicitement hors périmètre de
ce lot). Adhésion par CODE généré ALÉATOIREMENT à la création (pas un mot
de passe choisi par l'utilisateur) ; rang de la vue filtrée RECALCULÉ dans
le groupe (1er/2e/3e parmi les seuls membres), PAS le rang général
conservé. Bien distinct du code compétition (qui a le droit de JOUER),
explicitement écarté d'y toucher — voir
`nba_pronos_PREP_SPEC_TECHNIQUE_V1.md` §C4 (note déjà actée le 17/07/2026).

Modèle (migration #16, `supabase/migrations/20260730090000_leagues.sql`) :
3 tables neuves, rien d'existant modifié — `leagues` (nom, créateur, date),
`league_secrets` (code, SORTI de `leagues` dès la conception — même
correctif que `competition_secrets`, T3 §3, mais posé du premier coup ici
plutôt qu'en rattrapage), `league_memberships` (many-to-many joueur/ligue).
RLS : `leagues`/`league_secrets` visibles des SEULS membres (confidentialité
de groupe, contrairement aux compétitions qui sont publiques) — un membre
voit le code de SA ligue pour inviter d'autres amis, ce qu'il connaît déjà
en pratique. Écriture via 2 fonctions SECURITY DEFINER
(`create_league(nom)`/`join_league(code)`, même patron que
`request_prediction_correction`, migration #7) — seule façon d'écrire un
code de ligue sans jamais l'exposer par un INSERT ouvert côté joueur.
Quitter une ligue reste un DELETE direct (RLS suffit, aucune logique
particulière, contrairement à la création/l'adhésion).

**Bug réel trouvé en testant en conditions RÉELLES, PAS en relisant le
code** (script jetable `scripts/_verify-leagues-tmp.mjs`, JAMAIS committé,
supprimé après usage — 2 comptes `verif-leagues-*@nba-pronos.test` créés
puis supprimés via l'API Admin, JAMAIS le compte réel de l'utilisateur) :
récursion infinie sur la policy `league_memberships_select` — sa propre
sous-requête (`league_id in (select league_id from league_memberships
where user_id = auth.uid())`) ré-applique la RLS sur `league_memberships`
en l'évaluant, qui ré-applique la même policy, etc. (`infinite recursion
detected in policy for relation "league_memberships"`). Cassait du même
coup TOUTE lecture de `leagues`/`league_secrets`, qui l'interrogent via
`EXISTS` — pas seulement les accès directs à `league_memberships`. Corrigé
par migration #17
(`..._fix_league_memberships_recursion.sql`) : fonction
`my_league_ids()` (SECURITY DEFINER, même patron que
`is_admin()`/`is_active()`, migration #3) qui contourne la RLS pour SA
PROPRE lecture interne — casse la boucle en réutilisant le mécanisme déjà
établi du projet plutôt qu'une solution ad hoc. Rejoué après coup : 10/10
assertions passent (création, confidentialité du code pour un non-membre,
adhésion, idempotence d'un 2e `join_league`, code invalide rejeté, départ).

Requêtes/actions : `lib/queries/leagues.ts` (`getMyLeagues()`, résout
nom/code/nombre de membres pour l'écran Profil) ; `lib/queries/leaderboard.ts`
étendu (`getLeaderboard(sortKey, leagueId?)`) — un `leagueId` invalide ou
dont l'appelant n'est pas membre retombe SILENCIEUSEMENT sur le classement
Général (la RLS renvoie déjà un ensemble de membres vide dans ce cas,
jamais une fuite), plutôt qu'une erreur ou une page vide surprenante ;
`lib/actions/leagues.ts` (créer/rejoindre/quitter, 3 formulaires natifs
SANS JS, même patron redirection+query-param que `lib/actions/profile.ts`
— pas le double niveau de `lib/actions/corrections.ts`, ces 3 actions
n'ayant pas besoin d'un `returnTo` configurable).

UI : section "Mes ligues" dans Profil (liste avec code/nombre de membres,
formulaire créer, formulaire rejoindre par code, bouton quitter par ligue) ;
sélecteur de portée sur Classement
(`components/leaderboard/LeagueScopeChips.tsx`, même patron `<Link>` sans
état client que `SortChips.tsx` — paramètre d'URL `?ligue=`, combiné avec
`?tri=` déjà existant).

**Remontée utilisateur en testant, pas un bug** : le sélecteur de ligue
héritait de l'invariant préexistant du Classement (« aucune compétition
ACTIVE → état vide global », posé depuis le tout premier lot Classement,
22/07/2026) — invisible alors que les ligues existaient déjà, aucune
compétition n'étant active au moment du test. Tranché AVEC l'utilisateur
(AskUserQuestion) : affiché quand même au-dessus de l'état vide (avec
l'option "Général"), `SortChips` seul reste absent (rien à trier sans
classement). `getLeaderboard` renvoie désormais `scopeLeagueId` même dans
la branche "aucune compétition" pour que la puce corresponde visuellement.

Vérifié en conditions réelles PAR L'UTILISATEUR lui-même, avec 2 vrais
comptes (`Rillettes-31` + un second compte) : création d'une ligue, code
affiché, adhésion depuis l'autre compte confirmée, sélecteur visible et
fonctionnel sur Classement. `tsc`/`eslint`/`next build` propres à chaque
étape, aucun conflit de route. Committé et poussé en 2 temps : migration +
requêtes/actions/UI (`95edf7e`, les 2 migrations #16/#17 y sont toutes les
deux — le correctif de récursion a été trouvé et poussé en base AVANT ce
commit, donc les deux fichiers de migration existaient déjà au moment de
committer le code) ; correctif d'affichage sans compétition active
(`d1fde4f`).
```

### 2.49 Vue admin "Qui manque à l'appel" (session du 30/07/2026, suite)

```text
3e point du backlog codé, même session (BACKLOG_V1.md « Confort au
quotidien »). 2 choix cadrés AVEC l'utilisateur avant de coder : périmètre =
matchs (même fenêtre 3 jours que l'écran Matchs, §2/§18.2) ET bracket, dans
la même vue ; granularité = PAR MATCH (un bloc par échéance, liste
nominative des joueurs manquants), pas une liste agrégée par joueur.

Nouvel écran `/admin/missing` (`app/(admin)/admin/missing/page.tsx`, lien
ajouté au tableau de bord admin `app/(admin)/admin/page.tsx`) — lecture
seule, AUCUNE relance manuelle câblée, en complément des rappels push
automatiques déjà existants (§2.46/§2.47). `lib/queries/admin-missing.ts`
(`getAdminMissingData()`) : l'admin bypasse déjà la RLS sur
`match_predictions`/`brackets` (policies `using (user_id = auth.uid() or
is_admin())`, migration #3) — AUCUNE confidentialité à recalculer ici,
contrairement à l'écran joueur Matchs (§8, `isRevealed`) qui doit, lui,
cacher le contenu tant que le joueur courant n'a pas lui-même validé.
"Manquant" = joueur `ACTIVE` sans ligne `match_predictions` committed
(`status <> 'DRAFT'`, même définition que `count_committed_predictions`,
migration #6) sur ce match précis, ou sans `brackets` validé (`is_validated`
OU `is_auto_validated`) tant que `bracket_deadline` n'est pas encore passée
— un bloc bracket n'apparaît que si la deadline est CONNUE et future, un
bloc match que si au moins un joueur manque effectivement (blocs à 0
manquant filtrés, rien à montrer).

**Vérifié en conditions réelles, avec une précaution particulière décidée
AVEC l'utilisateur** : aucune compétition n'étant active en ce moment
(§2.48), un test end-to-end classique via l'UI était impossible sans en
créer une. Risque identifié et signalé avant de procéder : les crons GitHub
Actions de rappels (fenêtre 4h avant un match, 24h avant `bracket_deadline`,
§2.46) tournent en continu et INDÉPENDAMMENT du statut de la compétition
pour les matchs — `runMatchesReminder` interroge TOUS les matchs par date,
toutes compétitions confondues, actives ou non. Une compétition ACTIVE
TEMPORAIRE a donc été créée (script jetable, service_role, même patron que
`scripts/seed-playoffs-test-data.mjs`) mais avec des matchs ET une
`bracket_deadline` planifiés à J+2 — largement hors des deux fenêtres de
rappel (4h/24h), pour qu'AUCUN risque de notification push réelle ne soit
couru pendant le test, quel que soit le moment exact où les crons tournent.
Un seul compte ADMIN JETABLE créé pour la lecture (jamais le vrai compte
`Rillettes-31`, jamais un mot de passe touché sur un compte réel — même
précaution que la vérification des ligues, §2.48).

6/6 assertions passent : le compte de test est bien reconnu ADMIN ;
lecture RLS-bypass réussie sur `match_predictions`/`brackets` ; un joueur
(`Rillettes-31`, prédiction réelle VALIDATED posée pour le test sur UN SEUL
des 2 matchs créés) est ABSENT de la liste manquante de ce match précis
mais PRÉSENT sur l'autre match de la même série (confirme le calcul PAR
match, pas par joueur global) ; `Demo_Amis` (aucune prédiction posée)
manquant sur les deux ; aucun bracket créé pour la compétition de test →
tous les joueurs ACTIVE manquants sur le bloc bracket. Nettoyage complet en
fin de script, dans l'ordre feuilles→racines (même patron que
`scripts/cleanup-test-data.mjs`) : `match_predictions` → `matches` →
`series` → `competitions`, puis `auth.admin.deleteUser` pour le compte de
test. État de la base revérifié IDENTIQUE à l'avant-test par une requête
séparée : les 3 compétitions archivées inchangées, seuls `Rillettes-31`
(ADMIN)/`Demo_Amis` (PLAYER) restants, aucune compétition active.

`tsc`/`eslint`/`next build` propres, aucun conflit de route
(`/admin/missing` listé seul). Committé et poussé (`e934085`). **Résidu
noté dans `GAPS_OUVERTS.md`** : test au CLIC dans un vrai navigateur
reporté à la prochaine compétition réellement active — le script jetable
vérifie la logique de calcul et la RLS, pas le rendu visuel réel de l'écran.
```

### 2.49bis Correctif — lien de sortie du panneau admin (session du 30/07/2026)

```text
Remonté par l'utilisateur en testant : « quand on est dans le panneau
admin, on n'a aucun moyen de revenir sur la page d'accueil ou profil ».
Vérifié par grep : aucun lien vers /home ni /profile nulle part dans
app/(admin)/admin/ (une seule occurrence de "Retour", propre à l'écran
Compétitions, qui ne sort jamais du panneau admin) — le trou existe depuis
la création du lot Admin (§2.20, 25/07/2026), jamais remarqué avant.

Corrigé au niveau du LAYOUT partagé (app/(admin)/admin/layout.tsx), donc en
un seul endroit pour toutes les pages admin : lien "← Retour à l'app" ajouté
dans l'en-tête (`styles.exitLink`, nouveau dans layout.module.css), aligné à
droite (`margin-left: auto`), vers /home. `tsc`/`eslint`/`next build`
propres. Committé et poussé (`0e7c233`).
```

### 2.50 Superlatifs de fin de compétition + écran Historique (session du 30/07/2026, suite)

```text
4e point du backlog codé, même session (BACKLOG_V1.md « Fun / esprit ligue
entre potes »). Périmètre plus large que prévu au premier abord : "plus
grosse remontée au classement" s'est révélé INCALCULABLE sans historique de
classement dans le temps — l'app ne gardait que l'état figé FINAL
(`competition_archives`), jamais d'instantané intermédiaire. 2 choix cadrés
AVEC l'utilisateur avant de coder (2 AskUserQuestion) plutôt que
d'abandonner ce titre ou de trancher seul : construire d'abord ce socle
(plutôt que de le sauter) ; afficher les titres dans une section
"Historique" de Profil pour l'instant (confirmé explicitement réorganisable
plus tard en sous-onglets sans verrou structurel — les couches requêtes/
actions restent indépendantes de l'emplacement d'affichage, même remarque
que pour les ligues, §2.48).

**Migration #18** (`leaderboard_snapshots` + `competition_superlatives`,
2 tables neuves, rien d'existant modifié) :
- `leaderboard_snapshots` : un instantané (rang, points totaux) par
  (compétition, joueur, jour) — fréquence confirmée AVEC l'utilisateur :
  1x/jour, largement suffisant pour une remontée/courbe sans accumuler une
  ligne par recalcul de score. RLS `using (true)` : même classe d'info que
  `user_scores`/`competition_archives` (agrégats, jamais une ligne
  individuelle privée), déjà universellement visible (migration #5).
  AUCUNE policy insert/update/delete pour les joueurs — écrit UNIQUEMENT
  par le cron (service_role).
- `competition_superlatives` : titres FIGÉS à la clôture, même patron que
  `competition_archives` (`insert with check (is_admin())`, écrit dans la
  MÊME session admin que l'archive, jamais service_role, jamais recalculé
  après coup). Plusieurs lignes possibles par (compétition, kind) : TOUS
  les ex-aequo sont crédités, aucun tie-break arbitraire inventé.

**Infra du cron** : `lib/snapshots/leaderboardSnapshot.ts`
(`runLeaderboardSnapshot`, service_role, même famille que
`lib/reminders/*.ts`) ; `/api/snapshots/leaderboard` (même garde Bearer
`SYNC_SECRET` que `/api/sync/*`/`/api/reminders/*`, AUCUN nouveau secret
GitHub requis) ; `.github/workflows/snapshot-leaderboard.yml` (cron `0 12
* * *`, 12h UTC). Upsert sur `(competition_id, user_id, snapshot_date)` : un
2e déclenchement le même jour MET À JOUR la ligne du jour au lieu d'en
créer une seconde.

**Correctif trouvé en construisant, PAS un bug préexistant signalé** :
`competitions.archived_at` posée dès le schéma initial (T1, migration #1)
mais jamais écrite nulle part dans le code — trouvé en construisant l'écran
Historique, qui en a besoin pour trier/dater les compétitions closes.
Corrigé directement dans `closeCompetition()`
(`lib/actions/admin-competitions.ts`) au passage, commenté comme tel.

**`lib/scoring/superlatives.ts`** (`computeSuperlatives`, appelé UNE SEULE
FOIS par `closeCompetition`, dans la même transaction logique que l'écriture
de `competition_archives`) — 5 titres :
- NOSTRADAMUS (le plus de bons vainqueurs, `correct_match_winners`) ;
- SNIPER (le plus d'écarts exacts, `exact_margins`) ;
- BRACKET_KING (le plus de points bracket, `bracket_points`) ;
- BEST_ROUND1 (le plus de points gagnés sur les matchs du 1er tour
  UNIQUEMENT — pas une colonne de `user_scores`, qui agrège TOUS les tours :
  requête dédiée, série ROUND_1 -> matchs -> `match_predictions.points_awarded`) ;
- BIGGEST_CLIMB (delta entre le rang du PREMIER snapshot disponible et le
  rang final déjà calculé par `closeCompetition`, même départage que le
  classement live) — IGNORÉ si aucun snapshot n'existe encore (compétition
  close le jour même de sa création, avant le premier passage du cron :
  jamais une erreur, juste un titre non décerné cette fois-là).

Un titre à valeur maximale NULLE n'est JAMAIS décerné (ex. personne n'a de
points bracket cette saison-là -> pas de "Meilleur bracket", `pickTopTied`
renvoie un tableau vide si `max <= 0`).

**Vérifié en conditions réelles**, même précaution que §2.49 (compétition
ACTIVE temporaire, compte ADMIN JETABLE, jamais le vrai compte
`Rillettes-31`) : scores construits À LA MAIN (pas de vrai match résolu, les
colonnes `is_winner_correct`/`margin_diff`/`winner_points`/
`margin_bonus_points` posées directement — non générées, seul
`points_awarded` l'est) pour couvrir délibérément 3 cas limites : ex-aequo
RÉEL (Sniper, 1 écart exact chacun) ; absence de titre (Bracket, 0 partout,
aucune ligne insérée) ; une VRAIE inversion de classement entre un snapshot
"d'hier" (Demo_Amis 1er, Rillettes-31 2e) et le rang final recalculé
(Rillettes-31 1er, Demo_Amis 2e — climb de Rillettes-31 = +1 confirmé,
climb négatif de Demo_Amis bien exclu). RLS confirmée dans les deux sens :
un admin PEUT insérer des superlatifs, un appelant NON-admin (client
anonyme) est BLOQUÉ ; lecture publique confirmée (même client anonyme, sans
session, voit les lignes insérées). Upsert du snapshot rejoué deux fois le
même jour : toujours 2 lignes, jamais 4 (contrainte unique respectée).
12/12 assertions passent. Nettoyage complet (superlatifs → snapshots →
pronos → matchs → série → compétition → compte de test), base revérifiée
IDENTIQUE à l'avant-test par une requête séparée.

`tsc`/`eslint`/`next build` propres. Committé et poussé (`7bdffc7`).
**Résidu, même nature que §2.49** : le rendu RÉEL de la section Historique
avec de VRAIS titres (pas juste la liste vide des 3 compétitions test déjà
archivées, closes avant que ce mécanisme existe) reste à observer à la
prochaine vraie clôture de compétition — le script jetable vérifie la
logique de calcul et la RLS, pas le rendu visuel.
```

### 2.51 Tutoriel joueur (session du 31/07/2026)

```text
2e des 3 chantiers prioritaires du reclassement du 30/07/2026 (après la
refonte du Bracket, voir `JOURNAL_SESSIONS.md`), avant les badges permanents
(non cadrés). AUCUNE spec ne préexistait — seule une ligne dans BACKLOG_V1.md
(« Tutoriel & notifications »). Contrairement aux lots précédents sans spec
(Bracket personnel, Système de ligue), l'utilisateur a explicitement demandé
de « beaucoup réfléchir avant de coder » — rédigée EN SÉANCE
(`SPEC_TUTORIEL_JOUEUR_V0_1.md`, `Cadrage/V1/Spec visuelle/`), 3 tours
d'`AskUserQuestion` avant la 1re ligne de code : (1) déclenchement/format/
contenu ; (2) ajout des paris MATCH+SÉRIE à l'étape 3 (demandé après
relecture de la 1re proposition) ; (3) choix explicite d'écrire la note de
cadrage avant de coder (plutôt que coder directement), même réflexe que
Bracket personnel/Ligues.

**Mécanique** (§4 de la spec) : `users.tutorial_seen_at timestamptz null`
(migration #21, `20260730130000_tutorial_seen_at.sql`) — écriture directe
via `users_update_self` (aucune fonction SECURITY DEFINER nécessaire, le
trigger `enforce_users_invariants` ne garde que role/status). Posé au
PREMIER des 3 événements de sortie (Découvrir/Plus tard/fermeture), pas
seulement à la complétion des 7 étapes — sinon un joueur qui ferme tôt
reverrait la bannière en boucle.

**Composants** (`components/tutorial/`) : `TutorialModal.tsx` (wizard 7
étapes, contenu 100 % statique, `use client`, état d'étape en `useState`
local — PAS dans l'URL, c'est un overlay ponctuel, pas une page) ;
`TutorialBanner.tsx` (Accueil, montée uniquement si `tutorialSeenAt ===
null`, AVANT le early-return "aucune compétition active" — un joueur peut
s'inscrire sans compétition en cours) ; `TutorialLink.tsx` (lien permanent
« Comment jouer ? », Profil > Compte). Écart assumé avec la note de
cadrage : §6 prévoyait le style `hero-banner` (photo parquet) pour la
bannière, remplacé en codant par une carte simple (même style que les
sections Accueil existantes) pour éviter 2 bandeaux photo empilés — signalé
explicitement à l'utilisateur, pas encore retranché.

**Captures d'écran réelles** (ajout demandé par l'utilisateur APRÈS le 1er
test manuel, pas dans le cadrage initial) — étapes 1/2 (conceptuelles)
restent texte seul, étapes 3→7 illustrées (`public/tutorial/*.png`, recadrées
serré via `sharp`, ~480px de large). Chaîne complète pour les obtenir, le
classificateur de permissions bloquant toute mutation de compte pour Claude
(y compris un mot de passe de test) :
1. L'utilisateur a lui-même posé un mot de passe connu (`TutoTest2026!`) sur
   `TestJoueur1` (`scripts/tmp_set_tutorial_test_password.mjs`, jetable,
   supprimé après usage) — Claude ne peut pas muter un compte, mais une
   simple soumission du VRAI formulaire /login n'est pas une action
   privilégiée.
2. Playwright installé temporairement en dev dependency (`npm install -D
   playwright`, désinstallé juste après — `package.json`/`package-lock.json`
   revérifiés identiques par `git status`), capture des 5 écrans via le
   serveur `next dev` déjà lancé par l'utilisateur (port 3001).
3. Matchs/Bracket n'avaient rien à montrer (aucun match dans la fenêtre 3
   jours, `bracket_deadline` déjà passée) — la contrainte DB « une seule
   compétition ACTIVE à la fois » interdisait d'en créer une jetable à côté.
   Décidé AVEC l'utilisateur (AskUserQuestion) : ajustement RÉVERSIBLE de sa
   VRAIE compétition ACTIVE (« Test », id `941a63da-...`) — 1 match SCHEDULED
   ajouté sur une série existante sans match, `bracket_deadline` reculée à
   +72h, capture, PUIS suppression du match ajouté et restauration EXACTE de
   la deadline d'origine (`2026-07-30T11:13:00+00:00`), revérifié par lecture
   séparée après coup. Aucune trace résiduelle.

**Vérifié** : `tsc`/`eslint`/`next build` propres à chaque étape. Committé
et poussé sur `main` (`34e179a`), déploiement Vercel automatique (intégration
GitHub) suivi via `vercel inspect` jusqu'à `Ready`, `https://
nba-pronos.vercel.app/login` revérifiée `200` en production.

**Résidu, signalé à l'utilisateur, pas bloquant** : les captures sont des
images figées de l'interface actuelle — la DA n'étant pas stabilisée (ex.
renommage Classement → « Hall of shame » reporté), elles se périmeront si
l'UI change. L'utilisateur prévoit de les refaire lui-même plus tard (mêmes
noms de fichiers dans `public/tutorial/`, aucun changement de code requis
pour les remplacer).
```

### 2.52 Création de compétition NBA Cup + dry-run réel de la synchro (session du 31/07/2026, suite)

```text
Objet : demande directe de l'utilisateur (« retravailler sur la création de
compétition et importation des matchs »). Deux volets, clarifiés par
AskUserQuestion avant de coder : (1) construire la création NBA Cup,
explicitement hors périmètre de SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md depuis
sa validation du 27/07/2026 ; (2) vérifier en conditions réelles que la
synchro capture bien les matchs Cup au fur et à mesure et que les scores
s'y saisissent automatiquement.

**Volet 1 — Création NBA Cup (correctif post-validation)**

Réouverture d'un point validé, flaguée et confirmée AVANT de coder (même
réflexe que les correctifs précédents, ex. §2.10bis) : topologie bottom-up
identique aux Playoffs (§2.30) — 4 CUP_QUARTERS → 2 CUP_SEMIS → 1 CUP_FINAL
— mais SANS conférence (`series.conference` NULL sur toute la Cup, déjà
prévu par le schéma T1 dès le 18/07/2026, jamais exploité jusqu'ici).
L'admin choisit librement les 8 équipes qualifiées en 4 affiches, aucune
contrainte Est/Ouest contrairement aux Playoffs.

Code : `lib/actions/admin-competitions.ts` (`createCupBracket`, nouvelle
fonction, même patron `insertSeries` que `createPlayoffBracket` ; validation
serveur : 4 affiches, 8 équipes distinctes et existantes, pas de contrôle de
conférence) ; `app/(admin)/admin/competitions/new/page.tsx` (2e fieldset
« Quarts NBA Cup », même patron « formulaire unique, champs non pertinents
ignorés côté serveur selon le type soumis » que Playoffs). Détail complet
dans `SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1.md` §10 (correctif).

**Trouvaille de conception** (avant de coder, en relisant le code existant) :
AUCUN autre changement de code n'était nécessaire — `lib/queries/
admin-results.ts` (CUP_ROUNDS), `lib/labels/rounds.ts`, la synchro T4
(`lib/sync/schedule.ts`/`results.ts`, attache déterministe par paire
d'équipes, round-agnostique) et le moteur de scoring T5 (barème Cup,
`deriveSeriesOutcome`) géraient déjà la Cup de façon générique depuis leur
construction respective — jamais exercés bout-en-bout faute d'une
compétition Cup réelle avec des séries peuplées.

Vérifié : `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` (37/37),
`npx next build` tous propres, 34 routes sans conflit.

**Volet 2 — Dry-run réel de la synchro (script `scripts/
dryrun-cup-sync-test.mjs`, jetable mais conservé dans le dépôt pour un futur
test similaire — sous-commandes `setup`/`verify`/`simulate-upcoming`/
`teardown`)**

Contrainte découverte en route : Claude ne peut pas écrire directement en
production (classificateur de permissions bloque toute mutation, même sur
une compétition de TEST isolée — même famille de blocage que les mots de
passe de test des sessions précédentes). Le script a donc été préparé PAR
Claude mais EXÉCUTÉ PAR l'utilisateur, étape par étape, dans son propre
terminal (PowerShell) — Claude guidait, lisait les résultats collés dans le
chat, et faisait les vérifications en base en LECTURE SEULE (jamais bloquées).

Déroulé réel :
1. `setup` : compétition réelle ACTIVE (« Test ») archivée temporairement
   (flip de statut brut, PAS `closeCompetition` — aucun snapshot/superlatif
   réel généré) ; compétition Cup de test créée avec 4 quarts — 2 VRAIS
   matchs (NYK-TOR, MIA-ORL, tous deux réellement joués le 09/12/2025,
   repérés par 3 appels API en amont) + 2 placeholders (BOS-PHI, DEN-LAL)
   jamais synchronisés dans ce test.
2. **Passe 1 (`?date=2025-12-09`)** : `schedule` puis `results`. Les 2 vrais
   matchs capturés et scorés (117-101 NYK, 117-108 ORL), les 2 séries
   passent `FINISHED`, et — point CLÉ jamais vérifié avant ce jour — leurs
   vainqueurs se propagent AUTOMATIQUEMENT dans la demi-finale (agrégat de
   série Cup = 1 seul match, mécanique distincte du format 4-victoires des
   Playoffs déjà éprouvé le 28/07/2026). Les 3 autres vrais matchs du jour
   correctement ignorés (aucune série candidate).
3. **Passe 2 (`?date=2025-12-13`)**, décidée après coup à la demande de
   l'utilisateur (« je veux voir que les matchs se remplissent au fur et à
   mesure, pas tout d'un coup ») : un vrai match NYK-ORL du 13/12/2025,
   repéré dès le 1er repérage de dates, correspond exactement à la
   demi-finale — capturé tout seul (`created: 1`), aucun des 14 autres vrais
   matchs du jour mal attaché. Score synchronisé, demi-finale `FINISHED`,
   vainqueur (NYK) propagé dans la finale (`CUP_FINAL#0` posé à NYK,
   2e slot en attente du tour parallèle jamais joué dans ce test).

**Point volontairement PAS vérifié** : le rendu « à pronostiquer » d'un
match Cup encore `SCHEDULED` côté Hub Jouer/Accueil. Tous les vrais matchs
disponibles pour cette fenêtre (déc. 2025) sont dans le PASSÉ par rapport à
aujourd'hui — les écrans joueur filtrent sur `scheduled_at > maintenant
réel`, jamais affichable sans décalage artificiel (même contrainte que le
dry-run Playoffs du 28/07/2026). Tentative de trouver un vrai match encore
`SCHEDULED` sur la saison 2026-27 : **0 match trouvé sur 5 dates d'octobre
2026 sondées** — calendrier pas encore publié côté API à ce jour. Décidé
AVEC l'utilisateur : point abandonné pour l'instant, à reprendre une fois le
calendrier réel 2026-27 publié (voir `GAPS_OUVERTS.md`). Une commande
`simulate-upcoming` (match manuel, PAS un vrai match Highlightly, scheduled_at
= +2 jours) a été ajoutée au script si ce test redevient utile plus tard,
mais N'A PAS été utilisée cette fois (l'utilisateur l'a explicitement écartée).

**Incident de nettoyage, trouvé et corrigé** : le 1er `teardown` a supprimé
la compétition de test mais échoué SILENCIEUSEMENT à restaurer « Test » en
ACTIVE (`uniq_one_active_competition` — les `.delete()` du script
n'avaient pas leur erreur vérifiée). Diagnostic en lecture seule : un VRAI
bracket joueur (7 `bracket_picks` + 1 ligne `brackets`) s'était créé pendant
le test — l'utilisateur (ou un compte réel) a consulté `/play/bracket`
pendant que la compétition de test était ACTIVE, ce qui bloquait la
suppression de `series` par FK. Nettoyé manuellement (bets → bracket_picks →
brackets → series → competition_secrets → competitions, dans cet ordre) et
« Test » restaurée en ACTIVE, revérifiée intacte. **Script corrigé en
conséquence** : chaque étape de `teardown` lève désormais une erreur
explicite au lieu d'échouer en silence, et le nettoyage inclut
`bets`/`bracket_picks`/`brackets` avant `series`/`competitions`.

**Incident de sécurité, sans lien avec le code** : le `SYNC_SECRET` réel est
apparu PLUSIEURS FOIS en clair dans la conversation (l'utilisateur l'a collé
lui-même dans des commandes `curl`/`Invoke-WebRequest`, une fois aussi visible
via une sélection IDE) — même famille que les 2 incidents précédents sur des
mots de passe de test. Régénération recommandée (`.env.local` +
secret GitHub Actions `SYNC_SECRET`) — PAS encore confirmée faite par
l'utilisateur à ce stade.

**Runbook opérationnel clarifié avec l'utilisateur** (pas du code, une
synthèse demandée explicitement) : au lancement réel, admin crée la
compétition (Cup une fois les 8 qualifiés connus ~fin novembre, Playoffs une
fois les 8 affiches du 1er tour connues) — tout le reste (synchro
quotidienne du calendrier, synchro des scores toutes les 30 min, recalcul,
avancement automatique de tour en tour) tourne seul jusqu'à la clôture
manuelle en fin de compétition. Seule action de fond récurrente : surveiller
`/admin/logs` de temps en temps, rattraper à la main via `/admin/competitions/
results` si l'API rate un match.

Committé et poussé le 02/08/2026, confirmé par l'utilisateur en début de
session (`6f591b0`) — voir §2.53 pour la suite de la session.
```

### 2.53 Stepper d'écart repensé sous l'équipe vainqueur, écran Matchs (session du 02/08/2026)

```text
Objet : demande directe de l'utilisateur sur l'écran Matchs (« gérer l'écart
pronostiqué par un bouton + disponible sous chaque équipe ? Comme ça on
clique sur un des + en dessous d'une des équipes pour incrémenter de 1 pour
une des équipes »). Deux lectures possibles de cette phrase, clarifiées par
`AskUserQuestion` avant de coder : (a) un compteur indépendant par équipe
(score à la volée, vainqueur/écart dérivés) — changement structurel profond
(TeamPicker + MarginStepper fusionnés, contrat local à réinventer) ; (b) le
TeamPicker existant inchangé, seul le "+" se déplace sous l'équipe déjà
choisie comme vainqueur. L'utilisateur a choisi (b), plus proche de l'écran
actuel.

**Code** : `components/matches/MarginStepper.tsx` reçoit 3 nouvelles props
(`winnerTeamId`, `homeTeamId`, `awayTeamId`) — rend `null` tant qu'aucun
vainqueur n'est choisi (règle "case vide" de §6 étendue au stepper lui-même,
pas seulement à sa valeur) ; sinon un grid 2 colonnes identique à celui de
`TeamPicker.module.css` (`1fr 1fr`), les contrôles (`−`/valeur/`+`) rendus
uniquement dans la colonne dont l'id correspond à `winnerTeamId`.
`components/matches/PredictionForm.tsx` lui passe désormais `winner` (déjà
en state local) et les 2 ids d'équipe du match. Aucun changement de contrat
serveur, aucune migration : `predicted_margin` reste un entier unique, non
rattaché à une équipe en base — seul le rendu change.

**Aller-retour en 2 commits, dans la même session** :
1. 1re demande : "+" sous l'équipe vainqueur. Le bouton "−" a été retiré à
   la demande explicite de l'utilisateur, confirmée par une 2e question
   `AskUserQuestion` ("seulement le +"). Committé/poussé (`939f3f9`).
2. Après un tour d'usage réel, l'utilisateur a demandé de le réintroduire
   ("j'aime bien comment c'est actuellement, il manque juste le bouton −")
   — remis à l'identique des règles de §6 (mêmes gardes de désactivation),
   sous la même colonne que le "+". Committé/poussé séparément (`139de16`),
   pas un amendement du 1er commit.

**Testé au CLIC en conditions réelles, aux 2 étapes** (compte `TestJoueur1`,
mot de passe `TutoTest2026!` déjà connu depuis §2.51) : Playwright réinstallé
temporairement en dev dependency à chaque fois (`npm install -D playwright`
+ `npx playwright install chromium`), désinstallé juste après
(`package.json`/`package-lock.json` revérifiés identiques par `git diff`,
même patron que §2.51) — script jetable supprimé en fin d'usage, aucun
résidu dans le dépôt. Vérifié : sélection domicile ET visiteur, bascule de
colonne en changeant de vainqueur avec la valeur conservée, aucune erreur
console (`page.on("console")`/`page.on("pageerror")` surveillés).

**Trouvaille en testant, sans lien avec le code applicatif** : au moment de
lancer un `npm run dev` pour le test, 2 serveurs Next.js tournaient déjà en
local sans que Claude les ait démarrés — un `next dev --port 3001` et un
`next start` (build de PRODUCTION) sur le port 3000, tous deux répondant.
Le tout premier essai de test a tapé par erreur sur le port 3000 (production,
ancien build) et a montré l'ANCIEN rendu du stepper malgré le code déjà
corrigé sur disque — diagnostiqué en inspectant les lignes de commande des
process (`Get-CimInstance Win32_Process`), pas en supposant. Reporté sur le
port 3001 (vrai dev server, HMR à jour) pour le reste des tests ; les 2
process pré-existants n'ont jamais été arrêtés (origine inconnue, risque de
couper une session de l'utilisateur).

Documentation mise à jour en miroir : `SPEC_ECRAN_MATCHS_V0_1.md` §22
(amendement post-implémentation) ; `ETAT_ACTUEL.md` (ce paragraphe) ;
`GAPS_OUVERTS.md` (aucun nouveau gap — demande entièrement traitée,
confirmée fonctionnelle par l'utilisateur).

Committé et poussé, 2 commits (`939f3f9`, `139de16`). Déploiement Vercel
automatique attendu, pas revérifié en production à ce stade.
```

### 2.54 Couleurs d'équipe sur Profil — reprise cadrée par maquettes, cette fois codée (session du 04/08/2026)

```text
Objet : « On peut repartir sur une spec plus solide pour les couleurs qui
personnalisent les profils ? » — reprise explicite du point `BACKLOG_V1.md`
§ Personnalisation du profil, essayé puis ABANDONNÉ le 30/07/2026 (« je ne
pense pas que ça ait d'importance »), avec la consigne de cadrer AVANT de
coder cette fois plutôt que de redeviner.

Cadrage (`AskUserQuestion` avant tout code) : portée limitée au bandeau
Profil (pas étendue au Classement/carte joueur, comme le 1er essai) ;
intensité « à définir ensemble en revoyant des maquettes », pas tranchée à
l'avance.

Itérations de maquette (artifact HTML, script `build-mockup.js` qui injecte
les VRAIS blasons SVG et la vraie photo de bandeau — jamais de placeholder) :
3 pistes (accents doux / bandeau signature / immersion complète) → bandeau B
choisi ; jugé « trop conventionnel » → duotone (photo désaturée recolorée en
2 tons via `mix-blend-mode: color`) retenu contre un bloc diagonal ;
affinages successifs (retrait badge rond, blason en filigrane, blason à
gauche avec liseré blanc `feMorphology`/`feComposite`/`feMerge`, blason tout
à gauche + pseudo tout à droite en 2 extrémités du bandeau).

Décisions actées (pas de fichier `SPEC_ECRAN_*` séparé, le cadrage par
maquettes validées tient lieu de spec, proportionné à la taille du
changement) : couleurs en constante de code (`lib/labels/teamColors.ts`,
PAS une colonne base, même choix que `lib/labels/rounds.ts`) ; déclenchement
automatique dès `favorite_team_id` renseigné (aucune migration, aucun
toggle — le 1er essai avait `users.use_team_colors`, retiré avec tout le
reste) ; portée strictement limitée au `<header>` du Profil.

Code : `lib/queries/profile.ts` (`ProfileData.favoriteTeam`) ; `app/(app)/
profile/page.tsx` (`--team-primary`/`--team-secondary` posées seulement si
résolues, filtre SVG `#profile-crest-outline` pour le liseré) ; `page.module.
css` (`.headerTeam::before/::after` écrasent LOCALEMENT les pseudo-éléments
de `.hero-banner` par spécificité, aucun autre écran affecté).

Vérifié en conditions RÉELLES (compte `TestJoueur1`, équipe Lakers réglée via
la vraie action `updateProfile`) : bandeau duotone violet/or + blason avec
liseré + pseudo agrandi conformes à la maquette validée, dark ET clair ;
compte de test restauré après coup. `tsc`/`eslint`/`next build` (36 routes)/
`vitest` (37/37) propres.

Trouvaille distincte, hors périmètre, PAS corrigée : après « Enregistrer »
(équipe favorite) ou bascule de thème, l'écran ne reflète pas immédiatement
le changement sans rechargement complet (`revalidatePath`+`redirect` déjà en
place) — reproduit à l'identique sur les 2 actions, probablement un
comportement Next.js App Router préexistant, pas une régression de ce lot.

Committé (`c72b1f8` code, `b1460b2` doc). Déploiement Vercel automatique
attendu, pas revérifié en production à ce stade.
```

### 2.55 Nouvel onglet Stats — Profil (session du 04/08/2026, suite)

```text
Objet : « prochain chantier, l'onglet stats et les badges » — reprise de 2
points du backlog (`BACKLOG_V1.md` § Historique & stats / Fun-esprit ligue) :
la courbe d'évolution n'avait qu'un socle de données (`leaderboard_snapshots`,
30/07/2026), aucun écran ; les « badges permanents » restaient à spécifier.

Cadrage avant le code (même discipline que §2.54) : `AskUserQuestion` pour
l'emplacement (nouvel onglet Profil) et le contenu (4 propositions, les 4
retenues : courbe d'évolution, précision des pronos, bilan des paris,
comparaison aux autres joueurs — Badges en simple catégorie placeholder,
aucune liste à concevoir maintenant). Mode Plan utilisé pour la 1re fois
cette session (1 agent Explore + 1 agent Plan) puis maquette artifact
demandée en plus du plan écrit — 1 ajustement demandé et intégré avant
validation : filtre Général/Ligue sur la Comparaison (même mécanisme que
Classement/Bracket). Plan approuvé via `ExitPlanMode`.

Code : `lib/queries/stats.ts` (nouveau, `getProfileStats(leagueId?)`, 6
requêtes dont 1 lecture par utilisateur de `leaderboard_snapshots`) ;
`components/profile/RankEvolutionChart.tsx` (nouveau, SVG fait main,
composant SERVEUR, aucune librairie de graphes — rang projeté directement
sur l'axe y, `stroke: var(--color-trend)`) ; `components/profile/
LeagueScopeChips.tsx` (nouveau, même patron qu'une copie par écran déjà
établie) ; `components/bracket/ProgressBar.tsx` (prop `label?` optionnel,
réutilisé pour « Précision ») ; 5e onglet « Stats » sur `ProfileTabs.tsx`/
`page.tsx` (`?tab=`, même patron que les 4 onglets existants). Filtre ligue
sur `rank`/`comparison` UNIQUEMENT — la courbe d'évolution reste le
classement GÉNÉRAL (ré-agréger tous les snapshots par ligue jugé hors de
proportion pour ce lot, décision actée dans le plan). Delta de comparaison en
texte neutre, jamais vert/rouge (`--color-win`/`--color-loss` réservés aux
résultats de jeu réels). Aucune migration.

Vérifié en conditions RÉELLES (compte `TestJoueur1`) : onglet visible dark
ET clair, tous les états vides corrects. Graphe vérifié via 4 lignes
`leaderboard_snapshots` insérées TEMPORAIREMENT (script jetable
service_role) puis supprimées après coup (aucune trace laissée en base).
`tsc`/`eslint`/`next build` (36 routes)/`vitest` (37/37) propres.

Committé (`6c56abb` code, `24e84ef` doc).
```

### 2.56 Stats : total de points en grand (session du 05/08/2026)

```text
Objet : ajustement demandé sur l'onglet Stats (§2.55) — le total de points
apparaissait deux fois (dans la grille de répartition « Points pronos/Points
paris/Total » ET nulle part ailleurs de façon proéminente). Sorti de la
grille (qui passe à 3 colonnes) et affiché en grand tout en premier
(`.totalHero`/`.totalHeroValue`/`.totalHeroLabel`, `app/(app)/profile/
page.tsx` + `page.module.css`). Changement d'affichage pur, aucune requête
ni migration touchée.

Committé (`de24964`). Rattrapage de suivi le 06/08/2026 : ce commit n'avait
pas été documenté dans `ETAT_ACTUEL.md`/`JOURNAL_SESSIONS.md`/
`GAPS_OUVERTS.md` au moment où il a été fait — repéré et documenté a
posteriori en recoupant `git log` avec ces 3 fichiers (voir §2.57 et
`GAPS_OUVERTS.md`).
```

### 2.57 DA : fond photo plein écran + cartes en verre sur 9 écrans, fond personnalisable (session du 05-06/08/2026)

```text
Objet : chantier de direction artistique — remplace le bandeau photo étroit
(`.hero-banner`) par un fond de page fixe plein écran (`.photo-page`)
derrière des cartes translucides (`.glass-card`), essayé sur Accueil le
05/08/2026 puis étendu le 06/08/2026 aux écrans où le résultat a été validé :
Accueil, hub Jouer, Matchs, Mes paris, Nouveau pari, Mes pronos, Bracket
personnel, Classement, Profil (ce dernier garde SON `<header>` en
`.hero-banner` — bandeau équipe/badges §2.54 — seul le reste de l'écran
passe en `.photo-page`/`.glass-card`). Écran PAS migré : Bracket global
`/bracket` (format horizontal, image dédiée envisagée, pas faite).

**Rattrapage de suivi (06/08/2026)** : ce chantier — comme §2.56 — a été
codé, committé (`fc6fc43`) et poussé SANS mise à jour de `ETAT_ACTUEL.md`/
`JOURNAL_SESSIONS.md`/`GAPS_OUVERTS.md` au moment où il a été fait. Repéré le
06/08/2026 en recoupant `git log` avec ces 3 fichiers (qui s'arrêtaient tous
au 04/08/2026, §2.55) et documenté a posteriori à partir du code, des
commentaires qu'il contient et de `public/brand/README.md` — PAS d'une
mémoire de session. Conséquence directe : contrairement au reste de ce
fichier, **le détail du cadrage réel (itérations, allers-retours avec
l'utilisateur) n'est pas connu** — seul le résultat final dans le code l'est.
Aucune trace de vérification « en conditions réelles » dans le navigateur
pour ce lot précis (contrairement à la quasi-totalité des autres entrées de
ce fichier) — voir `GAPS_OUVERTS.md`.

Fond personnalisable : sélecteur « Fond d'écran » dans Profil > Compte, 3
choix (`BACKGROUND_THEMES` dans `app/(app)/profile/page.tsx`) — « Fresque
streetball » (MURAL, défaut), « Panier vu du dessus » (HOOP), « Terrain à
Hong Kong » (HK). Persisté via `users.background_theme` (migration
`20260806090000_background_theme.sql`, enum, défaut `MURAL`, aucune policy
RLS dédiée nécessaire — `users_update_self` + le trigger
`enforce_users_invariants` couvrent déjà toute nouvelle colonne) ; action
`updateBackgroundTheme` (`lib/actions/profile.ts`, même patron que
`updateThemePreference`) ; lu à la racine dans `app/layout.tsx`
(`getSitePreferences`, fusion theme+background en 1 seule requête) et posé
comme attribut `data-bg` sur `<html>` (absent pour MURAL, déjà la valeur de
`:root`) ; `--photo-page-image` (`app/tokens.css`) redéfini par
`[data-bg="hoop"|"hk"]`. Les 3 photos + vignettes (`public/brand/hero-{mural,
hoop,hk}(-thumb).jpg`) sont des photos Unsplash fournies par l'utilisateur
(licence Unsplash, recompressées 1080px/q68 plein écran, 220px/q62 vignette).

Détail technique notable (commentaires `app/globals.css`) : `.photo-page`
pose `isolation: isolate` pour contenir son propre contexte d'empilement (le
fond ne doit pas fuiter sous `.shell`) ; le fond est en `position: fixed`
plutôt que `background-attachment: fixed` (peu fiable en scroll sur iOS
Safari) ; conséquence directe — `components/tutorial/TutorialModal.tsx` doit
désormais se rendre via `createPortal(..., document.body)` pour continuer à
couvrir toute la page (sans quoi son backdrop serait piégé dans le contexte
d'empilement d'un `.photo-page` parent).

Vérifié par ce rattrapage de suivi (06/08/2026, PAS par la session d'origine) :
`npx tsc --noEmit`, `npx eslint`, `npx vitest run` (37/37), `npx next build`
(36 routes, aucun conflit) — tous propres sur l'état actuel du dépôt.

Committé (`fc6fc43`). Déploiement Vercel automatique attendu, pas
revérifié en production. Points ouverts trouvés pendant ce rattrapage : voir
`GAPS_OUVERTS.md`.
```

### 2.58 Thème à 3 choix : Sombre / Clair / Photo (session du 06/08/2026, suite)

```text
Objet : testé juste après le rattrapage de suivi (§2.57) — le thème Clair
était illisible sur les 9 écrans .photo-page/.glass-card (aucun override
[data-theme="light"], rgba() sombres fixes). Plutôt que d'inventer une
variante claire du style photo/verre (jamais pensé pour ça — même les
couleurs d'équipe du bandeau Profil §2.54 restent volontairement sombres
dans les 2 thèmes, tokens.css §15.7), décidé AVEC l'utilisateur (2 tours
d'AskUserQuestion, mode Plan) : fusionner Sombre/Clair/Photo en un SEUL
réglage à 3 choix mutuellement exclusifs, plutôt que garder 2 axes
indépendants (thème × fond) en forçant un rendu sombre sous photo.

**Trouvaille de conception (avant de coder)** : `.photo-page`/`.glass-card`
sont des classes GLOBALES posées de façon identique et inconditionnelle
dans les 9 écrans — et `fc6fc43` avait RETIRÉ le fond/bordure solide que
chaque `.section` avait avant. Conséquence : tout le correctif tient dans
`app/globals.css`, ZÉRO changement nécessaire dans les 9 écrans/composants
qui posent déjà ces classes, ni dans `tokens.css` (le mode Photo réutilise
la palette sombre de `:root` telle quelle, même choix que le duotone
d'équipe).

**Migrations** (`20260806100000_theme_photo_enum.sql`,
`20260806110000_migrate_photo_theme.sql`) : `theme_preference` gagne une 3e
valeur d'enum `PHOTO`, dans un fichier SÉPARÉ de celui qui l'utilise
(Postgres interdit d'utiliser une valeur d'enum dans la transaction qui
l'ajoute — même prudence que l'incident migration #19/#20 déjà rencontré).
2e fichier : `update users set theme_preference = 'PHOTO' where
background_theme <> 'MURAL'` — bascule automatique des joueurs ayant déjà
choisi HOOP/HK, décidée AVEC l'utilisateur plutôt que de les remettre sur
Sombre par défaut. Poussées avec `npx supabase db push` après confirmation
explicite (même patron que les migrations précédentes).

**Code** : `app/globals.css` — `.photo-page::before`/`::after` (image +
dégradé) et le style translucide de `.glass-card` déplacés sous
`[data-theme="photo"]` ; `.glass-card` par défaut (Sombre, ou
`[data-theme="light"]`) retrouve le rendu solide retiré par `fc6fc43`
(`--color-surface-raised`/`--color-border-subtle`, déjà dotés de leurs 2
variantes dark/light). `app/layout.tsx` — `SitePreferences.theme` passe à
`"LIGHT" | "DARK" | "PHOTO"`, `data-theme="photo"` posé sur `<html>` en plus
de `"light"` existant, `data-bg` désormais conditionné à `theme === "PHOTO"`
(sans effet sinon). `lib/queries/profile.ts` / `lib/actions/profile.ts` —
types et validation élargis à `"PHOTO"`. `app/(app)/profile/page.tsx` — le
toggle à 1 bouton (« Passer en thème clair/sombre ») remplacé par 3 boutons
Sombre/Clair/Photo (même patron de petits formulaires que le sélecteur de
fond) ; le sous-sélecteur de 3 photos (inchangé) ne s'affiche plus que si
`profile.theme === "PHOTO"`, nesté dans la même section « Thème » au lieu
d'une section séparée.

**BUG RÉEL trouvé en testant au clic — 1er test en conditions réelles de ce
chantier photo depuis sa création ce matin** : les pseudo-éléments
`.photo-page::before`/`::after` (décoratifs, `position: fixed`, plein
viewport, z-index négatif) INTERCEPTAIENT les clics sur TOUS les boutons
des 9 écrans migrés — reproduit sur les 3 thèmes (pas spécifique à Photo),
donc présent depuis `fc6fc43` (06/08 matin), jamais détecté faute de test
réel (cf. gap ouvert la veille dans `GAPS_OUVERTS.md`). Diagnostiqué par
`document.elementFromPoint` (Playwright) : le clic sur le bouton « Clair »
résolvait sur le DIV `.page.photo-page` lui-même. Corrigé par
`pointer-events: none` sur les 2 pseudo-éléments (fix standard pour un
calque décoratif plein écran) — confirmé résolu par un nouveau passage du
même test après correctif.

**Vérifié en conditions RÉELLES** (compte `TestJoueur1`, Playwright
réinstallé temporairement en dev dependency puis retiré, script jetable
supprimé après usage — même patron que les sessions précédentes) : les 3
boutons Sombre/Clair/Photo cliqués un par un (formulaires natifs réels, pas
de `force: true` une fois le bug ci-dessus corrigé) ; captures d'écran
Profil + Accueil pour chaque thème : Sombre et Clair affichent des cartes
SOLIDES lisibles (plus de flou/photo hérité) ; Photo réaffiche le rendu
existant (image + verre flouté) et fait apparaître le sous-sélecteur de 3
photos, changement de photo (HOOP) pendant que Photo est actif confirmé
fonctionnel. Compte de test restauré à son état d'origine après coup
(`theme_preference: DARK`, `background_theme: MURAL`) via le même client
`service_role` que le script.

`tsc --noEmit`, `eslint`, `vitest run` (37/37), `next build` (36 routes,
aucun conflit) tous propres, revérifiés après le correctif pointer-events.

Committé (`e35f7b0`/`1e8d296`, retrouvé déjà fait en tout début de la
session du 08/08/2026 — voir §2.59 pour la suite du fil, corrigé le
`git log`/`git status` avaient déjà confirmé le commit et le push).
```

### 2.59 Badges permanents — cadrage complet + code phase 1 (sessions du 08-09/08/2026)

```text
3e et dernier chantier prioritaire du reclassement du 30/07/2026 (après
Bracket personnel et Tutoriel joueur), jusque-là non cadré
(`BACKLOG_V1.md` § "Fun / esprit ligue entre potes").

**Cadrage (08/08/2026)** : démarré à partir d'un tableur manuel pré-appli
fourni par l'utilisateur (`Cadrage/DA/🏀 NBA Pronos - 22_04_2026
(réponses) (1).xlsx`, non commité — taxonomie des paris perso, recaps
humoristiques "Tableau d'honneur"/"Salle des brancards"/"Zone Maïno"),
converti en CSV via un script Node jetable (`xlsx`). Confirmé que le
`bet_category` réel de l'app recoupe quasi mot pour mot cette taxonomie.
Inventaire exhaustif des axes (I. Pronostics de match, II. Bracket
personnel, III. Paris perso, IV. Classement global, V. Fidélité/
régularité, VI. Ligues), noms et seuils Bronze/Argent/Or/Platine/Diamant
validés un par un avec l'utilisateur au fil de plusieurs tours d'échange.
Axe "fan de tel joueur" (proposé par l'utilisateur) écarté — aucun
référentiel joueurs NBA n'existe dans le schéma, chantier séparé pour
plus tard. Badge Grimpeur (progression de rang) reporté, mécanisme déjà
pensé (paliers en % du classement traversé) si repris un jour. Décision
structurante : tous les badges restent acquis pour toujours une fois
débloqués (aucune régression), les streaks se basant sur le RECORD
personnel jamais atteint, pas l'état courant. Rédigé dans une vraie spec
dédiée, `Cadrage/V1/Spec visuelle/SPEC_BADGES_PERMANENTS_V0_1.md`
(catalogue complet, ~30 badges), plutôt que laissé éparpillé dans
`GAPS_OUVERTS.md` qui grossissait trop pour son rôle. Committé/poussé
(`08aa817`, `fa48beb`, `12b5444`).

**Cadrage technique (08/08/2026, suite, via mode Plan)** : calcul en
LECTURE PURE, une vue SQL agrégeant à VIE (toutes compétitions
confondues, contrairement à `user_scores` scopée par compétition) —
même patron non matérialisé que `user_scores`. Seuils en constantes
TypeScript, aucune nouvelle table de state. Streaks scopées PAR
compétition, record max réduit côté TypeScript. Notification de
déblocage reportée hors de ce lot.

**Code — phase 1 (09/08/2026, 25 des ~30 badges — tout sauf les 3
streaks Métronome/Pilier/Fidèle)** :
- Migration #25 (`20260809090000_badges_lifetime_view.sql`) : vue
  `user_badges_lifetime` (grain `user_id` seul), même convention de
  sécurité que `user_scores`/`user_recent_form`
  (`security_invoker = false`, agrégats seulement). CTE `participants`
  filtré `status <> 'DRAFT'` (match_predictions) / `not in ('DRAFT',
  'CANCELLED')` (bets) — décidé avec l'utilisateur pendant le cadrage
  technique : un brouillon jamais soumis ne doit pas compter comme une
  tentative, mais un pari/prono auto-validé à la deadline a un statut
  final ≠ DRAFT donc déjà correctement compté. Badge Sans-faute (bracket)
  : décidé avec l'utilisateur — un tour est parfait si tous les
  VAINQUEURS de série du tour sont corrects (score exact/affiche restent
  des badges séparés). Housekeeping : ajout de l'index manquant
  `idx_leaderboard_snapshots_user`.
- `lib/badges/thresholds.ts` / `lib/badges/labels.ts` — seuils et noms
  des 25 badges, namespace VOLONTAIREMENT séparé de `lib/labels/bets.ts`
  (`BET_DIFFICULTY_POINTS` notamment, spec §0).
- `lib/queries/badges.ts` — `getProfileBadges()`, calqué sur
  `getProfileStats` mais SANS paramètre de scope ligue (aucune
  comparaison entre joueurs, spec §1).
- `components/profile/BadgesSection.tsx` / `BadgeCard.tsx` (+ CSS) —
  remplacent le placeholder "Bientôt disponible" de l'onglet Stats.
  Réutilise `ProgressBar` existant (`components/bracket/`). Rendu
  volontairement neutre (pas de couleur par palier à ce stade — hors
  périmètre de la spec, cadré séparément, voir §2.60).
- **Correctif structurel trouvé en lisant le code AVANT de coder** : le
  placeholder Badges était niché À L'INTÉRIEUR de la branche
  `!stats.hasActiveCompetition` — donc hors saison, l'onglet Badges
  aurait disparu entièrement, contradiction avec le principe même de
  badges PERMANENTS. Corrigé : la section Badges est maintenant une
  section SŒUR, visible que la compétition soit active ou non.

**Vérifié en conditions RÉELLES (09/08/2026)** : vue vérifiée par script
jetable service_role (décompte manuel `match_correct_winners` comparé à
la vue sur les 6 comptes actifs — Rillettes-31, Demo_Amis, TestJoueur1-4
— tous concordants). Rendu vérifié au clic (Playwright réinstallé
temporairement, retiré après usage) : les 6 catégories s'affichent,
valeurs cohérentes avec la vue (ex. `TestJoueur1` : Chirurgien 3/10,
Collectionneur 43/100, Vétéran Bronze 1/2), aucune erreur console.
Incident mineur sans lien avec les données réelles : le mot de passe
connu de `TestJoueur1` ne fonctionnait plus, réinitialisé via l'API
Admin (`VerifBadges2026!`, compte de test jetable). `tsc`/`eslint`/
`vitest` (37/37)/`next build` (36 routes) propres. Committé et poussé
(`2a76d8c`).

**Rendu visuel par palier — FAIT (09/08/2026, suite immédiate)** : 5
tokens sémantiques `--color-tier-bronze/argent/or/platine/diamant`
ajoutés à `app/tokens.css` (dark + clair, même patron d'assombrissement/
saturation que `--color-accent`/`--color-champion`) — Or réutilise
`--color-champion`, Diamant réutilise `--c-blue-300`, tous deux déjà
existants, seuls Bronze/Platine sont de nouveaux tons. `BadgeCard` porte
un attribut `data-tier` (palier atteint, absent si aucun palier) piloté
en CSS : bande de gauche 3px + fond légèrement teinté (`color-mix`) +
libellé de palier coloré, en plus du style `.unlocked`/`.locked`
générique déjà en place. Vérifié au clic (Playwright temporaire,
`TestJoueur1`) : carte Vétéran (seul badge Bronze de ce compte)
visuellement distincte confirmée. `tsc`/`eslint`/`vitest`/`next build`
propres. Committé et poussé (`59570e6`).

**Icônes/visuels dédiés par badge — évoqués par l'utilisateur, REPORTÉS
explicitement** : aucun asset graphique par badge n'existe à ce jour
(contrairement aux logos d'équipe déjà en place) — à reprendre une fois
les visuels fournis par l'utilisateur, pas avant.

**Interaction "carte retournée" au clic — évoquée par l'utilisateur,
NOTÉE mais pas codée** : au clic sur un badge, la carte se retournerait
pour afficher sa description au dos plutôt que toujours visible comme
aujourd'hui. Pas encore cadrée en détail (déclencheur, badges concernés)
— à reprendre avec les icônes/visuels, même famille de chantier "polish".

**Phase 2 — Métronome et Pilier CODÉS (09/08/2026, suite immédiate)** :
migration #26 (`20260809100000_badges_streaks_view.sql`), vue
`user_competition_streaks` — grain `(user_id, competition_id)`,
CONTRAIREMENT à `user_badges_lifetime` (grain `user_id` seul). 1er usage
de gaps-and-islands SQL dans ce dépôt (`row_number()`/`partition by`,
jamais utilisé avant). Métronome : plus longue série de bons vainqueurs
de match d'affilée, ordonnée par `matches.scheduled_at`. Pilier, plus dur
: une ABSENCE est un match du calendrier SANS pronostic figé — croise
donc TOUS les matchs éligibles de la compétition (pas seulement les
lignes `match_predictions` existantes) avec chaque joueur ayant participé
à la compétition. **Hypothèse sur les matchs "éligibles" confirmée avec
l'utilisateur** : coup d'envoi déjà passé (`scheduled_at <= now()`, un
match futur n'est pas encore une absence) et ni `CANCELLED` ni
`POSTPONED` (même neutralisation que le moteur de scoring,
`lib/scoring/engine.ts` §5). Le RECORD à vie affiché par le badge (max de
toutes les compétitions) reste réduit côté TypeScript
(`lib/queries/badges.ts`), pas en SQL — plus simple sur ce 1er usage de
la technique. `lib/badges/thresholds.ts`/`labels.ts` étendus : Métronome
et Pilier rejoignent la catégorie I (Pronostics de match).

**Vérifié en conditions RÉELLES** : vue comparée à un décompte manuel
(gaps-and-islands recalculé en JS) sur les 9 lignes (joueur, compétition)
existantes en base — TOUTES concordantes, Métronome ET Pilier (dont une
vérification manuelle dédiée sur `TestJoueur1`, pilier_streak=3 confirmé
sur 8 matchs éligibles). Rendu vérifié au clic (Playwright temporaire) :
Métronome affiche Bronze (3/5, bande colorée), Pilier sans palier (3/5,
sous le seuil Bronze) — comportement attendu. `tsc`/`eslint`/`vitest`
(37/37)/`next build` (36 routes) propres. Committé et poussé (`ec97ef3`).

**Phase 3 — Fidèle CODÉE (09/08/2026, suite immédiate) : catalogue de
base ENTIÈREMENT COUVERT.** Définition tranchée AVEC l'utilisateur (seule
question restée ouverte depuis le 08/08) : règle d'UNION — un match
compte "présent" si un pronostic figé existe OU un pari perso RATTACHÉ À
CE MATCH PRÉCIS (`bets.scope = 'MATCH'`, `match_id` = ce match) existe.
**Écarté explicitement par l'utilisateur** : un pari SÉRIE (jamais
rattaché à un match précis) ne compte pas — jugé "trop facile" (un seul
pari série créditerait toute la série). Migration #27
(`20260809110000_badges_fidele_streak.sql`) : redéfinition complète de
`user_competition_streaks` (même geste que la migration #5 sur
`user_scores`) avec `fidele_streak` en plus, réutilise le calendrier
`user_match_grid` déjà construit pour Pilier.

**Vérifié en conditions RÉELLES** : invariant `fidele_streak >=
pilier_streak` confirmé sur les 9 lignes existantes (le critère de
présence de Fidèle est un sur-ensemble de celui de Pilier, ne peut donc
jamais être plus strict). Rendu vérifié au clic (Playwright temporaire) :
catégorie "Fidélité / régularité" complète (Fidèle, Vétéran, Doyen),
aucune erreur console. `tsc`/`eslint`/`vitest` (37/37)/`next build` (36
routes) propres. Committé et poussé (`ae6569c`).

**Interaction "carte retournée" au clic — FAITE (10/08/2026, suite
immédiate)** : au clic/tap sur une carte de badge, elle se retourne
(`rotateY` CSS) pour afficher sa description au dos — la face avant se
concentre désormais sur l'état courant (palier/progression, ou
verrouillé/débloqué), la description n'y est plus affichée en
permanence. `BadgeCard` passe en `"use client"` (seule raison de sortir
du composant serveur par défaut) : état local `isFlipped`, `<button>`
accessible au clavier (`aria-pressed`, `aria-hidden` sur la face non
visible) plutôt qu'un `<div onClick>`. Nouveau token
`--motion-flip-duration` (`app/tokens.css`), zéro sous
`prefers-reduced-motion` — même patron que les tokens de motion
existants. Vérifié au clic (Playwright temporaire) : bascule d'état
confirmée (`aria-pressed` false→true→false), description correcte au
dos, aucune erreur console. `tsc`/`eslint`/`vitest`/`next build`
propres. Committé et poussé (`ee820d7`).

**Astuce ajoutée (10/08/2026, suite immédiate)** : « Astuce : clique sur
une carte pour voir sa description. » sous le titre Badges, avant les
catégories — pour signaler l'interaction carte retournée, pas évidente
sans indice visuel. Vérifiée au clic (Playwright temporaire). Committée
et poussée (`a209f22`).

**Icônes de badges — FAITES (10/08/2026, suite immédiate) : CHANTIER
BADGES ENTIÈREMENT CLOS.** Décision prise avec l'utilisateur (3 options
proposées, cf. `GAPS_OUVERTS.md`) : bibliothèque `lucide-react` (ISC,
dépendance de prod), pas un dessin sur-mesure ni un asset externe à
fournir — pertinent ici car ce sont des icônes originales à l'appli, sans
la contrainte de licence de marque des logos d'équipe. `lib/badges/icons.tsx`
: mapping 1:1 des 36 badges (aucune répétition), échelle Prudent→Fou
furieux sur les faces de dé `Dice1`→`Dice5`. Icône affichée sous le
libellé sur les 2 faces de `BadgeCard`, colorée selon le palier atteint.
Vérifié au clic (Playwright temporaire) : 72 `<svg>` rendus, aucune erreur
console, `tsc` confirme les 36 noms d'icônes. `eslint`/`vitest`/`next
build` propres. Committé et poussé (`8834596`).

**Icône agrandie + réordonnée (10/08/2026, suite immédiate)** :
l'utilisateur signale que ces icônes serviront un jour dans le bandeau du
profil joueur — l'icône devient donc l'info visuelle principale de la
carte (taille doublée, 1rem→1.75rem) plutôt qu'une décoration à côté du
texte, puis réordonnée sur demande (titre au-dessus, icône en dessous).
Committé et poussé (`e65808d`, `d5e18fe`). **Piste future notée, pas
cadrée** : afficher une sélection de badges dans le bandeau du profil
(critère de sélection et emplacement exact restent à trancher).

**Reste hors périmètre, volontairement** : badge Grimpeur (progression de
rang) — seul point non traité du catalogue initial.
```

### 2.60 Bracket Playoffs — 2 colonnes Ouest/Est, score en direct, script de simulation (session du 14/08/2026, après-midi)

```text
Rattrapé a posteriori le 16/08/2026 (voir le rattrapage de suivi en tête de
fichier) — reconstruit à partir des commits et de leurs commentaires de
code, PAS d'une note de session en temps réel : la méthodologie réelle de
cadrage/vérification (tours d'`AskUserQuestion`, éventuel test au clic) n'est
pas connue pour cette entrée et n'est donc pas affirmée ici, contrairement
aux entrées précédentes.

**Script de simulation de playoffs** (`scripts/seed-playoffs-simulation.mjs`,
929 lignes, `a5c618e`) : seed une compétition Playoffs complète en
conditions réalistes — séries terminées/en cours/à venir, 10 comptes joueurs
de niveaux variés — en réutilisant le VRAI moteur de scoring
(`lib/scoring/engine.ts`) plutôt que d'inventer des points à la main. Ferme
la compétition ACTIVE existante au passage (contrainte déjà connue : une
seule ACTIVE à la fois, §2.30). `scripts/cleanup-test-data.mjs` étendu pour
nettoyer cette compétition et ces 10 comptes. Probablement le moyen qui a
servi à peupler des données réalistes pour construire et vérifier
visuellement le lot Bracket ci-dessous (série `IN_PROGRESS` avec score,
séries à venir, etc.) — aucun autre jeu de données de ce type n'existait
dans le dépôt jusqu'ici.

**Bracket : 2 colonnes Ouest/Est + score en direct** (`82952a4`) : remplace
la liste empilée par tour par 2 colonnes côte à côte — Playoffs UNIQUEMENT,
la NBA Cup (sans conférence) garde son ancien rendu par tour.
`lib/queries/bracket.ts` expose désormais `status`/`liveScore`/
`finalScoreFormat` par nœud (nouveaux champs `BracketNode`, alimentés par
`series.official_status`/`official_score_format`, déjà en base). Score EN
DIRECT calculé à la volée pour les séries `IN_PROGRESS` : victoires par
équipe comptées depuis les matchs `FINISHED` de la série (même logique de
décompte que `deriveSeriesOutcome`, mais le détail par équipe n'était pas
encore exposé) — snapshot au chargement de page, PAS de push Realtime ici
(le live reste réservé à l'écran Matchs). L'équipe qui MÈNE une série en
cours ressort en `--color-trend`, jamais `--color-win` (règle déjà actée :
le vert reste réservé au résultat FINAL). Séries terminées ou pas encore
commencées repliées dans un bandeau par colonne/tour (`RoundBanner.tsx`,
nouveau), dépliable. En-têtes "Ouest"/"Est" par colonne retirés (redondants
avec l'étiquette de conférence déjà posée sur chaque carte).

`tsc`/`eslint`/`vitest`/`next build` revérifiés propres sur l'état ACTUEL du
dépôt le 16/08/2026 (voir rattrapage de suivi) — ne garantit pas qu'ils
l'étaient déjà au moment du commit, faute de trace. Committé et poussé
(`a5c618e`, `82952a4`).
```

### 2.61 Refonte du tri du Classement — en-têtes cliquables, tendance de rang, top 3 (session du 14/08/2026, nuit)

```text
Rattrapé a posteriori le 16/08/2026, même réserve méthodologique que §2.60.

Remplace la rangée `SortChips` séparée — qui affichait une 2e fois les
mêmes libellés (Total/Matchs/Bracket/Paris/Forme) juste au-dessus des
en-têtes — par des en-têtes de colonnes directement cliquables
(`LeaderboardTable.tsx`). Un commentaire de code date cette redondance du
13/08/2026 et la qualifie de « décision reconnue erronée par l'utilisateur »
(§4.2 de `SPEC_ECRAN_CLASSEMENT_BRACKET_V0_1.md`, corrigée en conséquence).

**Bascule croissant/décroissant** (`lib/queries/leaderboard.ts`, nouveau
type `SortDirection`) : cliquer un en-tête déjà actif inverse le sens ;
cliquer un en-tête différent bascule dessus en décroissant (comportement
par défaut inchangé). Portée par l'URL (`?tri=`/`?ordre=asc`), pas de state
client.

**Tendance de rang** (`RankTrend`, nouveau) : compare le rang du jour au
dernier `leaderboard_snapshots` disponible (cron quotidien déjà utilisé par
`ProfileStatsEvolutionPoint`, jamais encore affiché sur cet écran).
`unavailable` volontairement PAS labellé "nouveau joueur" — un commentaire
de code précise que les deux cas (joueur nouveau vs compétition sans recul)
ne sont pas distinguables depuis cette seule table. Non calculée en portée
LIGUE (les snapshots ne stockent que le rang général — comparer un rang de
ligue au rang général d'hier n'aurait aucun sens, donc rien n'est affiché
plutôt que d'induire en erreur).

**Avatar-initiales + mise en avant du top 3** ajoutés à `LeaderboardRow`.
**`MobileSortSelect.tsx`** (nouveau) remplace `SortChips.tsx` (supprimé) sur
mobile, où les en-têtes de détail restent masqués sauf l'actif (règle
préexistante).

**Bug réel signalé par un commentaire de code, daté du 14/08/2026** : sans
un espace réservé de la largeur du chevron d'expansion dans la rangée
d'en-tête (`.chevronSpace`), `.colPlayer` (flex:1) calculait une largeur
différente entre la rangée d'en-tête et les rangées de données — corrigé.

`tsc`/`eslint`/`vitest`/`next build` revérifiés propres le 16/08/2026 (même
réserve qu'en §2.60). Committé et poussé (`c55e170`).
```

### 2.62 Classement — bandeau enrichi ; Paris — création déplacée vers Matchs/Bracket (session du 15/08/2026)

```text
Rattrapé a posteriori le 16/08/2026, même réserve méthodologique que §2.60.

**Classement — bandeau déplié enrichi** (`b173f75`) : le bandeau d'une
ligne dépliée ne répète plus les colonnes déjà visibles (desktop) ni la
colonne triée (mobile) — ne garde que l'inédit. Ajoute le ratio paris
réussis/tentés + la difficulté moyenne. Un seul bandeau déplié à la fois
(accordéon, état levé dans `LeaderboardRowList.tsx`, nouveau). Zébrage
discret (1 ligne sur 2, `--color-border-subtle`).

**Paris — création déplacée vers Matchs/Bracket, Mes paris devient de la
consultation** (`8765d60`, le plus gros lot des 2 sessions rattrapées ici,
~650 lignes touchées) :
- Accueil : la section "Paris séries non remplis" devient "Paris" —
  accordéon Séries/Matchs (`BetsAccordionList.tsx`, remplace
  `SeriesBetList.tsx`) listant tous les créneaux encore ouverts, matchs
  compris désormais (pas seulement séries). `lib/queries/match-bets.ts`
  (nouveau, 133 lignes) miroir de `series-bets.ts` pour le scope MATCH —
  volontairement PAS de filtre sur le type de compétition (un pari MATCH
  existe aussi bien en Playoffs qu'en NBA Cup, où une "série" Cup est un
  seul match), et aucun cap agrégé pour la Cup (même absence de cap "7 au
  total" déjà actée ailleurs pour ce format).
- Bracket (Mon bracket + Bracket global) : redirige vers `/bracket` une
  fois `bracket_deadline` passée ; le pronostic du joueur s'affiche
  désormais directement sur chaque carte de série (accent, vert si
  correct) avec un petit bouton Parier/Modifier pour proposer ou reprendre
  un pari série SANS quitter l'écran Bracket.
- "Mes paris" perd son CTA "Créer un pari" (devient un écran de
  consultation permanente) mais garde "Modifier" pour un brouillon déjà
  commencé ; ajoute le ratio de paris rejetés encore reproposables + un
  lien direct vers Nouveau pari quand aucun brouillon ne reste à éditer.

**Nouveau pari — masque les options indisponibles** (`c7fa6ac`, suite
immédiate) : séries/matchs fermés ou déjà pris repliés par défaut derrière
un bouton "Voir N indisponibles" au lieu d'un mur de lignes mortes à
traverser ; séries dont les 2 équipes ne sont pas encore connues retirées
de la liste (doublons "Finales de conférence" indistinguables sinon) ;
corrige au passage une troncature de date dans le récapitulatif du panneau
déplié.

`tsc`/`eslint`/`vitest`/`next build` revérifiés propres le 16/08/2026 (même
réserve qu'en §2.60). Committé et poussé (`b173f75`, `8765d60`, `c7fa6ac`).
```

### 2.63 Bandeau (.hero-banner) — retrait de la photo puis alignement theme-aware (session du 15/08/2026, soir)

```text
Rattrapé a posteriori le 16/08/2026, même réserve méthodologique que §2.60.
2 commits consécutifs le même soir, le 2e corrigeant/complétant le 1er.

**Retrait de la photo de fond** (`51bdb37`) : `.hero-banner` (`globals.css`)
abandonne la photo parquet/ballon au profit d'un fond uni sombre. Touche
les 4 écrans qui composaient encore ce bandeau (Bracket global, Profil,
page joueur publique) — la plupart des autres écrans avaient déjà migré
vers un en-tête sans photo (cadrage antérieur non identifié précisément,
voir `GAPS_OUVERTS.md`). Blason d'équipe favorite et teinte duotone du
bandeau Profil inchangés.

**Alignement theme-aware sur les cartes** (`e2c63ef`, suite immédiate) :
`.hero-banner` reprend le fond/bordure de `.glass-card`
(`--color-surface-raised`/`--color-border-subtle`) au lieu du fond fixe
sombre posé au commit précédent — suit désormais le thème
(Sombre/Clair/Photo, §2.58) comme le reste de l'app, y compris la bascule
verre translucide en thème Photo (`[data-theme="photo"] .hero-banner`,
oubliée à la 1re passe du même soir). Sur Profil, le dégradé aux couleurs
de l'équipe favorite masquait ce nouveau fond — retiré
(`.headerTeam::before/::after`, `.textScrim`, `.adminBadgeTeam`), seul le
blason reste comme personnalisation. Le texte du bandeau (titre/
sous-titre) perd sa couleur/ombre figées : chaque écran garde désormais la
couleur theme-aware déjà posée sur son propre titre plutôt qu'une valeur
dupliquée.

`tsc`/`eslint`/`vitest`/`next build` revérifiés propres le 16/08/2026 (même
réserve qu'en §2.60). Committé et poussé (`51bdb37`, `e2c63ef`).
```

### 2.64 Audit UX + code : parcours réel + revue multi-agents (session du 16/08/2026)

```text
Demande de l'utilisateur : « comment auditer entièrement l'appli », précisé
en « mise à l'épreuve face à un potentiel joueur », comparé à des applis de
pronostics/bracket entre amis existantes. Détail complet dans les fichiers
dédiés `AUDIT_UX_16_08_2026.md` (technique) et `AVIS_EXPERT_16_08_2026.md`
(qualitatif) — nature ponctuelle, pas fondue ici comme un instantané d'état.

**Bug réel trouvé et corrigé** : inscription sur un email déjà pris
échouait en silence (protection anti-énumération de Supabase, aucune
erreur renvoyée par `signUp()`) — `lib/auth/actions.ts` suivait quand même
le chemin succès. Corrigé (vérifie `data.session`/`data.user.identities`),
vérifié en conditions réelles. Committé et poussé (`1f4847a`).

**Infra** : quota d'emails Supabase (2/h, fixe) rencontré en testant un
compte neuf — SMTP Resend configuré en séance en mode bac-à-sable (2 bugs
de config trouvés/corrigés : username `Resend`→`resend`, port `465`→`587`).
**Reste en pause, décision produit à prendre** (domaine vérifié Resend vs
service intégré Supabase) — voir `GAPS_OUVERTS.md`. Clé API Resend exposée
2x dans le chat pendant le dépannage, régénération laissée à l'utilisateur.

**Revue de code** (`/code-review`, 9 commits du 14-15/08, 6 angles) : la
trouvaille la plus solide — désync `isLive`/`isDecided` sur le Bracket
(`LiveSeriesSubscriber.tsx` ne poussait en direct que le vainqueur, jamais
le statut) — corrigée le jour même (voir 2 entrées suivantes). Bouton
« Parier » trompeur sur série terminée corrigé aussi. 3 duplications de
code dédoublonnées : `parisDateTimeLabel()` (`lib/dates/paris.ts`,
6 copies), `RELEASED_BET_STATUSES` (`lib/labels/bets.ts`, 6 copies),
`clickableRowProps()` (`lib/hooks/clickableRow.ts`, 3 copies). Erreur
d'hydratation `NotificationSettings.tsx` (Profil, trouvée en marge des 9
commits audités) corrigée le jour même. Libellé "Hier" du Classement
(`RankTrend`) corrigé (`daysAgo`, "Il y a N jours" au-delà de la veille).
Nœud sans conférence de `SeriesDrillDown.tsx` : garde-fou ajouté (3e
colonne "rest"). Redirection `/play/bracket?round=X` → `/bracket` :
transformée en ancre + scroll dédié (le scroll natif du navigateur
n'avait pas lieu après l'hydratation Next.js). Committé et poussé
(`3ffe528`, `e9eca96`, `e0e87f7`, `79291d3`, `be31785`).

**Discussion produit** (`AVIS_EXPERT_16_08_2026.md`, 4 questions tranchées
par `AskUserQuestion`) : (1) bracket en arbre visuel connecté — **oui**,
codé dans la foulée (§2.65) ; (2) mécanique récurrente — **ni duel hebdo ni
boosters**, l'utilisateur préfère un système de notifications/popups à la
connexion (résumé depuis la dernière visite, badges débloqués, actus) —
**pas cadré ni codé**, reste ouvert ; (3) chat/couche sociale in-app —
**jugé utile**, **pas cadré ni codé** ; (4) priorité — pistes produit
d'abord, SMTP reste en pause.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (36 routes) propres après
chaque correctif. Comparaison concurrentielle (HoopCall/Scorecast/
ParidAmis) : nba-pronos en avance sur badges/bracket, en retard sur
chat/boosters/duel hebdo — détail dans `AUDIT_UX_16_08_2026.md` §5.
```

### 2.65 Bracket : l'arbre visuel connecté devient le mode principal, partout (session du 16-17/08/2026)

```text
Suite de la discussion produit ci-dessus (§2.64, point 1). Chantier mené en
plusieurs passes sur 2 jours, à chaque fois affiné par retour direct de
l'utilisateur.

**16/08 — traits de connexion** (`5e7c806`) : la Vue B (poster Ouest→
Finale→Est, existante depuis le 30/07) n'avait aucun trait entre les
séries. Nouveau `components/bracket/TreeConnectors.tsx` — SVG à la main,
mesure DOM réelle (`getBoundingClientRect` + `ResizeObserver`, la hauteur
des cartes n'est pas fixe), connecteurs en coude, couleur neutre
(`--color-border-strong`, jamais une couleur sémantique). Généralisé via
`getId`/`getNextId` pour être réutilisable entre consultation et
remplissage (voir plus bas). Bug de scroll trouvé et corrigé le jour même :
`justify-content: center` sur `.treeColumn` rendait le 1er tour partiellement
inatteignable en paysage mobile (débordement symétrique, un conteneur
scrollable ne scrolle jamais en négatif) — corrigé par marges auto
(`3ca8e1e`).

**16/08 — devient le défaut desktop/paysage, remplissage en poster
interactif** (`e416af3`, `2f97324`) : Vue B posée en défaut sur
desktop/paysage (Vue A reste seule vue sans scroll horizontal en portrait
mobile, inchangée). Remplissage (`/play/bracket`) passé lui aussi en
poster — 3 pièces génériques partagées entre consultation et remplissage
(`posterColumns.ts`, `TreeConnectors.tsx` généralisé, nouveau
`useImmersiveDefault.ts`) plutôt que dupliquées. Guidage automatique vers
la prochaine série à compléter (`FillPosterView.tsx`).

**17/08 — simplification radicale : l'arbre devient TOUJOURS l'écran
d'arrivée** (`f23a1ba`) : sur demande de l'utilisateur (« peu importe le
device »), toute détection de viewport (`useImmersiveDefault.ts`) retirée
au profit d'un simple `usePosterToggle.ts` (visible/masqué, sans media
query). « Quitter » déplacé en 1er élément du header. Cartes fusionnées
(demi-finales, finales de conf., Finale NBA) alignées sur le milieu de
leurs 2 parents (`alignMergedCards()`, tri topologique par passes,
`transform: translateY()`).

**17/08 — 2 correctifs de suite** : libellés de tour restés à leur
position flex d'origine après l'alignement des cartes, donc parfois sous
la 1re carte de leur colonne — corrigé (`alignColumnLabels()`, `d8a29a0`).
Finales de conférence + Finale NBA alignées sur une ligne COMMUNE (moyenne
des 3 positions), distinct de l'alignement individuel des demi-finales
(`cc14bf5`).

Vérifié en conditions réelles à chaque étape (Playwright, comptes réels et
sandbox, 4 largeurs de viewport pour l'étape finale) — traits, alignements
et guidage confirmés par mesure DOM et captures d'écran, jamais une
simple relecture de code. `tsc`/`eslint`/`vitest` (37/37)/`next build`
(36 routes) propres après chaque étape. Committé et poussé (`5e7c806`,
`3ca8e1e`, `e416af3`, `2f97324`, `f23a1ba`, `d8a29a0`, `cc14bf5`).
```

### 2.66 Admin : suppression manuelle d'un match (session du 17/08/2026)

```text
Origine : l'utilisateur (seul compte ADMIN) signale des matchs invisibles
dans « Mes matchs » — diagnostiqué PAS un bug (décalage horaire à la
saisie, `scheduled_at` déjà passé) mais révèle l'absence de toute fonction
de suppression manuelle (seule la synchro automatique en créait).

**Recherche préalable** : `matches` référencée par `match_predictions`/
`bets` SANS `ON DELETE CASCADE` — décision : ne jamais cascader, traduire
la violation de contrainte Postgres (23503) en message clair plutôt que de
forcer la perte de données. `lib/actions/admin-results.ts::deleteMatch()`
(même patron auth/écriture que `createMatch`/`saveMatchResult`, capture le
23503, recalcule `bracket_deadline`, journalise via `logAdminAction`).
`components/admin/DeleteMatchButton.tsx` (nouveau, dialogue de
confirmation irréversible, même patron que `CloseCompetitionButton.tsx`)
— bouton ajouté à `SeriesResultsCard.tsx`.

Vérifié en conditions réelles (rôle ADMIN accordé temporairement à un
compte bot, revert automatique) : suppression d'un match jetable réussie ;
suppression refusée avec le bon message quand un pronostic existe déjà
(match resté intact). `tsc`/`eslint`/`vitest` (37/37)/`next build`
(36 routes) propres. Committé et poussé (`4e21c00`).
```

### 2.67 Bracket : remise à zéro personnelle + correctifs remplissage (session du 17/08/2026)

```text
Demandé par l'utilisateur en testant le remplissage sur une compétition
fraîchement recréée (« Play offs test », après nettoyage des 10 comptes
bots de simulation du 14/08 — investigation FK préalable, même prudence
que §2.66, 0 ligne résiduelle vérifiée après coup).

**`resetBracket()`** (`lib/actions/bracket-fill.ts`) : remet
`brackets.is_validated`/`validated_at` à l'état initial puis vide les
`bracket_picks` (mise à `null`, pas de `DELETE` — RLS n'expose que
`_update` sur `bracket_picks`). Verrou de deadline détecté via l'absence
de ligne affectée (même patron que `validateBracket`).
`components/bracket-fill/ResetBracketButton.tsx` (partagé entre les 2
rendus de `/play/bracket`, teinté `--color-loss`).

**2 correctifs signalés par l'utilisateur en testant, même session** :
(1) l'écran ne se remettait à jour qu'après fermeture/réouverture — cause :
`useState(series.myPick...)` initialisé une seule fois au montage, jamais
resynchronisé après un `revalidatePath` ; corrigé par le patron React
officiel « adjusting state when a prop changes » (comparaison de signature
pendant le rendu, pas dans un effet — la 1re tentative via `useEffect`
avait été rejetée par `react-hooks/set-state-in-effect`). (2) latence
perçue entre le tap vainqueur et le tap score — cause : un seul
`useTransition` désactivait TOUS les boutons pendant l'aller-retour réseau
du 1er tap ; corrigé en retirant `disabled`, la sérialisation des 2
sauvegardes reportée sur une file d'attente manuelle (`Promise` chaînée).

**Autres correctifs remplissage** : boutons de score masqués tant
qu'aucun vainqueur n'est choisi ; guidage automatique (scroll vers la
prochaine série) limité à une seule fois au chargement, plus après chaque
pick.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (36 routes) propres après
chaque correctif. Committé et poussé (`b48112b`).
```

### 2.68 Paris en pop-up + score du poster en menu déroulant (session du 17/08/2026)

```text
Demandé par l'utilisateur (« le formulaire de pari en pop-up ? »). Périmètre
clarifié par `AskUserQuestion` : `/play/bets/new` et `/play/bets/[id]/edit`
(navigation pleine page jusqu'ici) — pas `InlineBetForm` (Matchs, déjà
inline), sauf extension demandée dans la foulée au Bracket (voir plus bas).

**`BetFormModal.tsx`** (portalé vers `document.body`, backdrop + boîte
centrée) : les 2 routes restent de vraies pages Next.js (tous les liens qui
y mènent inchangés), seul leur RENDU devient une fenêtre centrée. Les 3
`router.push("/play")` de `BetForm.tsx` remplacés par `router.back()`.
`components/ui/ModalDialog.tsx` extrait (coquille backdrop+dialogue
générique, `onClose` fourni par l'appelant) une fois l'utilisateur confirmé
vouloir la même pop-up DANS le Bracket — nouvelle prop
`InlineBetForm({ presentation: "inline" | "modal" })`, les 2 rendus de
`/play/bracket` passent `"modal"`, Matchs inchangé. Piège évité : `isOpen`
s'auto-ouvrait déjà pour un pari existant en mode inline — forcé à `false`
en mode modal, sinon la pop-up serait apparue seule au chargement de la
carte.

**Poster : scores repositionnés puis affinés en menu déroulant**
(`6396f1d`, `978fa97`) : d'abord sortis de la carte (empilés à côté, côté
centre du poster) — correctif same-session après retour utilisateur
(« ça fait bizarre hors de la carte », cartes de demi-finale/finale
agrandies par un `flex: 1` mal ciblé) : revenu à un score AFFICHÉ DANS la
carte, en menu déroulant natif, uniquement en face de l'équipe désignée
vainqueur — plus simple que la version précédente (plus de notion
gauche/droite pour les scores, juste `side` pour l'ordre bouton/menu dans
la ligne équipe).

Vérifié en conditions réelles à chaque itération (comptes réels et
sandbox ; une tentative de compte de test a échoué sur une panne Supabase
Auth transitoire, implémentation faite sans vérification visuelle cette
fois-là, annoncé explicitement, revérifiée à l'itération suivante).
`tsc`/`eslint`/`vitest` (37/37)/`next build` (36 routes) propres.
Committé et poussé (`6396f1d`, `978fa97`).
```

### 2.69 Accueil : icônes, liseré d'urgence, rang en avant, pastilles d'équipe, feed illustré (session du 18/08/2026)

```text
Demande ouverte de l'utilisateur (« améliorer l'aspect visuel de la page
d'accueil ») — cadrée par une maquette artifact (Actuel/Proposition, tokens
réels de `app/tokens.css`) validée avant tout code, même méthode que les
maquettes de Profil (§2.54) et Stats (§2.55).

**5 changements, purement visuels** (aucune donnée/mécanique touchée) :
icône par type d'item dans « À traiter » (nouveau
`components/icons/home-icons.tsx`, même patron que `nav-icons.tsx` —
`PlayIcon` de la nav réutilisée pour "matchs" plutôt que dupliquée) ;
liseré d'urgence (accent si deadline < 1h, neutre sinon) via un prop
`urgencyBorder` optionnel sur `Countdown.tsx` (off par défaut, n'affecte
pas `BracketSummary.tsx`, seul autre appelant) ; le rang devient le
chiffre hero de l'en-tête (`HomeHeader.tsx`), points/écart au leader en
secondaire ; pastilles d'équipe (`TeamLogo`, déjà utilisé par Bracket/
Matchs) sur le "prochain match" — `TodoItem` restructuré pour porter un
`matchup` structuré au lieu d'un texte pré-formaté (ferme un point noté
dans `GAPS_OUVERTS.md`) ; icône de résultat (✓/✗/–) dans le feed « Ça vient
de tomber », vert/rouge toujours strictement réservés au résultat.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (36 routes) propres. **Pas
testé au clic** : connexion à un compte de test bloquée par le classifieur
de permissions (recherche de l'email d'un compte via `service_role`
refusée) — vérifié au niveau type/build uniquement, signalé explicitement
à l'utilisateur. Committé et poussé (`b91df40`).
```

### 2.70 Mes paris : suppression d'un pari encore modifiable + boutons harmonisés (session du 18/08/2026)

```text
Demande de l'utilisateur : pouvoir supprimer un pari personnalisé (pas un
prono) encore présent dans « Mes paris ». Conflit trouvé et signalé AVANT
de coder (`AskUserQuestion`, 2 tours) : la rétention D2
(`SPEC_TECHNIQUE_V0.1_1.md` §7, « aucune suppression, nulle part » — pas de
backup sur le plan gratuit, effacer et le regretter est irrécupérable)
interdit tout vrai `DELETE` sur `bets`, confirmé par le commentaire du
trigger `enforce_bet_transitions` lui-même (« jamais de suppression,
seulement ce retour arrière »). Décision retenue avec l'utilisateur : le
bouton "Supprimer" reste honnête côté produit, mais sous le capot c'est un
passage à `CANCELLED` — transition déjà légale, déjà exclue du calcul de
quota, déjà anticipée par un commentaire de la vue badges du 09/08 (« un
pari retiré par le joueur ») — jamais reliée à un bouton jusqu'ici.

**`delete_bet(bet_id)`** (migration #29,
`20260818090000_delete_bet_function.sql`, SECURITY DEFINER, même patron
que `save_bet`/`withdraw_bet`) : DRAFT/SUBMITTED uniquement, motif dédié
« Retiré par toi avant revue. » (distinct d'une neutralisation admin),
`resolved_at` laissé `null` (aucun admin impliqué → n'apparaît pas dans le
feed de l'Accueil). `lib/actions/bets.ts::deleteBet` +
`components/my-bets/DeleteBetButton.tsx` (dialogue de confirmation, même
patron que `DeleteMatchButton.tsx`, §2.66).

**Harmonisation des boutons demandée dans la foulée** : Modifier/
Reproposer/Signaler à un admin/Envoyer passaient d'un lien souligné à un
texte nu à un bouton plein — 3 formes différentes pour des actions de
poids équivalent. Unifiés sur un seul gabarit contour (`.actionButton`,
`MyBetRow.module.css`), seule la couleur porte le sens désormais (accent/
loss/secondaire) ; `DeleteBetButton` aligné pixel pour pixel dessus.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (36 routes) propres. Migration
**pas encore poussée sur la base réelle** (`npx supabase db push` bloqué
par le classifieur de permissions, comme la vérification au clic de
§2.69) — à faire manuellement par l'utilisateur, voir `GAPS_OUVERTS.md`.
Committé et poussé (`91f398a`).
```

### 2.71 Onglet Jouer : cadrage de la fusion Mes pronos / Résultats (session du 18/08/2026)

```text
CADRAGE UNIQUEMENT — AUCUNE LIGNE DE CODE ÉCRITE. Demande ouverte de
l'utilisateur (« chantier plus dimensionnant, simplification de lecture et
navigation dans l'onglet jouer ») : remplacer le hub 2×2 actuel (Matchs /
Mes pronos / Mon bracket / Paris) par deux onglets — « Mes pronos »
(matchs à suivre + pronos/paris associés) et « Résultats » (matchs
chronologiques + pronos/paris + état/points) — les paris SÉRIE restant
visibles uniquement sur le Bracket.

**Cadrage par options, jamais tranché à l'aveugle** (3 tours
`AskUserQuestion`, méthode déjà utilisée sur les mockups Profil/Stats/
Accueil, cf. §2.54/§2.55/§2.69) :
1. Ampleur de la fusion : reskin léger du hub / fusion Matchs+Mes pronos
   seulement / **fusion totale y compris les paris MATCH — RETENUE**.
2. Structure de navigation : hub allégé à 3 cartes / **onglets internes
   sans hub, Bracket en point d'entrée permanent dans l'en-tête — RETENUE**.
3. **Conflit trouvé et signalé avant d'écrire la spec** : le cycle de vie
   d'un pari (statut DRAFT→…→WON/LOST/REJECTED/CANCELLED, piloté par
   l'admin) n'est PAS synchronisé avec celui de son match (piloté par
   l'heure) — un pari REJETÉ peut viser un match pas encore joué, un pari
   VALIDÉ peut rester non résolu après la fin du match (cas « pari
   oublié », `SPEC_ECRAN_MES_PARIS_V0_1` §7). Deux résolutions proposées :
   le MATCH décide toujours l'onglet (réutilise le principe déjà acté
   « écran ancré sur les matchs », `SPEC_ECRAN_MES_PRONOS_V0_1` §3) / le
   pari garde son propre statut indépendamment de son match. **Retenue :
   le match décide toujours** — un pari affiche son propre statut là où
   son match se trouve, y compris quand les deux « détonnent ».

**Spec écrite** : `Cadrage/V1/Spec visuelle/SPEC_REFONTE_ONGLET_JOUER_V0_1.md`
— remplace/fusionne 4 specs fermées (`SPEC_ECRAN_HUB_JOUER`,
`SPEC_ECRAN_MATCHS`, `SPEC_ECRAN_MES_PRONOS`, `SPEC_ECRAN_MES_PARIS`) sans
rouvrir leurs décisions de fond (rampe de statut, quotas, C2,
confidentialité) — seule la découpe écran/le rattachement pari↔match
changent. Fenêtre « Mes pronos » actée comme l'union exacte des deux
anciennes fenêtres (Matchs à venir + Récent 3j), pas une largeur nouvelle.

**Les 4 vérifications de dépôt levées en lecture seule, même session** :
deux ont changé la spec, pas juste confirmé. (1) La garde anti-perte de
saisie (C2, `useUnsavedGuard`) n'existe PAS sur le formulaire de pari
(`InlineBetForm`/`BetFormModal`) — seul le formulaire de prono l'a ;
extension documentée (spec §2.2). (2) La deadline d'un pari MATCH n'est
PAS indépendante de celle du prono comme la spec le supposait : la
fonction SQL `bet_deadline_open()` ferme les deux exactement au même
instant (`scheduled_at > now()`) — spec §3.3 corrigée : le CTA « Parier »
disparaît dès qu'un match se verrouille, aucun état transitoire. Les 2
autres vérifications (autres appelants de `getMyBets`, recensement des
liens entrants à rediriger — 5 fichiers d'écriture, 5 de lecture, 1
composant remplacé) n'ont rien changé de structurant, juste produit un
catalogue exhaustif (spec §2.1/§2.3). **Statut de la spec : prête à
implémenter, plus aucun blocage connu.**

**Les 4 écrans actuels (`/play` hub, `/play/matches`, `/play/my-predictions`,
`/play/bets`) restent inchangés et en production tels quels** — ni le
cadrage ni les vérifications de dépôt ne les ont touchés, aucune ligne de
code écrite à ce stade. Voir `GAPS_OUVERTS.md` pour le suivi de
l'implémentation à venir.
```

### 2.72 Onglet Jouer : implémentation de la fusion Mes pronos / Résultats (même session, 18/08/2026)

```text
Suite immédiate de §2.71. Demande de l'utilisateur : « ok on fonce ».
Implémentation complète de `SPEC_REFONTE_ONGLET_JOUER_V0_1.md`.

**Nouveau module `lib/queries/play.ts`** : fusionne `lib/queries/matches.ts`
+ `lib/queries/my-predictions.ts` + le calcul de quota de l'ex-`my-bets.ts`.
Deux fonctions de lecture, pas une seule comme l'esquisse de la spec le
suggérait (raffinement fait en codant) : `getPlayUpcoming()` (onglet Mes
pronos — union exacte des anciennes fenêtres Matchs + Récent, §3.1) et
`getPlayResults(params)` (onglet Résultats — ex-Historique, filtres
date/série/ligue inchangés). Une fonction interne `fetchLockedRows()`
partagée par les deux (verrouillé = lecture seule, prono ET pari) : mêmes
lignes, mêmes calculs, appelées deux fois avec des fenêtres différentes.

`lib/queries/matches.ts` **réduit à `TeamRef` seul** (pas supprimé) : 5
autres modules en dépendent (`admin-results.ts`, `bets.ts`,
`player-profile.ts`, `profile.ts`, `admin-missing.ts`) — vérifié par grep
avant de toucher au fichier, cf. §13.1 de la spec. `lib/queries/
my-predictions.ts` et `lib/queries/my-bets.ts` supprimés en entier (aucun
appelant restant une fois `/play/bets` et `/play/my-predictions`
disparus — vérifié).

**Bloc pari unifié** — `components/play/BetBlock.tsx` (lecture seule, fusion
de l'ex-`AssociatedBetCard` et de l'ex-`MyBetRow` : TOUS les statuts, motif
de refus/résolution, lien "Reproposer", correction "pari oublié") +
`InlineBetForm.tsx` (édition, réutilisé tel quel côté DRAFT/SUBMITTED). Une
ligne affiche l'un OU l'autre selon le statut du pari, jamais les deux.

**2 corrections trouvées EN CODANT, au-delà de ce que les vérifications de
dépôt avaient anticipé** :
- `DeleteBetButton` (suppression d'un pari, §2.70) n'avait plus AUCUN point
  d'entrée dans le nouveau design : l'ex-écran Mes paris (seul appelant)
  disparaît, et le chemin éditable retenu (`InlineBetForm`, patron de
  l'ex-écran Matchs) n'a jamais eu de bouton Supprimer. Repéré en écrivant
  `UpcomingRowForm.tsx`, pas avant. Corrigé en déplaçant `DeleteBetButton`
  dans `components/bets/` et en l'intégrant DANS `InlineBetForm` lui-même —
  bénéfice non demandé mais gratuit : les paris SÉRIE du Bracket (2e
  appelant d'`InlineBetForm`) en bénéficient aussi désormais, alors qu'ils
  n'avaient jamais eu de bouton Supprimer.
- La requête de correction d'un pari (`requestBetCorrectionFormAction`,
  "pari oublié") redirigeait vers `/play/bets` en dur, sans mécanisme
  `returnTo` — invisible tant qu'un seul écran existait, devenu un bug réel
  une fois le même formulaire accessible depuis les DEUX onglets (une
  correction déposée depuis Résultats aurait renvoyé à tort vers Mes
  pronos). Aligné sur le patron déjà en place pour la correction de prono
  (`requestPredictionCorrectionFormAction`, champ caché `returnTo`).

**Fichiers supprimés** : `app/(app)/play/matches/`, `app/(app)/play/
my-predictions/`, `app/(app)/play/bets/page.tsx` (new/ et [id]/edit/
conservés), `components/matches/*`, `components/my-predictions/*`,
`components/my-bets/{MyBetRow,SegmentTabs,DeleteBetButton}.*` (QuotaBanner
conservé), `components/play/PlayHubCard.*` (ex-hub, mort).

**Vérifié** : `tsc --noEmit` propre, `eslint` propre (1 seule erreur trouvée
et corrigée : `react-hooks/purity` sur `BracketEntry.tsx`, un `Date.now()`
appelé directement dans le corps du composant plutôt que dans une fonction
nommée à part — même patron que `deadlineLabel` juste au-dessus, qui lui
passait déjà), `vitest run` (37/37), `next build` (34 routes, contre 36
avant — cohérent : -2 routes, `/play/matches` et `/play/my-predictions`
disparues, `/play/results` apparue).

**PAS vérifié au clic** : nécessite une session authentifiée réelle,
non tentée dans cette session (pas de compte de test disponible sans
franchir le classifieur de permissions, cf. `claude_code_auto_mode_
classifier_blocks_credentials` en mémoire). Signalé explicitement à
l'utilisateur.

**Simplification assumée, documentée dans la spec dès le cadrage (§2.1)** :
`LeagueScopeChips` (filtre "des autres joueurs" par ligue) n'existe plus que
sur Résultats — l'ex-segment "Récent" de Mes pronos en bénéficiait, l'onglet
Mes pronos fusionné n'en a pas hérité (l'écran Matchs, dont il hérite aussi,
ne l'a jamais eu). Pas un oubli : receveur naturel si demandé un jour.

Rien commité — laissé à l'utilisateur de demander un commit s'il le
souhaite.
```

### 2.73 Avancement de la compétition active avec les comptes TestJoueur1-4 (session du 18/08/2026)

```text
Demande de l'utilisateur, après confirmation que la refonte « a l'air de
marcher » : faire avancer la compétition en cours en peuplant les comptes de
test existants (bracket, pronos, paris), plutôt que d'observer un écran vide.

**Lecture seule d'abord** (scripts jetables, supprimés après usage) : la
compétition ACTIVE est « Play offs test » (créée le 17/08/2026, 15 séries
déjà appariées au 1er tour, 1 seul match), et 4 comptes PLAYER déjà
existants et vierges — TestJoueur1 à TestJoueur4 — à côté des comptes réels
Demo_Amis et Rillettes-31 (bracket déjà validé, 1 prono, 1 pari — ni l'un ni
l'autre touchés). Contrairement à `seed-playoffs-simulation.mjs` (14/08),
PAS de nouvelle compétition à créer : celle-ci est réutilisée telle quelle,
reste ACTIVE, rien n'est archivé.

**`scripts/advance-current-competition.mjs`** (nouveau, conservé dans le
dépôt comme les autres scripts de seed) : réutilise les fonctions de
scoring/avancement de `seed-playoffs-simulation.mjs` À L'IDENTIQUE (copiées,
pas modifiées) mais ne crée ni compétition ni équipes ni séries ni comptes —
seulement des matchs (sur les 7 séries du 1er tour encore vides, mélange
volontaire terminé/en cours/pas commencé, une 8e série — MEM-MIN — laissée
SANS AUCUN match pour couvrir aussi ce cas), des brackets complets (15 picks
chacun) pour les 4 TestJoueur, des pronos sur tous les matchs (joués et à
venir), et 6 paris couvrant tous les statuts (DRAFT/SUBMITTED/WON/LOST/
REJECTED/CANCELLED). 2 bugs trouvés et corrigés en écrivant le script avant
de l'exécuter : `validated_by_admin_id` pointait par erreur vers le joueur
lui-même au lieu d'un admin (expression `"X" in objet` toujours fausse) ;
une expression bricolée dans le calcul des picks CONF_SEMIS était morte
(toujours vraie) — nettoyée avant tout run réel.

**Exécuté sans erreur**, vérifié en lecture ensuite : compétition toujours
ACTIVE (même id), 21 matchs (17 FINISHED/4 SCHEDULED), 85 pronos (68
scorés), 9 paris (tous statuts représentés), 5 brackets/75 picks, 2 séries
FINISHED avec vainqueur réellement avancé au tour suivant. Les 6 comptes
(dont Demo_Amis/Rillettes-31) restent ACTIVE, aucune donnée existante
touchée. Scripts d'inspection jetables supprimés après usage ; le script de
seed lui-même reste dans le dépôt, pas encore commité.

**Correctif le jour même, signalé par l'utilisateur** (« mon bracket marque
encore que je peux le modifier... et on ne voit pas l'avancement des séries
réelles ») : les 2 symptômes n'en faisaient qu'un. `advance-current-
competition.mjs` insérait des matchs SANS recalculer
`competitions.bracket_deadline` (contrairement à `recomputeBracketDeadline()`,
`lib/actions/admin-results.ts`, appelé par le vrai chemin d'écriture de
l'app) — la deadline restait bloquée sur l'heure de l'unique match antérieur
au seed (ce soir), alors que la plupart des matchs insérés sont plus anciens.
Conséquence en cascade repérée dans `app/(app)/play/bracket/page.tsx` §61 :
`/play/bracket` ne redirige vers `/bracket` (vue globale, seule à montrer
l'avancement officiel des séries) que si `isDeadlinePassed` est vrai —
resté faux, l'utilisateur restait donc coincé sur l'écran de REMPLISSAGE,
qui n'affiche jamais cet avancement. Corrigé en base (deadline recalculée
sur le vrai match le plus ancien) et dans le script lui-même (recalcul
ajouté, pour ne pas reproduire le bug si relancé un jour).
```

### 2.74 Bracket : score de série conservé après la fin, vainqueur en vert (session du 18/08/2026)

```text
Demande de l'utilisateur : « quand une série est finie, il faut simplement
surligner le vainqueur en vert et laisser le score comme il apparaît sur les
séries en cours ». Constat avant de coder : le score X-Y (LiveTeamRow) était
réservé aux séries IN_PROGRESS — une série FINISHED retombait sur le rendu
"équipes seules, sans score" (matchup simple), le vert du vainqueur étant la
SEULE information conservée.

**`lib/queries/bracket.ts`** : `liveScore` n'était calculé QUE pour les
séries IN_PROGRESS (2 endroits — la sélection des séries concernées ET le
champ exposé dans `BracketNode`) ; étendu aux deux aux séries FINISHED
également (SCHEDULED reste à `null`, rien à compter).

**`components/bracket/NodeCard.tsx`** : `LiveTeamRow` renommé `SeriesTeamRow`,
accepte désormais `highlight: "trend" | "win" | null` au lieu d'un booléen
`isLeading` — "trend" (déjà existant, `--color-trend`) pour l'équipe qui MÈNE
une série encore EN COURS, "win" (nouveau, `--color-win`) pour le VAINQUEUR
réel d'une série TERMINÉE, jamais les deux à la fois. La branche de rendu
bascule sur `node.liveScore !== null` (IN_PROGRESS OU FINISHED) au lieu de
`isLive` seul ; l'étiquette "En cours" et le mini-résumé du prono restent
réservés à `isLive`. `NodeCard` étant le seul point de rendu d'une série
(vérifié — `SeriesDrillDown` s'y appuie entièrement, aucun autre composant),
le correctif s'applique partout (Bracket global, drill-down, remplissage).

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres. **Pas
vérifié au clic** (même limite que §2.72/§2.73).
```

### 2.75 Bracket : points du pronostic affichés une fois la série finie (session du 18/08/2026)

```text
Demande de l'utilisateur, suite immédiate de §2.74 : « ajoute le nombre de
points entre parenthèse à la suite de mon prono dans le bracket si la série
est finie ».

**`lib/queries/bracket.ts`** : `BracketMyPick` gagne un champ `points:
number | null` (`— tant que non scoré, jamais 0`, même convention que les
pronos match) — la requête `bracket_picks` sélectionnait déjà tout SAUF
`points_awarded`/`scored_at`, ajoutés au select et au type `BracketPickRow`.

**`components/bracket/NodeCard.tsx`** : `MyPickContent` prend un nouveau
prop `showPoints`, qui ajoute ` (N pt(s))` après le prono UNIQUEMENT quand
vrai. Des 2 emplacements où ce composant est rendu, un seul peut
légitimement être FINISHED (celui de la ligne hors "En cours" — l'autre vit
STRICTEMENT dans la branche `isLive`, où `liveStatus` est déjà réduit au
type littéral `"IN_PROGRESS"` par le narrowing de TypeScript sur `isLive` :
comparer à `"FINISHED"` y est une erreur de compilation, à raison — remplacé
par `showPoints={false}` en dur, plus honnête que le comparateur mort qu'il
remplaçait).

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres. Pas
vérifié au clic (même limite que les entrées précédentes du jour).
```

### 2.76 Onglet Mes pronos : thème Photo perdu quand l'écran a du contenu (session du 18/08/2026)

```text
Signalé par l'utilisateur : « les nouveaux onglets... notamment mes pronos
était en thème sombre et non en thème image [Photo]. En revanche le thème
clair et sombre marchent bien ». Vrai bug de fusion, pas un problème de
réglage : `app/(app)/play/page.tsx` posait `photo-page` UNIQUEMENT sur
l'état vide (`isEmpty ? ... photo-page : ...`) — hérité tel quel de l'ancien
écran Matchs, qui avait ce même comportement conditionnel, mais qui n'avait
jamais posé problème puisque Matchs restait un écran séparé. Une fois fusionné
avec l'ex-Mes pronos (qui posait `photo-page` INCONDITIONNELLEMENT, comme
tous les autres écrans du site), l'onglet perdait le thème Photo dès qu'il
affichait le moindre contenu réel. `/play/results` n'avait pas ce bug (déjà
inconditionnel). Corrigé : `photo-page` posé sans condition sur `/play`,
comme sur les 8 autres écrans qui la posent déjà (`app/globals.css` : la
classe est structurelle, sans effet visuel hors thème Photo — aucun risque à
la poser tout le temps).

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres.
```

### 2.77 2e vague d'avancement de la compétition, après les pronos de l'utilisateur (session du 18/08/2026)

```text
Demande de l'utilisateur (« j'ai fait des pronos, tu peux avancer la
compétition encore ? ») — le compte réel Rillettes-31 avait posé 4 pronos
VALIDATED sur les 4 matchs alors SCHEDULED (ATL-BOS #1, DAL-DEN #4,
DET-IND #5, LAC-LAL #1). Lu en premier, jamais deviné : ces 4 matchs et
leurs séries respectives.

**`scripts/advance-current-competition-2.mjs`** (nouveau, suite de §2.73) :
résout ces 4 matchs (scores plausibles) et prolonge chaque série d'1 à 2
matchs supplémentaires (BKN-CHA/CHI-CLE déjà FINISHED, non touchées ;
DET-IND/DAL-DEN/GSW-HOU/ATL-BOS/LAC-LAL avancées, un match à venir laissé
sur chacune sauf DET-IND ; MEM-MIN reçoit son tout premier match). AUCUNE
ligne de Rillettes-31/Demo_Amis écrite (jamais INSERT/UPDATE/DELETE sur
leurs pronos/paris/bracket) — seuls les MATCHS sont touchés, les pronos
déjà posés par l'utilisateur se font scorer par la passe de scoring, comme
n'importe quel prono gelé sur un match qui se termine.

**Bug trouvé APRÈS exécution, assumé plutôt que recorrigé à chaud** :
DET-IND #5 a été résolu en pensant que `home_team_id` était IND (erreur de
lecture du commentaire du script, pas de la donnée elle-même) — DET a donc
gagné ce match au lieu d'IND, la série finissant 3-3 au lieu du 4-2 prévu.
Complété avec un match #7 décisif (SCHEDULED) plutôt que de réécrire
l'historique — script correctif replié dans le fichier principal après
coup, pour que sa lecture future reste honnête sur ce qui s'est vraiment
passé.

**Résultat pour l'utilisateur** : 3 pronos sur 4 corrects (ATL, DEN, LAC —
15/13/12 pts), 1 incorrect (IND prédit sur DET-IND #5, en réalité DET —
0 pt, à cause du bug ci-dessus). 30 matchs au total désormais (+9 depuis
§2.73), 124 pronos (+36 pour les 4 TestJoueur sur les nouveaux matchs +
la résolution des 4 de Rillettes-31). `bracket_deadline` vérifiée cohérente
après coup (aucun nouveau match antérieur au plus ancien existant).
```

### 2.78 Résultats : filtre par date en bandeau défilant (session du 18/08/2026)

```text
Demande de l'utilisateur : un filtre par date façon bandeau horizontal
défilant (« ressemble à celui de MPP ») — une pastille par jour, ancien à
gauche, récent à droite, clic = filtre sur ce jour — à la place de l'ancien
`<input type="date">` de `FilterBar.tsx`.

**`components/play/DateStrip.tsx`** (nouveau — voir §2.79 pour son passage
ultérieur en "use client" le même jour) : une pastille "Tous" + une par
date de
`availableDates` (lib/queries/play.ts), triées ICI en ascendant (la source
est descendante, convention héritée de l'ex-écran Mes pronos où la LISTE se
lit anti-chronologique — pas changée en amont pour ne rien risquer ailleurs).

**`FilterBar.tsx` réduit au filtre série seul** : les 2 filtres (date via
DateStrip, série via ce formulaire) sont désormais INDÉPENDANTS — changer
l'un préserve l'autre via un champ caché plutôt que tout remplacer,
contrairement à l'ancienne puce unique "Filtre : X ✕" qui les confondait.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres.
```

### 2.79 DateStrip : défilement auto au chargement + barre masquée (session du 18/08/2026)

```text
2 ajustements demandés dans la foulée de §2.78 : « qu'on arrive sur l'onglet
à la date du jour » + « enlever la barre de scroll (on sait qu'il faut
défiler de gauche à droite) ».

`DateStrip.tsx` passe "use client" — UNIQUEMENT pour le défilement
automatique au montage (même patron que le guidage du poster de
remplissage, §2.67 : une fois au chargement, jamais après). Les pastilles
restent de vrais `<Link>`, navigables sans JS. Défile vers la pastille
ACTIVE si une date est filtrée, sinon vers la plus RÉCENTE (bord droit) —
Résultats ne contenant jamais "aujourd'hui" (fenêtre > 3 jours), le bord
droit en est l'équivalent le plus proche. Bug trouvé en écrivant, corrigé
avant de tester : "Tous" et la pastille la plus récente se disputaient la
même ref React dans le cas non filtré — retiré de "Tous", qui n'a rien à
révéler en défilant.

Barre de défilement masquée en CSS (`scrollbar-width`/`-ms-overflow-style`/
`::-webkit-scrollbar` — les 3 nécessaires, aucune propriété unique ne
couvre tous les moteurs), défilement lui-même toujours pleinement
fonctionnel (souris, tactile, clavier).

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres.
```

### 2.80 Mes pronos/Résultats : partage par statut, plus par fenêtre de 3 jours (session du 18/08/2026)

```text
L'utilisateur remarque que le DateStrip de Résultats s'arrête au 14/08 alors
que la compétition a des matchs après. Réponse initiale : comportement
VOULU (décision 4 de la spec, fenêtre de 3 jours — un match FINISHED du
16/08 reste dans Mes pronos tant qu'il a moins de 3 jours). Jugé indésirable
par l'utilisateur : « tout ce qui est finished doit être dans résultats et
pas dans mes pronos ».

**Décision 4 abandonnée** (`SPEC_REFONTE_ONGLET_JOUER_V0_1.md` §14,
amendement post-implémentation) : le partage entre les 2 onglets se fait
désormais par STATUT, plus par fenêtre de temps —

```text
Mes pronos (verrouillé) : matches.status <> 'FINISHED'
Résultats               : matches.status =  'FINISHED'
```

`lib/queries/play.ts` : `fetchLockedRows` prend un critère `{ finished:
boolean; dateRange? }` au lieu d'une fenêtre `{gte, lte, lt}` ;
`BACK_WINDOW_DAYS`/`cutoffIso` supprimés en entier (plus aucune notion de
fenêtre temporelle sur ce partage) ; `getAvailableFilters` (dates/séries
proposées par le filtre de Résultats) dérivé de `status = 'FINISHED'` au
lieu d'un cutoff.

**Précision actée avec vigilance, pas une réouverture du principe "jamais
filtrer sur le statut"** (T4/A8, répété dans tout le projet) : ce principe
protège le VERROUILLAGE (une écriture, un enjeu d'équité). Ici c'est un
choix d'AFFICHAGE pur entre 2 vues en lecture seule — un match qui reste
`IN_PROGRESS` 30-60 min de plus que la réalité (latence du planificateur)
reste juste 30-60 min de plus dans Mes pronos, sans aucun enjeu de
correction. Referme au passage un point ouvert déjà noté dans la spec (§3.1)
sur l'ancienne règle. Point ouvert non traité, symétrique de l'ancien :
un match POSTPONED/CANCELLED déjà verrouillé ne devient jamais FINISHED,
resterait dans Mes pronos indéfiniment — non rencontré dans les données
actuelles, non tranché.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres.
```

### 2.81 Nettoyage : matchs FINISHED avec une date dans le futur (session du 18/08/2026)

```text
Demande de l'utilisateur : « nettoyer... pour qu'il n'y ait pas de matchs
qui soient terminés alors qu'ils sont programmés dans le futur ». Bug réel
laissé par les 2 scripts d'avancement (§2.73/§2.77) : en marquant un match
FINISHED, `status`/`home_score`/`away_score` étaient bien écrits, mais
`scheduled_at` restait à sa valeur d'origine — souvent future, puisque
c'étaient justement les "prochains matchs déjà programmés" qu'on résolvait.

**Lecture d'abord** (`scripts/find-inconsistent-dates.mjs`, jetable) : 7
matchs incohérents trouvés (GSW-HOU #3, ATL-BOS #1-2, LAC-LAL #1, DET-IND
#5-6, DAL-DEN #4) — tous FINISHED avec `scheduled_at` encore dans le futur.

**`scripts/fix-future-finished-dates.mjs`** (conservé) : recule uniquement
`scheduled_at` de ces 7 matchs dans le passé, en préservant l'ordre
chronologique interne à chaque série (après le match FINISHED précédent,
avant le prochain SCHEDULED) — AUCUN autre champ touché (status/scores/
pronos/paris/picks intacts, la liaison se fait par `match_id`, jamais par
date). Vérifié après coup : 0 incohérence restante, `bracket_deadline`
toujours correcte (aucune des 7 nouvelles dates n'est antérieure au match
du 02/08, qui reste la plus ancienne).
```

### 2.82 Résultats : détail des points du prono entre parenthèses (session du 18/08/2026)

```text
Demande de l'utilisateur : afficher entre parenthèses, à la suite des
points gagnés sur un match, le détail (pronostic/écart/paris). Options
présentées (`AskUserQuestion`) : décomposer seulement le prono, ou fusionner
prono + pari en un seul total décomposé en 3. **Choix : décomposer
seulement le prono** — le pari garde son propre total séparé, inchangé
(déjà un seul chiffre, rien à décomposer).

`MyPrediction` (`lib/queries/play.ts`) gagne `winnerPoints`/`marginPoints`
(colonnes `winner_points`/`margin_bonus_points`, déjà en base — juste
absentes du SELECT jusqu'ici ; `points_awarded` en est la somme déjà faite
par une colonne générée). Même convention que `points` : `null` tant que
non scoré, jamais 0 — mais UNE FOIS scoré, une composante à 0 s'affiche
telle quelle (0 pt d'écart est un vrai résultat, pas un "non scoré").

`components/play/PredictionSummary.tsx` : « 15 pts (10 pronostic, 5
écart) ». Nouvelle classe `.pointsDetail` (texte secondaire, plus petit).

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres.
```

### 2.83 Accueil : le feed « Ça vient de tomber » mène à l'item d'origine (session du 18/08/2026)

```text
Demande de l'utilisateur : que cliquer sur un item du feed mène à l'item
affiché. `FeedItem` (lib/queries/home.ts) gagne un champ `href` :
- `match_scored` -> `/play/results#match-{matchId}` (une prédiction scorée
  vise TOUJOURS un match FINISHED, donc toujours côté Résultats, jamais Mes
  pronos — §14 SPEC_REFONTE_ONGLET_JOUER) ;
- `bet_scored`/`bet_resolved`, scope MATCH -> même ancre que ci-dessus ;
  scope SERIES -> `/bracket#series-{seriesId}` (même patron que
  `getSeriesBetsTodo`, plus haut dans le même fichier).

**2 ancres manquantes trouvées et ajoutées en creusant** (ni Résultats ni le
Bracket global n'exposaient de cible pour ces liens jusqu'ici) :
`id={`match-${row.matchId}`}` sur `LockedRow.tsx` (n'existait que sur
`UpcomingRow.tsx`, écran Mes pronos) ; `id={`series-${node.nodeId}`}` sur
`NodeCard.tsx` (n'existait que sur les cartes de l'écran de REMPLISSAGE du
bracket, jamais sur la vue globale de consultation — donc jamais sur
`/bracket`, la cible réelle une fois une série/un pari série résolu).

`components/home/FeedRow.tsx` : `<li>` devient un simple conteneur, le
contenu passe dans un `<Link>` (repli en `<div>` si `href` est `null` — cas
défensif, cible introuvable, ne devrait pas arriver en pratique). Reset
CSS `text-decoration`/`color: inherit` pour rester visuellement identique
à l'ancien `<li>` statique.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres.
```

### 2.84 Correctif : lien du feed atterrissait sur la bonne page, pas la bonne ligne (session du 18/08/2026)

```text
Signalé par l'utilisateur en testant §2.83 : un lien du feed vers
`/play/results#match-XXX` arrivait bien sur Résultats mais pas sur le match
visé. Cause : `DateStrip.tsx` (§2.79) défile automatiquement vers sa propre
cible (date active ou plus récente) AU MÊME MOMENT que le scroll natif du
navigateur/Next.js vers l'ancre `#match-XXX` — les deux se déclenchent au
montage, et celui de DateStrip repassait en dernier, ramenant la page vers
le bandeau de dates (en haut) plutôt que vers la ligne du match plus bas.

Corrigé par une garde simple dans `DateStrip.tsx` : si `window.location.hash`
est déjà posé (une ancre existe dans l'URL), le défilement automatique du
bandeau ne se déclenche pas — l'ancre déjà présente a toujours priorité.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres. Bug
trouvé au clic par l'utilisateur (serveur de dev relancé au préalable, 2
instances en double coupées) ; correctif pas encore reconfirmé au clic à
ce stade.
```

### 2.85 Feed : le lien mène aussi au bon jour, pas seulement à la bonne ligne (session du 18/08/2026)

```text
Suite immédiate : « ça amène bien sûr le match en particulier mais pas en
cochant le jour concerné, on reste sur général ». L'ancre `#match-XXX`
(§2.83) suffisait pour le scroll mais pas pour que le bandeau de dates
(DateStrip) coche le bon jour — il faut aussi `?date=YYYY-MM-DD` dans l'URL.

**`parisDateKey` extrait dans `lib/dates/paris.ts`** (2e utilisateur,
au lieu d'une 3e implémentation divergente — même raison que
`parisDateTimeLabel` juste à côté) : c'était `localDateKey`, dupliqué en
LOCAL dans `lib/queries/play.ts` (4 appels) — remplacé par l'import partagé
là-bas, et réutilisé ici dans `lib/queries/home.ts`.

**`lib/queries/home.ts`** : `matchHref(matchId, scheduledAt)` construit
`/play/results?date=...#match-{id}` ; `betHref` pour un pari MATCH
réutilise la même fonction avec la date de SA cible. La collecte des
matchs à dater est étendue : avant, seuls les matchs des pronos scorés
étaient requêtés ; désormais aussi ceux des paris MATCH (2 sources
distinctes, pas toujours les mêmes matchs) — `scheduled_at` ajouté au
SELECT existant.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres. Pas
encore reconfirmé au clic à ce stade.
```

### 2.86 Accueil : numéro de match dans « À traiter » (session du 18/08/2026)

```text
Demande de l'utilisateur : ajouter le numéro du match dans sa série à
côté du prochain match à pronostiquer dans « À traiter » (« si c'est le 3e
match de la série écris "Game 3" »).

`TodoItem["matchup"]` (lib/queries/home.ts) gagne `gameNumber: number` —
`game_number` déjà en base, juste ajouté au SELECT de `getMatchesTodo` et
passé à travers `describeUpcomingMatch` (seul appelant, signature étendue
sans risque). `components/home/TodoRow.tsx` : « Prochain : [logos] BOS –
ATL · Game 3 ».

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres.
```

### 2.87 Accueil : numéro de match aussi dans la section Paris (session du 18/08/2026)

```text
Suite du 2.86 : le numéro de match manquait dans le second bloc de « À
traiter », celui des paris MATCH encore possibles (`getRemainingMatchBets`,
lib/queries/match-bets.ts — pas `getMatchesTodo`, module distinct).

Même traitement : `MatchRow` gagne `game_number: number`, ajouté au
SELECT de `getRemainingMatchBets()`. `matchLabel()` prend un paramètre
`gameNumber` de plus, libellé « BOS vs MIA · Game 3 · 25/07 21:00 ».
Seul appelant du module (`lib/queries/home.ts`, vérifié par grep) —
changement de signature sans risque.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres.
```

### 2.88 Accueil : numéro de match aussi dans « Ça vient de tomber » (session du 18/08/2026)

```text
Troisième et dernier bloc de l'Accueil concerné par la demande du numéro
de match : le feed « Ça vient de tomber » (getFeed(), lib/queries/home.ts)
n'affichait que le score (« BOS 102 - 98 ATL ») sans le numéro du match
dans sa série.

`MatchScoreRow` gagne `game_number: number`, ajouté au SELECT sur
`matches`. Libellé du feed match_scored : « Game 3 · BOS 102 - 98 ATL ».
Les items bet_scored/bet_resolved gardent `bet.description`, texte libre
saisi par le joueur à la création du pari — non touché ici (pas de format
imposé à réécrire).

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres.
```

### 2.89 Accueil : cartes dépliables (session du 18/08/2026)

```text
Demande de l'utilisateur : les 4 cartes de l'Accueil (« À traiter », « À
traiter (admin) », « Paris », « Ça vient de tomber ») deviennent
dépliables — repliées par défaut au chargement, avec un point d'alerte
tant qu'une carte n'a jamais été ouverte sur l'appareil (clarifié par
AskUserQuestion : portée = les 4, état initial = fermé + voyant).

Nouveau `components/home/CollapsibleCard.tsx` (client) : en-tête
cliquable (patron `clickableRowProps` de BetGroupRow.tsx, chevron ⌃/⌄),
titre en `<h2>` englobant la zone cliquable (disclosure widget WAI-ARIA
standard, pas l'inverse). Mémorisation "déjà ouverte" en localStorage
(`home-card-seen:{id}`, par appareil — aucune colonne serveur pour une
simple préférence d'affichage). Lecture via `useSyncExternalStore`
plutôt qu'un `useEffect`+`setState` : le lint react-hooks/set-state-in-
effect interdit le setState synchrone dans un effet, et localStorage EST
un store externe — snapshot serveur toujours `false`, aucun flash au
premier rendu client.

`app/(app)/home/page.tsx` : les 4 `<section>` gardent leur wrapper
`glass-card`/`aria-label` inchangé, le titre + contenu passent dans
`<CollapsibleCard id="..." title="...">`. `page.module.css` : `.section-
Title` supprimée (remplacée par `CollapsibleCard.module.css`, plus
utilisée nulle part ailleurs dans ce module).

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres. Pas de
navigateur disponible dans cet environnement pour un test au clic — à
vérifier par l'utilisateur.
```

### 2.90 Accueil : compteur sur les cartes repliées + renommages (session du 18/08/2026)

```text
Suite immédiate du 2.89. Deux demandes : (1) afficher un chiffre à côté
du titre de chaque carte, visible même repliée, pour savoir si elle
contient quelque chose sans l'ouvrir ; (2) renommer « À traiter » en
« Reste à faire » et « Paris » en « Paris disponibles » (les 2 autres
titres, « À traiter (admin) » et « Ça vient de tomber », inchangés).

`CollapsibleCard` gagne un prop `count: number`, rendu en pastille
(`.count`, fond `--color-surface-inset`, `border-radius: --radius-pill`)
à côté du chevron — toujours affiché, y compris à 0 (plus informatif
qu'un badge masqué : "carte vide" devient visible sans ouvrir).
`app/(app)/home/page.tsx` passe `count={todo.length}` /
`count={adminTodo.length}` / `count={seriesBets.length +
matchBets.length}` / `count={feed.length}`.

Renommages : titre ET `aria-label` de la `<section>` mis à jour ensemble
(cohérence lecteur d'écran / affichage visuel) pour les 2 cartes
concernées. Les commentaires internes de lib/queries/home.ts référençant
« À traiter »/« À traiter (admin) » comme noms de spec (§4/§5) NON
renommés — ce sont des repères vers SPEC_ECRAN_ACCUEIL, pas le texte
affiché.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (34 routes) propres.
```

### 2.91 SMTP résolu (Gmail) + bug signup + URL Configuration (session du 19/08/2026)

```text
Reprise du point ouvert depuis le 16/08 (GAPS_OUVERTS.md, décision SMTP en
pause). Demande de l'utilisateur : débloquer inscription + reset mot de
passe pour de vrais joueurs, sans acheter de domaine vérifié Resend.
Décision confirmée par AskUserQuestion : SMTP Gmail perso plutôt que retour
au mailer Supabase natif (limite plus haute, ~500/jour, livrable à
n'importe quelle vraie adresse).

Config Gmail SMTP : mot de passe d'application généré côté Google, saisi
directement dans le dashboard Supabase (host smtp.gmail.com, port 587) —
jamais transmis dans le chat, contrairement à l'incident avec la clé Resend
(16/08). Fait par l'utilisateur lui-même (accès dashboard + secret).

Bug réel trouvé en testant une vraie inscription (lib/auth/actions.ts,
signup()) : le garde-fou anti-énumération ajouté le 16/08
(!signUpData.session || identities.length === 0 → "compte existe déjà")
mélangeait 2 cas distincts. identities.length === 0 est le vrai signal
d'un compte existant confirmé. Mais !session seul arrive AUSSI pour un
compte tout neuf, tant que Confirm email est actif en prod (aucune session
avant le clic sur le lien) — ce réglage s'est avéré actif malgré le
"décoché et sauvegardé" du 27/07 (GAPS_OUVERTS.md, jamais confirmé
fiable), probablement laissé ainsi pendant les tests Resend d'août.
Résultat avant correctif : toute inscription légitime affichait "compte
existe déjà" alors que le compte était bien créé (vérifié en base —
nouvelle ligne auth.users, email_confirmed_at null).

Corrigé : les 2 cas séparés. identities.length === 0 → message d'erreur
inchangé. !session (identity non vide) → redirect("/verify-email"),
nouvelle page (app/(public)/verify-email/page.tsx).

Lien de confirmation par email : signUp() prend maintenant
options.emailRedirectTo: ${origin}/email-confirmed (origine lue via
headers(), async depuis Next 15/16 comme cookies() dans
lib/supabase/server.ts). Nouvelle page app/(public)/email-confirmed/
page.tsx ("Adresse confirmée, connecte-toi").

2e bug trouvé en testant le clic sur le lien : atterrissait directement
sur la page de connexion au lieu de /email-confirmed. Cause, vue en
capture d'écran du dashboard : Site URL réglé sur http://localhost:3000
(jamais mis à jour vers le domaine de prod) et aucune Redirect URL
enregistrée — tout lien de redirection retombe sur Site URL si la cible
n'est pas dans l'allow-list, proxy.ts vérifié innocent (rien côté notre
app ne redirige /email-confirmed). Corrigé côté dashboard : Site URL →
https://nba-pronos.vercel.app, Redirect URLs → wildcard
https://nba-pronos.vercel.app/** (+ http://localhost:3000/** pour le dev
local).

Vérifié en conditions réelles par l'utilisateur, bout en bout :
suppression du compte de test, réinscription, réception de l'email de
confirmation, clic → atterrit bien sur /email-confirmed, connexion OK.
« Tout fonctionne nickel. »

tsc/eslint/vitest (37/37) propres après chaque étape. Committé et poussé
(4f08f7c).

Reste ouvert (GAPS_OUVERTS.md) : personnaliser le contenu du template
email de confirmation (dashboard Supabase, actuellement générique et en
anglais) — à faire plus tard, pas urgent.
```

### 2.92 Mes pronos : carte match — logos visibles + fusion sélection/en-tête (session du 19/08/2026)

```text
Demande de l'utilisateur : retravailler la carte match de l'onglet Mes
pronos (UpcomingRow.tsx). Clarifiée par AskUserQuestion (multi-select) :
repenser la mise en page globale, logos d'équipe plus visibles, et — a
minima — supprimer le doublon d'infos d'équipe (« enlever celle avec la
couleur, garder les logos seuls »).

Cause du doublon, trouvée en lisant le composant : l'en-tête (toujours
visible) affichait un chip coloré en dégradé par équipe avec l'abréviation,
logo réduit à un filigrane à peine visible (opacity 0.2) — puis, une fois
la carte ouverte, TeamPicker (composants/play/TeamPicker.tsx) affichait à
nouveau les 2 équipes, cette fois avec le VRAI logo (TeamLogo, net) et le
nom complet. Même info montrée deux fois, avec deux traitements visuels
différents.

**1er passage** : en-tête aligné sur le style neutre de LockedRow.tsx
(TeamLogo + abréviation, sans dégradé coloré) — chip coloré retiré,
helpers hexToRgb/shade/contrastTextColor/teamChipStyle et l'import
TEAM_COLORS supprimés (plus utilisés). Le doublon avec TeamPicker
persistait encore à ce stade (2 représentations différentes des mêmes 2
équipes, juste toutes les deux neutres maintenant) — signalé par
l'utilisateur après vérification au clic : « on a toujours un doublon ».

**2e passage, fusion complète** : proposition de l'utilisateur — les logos
de l'en-tête deviennent directement les boutons de sélection, un tap
choisit le vainqueur ET déplie la carte. Confirmé par AskUserQuestion
(interaction retenue : tap sur un logo = sélectionne + déplie ; tap sur
l'heure/le statut = déplie seul, sans rien choisir).

Implémentation : l'état `winner` (vainqueur choisi) est LEVÉ de
UpcomingRowForm vers UpcomingRow — les boutons logo de l'en-tête sont
TOUJOURS montés (contrairement au formulaire, monté seulement une fois la
carte ouverte), ils doivent donc porter cet état pour pouvoir le modifier.
`margin` reste local à UpcomingRowForm (pas de bouton d'en-tête concerné).
`.teams` passe en grille 2 colonnes pleine largeur (`1fr 1fr`), pour rester
alignée avec la grille identique de MarginStepper une fois la carte
ouverte (le "−"/"+" doit tomber sous la bonne équipe — alignement
intentionnel déjà documenté dans MarginStepper.tsx, préservé). En-tête
restructuré : n'est plus UN SEUL `<button>` englobant tout (boutons
imbriqués invalides en HTML) — devient un conteneur avec 2 boutons de
sélection + 1 bouton `.metaToggle` séparé (heure/verrou/statut/chevron)
qui déplie sans toucher à la sélection.

Piège react-hooks/set-state-in-effect (déjà rencontré §2.89) : la remise à
zéro du brouillon non enregistré à la fermeture ne peut pas passer par un
useEffect (setState synchrone interdit dans un effet) — déplacée dans
handleToggle, l'event handler qui ferme la carte, où c'est un setState
normal déclenché par une action utilisateur.

`components/play/TeamPicker.tsx` + son CSS **supprimés** (plus aucun
usage après la fusion — vérifié par grep avant suppression).

**Vérifié visuellement** (screenshots via un compte de test jetable créé/
supprimé par service_role + Playwright, aucun accès navigateur natif dans
cet environnement) : carte repliée (logos nets, 2 boutons), tap sur un
logo (sélectionné + dépliée, stepper d'écart aligné dessous), tap sur la
zone heure/statut d'une autre carte (dépliée sans sélection, stepper
masqué comme attendu tant qu'aucun vainqueur n'est choisi). Aucune erreur
console. `tsc`/`eslint`/`vitest` (37/37) propres.

Committé et poussé (`bc7cc68`), avec le rattrapage doc SMTP (§2.91) dans
le même commit.
```

### 2.93 Ajustements visuels validés — implémentation, 6 commits (session du 20/08/2026)

```text
Suite d'une session de design séparée (Cowork, sans accès navigateur au
site déployé, analyse + maquettes construites directement sur le code
source et les vraies variables app/tokens.css/app/globals.css) :
`Cadrage/DA/AJUSTEMENTS_VISUELS_20_08_2026.md` liste 4 chantiers validés en
round 1 (§1-§4) + 4 de plus validés en round 2 après une demande explicite
de pistes "innovantes" (§9/§14/§15/§16). Cette session implémente les
chantiers marqués VALIDÉ, un commit par chantier, dans l'ordre suggéré au
§6/§11 du document. Question posée avant de commencer : signaler si un
chantier n'était pas assez précis pour être codé sans ambiguïté — aucun
blocage réel, 2 petits appels de jugement pris et signalés (détail
JOURNAL_SESSIONS.md).

**Police — Sora + Oswald** (`4006514`) : `--font-ui` (Inter jamais
chargée, Geist chargée mais jamais consommée, Arial héritage
create-next-app en repli de fait) devient Sora ; `--font-display`/
`--font-numeric` deviennent Oswald (condensée, chiffres/rangs) — les deux
regroupées dans ce commit comme suggéré au §11 (aucune codée encore).
Auto-hébergées via `next/font/google`. `<title>`/`description` corrigés
dans la foulée (même fichier, changement trivial).

**Login/Signup/Reset password** (`1572a90`) : restyling complet aux
tokens (CSS Module partagé `components/auth/AuthScreen.module.css`),
seuls écrans encore sur Tailwind par défaut. `photo-page` + `glass-card` +
bloc marque au-dessus. Exception : état "Vérifie ta boîte mail" du reset
reste sans carte (info pure). Message de reset réussi en
`--color-text-secondary`, pas `--color-win` (vert réservé au résultat
d'un match/pari, R-COL).

**Profil joueur public** (`bfab0c5`) : `photo-page`/`glass-card` sur
`/players/[userId]`, mise en conformité avec le reste de l'app (pas un
nouveau pattern).

**Profil / onglet Stats** (`cf70066`) : 5 sections enveloppées dans
`CollapsibleCard` (Précision/Comparaison ouvertes par défaut, Évolution du
classement/Paris/Badges repliées) pour réduire le scroll mobile.
`CollapsibleCard` étendu (`count` optionnel, nouveau prop `defaultOpen`)
pour ce nouvel usage — non prévu dans le document, décision prise en
implémentant.

**Bracket, badge "En cours"** (`ccf854e`) : `--color-accent` (orange, déjà
pris par `.betButton` sur la même carte) remplacé par `--color-live`
(rouge, déjà le bon token ailleurs pour ce statut). Teinte de fond/bordure
de `.cardLive` retirée entièrement.

**Ticker Jouer/Mes pronos — À L'ESSAI** (`0214914`) : seul chantier du lot
pas marqué VALIDÉ définitivement — traité en commit séparé comme demandé,
message de commit détaillant la marche à suivre pour le retirer. Nouveau
composant `components/play/LiveTicker.tsx`, recompose seulement des
données déjà affichées sur la page (scores `recentLocked` + prochain match
non `VALIDATED`), décoratif (`aria-hidden`), défilement neutralisé sous
`prefers-reduced-motion`.

**Pas codé cette session** : §12 du document (photo de profil) —
explicitement "non tranché, à reprendre avant de coder" PAR LE DOCUMENT
LUI-MÊME (bucket Supabase Storage à créer, format/recadrage non décidés).
§13 (identité de marque) — feuille de route, pas un chantier à coder.
Voir `GAPS_OUVERTS.md` pour le suivi de ces 2 points.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (36 routes) propres après
CHAQUE commit. 6 commits poussés sur `main` (`a3f43ed..0214914`).
```

### 2.94 Fix : fond blanc sur Login/Signup/Reset en prod Vercel (session du 20/08/2026)

```text
Signalé par l'utilisateur après déploiement : fond blanc sur Login/Signup/
Reset (§2.93) au lieu du fond sombre attendu — pas repéré avant (aucun
accès navigateur natif dans cet environnement, seuls tsc/eslint/next build
avaient été vérifiés après le chantier §2.93, pas un rendu réel).

Cause trouvée : `body` (app/globals.css) utilisait encore `--background`/
`--foreground`, reliquat du scaffold create-next-app — blanc par défaut,
piloté par `prefers-color-scheme` (OS), jamais branché sur le vrai système
`[data-theme]` de l'app. `html`, lui, pose déjà le bon fond
(`--color-surface-base`) — mais `body` (opaque, par-dessus) le masquait
partout où rien d'autre ne repeint dessus. Les écrans avec un wrapper
`ScreenShell`/`.shell` (Classement, Bracket, zone connectée) le
repeignaient déjà correctement, d'où le bug resté invisible jusqu'ici —
Login/Signup/Reset (restylées en §2.93, sans ce wrapper) l'ont rendu
visible en prod.

**Corrigé** : `body` reprend les mêmes tokens que `html`
(`--color-surface-base`/`--color-text-primary`). `--background`/
`--foreground` et leur bloc `@theme inline` (`--color-background`,
`--color-foreground`, `--font-sans`, `--font-mono`) supprimés entièrement
— vérifié par grep qu'aucune classe Tailwind (`bg-background`,
`text-foreground`, `font-sans`, `font-mono`) ne les consommait nulle part
dans le code : reliquat mort, pas juste une valeur à corriger.

`tsc`/`next build` (36 routes) propres. Committé et poussé (`8aeb6f9`).

Note de méthode pour la suite : ce bug n'aurait pas existé si le rendu
avait pu être vérifié visuellement après §2.93, comme demandé par défaut
pour les changements UI — limite connue de cet environnement (pas d'accès
navigateur), signalée explicitement plutôt que supposée réglée.
```

### 2.95 Login/Signup/Reset : photo forcée même sans session (session du 20/08/2026)

```text
Suite immédiate de §2.94 : après le fix du fond blanc, l'utilisateur
signale que le fond reste sombre uni, pas la photo attendue.

Cause, PAS un bug — comportement d'origine : `.photo-page` n'affiche une
image que sous `[data-theme="photo"]`, jamais posé pour un visiteur non
connecté (défaut DARK dans `app/layout.tsx`, même règle que /leaderboard
et /bracket, décision pré-existante citée par le document de design §1
comme justification de cohérence). Donc fond sombre uni en pratique sur
Login/Signup/Reset pour tout nouveau venu, jamais la photo.

Vérifié avec l'utilisateur avant de coder (AskUserQuestion, 3 options :
forcer sur ces 3 écrans seulement / forcer partout pour un visiteur sans
session / laisser tel quel) — **choix : forcer la photo sur Login/Signup/
Reset uniquement**, /leaderboard et /bracket restent liés à la préférence
utilisateur, inchangés.

Nouvelle classe `.force-photo` (app/globals.css), combinée à `.photo-page`
sur le wrapper des 3 pages : reprend les mêmes règles `::before`/`::after`/
`.glass-card` que `[data-theme="photo"]`, mais sans la condition — réutilise
la structure d'empilement déjà en place (isolation, z-index), seule la
condition d'affichage change.

`tsc`/`eslint`/`next build` (36 routes) propres. Committé et poussé
(`fd44b84`).
```

### 2.96 Nouvelle page /regles (session du 20/08/2026)

```text
Demande de l'utilisateur : construire une page de règles à afficher sur le
site. Clarifié par AskUserQuestion (2 questions) avant de coder : contenu
= barème de scoring ET règles générales du jeu (les deux) ; emplacement =
nouvelle page dédiée (route à part), pas intégrée au tutoriel existant.

Route physique `/regles`, même patron dual-nav que `/leaderboard` et
`/bracket` (visiteur ou connecté, contenu statique identique). Contenu
sourcé sur les décisions ACTÉES et le code réel (SPEC_TECHNIQUE_SCORING_V0_1.md
T5, figé ; decisions_0.2.x ; lib/queries, lib/labels) — PAS sur le résumé
de cadrage initial (`nba_pronos_resume_cadrage_valide.md`), largement
dépassé depuis ("à préciser plus tard" un peu partout, tranché autrement
dans les specs validées et l'implémentation réelle). Recherche déléguée à
un agent Explore pour ne pas saturer le contexte avec les docs volumineux,
avec instruction explicite de privilégier le code/les décisions actées sur
ce document initial.

6 sections : bracket (barème par tour, 4 tours), pronostics de matchs
(barème vainqueur+écart, règle de visibilité "valider débloque la vue"),
paris personnalisés (barème par difficulté, quota 1 pari série + 3 paris
match), ligues entre amis, classement (cascade de départage à 4 critères),
badges (mention brève).

Nouveau composant `components/regles/BaremeTable.tsx` : divs+flex avec
rôles ARIA de tableau (convention du dépôt, jamais de `<table>` — même
patron que `LeaderboardTable.tsx`), réutilisé pour le barème du bracket.

Lien ajouté dans `PublicNav` (visiteurs) et section Aide du Profil
(connectés, à côté de "Comment jouer ?") — pas de 5e onglet ajouté à la
`TabBar`, qui reste à 4 par choix déjà établi.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (37 routes) propres. Committé
et poussé (`b7091d9`). Pas de vérification visuelle réelle faite (pas
d'accès navigateur dans cet environnement) — signalé explicitement à
l'utilisateur avant de pousser.
```

### 2.97 Retrait du tutoriel "Comment jouer ?" (session du 21/08/2026)

```text
Demande de l'utilisateur, suite directe de §2.96 : la page /regles suffit
désormais, retirer le tutoriel. Cartographié avant toute suppression
(agent Explore) pour ne rien laisser à moitié cassé : 6 fichiers composant
(`components/tutorial/*`), 1 server action (`lib/actions/tutorial.ts`), 5
captures d'écran (`public/tutorial/*.png`), 1 colonne DB
(`users.tutorial_seen_at`, migration #21 20260730130000), 2 points de
montage (`app/(app)/home/page.tsx` bannière, `app/(app)/profile/page.tsx`
lien permanent).

Tout supprimé : les 3 composants + leurs CSS Modules, la server action, les
5 PNG, `lib/queries/profile.ts` (retire `tutorialSeenAt` du type/select/
mapping), `app/(app)/home/page.tsx` (retire l'import, la variable
`showTutorialBanner`, les 2 sites de rendu, et simplifie le
`Promise.all([getHomeData(), getProfileData()])` devenu `getHomeData()`
seul — `getProfileData()` n'était appelé que pour ce flag). 2 commentaires
obsolètes nettoyés au passage (`app/globals.css` référençait
`TutorialModal.tsx` comme exemple de portail React — remplacé par
`components/ui/ModalDialog.tsx`, toujours valide ; `profile/page.module.css`
comparait `.helpLink` au tutoriel, reformulé).

**Migration #30** (`20260821090000_drop_tutorial_seen_at.sql`) : `drop
column tutorial_seen_at`, même patron que la migration #20
(`drop_use_team_colors.sql`, précédent direct de "colonne retirée
symétriquement après retrait du code"). Écrite, PAS encore poussée sur la
base réelle (`npx supabase db push` bloqué par le classifieur de
permissions côté Claude, comme la migration #29) — à pousser manuellement.

Doc mise à jour en cohérence : `BACKLOG_V1.md` (entrée FAIT → FAIT puis
RETIRÉ), `SPEC_TUTORIEL_JOUEUR_V0_1.md` (bandeau RETIRÉ en tête, doc gardé
comme trace historique).

`tsc`/`eslint`/`vitest` (37/37)/`next build` (37 routes) propres.
```

### 2.98 Chat — Général + par ligue (session du 27/08/2026)

```text
Demande de l'utilisateur : 2e item du backlog ajouté le 27/08/2026 (chat +
badges épinglés sur la page perso). Badges épinglés + intégration du
logo/rebrand "Panier Ballon" + correctif nav visiteur invisible déjà codés
et poussés juste avant celle-ci (détail dans `JOURNAL_SESSIONS.md`, pas
encore repris ici en entrée ETAT_ACTUEL dédiée -- à faire séparément).
"Gros morceau" selon l'utilisateur lui-même -- vrai cadrage écrit avant
code : `Cadrage/Proto/SPEC_CHAT_V0_1.md`.

Décisions actées avec l'utilisateur (AskUserQuestion, 2 rounds) : portée =
Général (permanent, tout joueur) ET un canal par ligue existante (système
de ligues, migration #16) -- PAS l'un ou l'autre ; emplacement = page
dédiée `/chat`, sélection de canal par chips (réutilise le patron
`LeagueScopeChips` déjà en place sur Classement/Résultats/Bracket/Profil,
même repli silencieux `resolveLeagueScope`) ; modération = ADMIN
uniquement (`is_admin()`, pas de self-delete/self-edit) ; temps réel = oui
(Supabase Realtime, déjà utilisé ailleurs -- `LiveSubscriber`/
`LiveSeriesSubscriber`). 2e round dédié à l'emplacement dans la nav :
confirmé 5e onglet dans la `TabBar` -- **reprend explicitement la décision
inverse prise en §2.96** ("pas de 5e onglet... par choix déjà établi"),
l'utilisateur ayant cette fois préféré la visibilité maximale à la densité
de la barre.

**Migration #31** (`20260827100000_chat.sql`) : 1 seule table neuve,
`chat_messages` (scope_type GLOBAL/LEAGUE, league_id nullable + contrainte
de cohérence, user_id, body 1-2000 caractères, created_at). RLS : lecture
Général ouverte à tous + ligue réservée aux membres (`league_id in (select
public.my_league_ids())` -- PAS un EXISTS direct sur `league_memberships`,
qui a déjà mordu sur une récursion RLS, migration #17) ; écriture même
garde ; suppression admin uniquement. Publiée sur `supabase_realtime`.
Poussée sans blocage (`npx supabase db push`).

Lecture (`lib/queries/chat.ts`) : `getChatMessages()` (200 derniers d'un
canal, pas de pagination -- simplification assumée) + `getChatRoster()`
(trombinoscope complet pseudo/avatar/rôle, sert à résoudre l'auteur d'un
message reçu en direct par Realtime qui ne porte que `user_id`). Écriture
(`lib/actions/chat.ts`) : `postChatMessageFormAction`/
`deleteChatMessageFormAction`, PAS le patron "formulaire natif + redirect"
du reste de `lib/actions/*` -- `useActionState` comme LoginForm/SignupForm,
une redirection à chaque message casserait le scroll/le focus sur un écran
pensé pour poster en rafale.

UI : `ChatScopeChips` (adaptation de `LeagueScopeChips`), `ChatSubscriber`
(Provider + liste, patron `LiveSubscriber` -- INSERT seulement, PAS DELETE
en Realtime : un DELETE ne porte par défaut que la clé primaire, insuffisant
pour que Postgres réévalue la RLS dessus sans `REPLICA IDENTITY FULL`,
mécanisme jamais éprouvé ici -- suppression admin donc retirée localement
seulement, pas diffusée aux autres joueurs connectés), `ChatComposer`,
`ChatMessageRow`. Icône `ChatIcon` ajoutée à `nav-icons.tsx` (même style
"nette" que les 4 existantes).

**Bug réel trouvé en testant** (script jetable `scripts/_check_chat.mjs`,
3 comptes réels + Playwright, supprimé après usage) : l'AUTEUR d'un message
ne recevait PAS toujours son propre message en direct (les autres joueurs
si). Cause : chaque Server Action déclenche un refresh de la page côté
Next.js -> nouvelle référence `roster` (même contenu) -> l'effet
d'abonnement Realtime (qui dépendait de `roster`) se relançait -> le canal
se fermait puis se rouvrait juste au moment où l'événement du message qu'on
venait de poster arrivait, donc raté (pas de rejeu des événements manqués).
Corrigé : `roster` lu via une ref stable, plus dans les dépendances de
l'effet -- seul un changement de canal (`scopeKey`) le relance désormais.

Vérification réelle (3 comptes jetables + Playwright, 13 assertions) :
5e onglet Chat présent ; chip Général active par défaut ; membre/non-membre
d'une ligue voit/ne voit pas sa chip ; message Général reçu en direct par
un AUTRE joueur ET par l'auteur lui-même (après le fix ci-dessus) ; message
de ligue reçu en direct par l'autre membre ; un non-membre forçant l'URL du
canal ligue retombe silencieusement sur Général, sans voir le message ; **et
surtout** -- 1er test réel d'une policy RLS restrictive sur le canal
Realtime dans ce projet (les 2 tables déjà branchées, `matches`/`series`,
sont `using (true)`) -- écoute Realtime BRUTE (hors UI, script Node
indépendant) par le non-membre : AUCUN événement reçu, confirmé ; bouton
Supprimer visible pour l'admin seulement, fonctionnel (retrait local).
13/13 passées. Comptes/ligue/messages de test nettoyés après coup.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (39 routes) propres.
```

### 2.99 Chat — liste de canaux + notifications par canal (session du 27/08/2026)

```text
Suite directe demandée par l'utilisateur juste après §2.98 : "notification
pour le chat, bouton en haut de chaque chat pour activer/désactiver",
précisé ensuite en "liste de chat de haut en bas, clic pour ouvrir, 3
petits points en bout de ligne". Addendum écrit dans
`Cadrage/Proto/SPEC_CHAT_V0_1.md` §9 plutôt qu'un nouveau document séparé.

Découverte utile avant de coder : une infra Web Push COMPLÈTE existait déjà
(backlog "Rappels ciblés", 29/07/2026) -- service worker, permission +
abonnement navigateur (`NotificationSettings.tsx`), envoi
(`lib/push/send.ts`), table `push_subscriptions`,
`users.notification_preference`. Rien à construire côté infra, seulement à
la BRANCHER sur un événement temps réel (nouveau message) plutôt que sur
les crons `/api/reminders/*` existants.

Décisions actées (AskUserQuestion) : aperçu du message dans la notif
(pseudo + début, pas générique) ; canal ACTIVÉ par défaut.

**Migration #32** (`chat_muted_channels`) : ne stocke QUE les sourdines
(exceptions) -- absence de ligne = notifications actives, cohérent avec
"activé par défaut". RLS entièrement self-service (`for all using
(user_id = auth.uid())`, même patron que `competition_secrets_all`).

Remaniement `/chat` : liste de canaux (`ChatChannelList`, Général + une
ligne par ligue) remplace les chips (`ChatScopeChips` supprimé). `?ligue=`
devient `?canal=general`/`?canal=<leagueId>` -- un id de ligue invalide
renvoie maintenant à LA LISTE, pas un repli silencieux sur Général (qui
avait du sens pour un filtre de classement, plus pour une navigation entre
canaux distincts).

Menu "..." (`ChatNotificationToggle`) : `<details>/<summary>` natif, FRÈRE
du `<Link>` de la ligne (jamais imbriqué -- invalide en HTML). Activer peut
exiger permission navigateur + abonnement Push (inatteignable sans JS) ->
`lib/push/client.ts` (`ensurePushSubscribed()`) extrait de
`NotificationSettings.tsx` pour ne pas dupliquer une logique déjà déboguée
(retry AbortError, conversion VAPID) -- ce composant refactoré pour
l'utiliser aussi, revérifié non régressé.

Extension délibérée du périmètre `service_role` (`lib/supabase/service.ts`,
commentaire mis à jour) : calculer les destinataires d'une notif exige de
lire `push_subscriptions`/`notification_preference` d'AUTRES joueurs,
verrouillé par RLS -- jusqu'ici `service_role` réservé aux routes
sync/heartbeat/reminders (jamais déclenché en direct par une action
joueur). `lib/push/notifyChatMessage.ts` en est le 1er appelant synchrone
(depuis `postChatMessageFormAction`) -- même frontière de confiance, juste
un déclencheur différent, documenté explicitement plutôt que laissé
implicite. Ne lève jamais (un échec d'envoi ne doit jamais faire échouer la
publication du message) ; nettoie les abonnements morts (404/410), même
patron que `lib/reminders/matchesReminder.ts`.

Vérification réelle (2 comptes jetables + Playwright,
`context.grantPermissions(["notifications"])`, 13/13) : liste correcte,
clic ouvre la conversation, envoi de message toujours fonctionnel après le
remaniement de `page.tsx`, canal actif par défaut, désactivation persistée
en base ET reflétée dans le menu, non-régression de l'écran Profil après
le refactor `lib/push/client.ts`. **Non confirmé** : réception RÉELLE d'une
notification OS (FCM pas garanti joignable dans cet environnement) --
signalé explicitement à l'utilisateur plutôt que présenté comme testé.

`tsc`/`eslint`/`vitest` (37/37)/`next build` (39 routes) propres.
```

### 2.100 Bug réel : thème Photo absent sur /chat (session du 27/08/2026)

```text
Signalé par l'utilisateur juste après confirmation des notifs push
(reçues sur son téléphone) : Chat restait sombre en préférence "Photo".
Cause : app/(app)/chat/page.tsx (écrit avant que Photo soit reconsidéré
pour cet écran) ne posait pas la classe `.photo-page`, contrairement aux
9 autres écrans authentifiés. Corrigée sur les 2 vues (liste ET
conversation ouverte -- un 1er remplacement global n'avait en fait pas
pris sur la 2e vue, repéré en relisant le fichier plutôt qu'en faisant
confiance à l'outil). `glass-card` ajoutée à l'en-tête et à chaque ligne
de `ChatChannelList` (même patron que `LockedRow.tsx`), text-shadow sur
le titre/la flèche retour pour la lisibilité sur la photo.

Vérifié par capture d'écran réelle (compte jetable, `theme_preference`
forcé à PHOTO, Playwright) sur les 2 vues, comparées à `/home`. Détail
dans `JOURNAL_SESSIONS.md`. `tsc`/`eslint`/`vitest` (37/37)/`next build`
propres.
```
