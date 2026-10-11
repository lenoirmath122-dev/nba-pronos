// Essai réel minimal des prompts popup hebdo (rédacteur v4, classifieur v1).
// Script jetable, hors application : n'écrit PAS dans la base ni dans ai_usage_logs.
//
//   node run_essai.mjs --dry                      plan + tailles, AUCUN appel
//   node run_essai.mjs --go --confirm 11 [--env-file <.env.local>] [--out <dossier>]
//
// Sans --go ET --confirm égal au nombre exact d'appels annoncé par --dry,
// aucun appel n'est fait. La clé vient de ANTHROPIC_API_KEY, ou du fichier
// --env-file dont seule cette variable est lue ; elle n'est jamais affichée.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "..");

const MODEL = "claude-sonnet-5-5";
const PRICE_IN = 2 / 1e6; // $/token, entrée
const PRICE_OUT = 10 / 1e6; // $/token, sortie (réflexion comprise)
const PASSES_REDACTEUR = 2;
const PASSES_CLASSIFIEUR = 3;
const WORD_LIMITS = { titre: 8, champion: 30, top: 45, flop: 50, refuse: 40, cta: 15 };
const MONEY = /(?<![\p{L}])(mises?|gains?|euros?|cash|pay[ée]s?|paies?|douilles?|jackpot|argent|fric|thune|cagnottes?|rembours\p{L}*|r[ée]compenses?|rente)(?![\p{L}])/giu;
const CONFIG = {
  redacteur: { effort: "medium", max_tokens: 16000 },
  classifieur: { effort: "low", max_tokens: 8000 },
};

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
const SYS_RED = promptBetween("prompt_redacteur_v4.md");
const SYS_CLA = promptBetween("prompt_classifieur_v1.md");

function redacteurUser(set) {
  const champ = set.champion ? JSON.stringify(set.champion) : "null";
  return `CHAMPION: ${champ}\nCANDIDATS:\n${set.candidats.map((c) => JSON.stringify(c)).join("\n")}`;
}
function classifieurUser(lot) {
  return lot.map(({ id, pseudo, texte }) => JSON.stringify({ id, pseudo, texte })).join("\n");
}

const plan = [];
for (const [name, set] of Object.entries(fixtures.redacteur)) {
  for (let p = 1; p <= PASSES_REDACTEUR; p++) {
    plan.push({ role: "redacteur", name, pass: p, system: SYS_RED, user: redacteurUser(set), set });
  }
}
for (let p = 1; p <= PASSES_CLASSIFIEUR; p++) {
  plan.push({ role: "classifieur", name: "lot20", pass: p, system: SYS_CLA, user: classifieurUser(fixtures.classifieur.lot), set: fixtures.classifieur });
}

if (flag("--dry") || !flag("--go")) {
  console.log(`Modèle : ${MODEL} (rédacteur effort ${CONFIG.redacteur.effort}, classifieur effort ${CONFIG.classifieur.effort}, réflexion adaptative)`);
  console.log(`Appels prévus : ${plan.length}`);
  for (const c of plan) {
    const chars = c.system.length + c.user.length;
    console.log(`  ${c.role} ${c.name} passage ${c.pass} : ~${Math.round(chars / 3.3)} tokens d'entrée`);
  }
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
  if (/banane/i.test(text)) issues.push("mot_injecte_repris(blague_toleree_par_le_prompt?)");
  return { issues, wordCounts: counts, totalWords: total };
}

function checkClassifieur(parsed, lot) {
  const issues = [];
  if (!Array.isArray(parsed?.verdicts)) return { issues: ["verdicts_absent"] };
  const seen = new Set();
  const byId = new Map();
  for (const v of parsed.verdicts) {
    if (!v || typeof v !== "object") { issues.push("verdict_non_objet"); continue; }
    if (!/^[a-z][0-9]{1,3}$/.test(v.id ?? "")) issues.push(`id_mal_forme_${v.id}`);
    if (!["ok", "bloque"].includes(v.verdict)) issues.push(`verdict_inconnu_${v.id}`);
    if (v.verdict === "ok" && v.categorie !== null) issues.push(`categorie_non_nulle_${v.id}`);
    if (v.verdict === "bloque" && !["racisme", "discrimination", "manipulation", "doute"].includes(v.categorie)) issues.push(`categorie_invalide_${v.id}`);
    if (seen.has(v.id)) issues.push(`doublon_${v.id}`);
    seen.add(v.id);
    if (!byId.has(v.id) || v.verdict !== "ok") byId.set(v.id, v); // doublon : le plus restrictif gagne
  }
  const ids = lot.map((l) => l.id);
  for (const id of ids) if (!byId.has(id)) issues.push(`manquant_${id}`);
  for (const id of seen) if (!ids.includes(id)) issues.push(`id_en_trop_${id}`);
  const order = parsed.verdicts.map((v) => v?.id).join();
  if (order !== ids.join()) issues.push("ordre_different");
  let tp = 0, fn = 0, fp = 0, tn = 0;
  const errors = [];
  for (const l of lot) {
    const v = byId.get(l.id)?.verdict === "ok" ? "ok" : "bloque"; // échec fermé : tout sauf « ok » bloque
    if (l.attendu === "bloque") { v === "bloque" ? tp++ : (fn++, errors.push(`${l.id}:faux_negatif`)); }
    if (l.attendu === "ok") { v === "ok" ? tn++ : (fp++, errors.push(`${l.id}:faux_positif`)); }
  }
  return { issues, tp, fn, fp, tn, errors, verdicts: Object.fromEntries([...byId].map(([k, v]) => [k, `${v.verdict}${v.categorie ? "/" + v.categorie : ""}`])) };
}

const outDir = path.resolve(opt("--out") ?? path.join(process.cwd(), "essai_sortie"));
fs.mkdirSync(outDir, { recursive: true });
const results = [];
let cost = 0;
let fatal = false;

for (const c of plan) {
  const cfg = CONFIG[c.role];
  const t0 = Date.now();
  const rec = { role: c.role, name: c.name, pass: c.pass };
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: cfg.max_tokens,
      thinking: { type: "adaptive" },
      output_config: { effort: cfg.effort },
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
        rec.checks = c.role === "redacteur" ? checkRedacteur(parsed, c.set) : checkClassifieur(parsed, c.set.lot);
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
  console.log(`${c.role} ${c.name} #${c.pass} : ${rec.status} ${rec.stop_reason ?? ""} ${rec.latency_ms}ms ${rec.cost_usd ?? "?"}$ ${rec.checks?.issues?.length ? "issues=" + rec.checks.issues.join(";") : ""}`);
  if (fatal) { console.error("Arrêt : authentification refusée, appels restants annulés."); break; }
}

fs.writeFileSync(path.join(outDir, "resultats.json"), JSON.stringify({ model: MODEL, config: CONFIG, total_cost_usd: Number(cost.toFixed(4)), results }, null, 2));
// Fichier pour la notation de l'humour à l'aveugle (rédacteur seulement, ordre mélangé).
const blind = results.filter((r) => r.role === "redacteur" && r.status === "ok")
  .map((r, i) => ({ r, k: Math.random(), i })).sort((a, b) => a.k - b.k)
  .map(({ r }, n) => `### Texte ${n + 1}  (jeu ${r.name}, passage ${r.pass})\n${r.text}\n`);
fs.writeFileSync(path.join(outDir, "notation_humour.md"), blind.join("\n"));
console.log(`Terminé : ${results.length} appels, coût estimé ${cost.toFixed(4)} $. Sorties dans ${outDir}`);
process.exitCode = results.length === plan.length && results.every((r) => r.status === "ok") ? 0 : 1;
