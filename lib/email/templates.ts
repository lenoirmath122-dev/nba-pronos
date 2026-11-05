// Modèles des e-mails planifiés (1B). Module pur : aucune lecture de base ni
// d'environnement, tout arrive en paramètre. Mise en page à tables, styles en
// ligne, une seule colonne de 560 px max : lisible dans Gmail, Outlook et
// Apple Mail sur téléphone.

export type EmailContent = { subject: string; html: string; text: string };

export type ResultLine = {
  /** « BOS 112 - 104 NYK ». */
  label: string;
  winnerCorrect: boolean;
  /** Écart pronostiqué − écart réel, en valeur absolue ; null si inconnu. */
  marginDiff: number | null;
  points: number;
};

export type NextMatch = { label: string; kickoff: string };

const NAVY = "#0B1F3A";
const ORANGE = "#F97316";
const MUTED = "#5B6B82";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** « 1h30 » est après minuit : on dit « cette nuit », pas « ce soir ». */
function when(kickoff: string): string {
  return Number.parseInt(kickoff, 10) < 6 ? "cette nuit" : "ce soir";
}

function pts(points: number): string {
  return `${points} pt${points > 1 ? "s" : ""}`;
}

type Layout = {
  preheader: string;
  title: string;
  paragraphs: string[];
  rows?: string[];
  buttonLabel: string;
  buttonUrl: string;
  footer: string;
};

function layout(input: Layout): string {
  const rows = (input.rows ?? [])
    .map(
      (row) =>
        `<tr><td style="padding:10px 0;border-top:1px solid #E4E9F0;font-size:15px;line-height:21px;color:${NAVY}">${escapeHtml(row)}</td></tr>`
    )
    .join("");
  const paragraphs = input.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:23px;color:${NAVY}">${escapeHtml(p)}</p>`)
    .join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:0;background:#F3F5F9">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F9"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:12px">
<tr><td style="padding:20px 24px 0;font:700 15px Arial,Helvetica,sans-serif;color:${ORANGE}">Panier Ballon</td></tr>
<tr><td style="padding:8px 24px 0;font:700 22px/28px Arial,Helvetica,sans-serif;color:${NAVY}">${escapeHtml(input.title)}</td></tr>
<tr><td style="padding:14px 24px 0;font-family:Arial,Helvetica,sans-serif">${paragraphs}</td></tr>
${rows ? `<tr><td style="padding:0 24px 8px;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>` : ""}
<tr><td style="padding:12px 24px 24px"><a href="${escapeHtml(input.buttonUrl)}" style="display:inline-block;background:${ORANGE};color:#FFFFFF;font:700 16px Arial,Helvetica,sans-serif;text-decoration:none;padding:14px 22px;border-radius:8px">${escapeHtml(input.buttonLabel)}</a></td></tr>
<tr><td style="padding:16px 24px 22px;border-top:1px solid #E4E9F0;font:12px/18px Arial,Helvetica,sans-serif;color:${MUTED}">${input.footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function footer(unsubscribeUrl: string | null, what: string): string {
  const base = "Panier Ballon · Gratuit, que des points, aucun argent réel · 15 ans et plus.";
  if (!unsubscribeUrl) return base;
  return `${base}<br>Tu reçois cet e-mail parce que tu as demandé ${escapeHtml(what)}. <a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED}">Me désinscrire</a>`;
}

function plain(parts: string[], buttonLabel: string, buttonUrl: string, unsubscribeUrl: string | null): string {
  const lines = [...parts, "", `${buttonLabel} : ${buttonUrl}`];
  if (unsubscribeUrl) lines.push("", `Me désinscrire : ${unsubscribeUrl}`);
  return lines.join("\n");
}

function resultLine(line: ResultLine): string {
  const verdict = !line.winnerCorrect
    ? "raté"
    : line.marginDiff === 0
      ? "bon vainqueur, écart exact"
      : "bon vainqueur";
  return `${line.label} : ${verdict} · +${pts(line.points)}`;
}

export type ResultEmailInput = {
  pseudo: string;
  pointsGained: number;
  rank: number | null;
  rankDelta: number | null;
  lines: ResultLine[];
  next: NextMatch | null;
  playUrl: string;
  unsubscribeUrl: string;
};

export function resultEmail(input: ResultEmailInput): EmailContent {
  const gained = input.pointsGained > 0;
  const subject = gained
    ? `Tes pronos t'ont rapporté ${pts(input.pointsGained)} 🏀`
    : "Le résultat de tes pronos de cette nuit";
  const paragraphs = [
    gained ? `Salut ${input.pseudo}, belle nuit : +${pts(input.pointsGained)}.` : `Salut ${input.pseudo}, pas de points cette nuit.`,
  ];
  if (input.rank !== null) {
    const place = input.rank === 1 ? "1er" : `${input.rank}e`;
    const move =
      input.rankDelta === null || input.rankDelta === 0
        ? "inchangé"
        : input.rankDelta > 0
          ? `en hausse de ${input.rankDelta}`
          : `en baisse de ${-input.rankDelta}`;
    paragraphs.push(`Tu es ${place} au classement (${move}).`);
  }
  if (input.next) paragraphs.push(`${when(input.next.kickoff) === "ce soir" ? "Ce soir" : "Cette nuit"} : ${input.next.label}, coup d'envoi à ${input.next.kickoff}.`);
  const rows = input.lines.map(resultLine);
  const buttonLabel = "Faire mon prono de ce soir";
  const what = "tes résultats par e-mail";
  return {
    subject,
    html: layout({
      preheader: paragraphs[0],
      title: "Ton résultat du matin",
      paragraphs,
      rows,
      buttonLabel,
      buttonUrl: input.playUrl,
      footer: footer(input.unsubscribeUrl, what),
    }),
    text: plain([...paragraphs, "", ...rows], buttonLabel, input.playUrl, input.unsubscribeUrl),
  };
}

export type RelanceEmailInput = {
  pseudo: string;
  pointsPending: number;
  validateUrl: string;
};

export function relanceEmail(input: RelanceEmailInput): EmailContent {
  const gained = input.pointsPending > 0;
  const subject = gained
    ? `Tes pronos t'ont rapporté ${pts(input.pointsPending)}, valide ton compte`
    : "Valide ton compte pour jouer ce soir";
  const paragraphs = gained
    ? [
        `Salut ${input.pseudo}, tes pronos t'ont rapporté ${pts(input.pointsPending)}.`,
        "Valide ton compte pour les récupérer. Un clic suffit.",
      ]
    : [
        `Salut ${input.pseudo}, tes pronos de cette nuit n'ont pas rapporté de points.`,
        "Valide ton compte pour jouer ce soir. Un clic suffit.",
      ];
  const buttonLabel = "Valider mon compte";
  const note = `${footer(null, "")} Cet e-mail est le seul rappel pour valider ton compte ; sans validation, tes pronos seront effacés au bout de 7 jours.`;
  return {
    subject,
    html: layout({ preheader: paragraphs[0], title: "Ton compte t'attend", paragraphs, buttonLabel, buttonUrl: input.validateUrl, footer: note }),
    text: plain([...paragraphs, "", "Sans validation, tes pronos seront effacés au bout de 7 jours."], buttonLabel, input.validateUrl, null),
  };
}

export type WeeklyPopupEmailInput = {
  pseudo: string;
  titre: string;
  /** Blocs déjà résolus (jetons remplacés par les pseudos), dans l'ordre d'affichage. */
  sections: { heading: string; text: string }[];
  /** Texte de repli (popup FALLBACK) : remplace les blocs. */
  repli: string | null;
  cta: string;
  playUrl: string;
  unsubscribeUrl: string;
};

export function weeklyPopupEmail(input: WeeklyPopupEmailInput): EmailContent {
  const paragraphs = [`Salut ${input.pseudo}, le récap de la semaine est là.`];
  if (input.repli) paragraphs.push(input.repli);
  const rows = input.repli ? [] : input.sections.map((section) => `${section.heading} : ${section.text}`);
  if (input.cta) paragraphs.push(input.cta);
  const buttonLabel = "Faire mon prono de ce soir";
  const what = "tes résultats par e-mail";
  return {
    subject: input.titre,
    html: layout({
      preheader: input.titre,
      title: input.titre,
      paragraphs,
      rows,
      buttonLabel,
      buttonUrl: input.playUrl,
      footer: footer(input.unsubscribeUrl, what),
    }),
    text: plain([...paragraphs, "", ...rows], buttonLabel, input.playUrl, input.unsubscribeUrl),
  };
}

export type ReminderEmailInput = {
  pseudo: string;
  matchLabel: string;
  kickoff: string;
  /** Part de pronos pour l'équipe à domicile, 0..100 ; null sous le seuil d'affichage. */
  homeSharePercent: number | null;
  homeAbbreviation: string;
  awayAbbreviation: string;
  playUrl: string;
  unsubscribeUrl: string;
};

export function reminderEmail(input: ReminderEmailInput): EmailContent {
  const subject = `${input.matchLabel} ${when(input.kickoff)}, ton prono ?`;
  const paragraphs = [
    `Salut ${input.pseudo}, ${input.matchLabel} ${when(input.kickoff)}, coup d'envoi à ${input.kickoff}.`,
    "Tu n'as pas encore fait ton prono.",
  ];
  if (input.homeSharePercent !== null) {
    paragraphs.push(
      `Pour l'instant : ${input.homeSharePercent} % pour ${input.homeAbbreviation}, ${100 - input.homeSharePercent} % pour ${input.awayAbbreviation}.`
    );
  }
  const buttonLabel = "Faire mon prono";
  const what = "un rappel avant le match du soir";
  return {
    subject,
    html: layout({
      preheader: paragraphs[0],
      title: "Ton prono du jour",
      paragraphs,
      buttonLabel,
      buttonUrl: input.playUrl,
      footer: footer(input.unsubscribeUrl, what),
    }),
    text: plain(paragraphs, buttonLabel, input.playUrl, input.unsubscribeUrl),
  };
}
