import { describe, expect, it } from "vitest";
import { preselect } from "./preselect";
import { U1, U2, U3, bet, user, usersMap } from "./testFixtures";

const users = usersMap(user(U1, "Nico"), user(U2, "Alix"), user(U3, "Zoé"));

const won = (overrides = {}) =>
  bet({ status: "WON", resolution_reason: "Gagné.", description: "Brunson marque plus de 30 points", ...overrides });
const rejected = (overrides = {}) =>
  bet({
    status: "REJECTED",
    resolved_at: null,
    rejected_at: "2026-10-21T09:00:00Z",
    calculated_proba: null,
    resolution_reason: null,
    ...overrides,
  });

describe("exclusions", () => {
  it("compte chaque cause sans fuiter d'identifiant", () => {
    const result = preselect(
      [
        bet({ is_admin_corrected: true }),
        bet({ user_id: "inconnu" }),
        bet({ user_id: U3 }),
        bet({ description: "   " }),
        bet({ status: "CANCELLED" }),
        bet({ description: "Je parie comme @Nico" }),
        rejected({ rejected_at: null }),
        bet(),
      ],
      usersMap(user(U1, "Nico"), user(U3, "Zoé", { popup_mentions_opt_out: true })),
    );
    expect(result.excluded).toEqual({
      admin_corrige: 1,
      auteur_inactif: 1,
      opt_out: 1,
      texte_vide: 1,
      annule: 1,
      mention: 1,
      refus_sans_date: 1,
    });
    expect(result.flop).toHaveLength(1);
  });

  it("un auteur DISABLED est exclu", () => {
    const result = preselect([bet()], usersMap(user(U1, "Nico", { status: "DISABLED" })));
    expect(result.excluded.auteur_inactif).toBe(1);
  });
});

describe("raison", () => {
  it("nulle pour un pari résolu par un admin, qui reste possible en top", () => {
    const result = preselect([won({ resolved_by_admin_id: "admin-1" })], users);
    expect(result.top).toHaveLength(1);
    expect(result.top[0].raison).toBeNull();
  });
  it("jamais transmise pour un refusé", () => {
    const result = preselect([rejected({ resolution_reason: "note admin" })], users);
    expect(result.refuse[0].raison).toBeNull();
  });
});

describe("top", () => {
  it("difficulté décroissante, proba croissante, NULL en dernier, puis date et id", () => {
    const a = won({ id: "a", validated_difficulty: 3, calculated_proba: 0.5, user_id: U1 });
    const b = won({ id: "b", validated_difficulty: 5, calculated_proba: 0.9, user_id: U2 });
    const c = won({ id: "c", validated_difficulty: 5, calculated_proba: 0.2, user_id: U3 });
    const d = won({ id: "d", validated_difficulty: 5, calculated_proba: null, user_id: U1 });
    const e = won({ id: "e", validated_difficulty: null, calculated_proba: 0.1, user_id: U2 });
    const ids = preselect([a, b, c, d, e], users).top.map((p) => p.bet.id);
    expect(ids).toEqual(["c", "b", "d", "a", "e"]);
  });

  it("2 par joueur AVANT la coupe à 5", () => {
    const bets = Array.from({ length: 4 }, (_, i) =>
      won({ id: `n${i}`, user_id: U1, validated_difficulty: 10 - i }),
    ).concat([
      won({ id: "a1", user_id: U2, validated_difficulty: 1 }),
      won({ id: "z1", user_id: U3, validated_difficulty: 1 }),
      won({ id: "z2", user_id: U3, validated_difficulty: 1 }),
      won({ id: "z3", user_id: U3, validated_difficulty: 1 }),
    ]);
    const top = preselect(bets, users).top;
    expect(top.filter((p) => p.bet.user_id === U1)).toHaveLength(2);
    expect(top).toHaveLength(5);
    expect(top.map((p) => p.bet.id)).toEqual(["n0", "n1", "a1", "z1", "z2"]);
  });

  it("accepte un pari de série (match nul)", () => {
    const result = preselect([won({ scope: "SERIES", match_id: null })], users);
    expect(result.top).toHaveLength(1);
  });
});

describe("flop", () => {
  it("proba décroissante, NULL en dernier, coupe à 8", () => {
    const bets = Array.from({ length: 10 }, (_, i) =>
      bet({ id: `f${i}`, user_id: [U1, U2, U3][i % 3], calculated_proba: 0.1 + i / 20 }),
    );
    // 10 paris sur 3 joueurs, 2 par joueur : 6 retenus au plus.
    const flop = preselect(bets, users).flop;
    expect(flop).toHaveLength(6);
    expect(flop[0].bet.id).toBe("f9");
  });

  it("écarte un pari d'une famille inéligible et le compte", () => {
    const result = preselect([bet({ structured_stat: "fg", structured_player_id: null })], users);
    expect(result.flop).toHaveLength(0);
    expect(result.flopIneligible).toBe(1);
  });

  it("porte seuil et sens", () => {
    const result = preselect([bet()], users);
    expect(result.flop[0]).toMatchObject({ seuil: 25, sens: "plus de" });
  });

  it("texte inclusif à seuil entier : écarté du flop", () => {
    const result = preselect([bet({ description: "Shai fait au moins 25 points" })], users);
    expect(result.flop).toHaveLength(0);
  });
});

describe("refusés", () => {
  it("rejected_at croissant, coupe à 5", () => {
    const bets = [
      rejected({ id: "r3", user_id: U1, rejected_at: "2026-10-22T09:00:00Z" }),
      rejected({ id: "r1", user_id: U2, rejected_at: "2026-10-20T09:00:00Z" }),
      rejected({ id: "r2", user_id: U3, rejected_at: "2026-10-21T09:00:00Z" }),
    ];
    expect(preselect(bets, users).refuse.map((p) => p.bet.id)).toEqual(["r1", "r2", "r3"]);
  });
});

describe("zone Maïno : paris acceptés sous 5 %", () => {
  it("un pari gagné ou perdu à moins de 5 % va dans refuse, pas dans top ni flop", () => {
    const bets = [
      won({ id: "w-rare", user_id: U1, calculated_proba: 0.04 }),
      won({ id: "w-ok", user_id: U2, calculated_proba: 0.05 }),
      bet({ id: "l-rare", user_id: U3, status: "LOST", calculated_proba: 0.01, description: "Utah gagne les 4 quarts temps" }),
    ];
    const result = preselect(bets, users);
    expect(result.refuse.map((p) => p.bet.id).sort()).toEqual(["l-rare", "w-rare"]);
    expect(result.top.map((p) => p.bet.id)).toEqual(["w-ok"]);
    expect(result.flop).toHaveLength(0);
  });
  it("garde la raison d'un pari accepté, pas d'un refusé", () => {
    const result = preselect([won({ id: "w", calculated_proba: 0.02 }), rejected({ id: "r" })], users);
    expect(result.refuse.find((p) => p.bet.id === "w")?.raison).toBe("Gagné.");
    expect(result.refuse.find((p) => p.bet.id === "r")?.raison).toBeNull();
  });
});
