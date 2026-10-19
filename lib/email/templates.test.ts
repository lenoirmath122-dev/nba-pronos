import { describe, expect, it } from "vitest";
import { escapeHtml, relanceEmail, reminderEmail, resultEmail } from "@/lib/email/templates";

describe("resultEmail", () => {
  const base = {
    pseudo: "Tom",
    pointsGained: 20,
    rank: 3,
    rankDelta: 2,
    lines: [{ label: "BOS 112 - 104 NYK", winnerCorrect: true, marginDiff: 0, points: 20 }],
    next: { label: "LAL - DEN", kickoff: "3h" },
    playUrl: "https://panierballon.fr/play",
    unsubscribeUrl: "https://panierballon.fr/api/email/unsubscribe?token=x",
  };

  it("annonce les points dans le sujet et détaille chaque prono", () => {
    const mail = resultEmail(base);
    expect(mail.subject).toContain("20 pts");
    expect(mail.text).toContain("BOS 112 - 104 NYK : bon vainqueur, écart exact · +20 pts");
    expect(mail.text).toContain("Tu es 3e au classement (en hausse de 2)");
    expect(mail.text).toContain("LAL - DEN");
  });

  it("garde un sujet neutre sans point et contient le lien de désinscription", () => {
    const mail = resultEmail({ ...base, pointsGained: 0, lines: [{ label: "A 1 - 2 B", winnerCorrect: false, marginDiff: null, points: 0 }] });
    expect(mail.subject).not.toContain("rapporté");
    expect(mail.text).toContain("A 1 - 2 B : raté · +0 pt");
    expect(mail.html).toContain("Me désinscrire");
  });

  it("échappe le pseudo dans le HTML", () => {
    const mail = resultEmail({ ...base, pseudo: "<b>x</b>" });
    expect(mail.html).not.toContain("<b>x</b>");
    expect(mail.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("relanceEmail", () => {
  it("propose de récupérer les points s'il y en a", () => {
    const mail = relanceEmail({ pseudo: "Tom", pointsPending: 20, validateUrl: "https://panierballon.fr/v" });
    expect(mail.subject).toContain("20 pts");
    expect(mail.text).toContain("récupérer");
  });

  it("propose de jouer ce soir sans point", () => {
    const mail = relanceEmail({ pseudo: "Tom", pointsPending: 0, validateUrl: "https://panierballon.fr/v" });
    expect(mail.text).toContain("jouer ce soir");
    expect(mail.html).not.toContain("Me désinscrire");
  });
});

describe("reminderEmail", () => {
  const base = {
    pseudo: "Tom",
    matchLabel: "LAL - DEN",
    kickoff: "3h",
    homeSharePercent: 62,
    homeAbbreviation: "LAL",
    awayAbbreviation: "DEN",
    playUrl: "https://panierballon.fr/play",
    unsubscribeUrl: "https://panierballon.fr/api/email/unsubscribe?token=x",
  };

  it("affiche la répartition quand elle est connue", () => {
    expect(reminderEmail(base).text).toContain("62 % pour LAL, 38 % pour DEN");
  });

  it("dit « cette nuit » pour un coup d'envoi après minuit et « ce soir » sinon", () => {
    expect(reminderEmail(base).subject).toBe("LAL - DEN cette nuit, ton prono ?");
    expect(reminderEmail({ ...base, kickoff: "21h30" }).subject).toBe("LAL - DEN ce soir, ton prono ?");
  });

  it("omet la répartition sous le seuil", () => {
    expect(reminderEmail({ ...base, homeSharePercent: null }).text).not.toContain("%");
  });
});

describe("escapeHtml", () => {
  it("échappe les caractères sensibles", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
});
