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

## Sécuriser l'accès (secret partagé, audit sécurité 29/08/2026)

Le service est déployé `--allow-unauthenticated` (appelé par l'appli/le cron,
pas par un navigateur avec compte Google) MAIS détenait jusqu'ici
`SUPABASE_SERVICE_ROLE_KEY` sans aucune vérification : n'importe qui
connaissant l'URL Cloud Run pouvait l'appeler directement. `app.py` vérifie
désormais un header `Authorization: Bearer <STATS_SERVICE_SECRET>` sur
toutes les routes `/predict*` (`RequireSharedSecretMiddleware`), même
principe que `SYNC_SECRET` côté appli Next.js — **fail closed** : tant que la
variable n'est pas définie côté service, toute route `/predict*` refuse
(401). Seule `/health` reste ouverte (healthcheck Cloud Run, aucune donnée
sensible).

Générer un secret et le stocker dans Secret Manager (même patron que la clé
Supabase ci-dessus, jamais collé dans le chat) :

```powershell
$bytes = New-Object byte[] 32; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); [Convert]::ToBase64String($bytes) | gcloud secrets create nba-pronos-stats-secret --data-file=-
gcloud secrets add-iam-policy-binding nba-pronos-stats-secret --member="serviceAccount:TON_NUMERO_PROJET-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

Puis l'ajouter au service (ne casse pas la révision existante, `--set-secrets`
est cumulatif avec celui déjà posé pour Supabase) :

```powershell
gcloud run services update nba-pronos-stats --region europe-west1 --set-secrets SUPABASE_SERVICE_ROLE_KEY=nba-pronos-supabase-key:latest,STATS_SERVICE_SECRET=nba-pronos-stats-secret:latest
```

Et côté appli Next.js, ajouter la MÊME valeur (récupérable via
`gcloud secrets versions access latest --secret=nba-pronos-stats-secret`) en
variable d'environnement `STATS_SERVICE_SECRET` — `.env.local` en local,
Vercel en production (`lib/ai/statsService.ts` l'ajoute automatiquement en
header `Authorization` sur chaque appel dès qu'elle est définie).

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
+ déploiement prend quelques minutes (upload des modèles inclus, ~920 Mo au
07/09/2026 — grossit à chaque nouveau modèle entraîné, `du -sh Cadrage/Stats/models`
pour le chiffre à jour).

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

## Déploiement automatisé (CI, hors machine personnelle)

**Ajouté le 09/09/2026 (p1-11, feuille de route Phase 1)** : le déploiement
manuel ci-dessus dépend entièrement de la machine de l'exploitant (upload des
~920 Mo de modèles compris, terminal ouvert le temps du build). Un workflow
GitHub Actions (`.github/workflows/deploy-stats-service.yml`) fait la même
chose sans cette dépendance : déclenché manuellement (`workflow_dispatch`,
bouton "Run workflow" dans l'onglet Actions de GitHub), il récupère les
modèles depuis la sauvegarde externe (`gs://nba-pronos-stats-2026-models-backup`,
créée lors de p1-10) puis lance le même `gcloud run deploy --source` que la
commande manuelle.

**À utiliser plutôt que la commande manuelle pour tout redéploiement
désormais** (code changé ou nouveaux modèles entraînés + poussés vers la
sauvegarde) — la procédure manuelle ci-dessus reste documentée comme
solution de secours/dépannage.

**⚠️ Piège réel à connaître, propre à ce workflow** : contrairement au
déploiement manuel (qui prend toujours les modèles les plus frais du disque
de l'exploitant), ce workflow déploie ce qui est **dans la sauvegarde GCS**,
pas ce qui est sur la machine locale. Or `REPRODUCTIBILITE.md` documente que
cette sauvegarde ne se met à jour que manuellement
(`gcloud storage rsync Cadrage/Stats/models gs://nba-pronos-stats-2026-models-backup/models --recursive`),
jamais automatiquement. **Après tout nouvel entraînement de modèle,
resynchroniser la sauvegarde AVANT de lancer ce workflow** — sinon il
redéploie silencieusement une génération de modèles périmée. Un simple
changement de code du service (sans nouveau modèle) n'a pas ce problème : la
sauvegarde existante reste valide.

### Mise en place unique (à exécuter une seule fois, par l'exploitant)

Authentification par **Workload Identity Federation** plutôt qu'une clé de
service account statique — pas d'identifiant long-lived supplémentaire à
protéger (ce projet a déjà eu un incident de fuite de clé, cf. section
précédente). Toutes les commandes ci-dessous s'exécutent avec `gcloud` déjà
authentifié sur le projet `nba-pronos-stats-2026` (même pré-requis que le
reste de ce guide, pas accessible depuis cet environnement).

1. Récupérer le numéro de projet (différent de l'ID texte) :
   ```powershell
   gcloud projects describe nba-pronos-stats-2026 --format="value(projectNumber)"
   ```

2. Créer le pool d'identité fédérée et son fournisseur OIDC, restreint à ce
   dépôt précis :
   ```powershell
   gcloud iam workload-identity-pools create "github-pool" --project="nba-pronos-stats-2026" --location="global" --display-name="GitHub Actions"

   gcloud iam workload-identity-pools providers create-oidc "github-provider" --project="nba-pronos-stats-2026" --location="global" --workload-identity-pool="github-pool" --display-name="GitHub" --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" --attribute-condition="assertion.repository=='lenoirmath122-dev/nba-pronos'" --issuer-uri="https://token.actions.githubusercontent.com"
   ```

3. Créer un service account dédié au déploiement (pas le compte par défaut
   Compute Engine utilisé par le service lui-même) et lui accorder les rôles
   nécessaires pour construire + déployer via `--source` :
   ```powershell
   gcloud iam service-accounts create github-deployer --project="nba-pronos-stats-2026" --display-name="Déploiement GitHub Actions (Cloud Run stats)"

   gcloud projects add-iam-policy-binding nba-pronos-stats-2026 --member="serviceAccount:github-deployer@nba-pronos-stats-2026.iam.gserviceaccount.com" --role="roles/run.admin"
   gcloud projects add-iam-policy-binding nba-pronos-stats-2026 --member="serviceAccount:github-deployer@nba-pronos-stats-2026.iam.gserviceaccount.com" --role="roles/cloudbuild.builds.editor"
   gcloud projects add-iam-policy-binding nba-pronos-stats-2026 --member="serviceAccount:github-deployer@nba-pronos-stats-2026.iam.gserviceaccount.com" --role="roles/artifactregistry.writer"
   gcloud projects add-iam-policy-binding nba-pronos-stats-2026 --member="serviceAccount:github-deployer@nba-pronos-stats-2026.iam.gserviceaccount.com" --role="roles/storage.admin"
   gcloud projects add-iam-policy-binding nba-pronos-stats-2026 --member="serviceAccount:github-deployer@nba-pronos-stats-2026.iam.gserviceaccount.com" --role="roles/iam.serviceAccountUser"
   ```
   (`storage.admin` couvre à la fois le bucket de staging que Cloud Build
   crée pour `--source` et la lecture de `gs://nba-pronos-stats-2026-models-backup` —
   même projet GCP pour les deux, pas la peine de granulariser plus finement
   pour un exploitant seul.)

4. Autoriser le fournisseur OIDC à emprunter l'identité de ce service
   account, uniquement depuis ce dépôt (remplacer `TON_NUMERO_PROJET` par la
   valeur récupérée à l'étape 1) :
   ```powershell
   gcloud iam service-accounts add-iam-policy-binding "github-deployer@nba-pronos-stats-2026.iam.gserviceaccount.com" --project="nba-pronos-stats-2026" --role="roles/iam.workloadIdentityUser" --member="principalSet://iam.googleapis.com/projects/TON_NUMERO_PROJET/locations/global/workloadIdentityPools/github-pool/attribute.repository/lenoirmath122-dev/nba-pronos"
   ```

5. Récupérer le nom complet du fournisseur (à coller dans le secret GitHub
   à l'étape suivante) :
   ```powershell
   gcloud iam workload-identity-pools providers describe "github-provider" --project="nba-pronos-stats-2026" --location="global" --workload-identity-pool="github-pool" --format="value(name)"
   ```

6. Ajouter 2 secrets sur le dépôt GitHub (Settings → Secrets and variables →
   Actions → New repository secret) :
   - `GCP_WORKLOAD_IDENTITY_PROVIDER` : la valeur récupérée à l'étape 5
     (format `projects/.../locations/global/workloadIdentityPools/github-pool/providers/github-provider`).
   - `GCP_DEPLOY_SERVICE_ACCOUNT` : `github-deployer@nba-pronos-stats-2026.iam.gserviceaccount.com`

Une fois ces 2 secrets posés, le workflow "Déployer le service Cloud Run
(Stats)" est utilisable depuis l'onglet Actions de GitHub (bouton "Run
workflow") — aucune autre action locale nécessaire pour les déploiements
suivants.

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

**⚠️ Vérifier `Cadrage/Stats/Dockerfile` avant de redéployer si un script a
été modifié/ajouté** (bug réel, 02/09/2026 — voir `GAPS_OUVERTS.md`/
`JOURNAL_SESSIONS.md`) : le Dockerfile ne copie dans l'image que les
fichiers `.py` listés EXPLICITEMENT (`COPY scripts/xxx.py ...`), pas tout
`scripts/`. Le chantier hyperparamètres a ajouté `from tuning import
tune_random_forest` à `train_home_win_model.py` sans ajouter `tuning.py` à
cette liste — le conteneur crashait à l'import avant même d'écouter sur le
port, et **Cloud Run rapporte ça comme un timeout de démarrage** ("container
failed to start and listen on the port"), pas comme une erreur d'import —
le message d'erreur de `gcloud run deploy` ne pointe PAS la vraie cause,
il faut aller lire les vrais logs :
```
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=nba-pronos-stats' --project=nba-pronos-stats-2026 --limit=50
```
**Règle à vérifier à chaque fois qu'un `import` est ajouté à un fichier
copié dans l'image** (`train_home_win_model.py`, `supabase_context.py`,
`app.py`, `tester_modele.py`, `build_features.py`, `series_probability.py`) :
tout nouveau module Python importé (directement ou en cascade) doit être
ajouté à la ligne `COPY scripts/...` du Dockerfile, sinon le déploiement
échoue silencieusement avec ce message trompeur.
