import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CLASSIFIER_SYSTEM_PROMPT, REDACTEUR_SYSTEM_PROMPT } from "./prompts";

// Texte entre les deux lignes `=====` d'un document de prompt.
function promptOf(file: string): string {
  const path = resolve(__dirname, "../../Cadrage/Fonctionnel/popup_hebdo", file);
  const lines = readFileSync(path, "utf8").replace(/\r\n/g, "\n").split("\n");
  const marks = lines.flatMap((l, i) => (l.startsWith("=====") ? [i] : []));
  expect(marks).toHaveLength(2);
  return lines.slice(marks[0] + 1, marks[1]).join("\n").trim();
}

describe("prompts", () => {
  it("le rédacteur égale prompt_redacteur_v6.md, mot pour mot", () => {
    expect(REDACTEUR_SYSTEM_PROMPT).toBe(promptOf("prompt_redacteur_v6.md"));
  });
  it("le classifieur égale prompt_classifieur_v1.md, mot pour mot", () => {
    expect(CLASSIFIER_SYSTEM_PROMPT).toBe(promptOf("prompt_classifieur_v1.md"));
  });
});
