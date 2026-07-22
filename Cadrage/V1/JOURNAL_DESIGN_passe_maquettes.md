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
- **Statuts de prono : rampe neutre** (renvoi §15.5) — recolorés hors vert/or ; seul `validé` porte une teinte (l'accent).
- **Surfaces/bordures/gradients « Voie A »** (renvoi §15.6) — dark raffiné par valeurs de tokens, rayons nets inchangés.
- **Bandeau de section « parquet »** (renvoi §15.7) — élément net-new, sombre dans les deux thèmes.
- **Vainqueur au tap** (renvoi §15.8) — l'affrontement devient le sélecteur, cohérent avec le geste `ecran-bracket`.
- **Logos de franchise en SVG bundlés** (21/07/2026) — source **unique** de l'affichage, un
  fichier par franchise dans `public/logos/teams/` nommé `teams.abbreviation` (MAJUSCULES).
  Amende `SPEC_TECHNIQUE_SYNCHRO §4` (abandon du couple téléchargement + bucket Supabase
  Storage) : `teams.logo_url` reste en base mais n'est plus lu pour l'affichage (fallback
  théorique) ; fallback réel = abréviation en texte.
- **Icônes de nav custom, variante B « nette »** (21/07/2026) — maison / ballon / podium /
  silhouette (Accueil · Jouer · Classement · Profil), trait 1.8 cohérent avec les rayons
  « niveau C » (T7). **Podium et non trophée** pour ne pas entrer en collision avec la
  réservation or/champion (§6). Implémenté dans `components/icons/nav-icons.tsx`.
- **Convention d'asset du bandeau** (21/07/2026) — `public/brand/hero-parquet.webp`, câblé
  par le futur token unique `--hero-image` ; image **licenciée ou possédée**, sans
  watermark, hébergée en interne ; base64 des maquettes proscrit du dépôt. Placeholder de
  dev nommé `*.dev.*`, ignoré par git.

### Consolidation des tokens (21/07/2026)

- **Fichier de tokens de production écrit et validé** : `app/tokens.css` (importé par
  `app/globals.css`), nommage **P-DS7** (préfixe par famille), dark sur `:root` (défaut) +
  override `[data-theme="light"]` (P-DS2). Table de correspondance noms courts des
  maquettes → P-DS7 appliquée telle que consignée §15.9 de `SPEC_DESIGN_SYSTEM_V0_1.md`
  (`--surface-*` → `--color-surface-*`, `--shadow-*` → `--elevation-*`, etc.).
- **Valeurs V0.2 ayant primé sur §3/§5** : rayons (§15.2, barème « niveau C »),
  surfaces/bordures/texte/accent/élévation « Voie A » (§15.6), tendance `--color-trend`
  (§15.4) — partout où l'amendement redonnait une valeur, elle a été retenue au fichier de
  tokens plutôt que la valeur d'origine T7.

## 2. Décisions produit / navigation — actées cette passe

- **Raccourci PARI depuis la carte de match** : additif au hub Jouer (0.2.9), pas une fusion. Entrée **secondaire**, distincte du CTA « Valider le prono ».
- **Paris en NBA Cup : 1 pari par match** (pas de pari série). Adapte le quota série-centré de 0.2.4. Cohérent avec `nba_cup_mecanique §6` (« scope MATCH uniquement »).
- **Réconciliation couleurs de statut** — **CONFIRMÉE** (variante neutre, renvoi §15.5) : vert/rouge réservés aux **RÉSULTATS** gagné/perdu ; or réservé au **champion** ; les statuts de prono (validé/prêt/incomplet/à faire) sont recolorés **hors** vert/or. Corrige la collision entre 0.2.9 §4 et T7.
- **Vainqueur au tap** (renvoi §15.8) : le vainqueur se choisit en tapant l'équipe (logo/nom), pas via des boutons segmentés séparés.

## 3. Écrans maquettés

| Écran | Fichier | Statut | Mes retours | Retours potes |
|---|---|---|---|---|
| Classement | `ecran-classement.html` | validé (+ tableau desktop) | mobile parfait ; desktop = en-têtes triables au-dessus des colonnes (fait) | _à remplir_ |
| Matchs (cartes) | `ecran-matchs.html` puis passe Voie A (`ecran-matchs-voieA.html`, `-voieA-header`, `-voieA-photo`) → `ecran-matchs-voieA-pick.html` (le plus à jour, hors dépôt) | raffiné (Voie A) + statuts réconciliés + bandeau parquet + vainqueur au tap | — | _à remplir_ |
| Matchs (replié) | `ecran-matchs-replie.html` | à décider : vue par défaut ou bascule | — | _à remplir_ |
| Raccourci pari | `ecran-matchs-pari-entree.html` | fait | entrée à passer en binaire | _à remplir_ |
| Nouveau pari | `ecran-nouveau-pari.html` | fait | — | _à remplir_ |
| Accueil | `ecran-accueil.html` | fait | — | _à remplir_ |
| Bracket (Cup) | `ecran-bracket.html` | fait | — | _à remplir_ |
| Icônes de nav | `components/icons/nav-icons.tsx` | fait (variante B, `components/icons/nav-icons.tsx`) | — | _à remplir_ |

## 4. Points ouverts (à trancher avant/pendant la consolidation)

- ~~Couleurs de statut de prono~~ — **CLOS**, résolu §15.5 (rampe neutre, cf. §2).
- **Saisie de l'écart** : stepper seul, ou stepper **+ saisie libre au pavé numérique** (0.2.3 §3).
- **Matchs repliés** : vue par défaut, ou bascule compacte/détaillée ?
- **Entrée pari sur la carte** : passer l'indicateur `x/3` → **binaire** (1 pari/match en Cup).
- **Gains des paris par niveau** + forme de progression (linéaire / « jackpot ») : point ouvert de 0.2.5.
- **Marqueur « corrigé »** au classement : wording et placement.
- **Séparateur visuel du Total** (tableau classement desktop) : à trancher.
- **Portée du bandeau parquet** : recommandé **arène-only** (Matchs, Bracket, Accueil) avec en-tête plus calme sur les écrans de lecture (Classement, Profil) — à confirmer.
- **Thème clair du bandeau** : garder la bande sombre partout (acté §15.7) ou prévoir un éclaircissement de la photo uniquement en clair (même asset, filtre différent) — ouvert.
- **Écart** : divulgation progressive (révélé après le choix du vainqueur) ou visible d'emblée — ouvert.
- **Propager le tap-to-pick** à `ecran-matchs-replie` (même formulaire de saisie) — à faire.

## 5. Flags résolus en cours de route

- Libellé colonne **« Bracket » pour la Cup** : **pas de renommage**, elle pointe sur le **mini-bracket** (phase finale, `nba_cup_mecanique §2-4`).

## 6. Invariants à ne jamais casser (rappel)

- Scoring **idempotent** au recalcul ; **jamais** de pénalité négative.
- **vert = gagné**, **rouge = perdu**, **or = champion** (réservés).
- API Highlightly : `timezone=America/New_York` sur les appels datés ; score = **tableau par quart-temps à sommer**.

---

*Ce journal est la source du futur prompt Claude Code (consolidation des specs + tokens).*
