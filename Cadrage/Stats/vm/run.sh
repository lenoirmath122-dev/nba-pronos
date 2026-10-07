#!/bin/bash
# Lancé par systemd (nba-refresh@<mode>.service) : import des box scores NBA puis
# résolution des paris. Modes (liste fermée, aucune saisie libre) :
#   timer / manuel : Regular Season, Playoffs, PlayIn
#   presaison      : ajoute Pre Season (à lancer à la main seulement : la présaison
#                    partage le label de saison avec la saison régulière)
set -euo pipefail

MODE="${1:-timer}"
case "$MODE" in
  timer|manuel) TYPES=("Regular Season" "Playoffs" "PlayIn") ;;
  presaison)    TYPES=("Pre Season" "Regular Season" "Playoffs" "PlayIn") ;;
  *) echo "Mode inconnu : $MODE (timer|manuel|presaison)" >&2; exit 2 ;;
esac

REPO=/opt/nba-pronos
STATE=/var/lib/nba-refresh
VENV="$STATE/venv"
REQ="$REPO/Cadrage/Stats/service/requirements-refresh.txt"

# Une seule exécution à la fois (timer + lancement manuel simultanés) : stats_block_events
# est en delete+insert, deux runs en parallèle se marcheraient dessus.
exec 9>"$STATE/lock"
flock -w 7200 9

# Dépendances : (ré)installées seulement si le fichier a changé.
HASH="$(sha256sum "$REQ" | cut -d' ' -f1)"
if [ ! -x "$VENV/bin/python" ] || [ "$(cat "$STATE/req.hash" 2>/dev/null || true)" != "$HASH" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet -r "$REQ"
  echo "$HASH" > "$STATE/req.hash"
fi

# Secrets lus à la volée depuis Secret Manager (compte de service de la VM),
# gardés en mémoire seulement : jamais écrits sur le disque.
SUPABASE_SERVICE_ROLE_KEY="$(gcloud secrets versions access latest --secret=nba-pronos-supabase-key)"
SYNC_SECRET="$(gcloud secrets versions access latest --secret=nba-pronos-sync-secret)"
export SUPABASE_SERVICE_ROLE_KEY SYNC_SECRET

cd "$REPO/Cadrage/Stats/service"
exec "$VENV/bin/python" refresh_job.py --season-types "${TYPES[@]}" --trigger "vm-$MODE"
