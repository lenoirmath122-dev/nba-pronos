// Rapport de routage du catalogue de paris -- étape 1-B-lite de
// GAPS_OUVERTS.md (« Couverture des types de paris »). Zéro appel IA, zéro
// base : passe chaque exemple de types_de_paris_playoffs_2026.md dans
// routeBetDescription() et répartit le résultat par famille, pondéré par
// l'effectif du sous-type.
//
// Désactivé par défaut (ce n'est pas un test, c'est un outil de mesure) :
//   PowerShell : $env:CORPUS_REPORT=1; npx vitest run scripts/corpus-routing-report.test.ts
//   Écrire aussi le rapport en markdown : $env:CORPUS_REPORT_OUT="C:\chemin\hors\depot\rapport.md"
//
// Ce que ce rapport NE dit PAS : si un pari est calculable (cela dépend de la
// sortie de l'IA). Un pari routé vers GENERAL n'est pas un type inconnu : la
// plupart sont des paris joueur simples, couverts.

import { describe, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseCorpusCatalog } from "@/lib/ai/corpusCatalog";
import { betSkeleton } from "@/lib/ai/betFingerprint";
import { routeBetDescription } from "@/lib/ai/structureAndScoreBet";

const META_RE = /^(le )?pari\b/i;

describe.skipIf(!process.env.CORPUS_REPORT)("rapport de routage du corpus", () => {
  it("répartit les exemples par famille", () => {
    const md = readFileSync(
      fileURLToPath(new URL("../Cadrage/Stats/types_de_paris_playoffs_2026.md", import.meta.url)),
      "utf8",
    );
    const categories = parseCorpusCatalog(md);

    type Row = { category: string; subtype: string; text: string; route: string; weight: number };
    const rows: Row[] = [];
    const meta: Row[] = [];
    let withoutExamples = 0;
    let metaOnlyWeight = 0;

    for (const c of categories) {
      for (const s of c.subtypes) {
        if (s.examples.length === 0) {
          withoutExamples += s.count;
          continue;
        }
        const kept = s.examples.filter((t) => !META_RE.test(t));
        for (const text of s.examples.filter((t) => META_RE.test(t))) {
          meta.push({ category: c.name, subtype: s.name, text, route: "META", weight: 0 });
        }
        if (kept.length === 0) {
          metaOnlyWeight += s.count;
          continue;
        }
        // Poids calculé sur les seuls exemples gardés : la masse du sous-type
        // n'est pas perdue quand un exemple méta est écarté.
        const weight = s.count / kept.length;
        for (const text of kept) {
          rows.push({ category: c.name, subtype: s.name, text, route: routeBetDescription(text), weight });
        }
      }
    }

    const totalWeight = rows.reduce((n, r) => n + r.weight, 0);
    const out: string[] = [];
    const log = (line = "") => out.push(line);

    log(`Exemples routés : ${rows.length} (+ ${meta.length} méta ignorés), poids ${totalWeight.toFixed(1)} paris`);
    log(`Sous-types sans exemple (non routables) : ${withoutExamples} paris`);
    log(`Sous-types dont tous les exemples sont méta : ${metaOnlyWeight} paris`);

    const byRoute = new Map<string, { n: number; w: number }>();
    for (const r of rows) {
      const cur = byRoute.get(r.route) ?? { n: 0, w: 0 };
      byRoute.set(r.route, { n: cur.n + 1, w: cur.w + r.weight });
    }
    log("\n## Par famille de routage");
    log("| Route | Exemples | Poids | % |");
    log("|---|---|---|---|");
    for (const [route, v] of [...byRoute].sort((a, b) => b[1].w - a[1].w)) {
      log(`| ${route} | ${v.n} | ${v.w.toFixed(1)} | ${((v.w / totalWeight) * 100).toFixed(1)} % |`);
    }

    log("\n## Catégorie du catalogue x route (poids)");
    const cross = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const m = cross.get(r.category) ?? new Map<string, number>();
      m.set(r.route, (m.get(r.route) ?? 0) + r.weight);
      cross.set(r.category, m);
    }
    for (const [cat, m] of cross) {
      log(`- ${cat} : ${[...m].map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ")}`);
    }

    log("\n## Exemples routés vers GENERAL");
    for (const r of rows.filter((x) => x.route === "GENERAL")) {
      log(`- [${r.category} > ${r.subtype}] ${r.text}`);
    }

    log("\n## Sous-types dont les exemples partent vers des routes différentes");
    const bySub = new Map<string, Set<string>>();
    for (const r of rows) {
      const k = `${r.category} > ${r.subtype}`;
      bySub.set(k, (bySub.get(k) ?? new Set()).add(r.route));
    }
    for (const [k, routes] of bySub) if (routes.size > 1) log(`- ${k} : ${[...routes].join(", ")}`);

    log("\n## Empreintes : squelettes distincts vs sous-types");
    const skeletons = new Set(rows.map((r) => betSkeleton(r.text)));
    log(`${skeletons.size} squelettes distincts pour ${rows.length} exemples et ${bySub.size} sous-types`);

    if (meta.length) {
      log("\n## Exemples méta (descriptions de catégorie, pas des paris)");
      for (const r of meta) log(`- [${r.category}] ${r.text}`);
    }

    const report = out.join("\n");
    console.log(report);
    if (process.env.CORPUS_REPORT_OUT) writeFileSync(process.env.CORPUS_REPORT_OUT, report, "utf8");
  });
});
