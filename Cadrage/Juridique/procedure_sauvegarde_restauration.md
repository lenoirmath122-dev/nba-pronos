# Procédure de sauvegarde / restauration Supabase

> Rédigée le 09/09/2026 (feuille de route Phase 1, item `p1-18`). Comble le
> trou identifié dans `conseils_juridiques_deploiement_application.md` §2.7/§8.2 :
> « sauvegardes et restauration — non couvert par l'audit sécurité ni ce
> document, point non traité à date ». Le projet est sur le **plan gratuit
> Supabase** — pas de sauvegarde automatique dashboard (fonctionnalité
> réservée aux plans payants), donc pas de bouton "restaurer" à tester : la
> seule sauvegarde qui existe est celle qu'on prend manuellement.

## 1. Ce qui a été testé le 09/09/2026

Un cycle complet sauvegarde → restauration → vérification, contre la vraie
base de production (`lcldekiwinggyqgbmlwc`), exécuté par Claude Code sur
demande de l'exploitant :

1. **Extraction** (lecture seule sur la prod, aucune écriture) : schéma +
   données via `supabase db dump --linked` (deux passes, schéma puis
   `--data-only` — voir §2).
2. **Restauration** dans un Supabase **local jetable** (`supabase db reset`
   pour repartir des seules migrations, puis réinjection du dump de données).
3. **Vérification** : comptage ligne par ligne sur les 30 tables contenant
   des données (`users`, `bets`, `match_predictions`, `bracket_picks`,
   `stats_box_scores`, etc.) — **100% de correspondance exacte**, aucune
   perte ni duplication. Contrôle de contenu complémentaire (pas seulement
   les comptes) sur `bets.description` et `users.pseudo` : texte intact,
   pas de troncature ni de corruption d'encodage.
4. **Nettoyage** : les deux fichiers de dump (données personnelles réelles
   des joueurs — pseudos, emails, texte des paris) supprimés immédiatement
   après vérification, jamais commités, jamais transmis à un tiers. Le
   Supabase local a été réinitialisé (`db reset`) pour ne garder aucune
   trace de ces données en dehors de la prod elle-même.

**Résultat : la restauration fonctionne, la procédure est vérifiée.** Le
point de l'audit juridique est clos.

## 2. Procédure reproductible

À rejouer périodiquement (recommandé : avant tout changement de schéma
risqué, et au minimum une fois par trimestre tant que le plan gratuit reste
en place).

```bash
# 1. Sauvegarde (lecture seule sur la prod — jamais d'écriture)
npx supabase db dump --linked -f schema.sql
npx supabase db dump --linked --data-only -f data.sql

# 2. Cible de restauration : TOUJOURS un Supabase local ou un projet
#    jetable, JAMAIS un autre projet réel ni la prod elle-même.
npx supabase db reset          # repart des migrations (schéma propre)

# 3. Restauration des données (session_replication_role=replica pour
#    contourner l'ordre des contraintes de clé étrangère circulaires —
#    3 tables du schéma en ont : series, match_predictions/correction_requests,
#    bets/correction_requests, pg_dump le signale par un warning attendu)
cat data.sql | docker exec -i supabase_db_nba-pronos psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica;" -f -

# 4. Vérification : comparer les comptes de lignes table par table entre
#    le fichier data.sql (grep/compte des tuples VALUES) et la base
#    restaurée (SELECT count(*)). Idéalement aussi un contrôle de contenu
#    sur 1-2 tables sensibles (pas seulement les comptes).

# 5. Nettoyage — IMPÉRATIF (données personnelles réelles) :
rm schema.sql data.sql
npx supabase db reset          # purge les données restaurées du local
```

## 3. Limites connues, assumées

- **Manuel, pas automatisé** : rien ne déclenche cette procédure toute
  seule. Un vrai filet nécessiterait soit un cron externe qui prend un dump
  et le pousse vers un stockage externe (même logique que la sauvegarde GCS
  des modèles ML, `Cadrage/Stats/REPRODUCTIBILITE.md`), soit un changement
  de plan Supabase (Pro = sauvegardes quotidiennes automatiques + PITR).
  Décision explicitement reportée : le coût (plan payant, ou script cron à
  maintenir) n'est pas jugé justifié tant que l'app reste en alpha fermée
  entre amis — à revisiter en Phase 2/5 si le volume de données réelles
  augmente.
- **Pas de sauvegarde du Storage** (photos de profil, etc.) — `supabase db
  dump` ne couvre que Postgres. Non testé ici (peu de contenu dans ce bucket
  à ce jour).
- **RTO non mesuré** : ce test prouve que la restauration *fonctionne*, pas
  combien de temps elle prendrait en situation réelle avec un volume de
  données bien plus important qu'aujourd'hui (~140k lignes sur la plus
  grosse table, `stats_box_scores` — déjà exécuté en quelques secondes ici,
  mais pas un signal fiable à grande échelle).
