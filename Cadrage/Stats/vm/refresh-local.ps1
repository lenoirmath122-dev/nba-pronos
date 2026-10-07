# Plan B : lancer l'import + la résolution des paris depuis le PC (IP résidentielle,
# non bloquée par stats.nba.com) quand la VM est indisponible ou bloquée.
#
# Prérequis : Python avec Cadrage/Stats/service/requirements-refresh.txt installé, et un
# fichier %USERPROFILE%\.nba-refresh.env HORS dépôt, une ligne CLE=valeur chacune :
#   SUPABASE_URL=...
#   SUPABASE_SERVICE_ROLE_KEY=...
#   SYNC_SECRET=...
# NE PAS lancer en même temps que la VM : pas de verrou partagé entre les deux
# (delete+insert limite les dégâts d'un chevauchement, sans les exclure).
#
# Usage :  powershell -File Cadrage\Stats\vm\refresh-local.ps1 [-PreSeason]
param([switch]$PreSeason)

$envFile = Join-Path $env:USERPROFILE ".nba-refresh.env"
if (-not (Test-Path $envFile)) { throw "Fichier manquant : $envFile" }
foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2].Trim()
    }
}
foreach ($name in "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SYNC_SECRET") {
    if (-not (Get-Item "Env:$name" -ErrorAction SilentlyContinue)) { throw "$name absente de $envFile" }
}

$types = @("Regular Season", "Playoffs", "PlayIn")
if ($PreSeason) { $types = @("Pre Season") + $types }

Push-Location (Join-Path $PSScriptRoot "..\service")
try {
    python refresh_job.py --season-types @types --trigger local
    exit $LASTEXITCODE
}
finally { Pop-Location }
