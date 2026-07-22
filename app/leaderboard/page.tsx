// Classement — route physique UNIQUE, hors des route groups (public)/(app)
// (T6a §3.2, correctif post-validation : évite le conflit de routes que
// créeraient deux page.tsx résolvant la même URL /leaderboard).
// Route minimale pour que l'onglet ne renvoie pas de 404 ; écran réel
// (lecture partagée + nav choisie selon la session) : lot suivant.
export default function LeaderboardPage() {
  return <p>Classement — à venir.</p>;
}
