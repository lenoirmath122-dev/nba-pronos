"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { CARD_SEEN_PREFIX, setSeenValue, useSeenValue } from "@/lib/seen/store";
import { clickableRowProps } from "@/lib/hooks/clickableRow";
import styles from "./CollapsibleCard.module.css";

type CollapsibleCardProps = {
  /** Clé stable de la carte, utilisée pour la mémorisation « déjà ouverte »
   *  (user_seen_state, liée au compte et non à l'appareil). */
  id: string;
  title: string;
  /** Nombre de lignes contenues (18/08/2026, demandé par l'utilisateur) —
   *  visible même carte repliée, pour savoir si elle contient quelque chose
   *  sans avoir à l'ouvrir. Omis pour les cartes qui n'enveloppent pas une
   *  liste (Profil / onglet Stats, AJUSTEMENTS_VISUELS_20_08_2026 §14) —
   *  pas de nombre de lignes honnête à afficher pour un résumé de stats. */
  count?: number;
  /** Compteur en orange (du nouveau / quelque chose à faire) plutôt que gris
   *  neutre. Une carte jamais ouverte sur cet appareil l'est aussi : le point
   *  d'alerte séparé a été fondu dans le compteur. */
  highlight?: boolean;
  /** Compteur toujours en gris neutre, même carte jamais ouverte (section
   *  informative qui ne demande rien au joueur : « Proposer un pari »). */
  neutralCount?: boolean;
  /** false : titre + compteur toujours visibles, contenu toujours affiché,
   *  sans chevron (22/10/2026 : trop de menus déroulants sur l'Accueil). */
  collapsible?: boolean;
  /** Ouverte par défaut au lieu de repliée (Profil / onglet Stats §14 :
   *  Précision/Comparaison restent ouvertes, « ça amène un peu de couleur »
   *  face à un écran sinon très neutre au 1er coup d'œil). Le point d'alerte
   *  "jamais ouverte" est désactivé pour ces cartes : leur contenu est déjà
   *  visible au chargement, rien à signaler. */
  defaultOpen?: boolean;
  /** Ouverte d'office quand l'URL porte cette ancre (p3-10 : le push des
   *  récaps ouvre /home#recap, la carte doit déjà être dépliée). */
  openOnHash?: string;
  children: React.ReactNode;
};

function getServerSnapshot() {
  return false;
}

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

// Carte dépliable de l'Accueil (18/08/2026, demandé par l'utilisateur) :
// fermée par défaut, avec un point d'alerte tant que la carte n'a jamais
// été ouverte sur cet appareil. Patron d'en-tête cliquable identique à
// BetGroupRow.tsx (clickableRowProps, chevron) ; le titre en <h2> englobe
// la zone cliquable plutôt que l'inverse, pour rester un disclosure widget
// standard (WAI-ARIA) — un <div role="button"> ne doit pas définir sa propre
// sémantique de titre.
//
// Le repère « déjà ouverte » vient du store du compte (lib/seen/store.ts,
// useSyncExternalStore) : jamais de point tant que le serveur ne l'a pas
// amorcé, aucun flash de contenu différent à l'hydratation.
export function CollapsibleCard({ id, title, count, highlight = false, neutralCount = false, collapsible = true, defaultOpen = false, openOnHash, children }: CollapsibleCardProps) {
  // null = l'utilisateur n'a pas encore touché la carte : l'état initial suit
  // `defaultOpen` et l'ancre de l'URL (lue après hydratation, jamais au rendu
  // serveur, même raison que `neverSeen` ci-dessous).
  const [toggled, setToggled] = useState<boolean | null>(null);
  const hashMatches = useSyncExternalStore(
    subscribeHash,
    () => openOnHash !== undefined && window.location.hash === `#${openOnHash}`,
    getServerSnapshot
  );
  const open = !collapsible || (toggled ?? (defaultOpen || hashMatches));
  // Initialisé à `defaultOpen` : une carte déjà ouverte au chargement n'a
  // rien de "jamais consulté" à signaler, pas besoin d'attendre un clic pour
  // faire taire le point d'alerte.
  const [dismissed, setDismissed] = useState(defaultOpen);
  // `undefined` (pas encore chargé) : jamais de point, comme au rendu serveur.
  const neverSeen = useSeenValue(`${CARD_SEEN_PREFIX}${id}`) === null;
  const unseen = collapsible && neverSeen && !dismissed && !neutralCount;

  function toggle() {
    setToggled(!open);
    if (unseen) {
      setSeenValue(`${CARD_SEEN_PREFIX}${id}`, "1");
      setDismissed(true);
    }
  }

  const counter = count !== undefined && (
    <span className={highlight || unseen ? styles.countAccent : styles.count}>{count}</span>
  );

  if (!collapsible) {
    return (
      <>
        <h2 className={styles.title}>
          <div className={styles.headerStatic}>
            <span>{title}</span>
            <span className={styles.right}>{counter}</span>
          </div>
        </h2>
        {children}
      </>
    );
  }

  return (
    <>
      <h2 className={styles.title}>
        <div
          {...clickableRowProps(toggle)}
          className={open ? styles.headerOpen : styles.header}
          aria-expanded={open}
        >
          <span>{title}</span>
          <span className={styles.right}>
            {counter}
            <ChevronDown
              size={16}
              strokeWidth={2.25}
              className={open ? styles.chevronOpen : styles.chevron}
              aria-hidden="true"
            />
          </span>
        </div>
      </h2>
      {open && children}
    </>
  );
}
