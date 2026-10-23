# Montage V2 (Remotion)

- `npm install` puis `npx remotion studio src/index.ts` pour prévisualiser.
- Rendu : `npx remotion render src/index.ts ReelA out/A.mp4` (ou ReelB).
- Plans 3 et 4 : séquences dans `public/clips/p3|p4`, réglages dans `src/clips.ts`.
  Après un nouvel enregistrement (`outils/rec-v2.mjs`), copier `enregistrements/p3` vers
  `public/clips/p3` et recopier les valeurs de `seq.json` dans `src/clips.ts`.
