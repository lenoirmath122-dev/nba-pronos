# Image du micro-service de proba (Cadrage/Stats/service), Phase 4
# (projet-data-nba.md §22-23) -- destinee a Google Cloud Run.
#
# Architecture "sans etat" : aucune donnee (nba.db, ~710 Mo au 07/09/2026)
# n'est embarquee dans l'image -- le contexte joueur vient de Supabase a la
# demande (service/supabase_context.py). Seuls les modeles entraines
# (models/, ~920 Mo au 07/09/2026 -- grossit a chaque nouveau modele
# entraine, chiffre a reverifier avant de le citer ailleurs) sont copies,
# plus les fichiers Python necessaires a l'inference (pas tout scripts/ --
# fetch_nba_data.py/nba_api etc. inutiles ici).
#
# tuning.py OBLIGATOIRE dans cette liste (bug reel du 02/09/2026) :
# train_home_win_model.py fait `from tuning import tune_random_forest`
# (chantier hyperparametres) et supabase_context.py importe
# train_home_win_model pour ses constantes de features -- sans tuning.py
# copie ici, le conteneur crashe au demarrage (ModuleNotFoundError avant
# meme d'ecouter sur le port), Cloud Run le rapporte comme "failed to
# start and listen on PORT" (message trompeur, la vraie cause est dans les
# logs Cloud Run, pas dans la sortie de `gcloud run deploy`).
#
# Build (depuis Cadrage/Stats/, qui doit etre le contexte de build) :
#   gcloud run deploy nba-pronos-stats --source . \
#     --region europe-west1 \
#     --set-env-vars SUPABASE_URL=... \
#     --set-secrets SUPABASE_SERVICE_ROLE_KEY=nba-pronos-supabase-key:latest

FROM python:3.12-slim

WORKDIR /app

COPY service/requirements.txt ./service/requirements.txt
RUN pip install --no-cache-dir -r ./service/requirements.txt

COPY scripts/tester_modele.py scripts/build_features.py scripts/train_home_win_model.py scripts/series_probability.py scripts/tuning.py ./scripts/
COPY models/ ./models/
COPY service/app.py service/supabase_context.py ./service/

WORKDIR /app/service
ENV PYTHONUNBUFFERED=1
EXPOSE 8080

# Forme shell (pas exec []) : necessaire pour que $PORT soit substitue par le
# shell -- Cloud Run fixe cette variable au demarrage (8080 par defaut).
CMD uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}
