// Clé localStorage partagée entre TabBar (lecture) et MarkFeedSeen (écriture)
// pour la pastille « nouveaux résultats » de l'onglet Accueil — même patron
// que CollapsibleCard.tsx (état d'affichage purement client, par appareil,
// aucune colonne serveur pour ça).
export const HOME_FEED_SEEN_STORAGE_KEY = "home-feed-seen-at";
