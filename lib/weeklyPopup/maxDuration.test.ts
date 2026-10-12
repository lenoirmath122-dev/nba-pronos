import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTE_MAX_DURATION_S } from "./config";

describe("maxDuration", () => {
  const files = [
    "app/api/recaps/route.ts",
    "app/(admin)/admin/competitions/page.tsx",
    "app/(admin)/admin/popup/page.tsx",
  ];
  it.each(files)("%s déclare le littéral %i", (file) => {
    const source = readFileSync(resolve(__dirname, "../..", file), "utf8");
    expect(source).toMatch(new RegExp(`export const maxDuration = ${ROUTE_MAX_DURATION_S};`));
  });
});
