import { writeFileSync } from "node:fs";
import { seedE2EData, SEED_FILE } from "./seed";

export default async function globalSetup() {
  const seed = await seedE2EData();
  writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));
}
