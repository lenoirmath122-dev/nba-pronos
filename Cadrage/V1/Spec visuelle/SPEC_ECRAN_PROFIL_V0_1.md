# NBA Pronos — SPEC ÉCRAN PROFIL V0.1

> **Statut : VALIDÉ (27/07/2026).** Aucune spec détaillée n'existait pour cet
> écran avant cette session (seulement quelques lignes dans
> `nba_pronos_decisions_0_2_9_ux_ui.md` §3/§15 et l'arbre T6a — « profil
> joueur, préférences, accès admin si ADMIN »). Rédigée en séance, close après
> confirmation des 3 points du §13 (AskUserQuestion, même session).
> Implémentation autorisée sous réserve du pré-vol §12.
>
> 4ème onglet de la nav (Accueil / Jouer / Classement / Profil), remplace le
> stub actuel (`app/(app)/profile/page.tsx`, « Profil — à venir »). Porte
> aussi la vraie déconnexion (remplace le bouton temporaire de
> `app/(app)/layout.tsx`, GAPS_OUVERTS.md) et le mécanisme du thème
> clair/sombre (câblage explicitement laissé en attente par
> `app/tokens.css` : « la bascule (toggle + persistance) est un lot séparé »).

---

## 0. Sources et cadre

```text
Décisions   : nba_pronos_decisions_0_2_9_ux_ui.md §3 (« Profil : profil
  joueur, préférences, accès admin si rôle ADMIN ») — aucun autre détail
  fonctionnel acté ailleurs.
Données     : SPEC_TECHNIQUE_MODELE_DONNEES_V0.1.md §3.2 (table `users`) —
  pseudo, avatar_url, favorite_team_id, bio, role, status, theme_preference.
RLS         : SPEC_TECHNIQUE_RLS_V0.1.md — `users` lisible par tout le monde
  (aucune colonne secrète depuis le retrait de l'email, D5) ; UPDATE self
  autorisé (`id = auth.uid()`) ; trigger T-a (BEFORE UPDATE on users)
  empêche déjà un non-admin de modifier `role`/`status` (anti-escalade,
  garde-fou EN BASE, indépendant de ce que ce lot envoie).
Architecture: SPEC_TECHNIQUE_ARCHITECTURE_NEXT_V0_1_a.md — `app/(app)/
  profile/page.tsx` (arbre déjà prévu, stub codé le 22/07/2026).
Design      : app/tokens.css — DARK par défaut sur :root, override
  `[data-theme="light"]` déjà écrit et complet côté valeurs ; seul le
  câblage (lecture/écriture/application) manque, explicitement signalé
  comme un lot à part dans le fichier lui-même.
```

## 1. Architecture

```text
Route (T6a, groupe (app), gardée par proxy.ts) : /profile — remplace le
  stub existant.

Le thème touche un fichier PARTAGÉ hors des route groups : app/layout.tsx
  (racine, <html>/<body>) — s'applique à TOUT le site, visiteur non connecté
  inclus (/login, /signup, /leaderboard, /bracket). Seul changement
  structurel de ce lot qui déborde de /profile lui-même.

Composants serveur par défaut. Trois formulaires natifs indépendants (pas un
  seul gros formulaire) :
  - toggle thème (soumission immédiate, un seul clic) ;
  - préférences (équipe favorite + bio, bouton « Enregistrer ») ;
  - déconnexion (déjà existant, `logout()`, juste déplacé/restylé ici).
  Chacun suit le patron déjà établi ailleurs (ex. CorrectionRequestForm, Mes
  pronos) : `<form action={...}>` natif, pas de useActionState nécessaire
  (pas de message d'erreur à afficher inline pour ces 3 gestes).
```

## 2. Contenu affiché — lecture seule

```text
- Pseudo : affiché mais JAMAIS modifiable depuis cet écran (voir §3, décision
  actée §13).
- Rôle : badge « Admin » affiché UNIQUEMENT si role = 'ADMIN' — un joueur
  normal ne voit rien de particulier (role = PLAYER partout, aucune info
  utile à afficher).
- Statut (ACTIVE/DISABLED) : PAS affiché — aucune spec ne le demande, aucun
  autre écran ne l'affiche côté joueur, et le désactiver reste une action
  admin hors périmètre de cet écran (voir §11).
```

## 3. Champs modifiables — **acté (27/07/2026, §13)**

```text
- Pseudo : NON modifiable. Identité PUBLIQUE affichée nominativement sur
  Classement/Bracket/Mes pronos/Nouveau pari/Bracket personnel — un
  changement rétroactif poserait la question de l'historique déjà affiché
  ailleurs, jamais traitée par aucune spec. Lecture seule ici ; à rouvrir
  explicitement si le besoin se confirme un jour (GAPS_OUVERTS.md).
- Avatar (avatar_url) : HORS PÉRIMÈTRE de ce lot. Le projet n'a jamais
  utilisé Supabase Storage — l'introduire (bucket + policies dédiées)
  seulement pour ce champ n'est pas justifié maintenant. Colonne laissée
  vide, comme aujourd'hui.
- Équipe favorite (favorite_team_id) : modifiable — sélecteur d'équipe avec
  logo (réutilise `components/ui/TeamLogo.tsx` + le patron liste de boutons
  `role="radio"` déjà utilisé par les sélecteurs de `BetForm.tsx`, puisqu'un
  `<select>` natif ne peut pas afficher de logo, piège déjà rencontré §2.15
  `ETAT_ACTUEL.md`). Purement cosmétique : AUCUN autre écran du projet ne lit
  ni n'affiche ce champ aujourd'hui — stocké, pas propagé ailleurs (hors
  périmètre, §11).
- Bio (bio) : modifiable — champ texte libre, facultatif, aucune limite de
  longueur imposée par le schéma (colonne `text`). Même remarque : non
  affiché ailleurs dans l'app aujourd'hui.
- Thème (theme_preference) : modifiable — voir §4.
```

## 4. Thème clair/sombre — mécanisme technique — **acté (27/07/2026, §13)**

```text
Lecture (SSR, app/layout.tsx) :
  - Session active → lire users.theme_preference pour ce user_id.
  - Pas de session (visiteur) → défaut 'DARK' (= défaut colonne, cohérent
    avec le CSS déjà écrit qui a le dark sur :root sans condition).
  - <html data-theme={theme === 'LIGHT' ? 'light' : undefined}> — un seul
    attribut, posé côté serveur, AUCUN flash de mauvais thème au chargement
    (pas de bascule client après hydratation).

Écriture : server action dédiée (updateThemePreference), formulaire À PART
  du reste des préférences (§1) — un seul bouton, soumission immédiate, pas
  de geste "Enregistrer" séparé (attente UX normale d'un toggle de thème).
  Après écriture : redirect("/profile") — pattern déjà utilisé PARTOUT dans
  ce projet (login/signup/logout, GAPS_OUVERTS.md n'en dévie jamais) plutôt
  que d'introduire router.refresh() comme un nouveau mécanisme pour ce seul
  cas. La redirection re-traverse app/layout.tsx, qui relit la préférence
  fraîche — bascule effective dès la page suivante, sans JS supplémentaire.

Portée : contrairement aux 3 autres champs (§3), ce changement s'applique à
  TOUT le site (routes publiques comprises) puisque app/layout.tsx est
  au-dessus des deux route groups (public)/(app). Un visiteur non connecté
  ne peut PAS changer de thème (pas de compte, pas de colonne à écrire) —
  reste en DARK par défaut, aucun sélecteur affiché hors session (cohérent
  avec le reste : PublicNav n'a jamais porté ce genre de réglage).
```

## 5. Déconnexion

```text
Reprend `logout()` (lib/auth/actions.ts, inchangé — déjà testé de bout en
  bout §2.9 ETAT_ACTUEL.md) dans un bouton correctement stylé aux tokens T7.
Le bouton TEMPORAIRE de app/(app)/layout.tsx (coin haut-droit, bordure
  pointillée) est RETIRÉ dans ce lot — c'était sa seule raison d'exister
  (GAPS_OUVERTS.md : « à retirer dès que l'écran Profil reprend cette action
  pour de bon »). Ne touche que la zone (app) — /leaderboard et /bracket
  (ScreenShell) n'ont jamais porté ce bouton, rien à changer là.
```

## 6. Lien Admin — conditionnel

```text
Visible UNIQUEMENT si role = 'ADMIN' (is_admin(), déjà utilisé ailleurs,
  jamais un claim JWT — cohérent avec T3 §RLS, promotion effective sans
  re-login).
/admin n'existe pas encore (lot futur, "écrans admin"). MÊME PATRON que le
  hub Jouer temporaire (ETAT_ACTUEL.md §2.10) : entrée INERTE (pas de
  <Link>), libellé « Admin — à venir », plutôt qu'un lien mort vers une
  route 404. À activer quand le lot admin existera — aucune trace
  "temporaire" à retirer cette fois, puisque ce sera un simple <Link> ajouté
  au même endroit, pas un contournement à démonter.
```

## 7. Écriture — server actions

```text
updateThemePreference(theme: 'LIGHT' | 'DARK') :
  UPDATE users SET theme_preference = $1 WHERE id = auth.uid() — colonne
  UNIQUE envoyée, jamais un objet plus large (défense en profondeur : même
  si le trigger T-a empêche déjà toute escalade sur role/status, l'action
  ne doit construire QUE la colonne concernée, jamais spreader tout un
  FormData). redirect("/profile") après écriture (§4).

updateProfile(favoriteTeamId: string | null, bio: string) :
  UPDATE users SET favorite_team_id = $1, bio = $2 WHERE id = auth.uid().
  bio vide → NULL (pas une chaîne vide stockée). favoriteTeamId : liste des
  30 équipes globales (table `teams`, déjà seedée, référentiel stable D6) —
  aucune vérification d'appartenance à une compétition, ce champ est
  intemporel. redirect("/profile") après écriture (même pattern, cohérence).

Aucune migration nécessaire : RLS self-update + trigger T-a (anti-escalade
  role/status) déjà en place (migration #3), suffisants pour les 2 actions
  ci-dessus — à revérifier au pré-vol (§12) que rien n'a changé depuis.
```

## 8. États vides / cas limites

```text
Aucune équipe favorite choisie   : affichage neutre, pas d'erreur ("Aucune
                                   équipe favorite" ou équivalent discret).
Bio vide                        : champ simplement vide, pas de placeholder
                                   trompeur ("Aucune bio pour l'instant"
                                   acceptable en lecture, jamais en édition).
Rôle PLAYER (cas normal)        : ni badge Admin ni entrée Admin — écran
                                   minimal, seulement pseudo + préférences +
                                   déconnexion.
```

## 9. Contrats de types (esquisse, à figer en codant)

```ts
export type ProfileData = {
  pseudo: string;
  isAdmin: boolean;
  favoriteTeamId: string | null;
  bio: string;
  theme: "LIGHT" | "DARK";
};

export type TeamOption = {
  teamId: string;
  abbreviation: string;
  name: string;
};
```

## 10. Règles de rendu (T7 — non négociables)

```text
- CSS Modules colocalisés lisant EXCLUSIVEMENT les tokens de app/tokens.css.
- Composants serveur par défaut ; les 3 formulaires natifs (§1) n'ont besoin
  d'AUCUN "use client" (pas d'état local à maintenir entre les frappes,
  contrairement à BetForm qui gère un mode/scope dynamique) — à vérifier en
  codant si le sélecteur d'équipe (liste de boutons radio) peut rester lui
  aussi sans "use client" propre (soumission par simple submit de formulaire,
  pas de prévisualisation live requise par cette spec).
- Logos de franchise via components/ui/TeamLogo.tsx (déjà partagé).
- Aucune valeur visuelle en dur.
```

## 11. Hors périmètre de cet écran

```text
- Avatar (upload/URL) : voir §3 — reporté, pas de Supabase Storage introduit.
- Modification du pseudo : voir §3 — reporté, identité publique figée.
- Affichage de favorite_team_id/bio ailleurs dans l'app (Classement, Mes
  pronos, etc.) : pas demandé, pas fait — champs purement cosmétiques pour
  l'instant.
- Écran admin (lien §6) : lot futur distinct, non traité ici.
- Désactivation de compte (status), changement d'email, changement de mot de
  passe : aucune spec ne les demande pour ce lot ; le compte reste géré
  uniquement via Supabase Auth directement (dashboard/API Admin) comme
  aujourd'hui.
```

## 12. Vérifications de dépôt — à lever **avant** la 1re ligne de code

```text
1. RLS self-update sur `users` (migration #3) : confirmer que la policy
   couvre bien favorite_team_id/bio/theme_preference (colonnes ajoutées
   après coup par 0.2.9 — vérifier qu'aucune n'a été oubliée d'une policy
   trop restrictive écrite avant leur ajout au schéma).
2. Trigger T-a (anti-escalade role/status) : confirmer qu'il ne bloque PAS
   accidentellement les 3 colonnes de ce lot (il ne devrait cibler QUE
   role/status, à relire dans le fichier de migration réel, pas supposer).
3. Existence réelle de `app/(app)/profile/page.tsx` (stub actuel) et de
   `app/(app)/layout.tsx` (bouton de déconnexion temporaire à retirer,
   emplacement exact à relire avant de le supprimer).
4. `is_admin()` (migration #3) : confirmer réutilisable tel quel pour le
   badge/lien conditionnel (§2/§6) — pas une nouvelle implémentation.
5. Table `teams` : confirmer les 30 lignes seedées et stables (référentiel
   global D6, déjà utilisé par TeamLogo/BetForm) pour le sélecteur d'équipe
   favorite.
```

## 13. Récapitulatif des décisions actées (27/07/2026)

```text
A. Pseudo : NON modifiable depuis Profil (identité publique déjà affichée
   ailleurs, changement rétroactif jamais traité par aucune spec).
B. Avatar : HORS PÉRIMÈTRE de ce lot (pas de Supabase Storage introduit).
C. Thème clair/sombre : INCLUS dans ce lot — toggle simple, mécanisme SSR
   via app/layout.tsx + [data-theme], redirect("/profile") pour refléter
   immédiatement (pas de router.refresh()).
D. Lien Admin (§6) : entrée INERTE « à venir » tant que /admin n'existe pas
   (même patron que le hub Jouer temporaire), pas un lien mort.
```
