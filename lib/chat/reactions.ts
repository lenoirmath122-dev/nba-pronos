// Jeu fixe de réactions du chat (migration 20261022100000_chat_reactions.sql :
// la contrainte CHECK de la table doit rester alignée sur cette liste).
export const CHAT_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;

export type ChatReactionEmoji = (typeof CHAT_REACTION_EMOJIS)[number];

export function isChatReactionEmoji(value: string): value is ChatReactionEmoji {
  return (CHAT_REACTION_EMOJIS as readonly string[]).includes(value);
}
