import { describe, it, expect } from "vitest";
import { leaderboardHref, parseView } from "./href";

describe("parseView", () => {
  it("classement hebdo inactif : toujours Général, même avec ?vue=semaine", () => {
    expect(parseView(undefined, undefined, undefined, false)).toBe("general");
    expect(parseView("semaine", undefined, undefined, false)).toBe("general");
  });

  it("actif sans paramètre : Semaine par défaut", () => {
    expect(parseView(undefined, undefined, undefined, true)).toBe("semaine");
  });

  it("actif : ?vue explicite fait foi", () => {
    expect(parseView("general", undefined, undefined, true)).toBe("general");
    expect(parseView("semaine", "bets", undefined, true)).toBe("semaine");
  });

  it("actif : un ancien lien avec tri ou ordre ouvre la vue Générale", () => {
    expect(parseView(undefined, "bets", undefined, true)).toBe("general");
    expect(parseView(undefined, undefined, "asc", true)).toBe("general");
  });

  it("valeur de vue inconnue : retombe sur la règle par défaut", () => {
    expect(parseView("autre", undefined, undefined, true)).toBe("semaine");
    expect(parseView(["semaine"], undefined, undefined, true)).toBe("semaine");
  });
});

describe("leaderboardHref", () => {
  it("sans paramètre : URL nue, identique à l'ancien comportement", () => {
    expect(leaderboardHref({})).toBe("/leaderboard");
    expect(leaderboardHref({ tri: "total", ordre: "desc", ligue: null })).toBe("/leaderboard");
  });

  it("tri, ordre et ligue dans l'ordre historique", () => {
    expect(leaderboardHref({ tri: "bets", ordre: "asc", ligue: "lg" })).toBe("/leaderboard?tri=bets&ordre=asc&ligue=lg");
  });

  it("total est omis, ordre desc est omis", () => {
    expect(leaderboardHref({ tri: "total", ordre: "asc" })).toBe("/leaderboard?ordre=asc");
    expect(leaderboardHref({ tri: "form", ordre: "desc" })).toBe("/leaderboard?tri=form");
  });

  it("ajoute vue en premier", () => {
    expect(leaderboardHref({ vue: "general", tri: "bets", ligue: "lg" })).toBe("/leaderboard?vue=general&tri=bets&ligue=lg");
    expect(leaderboardHref({ vue: "semaine", ligue: "lg" })).toBe("/leaderboard?vue=semaine&ligue=lg");
  });
});
