import { rmSync } from "node:fs";
import { teardownE2EData, SEED_FILE } from "./seed";

export default async function globalTeardown() {
  await teardownE2EData();
  rmSync(SEED_FILE, { force: true });
}
