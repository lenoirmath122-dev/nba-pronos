# Maquettes — chantier Profil & badges (23/10/2026)

Sources des maquettes validées le 23/10/2026 (canevas claude.ai
« Panier Ballon — Profil & badges »). Format « Design Component » : du HTML
à styles en ligne, lisible tel quel pour relever couleurs, tailles et
espacements, mais qui ne s'ouvre pas seul dans un navigateur (il dépend du
moteur du canevas). `<dc-import name="Emblem" …>` = l'écusson de
`09_ecusson_composant.html`, équivalent de `components/badges/BadgeEmblem.tsx`.

| Fichier | Écran |
|---|---|
| 01_classement_portrait | Classement, badge signature, ligne « Toi », barre « Ta place » |
| 02_classement_popover_badge | Tap sur un écusson du classement |
| 03_classement_paysage | Classement en paysage, 3 badges |
| 04_profil_vu_par_les_autres | `/players/[id]` |
| 05_mon_profil_onglets | `/profile`, onglets Stats · Badges · Historique · Ligues |
| 06_panneau_profil | Panneau Profil (TabBar) |
| 07_onglet_badges | Contenu de l'onglet Badges |
| 08_fiche_badge | Fiche détail d'un badge (bottom sheet) |
| 09_ecusson_composant | Écusson paramétrable |

Données : points du classement et badges de Rillettes-31 réels au 23/10 ;
badges des autres joueurs = exemples ; `[date]`, `[MATCH]`… = à remplir.
Règle DA (chantier §3) : aucune couleur nouvelle ; couleurs d'équipe
uniquement dans le bandeau photo du profil.
