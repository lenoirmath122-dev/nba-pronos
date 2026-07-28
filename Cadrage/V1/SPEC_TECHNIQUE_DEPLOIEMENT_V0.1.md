# NBA Pronos — SPEC TECHNIQUE T8 : Déploiement

> **Statut : VALIDÉ le 28/07/2026** (3 décisions tranchées avec l'utilisateur
> — AskUserQuestion — avant tout code, §5/§6/§7 ci-dessous). Contrairement à
> T1-T7, ce chantier a été partiellement CODÉ/DÉPLOYÉ avant d'avoir sa spec
> écrite (déploiement Vercel initial du 27/07/2026, `ETAT_ACTUEL.md` §2.17) —
> trouvé par l'audit structurel du 28/07/2026 (`GAPS_OUVERTS.md`). Ce
> document décrit donc à la fois ce qui était DÉJÀ FAIT avant la spec, et ce
> qui a été codé APRÈS sa validation (workflows GitHub Actions, script de
> nettoyage) — voir `ETAT_ACTUEL.md` §2.41 pour le détail de session.
>
> Dépend de T4 (synchro), comme prescrit par le document maître (§4).

---

## 1. Ce qui est DÉJÀ FAIT (à documenter, non rouvrable)

```text
- Projet Vercel `lenoir-nba/nba-pronos` créé et lié au dépôt GitHub existant
  (`lenoirmath122-dev/nba-pronos`) — déploiement automatique sur chaque push
  vers `main` (intégration Git native de Vercel, aucune action manuelle
  supplémentaire nécessaire). URL de production : https://nba-pronos.vercel.app
- 4 variables d'environnement poussées sur Production/Preview/Development :
  NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY, SYNC_SECRET. Une 5e (HIGHLIGHTLY_API_KEY,
  ajoutée avec T4 le 28/07/2026) présente en local (.env.local) — À VÉRIFIER
  qu'elle est bien poussée sur Vercel aussi (§4, pas confirmé à ce jour).
- `vercel.json` minimal (région `dub1` uniquement, aucune config de cron —
  voir §5, la clé `crons` de Vercel n'a jamais été utilisée, cette V1 vise
  un planificateur EXTERNE gratuit, pas les cron jobs Vercel qui sont
  payants au-delà d'un usage minime).
- 1er compte réel + 1er admin réel posés manuellement (`ETAT_ACTUEL.md`
  §2.17) — hors périmètre de ce document (T2/process, pas déploiement).
```

---

## 2. Secrets — inventaire et portée

```text
| Variable                     | Portée                          | Généré par |
|-------------------------------|----------------------------------|------------|
| NEXT_PUBLIC_SUPABASE_URL      | publique (NEXT_PUBLIC_)          | Supabase   |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | publique (NEXT_PUBLIC_)           | Supabase   |
| SUPABASE_SERVICE_ROLE_KEY     | serveur UNIQUEMENT (lib/sync/*,   | Supabase   |
|                               | lib/scoring/*, lib/actions/admin*)|            |
| SYNC_SECRET                   | serveur UNIQUEMENT — vérifie le   | généré     |
|                               | Bearer des 4 routes /api/sync/*   | (crypto)   |
|                               | et /api/heartbeat (lib/sync/auth.ts) |         |
| HIGHLIGHTLY_API_KEY            | serveur UNIQUEMENT — lib/nba/client.ts | fourni par Highlightly |
```

**Jamais collés dans le chat** (règle déjà établie sur ce projet) : toute
valeur de secret est saisie directement par l'utilisateur, dans son éditeur
ou le dashboard Vercel — jamais demandée ni affichée en conversation.

---

## 3. Les 4 routes à appeler périodiquement

```text
| Route                | Fréquence prescrite (doc maître §2, A8)         | Fenêtre                     |
|-----------------------|--------------------------------------------------|------------------------------|
| POST /api/sync/teams  | À LA DEMANDE UNIQUEMENT — jamais planifiée        | —                            |
|                        | (référentiel 30 équipes fixe, T4 §4)              |                              |
| POST /api/sync/schedule | 1×/jour                                         | toute l'année (peu coûteux)  |
| POST /api/sync/results  | toutes les 30-60 min                            | UNIQUEMENT en fenêtre de     |
|                        |                                                    | match (sinon gaspillage de   |
|                        |                                                    | quota, 100 req/jour, A6)     |
| POST /api/heartbeat    | 1×/jour minimum (empêche la pause Supabase        | toute l'année                |
|                        | gratuite après 7 jours d'inactivité, A8)          |                              |
```

Authentification : les 4 routes vérifient un header `Authorization: Bearer
<SYNC_SECRET>` (`lib/sync/auth.ts`, `isAuthorizedSyncRequest`) — le
planificateur externe doit pouvoir envoyer ce header, quel qu'il soit.

**Tranché (§5, décision confirmée)** : « fenêtre de match » n'est définie
nulle part en code ni en config — un planificateur cron classique ne peut pas
nativement dire « seulement quand un match est en cours ». Choix retenu :
fréquence FIXE toute l'année (1x/30 min), plutôt qu'une plage bornée aux
horaires plausibles d'un match NBA — plus simple à configurer/maintenir, le
quota de 100 req/jour reste large même à cette fréquence (A6/§2 doc maître).

---

## 4. Ce qui reste à FAIRE (vérifié, pas une hypothèse)

```text
- CONFIRMÉ MANQUANT (`npx vercel env ls`, 28/07/2026) : HIGHLIGHTLY_API_KEY
  n'est PAS poussée sur Vercel (ajoutée en local avec T4 le 28/07, jamais
  répercutée sur le déploiement). Conséquence concrète : /api/sync/schedule
  et /api/sync/results échoueraient en production aujourd'hui
  ("HIGHLIGHTLY_API_KEY manquante", lib/nba/client.ts). À la charge de
  l'utilisateur (jamais collé dans ce chat) :
    npx vercel env add HIGHLIGHTLY_API_KEY production
    npx vercel env add HIGHLIGHTLY_API_KEY preview
    npx vercel env add HIGHLIGHTLY_API_KEY development
```

---

## 5. DÉCISION 1 — Quel planificateur externe ? **TRANCHÉ : GitHub Actions**

```text
Le doc maître laisse le choix ouvert : "cron-job.org / GitHub Actions".
Choisi (AskUserQuestion, 28/07/2026) : GitHub Actions — cohérent avec P14 du
doc maître ("priorité au gratuit / meilleur rapport perf-coût"), tout reste
dans le dépôt existant, versionné, aucun compte tiers à créer, SYNC_SECRET
reste un secret GitHub (même compte que le dépôt) plutôt que confié à un
service tiers supplémentaire.

Implémenté : 4 fichiers sous `.github/workflows/` (un par route, cron en
UTC) :
- `sync-teams.yml`   : AUCUN `schedule` — `workflow_dispatch` uniquement,
  déclenchement manuel depuis l'onglet Actions (référentiel fixe, jamais
  planifié, T4 §4).
- `sync-schedule.yml` : `0 8 * * *` (1x/jour) + `workflow_dispatch`.
- `sync-results.yml`  : `*/30 * * * *` (fréquence FIXE toute l'année,
  décision ci-dessous) + `workflow_dispatch`.
- `heartbeat.yml`     : `0 6 * * *` (1x/jour) + `workflow_dispatch`.

Chacun appelle sa route via `curl --fail` (échoue bruyamment, visible dans
l'onglet Actions de GitHub) avec `Authorization: Bearer ${{ secrets.SYNC_SECRET }}`.

**Action restant à la charge de l'utilisateur (jamais par le code)** :
ajouter `SYNC_SECRET` dans Settings → Secrets and variables → Actions →
Repository secrets, sur le dépôt GitHub (`lenoirmath122-dev/nba-pronos`) —
même valeur que celle déjà dans `.env.local`/Vercel, collée directement dans
l'UI GitHub, jamais dans ce chat.

**Limite connue, acceptée** (documentée en tête de `heartbeat.yml`) : GitHub
désactive un workflow planifié après 60 jours SANS activité (commit/push) sur
le dépôt — un creux de saison NBA (ex. juin→novembre) peut dépasser ce délai.
Pas de parade automatisée à ce stade ; à surveiller manuellement si un long
silence de commits s'annonce.
```

---

## 6. DÉCISION 2 — Nettoyage du jeu de données de test **TRANCHÉ : même lot, périmètre restreint**

```text
Choisi (AskUserQuestion, 28/07/2026) : même lot que le reste de T8, pas une
session séparée.

Implémenté : `scripts/cleanup-test-data.mjs` (symétrique de
`scripts/seed-playoffs-test-data.mjs`, même justification hors
`supabase/migrations/` : passage par l'API Admin pour les comptes, pas
exprimable en SQL portable). DRY-RUN PAR DÉFAUT (n'affiche que ce qui serait
supprimé) — nécessite `--confirm` en argument pour exécuter réellement.

Périmètre EXPLICITE (liste fermée, jamais un motif large type `.test`) :
- Compétitions : « Playoffs NBA (test) » ET « Test UI Matchs » (cette
  dernière trouvée en écrivant le script — pas dans le périmètre imaginé au
  moment d'écrire ce document, mais c'est bien un artefact de test du même
  ordre, ETAT_ACTUEL.md §2.36/§2.37).
- Comptes : les 7 `seed-*@nba-pronos.test` (auth.admin.deleteUser).

**EXCLU délibérément** : `demo-amis@nba-pronos.test` (Demo_Amis) — compte de
démo ACTIVEMENT utilisé par les amis de l'utilisateur, pas un artefact de
seed (motif d'email différent, `demo-amis` pas `seed-*` — filtre par préfixe
exact, jamais par le seul domaine `.test`, qui l'aurait attrapé à tort) ; le
compte réel de l'utilisateur (Rillettes-31), jamais dans la liste des 7
pseudos ciblés.

Testé en dry-run contre la vraie base (28/07/2026) : 2 compétitions de test
trouvées et correctement décomptées (9 matchs/15 séries/45 picks pour
Playoffs (test), 1 match/1 série/1 pick pour Test UI Matchs), 7 comptes de
seed trouvés par pseudo. **PAS ENCORE EXÉCUTÉ EN VRAI** (`--confirm` jamais
passé) — décision d'exécution réelle laissée à l'utilisateur, hors périmètre
de cette session.
```

---

## 7. Ce que ce document ne dit pas

```text
- Le contenu exact des workflows/config du planificateur choisi (§5) : vit
  dans `.github/workflows/*.yml` ou la config cron-job.org elle-même, pas
  ici — ce document explique le QUOI et le POURQUOI, pas le fichier final.
- Le contenu du script de nettoyage (§6) : à écrire, pas à spécifier ligne
  par ligne ici.
```
