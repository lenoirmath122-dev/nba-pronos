# Déploiement du micro-service sur Google Cloud Run

> À exécuter par l'utilisateur (compte Google Cloud + `gcloud` CLI
> nécessaires, pas accessible depuis cet environnement). Décidé le
> 21/08/2026 — voir `projet-data-nba.md` §22-24 pour le contexte complet.
>
> **Suivi de bout en bout et vérifié le 21/08/2026** (§24) : service en
> ligne, `/predict` testé avec succès. Ce guide a été corrigé après coup
> avec les 2 accrocs réels rencontrés (permission Secret Manager, commande
> multi-lignes PowerShell) — la version ci-dessous est celle qui marche,
> pas la version originale.

## Prérequis (une fois)

1. Compte Google Cloud (carte requise, aucun débit tant que l'usage reste
   sous le free tier — voir §23).
2. Installer `gcloud` CLI : https://cloud.google.com/sdk/docs/install
   (sur Windows, `winget install Google.CloudSDK` fonctionne aussi — si
   winget signale une install existante cassée, ajouter `--include-unknown`).
   **Ouvrir un nouveau terminal après l'installation** (le PATH mis à jour
   n'est pas repris par un terminal déjà ouvert).
3. `gcloud init` (authentification — ouvre un navigateur — puis choix
   "Create a new project"). L'ID de projet doit être unique **mondialement** ;
   prévoir un suffixe (ex. `nba-pronos-stats-2026`) plutôt qu'un nom trop
   générique, l'ID ne peut plus être changé après coup.
4. **Lier un compte de facturation** (obligatoire même pour rester dans le
   free tier, sinon les APIs de l'étape 5 refusent de s'activer) — pas de
   commande `gcloud` simple pour ça, passer par la console :
   https://console.cloud.google.com/billing/linkedaccount?project=TON_ID_DE_PROJET
5. Activer les APIs nécessaires :
   ```
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
   ```

## Stocker la clé Supabase (jamais collée dans le chat)

La `SUPABASE_SERVICE_ROLE_KEY` (déjà dans `.env.local` à la racine du dépôt)
doit être copiée directement depuis ce fichier vers Secret Manager, sans
passer par le chat.

PowerShell (Windows) :
```powershell
"COLLE_LA_CLE_ICI" | gcloud secrets create nba-pronos-supabase-key --data-file=-
```
Bash :
```bash
gcloud secrets create nba-pronos-supabase-key --data-file=- <<< "COLLE_LA_CLE_ICI"
```

(remplace `COLLE_LA_CLE_ICI` par la vraie valeur de
`SUPABASE_SERVICE_ROLE_KEY` dans `.env.local`, exécuté directement dans ton
terminal — la valeur ne doit jamais transiter par le chat. Incident réel le
21/08/2026 : la clé est apparue en clair via une sélection IDE collée par
mégarde — rotation proposée, déclinée par l'utilisateur ce jour-là.)

**Étape indispensable, absente de la 1re version de ce guide** : Cloud Run
utilise un compte de service PAR DÉFAUT qui n'a PAS accès aux secrets tant
qu'on ne le lui accorde pas explicitement — sans ça, le déploiement passe
mais le service plante au runtime (`Permission denied on secret`) :
```powershell
gcloud secrets add-iam-policy-binding nba-pronos-supabase-key --member="serviceAccount:TON_NUMERO_PROJET-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```
(le numéro de projet, différent de l'ID texte du projet, apparaît dans les
messages d'erreur `gcloud` ou via `gcloud projects describe TON_ID_DE_PROJET`.)

## Déployer

Depuis `Cadrage/Stats/` (le `Dockerfile` s'y trouve, c'est le contexte de
build attendu). **Commande sur UNE SEULE LIGNE** — la continuation
multi-lignes par backtick (PowerShell) s'est mal découpée en pratique le
21/08/2026, un des flags s'est retrouvé exécuté comme une commande séparée,
donc le service a d'abord été déployé sans les identifiants Supabase :

```powershell
cd Cadrage/Stats
gcloud run deploy nba-pronos-stats --source . --region europe-west1 --allow-unauthenticated --set-env-vars SUPABASE_URL=<valeur de NEXT_PUBLIC_SUPABASE_URL dans .env.local> --set-secrets SUPABASE_SERVICE_ROLE_KEY=nba-pronos-supabase-key:latest
```

(`--allow-unauthenticated` : le service est appelé par l'appli/le cron, pas
par un navigateur avec compte Google — à revoir si on veut le protéger plus
tard, par exemple avec un secret partagé vérifié dans `app.py`, sur le même
principe que `SYNC_SECRET` côté appli. `SUPABASE_URL` n'est pas secrète —
déjà publique côté navigateur — sans risque à écrire en clair dans la
commande.)

Une confirmation `Do you want to continue (Y/n)?` apparaît au 1er
déploiement (création du dépôt Artifact Registry) — répondre `Y`. Le build
+ déploiement prend quelques minutes (upload des ~103 Mo de modèles inclus).

`gcloud` retourne une URL du style
`https://nba-pronos-stats-xxxxx.europe-west1.run.app` à la fin du
déploiement — à garder, nécessaire pour la suite (appli + cron GitHub
Actions).

**Si `/predict` renvoie une erreur serveur après déploiement** (mais que
`/health` répond) : les identifiants Supabase n'ont pas été pris en compte
(cf. l'accroc de commande multi-lignes ci-dessus). Corriger SANS
reconstruire l'image :
```powershell
gcloud run services update nba-pronos-stats --region europe-west1 --set-env-vars SUPABASE_URL=<...> --set-secrets SUPABASE_SERVICE_ROLE_KEY=nba-pronos-supabase-key:latest
```

## Vérifier

```
curl https://<url-du-service>/health
curl -X POST https://<url-du-service>/predict -H "Content-Type: application/json" -d '{"joueur": "Tatum", "stat": "ft", "seuil": 0.85}'
```

Doit renvoyer exactement les mêmes résultats que les tests en local (vérifié
le 21/08/2026 — Tatum FT% 26.8%, Jokić double-double 75.1%, etc.)

## Redéployer après un changement de code

```
cd Cadrage/Stats
gcloud run deploy nba-pronos-stats --source . --region europe-west1
```

(les modèles `.joblib` étant embarqués dans l'image au build, un
réentraînement futur nécessite aussi un redéploiement pour que le service
utilise les nouveaux fichiers — pas de synchronisation automatique. Les
variables d'environnement/secrets déjà configurés sont conservés d'une
révision à l'autre, pas besoin de les repasser à chaque redéploiement.)
