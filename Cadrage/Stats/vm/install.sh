#!/bin/bash
# Installation (idempotente) sur la VM, À LANCER EN ROOT après avoir cloné le dépôt
# dans /opt/nba-pronos (voir DEPLOIEMENT_VM.md) :
#   sudo bash /opt/nba-pronos/Cadrage/Stats/vm/install.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "À lancer avec sudo." >&2; exit 1; fi
VMDIR=/opt/nba-pronos/Cadrage/Stats/vm
[ -d "$VMDIR" ] || { echo "Dépôt absent : $VMDIR" >&2; exit 1; }

echo "== Paquets"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git python3-venv unattended-upgrades >/dev/null

echo "== Utilisateur système"
id nbarefresh >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin nbarefresh
chown -R nbarefresh:nbarefresh /opt/nba-pronos
# git pull en tant que nbarefresh sur un dépôt qu'il possède : rien à déclarer.

echo "== Swap 2 Go (1 Go de RAM : pandas)"
if ! swapon --show | grep -q /swapfile; then
  [ -f /swapfile ] || { fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null; }
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== Configuration (/etc/nba-refresh/env)"
install -d -m 755 /etc/nba-refresh
if [ ! -f /etc/nba-refresh/env ]; then
  read -r -p "SUPABASE_URL (https://xxxx.supabase.co) : " SUPABASE_URL
  printf 'SUPABASE_URL=%s\nAPP_URL=https://nba-pronos.vercel.app\n' "$SUPABASE_URL" > /etc/nba-refresh/env
  chmod 644 /etc/nba-refresh/env   # aucune valeur secrète dedans
fi

echo "== Mises à jour de sécurité automatiques (redémarrage à 03:30 UTC, hors créneaux d'import)"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
cat > /etc/apt/apt.conf.d/52nba-refresh <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:30";
EOF

echo "== Unités systemd"
install -m 644 "$VMDIR/nba-refresh@.service" /etc/systemd/system/nba-refresh@.service
install -m 644 "$VMDIR/nba-refresh.timer" /etc/systemd/system/nba-refresh.timer
chmod 755 "$VMDIR/run.sh"
systemctl daemon-reload
systemctl enable --now nba-refresh.timer

echo
echo "Installé. Prochaines exécutions :"
systemctl list-timers 'nba-refresh*' --no-pager
echo
echo "Test à la main :  sudo systemctl start nba-refresh@manuel.service"
