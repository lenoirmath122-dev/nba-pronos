# NBA Pronos — SPEC TUTORIEL JOUEUR V0.1

> **Statut : cadré en séance le 30/07/2026 (2 tours d'AskUserQuestion), en
> attente de relecture finale avant 1re ligne de code.** Aucune spec ne
> préexistait — seule une ligne dans `BACKLOG_V1.md` (« Tutoriel &
> notifications ») : « Tutoriel d'utilisation de l'appli pour le JOUEUR
> (comprendre que l'app se reset à chaque nouvelle compétition) — à
> distinguer du « mini-tuto outils Next.js/Supabase/Vercel » du proto
> (0.2.10), qui reste un document séparé et différent. »
>
> 2ème des 3 chantiers prioritaires retenus le 30/07/2026 (`GAPS_OUVERTS.md`),
> après la refonte visuelle du Bracket (FAITE) et avant les badges permanents
> (non cadrés, volontairement laissés pour plus tard — voir §9).
>
> Ce n'est PAS un écran à route dédiée (contrairement aux `SPEC_ECRAN_*`) :
> une bannière de proposition sur Accueil + un wizard modal + un lien
> permanent dans Profil. D'où le nom sans « ÉCRAN ».

---

## 0. Sources et cadre

```text
Backlog     : BACKLOG_V1.md, section "Tutoriel & notifications".
Reclassement: GAPS_OUVERTS.md, entrée 30/07/2026 (3 chantiers prioritaires,
  ordre Bracket -> Tutoriel joueur -> badges permanents).
Distinct de : nba_pronos_decisions_0_2_10_prototype_jetable.md (mini-tuto
  outils du PROTOTYPE, pour l'utilisateur développeur — aucun rapport avec
  ce document, qui s'adresse au JOUEUR final).
Existant réutilisé : app/(app)/profile/page.tsx (onglets Compte/Ligues/
  Historique/Admin, ProfileTabs) ; migration #2
  (20260718100000_auth_join_code_and_profile.sql, handle_new_user) —
  confirme qu'il n'existe PAS de distinction "création de compte" /
  "première connexion" dans ce projet (accès immédiat après inscription,
  C4) ; migration RLS (20260718110000_rls.sql) — policy `users_update_self`
  (using id = auth.uid()) et trigger `enforce_users_invariants` (ne garde
  QUE role/status) confirment qu'une nouvelle colonne sur `users` est
  modifiable par le joueur lui-même sans fonction SECURITY DEFINER dédiée.
```

## 1. Déclenchement — **acté (30/07/2026, AskUserQuestion)**

```text
Proposition UNIQUE à la première connexion (= juste après l'inscription,
  puisque les deux sont confondues dans ce projet) : une bannière sur
  Accueil (app/(app)/page.tsx, même famille visuelle que le hero-banner
  déjà utilisé sur Profil) — "Découvrir comment jouer ?" avec deux boutons :
  - "Découvrir" -> ouvre le wizard (§2) à l'étape 1.
  - "Plus tard" -> ferme la bannière.
  Dans LES DEUX CAS le tutoriel est marqué vu (§4) — la bannière ne réapparaît
  jamais automatiquement après la première décision, même si le joueur ferme
  le wizard en cours de route sans le terminer (voir §2, sortie anticipée).

Ensuite, en permanence : un lien "Comment jouer ?" dans Profil > onglet
  Compte (à côté de Thème/Préférences/Rappels, page.tsx section existante),
  qui relance le MÊME wizard à la demande, peu importe l'état du flag.
```

## 2. Format — **acté (30/07/2026, AskUserQuestion)**

```text
Wizard modal pas-à-pas (composant client, "use client" — état d'étape en
  useState local, PAS dans l'URL : c'est un overlay ponctuel superposé à la
  page courante, jamais une page/route à part entière, donc rien à
  partager/bookmarker contrairement aux onglets `?tab=` du reste du site).

Navigation : "Suivant"/"Précédent" entre les 7 étapes (§3), "Passer"/croix de
  fermeture disponible à tout moment (sortie anticipée = tutoriel marqué vu
  quand même, §1). Dernière étape : bouton "Terminé" (ferme le wizard).

Un seul composant réutilisé pour les deux entrées (bannière Accueil et lien
  Profil) — aucune divergence de contenu selon l'entrée.
```

## 3. Contenu — **acté (30/07/2026), 7 étapes**

```text
Copie proposée ci-dessous — à ajuster librement en codant (contenu statique
  dans le composant, pas une donnée figée en base : un futur ajustement, ex.
  ajouter une 8ème étape "Badges permanents" quand ce chantier sera cadré,
  reste une simple modification du wizard, jamais une reprise en profondeur
  ni une migration — confirmé avec l'utilisateur, §9).
```

**Ajout du 30/07/2026 (après 1re version codée et testée par l'utilisateur)** :
chaque étape 3→7 (liées à un vrai écran) porte désormais une VRAIE capture
d'écran de l'interface réelle, sous `public/tutorial/` — décidé AVEC
l'utilisateur (AskUserQuestion) :
- Étapes 1 et 2 (conceptuelles, aucun écran précis) : texte seul, PAS de
  capture.
- Risque de péremption des captures accepté explicitement (la DA n'est pas
  stabilisée, ex. renommage Classement → « Hall of shame » reporté) — à
  refaire plus tard si l'interface change trop, pas bloquant maintenant.

1. **Bienvenue**
   > Pronostique les matchs NBA de la saison avec tes potes, compare vos
   > scores, et découvre qui est le vrai prophète du groupe.

2. **Le point clé : ça repart à zéro**
   > Chaque nouvelle compétition (Playoffs, NBA Cup...) remet les compteurs
   > à zéro : pronos, paris et classement recommencent à 0 point. Seuls ton
   > historique (superlatifs passés) et tes ligues d'amis restent d'une
   > compétition à l'autre.

3. **Matchs & paris**
   > Avant chaque match, pronostique le vainqueur et l'écart de points. Tu
   > peux aussi proposer un pari libre — sur ce match précis ou sur toute
   > une série.

4. **Mes pronos**
   > Retrouve tous tes pronostics et paris au même endroit, avec leur statut
   > (en attente, validé, gagné...).

5. **Bracket personnel**
   > Avant le début des Playoffs, remplis ton bracket complet : qui ira
   > jusqu'où, série par série.

6. **Classement & Ligues**
   > Compare ton score à tous les joueurs, ou filtre sur une ligue privée
   > entre amis (code à partager pour les faire rejoindre).

7. **Rappels**
   > On te prévient avant chaque deadline importante (match, bracket) pour
   > ne rien rater.

## 4. Mécanique technique — **acté (30/07/2026)**

```text
Nouvelle colonne : users.tutorial_seen_at timestamptz null default null.
  NULL = jamais proposé/vu. Non-NULL = déjà proposé (peu importe la décision
  Découvrir/Plus tard/fermeture anticipée) -> bannière Accueil ne s'affiche
  plus, seul le lien Profil reste.

Écriture : mise à jour directe via la policy users_update_self existante
  (auth.uid() = id), MÊME PATRON que updateThemePreference (lib/actions/
  profile.ts) — pas de fonction SQL SECURITY DEFINER nécessaire (trigger
  enforce_users_invariants ne restreint que role/status, §0).

Déclenchement de l'écriture : au premier des événements suivants -> clic
  "Découvrir", clic "Plus tard", fermeture de la bannière/du wizard sans
  clic explicite (le "X" compte comme "Plus tard"). PAS re-déclenché par le
  lien permanent Profil (déjà vu de toute façon, la colonne ne bouge plus
  ensuite).
```

## 5. Composants / fichiers prévus (à créer en codant)

```text
supabase/migrations/<timestamp>_tutorial_seen_at.sql — alter table users.
lib/actions/tutorial.ts — markTutorialSeen() (server action, update simple).
components/tutorial/TutorialWizard.tsx — "use client", les 7 étapes (§3),
  navigation Suivant/Précédent/Passer, appelle markTutorialSeen() à la
  fermeture (quelle qu'en soit la cause).
components/tutorial/TutorialBanner.tsx — composant serveur, rendu sur
  Accueil UNIQUEMENT si profile.tutorialSeenAt === null (lu via
  getProfileData ou équivalent), monte TutorialWizard au clic "Découvrir".
Lien "Comment jouer ?" ajouté directement dans app/(app)/profile/page.tsx
  (section "compte" existante), monte le même TutorialWizard.
```

## 6. Règles de rendu (T7 — non négociables, cf. autres écrans)

```text
- CSS Modules colocalisés, tokens de app/tokens.css exclusivement.
- Pas de valeur visuelle en dur (couleurs, tailles).
- Cohérence avec le hero-banner déjà utilisé (Profil) pour la bannière
  Accueil — pas un nouveau style de bandeau inventé.
```

## 7. États

```text
Aucune compétition active au moment du tutoriel : le contenu (§3) reste
  générique (aucune étape ne dépend de données réelles d'une compétition
  en cours) — pas d'état vide à gérer ici, contrairement aux écrans de
  données.
```

## 8. Hors périmètre de cette version

```text
- Badges permanents (3ème chantier du reclassement, non cadré) : PAS une
  étape du wizard actuel. Ajout futur = simple modification du contenu
  (§3), pas une reprise de la mécanique (§4/§5) — confirmé avec
  l'utilisateur.
- Vue admin, personnalisation, export : aucun rapport avec ce tutoriel,
  non mentionnés.
- Suivi analytique (ex. combien d'étapes vues avant abandon) : non demandé,
  non construit.
```

## 9. Récapitulatif des décisions actées (30/07/2026)

```text
A. Déclenchement (§1) : proposition unique à la 1re connexion (bannière
   Accueil) + lien permanent Profil > Compte.
B. Format (§2) : wizard modal pas-à-pas, état local (pas d'URL).
C. Contenu (§3) : 7 étapes, incluant EXPLICITEMENT les paris MATCH et
   SÉRIE dans l'étape 3 (ajout demandé après la 1re proposition). Copie
   ajustable librement plus tard (pas figée en base).
D. Extensibilité (badges, §8) : reportée sans bloquer ce chantier —
   confirmé que ce sera un ajustement léger du wizard le moment venu.
E. Mécanique (§4) : flag `tutorial_seen_at` sur `users`, écriture directe
   (pas de fonction SECURITY DEFINER), posé au premier événement de
   sortie (Découvrir/Plus tard/fermeture), pas seulement à la complétion
   des 7 étapes.
F. Captures d'écran (30/07/2026, après 1er test utilisateur) : vraies
   captures pour les étapes 3→7 uniquement (§3), risque de péremption
   (DA non stabilisée) accepté explicitement.
```
