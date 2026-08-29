import { runDevelopmentSeed } from "./database.mjs";

runDevelopmentSeed().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
