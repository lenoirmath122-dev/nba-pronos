"""
Génère Cadrage/Stats/README.pdf — pas un script du pipeline de données (ne
touche ni nba.db ni models/), un outil ponctuel pour régénérer la doc de
prise en main quand elle prend du retard sur le pipeline réel. Sans accents
dans le texte du PDF (délibéré, comme la version précédente) : les polices
"core" de fpdf2 (Helvetica/Courier) sont limitées au Latin-1, plus simple de
rester en ASCII que d'embarquer une police TTF pour un document interne.

Usage:
    python generate_readme.py
"""

from pathlib import Path

from fpdf import FPDF

SCRIPT_DIR = Path(__file__).resolve().parent
OUT_PATH = SCRIPT_DIR.parent / "README.pdf"

NAVY = (23, 42, 74)
GRAY_BG = (240, 240, 240)
GRAY_TEXT = (110, 110, 110)
WHITE = (255, 255, 255)
BLACK = (20, 20, 20)

TITLE = "NBA Pronos - Donnees stats"
SUBTITLE = "Dossier Cadrage/Stats/  -  mis a jour le 20/08/2026"

SOMMAIRE = [
    "1. Objectif",
    "2. Ou se trouvent les fichiers",
    "3. Portee des donnees extraites",
    "4. Lancer l'extraction (fetch_nba_data.py)",
    "5. Mettre a jour la base (load_to_sqlite.py)",
    "6. Si 'python' n'est pas reconnu",
    "7. Comprendre la base de donnees",
    "8. Construire les features et les cibles",
    "9. Entrainer les modeles",
    "10. Comprendre les modeles sauvegardes",
    "11. Suivre l'etat du projet",
    "12. Prochaines etapes",
]


class Readme(FPDF):
    def footer(self):
        self.set_y(-15)
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*GRAY_TEXT)
        self.cell(0, 10, f"NBA Pronos - Donnees stats - Page {self.page_no()}", align="C")

    def h1(self, text):
        self.set_font("Helvetica", "B", 20)
        self.set_text_color(*NAVY)
        self.set_x(self.l_margin)
        self.cell(0, 12, text, new_x="LMARGIN", new_y="NEXT")

    def subtitle(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*GRAY_TEXT)
        self.set_x(self.l_margin)
        self.cell(0, 6, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(4)

    def h2(self, text):
        self.ln(2)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(*NAVY)
        self.set_x(self.l_margin)
        self.cell(0, 9, text, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*NAVY)
        self.set_line_width(0.4)
        y = self.get_y()
        self.line(self.l_margin, y, self.w - self.r_margin, y)
        self.ln(3)

    def body(self, text):
        self.set_font("Helvetica", "", 10.5)
        self.set_text_color(*BLACK)
        self.set_x(self.l_margin)
        self.multi_cell(0, 5.6, text, align="L")
        self.ln(1)

    def note(self, text):
        self.set_font("Helvetica", "I", 9.5)
        self.set_text_color(*GRAY_TEXT)
        self.set_x(self.l_margin)
        self.multi_cell(0, 5, text, align="L")
        self.ln(1)

    def bullets(self, items):
        self.set_font("Helvetica", "", 10.5)
        self.set_text_color(*BLACK)
        indent = 5
        full_width = self.w - self.l_margin - self.r_margin
        for item in items:
            self.set_x(self.l_margin)
            self.cell(indent, 5.6, "-")
            self.set_x(self.l_margin + indent)
            self.multi_cell(full_width - indent, 5.6, item, align="L")
        self.ln(1)

    def code(self, lines):
        if isinstance(lines, str):
            lines = [lines]
        self.set_font("Courier", "", 9.5)
        self.set_fill_color(*GRAY_BG)
        self.set_text_color(*BLACK)
        pad = 3
        line_h = 5.5
        height = pad * 2 + line_h * len(lines)
        x, y = self.l_margin, self.get_y()
        self.rect(x, y, self.w - self.l_margin - self.r_margin, height, style="F")
        self.set_xy(x + pad, y + pad)
        for line in lines:
            self.set_x(x + pad)
            self.cell(0, line_h, line, new_x="LMARGIN", new_y="NEXT")
        self.set_y(y + height + 3)

    def tree(self, lines):
        # Même rendu qu'un bloc code, colonnes déjà alignées dans le texte source.
        self.code(lines)

    def table(self, headers, rows, col_widths):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 10)
        self.set_fill_color(*NAVY)
        self.set_text_color(*WHITE)
        for header, w in zip(headers, col_widths):
            self.cell(w, 8, header, fill=True)
        self.ln()
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*BLACK)
        for row in rows:
            # Hauteur de ligne = la + longue cellule (multi_cell simulé via split naïf).
            row_h = 6.5
            y0 = self.get_y()
            x0 = self.get_x()
            for cell_text, w in zip(row, col_widths):
                self.set_xy(x0, y0)
                self.multi_cell(w, row_h, cell_text, new_x="RIGHT", new_y="TOP", align="L")
                x0 += w
            self.set_xy(self.l_margin, y0 + row_h)
        self.ln(2)


def build() -> Readme:
    pdf = Readme(format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(18, 16, 18)

    # ---- Page 1 : titre + sommaire + section 1 ----
    pdf.add_page()
    pdf.h1(TITLE)
    pdf.subtitle(SUBTITLE)

    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 9, "Sommaire", new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(*NAVY)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(*BLACK)
    for entry in SOMMAIRE:
        pdf.cell(0, 6.2, entry, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.h2("1. Objectif")
    pdf.body(
        "Recuperer les feuilles de match NBA (box scores + play-by-play) des deux "
        "dernieres saisons, les structurer dans une base de donnees, puis entrainer "
        "des modeles pour estimer des probabilites d'evenements (points d'un joueur, "
        "double-double, pourcentage de tir...). Le detail du cadrage, des decisions "
        "et des resultats est dans projet-data-nba.md, dans ce meme dossier -- "
        "notamment le bandeau REPRISE en tete de ce fichier, toujours a jour en fin "
        "de session."
    )

    # ---- Section 2 ----
    pdf.h2("2. Ou se trouvent les fichiers")
    pdf.tree([
        "Cadrage/Stats/",
        "  projet-data-nba.md        <- cadrage d'origine + journal des decisions",
        "  README.pdf                <- ce document",
        "  scripts/",
        "    fetch_nba_data.py         <- extraction (nba_api -> CSV)",
        "    load_to_sqlite.py         <- chargement (CSV -> base SQLite)",
        "    build_features.py         <- variables predictives (features_*)",
        "    build_targets.py          <- tables cibles (labels_*, entrainement_*)",
        "    train_points_model.py     <- modele des points (reference)",
        "    train_doubledouble_model.py <- double-double / triple-double",
        "    train_stat_model.py       <- reb/ast/fg3m/stl/blk/minutes (6 modeles)",
        "    train_pct_model.py        <- FT%/FG%/3P% (3 modeles, approche taux)",
        "    demo_pari_reel.py         <- demo sur un cas connu (Jokic)",
        "    generate_readme.py        <- regenere ce document",
        "    requirements.txt",
        "  data/                      <- NON versionne dans git (trop volumineux)",
        "    raw/2024-25/, raw/2025-26/  <- CSV bruts (games_index, boxscores...)",
        "    logs/                      <- journaux d'execution de l'extraction",
        "    nba.db                     <- la base de donnees SQLite",
        "  models/                    <- NON versionne dans git",
        "    *.joblib                   <- modeles entraines et sauvegardes (S9)",
    ])
    pdf.note(
        "data/ et models/ sont exclus de git (.gitignore) : volumineux et "
        "entierement regenerables en relancant les scripts (S4-S9)."
    )

    # ---- Section 3 ----
    pdf.h2("3. Portee des donnees extraites")
    pdf.table(
        ["Parametre", "Valeur retenue"],
        [
            ("Saisons", "2024-25 et 2025-26"),
            ("Types de match", "Saison reguliere, Playoffs, Play-In Tournament"),
            ("Box score", "Traditionnel (pts/reb/ast...) + Avance (ratings, usage%, pace...)"),
            ("Play-by-play", "Detail de chaque action du match (tirs, fautes, remplacements...)"),
            ("Volume", "2 641 matchs (extraction terminee, 0 echec), ~3 fichiers par match"),
        ],
        [55, 122],
    )

    pdf.add_page()

    # ---- Section 4 ----
    pdf.h2("4. Lancer l'extraction (fetch_nba_data.py)")
    pdf.body(
        "Ce script va chercher les donnees sur l'API NBA (nba_api) et les enregistre "
        "en CSV dans data/raw/. Il est resumable : s'il est interrompu (fenetre "
        "fermee, PC eteint, coupure reseau), il suffit de relancer la meme commande "
        "-- il saute automatiquement les matchs deja telecharges."
    )
    pdf.body("Ouvrir un terminal PowerShell, se placer dans le dossier des scripts :")
    pdf.code("cd C:\\dev\\nba-pronos\\Cadrage\\Stats\\scripts")
    pdf.body("Puis lancer :")
    pdf.code("python fetch_nba_data.py")
    pdf.note(
        "Extraction des 2 saisons deja TERMINEE au 20/08/2026 (2 641/2 641 matchs, "
        "0 echec) -- cette section reste utile pour une saison future ou un "
        "complement. Duree estimee pour un fetch complet : plusieurs heures (pause "
        "volontaire entre chaque appel a l'API pour eviter un blocage par NBA.com)."
    )
    pdf.body(
        "Pour que le script continue de tourner meme si VS Code est ferme, le "
        "lancer dans une fenetre detachee :"
    )
    pdf.code([
        'Start-Process python -ArgumentList "fetch_nba_data.py" \\',
        '  -WorkingDirectory "C:\\dev\\nba-pronos\\Cadrage\\Stats\\scripts"',
    ])
    pdf.note("Une nouvelle fenetre de console s'ouvre : ne pas la fermer, elle peut etre minimisee.")

    # ---- Section 5 ----
    pdf.h2("5. Mettre a jour la base (load_to_sqlite.py)")
    pdf.body(
        "Ce script relit tous les CSV presents dans data/raw/ et reconstruit "
        "entierement la base data/nba.db. Rapide (quelques secondes a une minute), "
        "et sans risque : il peut etre relance autant de fois que necessaire, y "
        "compris pendant que l'extraction tourne encore."
    )
    pdf.code("python load_to_sqlite.py")
    pdf.body("Un resume s'affiche a la fin (nombre de lignes par table).")

    # ---- Section 6 ----
    pdf.h2("6. Si 'python' n'est pas reconnu")
    pdf.body("Utiliser le chemin complet a la place, pour n'importe quel script de ce dossier :")
    pdf.code([
        "C:\\Users\\lenoi\\AppData\\Local\\Programs\\Python\\Python312\\python.exe fetch_nba_data.py",
        "C:\\Users\\lenoi\\AppData\\Local\\Programs\\Python\\Python312\\python.exe load_to_sqlite.py",
    ])
    pdf.note(
        "Cela arrive si le terminal a ete ouvert avant l'installation de Python sur "
        "la machine. Fermer et rouvrir VS Code regle generalement le probleme."
    )

    pdf.add_page()

    # ---- Section 7 ----
    pdf.h2("7. Comprendre la base de donnees")
    pdf.body(
        "La base contient les memes informations que les CSV, mais organisees en "
        "tableaux relies entre eux plutot qu'eparpillees dans des milliers de "
        "fichiers -- ce qui permet de poser des questions directement (ex : \"tous "
        "les matchs de Jokic cette saison\")."
    )
    pdf.table(
        ["Tableau", "Contenu"],
        [
            ("equipes", "Les 30 equipes NBA (une ligne chacune)"),
            ("joueurs", "Tous les joueurs apparus dans les matchs extraits"),
            ("matchs", "Un match par ligne : date, saison, equipes, score final"),
            ("box_scores", "Stats d'un joueur sur un match donne (pts, rebonds, passes...)"),
            ("box_scores_advanced", "Idem, stats avancees (rating offensif, usage%, pace...)"),
            ("play_by_play", "Chaque action du match dans l'ordre chronologique"),
            ("features_equipe", "1 ligne/(match, equipe) : variables predictives (S8)"),
            ("features_joueur", "1 ligne/(match, joueur) : variables predictives (S8)"),
            ("labels_joueur", "1 ligne/(match, joueur) : resultats reels a predire (S8)"),
            ("entrainement_matchs", "1 ligne/match : features + resultat (victoire/ecart) (S8)"),
        ],
        [55, 122],
    )
    pdf.note(
        "Les 6 premiers tableaux sont relies par des identifiants communs (game_id, "
        "player_id, team_id). Les 4 derniers (prefixe features_/labels_/"
        "entrainement_) sont DERIVES des precedents par build_features.py/"
        "build_targets.py (S8) -- reconstruits entierement a chaque execution, "
        "jamais edites a la main."
    )

    # ---- Section 8 ----
    pdf.h2("8. Construire les features et les cibles")
    pdf.body(
        "Avant d'entrainer un modele, 2 scripts transforment les tableaux bruts "
        "(box_scores, matchs...) en variables predictives et en resultats reels a "
        "predire :"
    )
    pdf.bullets([
        "build_features.py -- calcule les moyennes glissantes (5/10 derniers "
        "matchs), le repos, le contexte... Regle anti-fuite stricte : chaque "
        "variable pour un match donne n'utilise QUE l'historique strictement "
        "anterieur (jamais le resultat du match qu'elle sert a predire).",
        "build_targets.py -- construit les tables labels_joueur (pts/reb/ast/"
        "3-points/interceptions/contres/minutes/lancers-francs/tirs REELS, un "
        "match a la fois) et entrainement_matchs (resultat de chaque match).",
    ])
    pdf.body("A lancer, dans cet ordre, apres toute mise a jour de la base (S5) :")
    pdf.code([
        "python build_features.py",
        "python build_targets.py",
    ])
    pdf.note(
        "Rapide (quelques secondes), reconstruit entierement les tables a chaque "
        "execution -- sans risque, a relancer aussi souvent que necessaire."
    )

    pdf.add_page()

    # ---- Section 9 (coeur de la demande utilisateur) ----
    pdf.h2("9. Entrainer les modeles")
    pdf.body(
        "Une fois les features et les cibles construites (S8), 4 scripts entrainent "
        "et sauvegardent les modeles (dans models/*.joblib) :"
    )
    pdf.table(
        ["Script", "Modele(s) produit(s)"],
        [
            ("train_points_model.py", "points.joblib"),
            ("train_doubledouble_model.py", "doubledouble.joblib, tripledouble.joblib"),
            ("train_stat_model.py", "reb, ast, fg3m, stl, blk, min .joblib (6 modeles)"),
            ("train_pct_model.py", "ft_pct, fg_pct, fg3_pct .joblib (3 modeles)"),
        ],
        [70, 107],
    )
    pdf.body("Se placer dans le dossier des scripts, puis lancer chaque script un a un :")
    pdf.code([
        "cd C:\\dev\\nba-pronos\\Cadrage\\Stats\\scripts",
        "python train_points_model.py",
        "python train_doubledouble_model.py",
        "python train_stat_model.py",
        "python train_pct_model.py",
    ])
    pdf.note(
        "Duree : quelques secondes a 1-2 minutes par script (RandomForest sur "
        "~56 000 lignes) -- rien a voir avec les plusieurs heures de l'extraction "
        "(S4). Chaque script ECRASE le(s) fichier(s) .joblib existant(s) : relancer "
        "un script apres une mise a jour de la base (S5-S8) reentraine sur les "
        "donnees les plus recentes, aucune etape manuelle supplementaire."
    )
    pdf.body(
        "Chaque script affiche a l'ecran ses propres metriques de calibration "
        "(MAE, R², un tableau \"seuil | proba moyenne predite | taux reel | ecart\") "
        "-- c'est la meme lecture a chaque fois : plus l'ecart est proche de 0%, "
        "mieux le modele est calibre. Rien a enregistrer a la main, la sortie "
        "console suffit pour verifier qu'un changement n'a pas degrade un modele."
    )

    # ---- Section 10 ----
    pdf.h2("10. Comprendre les modeles sauvegardes")
    pdf.body(
        "Chaque fichier models/*.joblib contient un dictionnaire Python (charge "
        "avec joblib.load(...)) : le modele scikit-learn entraine, la liste des "
        "colonnes de features qu'il attend, et les parametres necessaires pour "
        "calculer une probabilite SANS reentrainer (ecart-type pour une "
        "distribution normale, ou parametres de la loi Binomiale pour un "
        "pourcentage de tir -- voir projet-data-nba.md S18)."
    )
    pdf.body("Exemple de chargement, dans un script ou une console Python :")
    pdf.code([
        "import joblib",
        "m = joblib.load('../models/points.joblib')",
        "print(m['target'], m['distribution'])",
    ])
    pdf.note(
        "demo_pari_reel.py montre un exemple complet, sur un cas reel connu "
        "(Nikola Jokic), de chargement d'un modele + calcul d'une probabilite pour "
        "un seuil donne."
    )

    # ---- Section 11 ----
    pdf.h2("11. Suivre l'etat du projet")
    pdf.bullets([
        "Demander directement dans la conversation : je verifie et je reponds.",
        "Lire le bandeau REPRISE en tete de projet-data-nba.md -- toujours a jour "
        "en fin de session, resume l'etat et la prochaine etape a trancher.",
        "Journal complet des sessions et decisions : Cadrage/Proto/"
        "JOURNAL_SESSIONS.md (section \"Projet Data NBA\").",
    ])

    # ---- Section 12 ----
    pdf.h2("12. Prochaines etapes")
    pdf.bullets([
        "Extraction TERMINEE (2 641/2 641 matchs, 0 echec) -- plus a relancer sauf "
        "pour une saison future.",
        "Phase 1 (couverture des categories de paris du classeur) TERMINEE : 12 "
        "modeles construits -- points, double-double, triple-double, rebonds, "
        "passes, 3-points, interceptions, contres, minutes, FT%, FG%, 3P%.",
        "Decision en attente (voir bandeau REPRISE de projet-data-nba.md) : Phase "
        "3 (affiner la calibration residuelle), Phase 4 (pont contexte en direct) "
        "ou Phase 5 (integration dans l'appli, SPEC_TECHNIQUE_PROBA_PARIS_"
        "PERSOS_V0_1.md).",
    ])

    return pdf


def main():
    pdf = build()
    pdf.output(str(OUT_PATH))
    print(f"PDF genere : {OUT_PATH}")


if __name__ == "__main__":
    main()
