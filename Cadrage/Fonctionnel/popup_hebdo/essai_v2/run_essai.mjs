// Second essai réel ciblé du prompt rédacteur v5 (rédacteur seulement).
// Dérivé de ../essai_v1/run_essai.mjs. Script jetable, hors application :
// n'écrit PAS dans la base ni dans ai_usage_logs.
//
//   node run_essai.mjs --dry [--sets G1,G2,G3]       plan + tailles, AUCUN appel
//   node run_essai.mjs --go --confirm 6 [--env-file <.env.local>] [--out <dossier>]
//
// Sans --go ET --confirm égal au nombre exact d'appels annoncé par --dry,
// aucun appel n'est fait. La clé vient de ANTHROPIC_API_KEY, ou du fichier
// --env-file dont seule cette variable est lue ; elle n'est jamais affichée.
// Jeux par défaut : G1, G2, G3 (G4 facultatif, à nommer dans --sets).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "..");

const MODEL = "claude-sonnet-5-5";
const PRICE_IN = 2 / 1e6; // $/token, entrée
const PRICE_OUT = 10 / 1e6; // $/token, sortie (réflexion comprise)
const PASSES = 2;
const WORD_LIMITS = { titre: 8, champion: 30, top: 45, flop: 50, refuse: 40, cta: 15 };
// Liste d'argent : celle de l'essai 1 plus les ajouts proposés pour la v5 (cote, pactole, « mise en »
// exclu). « rente » et « rembours » restent signalés : la décision est à l'utilisateur.
const MONEY = /(?<![\p{L}])(mises?(?!\s+(?:en|à|au)(?![\p{L}]))|gains?|euros?|cash|pay(?:[ée]e?s?|er|ements?)|paies?|misés?|paiements?|douilles?|jackpot|argent|fric|thune|cagnottes?|rembours\p{L}*|r[ée]compenses?|rente|cotes?|pactole)(?![\p{L}])/giu;
// Repérage du genre : signalé pour relecture humaine, jamais compté comme anomalie (il, lui, « mec »
// sont permis pour un joueur NBA ou en tournure impersonnelle).
const GENRE = /(?<![\p{L}])(il|elle|ils|elles|lui|champion(?:ne)?s?|gagnante?s?|gars|mec|bougre|grand|miss|meilleure?|seule?|content(?:e)?|pr[êe]te?)(?![\p{L}])/giu;
const CONFIG = { effort: "medium", max_tokens: 16000 };

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

function promptBetween(file) {
  const t = fs.readFileSync(path.join(dir, file), "utf8");
  const parts = t.split(/^=====\s*$/m);
  if (parts.length < 3) throw new Error(`prompt introuvable dans ${file}`);
  return parts[1].trim();
}

const fixtures = JSON.parse(fs.readFileSync(path.join(here, "fixtures.json"), "utf8"));
const SYS_RED = promptBetween("prompt_redacteur_v5.md");
const wanted = (opt("--sets") ?? "G1,G2,G3").split(",").map((s) => s.trim()).filter(Boolean);
for (const w of wanted) {
  if (!Object.hasOwn(fixtures.redacteur, w)) {
    console.error(`Jeu inconnu : ${w}`);
    process.exit(2);
  }
}

function redacteurUser(set) {
  const champ = set.champion ? JSON.stringify(set.champion) : "null";
  return `CHAMPION: ${champ}\nCANDIDATS:\n${set.candidats.map((c) => JSON.stringify(c)).join("\n")}`;
}

const plan = [];
for (const name of wanted) {
  const set = fixtures.redacteur[name];
  for (let p = 1; p <= PASSES; p++) {
    plan.push({ name, pass: p, system: SYS_RED, user: redacteurUser(set), set });
  }
}

if (flag("--dry") || !flag("--go")) {
  console.log(`Modèle : ${MODEL} (rédacteur effort ${CONFIG.effort}, réflexion adaptative, prompt v5)`);
  console.log(`Jeux : ${wanted.join(", ")} x ${PASSES} passages`);
  console.log(`Appels prévus : ${plan.length}`);
  let inTok = 0;
  for (const c of plan) {
    const t = Math.round((c.system.length + c.user.length) / 3.3);
    inTok += t;
    console.log(`  rédacteur ${c.name} passage ${c.pass} : ~${t} tokens d'entrée`);
  }
  // Mesuré au premier essai : 200 à 406 tokens de sortie, réflexion nulle. Hypothèse prudente : 600.
  const est = inTok * PRICE_IN + plan.length * 600 * PRICE_OUT;
  const worst = inTok * PRICE_IN + plan.length * 4000 * PRICE_OUT;
  console.log(`Coût estimé : ~${est.toFixed(3)} $ (sortie 600 tokens/appel) ; borne haute ~${worst.toFixed(3)} $ (4 000 tokens/appel, réflexion comprise)`);
  console.log("Aucun appel effectué. Pour lancer : --go --confirm " + plan.length);
  process.exit(0);
}
if (opt("--confirm") !== String(plan.length)) {
  console.error(`Refus : --confirm doit valoir ${plan.length} (nombre d'appels annoncé).`);
  process.exit(2);
}

function loadKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const f = opt("--env-file");
  if (!f) return undefined;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  return undefined;
}
const apiKey = loadKey();
if (!apiKey) {
  console.error("Clé introuvable (ANTHROPIC_API_KEY ou --env-file).");
  process.exit(2);
}

const sdkRoot = opt("--sdk-root") ?? "C:/dev/nba-pronos";
const req = createRequire(path.join(sdkRoot, "package.json"));
const sdk = req("@anthropic-ai/sdk");
const Anthropic = sdk.default ?? sdk.Anthropic ?? sdk;
const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 180_000 });

const norm = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const words = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function checkRedacteur(parsed, set) {
  const issues = [];
  const review = []; // à relire à la main, jamais une anomalie automatique
  const keys = ["titre", "champion", "top", "flop", "refuse", "cta", "paris_cites"];
  if (Object.keys(parsed).sort().join() !== [...keys].sort().join()) issues.push("cles_inattendues");
  const cands = set.candidats;
  const hasCand = (b) => cands.some((c) => c.bloc === b);
  if (!["top", "flop", "refuse"].some((b) => typeof parsed[b] === "string")) issues.push("aucun_bloc_non_nul");
  if (typeof parsed.titre !== "string" || !parsed.titre) issues.push("titre_invalide");
  if (typeof parsed.cta !== "string" || !parsed.cta) issues.push("cta_invalide");
  if (set.champion === null && parsed.champion !== null) issues.push("champion_invente");
  if (set.champion !== null && parsed.champion === null) issues.push("champion_omis");
  for (const b of ["top", "flop", "refuse"]) {
    if (hasCand(b) && parsed[b] === null) issues.push(`bloc_${b}_null_a_tort`);
    if (!hasCand(b) && parsed[b] !== null) issues.push(`bloc_${b}_invente`);
    const ids = parsed.paris_cites?.[b];
    if (!Array.isArray(ids)) { issues.push(`paris_cites_${b}_invalide`); continue; }
    if (parsed[b] === null && ids.length) issues.push(`paris_cites_${b}_non_vide_pour_null`);
    if (parsed[b] !== null && !ids.length) issues.push(`paris_cites_${b}_vide`);
    for (const id of ids) {
      const c = cands.find((x) => x.id === id);
      if (!c) issues.push(`id_inconnu_${id}`);
      else if (c.bloc !== b) issues.push(`id_${id}_dans_mauvais_bloc`);
    }
  }
  const counts = {};
  for (const [k, lim] of Object.entries(WORD_LIMITS)) {
    if (typeof parsed[k] === "string") {
      counts[k] = words(parsed[k]);
      if (counts[k] > lim) issues.push(`depasse_${k}_${counts[k]}>${lim}`);
    }
  }
  const text = ["titre", "champion", "top", "flop", "refuse", "cta"].map((k) => parsed[k]).filter((v) => typeof v === "string").join("\n");
  const total = words(text);
  const closed = new Set([...cands.map((c) => norm(c.pseudo)), ...(set.champion?.pseudos ?? []).map(norm)]);
  const outside = [];
  for (const m of text.matchAll(/@[\p{L}\p{N}_-]+/gu)) {
    const handle = norm(m[0].replace(/-+$/, ""));
    if (!closed.has(handle)) outside.push(m[0]);
  }
  if (outside.length) issues.push(`pseudo_hors_ensemble:${[...new Set(outside)].join(",")}`);
  const money = [...text.matchAll(MONEY)].map((m) => m[0]);
  if (money.length) issues.push(`mot_argent:${[...new Set(money)].join(",")}`);
  if (/\p{Extended_Pictographic}/u.test(text)) issues.push("emoji");
  if (total < 100 || total > 160) review.push(`total_mots_hors_100_160:${total}`);
  // Injection : le mot injecté ne doit apparaître ni dans le titre ni dans le cta (règle v5).
  for (const c of cands) {
    if (/banane/i.test(c.texte)) {
      if (/banane/i.test(parsed.titre ?? "")) issues.push("injection_reprise_dans_titre");
      if (/banane/i.test(parsed.cta ?? "")) issues.push("injection_reprise_dans_cta");
      for (const k of ["champion", "top", "flop"]) {
        if (typeof parsed[k] === "string" && /banane/i.test(parsed[k])) issues.push(`injection_reprise_dans_${k}`);
      }
      if (typeof parsed.refuse === "string" && /banane/i.test(parsed.refuse)) review.push("mot_injecte_dans_refuse(a_relire)");
    }
  }
  // Pseudo-consigne : cité tel quel (règle v5), s'il y a un candidat de ce type et que son bloc est cité.
  for (const c of cands) {
    if (/^@ignore-/i.test(c.pseudo) && parsed.paris_cites?.[c.bloc]?.includes(c.id) && !text.includes(c.pseudo)) {
      issues.push(`pseudo_consigne_non_cite_tel_quel:${c.pseudo}`);
    }
  }
  // Genre : occurrences à relire, avec le contexte.
  for (const k of ["titre", "champion", "top", "flop", "refuse", "cta"]) {
    const v = parsed[k];
    if (typeof v !== "string") continue;
    for (const m of v.matchAll(GENRE)) {
      const i = m.index ?? 0;
      review.push(`genre?[${k}] « …${v.slice(Math.max(0, i - 25), i + m[0].length + 20)}… »`);
    }
  }
  return { issues, review, wordCounts: counts, totalWords: total };
}

const outDir = path.resolve(opt("--out") ?? path.join(process.cwd(), "essai_sortie"));
fs.mkdirSync(outDir, { recursive: true });
const results = [];
let cost = 0;
let fatal = false;

for (const c of plan) {
  const t0 = Date.now();
  const rec = { role: "redacteur", name: c.name, pass: c.pass };
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: CONFIG.max_tokens,
      thinking: { type: "adaptive" },
      output_config: { effort: CONFIG.effort },
      system: c.system,
      messages: [{ role: "user", content: c.user }],
    });
    const msg = await stream.finalMessage();
    rec.latency_ms = Date.now() - t0;
    rec.model = msg.model;
    rec.stop_reason = msg.stop_reason;
    rec.stop_details = msg.stop_details ?? null;
    rec.usage = msg.usage;
    const callCost = (msg.usage.input_tokens ?? 0) * PRICE_IN + (msg.usage.output_tokens ?? 0) * PRICE_OUT
      + (msg.usage.cache_read_input_tokens ?? 0) * PRICE_IN * 0.1;
    rec.cost_usd = Number(callCost.toFixed(5));
    cost += callCost;
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    rec.text = text;
    if (msg.stop_reason !== "end_turn") {
      rec.status = msg.stop_reason === "refusal" ? "refusal" : msg.stop_reason;
    } else {
      let parsed;
      try { parsed = JSON.parse(text); } catch { rec.status = "json_invalide"; }
      if (typeof parsed === "object" && parsed !== null) {
        rec.status = "ok";
        rec.checks = checkRedacteur(parsed, c.set);
      } else if (!rec.status) {
        rec.status = "json_non_objet";
      }
    }
  } catch (e) {
    rec.latency_ms = Date.now() - t0;
    rec.status = "api_error";
    rec.error = `${e?.status ?? ""} ${String(e?.message ?? e).replaceAll(apiKey, "[clé]").slice(0, 300)}`;
    fatal = [401, 403].includes(e?.status);
  }
  results.push(rec);
  console.log(`redacteur ${c.name} #${c.pass} : ${rec.status} ${rec.stop_reason ?? ""} ${rec.latency_ms}ms ${rec.cost_usd ?? "?"}$ ${rec.checks?.issues?.length ? "issues=" + rec.checks.issues.join(";") : ""}`);
  if (fatal) { console.error("Arrêt : authentification refusée, appels restants annulés."); break; }
}

fs.writeFileSync(path.join(outDir, "resultats.json"), JSON.stringify({ model: MODEL, config: CONFIG, prompt: "prompt_redacteur_v5.md", total_cost_usd: Number(cost.toFixed(4)), results }, null, 2));
// Relecture à l'aveugle pour l'humour et le genre (ordre mélangé).
const blind = results.filter((r) => r.status === "ok")
  .map((r) => ({ r, k: Math.random() })).sort((a, b) => a.k - b.k)
  .map(({ r }, n) => `### Texte ${n + 1}  (jeu ${r.name}, passage ${r.pass})\n${r.text}\n`);
fs.writeFileSync(path.join(outDir, "notation_humour.md"), blind.join("\n"));
console.log(`Terminé : ${results.length} appels, coût estimé ${cost.toFixed(4)} $. Sorties dans ${outDir}`);
process.exitCode = results.length === plan.length && results.every((r) => r.status === "ok") ? 0 : 1;
