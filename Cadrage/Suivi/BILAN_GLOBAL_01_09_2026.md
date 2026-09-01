# Bilan global — état, sécurité, tests, positionnement (01/09/2026)

> Nature : bilan produit demandé explicitement par l'utilisateur (« bilan
> global de mon application, savoir où j'en suis, évaluer par rapport aux
> autres applis — bas/moyen/haut de gamme »), produit par une session
> Claude Code séparée de la session Cowork habituelle, à partir d'une
> exploration directe du code (routes, migrations, sécurité, tests) plutôt
> que des docs de suivi existants. Version illustrée (jauges de
> positionnement par axe) publiée en Artifact :
> https://claude.ai/code/artifact/b212586e-6b3b-47da-a8d6-6504ed636367 —
> ce fichier-ci en est la version texte archivée dans le dépôt. Le
> positionnement concurrentiel qualitatif (aspect/fonctionnalités face à
> HoopCall/Scorecast/ParidAmis) avait déjà été traité plus en profondeur
> dans `AVIS_EXPERT_16_08_2026.md` — non repris en détail ici, ce document
> se concentre sur l'angle technique/produit global.

## Échelle

~32 000 lignes TypeScript (`app`/`components`/`lib`), 62 migrations SQL,
359 commits, micro-service Python séparé (Cloud Run, ~1 200 lignes +
12 modèles ML entraînés). Construit en 6 semaines (18/07 → 01/09/2026) —
dépasse largement le périmètre « prototype jetable » du cadrage initial
(`nba_pronos_resume_cadrage_valide.md`).

## Fonctionnalités — toutes complètes, aucun stub côté app

Pronostics match par match, bracket playoffs, format NBA Cup (2e format de
compétition, même moteur de scoring), paris personnalisés structurés par
IA (9 formes de paris, Claude Sonnet 5 + 12 modèles ML de résolution —
partie la plus travaillée du code, ~4 000 lignes à elle seule), classement
+ ligues privées, admin complet (validation/résolution/joueurs/logs),
notifications push (VAPID, PWA iOS), chat + badges/gamification.

**Différenciateur réel** : le moteur de paris personnalisés (texte libre →
structuration IA → proba calculée par modèles ML → résolution automatique
post-match sur les vraies stats) — une fonctionnalité que la plupart des
applis commerciales de pronostics n'ont pas.

## Sécurité

Auto-audit du 29/08 (`security-audit-report.md`, 15 findings) suivi d'une
correction en 24h du Critique (clé `service_role` fuitée, rotée) et de
l'Élevé (service Cloud Run public protégé par secret partagé). Reste
ouvert (Moyen/Faible/Info, détail dans `GAPS_OUVERTS.md`) : pas de
CAPTCHA/rate-limit sur le login, cookies non-`HttpOnly` (compromis
architectural du SDK `@supabase/ssr`), énumération de compte au signup,
absence de procédure RGPD documentée — non urgent tant que le cercle reste
fermé. Modèle d'autorisation : RLS Postgres + fonctions
`SECURITY DEFINER` + triggers d'invariants, pas de contrôle applicatif
seul — défense en profondeur peu commune à cette échelle de projet.

## Le point faible : tests

**2 fichiers de test** (`lib/scoring/engine.test.ts`,
`lib/scoring/recompute.test.ts`) pour ~32 000 lignes — uniquement le
moteur de scoring pur. Aucun test sur le pipeline IA de
structuration/résolution des paris (le code le plus complexe et le plus
critique du repo), aucun test de composant React, aucun e2e, aucune CI de
garde-fou (les 8 workflows GitHub Actions sont tous des jobs planifiés,
aucun ne bloque un merge sur un `lint`/`tsc`/`test` cassé). Écart le plus
net entre le niveau d'ingénierie du reste du projet et sa robustesse
mesurable.

## Positionnement bas/moyen/haut de gamme

Face à ce qu'un groupe d'amis fait normalement pour des pronostics
(tableur, formulaire, WhatsApp) : haut de gamme sans discussion. Face à
des applis commerciales de pronostics/fantasy sport :
**moyen-haut de gamme techniquement**, avec une couche « produit fini »
qui traîne derrière le niveau d'ingénierie —

- Architecture & sécurité — **haut de gamme** (RLS + invariants, audit
  propre, critique/élevé corrigés en 24h)
- Richesse fonctionnelle — **haut de gamme** (paris IA + résolution ML
  au-delà de la plupart des apps commerciales sur ce point précis)
- Fiabilité & QA — **bas de gamme** (2 fichiers de test, aucune CI de
  garde-fou — le principal chantier)
- Design & UX — **moyen de gamme** (cohérent et fonctionnel, mais
  visuels explicitement notés « non définitifs »)
- Maturité produit — **moyen de gamme** (nom de marque pas tranché,
  déploiement Cloud Run manuel, jamais testé à l'échelle)

## Suite

Amélioration reprise axe par axe avec l'utilisateur. Premier axe choisi :
**fiabilité & QA** (tests + CI) — voir la suite du journal/les commits
associés pour le détail des travaux.
