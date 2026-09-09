# Procédure minimale de gestion des incidents / notification de violation de données

> Rédigée le 09/09/2026 (feuille de route Phase 1, item `p1-19`). Comble le
> trou identifié dans `conseils_juridiques_deploiement_application.md`
> §2.7/§8.2 : le finding 15 de l'audit sécurité (procédure de
> rétention/effacement RGPD) est **déjà clos** via `scripts/delete-player-account.mjs`
> et le self-service de suppression de compte — mais ce point-là couvre une
> demande légitime d'un utilisateur, pas une fuite ou un accès non désiré.
> Cette procédure couvre spécifiquement ce second cas, resté non traité
> jusqu'ici.

## 1. Portée : qu'est-ce qu'un incident au sens de cette procédure

Au sens de l'article 4(12) du RGPD, une violation de données à caractère
personnel est *« la destruction, la perte, l'altération, la divulgation non
autorisée de données à caractère personnel transmises, conservées ou traitées
d'une autre manière, ou l'accès non autorisé à de telles données, de manière
accidentelle ou illicite »*.

Concrètement, pour nba-pronos, entrent dans ce périmètre par exemple :

- une clé (`SUPABASE_SERVICE_ROLE_KEY`, secret Anthropic, `SYNC_SECRET`,
  `STATS_SERVICE_SECRET`) exposée publiquement (dépôt rendu public par erreur,
  clé collée dans un outil tiers, log accessible) ;
- un accès non autorisé à la base Supabase (contournement RLS découvert,
  identifiants admin compromis) ;
- une compromission du compte GitHub, Vercel, Supabase ou Google Cloud de
  l'exploitant ;
- une exfiltration de données via une faille applicative (ex. IDOR découvert
  après coup).

**N'entre pas dans ce périmètre** une simple panne de service (ex. l'incident
du 09/09/2026 où des migrations non déployées ont bloqué les connexions —
aucune donnée personnelle n'a été détruite, altérée ni rendue accessible à
un tiers non autorisé : indisponibilité pure, pas une violation au sens de
l'article 4(12)). En cas de doute, appliquer quand même les étapes 2 à 4
ci-dessous — le coût de qualifier un non-incident est bien plus faible que
celui de rater une vraie violation.

## 2. Rôle

L'exploitant (Mathieu Lenoir, particulier en nom propre) est le seul
responsable de traitement à ce jour — pas de DPO désigné (non obligatoire vu
la taille du service, cf. `conseils_juridiques_deploiement_application.md`
§8.5). C'est lui qui déroule cette procédure et prend les décisions de
qualification/notification ci-dessous.

## 3. Étapes immédiates (à dérouler dans l'ordre)

1. **Confiner** — révoquer/faire tourner ce qui est compromis avant toute
   autre chose :
   - Clé Supabase : dashboard Supabase → Settings → API → régénérer la clé
     concernée ; mettre à jour Vercel + Secret Manager (Cloud Run) dans la
     foulée pour ne pas casser le service en prod.
   - Secret Anthropic : dashboard console.anthropic.com → régénérer la clé.
   - `SYNC_SECRET` / `STATS_SERVICE_SECRET` : générer une nouvelle valeur
     (même commande que `DEPLOIEMENT_CLOUD_RUN.md` §« Sécuriser l'accès »),
     mettre à jour Secret Manager + variables Vercel/GitHub Actions.
   - Compte compromis (admin ou joueur) : réinitialiser son mot de passe,
     invalider ses sessions actives (Supabase Auth → Users → l'utilisateur
     concerné).
   - Si le service Cloud Run lui-même semble compromis : le couper le temps
     d'investiguer (`gcloud run services update nba-pronos-stats --region
     europe-west1 --no-traffic`) plutôt que de le laisser tourner exposé.
2. **Évaluer l'étendue** — combien de personnes et quelles données sont
   concernées : croiser `audit_logs` (actions admin), `sync_logs`, et les
   logs Sentry/Cloud Run autour de la fenêtre de l'incident. Consigner une
   estimation même approximative (nombre de comptes, catégories de données
   du registre de traitements en §9 de `conseils_juridiques_deploiement_application.md`).
3. **Documenter au fil de l'eau** — chronologie (détection, actions,
   heures), dans le registre interne des violations (§5 ci-dessous), même
   avant d'avoir statué sur la notification.

## 4. Qualification et délais (obligations légales)

- **Risque pour les droits et libertés des personnes concernées** →
  notification à la CNIL **sous 72h** à compter de la connaissance de la
  violation (article 33 RGPD), via le téléservice officiel
  https://notifications.cnil.fr. Si l'analyse complète n'est pas terminée à
  72h, notifier quand même avec les informations disponibles et compléter
  ensuite (article 33(4)).
- **Risque élevé** → informer en plus **directement les personnes
  concernées**, sans délai injustifié, dans un langage clair (article 34
  RGPD) — ex. via l'e-mail associé au compte Supabase Auth (pas de
  prestataire d'e-mail transactionnel branché à ce jour, cf.
  `conseils_juridiques_deploiement_application.md` §2.6 — à défaut, message
  direct/Instagram le temps qu'un canal e-mail existe).
- **Pas de risque identifié** (ex. clé technique exposée mais logs confirmant
  qu'aucune donnée personnelle n'a été réellement consultée/exfiltrée) →
  décision documentée de ne pas notifier, avec la justification factuelle
  (article 33(1), 2e phrase). La violation reste néanmoins **obligatoirement
  consignée** dans le registre interne (article 33(5)) — la dispense de
  notification ne dispense jamais de documentation.

## 5. Registre interne des violations

Table à tenir à jour dans ce document à partir de maintenant (même vide, son
existence est elle-même une obligation — article 33(5)) :

| Date détectée | Nature | Données/personnes concernées | Mesures prises | CNIL notifiée (date) | Personnes informées (date) | Notes |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | Aucune violation à ce jour (09/09/2026) |

**Entrée rétroactive à titre d'exemple d'application** — l'incident du
21/08/2026 (clé `SUPABASE_SERVICE_ROLE_KEY` apparue en clair via une
sélection IDE collée par mégarde, cf. `DEPLOIEMENT_CLOUD_RUN.md`) : la clé
n'a été visible que dans le terminal/l'environnement de l'exploitant
lui-même, jamais publiée ni transmise à un tiers — pas de divulgation non
autorisée au sens de l'article 4(12), donc pas une violation à consigner
formellement. Cité ici pour illustrer la distinction entre « incident de
sécurité évité » et « violation de données réelle », pas comme une entrée du
registre.

## 6. Contacts utiles en cas d'incident réel

- **CNIL** — notification de violation : https://notifications.cnil.fr
- **Supabase** — support dashboard (incident côté base/auth).
- **Vercel** — support dashboard (incident côté hébergement).
- **Google Cloud** — support console (incident côté Cloud Run/Secret Manager).
- **Anthropic** — support console.anthropic.com (incident côté API Claude).
- Pas d'assurance cyber ni d'avocat dédié à ce jour — à considérer si le
  service passe à un modèle payant ou s'ouvre publiquement (renvoi à
  `conseils_juridiques_deploiement_application.md` §8.5).

## 7. Après l'incident

Rédiger un post-mortem court (cause, chronologie, correctif appliqué,
mesure de prévention) dans le registre en §5, même quand aucune notification
n'était requise — cohérent avec la pratique déjà en place pour les incidents
techniques du projet (voir `Cadrage/Suivi/JOURNAL_SESSIONS.md`).
