# NBA Pronos — Journal design (passe maquettes V1)

> Démarré le 20/07/2026. But : éprouver le design system **T7** sur des écrans réels,
> consigner les **décisions actées**, mes **retours** et les **retours des potes** (à venir),
> pour alimenter le prompt Claude Code de consolidation.
> Emplacements « retours potes » laissés vides, à remplir après tests.

---

## 1. Amendements design system (T7) — actés

- **Accent : ORANGE `#FF6A2B`** confirmé (= décision §14.1, la réserve « réversible » est levée → figée). Pas de sur-accent.
- **Rayons : barème NIVEAU C / net** → `--radius-lg` 4px · `--radius-md` 3px · `--radius-sm` 2px · puces 4px · badges 3px. Cercles pleins conservés (pastille / avatar / point live, §14.3).
- **Biseau : écarté** (essayé sur les moments forts, non retenu).
- **Forme (tendance)** : rendue en **bleu-froid neutre** `#9FC6E0`, jamais vert/rouge.

## 2. Décisions produit / navigation — actées cette passe

- **Raccourci PARI depuis la carte de match** : additif au hub Jouer (0.2.9), pas une fusion. Entrée **secondaire**, distincte du CTA « Valider le prono ».
- **Paris en NBA Cup : 1 pari par match** (pas de pari série). Adapte le quota série-centré de 0.2.4. Cohérent avec `nba_cup_mecanique §6` (« scope MATCH uniquement »).
- **Réconciliation couleurs de statut** *(proposée, à confirmer)* : vert/rouge réservés aux **RÉSULTATS** gagné/perdu ; or réservé au **champion** ; les statuts de prono (validé/prêt/incomplet/à faire) doivent être recolorés **hors** vert/ambre. → corrige une collision entre 0.2.9 §4 et T7.

## 3. Écrans maquettés

| Écran | Fichier | Statut | Mes retours | Retours potes |
|---|---|---|---|---|
| Classement | `ecran-classement.html` | validé (+ tableau desktop) | mobile parfait ; desktop = en-têtes triables au-dessus des colonnes (fait) | _à remplir_ |
| Matchs (cartes) | `ecran-matchs.html` | « parfait » | — | _à remplir_ |
| Matchs (replié) | `ecran-matchs-replie.html` | à décider : vue par défaut ou bascule | — | _à remplir_ |
| Raccourci pari | `ecran-matchs-pari-entree.html` | fait | entrée à passer en binaire | _à remplir_ |
| Nouveau pari | `ecran-nouveau-pari.html` | fait | — | _à remplir_ |
| Accueil | `ecran-accueil.html` | fait | — | _à remplir_ |
| Bracket (Cup) | `ecran-bracket.html` | fait | — | _à remplir_ |

## 4. Points ouverts (à trancher avant/pendant la consolidation)

- **Couleurs de statut de prono** : réconciliation avec T7 (cf. §2).
- **Saisie de l'écart** : stepper seul, ou stepper **+ saisie libre au pavé numérique** (0.2.3 §3).
- **Matchs repliés** : vue par défaut, ou bascule compacte/détaillée ?
- **Entrée pari sur la carte** : passer l'indicateur `x/3` → **binaire** (1 pari/match en Cup).
- **Gains des paris par niveau** + forme de progression (linéaire / « jackpot ») : point ouvert de 0.2.5.
- **Marqueur « corrigé »** au classement : wording et placement.
- **Séparateur visuel du Total** (tableau classement desktop) : à trancher.

## 5. Flags résolus en cours de route

- Libellé colonne **« Bracket » pour la Cup** : **pas de renommage**, elle pointe sur le **mini-bracket** (phase finale, `nba_cup_mecanique §2-4`).

## 6. Invariants à ne jamais casser (rappel)

- Scoring **idempotent** au recalcul ; **jamais** de pénalité négative.
- **vert = gagné**, **rouge = perdu**, **or = champion** (réservés).
- API Highlightly : `timezone=America/New_York` sur les appels datés ; score = **tableau par quart-temps à sommer**.

---

*Ce journal est la source du futur prompt Claude Code (consolidation des specs + tokens).*
