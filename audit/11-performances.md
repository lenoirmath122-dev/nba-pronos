# 11 — Performances

*Distinction stricte appliquée dans cette phase : **mesures réelles** (obtenues par exécution de commandes dans cette session), **estimations** (déduites du code sans mesure directe), **risques théoriques** (identifiés par lecture, non mesurés), et rappel explicite des optimisations prématurées à éviter.*

## 1. Mesures réelles

### 1.1 Build de production

Commande exécutée : `npm run build` (Next.js 16.2.12, Turbopack). **Résultat réel** :
- Compilation : 14.0s.
- Vérification TypeScript : 15.9s.
- Génération des 46 pages : 676ms (7 workers).
- Build terminé avec succès, code de sortie 0.

**Observation notable** : la totalité des routes applicatives (`/home`, `/play/*`, `/profile`, `/chat`, `/admin/*`, toutes les routes `/api/*`) sont marquées **`ƒ` (dynamique, rendu à la demande)** — **aucune route n'est statique (`○`)** hormis les assets techniques (`/apple-icon.png`, `/manifest.webmanifest`). C'est cohérent avec une application entièrement personnalisée par session (données utilisateur partout), mais signifie qu'aucune page ne bénéficie du cache CDN statique de Vercel ni de l'ISR — chaque requête déclenche un rendu serveur complet.

**Limite de mesure** : contrairement aux versions antérieures de Next.js, la sortie de build de Next.js 16 (Turbopack) **n'affiche pas de tableau "First Load JS" par route** — conforme à l'avertissement de `AGENTS.md` sur les changements de comportement de cette version. Les tailles de bundle par route n'ont donc pas pu être mesurées directement via la sortie du build.

### 1.2 Taille des bundles JS (mesure directe des fichiers générés)

```
.next/static/chunks : 1.6 Mo au total (non gzippé)
Plus gros chunk individuel : 247 Ko (non gzippé)
2e plus gros chunk : 226 Ko (non gzippé)
```
Ces chunks sont partagés par code-splitting entre les routes (Next.js ne charge pas nécessairement l'intégralité des 1.6 Mo sur une seule page). **Non mesuré** : la taille réelle transférée sur une navigation donnée (nécessiterait une inspection réseau dans un vrai navigateur, hors périmètre de cette session). Pour une application React 19 + Next 16 avec plusieurs écrans riches (bracket, badges, chat temps réel), cet ordre de grandeur n'est pas alarmant en absolu, mais reste une mesure brute non contextualisée par un budget de performance explicite (aucun budget de bundle défini dans le projet).

### 1.3 Tests

`npx vitest run` : 224 tests en 7.78s (dont 4.35s de transformation, 450ms d'exécution réelle des tests) — temps d'exécution de test rapide, pas un facteur de friction pour le développement.

## 2. Estimations (déduites du code, non mesurées directement)

Ces points proviennent de l'audit UX interne du 16/08/2026 (revue de code multi-agents), **non revérifiés dans le code actuel par cette session** — reportés ici comme estimations à confirmer, pas comme mesures :

- `LeaderboardRow` non mémoïsé : chaque clic pour déplier une ligne re-rendrait toutes les lignes du classement (closure `onToggle` recréée à chaque rendu).
- `getHomeData()` + `match-bets.ts` + `series-bets.ts` referaient chacun `auth.getUser()` et la requête "compétition active" — 3 aller-retours réseau dupliqués au lieu d'1 par chargement de l'Accueil.
- `getBracket()` enchaînerait 4 étapes `await` séquentielles plutôt que d'être regroupé en `Promise.all`.
- Calcul de tendance de rang ajoutant un 3e aller-retour DB séquentiel sur `/leaderboard`.

**Statut** : ces observations datent d'avant plusieurs semaines de développement actif (chat, ligues, badges, etc. ajoutés depuis) — leur exactitude actuelle n'est pas garantie. À revérifier avant toute action.

## 3. Risques théoriques (identifiés par lecture du modèle de données, Phase 6)

- Absence d'index sur `correction_requests(requester_user_id)`, `chat_messages(user_id)`, `bug_reports(user_id)` — impact négligeable au volume actuel, deviendrait un risque de seq scan si le volume de signalements/messages croît significativement (`DATA-004`).
- Pas de pagination sur `getChatMessages` (200 derniers messages fixes) — assumé comme simplification à ce stade, deviendrait un point de latence si l'historique de chat grossissait fortement sans jamais être purgé.
- Orchestration séquentielle non parallélisée du recompute de scoring (`recompute.ts`, boucle `.update()` ligne par ligne) — acceptable au volume actuel (petit nombre de joueurs), pourrait devenir un facteur de latence perceptible si le nombre de participants par compétition augmentait fortement.

## 4. Optimisations prématurées à éviter

Compte tenu de l'échelle actuelle du produit (cercle fermé d'amis, dizaines d'utilisateurs, pas de pic de charge documenté ni observé) :
- **Ne pas** investir dans un CDN/cache applicatif avancé, du server-side rendering incrémental (ISR), ou une architecture de mise en cache distribuée avant qu'un besoin réel ne soit mesuré.
- **Ne pas** optimiser prématurément la taille du bundle JS (1.6 Mo total, code-splitté) sans d'abord mesurer le temps de chargement réel perçu par les utilisateurs réels du cercle fermé actuel.
- Le point le plus rentable à court terme n'est pas la performance brute mais la **fiabilité fonctionnelle** (tests, Phase 12) — cohérent avec le diagnostic déjà posé par l'équipe elle-même dans `BILAN_GLOBAL_01_09_2026.md` ("le point faible : tests", pas la performance).

## 5. Ce qui n'a pas pu être mesuré dans cette session

- Temps de chargement réel dans un navigateur (Lighthouse, Web Vitals — LCP/FID/CLS/TTFB) : aucun accès navigateur dans cet environnement d'audit.
- Taille de bundle par route (limitation de la sortie de build Next.js 16/Turbopack, voir §1.1).
- Comportement sous charge (aucun load-testing effectué ni documenté par l'équipe).
- Performance du micro-service Python (Cloud Run) — hors périmètre TypeScript principal de cette session.

## Synthèse

Aucune mesure réelle effectuée dans cette session n'indique de problème de performance actif ou bloquant. Le build compile et s'exécute sans erreur en un temps raisonnable (~30s), les tests sont rapides. Les points d'attention identifiés sont soit des estimations non revérifiées (§2, datées), soit des risques théoriques proportionnés à une croissance future du volume de données (§3) — aucun ne justifie une action immédiate au stade actuel du produit. Aucune anomalie de performance n'est ajoutée au registre central `ANOMALIES.md` à ce stade, faute de mesure confirmant un problème réel plutôt qu'une hypothèse.
