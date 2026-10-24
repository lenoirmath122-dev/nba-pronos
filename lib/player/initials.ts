// Initiales de l'avatar d'un joueur. Coupe sur les séparateurs usuels (_, -,
// espace) et ne garde que les morceaux qui commencent par une lettre : « R3 »
// pour Rillettes-31 devenait illisible, on veut « RI ». Sans deuxième morceau
// utilisable, les 2 premiers caractères du pseudo.
export function getInitials(pseudo: string): string {
  const parts = pseudo.split(/[\s_-]+/).filter((part) => /^\p{L}/u.test(part));
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const base = parts[0] ?? pseudo.replace(/[^\p{L}\p{N}]/gu, "");
  return base.slice(0, 2).toUpperCase() || "?";
}
