# Avis "expert" — aspect, fonctionnalités, fluidité (16/08/2026)

> Nature : avis qualitatif et subjectif, demandé explicitement par
> l'utilisateur après l'audit technique du même jour (« qu'un expert, joué
> par Claude, me donne son avis » sur l'aspect/les fonctionnalités/la
> fluidité par rapport aux autres applis du genre). Document de discussion,
> à reprendre et challenger ensemble à la prochaine session — pas un
> constat figé comme `AUDIT_UX_16_08_2026.md` (bugs/code, déjà corrigé pour
> ce qui l'était). Rédigé en jouant le rôle de quelqu'un qui suit ce type
> d'appli (bracket/pronostics entre potes), à partir de captures d'écran
> réelles (voir l'audit du même jour) et d'une recherche sur 3 concurrents
> directs : [HoopCall](https://hoopcall.app/), [Scorecast](https://www.scorecast.fr/en/classique),
> [ParidAmis](https://www.paridamis.fr/).

## Aspect

**Point fort net.** Le thème photo/verre (fresque streetball, terrain vu du
dessus, terrain à Hong Kong) donne une vraie identité visuelle — les 3
concurrents directs ont une UI d'appli-template générique, voire assumée
comme un remplaçant de tableur (Matchguess se présente littéralement comme
ça). Fond sombre + accent orange + logos d'équipe = rendu qui ne fait pas
amateur.

Bémol réel : le **Bracket est une pile de panneaux empilés par tour, pas un
arbre visuel connecté**. Pour une appli où le bracket est un pilier, c'est
justement l'écran où on attend du spectaculaire (l'effet ESPN, les lignes
qui relient les tours) — ici c'est lisible mais plat. C'est la plus grosse
dissonance entre "l'appli a du style" et "cet écran précis ne le montre
pas".

Le système de badges (carte qui se retourne au clic, couleurs par palier)
est un niveau de polish qu'aucun des 3 concurrents n'a.

## Fonctionnalités

**Plus complet que les 3 concurrents directs regardés, objectivement.**
Aucun des trois ne combine bracket + pronostics match + paris perso +
badges à ce niveau de profondeur — HoopCall n'a pas de bracket du tout,
Scorecast/ParidAmis non plus. Le détail du classement par catégorie
(Matchs/Bracket/Paris/Forme) est aussi plus fin que ce qu'ils proposent.

Ce qui manque, et qui existe chez eux :
- **Chat intégré** (Scorecast) — pour une appli "entre potes", le
  chambrage est souvent le vrai moteur d'engagement ; ici tout renvoie
  forcément vers un canal externe (WhatsApp, Discord...).
- **Mécanique hebdomadaire récurrente** (le duel de HoopCall, chaque
  lundi) — la boucle d'engagement actuelle de nba-pronos, c'est "je
  regarde le classement de temps en temps", sans rendez-vous fixe qui
  ramène les gens chaque semaine. Risque de s'essouffler en milieu de
  saison.
- **"Booster"/multiplicateur ponctuel** (ParidAmis) — mécanique peu
  coûteuse à construire qui ajoute du piment sans complexité structurelle.

## Fluidité

Le plus mitigé des 3 axes — du très bon et du concret à corriger.

Du très bon : déplacer la création de pari directement dans Matchs/Bracket
plutôt qu'un écran séparé (fait le 15/08) est exactement le genre de
simplification que font les meilleures applis — intention et contexte
restent ensemble. Le repli des options indisponibles sur Nouveau pari va
dans le même sens.

Ce qui abîme la fluidité en ce moment :
- **L'inscription était cassée en silence** jusqu'à cet audit (email déjà
  pris → aucun message, juste un renvoi confus vers `/login`). C'est le
  tout premier contact avec l'appli — ça compte double. *(Corrigé et
  poussé le 16/08, `1f4847a` — mentionné ici pour mémoire, plus un
  problème ouvert.)*
- **Le bug de bracket figé** trouvé par la revue de code (une carte reste
  bloquée "En cours" avec un score qui ne bouge plus si la série se
  termine pendant que la page est ouverte) touche exactement la
  fonctionnalité que HoopCall met en avant comme argument de vente ("live
  score updates"). Si un joueur le voit un jour, ça entame la confiance
  dans le direct. *(Pas encore corrigé, voir `GAPS_OUVERTS.md`.)*
- Le quota email encore non tranché (bac-à-sable Resend vs service
  intégré Supabase) est un risque de fluidité au prochain lancement, pas
  juste un détail technique.

## Verdict

Sur la profondeur fonctionnelle et la personnalité visuelle, nba-pronos est
devant les 3 concurrents gratuits directs regardés. Côté finition/
robustesse, ça se lit encore comme un projet perso très soigné plutôt
qu'une appli prête à onboarder 50 potes sans accroc — normal au stade
actuel, mais utile de le nommer clairement plutôt que de le découvrir en
conditions réelles.

## À discuter à la prochaine session

Rien de tranché ci-dessous, pistes ouvertes seulement :

1. **Bracket en arbre visuel connecté** (plutôt que la pile de panneaux
   actuelle) — vaut-il le chantier visuel, sachant que c'est probablement
   le plus gros écart d'"effet waouh" avec ESPN/les grosses applis de
   bracket ?
2. **Mécanique récurrente légère** — un duel hebdomadaire (à la HoopCall)
   ou des boosters ponctuels (à la ParidAmis) : lequel des deux (si l'un
   des deux) apporterait le plus par rapport à l'effort de cadrage/code ?
3. **Chat/couche sociale in-app** — vraiment utile, ou est-ce que le canal
   externe (WhatsApp/Discord) du groupe d'amis fait déjà très bien le
   travail et ce serait de la duplication inutile ?
4. Priorité relative entre ces pistes produit et les 2 correctifs encore
   ouverts de l'audit technique (bracket figé en direct, décision SMTP) —
   qu'est-ce qui passe en premier ?
