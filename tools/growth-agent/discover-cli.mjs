import { discover } from "./discover.mjs";

const channel = process.argv[2];
if (channel !== "creator" && channel !== "partner") {
  console.error("Usage: node tools/growth-agent/discover-cli.mjs creator|partner");
  process.exitCode = 2;
} else {
  try {
    const results = await discover({ channel, apiKey: process.env.SERPAPI_API_KEY });
    // Only source URLs/titles/snippets. No API key or personal contacts emitted.
    console.log(JSON.stringify({ channel, count: results.length, records: results }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Discovery failed");
    process.exitCode = 1;
  }
}
