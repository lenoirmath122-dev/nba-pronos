# Import quotidien des box scores sur une VM Compute Engine

> Pourquoi une VM : stats.nba.com expire depuis GitHub Actions ET depuis Cloud
> Run (testé le 07/10/2026 : `ReadTimeout`), mais répond depuis Cloud Shell et
> depuis une VM Compute Engine e2-micro (`RESULT OK 24 5.1`). Une seule
> mesure : la stabilité se juge sur une semaine d'observation.

## Ce que fait la VM

- Un timer systemd lance `nba-refresh@timer.service` à **12h et 16h (Paris)**.
  12h : les derniers matchs de la côte Ouest finissent vers 7h, le play-by-play
  est en général publié. 16h : rattrapage.
- Le service met le code à jour (`git pull`), puis lance `run.sh` : lecture des
  secrets dans Secret Manager (en mémoire seulement), puis `refresh_job.py` =
  import des matchs manquants (`refresh_daily.py`, mode strict) puis
  `POST /api/resolve-bets`.
- **Un match n'est enregistré que s'il est complet** (box score, play-by-play,
  4 quarts-temps). Sinon il est sauté et réessayé au passage suivant ; ses paris
  restent en attente (jamais perdus à cause d'une donnée absente). Si un match
  n'est jamais complet, l'import reste rouge et l'admin résout à la main.
- L'import est incrémental : un lancement à J+1, J+2... rattrape tout ce qui
  manque.
- Chaque exécution écrit une ligne `sync_logs` (`STATS_IMPORT`, visible dans
  `/admin/sync-logs`), préfixe `[vm-timer]`, `[vm-manuel]` ou `[local]`.

## Coût (quota « toujours gratuit », à vérifier sur cloud.google.com/free)

- 1 VM e2-micro non préemptible, **us-west1 / us-central1 / us-east1
  uniquement**, 720 h/mois **par compte de facturation** : une seule e2-micro.
- Disque **standard** (`pd-standard`) 30 Go max. Le type « balanced » est facturé.
- 1 Go/mois de sortie réseau. Notre usage : quelques Mo/jour.
- **Non confirmé** : l'IPv4 externe de la VM est peut-être facturée (~3,6 $/mois
  depuis 2024) même sur l'offre gratuite. D'où le budget d'alerte à 1 € (étape 1)
  et un coup d'œil à Facturation > Rapports (filtre par SKU) 48 h après la
  création de la VM. IP **éphémère** volontairement : si stats.nba.com bloque
  l'IP, arrêter puis redémarrer la VM en donne une autre ; une IP statique
  figerait l'adresse bloquée (et se facture si on l'oublie).

## Installation (une fois, dans Cloud Shell : console.cloud.google.com, icône `>_`)

### 1. Vérifications et budget

```bash
gcloud config set project nba-pronos-stats-2026
gcloud compute instances list
gcloud services enable compute.googleapis.com iap.googleapis.com oslogin.googleapis.com secretmanager.googleapis.com
gcloud secrets versions access latest --secret=nba-pronos-supabase-key | cut -c1-10   # doit afficher sb_secret_
```

Console > Facturation > Budgets et alertes : budget de 1 € avec alertes à 50 %,
90 % et 100 %.

### 2. Compte de service et secrets

```bash
gcloud iam service-accounts create nba-refresh-vm --display-name="VM import stats NBA"
VMSA=nba-refresh-vm@nba-pronos-stats-2026.iam.gserviceaccount.com
gcloud secrets add-iam-policy-binding nba-pronos-supabase-key --member="serviceAccount:$VMSA" --role=roles/secretmanager.secretAccessor
read -s -p "SYNC_SECRET (copié depuis Vercel) : " S && printf %s "$S" | gcloud secrets create nba-pronos-sync-secret --data-file=- && unset S
gcloud secrets add-iam-policy-binding nba-pronos-sync-secret --member="serviceAccount:$VMSA" --role=roles/secretmanager.secretAccessor
```

Le compte de service n'a **aucun** rôle au niveau du projet : uniquement l'accès
à ces deux secrets. Ne jamais coller une valeur de secret dans un chat ou le dépôt.

### 3. VM et pare-feu

```bash
gcloud compute instances create nba-refresh --zone=us-central1-a --machine-type=e2-micro \
  --image-family=debian-12 --image-project=debian-cloud --boot-disk-type=pd-standard --boot-disk-size=30GB \
  --service-account=$VMSA --scopes=cloud-platform --metadata=enable-oslogin=TRUE --tags=nba-refresh --shielded-secure-boot
gcloud compute firewall-rules create allow-ssh-from-iap --network=default --direction=INGRESS --action=allow \
  --rules=tcp:22 --source-ranges=35.235.240.0/20 --target-tags=nba-refresh
gcloud compute firewall-rules delete default-allow-ssh default-allow-rdp
gcloud compute ssh nba-refresh --zone=us-central1-a --tunnel-through-iap
```

Le SSH ne passe que par le tunnel IAP (gratuit) : plus aucun port ouvert au
monde. Le bouton « SSH » de la console peut ne plus marcher sans
`default-allow-ssh` ; la commande ci-dessus, elle, fonctionne.

### 4. Sur la VM (le dépôt est public : clone en https, aucune clé)

```bash
sudo apt-get update && sudo apt-get install -y git
sudo install -d -m 755 /opt/nba-pronos
sudo git clone --depth 1 --filter=blob:none --sparse https://github.com/lenoirmath122-dev/nba-pronos.git /opt/nba-pronos
sudo git -C /opt/nba-pronos sparse-checkout set Cadrage/Stats/service Cadrage/Stats/scripts Cadrage/Stats/vm
sudo bash /opt/nba-pronos/Cadrage/Stats/vm/install.sh   # swap, utilisateur, unités, timer ; demande SUPABASE_URL
```

### 5. Test

```bash
sudo systemctl start nba-refresh@manuel.service; echo "code=$?"
sudo journalctl -u 'nba-refresh@*' -n 150 --no-pager
systemctl list-timers 'nba-refresh*'
```

Puis vérifier la ligne `STATS_IMPORT` `[vm-manuel]` dans `/admin/sync-logs`.
Pour tester sur des matchs de présaison : `sudo systemctl start nba-refresh@presaison.service`
(manuel uniquement : la présaison partage le label de saison avec la saison régulière).

### 6. Nettoyage de l'ancienne VM de test

```bash
gcloud compute instances delete nba-ping-vm --zone=us-central1-a
gcloud run jobs list --region=europe-west1    # supprimer d'éventuels jobs de test : gcloud run jobs delete <nom> --region=europe-west1
```

## Au quotidien

- **Mise à jour du code** : automatique (`git pull` avant chaque run). Tout merge
  sur `main` part donc en production au run suivant (la PR et la CI font barrière).
  Changer une unité systemd demande de relancer `install.sh`.
- **Mises à jour système** : automatiques (`unattended-upgrades`), redémarrage à
  03:30 UTC, hors des créneaux d'import.
- **Contrôle mensuel** : `systemctl list-timers 'nba-refresh*'`, espace disque
  (`df -h /`), `journalctl --disk-usage`.
- **Déclencher à la main** : `gcloud compute ssh nba-refresh --zone=us-central1-a --tunnel-through-iap --command "sudo systemctl start nba-refresh@manuel.service"`
  (Cloud Shell, aussi depuis le téléphone). Un bouton « Run workflow » GitHub
  est prévu dans une PR suivante, avec un watchdog qui ouvre une issue si le
  dernier import a échoué ou date de plus de 26 h.
- **Premier run réussi** : épingler les versions (`pip freeze` dans le venv
  `/var/lib/nba-refresh/venv`) dans `requirements-refresh.txt`.

## Si l'IP de la VM est bloquée

1. `gcloud compute instances stop nba-refresh --zone=us-central1-a`, puis `start` :
   une nouvelle IP éphémère est attribuée. Retester.
2. Sinon, plan B : `refresh-local.ps1` depuis le PC (voir son en-tête ; ne pas le
   lancer en même temps que la VM).
3. nba_api reste de toute façon un garde-fou manuel en cas de gros bug.
