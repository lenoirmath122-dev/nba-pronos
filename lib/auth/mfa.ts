import { randomBytes, createHash } from "node:crypto";

// Codes de récupération 2FA admin (p2-8, feuille de route Phase 2). Format
// lisible/copiable à la main ("XXXX-XXXX", majuscules + chiffres, sans les
// caractères ambigus 0/O/1/I) -- 8 caractères utiles sur un alphabet de 32,
// soit 40 bits d'entropie par code, largement suffisant pour un secret à
// usage unique jamais rejoué (pas un mot de passe qu'on doit retenir).
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const RECOVERY_CODE_COUNT = 10;

function randomCode(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (const byte of bytes) {
    raw += ALPHABET[byte % ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

// SHA-256 sans sel : chaque code est déjà un secret aléatoire à haute
// entropie (jamais choisi par l'utilisateur), donc pas de risque de
// dictionnaire/rainbow table comme pour un mot de passe -- même compromis
// que beaucoup d'implémentations de codes de récupération (ex. GitHub).
export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export function generateRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, randomCode);
  return { codes, hashes: codes.map(hashRecoveryCode) };
}
