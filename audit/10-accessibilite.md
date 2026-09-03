# 10 — Accessibilité

*Vérification par lecture de code (attributs ARIA, structure sémantique, tokens de design). Aucun outil automatisé (axe, Lighthouse, WAVE) n'a été exécuté dans cette session — non installé dans le projet. Rappel du principe de la commande d'audit : un outil automatique ne remplace pas une vérification humaine, y compris dans l'autre sens — cette analyse par lecture de code ne remplace pas un audit avec lecteur d'écran réel.*

## 1. Structure sémantique et labels

- **Labels de formulaire** : usage systématique de `<label htmlFor=...>` correctement associé, y compris via `useId()` pour les composants instanciés plusieurs fois (`BetForm.tsx`) — bonne pratique généralisée sur les formulaires audités.
- **role= / aria-\*** : usage large (204 occurrences réparties sur 71 fichiers `.tsx`) — `role="alert"` sur les messages d'erreur, `role="radiogroup"`/`role="radio"` + `aria-checked` sur les sélecteurs personnalisés (série/match), `role="group"` + `aria-label`, `aria-pressed` sur les toggles. Couverture large mais non exhaustive à l'échelle des ~150 composants du dépôt (non vérifiée fichier par fichier au-delà de l'échantillon exploré).
- **Images** : `alt` explicite constaté sur les logos d'équipe (`TeamLogo`).

## 2. Modales et gestion du focus

**Point faible identifié (`UX-001`, également un enjeu a11y)** : les modales (`components/ui/ModalDialog.tsx`) et dialogues de confirmation (`DeleteBetButton`, `DeleteMatchButton`, `CloseCompetitionButton`) portent une sémantique ARIA correcte (`role="dialog"`/`role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`), mais :
- Aucun déplacement de focus à l'ouverture constaté.
- Aucun piège de focus (`Tab`/`Shift+Tab` peut sortir du dialogue vers le contenu arrière-plan).
- Aucune fermeture par `Échap` constatée.

Pour un utilisateur naviguant exclusivement au clavier ou avec un lecteur d'écran, ceci dégrade significativement l'usage des actions les plus critiques (suppression de compte, clôture de compétition) — précisément celles où la confiance dans l'interface compte le plus.

## 3. Accordéons / menus

Le menu "..." de notification par canal de chat (`ChatNotificationToggle`) utilise `<details>/<summary>` natif — bon choix, l'accessibilité clavier/lecteur d'écran de base (`Entrée`/`Espace` pour ouvrir, annonce "développé/replié") est fournie nativement par le navigateur sans code custom à maintenir.

## 4. Tableaux

Convention du dépôt : jamais de balise `<table>` HTML — les tableaux (classement, barème) sont construits en `div`+`flex` avec des rôles ARIA de tableau (`BaremeTable.tsx`, `LeaderboardTable.tsx`). **Non vérifié en détail dans cette session** si l'ensemble des rôles nécessaires (`role="table"`, `role="row"`, `role="cell"`/`role="columnheader"`) sont tous correctement posés pour qu'un lecteur d'écran restitue une vraie sémantique de tableau — à vérifier avec un lecteur d'écran réel.

## 5. Contrastes et couleur

**Aveu documenté dans le code lui-même (`A11Y-001`)** : `app/tokens.css` marque explicitement le contraste du token `--color-trend` (indicateur de tendance au classement) comme "À CONFIRMER" en thème clair — reconnaissance honnête d'une zone non vérifiée plutôt qu'un oubli silencieux.
- **Dépendance exclusive à la couleur** : non vérifiée systématiquement dans cette session ; le classement utilise des caractères (✓, →) en complément des couleurs sur certains indicateurs (constaté dans la documentation interne, `SPEC_ECRAN_MATCHS_V0_1.md`), ce qui est une bonne pratique si généralisée — à confirmer sur l'ensemble des indicateurs de statut.

## 6. Réduction des animations

`components/ui/Spinner.module.css` respecte `prefers-reduced-motion` (animation figée). **Non vérifié systématiquement** sur les autres animations du dépôt (transitions CSS, éventuelles animations de badges "carte qui se retourne au clic").

## 7. Zoom / reflow / tailles de zones cliquables

Non mesurés dans cette session (nécessiteraient un test dans un vrai navigateur avec zoom à 200%/400%, hors du périmètre d'analyse statique).

## 8. Vérification automatisée en CI

**Absente (`A11Y-002`)** — aucun outil (`eslint-plugin-jsx-a11y`, axe-core, Lighthouse CI) n'est intégré au pipeline `ci.yml`. La bonne couverture ARIA constatée manuellement n'est donc protégée contre aucune régression automatique.

## Synthèse

Base ARIA sémantique globalement soignée pour un projet de cette taille (labels, rôles, structure), avec une lacune concrète et récurrente sur la gestion du focus dans les composants modaux — le point le plus actionnable de cette phase. L'absence d'outillage automatisé en CI est le second point structurel : sans lui, la qualité actuelle n'est protégée que par la discipline du développeur, pas par un filet de sécurité.

## Anomalies de cette phase

`A11Y-001`, `A11Y-002` (détaillées dans `ANOMALIES.md`), `UX-001` (partagée avec la Phase 9, la même cause — absence de focus-trap — ayant un impact à la fois UX et accessibilité).

## Limites de cette phase

Aucune vérification avec un vrai lecteur d'écran (NVDA/VoiceOver/JAWS) n'a été effectuée. Aucun test de zoom/reflow. Aucune mesure de contraste automatisée (calcul manuel du ratio non effectué faute d'outil de rendu dans cette session) — la zone signalée `A11Y-001` reste donc une hypothèse de risque documentée par l'équipe elle-même, pas une mesure indépendante confirmée par cet audit.
