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

### 2.2. Cookies et traceurs

Il faut recenser les cookies et traceurs utilisés par l’application, notamment ceux liés :

- à l’authentification ;
- au fonctionnement technique ;
- à la mesure d’audience ;
- à la publicité ;
- aux pixels marketing ;
- aux lecteurs vidéo ou services tiers intégrés.

Les traceurs strictement nécessaires peuvent relever d’un régime différent des traceurs publicitaires ou de certains outils d’analyse. Lorsque le consentement est requis, l’utilisateur doit pouvoir accepter ou refuser de manière suffisamment simple et conserver la possibilité de modifier son choix.

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
- Procédure de suppression de compte et des données associées (chat, signalements, abonnements push) — vérifier ce qui existe déjà côté Supabase/admin.
- Pas de prestataire d'e-mail transactionnel branché à ce jour : si un flux d'information RGPD (ex. confirmation, notification de suppression) doit passer par e-mail, il dépend d'un prestataire encore à choisir.
- Aucune mise ni paiement aujourd'hui : pas de mesure technique de paiement à sécuriser pour l'instant.

### 8.3. Documents à publier

- Mentions légales (identité de l'exploitant particulier).
- Politique de confidentialité, même simple, couvrant les données réellement collectées (section 3, point 4) et les prestataires (point 6).
- CGU couvrant a minima : comportement attendu dans le chat, modération (suppression admin des messages), suppression de compte.
- Pas de CGV nécessaire tant que le service reste gratuit.
- Pas de politique de cookies distincte nécessaire au-delà de la mention du cookie de session Supabase et du captcha Turnstile (à confirmer selon leur qualification exacte).

### 8.4. Contrats et licences à vérifier

- Conditions d'utilisation et localisation des données de Supabase, Vercel, Cloudflare (Turnstile), Anthropic — en particulier les transferts hors UE éventuels, à documenter même si le public visé reste France pour l'instant.
- Conditions d'utilisation de l'API Highlightly et de la bibliothèque `nba_api` pour la réutilisation des données NBA (propriété intellectuelle, section 2.8).
- Pas de DPA de prestataire de paiement ou d'e-mail à vérifier tant qu'aucun n'est branché.

### 8.5. Points nécessitant une validation par un professionnel du droit

- **Qualification précise des bases légales par catégorie de donnée pour les mineurs** : le cadrage général est fait (§2.10 — décisions retenues : déclaration d'âge au signup, signalement de message de chat), mais la qualification base légale/mécanisme de consentement exact par traitement (§2.10 point 3) reste à valider par un professionnel avant l'ouverture au-delà du cercle d'amis actuel.
- **Bascule vers un modèle payant en 2027** (modèle encore indéterminé) : à re-cadrer entièrement le moment venu, y compris la question d'une éventuelle mise financière (section 2.11) qui changerait le profil juridique du service.
- **Ouverture géographique 2027** (périmètre non tranché) : à revoir si le public visé s'étend hors de France.
- **Statut de l'exploitant** : particulier en nom propre pour l'instant — à revoir si l'activité se structure (auto-entreprise, société), notamment en cas de monétisation.
