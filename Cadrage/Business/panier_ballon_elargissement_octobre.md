# Panier Ballon — Élargissement octobre : SEO & créateurs

> Document créé en session Cowork le 15/09/2026, en complément de
> `panier_ballon_cadrage_business_communication.md` (voir l'addendum du 15/09/2026
> dans ce fichier, section 3). Discord n'est pas traité ici : la structure, les rôles
> et les messages sont déjà prêts dans le doc principal (§ "Discord — structure"),
> il n'y a qu'à l'activer. Ce document couvre les deux chantiers qui, eux, partent de
> zéro — SEO et créateurs/médias — écrit pour quelqu'un qui découvre ces deux sujets,
> donc volontairement pas-à-pas plutôt que synthétique.
>
> **Portée** : ce qui suit s'appuie sur une lecture du dépôt `nba-pronos` au
> 15/09/2026 (`app/layout.tsx`, `app/page.tsx`, `app/manifest.ts`, `proxy.ts`,
> `package.json`). Trois constats techniques en découlent directement, listés en
> 1.0 avant les étapes.

---

## 1. Référencement (SEO)

### 1.0 Trois constats avant de commencer

**Constat 1 — le mot « paris » est déjà en production.** `app/layout.tsx` (balise
`description`) et `app/manifest.ts` contiennent tous les deux : *« Pronostics et
paris entre amis sur les playoffs NBA. »* C'est exactement le mot que le cadrage
business déconseille en communication publique (point de vigilance ANJ, section 3
du doc principal) — et ce texte-là n'est pas un post Instagram qu'on peut corriger
après coup, c'est ce que Google indexe et ce qui s'affiche quand un lien Panier
Ballon est partagé (Instagram, SMS, Discord). À corriger en premier, avant toute
autre action SEO — c'est un correctif de code de deux lignes, pas un chantier.

**Constat 2 — il n'y a aujourd'hui aucune page publique à indexer.** `app/page.tsx`
(la route `/`) redirige inconditionnellement vers `/login`, quel que soit le
visiteur. Il n'existe pas de page d'accueil publique — seulement des écrans
d'authentification (`/login`, `/signup`...). Le commentaire dans `layout.tsx` le
dit explicitement : *« Référencement Google volontairement PAS traité ici (app en
alpha fermée sur invitation, rien à indexer d'utile pour l'instant) »*. C'était
vrai pour l'alpha de septembre. Ça ne l'est plus à partir du moment où on élargit
le recrutement en octobre (P1/P2 de l'addendum) — d'où ce chantier maintenant.
**C'est le préalable technique qui conditionne tout le reste de cette partie** :
tant qu'il n'y a pas de page publique, il n'y a rien à optimiser ni à soumettre à
Google. Détail en 1.1.

**Constat 3 — plusieurs pages sont déjà publiques sans qu'on le sache forcément.**
`proxy.ts` ne bloque que trois zones : `/home`, `/play`, `/profile` (zone app) et
`/admin`. Tout le reste répond sans connexion — en particulier `/cgu`,
`/mentions-legales`, `/confidentialite`, `/regles`, mais aussi `/bracket`,
`/leaderboard` et `/players`. Les pages légales sont normalement conçues pour être
publiques, rien à vérifier. Pour `/bracket`, `/leaderboard`, `/players` en
revanche — **à vérifier avant d'en faire quoi que ce soit publiquement** : est-ce
qu'elles affichent un état correct sans utilisateur connecté (une démo, un
classement public) ou une page cassée/vide qui suppose une session ? Si elles
rendent correctement, ce sont des pages de démonstration toutes faites, sans
travail de conception — exactement le genre de lien "montre plutôt que raconte"
à mettre en bio Instagram ou dans les posts créateurs (partie 2).

### 1.1 Étape 0 (bloquante) — une vraie page publique

Sans ça, rien d'autre dans cette partie n'a d'effet : Google ne peut indexer une
redirection vers un écran de connexion. Deux options, du plus rapide au plus
soigné :

- **Minimum viable** : remplacer la redirection de `app/page.tsx` par une vraie
  page — même simple — qui explique le concept en une phrase, montre un visuel
  (capture d'écran ou le lien vers `/bracket` si le constat 3 le confirme
  exploitable), et pointe vers `/signup`. Metadata propre (voir 1.2), pas besoin
  de plus pour démarrer.
- **Version soignée** : la même chose, mais avec le gabarit visuel déjà utilisé
  pour les visuels Instagram (`Cadrage/DA/instagram/SPEC_VISUELS_INSTAGRAM.md` —
  navy, bandeau orange), pour que le premier contact avec le site ait la même
  identité que le reste de la communication.

Le choix entre les deux n'a pas besoin d'être tranché tout de suite — le minimum
viable débloque déjà tout le reste de cette partie, la version soignée peut suivre
sans urgence.

### 1.2 Étape 1 — corriger le vocabulaire dans le code

Deux fichiers, remplacement simple du texte descriptif (garder le titre
`"Panier Ballon"` tel quel — c'est le nom, il n'est pas concerné) :

```ts
// app/layout.tsx — remplacer partout où ça apparaît (description, openGraph,
// twitter) :
"Pronostics et paris entre amis sur les playoffs NBA."
// par, par exemple :
"Ta ligue de pronostics NBA entre potes, playoffs après playoffs."
// ou, plus proche du champ lexical déjà validé en section 3 du cadrage
// ("pool entre amis") :
"Le pool de pronostics NBA à faire tourner avec ta bande."
```

```ts
// app/manifest.ts — même remplacement dans `description`.
```

En profiter pour ajouter, si ce n'est pas déjà envisagé ailleurs, la précision
« aucun argent réel, uniquement des points » quelque part sur la future page
publique (pas nécessairement dans la meta description elle-même, qui doit rester
courte) — cohérent avec la checklist « jour du lancement » du cadrage qui demande
déjà ce rappel visible en bio Instagram.

### 1.3 Étape 2 — les bases techniques Next.js

Le dépôt n'a ni `sitemap.ts` ni `robots.ts` à la racine de `app/` (vérifié le
15/09/2026). Next.js 16 (version utilisée ici, cf. `package.json`) les gère nativement
en App Router, sur le même principe que `app/manifest.ts` déjà en place — donc rien
de nouveau à apprendre, le fichier existant sert de modèle :

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://panierballon.fr", lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: "https://panierballon.fr/regles", lastModified: new Date(), changeFrequency: "yearly", priority: 0.5 },
    { url: "https://panierballon.fr/cgu", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: "https://panierballon.fr/confidentialite", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
```

```ts
// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/home", "/play", "/profile", "/admin"] },
    ],
    sitemap: "https://panierballon.fr/sitemap.xml",
  };
}
```

Le `disallow` reprend simplement les zones déjà protégées par `proxy.ts` (constat 3)
— pas la peine de faire indexer des pages qui redirigeront de toute façon vers
`/login` pour un visiteur non connecté.

**Données structurées (optionnel, à faire une fois la page publique en place)** —
un bloc JSON-LD `SoftwareApplication` dans `app/layout.tsx` ou la page publique
elle-même aide Google à afficher un résultat enrichi (icône, catégorie) :

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Panier Ballon",
  "applicationCategory": "SportsApplication",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" }
}
</script>
```

### 1.4 Étape 3 — Google Search Console, pas à pas

Gratuit, c'est l'outil qui dit à Google que le site existe et permet de voir ce qui
remonte. Première fois, ça prend 15-20 minutes :

1. Aller sur **search.google.com/search-console** et se connecter avec un compte
   Google (utiliser une adresse que tu gardes sur le long terme, pas un compte
   jetable — c'est un compte qui va suivre le site pendant des mois).
2. Choisir **« Domaine »** (pas « Préfixe d'URL ») pour `panierballon.fr` — ça
   couvre `www.` et le HTTPS automatiquement, plus robuste sur la durée.
3. Google demande une vérification par **enregistrement DNS TXT**. Comme le domaine
   est piloté depuis Vercel (`vercel.json` confirme le déploiement, cadrage confirme
   `panierballon.fr` pointé dessus), la vérification se fait dans les paramètres DNS
   du domaine sur **Vercel → Project → Settings → Domains** : copier la valeur TXT
   donnée par Search Console, l'ajouter comme enregistrement DNS côté Vercel, puis
   cliquer « Vérifier » sur Search Console (peut prendre jusqu'à quelques heures à
   se propager, généralement quelques minutes).
4. Une fois vérifié, aller dans **Sitemaps** (menu de gauche) et soumettre
   `sitemap.xml` (une fois l'étape 1.3 faite et déployée).
5. Rien d'autre à faire tout de suite — revenir une fois par semaine consulter
   **Performances** (impressions, clics, requêtes qui amènent déjà du monde) et
   **Couverture** (pages indexées vs pages en erreur).

### 1.5 Étape 4 — les mots-clés à viser, et où les placer

Le marché des pronos "entre amis" est saturé côté foot (Mon Petit Prono, Zikof,
Scorecast, WeCanPronos, Genius, BeTeam...) — aucun de ces acteurs ne cible la NBA.
La concurrence sur ces requêtes est donc quasi nulle, ce qui compense largement un
volume de recherche plus faible que côté foot :

| Requête | Où la placer |
|---|---|
| pronostics NBA entre amis | Titre H1 de la page publique, meta description |
| pool NBA entre potes | Sous-titre / accroche de la page publique |
| bracket playoffs NBA gratuit | Section dédiée au bracket sur la page publique |
| application pronostics NBA gratuite | Meta title de la page `/signup` |
| jeu de pronos NBA gratuit français | Corps de texte de la page publique |
| classement pronos NBA entre potes | Texte autour de `/leaderboard` si publique (constat 3) |

Une seule page suffit pour commencer (la nouvelle page publique de l'étape 0) — pas
besoin de créer une page par mot-clé. L'important est que ces formulations
apparaissent une fois chacune dans le texte visible, pas seulement dans les
métadonnées invisibles.

### 1.6 Étape 5 — backlinks gratuits (à partir de mi-octobre, une fois la page publique en ligne)

Deux comparatifs français de sites de pronos entre amis existent déjà et ne
mentionnent aucun acteur NBA — un simple email de présentation à leurs auteurs a
de bonnes chances d'aboutir à une mention :

- **pronor.fr** — comparatif « meilleure application pronostic foot »
- **zikof.com** — comparatif « 8 meilleures apps de pronostic Coupe du Monde
  2026 » (liste Mon Petit Prono, Ma Grosse Pelouse, Zikof, PronoVerse, Poulpage,
  31juin, Scorecast, WeCanPronos — aucun acteur NBA)

Modèle de message (court, factuel, pas de relance agressive si pas de réponse) :

```
Objet : Un site de pronos NBA à ajouter à votre comparatif ?

Bonjour,

Je vous écris au sujet de votre article [titre exact de l'article]. Aucun des
sites listés ne couvre la NBA — je développe Panier Ballon, un jeu de
pronostics NBA entre amis (aucun argent réel, uniquement des points), en bêta
ouverte depuis octobre : panierballon.fr

Si ça a sa place dans une future mise à jour de l'article, je suis preneur.
Sinon, merci pour le travail déjà fait sur le comparatif, il est utile tel quel.

[prénom]
```

Un mail de ce type prend cinq minutes et ne compte pas dans le budget de contact
créateurs (partie 2) — les deux peuvent avancer en parallèle.

### 1.7 Suivi

Pas besoin d'outil payant à ce stade : **Google Search Console** (impressions,
clics, position moyenne par requête) et un tableur à la main suffisent. Une ligne
par semaine : impressions, clics, nombre de backlinks obtenus, RAS sinon.

---

## 2. Créateurs & médias NBA France

### 2.0 Le principe, déjà acté dans le cadrage

Le cadrage business est clair là-dessus, et ça vaut la peine de le redire en tête
de cette partie parce que c'est la partie la plus facile à mal faire en étant
novice : **jamais de pitch en premier message**. Un message d'approche à froid, ça
se repère immédiatement et ça grille le contact pour de bon. L'ordre à respecter :
participation authentique d'abord (commenter, réagir, apporter une vraie remarque
sur leur contenu), présentation du projet ensuite — seulement une fois identifié
comme quelqu'un de légitime dans la communauté, pas comme un compte qui débarque
pour vendre quelque chose.

### 2.1 Qui contacter, et dans quel ordre

Le cadrage a déjà identifié les bonnes cibles françaises — remises ici dans un
ordre de difficulté croissante, pour progresser par paliers plutôt que de viser
trop haut trop vite :

1. **Groupes Facebook NBA francophones actifs** — « PRONOSTICS NBA 🏀 Pro du
   basket » et « Débats et Pronostics NBA (D&PNBA) », déjà identifiés dans le
   cadrage. Le plus accessible : ce sont des membres, pas des comptes à convaincre.
2. **Micro-créateurs streetball/freestyle** — scène Quai 54, Brisco Basket
   Freestyle : audience plus petite mais bien plus accessible qu'un gros compte
   généraliste, et déjà identifiés comme piste dans le cadrage.
3. **BasketSession** — média basket FR de taille intermédiaire, terrain plus
   favorable à un premier contact qu'un acteur beaucoup plus gros.
4. **TrashTalk** — le média NBA de référence en France (site, YouTube, podcast).
   Objectif réaliste : une mention éditoriale, pas un partenariat — à tenter en
   dernier, une fois les trois premiers paliers déjà pratiqués.

### 2.2 Le processus, étape par étape, pour chaque contact

1. **Repérer** 2-3 posts ou vidéos récents de la cible (Facebook, Instagram,
   YouTube selon le cas) — noter un détail précis à mentionner plus tard, jamais
   un message générique.
2. **Participer d'abord**, sur au moins deux occasions différentes séparées de
   quelques jours — un vrai commentaire qui ajoute quelque chose (pas juste "top
   post"), ou dans le cas d'un groupe Facebook, une vraie contribution au débat en
   cours.
3. **Attendre** que ce soit naturel — pas de calendrier fixe, mais viser au moins
   une semaine entre la première interaction et la présentation du projet.
4. **Présenter**, avec le message-type adapté ci-dessous (2.3) — toujours
   personnalisé avec le détail repéré à l'étape 1.
5. **Ne jamais relancer plus d'une fois** si pas de réponse — une relance
   courte après 2-3 semaines maximum, puis on passe à la cible suivante.

### 2.3 Messages-types — version octobre (bêta), pas la version avril du cadrage

**Point d'attention** : le cadrage contient déjà un message-type pour TrashTalk et
les forums, mais écrit pour un contact « à partir de février », en langage
pré-lancement (*« Je lance en avril Panier Ballon »*). Utilisé tel quel en octobre,
il annoncerait un lancement qui n'a pas lieu avant six mois — à adapter en langage
bêta. Le message pour les groupes Facebook, en revanche, est déjà écrit pour
octobre (*« La bêta ouvre en octobre si ça intéresse quelqu'un »*) — celui-là peut
être repris tel quel du cadrage, pas besoin de le réécrire ici.

**Version adaptée — micro-créateurs / BasketSession / TrashTalk, contact octobre :**

```
Objet : Une appli de pronos NBA entre potes, en bêta ouverte

Bonjour [prénom],

[Une phrase liée à un contenu précis d'eux — jamais un message générique.]

Je développe Panier Ballon, une appli pour organiser une ligue de pronostics
NBA entre amis : bracket, pronostics match par match, et des paris perso en
langage libre ("Jokic fait un triple-double") validés automatiquement par un
moteur qui vérifie les vraies stats du match. Aucun argent réel — uniquement
des points.

La bêta est ouverte depuis octobre, sur la vraie NBA Cup. Si ça peut
intéresser votre communauté, je serais content de vous faire tester en
priorité — sans obligation, juste pour avoir votre avis.

[lien]
```

Différence avec la version février du cadrage : « bêta ouverte sur la vraie NBA
Cup » plutôt que « je lance en avril » — cohérent avec où en est vraiment le
projet au moment du contact. La version février du cadrage reste valable telle
quelle pour une éventuelle relance de confirmation en mars, plus proche du vrai
lancement.

### 2.4 Suivi

Un tableur à quatre colonnes suffit : **Cible** · **Date du premier contact
préparatoire (commentaire, etc.)** · **Date du message envoyé** · **Statut**
(pas de réponse / réponse positive / réponse négative / mention obtenue). Revue
hebdomadaire, dix minutes suffisent.

---

## 3. Discord — juste à exécuter

Pas de conception à faire ici, tout est déjà rédigé dans le doc principal
(§ « Discord — structure ») : structure des salons, rôles, description du
serveur, message d'accueil, règles. La seule chose à faire :

- [ ] Créer le serveur Discord avec la structure déjà rédigée
- [ ] Ouvrir en priorité aux testeurs de l'alpha/bêta déjà actifs (catégorie
      BÊTA déjà prévue : `#liste-attente`, `#bugs-et-retours`, `#idées`)
- [ ] Ajouter le lien d'invitation en bio Instagram une fois quelques membres dedans
      (un serveur vide décourage plus qu'il n'attire)

---

## 4. Calendrier combiné — octobre

S'insère dans la Phase 1 déjà définie dans le cadrage (« Élargissement bêta »,
oct.–nov. 2026), sans la modifier :

| Semaine | SEO | Créateurs | Discord |
|---|---|---|---|
| S1 (1-7 oct.) | Corriger le mot « paris » (1.2) · page publique minimale (1.1) | Repérage des cibles, début des interactions authentiques (2.2 étape 1-2) | Créer le serveur |
| S2 (8-14 oct.) | `sitemap.ts` / `robots.ts` (1.3) · Search Console (1.4) | Poursuite des interactions | Ouvrir aux testeurs actifs |
| S3 (15-21 oct.) | Premiers mails comparatifs (1.6) | Premiers messages de présentation (2.3) | Lien en bio Instagram |
| S4 (22-31 oct.) | Suivi Search Console, premiers ajustements | Suivi des réponses, relances si besoin | Suivi de l'activité |

---

## 5. Objectifs indicatifs — à ajouter au tableau du cadrage

| Indicateur | Repère fin octobre |
|---|---|
| Page publique en ligne | Oui/Non |
| Occurrences de « paris » corrigées | 0 restantes |
| Sitemap soumis à Search Console | Oui/Non |
| Backlinks obtenus (comparatifs) | 1-2 |
| Créateurs contactés | 3-5 |
| Réponses positives | 1+ |
| Membres Discord | 15-30 (aligné sur la cible bêta du cadrage) |

Repères de départ, pas des promesses — comme pour le reste du cadrage, à
recalibrer avec les vraies données d'octobre.

---

## Prochaines actions

- [ ] Corriger « paris » → « pronostics »/« pool » dans `app/layout.tsx` et `app/manifest.ts`
- [ ] Vérifier si `/bracket`, `/leaderboard`, `/players` rendent correctement sans session (constat 3)
- [ ] Construire la page publique minimale à `/` (étape 1.1)
- [ ] Ajouter `app/sitemap.ts` et `app/robots.ts`
- [ ] Créer le compte Google Search Console, vérifier le domaine, soumettre le sitemap
- [ ] Lister 5 créateurs/groupes à contacter en octobre, dans l'ordre de la section 2.1
- [ ] Créer le serveur Discord à partir de la structure déjà rédigée dans le cadrage
- [ ] Envoyer les deux premiers mails de comparatif (pronor.fr, zikof.com)

---

*Document à réviser après les premiers retours d'octobre — notamment le choix
entre page publique minimale et version soignée (1.1), et la réponse au constat 3
sur `/bracket` / `/leaderboard` / `/players`.*
