# Panier Ballon — Plan d'acquisition et d'activation

*Établi le 19 octobre 2026, à partir des données Vercel Analytics (12 → 19 octobre) et de la base Supabase `nba-pronos`. Version 2 : parcours invité + email validé.*

---

## 0. Point de départ

### Les chiffres

| Indicateur | Valeur |
|---|---|
| Visiteurs depuis le 12/10 | ~235 (dont 94 % sur mobile) |
| Visiteurs venus d'Instagram / Facebook | ~150, avec ~1 page vue chacun |
| Comptes créés depuis le 12/10 | 8 (≈ 5 % des visiteurs sociaux) |
| Emails confirmés | 7 sur 8 |
| Nouveaux inscrits ayant fait au moins un prono | 3 sur 8 |
| Anciens comptes (avant le 12/10) qui jouent la Semaine 1 | 3 sur 10 |
| Joueurs actifs sur la compétition en cours | 6 (19 pronos) |
| Ligues créées / avec plus d'un membre | 4 / 0 |
| Joueurs ayant activé les notifications push | 9 sur 18 |

### Le diagnostic

1. **Les visiteurs repartent sans rien faire.** L'accueil présente le jeu, mais on ne voit aucun match et le seul bouton mène à un formulaire d'inscription.
2. **Les inscrits n'avaient rien à vivre.** La compétition « Saison régulière - Semaine 1 » a été ouverte le 12/10, mais son premier match a lieu dans la nuit du 20 au 21/10 : pendant une semaine, ni résultat, ni points, ni classement qui bouge.
3. **Personne ne joue avec ses amis.** Les ligues existent mais personne n'y invite personne.
4. **Les notifications push supposent l'app installée**, ce qui est hors de portée d'un nouveau visiteur sur iPhone. **L'email devient le canal principal**, le push un bonus pour les joueurs fidèles.

### L'objectif

Faire en sorte qu'un visiteur venu d'Instagram **joue dans les 10 secondes** qui suivent son arrivée, laisse son email pour **recevoir son résultat**, et **revienne le lendemain**.

---

## 1. PHASE 1 — Jouer d'abord, s'inscrire ensuite

**Durée visée : 9 à 10 jours de travail, en deux livraisons.**

- **1A — Accueil + pronos invités + inscription par email ou Google** (≈ 6 jours). Mise en ligne idéale avant le week-end du 24–25 octobre.
- **1B — Emails automatiques : résultat du matin, relance, rappel** (≈ 3,5 jours). Semaine suivante.

### 1.1 Décisions prises

| Sujet | Décision |
|---|---|
| Pronos sans compte | Oui, un ou plusieurs, sur le match du soir et les suivants |
| Ce qu'on demande pour enregistrer | Pseudo + email + « J'ai 15 ans ou plus », sur un seul écran |
| Alternative | « Continuer avec Google » (masqué dans les navigateurs d'Instagram/Facebook, cf. 1.9) |
| Mot de passe | Aucun à l'inscription ; connexion par lien magique ; mot de passe **facultatif, créable plus tard** depuis le profil |
| Validation | Un clic dans le mail « Valider mes pronos » crée le compte définitif |
| Pronos validés après le match | **Acceptés** : un prono enregistré avant le coup d'envoi compte même si l'email est confirmé après le résultat (risque de triche multi-adresses accepté) |
| Notifications | Emails activés d'office, cases à décocher ; « Je préfère en push » proposé seulement si l'app est installée |
| Relance des non-validés | **Une seule**, le lendemain matin, avec les points en attente |
| Données non validées | Effacées après 7 jours |
| Installation de l'app (PWA) | Pas dans les emails : proposée sur le site après quelques soirées jouées (Phase 2) |

### 1.2 Indicateurs de réussite

À mesurer 7 jours après la mise en ligne de 1A, comparés à la semaine du 12/10 :

| Indicateur | Avant | Objectif |
|---|---|---|
| Visiteurs sociaux qui choisissent une équipe | ≈ 0 (rien à cliquer) | ≥ 30 % |
| Joueurs invités qui laissent pseudo + email (ou Google) | — | ≥ 40 % |
| Emails validés (clic dans le mail, à 7 jours) | — | ≥ 70 % |
| Visiteurs sociaux → compte validé | ≈ 5 % | ≥ 10 % |
| Comptes validés qui jouent un 2e soir | inconnu | ≥ 50 % |

Ces objectifs sont des repères pour juger l'effet du changement : à ce volume, quelques joueurs font varier les pourcentages.

### 1.3 Le parcours cible

```
Instagram (lien en bio / story)
   │
   ▼
① ACCUEIL — « Match de cette nuit · 1h00 »
   [ Équipe A ]  [ Équipe B ]  → écart → « Ajouter à mes pronos »
   + « Les prochains matchs » : on peut en pronostiquer d'autres
   Panier en bas d'écran : « 3 pronos prêts · Enregistrer »
   │
   ▼
② ÉCRAN « ENREGISTRE TES PRONOS »
   Pseudo (« c'est ton nom au classement »)
   Email (« on t'envoie tes résultats par email »)
   ☐ J'ai 15 ans ou plus
   [ Enregistrer mes pronos ]
   ─── ou ───
   [ Continuer avec Google ]   (hors navigateur Instagram/Facebook)
   │
   ├── Email ──────────────────────────────┐
   │                                        ▼
   │                ③ Compte EN ATTENTE créé, pronos enregistrés en base
   │                   Écran : « C'est noté ! Ouvre le mail qu'on vient
   │                   de t'envoyer pour valider tes pronos. »
   │                                        │
   │                                        ▼
   │                ④ MAIL « Valider mes pronos » (un seul bouton)
   │                   clic → compte ACTIF, connecté
   │                                        │
   └── Google ─────────────────────────────┤ (email déjà vérifié :
                                            │  compte ACTIF directement,
                                            │  pseudo + 15 ans demandés au retour)
                                            ▼
⑤ PAGE « BIENVENUE »
   Tes pronos (liste)
   ☑ Recevoir mes résultats par email
   ☐/☑ Recevoir un rappel avant les matchs (cf. 1.12, décision restante)
   [ Je préfère en push ]        ← seulement si l'app est installée
   Créer un mot de passe (facultatif)
   │
   ▼
⑥ LE LENDEMAIN MATIN — mail résultat : points, classement, match suivant

   Sans validation :
   J+1 matin → UNE relance « Tes pronos t'ont rapporté 20 points.
               Valide ton compte pour les récupérer. »
   J+7       → compte en attente + pronos effacés
```

### 1.4 Structure de l'accueil (mobile d'abord)

Ordre des blocs, du haut vers le bas :

**Bloc 1 — En-tête minimal**
- Logo à gauche, « Se connecter » à droite. Pas de menu Bracket/Règles en haut.

**Bloc 2 — Le match de cette nuit (visible sans défiler)**
- Surtitre : « Match de cette nuit · 1h00 » (heure française, calculée depuis `matches.scheduled_at`).
- Compte à rebours : « Pronos ouverts encore 15 h 42 min ».
- Les deux équipes face à face (`teams.logo_url`, noms), chacune dans un grand bouton tactile (hauteur ≥ 56 px).
- Ligne de réassurance : « Gratuit · que des points, aucun argent réel ».

**Bloc 3 — L'écart (s'ouvre sous le match après le choix d'équipe)**
- Phrase dynamique : « **Équipe A** gagne de **7** points ».
- Curseur de 1 à 50 (contrainte `predicted_margin`), confortable entre 1 et 25, avec raccourcis 1–5 · 6–10 · 11–15 · 16+.
- Rappel du barème avec lien vers les règles.
- Bouton : « Ajouter à mes pronos ».
- Après l'ajout : la répartition des votes s'affiche (cf. bloc 5) et la page fait défiler vers les prochains matchs.

**Bloc 4 — Les prochains matchs**
- Les 2 à 4 matchs suivants de la compétition, en cartes compactes avec le même mécanisme (équipe → écart → ajouter).
- Chaque carte pronostiquée affiche « ✓ Équipe A +7 · modifier ».

**Bloc 5 — La barre « Mes pronos » (collée en bas de l'écran dès le 1er prono)**
- « 3 pronos prêts » + bouton « Enregistrer » qui ouvre l'écran ②.
- Reste visible pendant le défilement ; disparaît une fois les pronos enregistrés.

**Bloc 6 — La preuve sociale**
- « **23 joueurs** ont déjà pronostiqué » + barre « 61 % Équipe A / 39 % Équipe B ».
- **Règle des petits nombres :** sous 10 pronos, pas de compteur ni de pourcentages ; afficher « Sois parmi les premiers à pronostiquer ce match ».
- La répartition n'apparaît **qu'après** avoir choisi son équipe : elle n'influence pas le choix et récompense le clic.

**Bloc 7 — Le résultat de la nuit dernière**
- « Cette nuit : Équipe C 112 – 104 Équipe D ».
- « 4 joueurs sur 9 avaient le bon vainqueur, **@pseudo** a trouvé l'écart exact ». Sous 10 pronos, seulement le score.

**Bloc 8 — Le classement**
- Top 5 de la compétition active (pseudo, avatar, points) + « Voir tout le classement ».

**Bloc 9 — Comment ça marche (raccourci)**
- 3 étapes en une ligne chacune, puis paris perso, ligues entre amis et NBA Cup en cartes compactes.
- Le **bracket des playoffs disparaît de l'accueil** jusqu'en avril.

**Bloc 10 — Pied de page** : mentions légales, confidentialité, CGU.

### 1.5 Les états de la page

La page doit toujours proposer quelque chose à jouer.

| Situation | Ce qu'affiche le bloc 2 |
|---|---|
| Match à venir ce soir / cette nuit | Le match, pronos ouverts |
| Match commencé (`scheduled_at` dépassé) | « En cours » (+ score si disponible) et le **match suivant**, ouvert aux pronos |
| Pas de match aujourd'hui | Le prochain match, avec sa date (« Jeudi, 1h30 ») |
| Match reporté / annulé | Bascule sur le match suivant ; retiré du panier s'il y était |
| Aucun match à venir en base | Message de secours (ne doit **jamais** arriver en saison, cf. 1.8) |
| Prono dans le panier pour un match qui a commencé | Retiré du panier avec un message « Match commencé, prono retiré » |
| Compte en attente (email pas encore validé) | Bandeau « Valide ton email pour que tes pronos comptent » + « Renvoyer le mail » |
| Joueur connecté | Le bouton enregistre directement ; s'il a déjà joué : « Ton prono : Équipe A +7 ✏️ Modifier » |

### 1.6 Conception technique

#### a) Le panier de pronos (navigateur)

- Stocké dans `localStorage` (lectures et écritures dans un `try/catch`) : liste de `{ matchId, competitionId, winnerTeamId, margin, addedAt }`.
- À chaque affichage, retirer les matchs commencés ou annulés.
- Le panier ne sert qu'avant l'enregistrement : dès l'écran ②, **tout part en base**. Le navigateur d'Instagram peut effacer son stockage, et le lien du mail s'ouvre dans un autre navigateur.

#### b) Le compte « en attente »

Approche recommandée : créer le compte tout de suite, et le marquer comme non validé.

1. Ajouter la valeur `PENDING` à l'enum `user_status` (aujourd'hui `ACTIVE`, `DISABLED`).
2. Server Action « Enregistrer mes pronos » :
   - contrôles : format de l'email, pseudo libre (contrainte d'unicité existante), case 15 ans cochée, limite d'envois par IP via `anon_rate_limit_events` ;
   - créer l'utilisateur et envoyer le lien magique avec `signInWithOtp` (création de compte autorisée, `emailRedirectTo` vers `/auth/callback`) ;
   - créer le profil `public.users` avec `status = 'PENDING'`, le pseudo et `age_confirmed_at = now()` ;
   - pour chaque prono du panier : vérifier `scheduled_at > now()`, `status = 'SCHEDULED'`, équipe = `home_team_id` ou `away_team_id`, écart entre 1 et 50, puis insérer dans `match_predictions` (`status = 'VALIDATED'`, `validated_at = now()`) avec le client serveur à droits élevés.
3. Les pronos sont **calculés normalement** par le système de points existant, même pour un compte en attente.
4. Au clic dans le mail (`/auth/callback`) : passer `status` à `ACTIVE`. Les points déjà gagnés apparaissent immédiatement : c'est ce qui rend possible la validation après le match.
5. **Partout où l'on affiche des joueurs** (classement, `leaderboard_snapshots`, agrégats de l'accueil, superlatifs, champions de la semaine, archives de compétition, chat), ne retenir que `status = 'ACTIVE'`. **À vérifier dans le code :** si ces requêtes filtrent déjà les comptes `DISABLED`, il suffit de passer à `status = 'ACTIVE'` ; sinon, il faut les reprendre une par une.
6. Nettoyage quotidien (`pg_cron`) : supprimer les comptes `PENDING` créés il y a plus de 7 jours, avec leurs pronos et leur entrée `auth.users`. Le pseudo redevient disponible.

**Alternative écartée :** une table séparée de pronos en attente, déplacés dans `match_predictions` à la validation. Plus étanche (aucun risque d'oublier un filtre), mais il faut alors recalculer après coup les points des matchs déjà joués. À reconsidérer si le point 5 révèle trop de requêtes à reprendre.

#### c) Email déjà utilisé

Si l'adresse correspond déjà à un compte actif :
- ne pas l'indiquer à l'écran (pour ne pas révéler qui est inscrit) : afficher le même message « Ouvre le mail qu'on vient de t'envoyer » ;
- envoyer un lien magique de **connexion** ;
- garder le panier dans le navigateur : si la personne se connecte sur le même appareil, les pronos des matchs pas encore commencés sont enregistrés à la connexion. Sinon, ils sont perdus : cas rare, acceptable.

#### d) Connexion avec Google

- Activer le fournisseur Google dans Supabase Auth ; créer l'identifiant OAuth dans Google Cloud (écran de consentement au nom de Panier Ballon, URLs de redirection `panierballon.fr` et `www.panierballon.fr`).
- Depuis l'écran ② : le panier reste dans `localStorage` (la redirection Google revient dans le même navigateur). Au retour, page « Choisis ton pseudo » + case 15 ans, puis enregistrement des pronos encore ouverts. Compte directement `ACTIVE` : l'email est vérifié par Google.
- Également proposé sur `/login` et `/signup`.
- Un joueur inscrit par email qui utilise ensuite Google avec la même adresse retrouve son compte (liaison automatique des identités par email vérifié dans Supabase) : **à tester.**

#### e) Mot de passe facultatif

- Profil → « Créer un mot de passe » (ou « Changer »), via `updateUser({ password })` pour un utilisateur connecté.
- Page `/login` : trois options — « Recevoir un lien de connexion » (par défaut), « Email + mot de passe », « Continuer avec Google ».
- « Mot de passe oublié » renvoie simplement vers le lien magique.

#### f) Les préférences d'email

Le champ actuel `notification_preference` (`NONE` / `PUSH` / `EMAIL`) ne permet qu'un seul canal. Ajouter deux booléens à `public.users` :

| Colonne | Défaut | Usage |
|---|---|---|
| `email_results_enabled` | `true` | Récap du matin (peut s'appuyer sur `recap_enabled` existant) |
| `email_reminders_enabled` | cf. décision 1.12 | Rappel avant les matchs |

Le push reste géré par `push_subscriptions`. « Je préfère en push » (visible seulement si `display-mode: standalone`) abonne au push et désactive les deux emails.

### 1.7 Les données de l'accueil

Lues côté serveur (Server Component), en cache 60 secondes (`revalidate = 60`).

| Donnée | Source | Remarque |
|---|---|---|
| Match du soir + prochains matchs | `matches` des compétitions `ACTIVE` de type `DAILY_MATCH`, `scheduled_at > now()`, tri croissant, 4 résultats | + jointure `teams` |
| Nombre de pronos et répartition | agrégat sur `match_predictions` des comptes `ACTIVE` | via une **fonction SQL `SECURITY DEFINER`** qui ne renvoie que des totaux |
| Résultat de la veille | dernier match `FINISHED` + agrégat (`is_winner_correct`, `margin_diff = 0`) | pseudo cité seulement pour un écart exact |
| Top 5 | même source que `/leaderboard` | comptes `ACTIVE` seulement |

### 1.8 Garantir des matchs chaque jour

- Vérifier que la création automatique des matchs alimente la saison régulière **au moins 4 jours à l'avance** (le bloc « prochains matchs » en a besoin).
- Alerte admin si aucune compétition active n'a de match dans les 48 h.
- Les requêtes de l'accueil cherchent dans **toutes** les compétitions `DAILY_MATCH` actives, pour que le passage d'une semaine à l'autre soit invisible.
- **À vérifier :** chaque compétition a un `join_code` (`competition_secrets`). Si rejoindre la saison régulière exige un code, le supprimer pour la compétition principale : un nouveau joueur doit y être automatiquement.

### 1.9 Navigateurs intégrés (Instagram, Facebook)

- **Google bloque sa connexion dans ces navigateurs.** Détecter Instagram/Facebook dans l'agent utilisateur et y **masquer** le bouton Google (ou le remplacer par « Ouvrir dans Safari/Chrome pour utiliser Google »). L'email reste le chemin principal depuis Instagram.
- Pas de pop-up ni de nouvel onglet : tout se passe dans la même page.
- Vérifier que le clavier mobile ne masque pas le bouton « Enregistrer mes pronos ».
- Tester le parcours complet depuis l'app Instagram, sur iPhone et Android : le lien du mail s'ouvre dans un autre navigateur, le compte doit y être actif et connecté.

### 1.10 Les emails (livraison 1B)

#### Infrastructure

- **Service d'envoi** (Brevo ou Resend, offres gratuites suffisantes au départ) avec l'adresse d'expédition sur `panierballon.fr`.
- **DNS du domaine** : enregistrements SPF, DKIM et DMARC du service choisi, pour ne pas finir en spam.
- **Supabase Auth en SMTP personnalisé** sur ce même service : l'envoi intégré de Supabase est trop limité en volume pour des liens magiques à chaque inscription. Modèles d'emails d'authentification traduits et aux couleurs de Panier Ballon.
- **Envois planifiés** : `pg_cron` + une Edge Function Supabase qui appelle le service d'envoi. Journalisation dans `recap_log` (type `DAILY`) et `reminder_log` (type `MATCH_TONIGHT`, déjà prévu) pour ne jamais envoyer deux fois.
- **Désinscription** : lien en un clic dans chaque email (jeton signé, sans connexion) + en-tête `List-Unsubscribe`.

#### Les quatre emails

| Email | Destinataires | Moment | Contenu | Bouton |
|---|---|---|---|---|
| **Valider mes pronos** | Nouveau compte en attente | Immédiat | « Tes 3 pronos sont prêts. Un clic pour les valider. » + liste des pronos | Valider mes pronos |
| **Résultat du matin** | `ACTIVE` avec `email_results_enabled`, ayant joué la veille | ~8 h | Résultat de chaque prono, points gagnés, rang, évolution, match de la nuit suivante | Faire mon prono de ce soir |
| **Relance unique** | `PENDING` créé la veille, ayant au moins un prono résolu | ~8 h, J+1 | « Tes pronos t'ont rapporté 20 points. Valide ton compte pour les récupérer. » (ou « …pour jouer ce soir » s'ils ont tout raté) | Valider mon compte |
| **Rappel du soir** | `ACTIVE` avec `email_reminders_enabled`, sans prono sur le match du soir | ~18 h | Le match du soir, l'heure, la répartition actuelle des votes | Faire mon prono |

Règles communes : **un seul email par jour et par personne** en dehors du mail de validation ; mise en page simple, lisible sur téléphone ; aucune relance supplémentaire pour un compte en attente.

### 1.11 Les textes

- **Accueil, surtitre :** « Match de cette nuit · 1h00 »
- **Accueil, titre :** « [Équipe A] ou [Équipe B] ? Fais ton prono. »
- **Écart :** « De combien de points ? »
- **Bouton d'ajout :** « Ajouter à mes pronos »
- **Barre du bas :** « 3 pronos prêts · Enregistrer »
- **Écran ② :** « Enregistre tes pronos 🏀 » · Pseudo : « C'est ton nom au classement » · Email : « On t'envoie tes résultats par email » · « J'ai 15 ans ou plus »
- **Après envoi :** « C'est noté ! Ouvre le mail qu'on vient de t'envoyer pour valider tes pronos. » + « Renvoyer le mail » + « Je n'ai rien reçu ? Vérifie tes spams »
- **Page Bienvenue :** « Tes pronos sont validés ✅ Résultat demain matin dans ta boîte mail. »
- **Réassurance :** « Gratuit · que des points, aucun argent réel · 15 ans et plus »

Sur l'accueil, « prono » plutôt que « pari » : plus clair, sans ambiguïté avec les sites de paris d'argent.

### 1.12 Décision restante : le rappel du soir est-il coché par défaut ?

- **Coché :** davantage de joueurs reviennent chaque soir.
- **Décoché :** plus prudent vis-à-vis des règles sur les emails non sollicités, puisque ce rappel ressemble à une relance plutôt qu'à une information sur ses propres pronos.

Dans les deux cas : case séparée de celle des résultats, désinscription en un clic, mention dans la page Confidentialité. Les recommandations de la CNIL sur la prospection par email permettent de trancher.

### 1.13 Mesurer l'entonnoir

- Table `funnel_events` : `id`, `visitor_id` (identifiant aléatoire en cookie, sans donnée personnelle), `event`, `match_id`, `referrer`, `created_at`.
- Événements : `home_view`, `team_picked`, `prono_added`, `save_opened`, `save_email_submitted`, `save_google_started`, `account_validated`, `password_created`.
- Côté emails : envoyés, ouverts si le service le fournit, et surtout **clics** (paramètre dans les liens).
- Insertion via une route serveur protégée par `anon_rate_limit_events`.
- Page Confidentialité mise à jour : mesure d'audience interne et anonyme, emails de résultats et de rappel, effacement à 7 jours des comptes non validés.

### 1.14 Découpage des tâches

**Livraison 1A — accueil et inscription**

| # | Tâche | Estimation |
|---|---|---|
| 1 | Vérifications : code d'entrée en compétition, filtres `status` des classements, création du profil, automatisation des matchs | 0,5 j |
| 2 | Migration : `PENDING` dans `user_status`, colonnes de préférences email, fonction SQL d'agrégats | 0,5 j |
| 3 | Requêtes serveur de l'accueil : matchs, agrégats, résultat de la veille, top 5 | 0,5 j |
| 4 | Blocs match + écart + prochains matchs + panier collé en bas | 1,5 j |
| 5 | Écran ② + Server Action (compte en attente, pronos, lien magique) + cas « email déjà utilisé » | 1 j |
| 6 | `/auth/callback` (passage en `ACTIVE`) + page Bienvenue + préférences + « Je préfère en push » | 0,5 j |
| 7 | Connexion Google (configuration, page pseudo au retour, masquage dans Instagram) | 0,5 j |
| 8 | Mot de passe facultatif + nouvelle page `/login` à trois options | 0,5 j |
| 9 | Filtrage `ACTIVE` dans toutes les vues de joueurs + nettoyage à 7 jours | 0,5 j |
| 10 | États de la page, preuve sociale, résultat de la veille, classement | 0,5 j |
| 11 | `funnel_events` + recette 1A | 0,5 j |
| | **Total 1A** | **≈ 7 jours** |

**Livraison 1B — emails**

| # | Tâche | Estimation |
|---|---|---|
| 12 | Service d'envoi, DNS (SPF/DKIM/DMARC), SMTP Supabase, modèles d'authentification | 0,5 j |
| 13 | Edge Function d'envoi + `pg_cron` + journalisation | 1 j |
| 14 | Les 4 modèles d'email (mobile) + désinscription en un clic | 1 j |
| 15 | Recette 1B (vrais comptes, Gmail / Outlook / iCloud, spam) | 0,5 j |
| | **Total 1B** | **≈ 3 jours** |

### 1.15 Recette

**Parcours**
- [ ] Depuis l'app Instagram (iPhone puis Android) : 3 pronos en invité → pseudo + email → mail ouvert dans l'app Mail → clic → compte actif, connecté, 3 pronos visibles.
- [ ] Même parcours sur ordinateur, puis avec Google (hors Instagram).
- [ ] Le bouton Google n'apparaît pas dans le navigateur Instagram.
- [ ] Validation de l'email **après** la fin d'un match : les points gagnés apparaissent bien.
- [ ] Email déjà inscrit : même message à l'écran, lien de connexion reçu, pronos du panier enregistrés après connexion sur le même appareil.
- [ ] Création d'un mot de passe depuis le profil, puis connexion avec.
- [ ] Inscription par email puis connexion Google avec la même adresse : un seul compte.

**Règles**
- [ ] Prono sur un match commencé, écart de 0 ou 60, équipe qui ne joue pas : refusés côté serveur.
- [ ] Pseudo déjà pris : message clair, le reste du formulaire est conservé.
- [ ] Un compte en attente n'apparaît ni au classement, ni dans les compteurs de l'accueil, ni dans le chat.
- [ ] Un compte en attente est supprimé au bout de 7 jours ; son pseudo redevient libre.
- [ ] Moins de 10 pronos sur un match : pas de compteur ni de pourcentages.
- [ ] Les pronos individuels d'un match à venir ne sont pas lisibles sans être connecté.
- [ ] Plus de N enregistrements depuis une même IP : bloqué.

**Emails (1B)**
- [ ] Chaque email arrive en boîte de réception (pas en spam) sur Gmail, Outlook et iCloud.
- [ ] Une seule relance pour un compte en attente, aucune après.
- [ ] Jamais plus d'un email par jour hors validation.
- [ ] Le lien de désinscription fonctionne sans être connecté.
- [ ] Lighthouse mobile sur l'accueil : match affiché en moins de 2 s.

### 1.16 Accompagnement immédiat (sans attendre le développement)

- Message personnel aux **5 inscrits qui n'ont jamais joué** et aux **6 anciens testeurs** : « Première vraie soirée cette nuit, ton prono ? » avec le lien direct.
- Story Instagram ce soir : le match de la nuit + sticker sondage « Qui gagne ? », puis story au réveil avec le résultat et le meilleur pronostiqueur.

---

## 2. PHASE 2 — Faire revenir chaque jour (semaines 3–4)

**Objectif : qu'un joueur validé joue plusieurs soirs par semaine.**

- **Pronostiquer depuis l'email.** Dans le mail du matin et le rappel du soir, deux boutons d'équipe contenant un jeton signé (valable pour ce match, jusqu'au coup d'envoi) : un tap ouvre le site avec l'équipe déjà choisie, même sans être connecté sur ce navigateur ; il ne reste qu'à régler l'écart.
- **Série de soirs joués** sur le profil (« 🔥 4 soirs d'affilée ») avec badge, rappelée dans le mail du matin.
- **Champion de la semaine** : activer `weekly_ranking` sur la compétition de saison (les tables `weekly_rankings` / `weekly_champions` existent mais sont vides) et en faire un temps fort du lundi, par email et sur Instagram.
- **Installation de l'app**, proposée sur le site après 3 ou 4 soirées jouées, uniquement dans Safari ou Chrome, avec les étapes illustrées (iPhone : Partager → Sur l'écran d'accueil). Une fois installée : « Je préfère en push ».
- **Indicateur de suivi** : part des joueurs validés qui jouent au moins 3 soirs sur 7.

## 3. PHASE 3 — La boucle entre amis (semaines 4–6)

**Objectif : chaque joueur fait venir au moins un ami.**

- **« Défie un pote »** après chaque prono : lien qui ouvre directement le match avec « [Pseudo] a pris [Équipe A] de +7, et toi ? ». L'ami arrive dans le parcours invité de la Phase 1.
- **Ligues par lien d'invitation** en un clic, inscription comprise, au lieu de saisir un code.
- **Classement de ligue mis en avant** sur `/home` et dans le mail du matin.
- **Carte de résultat à partager en story** : image verticale générée côté serveur (score, prono, points, rang, logo et adresse du site).
- **Indicateur de suivi** : part des nouveaux comptes arrivés par un défi ou une invitation de ligue.

## 4. PHASE 4 — Instagram et pilotage (en continu)

- **Rythme quotidien** : la veille au soir « Match de cette nuit, ton prono ? », le matin « Résultat + meilleur pronostiqueur + top 3 ». Le lien en bio pointe vers l'accueil, qui affiche toujours le bon match.
- **Carrousels** hebdomadaires (classement, stats, champion de la semaine) avec le gabarit Panier Ballon existant.
- **Relier Instagram à Metricool** pour savoir quels posts amènent des visites.
- **Tableau de bord** à partir de `funnel_events`, des emails et des tables de jeu : visiteurs → choix d'équipe → pronos → comptes en attente → comptes validés → joueurs actifs à J+7.
- **Bilan toutes les deux semaines** : garder ce qui fait monter l'entonnoir, couper le reste.

---

## Calendrier indicatif

| Période | Contenu |
|---|---|
| Nuit du 20 au 21/10 | Première vraie soirée : messages aux inscrits inactifs, stories |
| 19/10 → 27/10 | Livraison 1A : accueil, pronos invités, inscription email / Google |
| 28/10 → 31/10 | Livraison 1B : emails (validation, résultat, relance, rappel) |
| Début novembre | Bilan Phase 1, Phase 2 (pronos depuis l'email, séries, champion de la semaine, app installable) |
| Mi-novembre | Phase 3 (défis, ligues par lien, cartes à partager), NBA Cup comme temps fort |
| En continu | Phase 4 : Instagram quotidien et bilan toutes les deux semaines |
