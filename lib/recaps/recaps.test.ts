// Récaps du matin (p3-10 + p3-11) : fenêtres, contenu, textes du push et
// rapprochement des articles TrashTalk. Lecture base et réseau hors de ces
// tests (load.ts, trashtalkFeed.ts).

import { describe, expect, it } from "vitest";
import { buildCompetitionRecap, personalRecap, type BuildInput, type ScoredBetRow } from "./build";
import { addDays, dailyPeriod, isoWeekday, recapBoundaryIso, recapKindFor, visibleWeeklyPeriod, weeklyPeriod } from "./period";
import { dailyPushText, kickoffHour, personalDetail, weeklyPushText } from "./text";
import { articleForMatch, parseRssArticles, teamKeywords } from "./trashtalk";

describe("fenêtres des récaps", () => {
  it("10h Paris tombe à 8h UTC en été et 9h UTC en hiver", () => {
    expect(recapBoundaryIso("2026-10-06")).toBe("2026-10-06T08:00:00.000Z");
    expect(recapBoundaryIso("2026-12-01")).toBe("2026-12-01T09:00:00.000Z");
  });

  it("le hebdo part le lundi, le journalier les autres jours", () => {
    expect(isoWeekday("2026-10-05")).toBe(1);
    expect(recapKindFor("2026-10-05")).toBe("WEEKLY");
    expect(recapKindFor("2026-10-06")).toBe("DAILY");
    expect(addDays("2026-10-01", -2)).toBe("2026-09-29");
  });

  it("avant 10h, le journalier couvre la nuit en cours jusqu'à maintenant", () => {
    const now = Date.parse("2026-10-06T05:00:00.000Z"); // 7h Paris
    const period = dailyPeriod(now);
    expect(period).toMatchObject({
      recapDate: "2026-10-06",
      startIso: "2026-10-05T08:00:00.000Z",
      endIso: "2026-10-06T05:00:00.000Z",
      inProgress: true,
      baselineBefore: "2026-10-06",
    });
  });

  it("après 10h, le journalier est figé sur la nuit passée", () => {
    const period = dailyPeriod(Date.parse("2026-10-06T15:00:00.000Z"));
    expect(period.endIso).toBe("2026-10-06T08:00:00.000Z");
    expect(period.inProgress).toBe(false);
  });

  it("le hebdo couvre lundi 10h -> lundi 10h, comparé au snapshot du lundi précédent", () => {
    expect(weeklyPeriod("2026-10-12")).toMatchObject({
      startIso: "2026-10-05T08:00:00.000Z",
      endIso: "2026-10-12T08:00:00.000Z",
      baselineBefore: "2026-10-06",
    });
  });

  it("le hebdo reste visible sur l'Accueil du lundi 10h au mardi 10h", () => {
    expect(visibleWeeklyPeriod(Date.parse("2026-10-12T07:00:00.000Z"))).toBeNull(); // lundi 9h
    expect(visibleWeeklyPeriod(Date.parse("2026-10-12T09:00:00.000Z"))?.recapDate).toBe("2026-10-12");
    expect(visibleWeeklyPeriod(Date.parse("2026-10-13T07:00:00.000Z"))?.recapDate).toBe("2026-10-12"); // mardi 9h
    expect(visibleWeeklyPeriod(Date.parse("2026-10-13T09:00:00.000Z"))).toBeNull();
  });
});

const score = (user_id: string, total_points: number) => ({
  user_id,
  total_points,
  correct_match_winners: 0,
  exact_margins: 0,
  bracket_points: 0,
});

const bet = (user_id: string, status: "WON" | "LOST", difficulty: number | null, proba: number | null): ScoredBetRow => ({
  user_id,
  description: `pari ${user_id} ${status} ${difficulty} ${proba}`,
  status,
  validated_difficulty: difficulty,
  calculated_proba: proba,
  points_awarded: status === "WON" ? 10 : 0,
});

function input(overrides: Partial<BuildInput> = {}): BuildInput {
  return {
    period: dailyPeriod(Date.parse("2026-10-06T15:00:00.000Z")),
    // Avant : A 1er (50), B 2e (40), C 3e (30). Après : C 1er (60), A 2e (52), B 3e (40).
    scores: [score("A", 52), score("B", 40), score("C", 60)],
    baseline: [
      { user_id: "A", rank: 1, total_points: 50 },
      { user_id: "B", rank: 2, total_points: 40 },
      { user_id: "C", rank: 3, total_points: 30 },
    ],
    pseudoById: new Map([
      ["A", "Alice"],
      ["B", "Bob"],
      ["C", "Chloé"],
    ]),
    predictions: [
      { user_id: "C", is_winner_correct: true, margin_diff: 0 },
      { user_id: "C", is_winner_correct: true, margin_diff: 4 },
      { user_id: "B", is_winner_correct: false, margin_diff: 9 },
    ],
    bets: [bet("A", "WON", 2, 0.4), bet("C", "WON", 4, 0.12), bet("B", "LOST", 3, 0.2)],
    nightMatches: [{ id: "m1", label: "BOS 112 - 104 NYK", articleUrl: null }],
    ...overrides,
  };
}

describe("contenu du récap", () => {
  it("points gagnés depuis le snapshot, rang et joueurs dépassés", () => {
    const recap = buildCompetitionRecap(input());
    const chloe = personalRecap(recap, "C")!;
    expect(chloe).toMatchObject({ pointsGained: 30, rank: 1, rankDelta: 2, correctWinners: 2, exactMargins: 1, betsWon: 1 });
    expect(chloe.passed.sort()).toEqual(["Alice", "Bob"]);
    expect(personalRecap(recap, "A")).toMatchObject({ pointsGained: 2, rank: 2, rankDelta: -1, passed: [] });
  });

  it("un prono perdu compte comme « avoir joué », sans point", () => {
    const recap = buildCompetitionRecap(input());
    expect(personalRecap(recap, "B")).toMatchObject({ pointsGained: 0, played: true, periodRank: null });
  });

  it("un joueur absent du snapshot de référence part de 0 et n'a pas d'évolution de rang", () => {
    const recap = buildCompetitionRecap(input({ scores: [...input().scores, score("D", 12)] }));
    expect(personalRecap(recap, "D")).toMatchObject({ pointsGained: 12, rankDelta: null });
  });

  it("meilleure nuit et plus gros pari réussi (difficulté puis proba)", () => {
    const recap = buildCompetitionRecap(input());
    expect(recap.topScorers.map((p) => p.pseudo)).toEqual(["Chloé"]);
    expect(recap.bestBet?.pseudo).toBe("Chloé");
    // Le journalier n'a pas de « plus loufoque perdu » ni de distinctions hebdo.
    expect(recap.craziestLostBet).toBeNull();
    expect(recap.weeklyTop).toEqual([]);
  });

  it("hebdo : classement de la semaine, remontée, sniper, plus loufoque perdu", () => {
    const recap = buildCompetitionRecap(
      input({
        period: weeklyPeriod("2026-10-12"),
        bets: [bet("A", "LOST", 3, 0.3), bet("B", "LOST", 3, 0.05), bet("C", "LOST", 5, null)],
      })
    );
    expect(recap.weeklyTop.map((p) => [p.pseudo, p.value])).toEqual([
      ["Chloé", 30],
      ["Alice", 2],
    ]);
    expect(recap.biggestClimb.map((p) => [p.pseudo, p.value])).toEqual([["Chloé", 2]]);
    expect(recap.sniper.map((p) => p.pseudo)).toEqual(["Chloé"]);
    // Difficulté d'abord : le 5 sans proba passe devant les 3.
    expect(recap.craziestLostBet?.pseudo).toBe("Chloé");
    expect(recap.periodRanks.get("B")).toBe(3);
  });

  it("à difficulté égale, la proba la plus faible l'emporte", () => {
    const recap = buildCompetitionRecap(
      input({ period: weeklyPeriod("2026-10-12"), bets: [bet("A", "LOST", 3, 0.3), bet("B", "LOST", 3, 0.05)] })
    );
    expect(recap.craziestLostBet?.pseudo).toBe("Bob");
  });

  it("ex-aequo crédités ensemble, personne si tout le monde est à 0", () => {
    // Gains : Alice +10, Bob 0, Chloé +10.
    const tied = buildCompetitionRecap(input({ scores: [score("A", 60), score("B", 40), score("C", 40)] }));
    expect(tied.topScorers.map((p) => p.pseudo)).toEqual(["Alice", "Chloé"]);
    const quiet = buildCompetitionRecap(
      input({ scores: [score("A", 50), score("B", 40), score("C", 30)], predictions: [], bets: [], nightMatches: [] })
    );
    expect(quiet.topScorers).toEqual([]);
    expect(quiet.hasActivity).toBe(false);
  });
});

describe("textes", () => {
  it("détail personnel", () => {
    const recap = buildCompetitionRecap(input());
    expect(personalDetail(personalRecap(recap, "C")!)).toBe("2 bons vainqueurs dont 1 écart exact · 1 pari gagné");
  });

  it("push journalier : points, rang, matchs du soir", () => {
    const recap = buildCompetitionRecap(input());
    expect(
      dailyPushText(personalRecap(recap, "C"), { matchesToPredict: 3, firstKickoffIso: "2026-10-06T23:00:00.000Z" })
    ).toEqual({
      title: "Ton récap du matin",
      body: "Cette nuit : +30 pts, tu passes 1er (▲2). 3 matchs à pronostiquer, premier coup d'envoi à 1h.",
    });
    expect(dailyPushText(personalRecap(recap, "A"), { matchesToPredict: 0, firstKickoffIso: null })?.body).toBe(
      "Cette nuit : +2 pts, tu recules 2e (▼1)."
    );
  });

  it("jamais de push journalier vide", () => {
    expect(dailyPushText(null, { matchesToPredict: 0, firstKickoffIso: null })).toBeNull();
  });

  it("heure de coup d'envoi lisible", () => {
    expect(kickoffHour("2026-10-06T23:00:00.000Z")).toBe("1h");
    expect(kickoffHour("2026-10-07T00:30:00.000Z")).toBe("2h30");
  });

  it("push hebdo : gagnant de la semaine, relance de ceux qui n'ont pas joué", () => {
    const recap = buildCompetitionRecap(input({ period: weeklyPeriod("2026-10-12") }));
    expect(weeklyPushText(recap, personalRecap(recap, "C"), "C")?.body).toBe(
      "+30 pts cette semaine, tu passes 1er (▲2). Tu remportes la semaine avec +30 pts !"
    );
    expect(weeklyPushText(recap, null, "Z")?.body).toBe(
      "Chloé remporte la semaine (+30 pts). À toi de jouer cette semaine !"
    );
  });
});

describe("TrashTalk", () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title><![CDATA[Les Celtics dominent les Knicks : Tatum à 40 points]]></title>
      <link>https://trashtalk.co/2026/10/06/celtics-knicks/</link><pubDate>Tue, 06 Oct 2026 06:10:00 GMT</pubDate></item>
    <item><title><![CDATA[Les Sixers s&#8217;inclinent encore]]></title>
      <link>https://trashtalk.co/2026/10/06/sixers/</link><pubDate>Tue, 06 Oct 2026 05:00:00 GMT</pubDate></item>
    <item><title><![CDATA[Celtics : la preview de la saison]]></title>
      <link>https://trashtalk.co/2026/10/01/preview/</link><pubDate>Thu, 01 Oct 2026 10:00:00 GMT</pubDate></item>
  </channel></rss>`;
  const articles = parseRssArticles(xml);

  it("lit titre, lien et date du flux", () => {
    expect(articles).toHaveLength(3);
    expect(articles[1].title).toBe("Les Sixers s’inclinent encore");
    expect(articles[0].publishedAt).toBe("2026-10-06T06:10:00.000Z");
  });

  it("surnoms d'équipe", () => {
    expect(teamKeywords("Philadelphia 76ers")).toEqual(["76ers", "sixers"]);
    expect(teamKeywords("Los Angeles Lakers")).toEqual(["lakers"]);
  });

  it("rattache l'article qui cite les deux équipes, publié depuis le début de la nuit", () => {
    const since = "2026-10-05T08:00:00.000Z";
    expect(articleForMatch(articles, "Boston Celtics", "New York Knicks", since)?.url).toBe(
      "https://trashtalk.co/2026/10/06/celtics-knicks/"
    );
    expect(articleForMatch(articles, "Philadelphia 76ers", "Miami Heat", since)?.url).toBe(
      "https://trashtalk.co/2026/10/06/sixers/"
    );
    // La preview du 01/10 est hors fenêtre.
    expect(articleForMatch(articles, "Boston Celtics", "Miami Heat", "2026-10-06T07:00:00.000Z")).toBeNull();
  });

  it("ne confond pas un surnom avec un mot plus long", () => {
    expect(articleForMatch(articles, "Utah Jazz", "Orlando Magic", "2026-01-01T00:00:00.000Z")).toBeNull();
  });
});
