// Débrief des matchs de la nuit (p3-11) : lien vers les articles de
// TrashTalk, média NBA francophone choisi avec l'utilisateur (05/10/2026).
// Seul le flux RSS public (https://trashtalk.co/feed) est exploitable : pas
// de catégories, pas de recherche, ~20 derniers articles. On rattache donc un
// article à un match par le surnom d'équipe présent dans son titre, parmi les
// articles publiés depuis le début de la fenêtre du récap. Si rien ne colle,
// le récap garde un lien vers la page d'accueil du site.
//
// Partie pure ici (parse + rapprochement, testée) ; la lecture réseau, mise
// en cache, est dans trashtalkFeed.ts.

export const TRASHTALK_HOME_URL = "https://trashtalk.co";
export const TRASHTALK_FEED_URL = "https://trashtalk.co/feed";

export type FeedArticle = { title: string; url: string; publishedAt: string };

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Lecture minimale d'un flux RSS 2.0 (titre, lien, date), sans dépendance.
 *  Un article sans lien https ou sans date lisible est ignoré. */
export function parseRssArticles(xml: string): FeedArticle[] {
  const articles: FeedArticle[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1];
    const title = /<title>([\s\S]*?)<\/title>/.exec(item)?.[1];
    const link = /<link>([\s\S]*?)<\/link>/.exec(item)?.[1];
    const pubDate = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(item)?.[1];
    if (!title || !link || !pubDate) continue;
    const url = decodeEntities(link);
    const publishedMs = Date.parse(decodeEntities(pubDate));
    if (!url.startsWith("https://") || Number.isNaN(publishedMs)) continue;
    articles.push({ title: decodeEntities(title), url, publishedAt: new Date(publishedMs).toISOString() });
  }
  return articles;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Surnoms courants employés dans les titres en plus du nom officiel.
const NICKNAME_ALIASES: Record<string, string[]> = {
  "76ers": ["sixers"],
  cavaliers: ["cavs"],
  mavericks: ["mavs"],
  timberwolves: ["wolves"],
};

/** Mots-clés qui désignent une équipe dans un titre : le dernier mot de son
 *  nom (« Los Angeles Lakers » -> lakers) et ses surnoms. */
export function teamKeywords(teamName: string): string[] {
  const words = normalize(teamName).split(/\s+/).filter(Boolean);
  const nickname = words[words.length - 1];
  if (!nickname) return [];
  return [nickname, ...(NICKNAME_ALIASES[nickname] ?? [])];
}

function mentions(title: string, keywords: string[]): boolean {
  const normalized = normalize(title);
  return keywords.some((keyword) => new RegExp(`(^|[^a-z0-9])${keyword}([^a-z0-9]|$)`).test(normalized));
}

/** Article le plus pertinent pour un match : publié depuis `sinceIso`, qui
 *  cite les deux équipes de préférence, sinon l'une des deux. Le flux est
 *  déjà trié du plus récent au plus ancien ; on garde le plus récent. */
export function articleForMatch(
  articles: FeedArticle[],
  homeTeamName: string,
  awayTeamName: string,
  sinceIso: string
): FeedArticle | null {
  const recent = articles.filter((article) => article.publishedAt >= sinceIso);
  const home = teamKeywords(homeTeamName);
  const away = teamKeywords(awayTeamName);
  return (
    recent.find((article) => mentions(article.title, home) && mentions(article.title, away)) ??
    recent.find((article) => mentions(article.title, home) || mentions(article.title, away)) ??
    null
  );
}
