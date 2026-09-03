# Cadrage juridique pour le déploiement d’une application

> **Avertissement** : ce document constitue une aide générale au cadrage. Il ne remplace pas l’avis personnalisé d’un avocat ou d’un délégué à la protection des données, notamment pour une application commerciale, ouverte au public, destinée à des mineurs ou traitant des données sensibles.

## 1. Objectif

Avant de déployer une application, il est nécessaire d’identifier les obligations juridiques liées à son public, aux données traitées, à son modèle économique, à ses prestataires et aux contenus diffusés.

L’analyse doit être adaptée au contexte réel de l’application : outil interne, application privée entre amis, service associatif, application commerciale ou service ouvert au grand public.

## 2. Principaux sujets à vérifier

### 2.1. RGPD et données personnelles

Le RGPD doit être pris en compte dès que l’application traite des informations permettant d’identifier directement ou indirectement une personne.

Cela peut notamment inclure :

- le nom et le prénom ;
- le pseudonyme ;
- l’adresse e-mail ;
- la photographie ou l’avatar ;
- l’adresse IP et les journaux techniques ;
- les commentaires et contenus publiés ;
- les statistiques d’utilisation ;
- les données professionnelles ;
- les identifiants de connexion.

Les principaux travaux à mener sont les suivants :

- définir précisément les données collectées ;
- associer chaque donnée à une finalité déterminée ;
- identifier une base légale pour chaque traitement ;
- limiter la collecte aux données réellement nécessaires ;
- fixer des durées de conservation ;
- informer clairement les utilisateurs ;
- permettre l’exercice de leurs droits ;
- tenir un registre des traitements lorsque cela est requis ;
- encadrer les prestataires qui traitent les données pour le compte de l’éditeur ;
- vérifier les éventuels transferts de données hors de l’Espace économique européen.

#### Cadrage détaillé — nba-pronos (02/09/2026)

1. **Données collectées** : voir la cartographie détaillée en §9 (registre des traitements). En résumé : `pseudo` (public), e-mail (Supabase Auth, hors `public.users`), messages de chat, formulation libre des paris, signalements de bug, abonnements push, bio/équipe favorite/préférences d'affichage (profil). Pas de nom/prénom, pas de date de naissance, pas d'IP journalisée dans l'app (§9 détaille le journal `audit_logs`, qui ne contient aucune IP).
2. **Finalité et base légale par donnée** : voir §9 — chaque ligne du registre associe une finalité et une base légale proposée (essentiellement exécution du contrat pour le fonctionnement du service, intérêt légitime pour la modération/sécurité, consentement pour les notifications push). Qualification précise à faire valider par un professionnel avant une ouverture au-delà du cercle d'amis actuel (déjà noté en §8.5).
3. **Limitation de la collecte** : conforme à date — aucune donnée superflue identifiée (pas de date de naissance, pas d'adresse, `avatar_url` existe mais n'est alimentée par aucun flux).
4. **Durées de conservation** — décision retenue : conservation tant que le compte reste actif, pas de purge automatique différée (cohérent avec une bêta fermée entre amis). Aucune colonne `expires_at` ni job de purge n'existe aujourd'hui dans le schéma — c'est un choix assumé, pas un oubli. Suppression uniquement sur demande (voir point 6). À revoir si le service s'ouvre largement (volume de données croissant, comptes inactifs qui s'accumulent).
5. **Information des utilisateurs** : pas encore fait — dépend de la politique de confidentialité à rédiger (§8.3, toujours pas écrite).
6. **Exercice des droits** — état actuel : suppression de compte possible uniquement via un script CLI manuel (`scripts/delete-player-account.mjs`, dry-run par défaut, `--confirm` requis), déclenché par l'exploitant sur demande, pas de self-service dans l'app ; pas de fonctionnalité d'export de données. Décision retenue : **construire un vrai self-service (suppression + export)**, mais cadré maintenant et codé lors d'une prochaine session plutôt que ce soir — spécification détaillée en §8.2.
7. **Registre des traitements** — décision retenue : oui, un registre simple est nécessaire même pour un exploitant particulier, car le traitement est permanent (service en continu), pas occasionnel — voir §9.
8. **Encadrement des prestataires** : voir §2.6 et §9.
9. **Transferts hors Espace économique européen** : identifiés à date — **Anthropic** (API Claude, société américaine, reçoit le texte libre des paris pour structuration IA) et potentiellement **Vercel** (société américaine, bien que le calcul soit déployé en région `dub1`/Dublin) selon la localisation réelle de leurs sous-traitants internes. Décision retenue : le flux vers Anthropic est conservé (pas de changement d'architecture), mais doit être documenté dans la politique de confidentialité et son DPA/ses garanties de transfert (clauses contractuelles types) vérifiés — point ajouté en §8.5. Localisation exacte du projet Supabase non trouvée dans le dépôt (le sous-domaine `*.supabase.co` est un identifiant de projet, pas une région) — à vérifier directement dans le dashboard Supabase.

### 2.2. Cookies et traceurs

Il faut recenser les cookies et traceurs utilisés par l’application, notamment ceux liés :

- à l’authentification ;
- au fonctionnement technique ;
- à la mesure d’audience ;
- à la publicité ;
- aux pixels marketing ;
- aux lecteurs vidéo ou services tiers intégrés.

Les traceurs strictement nécessaires peuvent relever d’un régime différent des traceurs publicitaires ou de certains outils d’analyse. Lorsque le consentement est requis, l’utilisateur doit pouvoir accepter ou refuser de manière suffisamment simple et conserver la possibilité de modifier son choix.

#### Cadrage détaillé — nba-pronos (02/09/2026)

Recensement technique (grep sur le dépôt, 02/09/2026) :

| Traceur | Nature | Finalité | Régime |
|---|---|---|---|
| Cookie de session Supabase Auth | Cookie `httpOnly`, géré par `@supabase/ssr` | Authentification | Strictement nécessaire — exempté de consentement (cookie d'authentification) |
| Widget Cloudflare Turnstile | Iframe cross-origin au signup (`TurnstileWidget.tsx`) | Anti-bot / sécurité | Strictement nécessaire — exempté de consentement (cookie de sécurité anti-fraude) |
| État replié/déplié d'une carte (accueil) | `window.localStorage`, par appareil (`components/home/CollapsibleCard.tsx`) | Préférence d'affichage explicitement demandée par l'utilisateur, jamais transmise au serveur | Strictement nécessaire — exempté (personnalisation d'interface demandée par l'utilisateur) |
| — | Mesure d'audience, publicité, pixels marketing, lecteur vidéo tiers | — | **Aucun** trouvé dans le dépôt (confirmé en §3 point 6) |

**Conclusion** : les seuls traceurs identifiés relèvent tous des catégories exemptées de consentement selon les critères usuels de la CNIL (authentification, sécurité, préférence d'interface demandée par l'utilisateur). **Aucun bandeau de consentement cookies n'est nécessaire aujourd'hui.** Une simple mention informative (liste ci-dessus) dans la politique de confidentialité suffit — pas de mécanisme d'accept/refuse à construire tant qu'aucun traceur non-exempté (analytics, publicité) n'est ajouté. Si un outil de mesure d'audience ou de publicité est introduit plus tard, ce point est à recadrer entièrement (bandeau de consentement requis).

Point de vigilance mineur, pas bloquant : Turnstile est un widget tiers cross-origin (Cloudflare) — sa qualification en cookie strictement nécessaire repose sur la finalité anti-fraude déclarée par Cloudflare, à confirmer si une validation professionnelle est faite (§8.5).

### 2.3. Mentions légales

L’application ou son site de présentation doit permettre d’identifier clairement son responsable.

Selon la situation, les mentions légales peuvent notamment préciser :

- l’identité de l’éditeur ;
- ses coordonnées ;
- son statut juridique ;
- les informations d’immatriculation applicables ;
- le directeur de la publication ;
- l’identité et les coordonnées de l’hébergeur.

Le contenu exact dépend du statut de l’exploitant : particulier, association, entrepreneur individuel, société ou employeur.

### 2.4. Politique de confidentialité

Une politique de confidentialité doit décrire de façon compréhensible :

- l’identité du responsable du traitement ;
- les catégories de données collectées ;
- les finalités poursuivies ;
- les bases légales utilisées ;
- les destinataires des données ;
- les sous-traitants et services externes concernés ;
- les durées de conservation ;
- les éventuels transferts internationaux ;
- les droits des personnes ;
- la manière d’exercer ces droits ;
- le droit d’introduire une réclamation auprès de la CNIL ;
- les coordonnées du DPO, lorsqu’un DPO est désigné.

La politique publiée doit correspondre au fonctionnement réel de l’application et à sa configuration technique.

### 2.5. Conditions générales d’utilisation

Les conditions générales d’utilisation, ou CGU, permettent de fixer les règles du service.

Elles peuvent notamment couvrir :

- les conditions d’accès et de création d’un compte ;
- les règles d’utilisation ;
- les comportements interdits ;
- la responsabilité des utilisateurs ;
- les règles applicables aux contenus publiés ;
- la modération ;
- la suspension ou la suppression d’un compte ;
- la disponibilité et l’évolution du service ;
- les limites de responsabilité juridiquement admissibles ;
- le droit applicable et le traitement des différends.

Les CGU doivent être adaptées à l’usage réel de l’application. Elles ne doivent pas uniquement être copiées depuis un autre service.

### 2.6. Prestataires et sous-traitants

Tous les services externes doivent être recensés, par exemple :

- hébergement et déploiement ;
- base de données ;
- authentification ;
- envoi d’e-mails ;
- stockage de fichiers ;
- mesure d’audience ;
- paiement ;
- API métier ou sportive ;
- outils de support et de supervision.

Pour chaque prestataire, il faut vérifier :

- son rôle juridique ;
- les données auxquelles il accède ;
- ses conditions contractuelles ;
- son accord de traitement des données, ou DPA ;
- la localisation des données ;
- ses mesures de sécurité ;
- les mécanismes encadrant les transferts internationaux ;
- les conditions de restitution ou de suppression des données.

#### Cadrage détaillé — nba-pronos (02/09/2026)

| Prestataire | Rôle | Données auxquelles il accède | Localisation | Sous-traitant RGPD ? | À vérifier |
|---|---|---|---|---|---|
| Supabase | Authentification, base de données, temps réel, stockage | Toutes les données applicatives (auth, `public.*`) | Non trouvée dans le dépôt (project ref ≠ région) | Oui | Région du projet (dashboard Supabase), DPA/localisation |
| Vercel | Hébergement, exécution des fonctions serveur | Toutes les requêtes transitent par Vercel (accès technique, pas de stockage applicatif propre) | Fonctions déployées en `dub1` (Dublin, UE) — `vercel.json` | Oui | Localisation des sous-traitants internes de Vercel (société US) |
| Cloudflare (Turnstile) | Captcha au signup | Signal anti-bot du navigateur (pas de données de profil applicatives) | Réseau mondial Cloudflare | Oui (accès limité) | Qualification exacte des données de captcha |
| Anthropic (Claude) | Structuration IA du texte libre des paris | Texte libre saisi par l'utilisateur pour un pari (`lib/ai/structureBet.ts`) | Société américaine | Oui | DPA / clauses contractuelles types pour le transfert hors UE (voir §2.1 point 9) |
| Highlightly API + `nba_api` | Source de données NBA (matchs, équipes, stats officielles) | Aucune — appels sortants en lecture seule, pas d'envoi de données utilisateur | Non déterminé | Non — pas de donnée personnelle transmise | Confirmer qu'aucun identifiant utilisateur n'est jamais inclus dans les appels |
| Web Push (VAPID) | Notifications push natives | Endpoint + clés cryptographiques du navigateur (`push_subscriptions`) | Relayé par le service push du navigateur (Google/Mozilla/Apple selon le navigateur de l'utilisateur) | Indirectement oui (relais technique, pas de contrat direct) | Pas d'action requise à ce stade — flux standard du protocole Web Push |
| — | Envoi d'e-mail transactionnel | — | — | — | **Aucun prestataire branché à ce jour** (§3 point 6) — à choisir avant d'avoir besoin d'e-mails RGPD (confirmation, notification de suppression) |
| — | Paiement | — | — | — | **Aucun prestataire** — non applicable, service gratuit (§3 point 5) |
| — | Mesure d'audience / analytics | — | — | — | **Aucun outil** — non applicable |

Le point le plus notable : **Anthropic est le seul sous-traitant qui reçoit du contenu généré par l'utilisateur en dehors de l'infrastructure Supabase/Vercel**, et c'est un transfert hors UE — décision retenue en §2.1 point 9 (flux conservé, à documenter et vérifier).

### 2.7. Sécurité et incidents

Le déploiement doit intégrer des mesures de sécurité proportionnées aux risques.

Exemples de mesures à prévoir :

- contrôle des droits d’accès ;
- séparation entre comptes utilisateurs et administrateurs ;
- protection des secrets et clés d’API ;
- chiffrement des communications ;
- sauvegardes et restauration ;
- journalisation des actions sensibles ;
- mise à jour des dépendances ;
- limitation des données visibles publiquement ;
- procédure de gestion des incidents ;
- procédure de notification d’une violation de données lorsque celle-ci est requise.

#### Cadrage détaillé — nba-pronos (02/09/2026)

Contrairement aux autres sections de ce document, la sécurité technique de l'application a déjà fait l'objet d'un **audit dédié et bien plus approfondi** qu'un cadrage général ne pourrait l'être ici : `security-audit-report.md` (audit du 29/08/2026, 15 findings — 1 critique, 1 élevé, 6 moyens, 6 faibles, 1 info), avec son suivi détaillé dans `Cadrage/Suivi/GAPS_OUVERTS.md` et `Cadrage/Suivi/ETAT_ACTUEL.md` §2.128. Plutôt que de dupliquer ce travail, ce paragraphe se contente d'y renvoyer et de faire le lien avec les points propres à ce document juridique.

| Point du §2.7 | Statut (au 02/09/2026) |
|---|---|
| Contrôle des droits d'accès | Couvert par Row Level Security Postgres + fonctions `SECURITY DEFINER` (audit : « un contournement de la couche applicative n'ouvre, dans la quasi-totalité des cas, aucun accès non désiré ») |
| Séparation comptes utilisateurs/admin | Finding 4/12 (garde `is_admin()` explicite) — traité, commit `36c86f7` |
| Protection des secrets et clés d'API | Finding 1 (critique, clé `service_role` fuitée) — traité : rotation + désactivation des clés legacy. Finding 2 (élevé, service Cloud Run public) — traité |
| Chiffrement des communications | Non re-vérifié spécifiquement ici — couvert par défaut par Vercel/Supabase (HTTPS) |
| Sauvegardes et restauration | Non couvert par l'audit sécurité ni ce document — **point non traité à date**, propre à la configuration Supabase (sauvegardes automatiques du plan utilisé, à vérifier) |
| Journalisation des actions sensibles | `audit_logs` en place pour les actions admin (voir §9) |
| Mise à jour des dépendances | Finding 9 — traité (`npm audit` 3 → 0) |
| Limitation des données visibles publiquement | Finding 7 (headers de sécurité HTTP) — traité |
| Procédure de gestion des incidents | Pas de procédure formalisée au-delà de la réaction ponctuelle à l'incident de fuite de clé (finding 1) — **point non traité à date** |
| Procédure de notification de violation de données | **Finding 15, directement lié à ce document** (« aucune procédure documentée de rétention/effacement RGPD ») — CLOS le 02/09/2026 via `scripts/delete-player-account.mjs` (voir §2.1 point 6, §8.2) ; ne couvre que l'effacement sur demande, pas une procédure de notification en cas de violation de données (fuite, accès non autorisé) — **distinction à noter, ce volet-là reste non traité** |

**Deux résidus pertinents pour le cadrage juridique**, au-delà du renvoi à l'audit :
- **Protection contre les mots de passe compromis ("Leaked Password Protection")** : reporté, fonctionnalité réservée aux plans Supabase payants (le projet est sur le plan gratuit) — décision assumée par l'utilisateur pour l'alpha/bêta entre amis, à reprendre si le plan change.
- **Énumération de compte au signup (finding 14)** : gardée telle quelle délibérément (message explicite conservé pour l'UX) — décision prise avec l'utilisateur, documentée dans le code (`lib/auth/actions.ts`), acceptable tant que le cercle reste fermé.

**Conclusion** : pas de nouveau travail de cadrage nécessaire ici — la sécurité applicative est déjà largement couverte par le chantier d'audit dédié. Les deux vrais trous identifiés ce soir (sauvegardes/restauration, procédure de gestion des incidents/notification de violation) sont ajoutés en §8.2/§8.5 ci-dessous.

### 2.8. Propriété intellectuelle

Il faut vérifier les droits applicables à tous les éléments utilisés ou diffusés :

- code source ;
- bibliothèques et composants open source ;
- photographies et illustrations ;
- logos, marques et identités visuelles ;
- polices de caractères ;
- textes et contenus éditoriaux ;
- données provenant d’une API ;
- contenus publiés par les utilisateurs.

L’accès technique à une image, une donnée ou un contenu ne signifie pas nécessairement que sa réutilisation est autorisée. Les licences et conditions d’utilisation doivent être vérifiées.

#### Cadrage détaillé — nba-pronos (02/09/2026)

1. **Code source** : propriété de l'exploitant (particulier). Dépôt privé, pas de contributeur tiers avec droits distincts. La mention "Co-Authored-By: Claude" dans certains commits (assistance IA) n'a pas d'incidence identifiée sur la propriété du code.
2. **Bibliothèques et composants open source** : dépendances principales (`next`, `react`, `@supabase/*`, `@anthropic-ai/sdk`, `tailwindcss`...) sous licences permissives usuelles (MIT/Apache-2.0). Côté Python (`Cadrage/Stats/scripts/requirements.txt`), une seule dépendance sous licence copyleft faible : **`fpdf2` (LGPL)** — à vérifier si son usage (génération de PDF) reste dans le cadre permis par la LGPL (utilisation en bibliothèque, pas de modification distribuée) ; risque faible mais pas nul.
3. **Photographies et illustrations** : les images `hero-*.jpg` proviennent de photos Unsplash fournies par l'utilisateur (licence Unsplash, recompressées avant dépôt — `public/brand/README.md`). Aucune photo de joueur NBA trouvée dans le dépôt.
4. **Logos, marques et identités visuelles** — point le plus sensible de cette section :
   - **30 logos d'équipes NBA** (`public/logos/teams/*.svg`, hébergés en interne) : **récupérés depuis une source publique en ligne (type Wikipedia), sans licence explicite obtenue de la NBA ou des équipes** (confirmé par l'utilisateur). Ce sont des marques déposées appartenant à la NBA/aux franchises — leur réutilisation dans une application tierce non affiliée, même gratuite, est un vrai point de vigilance marque (pas seulement droit d'auteur). Le `README.md` du dossier affirme des assets "licenciés ou possédés" — cette affirmation n'est pas corroborée par l'origine réelle des fichiers et mérite d'être corrigée ou nuancée. Il existe en plus 30 fichiers PNG dans le même dossier, non référencés par le code (probablement des doublons obsolètes) — à nettoyer.
     **Décision retenue avec l'utilisateur (03/09/2026)** : le risque est accepté tel quel pour l'instant — cohérent avec le profil actuel du service (bêta gratuite, cercle fermé, pas de caractère commercial). Ce n'est pas un oubli : la décision est explicite et **à revoir obligatoirement avant toute ouverture publique ou commerciale** (2027), avec deux options déjà identifiées à ce moment-là : obtenir une licence, ou remplacer les logos par des visuels non protégés (couleurs d'équipe, initiales, etc.).
   - **Logo de l'app** (`public/brand/logo.svg`) : création originale de l'utilisateur (confirmé) — pas de risque tiers identifié.
5. **Polices de caractères** : Sora et Oswald, chargées via `next/font/google` et auto-hébergées au build (pas de hotlink runtime) — polices Google Fonts, licence ouverte standard (Open Font License), pas de risque identifié.
6. **Textes et contenus éditoriaux** : aucun contenu copié depuis une source externe identifié.
7. **Données provenant d'une API** :
   - **Highlightly** (conditions consultées le 02/09/2026, `highlightly.net/terms/`) : revente/sous-licence/redistribution de l'accès direct à l'API interdite (§6.1, non applicable ici — l'app consomme l'API pour son propre usage, ne l'expose pas à des tiers) ; Highlightly revendique un droit sur la compilation/base de données elle-même, l'extraction systématique pour un service concurrent est interdite (§6.2, non applicable — usage produit, pas service de données concurrent) ; pour les logos/images, Highlightly ne revendique pas la propriété mais rejette la responsabilité de vérifier la conformité sur l'utilisateur (§6.3) — cohérent avec le fait que l'app **n'utilise pas** le champ `logo` renvoyé par Highlightly (elle héberge ses propres SVG, point 4). Pas d'attribution obligatoire.
   - **`nba_api`** (wrapper Python, licence MIT) : le code du wrapper est libre, mais délègue aux [conditions d'utilisation de NBA.com](https://www.nba.com/termsofuse) pour les données elles-mêmes — celles-ci encadrent (voire restreignent) l'usage automatisé/commercial des données stats.nba.com. Usage actuel = entraînement de modèles statistiques internes (pas de republication brute des données NBA.com) : risque jugé faible en pratique pour un usage privé/gratuit, mais c'est un point de vigilance largement partagé dans l'écosystème `nba_api` (bibliothèque très utilisée par la communauté malgré cette zone grise) — à revoir sérieusement si le service devient commercial ou public à grande échelle (2027).
8. **Contenus publiés par les utilisateurs** : aucune clause de propriété/licence n'existe aujourd'hui (pas de CGU publiées). À couvrir dans les futures CGU (§8.3) : l'utilisateur reste propriétaire de son contenu (messages, formulations de paris), et accorde à l'exploitant une licence d'affichage au sein du service.

### 2.9. Modèle économique et droit de la consommation

Des obligations complémentaires peuvent s’appliquer si l’application propose :

- un abonnement ;
- un achat intégré ;
- un service payant ;
- de la publicité ;
- une place de marché ;
- une période d’essai ;
- un renouvellement automatique.

Il peut alors être nécessaire de prévoir des conditions générales de vente, une information précontractuelle complète, des règles relatives au paiement, à la résiliation, au renouvellement et, selon le service concerné, au droit de rétractation.

#### Cadrage détaillé — nba-pronos (02/09/2026)

Aucun des déclencheurs listés n'est présent aujourd'hui : pas d'abonnement, pas d'achat intégré, pas de service payant, pas de publicité, pas de place de marché, pas de période d'essai, pas de renouvellement automatique (confirmé technique en §3 point 5 — recherche de Stripe ou équivalent : aucune trace). **Aucune des obligations de ce paragraphe ne s'applique tant que le service reste gratuit** — pas de CGV nécessaire (déjà noté en §8.3).

Point ouvert, déjà tracé en §8.5 : modèle économique 2027 non tranché. Si un modèle payant est introduit, ce paragraphe est intégralement à retraiter (CGV, information précontractuelle, droit de rétractation le cas échéant) — pas la peine d'anticiper le détail avant que le modèle soit choisi.

### 2.10. Utilisateurs mineurs

Si des mineurs peuvent accéder à l’application, il faut prévoir une analyse spécifique portant notamment sur :

- l’âge des utilisateurs ;
- la rédaction d’informations adaptées ;
- la base légale du traitement ;
- les mécanismes de consentement éventuellement nécessaires ;
- la visibilité des profils ;
- les échanges entre utilisateurs ;
- la modération et le signalement ;
- la limitation de la collecte ;
- la publicité et les mécanismes incitatifs.

#### Cadrage détaillé — nba-pronos (02/09/2026)

Repère légal général servant de fil conducteur : en droit français, un mineur de 15 ans ou plus peut consentir seul à un traitement de données reposant sur le consentement dans le cadre d'un service de la société de l'information ; en dessous de 15 ans, le consentement du titulaire de l'autorité parentale est requis en plus de celui du mineur (règle relayée par la CNIL, source citée en section 6). Ce repère ne couvre pas tous les traitements de l'application (une partie repose probablement sur l'exécution du contrat plutôt que sur le consentement) — la qualification précise par donnée/traitement reste un point de validation professionnelle (voir §8.5).

1. **Âge des utilisateurs** : en pratique, à ce jour, uniquement des adultes (cercle d'amis existant pour l'alpha/bêta). Décision retenue : traiter le risque comme réel plutôt que théorique, car **aucune barrière technique n'empêche l'inscription d'un mineur** — l'app doit donc être cadrée pour ce cas dès maintenant plutôt que d'attendre qu'il se présente.
2. **Rédaction d'informations adaptées** : la politique de confidentialité à rédiger (§8.3, pas encore écrite) devra mentionner explicitement le traitement applicable aux mineurs, dans un langage compréhensible par un adolescent.
3. **Base légale du traitement** : à qualifier précisément par catégorie de donnée lors de la rédaction de la politique de confidentialité (probablement exécution du contrat pour le compte/le jeu, consentement pour les notifications push) — point de validation professionnelle, non tranché ici.
4. **Mécanismes de consentement** : décision retenue — **ajouter une déclaration d'âge simple au signup** (déclarative, sans justificatif, ex. case à cocher ou tranche d'âge plutôt qu'une date de naissance complète pour rester minimal cf. point 8). Objectif : pouvoir distinguer les moins de 15 ans si besoin d'un mécanisme de consentement parental plus tard. **Non implémenté à ce jour** (`SignupForm.tsx` ne contient aucun champ d'âge) — cadrage seulement, implémentation à prévoir dans une prochaine itération.
5. **Visibilité des profils** : le `pseudo` est public au sein du service (visible par les autres membres). Pas de photo de profil active (`avatar_url` non alimenté, cf. inventaire §3 point 4).
6. **Échanges entre utilisateurs** : le chat (`chat_messages`) est visible par les membres du canal général ou de la ligue. Décision retenue : pour la bêta fermée sur invitation, le cercle est un groupe d'amis qui se connaît déjà — pas de mesure technique supplémentaire de mise en relation à traiter maintenant. Ce point sera à revoir entièrement à l'ouverture 2027 (des inconnus pourront alors se côtoyer).
7. **Modération et signalement** : décision retenue — **ajouter un signalement de message de chat** par les utilisateurs vers les admins, en complément de `bug_reports` qui ne couvre aujourd'hui que les rapports de bug technique, pas les messages problématiques. **Non implémenté à ce jour** — cadrage seulement.
8. **Limitation de la collecte** : la déclaration d'âge (point 4) devra rester minimale — trancher au moment de l'implémentation entre une simple case ("j'ai 15 ans ou plus") et une tranche d'âge, plutôt qu'une date de naissance complète non nécessaire à l'usage.
9. **Publicité et mécanismes incitatifs** : aucune publicité ni mécanisme incitatif à ce jour (service gratuit, §3 point 5) — non applicable tant que le modèle économique ne change pas. À revoir si le modèle 2027 introduit de la publicité ou des mécaniques incitatives.

**Résumé des décisions à implémenter (hors périmètre de ce cadrage, prochaine itération)** : champ/case de déclaration d'âge au signup ; mécanisme de signalement d'un message de chat vers les admins.

### 2.11. Jeux, concours et pronostics

Une application de pronostics requiert une vigilance particulière lorsqu’elle comporte :

- une mise financière ;
- un droit d’entrée ;
- un gain ayant une valeur financière ;
- une récompense fournie par un sponsor ;
- une mécanique reposant en partie sur le hasard ;
- une communication pouvant laisser penser à une activité de pari.

Un jeu gratuit entre amis sans mise financière présente un profil différent d’une activité commerciale avec paiement ou gains. Le règlement, la présentation du service et la nature des récompenses doivent être analysés avant le lancement.

#### Cadrage détaillé — nba-pronos (02/09/2026)

- **Mise financière / droit d'entrée / gain à valeur financière / récompense sponsor** : aucun des quatre, confirmé technique (§3 point 10 — table `bets` sans colonne montant/devise, aucune trace de paiement dans le code).
- **Mécanique reposant sur le hasard** : le jeu porte sur la prédiction de résultats sportifs réels (compétence/connaissance du sport), pas sur un tirage aléatoire — profil différent d'un jeu de hasard au sens strict.
- **Communication pouvant évoquer une activité de pari réglementée** : vérifié dans le code de l'interface (recherche de vocabulaire type "cote", "cagnotte", "jackpot", "argent réel", "€" dans `app/`) — **aucune occurrence trouvée**. Le vocabulaire reste celui d'un jeu à points fictifs.

**Conclusion : profil de jeu gratuit entre amis, pas d'activité de pari réglementée à ce jour.** Cohérent avec §3 point 10 et §2.9. Point ouvert déjà tracé en §8.5 : si le modèle 2027 introduit des mises ou des gains à valeur réelle, ce paragraphe entier est à retraiter — c'est le point que le document source lui-même identifie comme le plus structurant juridiquement pour ce type d'application.

## 3. Informations nécessaires pour réaliser l’analyse

Pour établir une analyse juridique adaptée, il faut documenter les points suivants :

1. **Application concernée** : objet, fonctionnalités principales et niveau d’avancement.
2. **Exploitant du service** : particulier, association, entreprise, employeur ou autre structure.
3. **Public visé** : cercle privé, salariés, clients, membres d’une association ou grand public.
4. **Données collectées** : compte, profil, e-mail, avatar, commentaires, statistiques, données professionnelles, logs, etc.
5. **Modèle économique** : gratuit, publicité, abonnement, paiement, sponsoring ou récompenses.
6. **Prestataires utilisés** : hébergeur, base de données, authentification, analytics, paiement, e-mails et API.
7. **Pays ciblés** : France uniquement, Union européenne ou diffusion internationale.
8. **Présence éventuelle de mineurs**.
9. **Contenus publiés par les utilisateurs** et règles de modération.
10. **Existence de mises, lots ou récompenses**, notamment pour une application de pronostics.

### Réponses au cadrage (02/09/2026)

Éléments recueillis auprès de l'exploitant et par inventaire technique du dépôt, pour servir de base à la matrice d'obligations (section 7). À revalider avant la bêta ouverte et avant toute ouverture 2027 (plusieurs points sont explicitement non tranchés à ce stade).

1. **Application concernée** : nba-pronos, application de pronostics NBA gratuite entre amis à points fictifs (pas de mise financière). Alpha "Potes" prévue 20-23/09/2026 (cercle fermé) ; bêta ensuite.
2. **Exploitant** : pour le moment un particulier, en nom propre (l'utilisateur). Statut à revoir plus tard (auto-entrepreneur, société — non tranché).
3. **Public visé** : cercle fermé sur invitation, France, pour la bêta. Ouverture envisagée en 2027 — périmètre (grand public ? international ?) non tranché à ce stade.
4. **Données collectées** (inventaire technique du 02/09/2026) : `pseudo` (unique, public) et `avatar_url` (colonne existante, aucun mécanisme d'upload/édition actif) dans `public.users` ; e-mail géré séparément par Supabase Auth (`auth.users`, jamais dans `public.users`) ; messages de chat (texte libre, `chat_messages`) ; signalements de bug (texte libre + chemin d'écran, `bug_reports`) ; abonnements push (endpoint + clés cryptographiques navigateur, `push_subscriptions`) ; logs d'audit internes. Pas de date de naissance, pas d'adresse, pas d'IP stockée en base à ce jour.
5. **Modèle économique** : gratuit actuellement, aucune mise financière réelle (confirmé par inventaire du code — uniquement un système de points/classement fictif). Modèle 2027 non tranché, un modèle payant n'est pas exclu.
6. **Prestataires utilisés** (inventaire technique du 02/09/2026) : Supabase (auth + base de données + realtime + storage), Vercel (hébergement), Cloudflare Turnstile (captcha au signup), Highlightly API + bibliothèque `nba_api` (données NBA), Anthropic/Claude (structuration IA des paris texte libre), Web Push/VAPID (notifications, sans tiers commercial). Pas de prestataire d'envoi d'e-mail transactionnel branché à ce jour. Pas d'outil d'analytics/mesure d'audience.
7. **Pays ciblés** : France pour la bêta (cercle fermé). Périmètre géographique 2027 non tranché.
8. **Présence de mineurs** : oui, le service est ouvert à tous âges. Aucune vérification ni déclaration d'âge n'existe dans le code à ce jour (signup sans contrôle d'âge).
9. **Contenus publiés par les utilisateurs** : messages de chat (visibles par les membres du canal général ou de la ligue, suppression admin uniquement, pas d'édition par l'auteur) ; pseudo public ; paris en formulation libre structurés par IA (visibilité selon les règles de la ligue) ; signalements de bug (visibles auteur + admins uniquement, non publics).
10. **Mises, lots ou récompenses** : aucune à ce jour — uniquement des points fictifs de classement. Non exclu pour 2027, modèle non tranché (voir point 5).

## 4. Livrables recommandés avant la mise en production

Selon le contexte, le dossier juridique de lancement pourra comprendre :

- une cartographie des données personnelles ;
- un registre des traitements adapté ;
- une matrice des finalités, bases légales et durées de conservation ;
- une politique de confidentialité ;
- des mentions légales ;
- des conditions générales d’utilisation ;
- des conditions générales de vente si le service est payant ;
- une politique relative aux cookies ;
- un mécanisme de gestion du consentement lorsque nécessaire ;
- une procédure d’exercice des droits ;
- une procédure de suppression de compte ;
- une procédure de gestion des incidents et violations de données ;
- une liste des sous-traitants et prestataires ;
- les accords de traitement des données applicables ;
- une vérification des licences et droits de propriété intellectuelle ;
- un règlement spécifique si l’application organise un concours ou distribue des récompenses.

## 5. Checklist synthétique avant lancement

### Produit et gouvernance

- [ ] L’exploitant et le responsable du traitement sont identifiés.
- [ ] Le public visé et les pays ciblés sont définis.
- [ ] Le modèle économique est documenté.
- [ ] La présence éventuelle de mineurs est prise en compte.

### Données personnelles

- [ ] Toutes les données collectées sont recensées.
- [ ] Chaque collecte répond à une finalité précise.
- [ ] Une base légale est identifiée pour chaque traitement.
- [ ] Les données collectées sont limitées au nécessaire.
- [ ] Les durées de conservation sont définies.
- [ ] Les droits des utilisateurs peuvent être exercés.
- [ ] La suppression du compte et des données est organisée.

### Documents visibles par les utilisateurs

- [ ] Les mentions légales sont publiées.
- [ ] La politique de confidentialité est publiée.
- [ ] Les CGU sont adaptées au service.
- [ ] Les CGV sont disponibles si le service est payant.
- [ ] Les informations sur les cookies sont accessibles.

### Prestataires et architecture

- [ ] Tous les prestataires sont recensés.
- [ ] Les DPA et conditions contractuelles sont vérifiés.
- [ ] La localisation et les transferts de données sont documentés.
- [ ] Les clés d’API et secrets ne sont pas exposés côté client.
- [ ] Les règles d’accès à la base de données ont été testées.

### Sécurité

- [ ] Les rôles et permissions sont correctement séparés.
- [ ] Les actions d’administration sont protégées.
- [ ] Les sauvegardes et restaurations ont été testées.
- [ ] Une procédure de gestion des incidents existe.
- [ ] Les dépendances et bibliothèques sont maintenues à jour.

### Contenus et propriété intellectuelle

- [ ] Les licences du code et des bibliothèques sont compatibles.
- [ ] Les droits sur les images, logos, polices et textes sont vérifiés.
- [ ] Les conditions d’utilisation des API externes sont respectées.
- [ ] Les règles relatives aux contenus utilisateurs sont définies.
- [ ] Un mécanisme de signalement ou de modération est prévu si nécessaire.

### Pronostics, concours et récompenses

- [ ] L’absence ou la présence d’une mise financière est clairement établie.
- [ ] La nature et la valeur des récompenses sont documentées.
- [ ] Le règlement de la compétition est accessible.
- [ ] La présentation ne crée pas de confusion avec une offre de pari réglementée.
- [ ] Une validation juridique spécialisée est envisagée en cas de paiement ou de gains significatifs.

## 6. Sources générales

- CNIL, *Appliquer le RGPD dans une TPE ou PME* : https://www.cnil.fr/fr/appliquer-le-rgpd-dans-une-tpe-ou-pme-les-questionsreponses-de-la-cnil
- Service Public Entreprendre, *Obligations en matière de protection des données personnelles (RGPD)* : https://entreprendre.service-public.fr/vosdroits/F24270

## 7. Prochaine étape conseillée

Compléter les dix informations listées dans la section 3, puis établir une matrice distinguant :

1. les obligations indispensables avant le lancement ;
2. les mesures techniques à intégrer dans l’application ;
3. les documents à publier ;
4. les contrats et licences à vérifier ;
5. les points nécessitant une validation par un professionnel du droit.

## 8. Matrice d'obligations initiale (02/09/2026)

Établie à partir des réponses de la section 3. Point de départ pour le cadrage de la bêta fermée (France, cercle sur invitation) — à revoir avant toute ouverture plus large et avant tout changement de modèle économique (2027).

### 8.1. Obligations indispensables avant le lancement de la bêta

- Identifier clairement l'exploitant (particulier en nom propre) dans une page accessible, même minimale.
- Informer les utilisateurs sur les données collectées (`pseudo`, e-mail via Supabase Auth, messages de chat, signalements de bug, abonnements push) et leurs finalités.
- Étant donné que le service reste ouvert à tous âges (cadrage détaillé en §2.10) : informer les utilisateurs des règles applicables aux mineurs dans la politique de confidentialité.
- Prévoir une manière pour un utilisateur de demander la suppression de son compte et de ses données.

### 8.2. Mesures techniques à intégrer

- Déclaration d'âge simple au signup (case ou tranche d'âge, sans justificatif) : décidée en §2.10 point 4, n'existe pas aujourd'hui (`SignupForm.tsx`) — à implémenter dans une prochaine itération.
- Signalement d'un message de chat vers les admins : décidé en §2.10 point 7, en complément de `bug_reports` qui ne couvre pas ce cas — à implémenter dans une prochaine itération.
- **Self-service suppression de compte + export de données** (décidé en §2.1 point 6) — cadré maintenant, à implémenter dans une prochaine session. Spécification fonctionnelle :
  - *Suppression* : reprendre la logique du script CLI existant (`scripts/delete-player-account.mjs`) comme action serveur authentifiée, restreinte à l'utilisateur connecté (jamais à un autre `user_id`). Conserver les mêmes garde-fous métier : blocage si le compte a le rôle `ADMIN` (doit être rétrogradé par un autre admin avant de pouvoir se supprimer lui-même) ; blocage si l'utilisateur a créé une ligue ayant d'autres membres actifs (message clair invitant à transférer ou dissoudre la ligue d'abord, comportement exact à définir). Ajouter une confirmation explicite côté UI (ex. saisie du pseudo, pas juste un bouton) avant d'exécuter — le script CLI a un `--confirm` équivalent à reproduire.
  - *Export* : action serveur authentifiée qui régénère, pour l'utilisateur connecté uniquement, un fichier (JSON suffisant à ce stade) contenant ses propres données : profil (bio, équipe favorite, préférences), paris (`bets`), messages de chat envoyés, signalements de bug, appartenances aux ligues. Pas besoin d'un format d'interopérabilité sophistiqué vu l'échelle actuelle.
- Pas de prestataire d'e-mail transactionnel branché à ce jour : si un flux d'information RGPD (ex. confirmation, notification de suppression) doit passer par e-mail, il dépend d'un prestataire encore à choisir.
- Aucune mise ni paiement aujourd'hui : pas de mesure technique de paiement à sécuriser pour l'instant.
- **Vérifier les sauvegardes/restauration Supabase** (§2.7) : dépend du plan utilisé, non vérifié à ce jour.
- **Formaliser une procédure de gestion des incidents / notification de violation de données** (§2.7) : distincte de la procédure d'effacement sur demande (finding 15, déjà traitée) — n'existe pas encore, même sous forme minimale (qui prévenir, sous quel délai, dans quels cas une notification CNIL/aux utilisateurs est requise).

### 8.3. Documents à publier

- **Mentions légales — rédigées ET publiées (03/09/2026)**, `Cadrage/Juridique/mentions_legales.md` (référence texte) + `app/mentions-legales/page.tsx` (page réelle, route `/mentions-legales`). Identité de l'exploitant complétée avec l'utilisateur (Mathieu Lenoir, adresse "communicable sur demande", contact `panier.ballon.pronos@gmail.com`).
- **Politique de confidentialité — rédigée ET publiée (03/09/2026)**, `Cadrage/Juridique/politique_confidentialite.md` + `app/confidentialite/page.tsx` (route `/confidentialite`), couvrant les données réellement collectées (§9 registre des traitements) et les prestataires (§2.6).
- **CGU — rédigées ET publiées (03/09/2026)**, `Cadrage/Juridique/cgu.md` + `app/cgu/page.tsx` (route `/cgu`), couvrant a minima : comportement attendu dans le chat, modération, suppression de compte, absence de mise financière.
- Accessibles depuis l'app : section "Informations légales" du profil (utilisateurs connectés) + rangée de liens dédiée sous la nav réduite (`PublicNav`, visiteurs non connectés).
- Pas de CGV nécessaire tant que le service reste gratuit.
- Pas de politique de cookies distincte nécessaire au-delà de la mention du cookie de session Supabase et du captcha Turnstile (à confirmer selon leur qualification exacte) — déjà couvert dans la politique de confidentialité rédigée ci-dessus.

### 8.4. Contrats et licences à vérifier

- Conditions d'utilisation et localisation des données de Supabase, Vercel, Cloudflare (Turnstile), Anthropic — en particulier les transferts hors UE éventuels, à documenter même si le public visé reste France pour l'instant.
- Conditions d'utilisation de l'API Highlightly (consultées 02/09/2026, `highlightly.net/terms/` — pas de revente/redistribution d'accès, pas d'usage des logos qu'elle fournit, non applicable ici, pas d'attribution requise) et des [conditions NBA.com](https://www.nba.com/termsofuse) pour les données récupérées via `nba_api` (propriété intellectuelle, section 2.8).
- Pas de DPA de prestataire de paiement ou d'e-mail à vérifier tant qu'aucun n'est branché.

### 8.5. Points nécessitant une validation par un professionnel du droit

- **Qualification précise des bases légales par catégorie de donnée pour les mineurs** : le cadrage général est fait (§2.10 — décisions retenues : déclaration d'âge au signup, signalement de message de chat), mais la qualification base légale/mécanisme de consentement exact par traitement (§2.10 point 3) reste à valider par un professionnel avant l'ouverture au-delà du cercle d'amis actuel.
- **Bascule vers un modèle payant en 2027** (modèle encore indéterminé) : à re-cadrer entièrement le moment venu, y compris la question d'une éventuelle mise financière (section 2.11) qui changerait le profil juridique du service.
- **Ouverture géographique 2027** (périmètre non tranché) : à revoir si le public visé s'étend hors de France.
- **Statut de l'exploitant** : particulier en nom propre pour l'instant — à revoir si l'activité se structure (auto-entreprise, société), notamment en cas de monétisation.
- **Transfert de données vers Anthropic (hors UE)** : le texte libre des paris est envoyé à l'API Claude pour structuration (§2.1 point 9, §2.6). DPA et garanties de transfert (clauses contractuelles types ou équivalent) à vérifier avant l'ouverture au-delà du cercle d'amis actuel.
- **Localisation du projet Supabase** : non trouvée dans le dépôt — à vérifier directement dans le dashboard Supabase (§2.6), en particulier si elle est hors UE.
- ~~Logos d'équipes NBA sans licence obtenue~~ — **décision prise (03/09/2026), voir §2.8 point 4** : risque accepté tel quel pour l'instant, pas une validation professionnelle en attente.
- **Usage de `nba_api`/données stats.nba.com** (§2.8 point 7) : zone grise largement tolérée dans l'écosystème open source, mais les conditions NBA.com encadrent l'usage automatisé/commercial de leurs données — à revoir si le service devient commercial ou public à grande échelle.

## 9. Registre des traitements initial (02/09/2026)

Premier registre, tenu par l'exploitant (particulier en nom propre). Bases légales indicatives, à confirmer par un professionnel avant l'ouverture au-delà du cercle d'amis actuel (§8.5). À mettre à jour à chaque évolution notable du produit (nouvelle donnée collectée, nouveau prestataire, changement de modèle économique).

| Traitement | Données concernées | Finalité | Base légale (proposée) | Destinataires / sous-traitants | Durée de conservation | Transfert hors UE |
|---|---|---|---|---|---|---|
| Gestion du compte | `pseudo`, e-mail (Supabase Auth) | Authentification, identification au sein du service | Exécution du contrat | Supabase | Tant que le compte est actif | Non identifié (localisation Supabase à vérifier) |
| Personnalisation du profil | `bio`, équipe favorite, préférences d'affichage, badges épinglés | Personnalisation de l'expérience | Exécution du contrat | Supabase | Tant que le compte est actif | — |
| Pronostics | Formulation libre du pari, résultats, statuts, raisons de refus/correction | Fonctionnement du jeu (cœur du service) | Exécution du contrat | Supabase ; Anthropic (structuration IA du texte libre) | Tant que le compte est actif | **Oui — Anthropic (États-Unis)** |
| Chat entre membres | Messages texte libre, horodatage, auteur | Échange entre membres d'une ligue/du canal général | Exécution du contrat / intérêt légitime (vie du service) | Supabase | Tant que le compte est actif | Non identifié |
| Modération (à venir) | Signalement d'un message par un utilisateur (§2.10 point 7, non implémenté) | Modération des échanges, protection des utilisateurs (dont mineurs) | Intérêt légitime | Supabase | Tant que le compte est actif | — |
| Signalement de bug | Description libre, chemin d'écran | Support technique, amélioration du service | Intérêt légitime | Supabase | Tant que le compte est actif | — |
| Actions d'administration | `actor_user_id`, action, avant/après (JSONB) | Traçabilité des décisions admin (validation de paris, changement de rôle...) | Intérêt légitime (sécurité, litiges) | Supabase | Tant que le compte concerné est actif (supprimé en cascade avec le compte de l'acteur) | — |
| Notifications push | Endpoint et clés cryptographiques du navigateur | Envoi de notifications | Consentement (activation par l'utilisateur) | Supabase ; service push du navigateur (Google/Mozilla/Apple) | Tant que l'abonnement est actif | Possible selon le service push du navigateur de l'utilisateur, hors du contrôle direct de l'application |
| Sécurité du signup | Signal anti-bot Turnstile | Prévention des inscriptions automatisées | Intérêt légitime | Cloudflare | Le temps de la vérification | Réseau mondial Cloudflare |
| Hébergement / exécution | Toutes les requêtes applicatives (accès technique) | Fonctionnement du service | Exécution du contrat | Vercel | Le temps du traitement de la requête | Vercel Inc. est une société américaine ; calcul déployé en `dub1` (UE) |
