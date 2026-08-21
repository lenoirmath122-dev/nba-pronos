# Déploiement du micro-service sur Google Cloud Run

> À exécuter par l'utilisateur (compte Google Cloud + `gcloud` CLI
> nécessaires, pas accessible depuis cet environnement). Décidé le
> 21/08/2026 — voir `projet-data-nba.md` §22-23 pour le contexte complet.

## Prérequis (une fois)

1. Compte Google Cloud (carte requise, aucun débit tant que l'usage reste
   sous le free tier — voir §23).
2. Installer `gcloud` CLI : https://cloud.google.com/sdk/docs/install
3. `gcloud init` puis `gcloud auth login` (ouvre un navigateur).
4. Créer un projet (ou en réutiliser un) :
   ```
   gcloud projects create nba-pronos-stats --name="NBA Pronos Stats"
   gcloud config set project nba-pronos-stats
   ```
5. Activer les APIs nécessaires :
   ```
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
   ```

## Stocker la clé Supabase (jamais collée dans le chat)

La `SUPABASE_SERVICE_ROLE_KEY` (déjà dans `.env.local` à la racine du dépôt)
doit être copiée directement depuis ce fichier vers Secret Manager, sans
passer par le chat :

```
gcloud secrets create nba-pronos-supabase-key --data-file=- <<< "COLLE_LA_CLE_ICI"
```

(remplace `COLLE_LA_CLE_ICI` par la vraie valeur de
`SUPABASE_SERVICE_ROLE_KEY` dans `.env.local`, exécuté directement dans ton
terminal — la valeur ne transite jamais par cette conversation).

## Déployer

Depuis `Cadrage/Stats/` (le `Dockerfile` s'y trouve, c'est le contexte de
build attendu) :

```
cd Cadrage/Stats
gcloud run deploy nba-pronos-stats `
  --source . `
  --region europe-west1 `
  --allow-unauthenticated `
  --set-env-vars SUPABASE_URL=<valeur de NEXT_PUBLIC_SUPABASE_URL dans .env.local> `
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=nba-pronos-supabase-key:latest
```

(`--allow-unauthenticated` : le service est appelé par l'appli/le cron, pas
par un navigateur avec compte Google — à revoir si on veut le protéger plus
tard, par exemple avec un secret partagé vérifié dans `app.py`, sur le même
principe que `SYNC_SECRET` côté appli).

`gcloud` retourne une URL du style
`https://nba-pronos-stats-xxxxx.europe-west1.run.app` à la fin du
déploiement — à garder, nécessaire pour la suite (appli + cron GitHub
Actions).

## Vérifier

```
curl https://<url-du-service>/health
curl -X POST https://<url-du-service>/predict -H "Content-Type: application/json" -d '{"joueur": "Tatum", "stat": "ft", "seuil": 0.85}'
```

Doit renvoyer exactement les mêmes résultats que les tests en local (déjà
vérifiés le 21/08/2026 — Tatum FT% 26.8%, etc.)

## Redéployer après un changement de code

```
cd Cadrage/Stats
gcloud run deploy nba-pronos-stats --source . --region europe-west1
```

(les modèles `.joblib` étant embarqués dans l'image au build, un
réentraînement futur nécessite aussi un redéploiement pour que le service
utilise les nouveaux fichiers — pas de synchronisation automatique.)
