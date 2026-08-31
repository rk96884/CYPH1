import assert from "node:assert/strict";
import test from "node:test";
import {
  createCloudflareAccessAuthenticator,
  loadCloudflareAccessConfig,
} from "./cloudflare-access.js";

const environment = {
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: "https://cyph1-test.cloudflareaccess.com",
  CLOUDFLARE_ACCESS_AUDIENCE: "test-audience",
  OPERATIONS_ACCESS_GRANTS: JSON.stringify({
    "operator@example.test": ["orders:read", "reconciliation:export"],
  }),
};

test("Access configuration rejects unsafe origins and permission grants", () => {
  assert.throws(() => loadCloudflareAccessConfig({ ...environment, CLOUDFLARE_ACCESS_TEAM_DOMAIN: "http://example.test" }), /HTTPS/);
  assert.throws(() => loadCloudflareAccessConfig({ ...environment, CLOUDFLARE_ACCESS_AUDIENCE: "" }), /AUDIENCE/);
  assert.throws(() => loadCloudflareAccessConfig({ ...environment, OPERATIONS_ACCESS_GRANTS: "[]" }), /map operator/);
  assert.throws(() => loadCloudflareAccessConfig({ ...environment, OPERATIONS_ACCESS_GRANTS: '{"operator@example.test":["admin:all"]}' }), /invalid permissions/);
});

test("Access authentication fails closed for missing, invalid and ungranted assertions", async () => {
  const config = loadCloudflareAccessConfig(environment);
  const invalid = createCloudflareAccessAuthenticator(config, async () => { throw new Error("invalid signature"); });
  assert.equal(await invalid.authenticate(new Request("https://ops.example.test/operations/orders")), undefined);
  assert.equal(await invalid.authenticate(new Request("https://ops.example.test/operations/orders", { headers: { "cf-access-jwt-assertion": "bad-token" } })), undefined);

  const ungranted = createCloudflareAccessAuthenticator(config, async () => ({ payload: { email: "other@example.test" } }));
  assert.equal(await ungranted.authenticate(new Request("https://ops.example.test/operations/orders", { headers: { "cf-access-jwt-assertion": "signed-token" } })), undefined);
});

test("Access authentication maps a verified email only to server-side permissions", async () => {
  const config = loadCloudflareAccessConfig(environment);
  const access = createCloudflareAccessAuthenticator(config, async (token) => {
    assert.equal(token, "signed-token");
    return { payload: { email: "Operator@Example.Test" } };
  });
  const principal = await access.authenticate(new Request("https://ops.example.test/operations/orders", {
    headers: {
      "cf-access-jwt-assertion": "signed-token",
      "x-operator-permissions": "admin:all",
    },
  }));
  assert.deepEqual(principal, {
    id: "operator@example.test",
    permissions: ["orders:read", "reconciliation:export"],
  });
});
