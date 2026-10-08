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

### 7. Déclencheur GitHub (bouton « Run workflow »)

Compte de service dédié, avec le minimum de droits. Il ouvre un vrai shell SSH
(OS Login) ; `sudo` est limité à `nba-refresh-trigger manuel|presaison` (wrapper
root installé hors du dépôt), mais ce shell peut lire le serveur de métadonnées
de la VM, donc les secrets de son compte de service. C'est pourquoi le compte
n'est utilisable **que depuis la branche `main`** (liaison WIF sur le `sub` du
jeton `...:ref:refs/heads/main`, pas sur tout le dépôt : une branche ne peut
pas modifier le workflow pour s'en servir). Dans Cloud Shell :

```bash
P=nba-pronos-stats-2026
PN=$(gcloud projects describe $P --format='value(projectNumber)')
GT=github-vm-trigger@$P.iam.gserviceaccount.com
gcloud iam service-accounts create github-vm-trigger --display-name="Déclencheur import VM (GitHub)"
gcloud iam service-accounts add-iam-policy-binding $GT --role=roles/iam.workloadIdentityUser   --member="principal://iam.googleapis.com/projects/$PN/locations/global/workloadIdentityPools/github-pool/subject/repo:lenoirmath122-dev@289689910/nba-pronos@1304699712:ref:refs/heads/main"
gcloud compute instances add-iam-policy-binding nba-refresh --zone=us-central1-a --role=roles/compute.osLogin --member="serviceAccount:$GT"
gcloud projects add-iam-policy-binding $P --role=roles/iap.tunnelResourceAccessor --member="serviceAccount:$GT"
gcloud projects add-iam-policy-binding $P --role=roles/compute.viewer --member="serviceAccount:$GT"
gcloud iam service-accounts add-iam-policy-binding nba-refresh-vm@$P.iam.gserviceaccount.com --role=roles/iam.serviceAccountUser --member="serviceAccount:$GT"
gcloud iam service-accounts describe $GT --format='value(uniqueId)'   # -> <id>
```

Puis le secret GitHub `GCP_VM_TRIGGER_SERVICE_ACCOUNT` = `$GT` (Settings >
Secrets and variables > Actions ; le provider WIF et les secrets Supabase
existent déjà). Enfin, **après le merge**, sur la VM :

```bash
echo sa_<id> | sudo tee /etc/nba-refresh/trigger_user
sudo -u nbarefresh git -C /opt/nba-pronos pull
sudo bash /opt/nba-pronos/Cadrage/Stats/vm/install.sh
```

Le nom `sa_<id>` doit être exact (sinon `sudo` demande un mot de passe et
échoue). Tester : bouton en mode `manuel`, puis « Watchdog » en lancement manuel.

## Au quotidien

- **Mise à jour du code** : automatique (`git pull` avant chaque run). Tout merge
  sur `main` part donc en production au run suivant (la PR et la CI font barrière).
  Changer une unité systemd demande de relancer `install.sh`.
- **Mises à jour système** : automatiques (`unattended-upgrades`), redémarrage à
  03:30 UTC, hors des créneaux d'import.
- **Contrôle mensuel** : `systemctl list-timers 'nba-refresh*'`, espace disque
  (`df -h /`), `journalctl --disk-usage`.
- **Déclencher à la main** : `gcloud compute ssh nba-refresh --zone=us-central1-a --tunnel-through-iap --command "sudo systemctl start nba-refresh@manuel.service"`
  (Cloud Shell, aussi depuis le téléphone).
- **Bouton GitHub** (après l'étape 7) : Actions > « Import des box scores —
  lancer sur la VM » > Run workflow, mode `manuel` (ou `presaison` pour un test).
  Le run attend la fin et affiche le journal ; rouge si l'import échoue.
- **Watchdog** (`watchdog-stats-import.yml`, toutes les 4 h) : ouvre une issue
  (labels `cron-failure`, `stats-import`) si le dernier `STATS_IMPORT` a échoué,
  s'il date de plus de 26 h, ou s'il n'y en a aucun ; la referme avec un
  commentaire dès que c'est revenu au vert. Un test `presaison` raté ouvre donc
  une issue, qui se ferme au prochain passage vert du timer.
- **Versions Python** : épinglées dans `requirements-refresh.txt` (pip freeze du
  07/10/2026). Les mettre à jour à la main ; le venv se réinstalle au run suivant.
- Le workflow `refresh-stats-supabase.yml` n'a plus de cron : c'est un plan B
  manuel, à ne pas lancer pendant un run de la VM.

- **Diagnostic en root** : `/opt/nba-pronos` appartient à `nbarefresh`. Un `git`
  lancé en root y répondra « dubious ownership » : utiliser
  `sudo -u nbarefresh git -C /opt/nba-pronos ...`.

## Poller des résultats NBA (`nba-results-poll`)

Le cron GitHub `sync-results` (Highlightly) tourne en réalité toutes les 3 à 6 h : un match
terminé restait `IN_PROGRESS` et ses paris non résolus. Le poller lit le scoreboard NBA
(**ScoreboardV3 de stats.nba.com via `nba_api`** ; cdn.nba.com refuse les IP GCP, 403 Akamai
mesuré le 08/10/2026) et le pousse vers `POST /api/sync/results-nba`, qui passe les matchs en
`IN_PROGRESS` / `FINISHED` et lance la résolution des paris dès qu'un match se termine.

- **Cadence** : toutes les 2 min de 17h à 9h (Paris), toutes les 15 min en journée
  (`nba-results-poll.timer`). Unité à part, lock à part (`poll.lock`) : un import long de
  `run.sh` ne bloque jamais les résultats.
- **Secours** : à chaque passage de 12h et 16h, `refresh_job.py` rejoue les scoreboards des
  deux jours NY précédents et du jour, **avant** l'import. Il ne change jamais le code de
  sortie ni `sync_logs`.
- **Journal** : `sudo journalctl -u nba-results-poll` (sans `sudo`, l'utilisateur SSH affiche « No entries ») (une ligne par date et par passage). Rien dans
  `sync_logs` côté Python ; la route y écrit les changements, les ignorés et les échecs
  (`endpoint = 'nba:NBA_STATS_SCOREBOARDV3'`, `sync_type = 'RESULTS'`).
- **dryRun par défaut** : `RESULTS_POLL_DRYRUN` dans `/etc/nba-refresh/env`. Seul `0` ou `false`
  passe en écriture réelle ; absente, `1` ou une faute de frappe restent en dryRun.

### Déploiement (depuis Cloud Shell)

```bash
gcloud compute ssh nba-refresh --zone=us-central1-a --tunnel-through-iap --command '
  sudo -u nbarefresh git -C /opt/nba-pronos pull &&
  sudo bash /opt/nba-pronos/Cadrage/Stats/vm/install.sh </dev/null &&
  grep RESULTS_POLL_DRYRUN /etc/nba-refresh/env &&
  sudo systemctl start nba-results-poll.service; sudo journalctl -u nba-results-poll -n 20 --no-pager'
```

`install.sh` est relançable sans risque (il réécrit les unités à l'identique, ajoute
`RESULTS_POLL_DRYRUN=1` seulement si la ligne manque, ne repose pas la question du déclencheur).
Il valide les `OnCalendar` des deux timers avec `systemd-analyze calendar` **avant** de copier
les unités : un calendrier invalide (ou un `sed` en échec) arrête le script sans rien modifier.
Le venv doit exister : il est créé par le premier `nba-refresh@…` (déjà fait).
Le poller ne fait pas de `git pull` : le code se met à jour aux passages de 12h/16h, ou à la main
avec la première commande ci-dessus.

Contrôle du démarrage Python (pandas ne doit jamais être chargé) :
`/var/lib/nba-refresh/venv/bin/python -X importtime -c "import poll_results" 2>&1 | grep -c pandas`
depuis `/opt/nba-pronos/Cadrage/Stats/service` doit afficher `0`.

### Observation en dryRun (2 soirs de matchs avant le passage en réel)

1. **Il tourne** : `systemctl list-timers 'nba-results-poll*'`, puis
   `sudo journalctl -u nba-results-poll --since "today 17:00" | grep -c "HTTP 200"` (environ 30 par heure).
2. **Aucun échec** : `sudo journalctl -u nba-results-poll --since -12h | grep -E "HTTP [45]|échoué"`
   doit être vide (un timeout isolé est toléré ; une série est le signal d'un blocage d'IP,
   voir « Si l'IP de la VM est bloquée »).
3. **Écarts cohérents** (requête dans le SQL editor Supabase) :
   ```sql
   select created_at, success, summary from sync_logs
   where sync_type = 'RESULTS' and endpoint = 'nba:NBA_STATS_SCOREBOARDV3'
     and created_at > now() - interval '14 hours' order by created_at;
   ```
   Un match ne doit apparaître dans « Écarts » que lorsqu'il change vraiment (début, score en
   direct, `FINISHED`). **Un match `FINISHED` ou `SCHEDULED` qui reste listé à chaque passage est
   un bug** (faux changement permanent) : ne pas passer en réel.
4. **Les valeurs** : comparer un ou deux matchs terminés à `/admin/sync-logs` (Highlightly) et aux
   scores officiels, en vérifiant le sens domicile/extérieur.
5. **Le secours** : après 12h, `journalctl -u 'nba-refresh@*' --since today | grep poll` montre ses lignes (avec `sudo journalctl`).

**Passage en réel** (sans PR ni redémarrage, le fichier est relu à chaque passage) :
`sudo sed -i 's/^RESULTS_POLL_DRYRUN=.*/RESULTS_POLL_DRYRUN=0/' /etc/nba-refresh/env`. Vérifier ensuite
le premier match passé `FINISHED` et ses paris résolus. Retour en arrière : remettre `=1`.

Pas de limite de débit connue côté stats.nba.com : ~1 000 requêtes par jour en plus de l'import.
Si des timeouts apparaissent en série, espacer la plage rapide du timer (3 à 5 min).

## Observation de la première semaine (à partir du 07/10/2026)

À faire une fois par jour pendant ~7 jours, jusqu'au premier vrai import de box
scores à la reprise de la saison.

1. **Les imports tournent** : dans `/admin/sync-logs`, deux lignes `STATS_IMPORT`
   par jour (12h et 16h Paris). Hors saison, des `success=false` sont du bruit
   attendu (calendrier vide, `leaguegamefinder` qui expire, timeout 15 s voulu).
   Dès qu'il y a des matchs réels : matchs importés, puis paris joueur passés de
   `VALIDATED` à `WON`/`LOST` via `/api/resolve-bets`.
2. **Le watchdog reste silencieux** : pas d'issue `cron-failure` + `stats-import`
   ouverte. Une issue se ferme seule au premier passage vert ; une issue ouverte
   depuis plus d'une journée est le vrai signal d'alerte.
3. **L'IP n'est pas bloquée par la NBA** (risque principal) : symptôme = timeouts
   en continu alors qu'il y a des matchs. Test rapide : bouton « Run workflow »,
   mode `manuel`. Remède : voir « Si l'IP de la VM est bloquée » ci-dessous.
4. **Facturation à ~48 h** (vers le 09/10) : console GCP > Facturation, projet
   `nba-pronos-stats-2026` ; vérifier le coût de l'IPv4 externe et que le budget
   de 1 € n'a pas déclenché d'alerte.
5. **Après la première semaine**, retour au contrôle mensuel (section « Au
   quotidien »).

Pas des anomalies : un match sans play-by-play (non enregistré, réessayé à 12h et
16h, paris en attente) et un match reporté (« match NBA correspondant
introuvable », à résoudre en admin).

## Si l'IP de la VM est bloquée

1. `gcloud compute instances stop nba-refresh --zone=us-central1-a`, puis `start` :
   une nouvelle IP éphémère est attribuée. Retester.
2. Sinon, plan B : `refresh-local.ps1` depuis le PC (voir son en-tête ; ne pas le
   lancer en même temps que la VM).
3. nba_api reste de toute façon un garde-fou manuel en cas de gros bug.
