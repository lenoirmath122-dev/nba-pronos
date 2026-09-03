# Politique de confidentialité

> Rédigé le 03/09/2026 à partir du cadrage juridique complet (`conseils_juridiques_deploiement_application.md`, notamment §2.1, §2.6, §2.10 et §9 — registre des traitements). **Publié dans l'application** le 03/09/2026 (`app/confidentialite/page.tsx`) — ce fichier reste la référence texte, tenue à jour en parallèle de la page.

## 1. Qui est responsable de vos données ?

nba-pronos est édité par Mathieu Lenoir, particulier, en nom propre — voir les mentions légales pour les coordonnées complètes. C'est cette personne qui est responsable du traitement de vos données au sens du RGPD.

nba-pronos est aujourd'hui un service **gratuit, réservé à un cercle fermé d'utilisateurs invités** (bêta privée, France). **Une déclaration d'âge est demandée à l'inscription** (certifier avoir 15 ans ou plus) : le service n'est pas accessible en dessous de ce seuil, mais reste, au-delà, ouvert aux mineurs de 15 à 17 ans comme aux majeurs (voir §7 "Mineurs" ci-dessous).

## 2. Quelles données on collecte, pourquoi, et combien de temps

Le tableau ci-dessous liste toutes les données que nba-pronos collecte à ce jour.

| Donnée | À quoi ça sert | Sur quelle base | Combien de temps |
|---|---|---|---|
| Pseudo (visible par les autres membres) et e-mail | Créer votre compte et vous authentifier | Exécution du contrat (le fonctionnement du service en dépend) | Tant que votre compte est actif |
| Bio, équipe favorite, préférences d'affichage | Personnaliser votre profil | Exécution du contrat | Tant que votre compte est actif |
| Vos pronostics (paris, résultats, statuts) | Faire fonctionner le jeu — c'est le cœur du service | Exécution du contrat | Tant que votre compte est actif |
| Le texte libre de vos paris personnalisés | Structurer automatiquement votre pari via une intelligence artificielle (Anthropic/Claude) pour calculer une probabilité | Exécution du contrat | Tant que votre compte est actif |
| Vos messages dans le chat | Permettre les échanges entre membres d'une ligue ou du canal général | Exécution du contrat / intérêt légitime (vie du service) | Tant que votre compte est actif |
| Vos signalements de bug | Vous permettre de nous signaler un problème technique | Intérêt légitime (support) | Tant que votre compte est actif |
| Abonnement aux notifications push | Vous envoyer des notifications si vous les avez activées | Votre consentement (activation volontaire) | Tant que l'abonnement est actif |
| Actions des administrateurs (validation de paris, changements de rôle...) | Assurer la traçabilité des décisions prises sur votre compte ou vos paris | Intérêt légitime (sécurité, traitement des litiges) | Tant que le compte concerné est actif |
| Confirmation d'avoir 15 ans ou plus (case cochée à l'inscription, horodatée) | Vérifier votre éligibilité à l'inscription (seuil légal RGPD pour le consentement des mineurs) | Obligation légale | Tant que votre compte est actif |

**Ce qu'on ne collecte pas** : date de naissance précise (nous ne demandons qu'une confirmation du seuil de 15 ans, jamais votre date de naissance), adresse postale, données professionnelles, adresse IP.

**Sur la durée de conservation** : nba-pronos ne supprime aujourd'hui aucune donnée automatiquement — vos données restent tant que votre compte existe, et sont supprimées seulement si vous en faites la demande (voir §5, "Vos droits"). C'est un choix assumé, adapté à la taille actuelle du service (bêta fermée entre amis), pas un oubli — et il sera revu si le service s'ouvre plus largement.

## 3. Qui a accès à vos données (nos prestataires)

Nous faisons appel aux prestataires suivants pour faire fonctionner nba-pronos. Aucun d'eux n'est autorisé à utiliser vos données pour son propre compte.

| Prestataire | Rôle | Données concernées |
|---|---|---|
| Supabase | Hébergement de la base de données, authentification | Toutes vos données de compte et d'activité |
| Vercel | Hébergement technique de l'application | Vos requêtes lorsque vous utilisez l'application |
| Cloudflare (Turnstile) | Protection anti-robot à l'inscription | Signal technique de vérification, pas de donnée de profil |
| Anthropic (Claude) | Structuration automatique par IA du texte de vos paris personnalisés | Le texte que vous saisissez pour un pari personnalisé |
| Service de notification push de votre navigateur (Google, Mozilla ou Apple selon le cas) | Relais technique des notifications, si vous les activez | Votre abonnement push |

**Transfert hors de l'Union européenne** : Anthropic est une société américaine — le texte de vos paris personnalisés lui est transmis pour être analysé, ce qui constitue un transfert hors UE. Ce transfert est encadré par les clauses contractuelles types (SCC) de la Commission européenne, intégrées par défaut aux conditions commerciales d'Anthropic dès qu'un client relève du droit européen de la protection des données — aucune démarche supplémentaire n'était nécessaire de notre côté pour en bénéficier.

> Note interne (pas affichée dans la page publiée) : vérifié le 03/09/2026 (sources publiques Anthropic : Commercial Terms of Service, Data Processing Addendum) — le DPA d'Anthropic est incorporé par référence à ses Commercial Terms of Service, qui couvrent tout usage de l'API (facturation à l'usage comprise, pas seulement Team/Enterprise) : "Data submitted through the Services will be processed in accordance with the [DPA]... which is incorporated into these Terms by reference." Le DPA prévoit les Clauses Contractuelles Types (SCC, Module Two controller-to-processor) "to the extent required by Applicable Data Protection Laws" -- s'applique donc automatiquement à un client européen, sans signature séparée. Rôles : "Customer is the controller and Anthropic is Customer's processor" (s'applique à tout client API, pas seulement aux comptes Enterprise). Entraînement des modèles sur les données client explicitement exclu par défaut ("Anthropic may not train models on Customer Content from Services"). Liste des sous-traitants d'Anthropic publiée à trust.anthropic.com/subprocessors (non consultée en détail, non bloquant). Point du §8.5 du cadrage juridique considéré clos pour la partie garanties de transfert -- reste ouvert seulement la qualification base légale précise pour les mineurs de 15-17 ans (sujet distinct, toujours à valider par un professionnel).

Nous ne faisons appel à aucun service de mesure d'audience, de publicité, ni de paiement.

## 4. Cookies

nba-pronos utilise uniquement des cookies et technologies strictement nécessaires au fonctionnement du service :

- un cookie de session pour vous garder connecté ;
- un cookie technique lié à la vérification anti-robot à l'inscription ;
- une préférence d'affichage enregistrée localement sur votre appareil (jamais transmise à nos serveurs).

Aucun de ces éléments ne nécessite votre consentement — nous ne les utilisons pas pour vous suivre ou vous cibler publicitairement, et nous n'utilisons aucun autre traceur.

## 5. Vos droits

Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données, ainsi que du droit de vous opposer à certains traitements.

Depuis votre profil (onglet « Compte »), vous pouvez à tout moment télécharger une copie de vos données personnelles ou supprimer définitivement votre compte, sans passer par une demande manuelle. Pour toute autre demande (rectification, opposition...), contactez panier.ballon.pronos@gmail.com.

> Note interne (pas affichée dans la page publiée) : self-service implémenté le 03/09/2026 (`lib/actions/account.ts` pour la suppression, `app/api/account/export/route.ts` pour l'export) — referme le point §8.2 du cadrage juridique. La suppression reprend l'ordre du script CLI `scripts/delete-player-account.mjs` (mêmes garde-fous : refus si rôle ADMIN, refus si ligue créée avec d'autres membres actifs), scopée à la session (jamais un pseudo passé en paramètre). Le script CLI reste en place pour les cas que le self-service refuse (admin doit intervenir).

Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr) si vous estimez que vos droits ne sont pas respectés.

## 6. Sécurité

Nous mettons en œuvre des mesures de sécurité proportionnées à la nature du service : séparation des rôles administrateur/joueur, restrictions d'accès à la base de données, protection des secrets techniques. Le détail de ces mesures fait l'objet d'un audit de sécurité dédié, régulièrement mis à jour.

## 7. Mineurs

Depuis le 03/09/2026, l'inscription nécessite de certifier avoir 15 ans ou plus (case à cocher, déclarative, sans justificatif demandé) — en dessous de ce seuil, la création de compte est refusée, faute de mécanisme de consentement parental actuellement en place. Ce seuil suit la règle retenue par la CNIL : en France, un mineur de 15 ans ou plus peut consentir seul à un traitement de données reposant sur le consentement ; en dessous, le consentement du titulaire de l'autorité parentale est requis en plus de celui du mineur. Si vous avez entre 15 et 17 ans et utilisez nba-pronos, vos données sont traitées selon les mêmes règles que celles décrites ci-dessus.

> Note interne (pas affichée dans la page publiée) : cette déclaration d'âge referme le point le plus sensible identifié en cadrage (absence de base légale pour les moins de 15 ans, faute de consentement parental) — voir §2.10 point 4 et §8.2 du cadrage juridique, mis à jour le 03/09/2026. Reste à valider avec un professionnel du droit avant toute ouverture au-delà du cercle actuel : cadre exact applicable aux 15-17 ans (information adaptée, articulation avec l'autorité parentale sur certains aspects...) — voir §8.5, non tranché à ce jour.

## 8. Modification de cette politique

Cette politique de confidentialité peut évoluer, notamment si le service change de modèle économique ou s'ouvre à un public plus large. Toute modification substantielle vous sera communiquée.

*Dernière mise à jour : 03/09/2026.*
