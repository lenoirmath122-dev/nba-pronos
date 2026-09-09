# Reproductibilité du moteur ML (p1-10, feuille de route Phase 1)

> Écrit le 07/09/2026. Répond à une question précise : **si la machine de
> développement disparaît là, maintenant, qu'est-ce qu'on perd et comment
> on repart ?** — `models/` et `data/` (sous `Cadrage/Stats/`) sont tous les
> deux gitignorés (`.gitignore:52-54`), donc absents du dépôt et de tout
> historique Git. Jusqu'ici, leur seule existence tenait à cette seule
> machine (+ ce qui est actuellement embarqué dans la dernière image Cloud
> Run déployée, cf. plus bas) — aucune sauvegarde externe.

## Ce qui est en jeu

| Dossier | Taille (07/09/2026) | Contenu | Régénérable ? |
|---|---|---|---|
| `Cadrage/Stats/data/raw/` | ~596 Mo, 19 812 fichiers CSV | Extraction brute `nba_api` | Oui — re-fetch complet |
| `Cadrage/Stats/data/nba.db` | ~710 Mo | SQLite reconstruit depuis `raw/` | Oui — re-généré en local, jamais committé |
| `Cadrage/Stats/models/` | ~920 Mo, 61 fichiers `.joblib` | Modèles entraînés (scikit-learn) | Oui — ré-entraînable depuis `nba.db` |

**Bonne nouvelle** : rien ici n'est une donnée propriétaire perdue à
jamais. La source (`nba_api`, wrapper Python de l'API stats.nba.com) est
publique et gratuite — tout le pipeline est donc reconstructible de zéro,
juste long (voir estimation de temps plus bas). Ce document existe pour
que cette reconstruction ne dépende pas de retrouver la bonne suite de
commandes dans sa tête sous pression.

## Sauvegarde externe (faite le 07/09/2026)

`models/` est sauvegardé sur Google Cloud Storage (même projet GCP que
Cloud Run, `nba-pronos-stats-2026`, aucun nouvel outil à gérer) :

```
gs://nba-pronos-stats-2026-models-backup/models/
```

Bucket créé en `europe-west1`, classe `NEARLINE` (moins cher qu'un stockage
standard pour un usage "accès rare", coût de l'ordre de 2 centimes/mois
pour ~920 Mo). Vérifié : 61 fichiers, ~920 Mo, correspond exactement au
contenu local au moment de l'upload.

**`data/` n'est volontairement PAS sauvegardé** — 1,3 Go, régénérable en
quelques heures depuis `nba_api` (voir plus bas), le rapport coût de
stockage / valeur de la sauvegarde n'est pas favorable pour ce dossier
précis (contrairement à `models/`, dont le ré-entraînement complet prend
nettement plus longtemps que le simple re-fetch de `data/`).

### Remettre à jour la sauvegarde après un nouvel entraînement

À refaire à chaque fois que de nouveaux modèles sont entraînés/modifiés
(pas de synchronisation automatique) :

```powershell
gcloud storage rsync Cadrage/Stats/models gs://nba-pronos-stats-2026-models-backup/models --recursive
```

`rsync` ne retransfère que ce qui a changé — rapide après le premier
upload complet.

**Note ajoutée le 09/09/2026** : les entraînements sont généralement lancés
depuis Claude Code (dans VS Code), pas manuellement par l'exploitant — cette
commande de resynchronisation fait donc partie de la fin de toute session
d'entraînement à faire exécuter par Claude Code dans la foulée, avant de
considérer la session terminée, plutôt qu'un rappel laissé à l'exploitant
pour plus tard. Pertinent en particulier depuis p1-11 (feuille de route
Phase 1) : le déploiement Cloud Run automatisé (`.github/workflows/
deploy-stats-service.yml`) part de cette sauvegarde, pas du disque local —
une sauvegarde oubliée après entraînement se traduit directement par un
déploiement de modèles périmés (voir `service/DEPLOIEMENT_CLOUD_RUN.md`
§« Déploiement automatisé »).

### Restaurer depuis la sauvegarde (cas le plus probable : machine perdue mais modèles pas retouchés récemment)

```powershell
gcloud storage rsync gs://nba-pronos-stats-2026-models-backup/models Cadrage/Stats/models --recursive
```

Puis redéployer Cloud Run pour que le service utilise ces modèles restaurés
(l'image embarque `models/` au build, voir `service/DEPLOIEMENT_CLOUD_RUN.md`
§"Redéployer après un changement de code") :

```powershell
cd Cadrage/Stats
gcloud run deploy nba-pronos-stats --source . --region europe-west1
```

## Reconstruction complète depuis zéro (si la sauvegarde GCS est elle aussi indisponible, ou pour repartir propre)

### Prérequis

- Python 3.12 (version utilisée par le Dockerfile du service, `Cadrage/Stats/Dockerfile`).
- `pip install -r Cadrage/Stats/scripts/requirements.txt`.
- Aucune clé/API payante nécessaire pour `data`/`models` (nba_api est un
  wrapper non-officiel gratuit, sans authentification). Une clé Supabase
  (`SUPABASE_SERVICE_ROLE_KEY`) est nécessaire uniquement pour
  `train_player_period_model.py` (voir note plus bas) et pour le service
  de prédiction lui-même.

### Étapes, dans l'ordre (depuis `Cadrage/Stats/scripts/`)

1. **Extraction brute** — `python fetch_nba_data.py`. Va chercher plusieurs
   saisons sur `stats.nba.com` via `nba_api`, écrit dans `../data/raw/`.
   Reprenable (saute les `game_id` déjà présents si interrompu et relancé).
   **Compter plusieurs heures d'exécution** (throttle volontaire de 0.5-1s
   entre requêtes, ~19 800 fichiers au volume actuel).
2. **Chargement en base** — `python load_to_sqlite.py`. Reconstruit
   entièrement `../data/nba.db` depuis `raw/` (quelques secondes pour 2
   saisons, plusieurs minutes pour 5+ saisons).
3. **Variables prédictives** — `python build_features.py`.
4. **Tables cibles** — `python build_targets.py`.
5. **Entraînement** — lancer **tous** les scripts `train_*.py` de ce
   dossier. Volontairement **pas de liste figée ici** : ce pipeline a déjà
   grossi de 4 à 18 scripts d'entraînement en 3 semaines (24/08 → 07/09/2026)
   sans que la doc générée (`README.pdf`, voir note ci-dessous) suive —
   même piège à éviter ici. Lister la vérité du moment avant de lancer :
   ```powershell
   Get-ChildItem Cadrage/Stats/scripts/train_*.py | Select-Object Name
   ```
   Chaque script écrit un ou plusieurs `.joblib` dans `../models/` (le nom
   du script indique la cible : `train_team_rebounds_model.py` → rebonds
   équipe, `train_total_points_model.py` → total combiné des 2 équipes,
   etc.). Un script peut être relancé seul si un seul modèle a besoin
   d'être ré-entraîné — pas besoin de tout refaire.
   - **Cas particulier : `train_player_period_model.py`** — ne lit PAS
     `nba.db`, interroge directement Supabase (`stats_box_scores_by_period`).
     Nécessite donc que cette table soit déjà peuplée côté Supabase (via
     `service/backfill_period_box_scores.py`) **avant** de le lancer — sinon
     rien à entraîner. Ordre à respecter : backfill Supabase d'abord, ce
     script ensuite.
   - `tuning.py` n'est **pas** un script d'entraînement à lancer seul —
     module partagé importé par `train_home_win_model.py`
     (hyperparamètres). Présent dans le dossier, jamais exécuté directement.
6. **Vérifier** — `python tester_modele.py --joueur "Nikola Jokic" --stat pts --seuil 25`
   (fonctionne pour la plupart des modèles joueur — voir `README.pdf` pour
   la liste complète des flags).
7. **Redéployer Cloud Run** avec les modèles fraîchement entraînés — voir
   `service/DEPLOIEMENT_CLOUD_RUN.md` §"Redéployer après un changement de code".
8. **Refaire la sauvegarde externe** (section précédente) — sinon la
   sauvegarde GCS reste sur l'ancienne génération de modèles.

### Estimation de temps totale

De zéro (machine neuve, rien en cache) : **une bonne journée**, dominée par
l'étape 1 (extraction, plusieurs heures) et l'entraînement des 18 scripts
(quelques minutes à quelques dizaines de minutes chacun selon le modèle,
pas mesuré précisément au global). Depuis la sauvegarde GCS (`models/`
déjà là, juste besoin de redéployer) : **quelques minutes**.

### `README.pdf` existant — à lire en complément, pas à la place de ce document

`Cadrage/Stats/README.pdf` (généré par `scripts/generate_readme.py`,
committé) documente déjà l'installation, l'extraction et le chargement en
détail, avec des commandes PowerShell complètes. **Mais sa section
"entraînement" ne liste que 4 des 18 scripts `train_*.py` actuels** (elle
date d'avant l'essentiel du chantier "période"/"événements granulaires"
du 24/08 → 06/09/2026, jamais régénérée depuis) — ne pas s'y fier pour la
liste des modèles à entraîner, seulement pour le détail des étapes 1-4
ci-dessus. Régénérer avec `python generate_readme.py` avant de s'y fier
à nouveau pour l'entraînement (mise à jour de son contenu hors scope de ce
document).
