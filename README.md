# Panier Ballon (nba-pronos)

Application de pronostics et paris entre amis sur les playoffs NBA et la NBA Cup — Next.js 16 (App Router) + Supabase (Postgres/Auth/RLS/Realtime), avec un moteur de paris personnalisés structurés par IA (Claude).

## Prérequis

- [Node.js](https://nodejs.org) 22+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (pour Supabase en local -- sur Windows, active WSL2 si demandé au premier lancement : `wsl --install` en PowerShell administrateur, puis redémarrer)
- La [CLI Supabase](https://supabase.com/docs/guides/cli) (installée automatiquement via `npx`, pas besoin de l'installer globalement)

## Installation

```bash
npm install
cp .env.example .env.local
```

## Base de données locale

```bash
npx supabase start
```

Premier lancement : télécharge les images Docker (peut prendre plusieurs minutes) et applique toutes les migrations de `supabase/migrations/`. Affiche à la fin les URLs et clés locales -- copier `API_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local` (les autres variables de `.env.example` sont optionnelles en dev, voir les commentaires du fichier).

Studio (interface d'admin de la base) accessible sur `http://127.0.0.1:54323`.

Pour arrêter : `npx supabase stop`.

### Devenir admin en local

Aucun compte n'est admin par défaut. Après avoir créé un compte via `/signup`, promouvoir en base (Studio → SQL Editor, ou `psql` sur `DB_URL` affichée par `supabase start`) :

```sql
update public.users set role = 'ADMIN' where pseudo = 'ton_pseudo';
```

## Lancer l'application

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm test                  # suite unitaire (vitest) -- ne nécessite pas Docker
npm run test:integration  # tests d'intégration RLS -- nécessite `npx supabase start` au préalable
npx tsc --noEmit           # vérification des types
npm run lint               # ESLint
```

## Build de production

```bash
npm run build
```

## Déploiement

Déployé sur [Vercel](https://vercel.com), auto-déclenché à chaque merge sur `main`. Les migrations Supabase ne se poussent **pas** automatiquement (`npx supabase db push`, séparé du déploiement Vercel) -- voir `audit/RUNBOOK_MIGRATIONS.md` avant de merger une PR qui ajoute une migration.

## Documentation

- `Cadrage/` -- spécifications produit/technique, journal de suivi
- `audit/` -- audits de sécurité/qualité et plan d'action associé
- `security-audit-report.md` -- audit de sécurité ponctuel du 29/08/2026 (voir le bandeau en tête de fichier pour le statut à jour)
