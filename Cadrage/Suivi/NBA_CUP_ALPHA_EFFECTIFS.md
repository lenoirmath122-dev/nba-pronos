# NBA Cup — Alpha Potes — effectifs réels des 4 quarts + 2 demies + finale

> À donner aux testeurs AVANT ou EN MÊME TEMPS que le lancement de chaque
> tour — chaque match fictif emprunte le score ET les stats d'un vrai match
> NBA historique (voir `GAPS_OUVERTS.md`, entrée "Compétition fictive NBA
> Cup"). **Seuls les joueurs listés ici ont réellement joué ce match** — un
> pari perso ou un pronostic sur un joueur absent de cette liste (même s'il
> joue aujourd'hui pour l'équipe) ne pourra pas se résoudre normalement,
> d'où l'intérêt de la partager en amont.
>
> Généré via `scripts/nba-cup-real-rosters.mjs` (lecture seule). Les 4 quarts
> ont été choisis et créés (`SCHEDULED`) le 28/08/2026. Les 2 demies et la
> finale ont été CHOISIES le même jour (avec l'utilisateur, via
> `AskUserQuestion`) mais PAS ENCORE CRÉÉES en base — `nba-cup-create-
> match.mjs` exige que les 2 équipes de la série soient déjà connues, ce qui
> n'arrive qu'après la révélation du tour précédent (cascade automatique).
> Choisir les matchs à l'avance était possible car chaque quart emprunte un
> vrai match déjà joué, donc son vainqueur est déjà déterministe — voir
> `GAPS_OUVERTS.md` pour les commandes exactes à lancer le jour J. Toujours
> des matchs de SAISON RÉGULIÈRE plutôt que des playoffs, pour limiter le
> risque qu'un pote reconnaisse le vrai match et devine le résultat à
> l'avance.

## Boston Celtics vs New York Knicks — 2/12/2025 (BOS 123 - 117 NYK)

**Boston Celtics** : Jaylen Brown, Derrick White, Anfernee Simons, Josh Minott,
Payton Pritchard, Neemias Queta, Jordan Walsh, Sam Hauser, Hugo González,
Baylor Scheierman, Amari Williams.

**New York Knicks** : Mikal Bridges, Karl-Anthony Towns, Josh Hart, Jalen
Brunson, Miles McBride, Jordan Clarkson, Tyler Kolek, Guerschon Yabusele,
Mitchell Robinson, Mohamed Diawara.

## Los Angeles Lakers vs Golden State Warriors — 6/02/2025 (LAL 120 - 112 GSW)

**Los Angeles Lakers** : LeBron James, Austin Reaves, Gabe Vincent, Rui
Hachimura, Jaxson Hayes, Dorian Finney-Smith, Jarred Vanderbilt, Christian
Koloko, Shake Milton.

**Golden State Warriors** : Stephen Curry, Buddy Hield, Moses Moody, Draymond
Green, Pat Spencer, Brandin Podziemski, Quinten Post, Kevon Looney, Gary
Payton II, Trayce Jackson-Davis, Jackson Rowe.

## Denver Nuggets vs Oklahoma City Thunder — 10/03/2025 (OKC 127 - 140 DEN)

**Denver Nuggets** : Nikola Jokić, Jamal Murray, Michael Porter Jr., Russell
Westbrook, Peyton Watson, Christian Braun, Jalen Pickett, Zeke Nnaji.

**Oklahoma City Thunder** : Luguentz Dort, Shai Gilgeous-Alexander, Isaiah
Hartenstein, Alex Caruso, Jalen Williams, Cason Wallace, Aaron Wiggins, Chet
Holmgren, Isaiah Joe, Jaylin Williams, Ousmane Dieng, Dillon Jones.

## Milwaukee Bucks vs Philadelphia 76ers — 19/01/2025 (MIL 117 - 109 PHI)

**Milwaukee Bucks** : Giannis Antetokounmpo, Damian Lillard, Khris Middleton,
Brook Lopez, Taurean Prince, Andre Jackson Jr., Ryan Rollins, Gary Trent Jr.,
Stanley Umude, Chris Livingston.

**Philadelphia 76ers** : Tyrese Maxey, Kelly Oubre Jr., Ricky Council IV, Eric
Gordon, Adem Bona, Pete Nance, Justin Edwards, Jeff Dowtin Jr.

---

## Demies et finale — matchs déjà choisis, à créer le jour J

> Appariement du bracket (vérifié en base, `series.slot_index`/
> `next_series_id`) : Demi 1 = vainqueur Celtics-Knicks vs vainqueur
> Lakers-Warriors ; Demi 2 = vainqueur Nuggets-Thunder vs vainqueur
> Bucks-76ers. Les 4 quarts étant des vrais matchs déjà joués, les
> vainqueurs sont déjà connus : Celtics, Lakers, Nuggets, Bucks — d'où les
> 2 demies ci-dessous, et la finale Celtics-Nuggets (à confirmer une fois
> les demies réellement révélées).

### Demi 1 — Boston Celtics vs Los Angeles Lakers — 8/03/2025 (BOS 111 - 101 LAL, `0022400918`)

**Boston Celtics** : Jayson Tatum, Jaylen Brown, Al Horford, Derrick White,
Jrue Holiday, Luke Kornet, Payton Pritchard, Sam Hauser.

**Los Angeles Lakers** : Luka Dončić, LeBron James, Austin Reaves, Dalton
Knecht, Dorian Finney-Smith, Jordan Goodwin, Jarred Vanderbilt, Gabe
Vincent, Trey Jemison III.

### Demi 2 — Denver Nuggets vs Milwaukee Bucks — 26/03/2025 (DEN 127 - 117 MIL, `0022401057`)

**Denver Nuggets** : Nikola Jokić, Michael Porter Jr., Christian Braun,
Jamal Murray, Peyton Watson, Aaron Gordon, Russell Westbrook, Jalen
Pickett, DeAndre Jordan, Spencer Jones.

**Milwaukee Bucks** : Brook Lopez, Ryan Rollins, Gary Trent Jr., Taurean
Prince, AJ Green, Kevin Porter Jr., Kyle Kuzma, Pat Connaughton.

### Finale (si Celtics vs Nuggets se confirme) — Boston Celtics vs Denver Nuggets — 2/03/2025 (BOS 110 - 103 DEN, `0022400866`)

**Boston Celtics** : Jaylen Brown, Al Horford, Derrick White, Jayson Tatum,
Payton Pritchard, Luke Kornet, Neemias Queta, Sam Hauser, Torrey Craig.

**Denver Nuggets** : Jamal Murray, Christian Braun, Nikola Jokić, Russell
Westbrook, Michael Porter Jr., Julian Strawther, Jalen Pickett, Zeke Nnaji,
DeAndre Jordan.
