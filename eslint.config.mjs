import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next already registers the "jsx-a11y" plugin itself, so
  // only the recommended ruleset is added here (redeclaring `plugins` would
  // throw a "Cannot redefine plugin" flat-config error).
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Crashes at lint time: eslint-plugin-jsx-a11y@6.10.2 does
      // `require("minimatch").default`, but minimatch v10 (forced repo-wide
      // by package.json's `overrides`, for its own security fixes) dropped
      // the default export. No upstream fix released yet. Every other
      // jsx-a11y rule is unaffected — only this one calls the broken helper.
      "jsx-a11y/label-has-associated-control": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
