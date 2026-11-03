import assert from "node:assert/strict";
import test from "node:test";
import { discover, normaliseSearchResults } from "./discover.mjs";

test("search hits remain unverified and remove invalid links", () => {
  const results = normaliseSearchResults({ organic_results: [
    { title: "Test Creator", link: "https://example.org/profile#top", snippet: "Public beauty content" },
    { title: "duplicate", link: "https://example.org/profile" },
    { title: "bad", link: "javascript:alert(1)" }
  ] }, "creator");
  assert.equal(results.length, 1);
  assert.equal(results[0].status, "unverified_search_result");
  assert.equal(results[0].contactAllowed, false);
  assert.equal(results[0].sourceUrl, "https://example.org/profile");
});

test("missing provider key fails before network access", async () => {
  let calls = 0;
  await assert.rejects(discover({ channel: "creator", apiKey: "", fetcher: async () => { calls++; } }), /SERPAPI_API_KEY/);
  assert.equal(calls, 0);
});

test("two approved public searches yield bounded, deduplicated suggestions", async () => {
  const calls = [];
  const results = await discover({
    channel: "partner", apiKey: "test-key",
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ organic_results: [
        { title: "Example shop", link: "https://example.com/shop", snippet: "Beauty retail" }
      ] }) };
    }
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].url.hostname, "serpapi.com");
  assert.equal(results.length, 1);
  assert.equal(results[0].contactAllowed, false);
});
