#!/bin/bash
# Déclencheur de l'import depuis GitHub Actions (workflow run-stats-import-vm.yml).
# Installé par install.sh dans /usr/local/sbin/nba-refresh-trigger (root:root, 755) :
# c'est la SEULE commande que le compte de service GitHub peut lancer en sudo
# (/etc/sudoers.d/nba-refresh-trigger). Ne jamais le faire pointer vers /opt/nba-pronos :
# ce dossier appartient à nbarefresh et change à chaque git pull, autoriser un
# script qui y vit en sudoers donnerait root à quiconque merge sur main.
#
#   sudo /usr/local/sbin/nba-refresh-trigger manuel|presaison
#
# Attend la fin du service (oneshot), affiche la fin de son journal, et sort avec
# son code de retour : le run GitHub passe au rouge si l'import échoue.
set -uo pipefail

MODE="${1:-}"
case "$MODE" in
  manuel|presaison) ;;
  *) echo "Mode inconnu : '$MODE' (manuel|presaison)" >&2; exit 2 ;;
esac

UNIT="nba-refresh@${MODE}.service"
systemctl start "$UNIT"
RC=$?

INVOCATION="$(systemctl show -p InvocationID --value "$UNIT")"
echo "== Journal de $UNIT (120 dernières lignes) =="
if [ -n "$INVOCATION" ]; then
  journalctl "_SYSTEMD_INVOCATION_ID=$INVOCATION" -n 120 --no-pager
else
  journalctl -u "$UNIT" -n 120 --no-pager
fi
echo "== code de sortie du service : $RC =="
exit "$RC"
