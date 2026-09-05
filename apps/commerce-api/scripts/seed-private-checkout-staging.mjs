import { runPrivateCheckoutStagingSeed } from "./database.mjs";

runPrivateCheckoutStagingSeed().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
