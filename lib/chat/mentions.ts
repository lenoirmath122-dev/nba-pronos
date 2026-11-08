// Mentions « @pseudo » du chat : le texte du message garde simplement
// `@pseudo` (aucune colonne ni migration), la reconnaissance se fait à
// l'affichage contre le trombinoscope. Les pseudos pouvant contenir des
// espaces, on teste les pseudos du plus long au plus court.

export type MentionTarget = { id: string; pseudo: string };

export type BodySegment = { type: "text"; text: string } | { type: "mention"; text: string; userId: string };

function isBoundary(char: string | undefined): boolean {
  return char === undefined || !/[\p{L}\p{N}_]/u.test(char);
}

export function splitMentions(body: string, targets: MentionTarget[]): BodySegment[] {
  const sorted = [...targets].sort((a, b) => b.pseudo.length - a.pseudo.length);
  const lowerBody = body.toLowerCase();
  const segments: BodySegment[] = [];
  let buffer = "";
  let i = 0;

  while (i < body.length) {
    if (body[i] === "@" && isBoundary(body[i - 1])) {
      const match = sorted.find((t) => {
        const end = i + 1 + t.pseudo.length;
        return lowerBody.startsWith(t.pseudo.toLowerCase(), i + 1) && isBoundary(body[end]);
      });
      if (match) {
        if (buffer) segments.push({ type: "text", text: buffer });
        buffer = "";
        const end = i + 1 + match.pseudo.length;
        segments.push({ type: "mention", text: body.slice(i, end), userId: match.id });
        i = end;
        continue;
      }
    }
    buffer += body[i];
    i += 1;
  }
  if (buffer) segments.push({ type: "text", text: buffer });
  return segments;
}

/** Texte `@requête` en cours de saisie juste avant le curseur, ou null. */
export function activeMentionQuery(value: string, caret: number): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1 || !isBoundary(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (query.includes("\n") || [...query].length > 20) return null;
  return { start: at, query };
}
