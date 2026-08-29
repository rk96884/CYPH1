import { migrate } from "./database.mjs";

migrate().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
