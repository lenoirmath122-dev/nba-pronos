// Parseur du catalogue de types de paris
// (Cadrage/Stats/types_de_paris_playoffs_2026.md) -- pur, sans E/S.
//
// Le fichier n'est PAS une liste de 429 textes : c'est un catalogue en 3
// niveaux (catégorie > sous-type avec son effectif > 1 à 3 exemples). Les
// effectifs donnent le poids réel de chaque sous-type, les exemples servent
// à tester le routage.
//
//   ## <catégorie> — <N> paris
//   **<sous-type>** (<N>)
//   > <texte d'un pari>
//
// Une ligne `##` ou `**` qui ne respecte pas ce format lève une erreur
// plutôt que d'être ignorée : sinon ses exemples seraient rattachés en
// silence à la catégorie ou au sous-type précédent.

export type CorpusSubtype = {
  name: string;
  count: number;
  examples: string[];
};

export type CorpusCategory = {
  name: string;
  total: number;
  subtypes: CorpusSubtype[];
};

const CATEGORY_RE = /^##\s+(.+?)\s+[—–-]\s+(\d+)\s+paris?\s*$/;
const SUBTYPE_RE = /^\*\*(.+?)\*\*\s*\((\d+)\)\s*$/;
const EXAMPLE_RE = /^>\s?(.*)$/;

export function parseCorpusCatalog(md: string): CorpusCategory[] {
  const categories: CorpusCategory[] = [];
  let category: CorpusCategory | null = null;
  let subtype: CorpusSubtype | null = null;

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const cat = CATEGORY_RE.exec(line);
    if (cat) {
      category = { name: cat[1], total: Number(cat[2]), subtypes: [] };
      categories.push(category);
      subtype = null;
      continue;
    }
    if (/^##\s/.test(line)) throw new Error(`Titre de catégorie illisible : « ${line} »`);

    // Tout autre titre (#, ###...) ferme la section en cours : ses
    // citations ne doivent pas être rattachées au sous-type précédent.
    if (/^#{1,6}\s/.test(line)) {
      category = null;
      subtype = null;
      continue;
    }

    const sub = SUBTYPE_RE.exec(line);
    if (sub) {
      if (!category) throw new Error(`Sous-type hors catégorie : « ${line} »`);
      subtype = { name: sub[1], count: Number(sub[2]), examples: [] };
      category.subtypes.push(subtype);
      continue;
    }
    if (line.startsWith("**")) throw new Error(`Sous-type illisible : « ${line} »`);

    const ex = EXAMPLE_RE.exec(line);
    if (ex && subtype) {
      const text = ex[1].trim();
      if (text) subtype.examples.push(text);
    }
  }

  return categories;
}
