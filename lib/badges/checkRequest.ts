// Demande de vérification immédiate des badges (suite de p3-9, 05/10/2026) :
// émise côté client juste après un geste qui peut en débloquer un (prono ou
// pari envoyé, bracket validé, ligue rejointe ou créée), écoutée par
// NewBadgesWatcher. Sans ça, la popup n'apparaissait qu'au prochain
// chargement de la coquille ou retour au premier plan.
//
// Les badges liés aux résultats (points, bons vainqueurs...) restent
// découverts à l'ouverture : ils changent au fil de la synchro, pas d'un
// geste du joueur.

const BADGE_CHECK_EVENT = "badges:check";

export function requestBadgeCheck() {
  window.dispatchEvent(new Event(BADGE_CHECK_EVENT));
}

export function onBadgeCheckRequest(listener: () => void): () => void {
  window.addEventListener(BADGE_CHECK_EVENT, listener);
  return () => window.removeEventListener(BADGE_CHECK_EVENT, listener);
}
