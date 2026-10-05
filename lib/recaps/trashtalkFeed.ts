import "server-only";
import { unstable_cache } from "next/cache";
import { parseRssArticles, TRASHTALK_FEED_URL, type FeedArticle } from "./trashtalk";

// Lecture réseau du flux TrashTalk (p3-11), mise en cache 30 min : l'Accueil
// est lu à chaque visite, le flux n'a pas besoin d'être plus frais. Un échec
// (site lent, flux cassé) ne doit jamais casser l'Accueil ni le job d'envoi :
// liste vide, et le récap retombe sur le lien vers la page d'accueil du site.

const FETCH_TIMEOUT_MS = 5000;

async function fetchTrashTalkArticles(): Promise<FeedArticle[]> {
  try {
    const response = await fetch(TRASHTALK_FEED_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NBA-Pronos/1.0; +https://nba-pronos.vercel.app)" },
    });
    if (!response.ok) return [];
    return parseRssArticles(await response.text());
  } catch {
    return [];
  }
}

const cachedTrashTalkArticles = unstable_cache(fetchTrashTalkArticles, ["trashtalk-feed"], { revalidate: 1800 });

export async function getTrashTalkArticles(): Promise<FeedArticle[]> {
  try {
    return await cachedTrashTalkArticles();
  } catch {
    // unstable_cache hors d'une vraie requête Next (tests d'intégration) :
    // même repli que lib/queries/teams.ts.
    return fetchTrashTalkArticles();
  }
}
