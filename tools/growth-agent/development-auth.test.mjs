import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { loadDevelopmentAuth, createDevelopmentAuthenticator } from './development-auth.mjs';
import { createDevelopmentGrowthHandler } from './development-read-api.mjs';

const password = 'a'.repeat(64); // Synthetic test credential only.
const salt = Buffer.alloc(16, 7);
const env = { GROWTH_DATA_ENV: 'development', GROWTH_DEV_ADMIN_EMAIL: 'rishikhosla@hotmail.com',
  GROWTH_DEV_PASSWORD_HASH: `scrypt:${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}` };
const basic = (email, pass) => 'Basic ' + Buffer.from(email + ':' + pass).toString('base64');

test('configuration refuses production, other identities, absent or malformed hashes', () => {
  for (const overrides of [{GROWTH_DATA_ENV:'production'}, {GROWTH_DEV_ADMIN_EMAIL:'other@example.org'},
    {GROWTH_DEV_PASSWORD_HASH:undefined}, {GROWTH_DEV_PASSWORD_HASH:'plaintext'}]) {
    assert.throws(() => loadDevelopmentAuth({...env,...overrides}));
  }
});
test('only the named administrator with the correct password authenticates', () => {
  const verify = createDevelopmentAuthenticator(loadDevelopmentAuth(env));
  assert.equal(verify(basic('rishikhosla@hotmail.com',password)),true);
  assert.equal(verify(basic('other@example.org',password)),false);
  assert.equal(verify(basic('rishikhosla@hotmail.com','b'.repeat(64))),false);
});
test('missing, malformed, oversized and spoofed credentials are denied', () => {
  const verify = createDevelopmentAuthenticator(loadDevelopmentAuth(env));
  for (const header of [undefined, [], '', 'Bearer '+password, 'Basic !!!!', 'Basic '+ 'a'.repeat(1024),
    basic('rishikhosla@hotmail.com','short'), 'Basic '+Buffer.from('no-colon').toString('base64')]) {
    assert.equal(verify(header), false);
  }
});

test('attempt limit blocks further hashing and resets after one minute', () => {
  let now = 0;
  const verify = createDevelopmentAuthenticator(loadDevelopmentAuth(env), () => now);
  for (let index=0; index<20; index++) assert.equal(verify(undefined),false);
  assert.equal(verify(basic('rishikhosla@hotmail.com',password)),false);
  now = 60_000;
  assert.equal(verify(basic('rishikhosla@hotmail.com',password)),true);
});

test('real authentication gates data reads and never permits mutations', async () => {
  let reads=0;
  const handle=createDevelopmentGrowthHandler({uiOrigin:'http://localhost:4321',
    authenticate:createDevelopmentAuthenticator(loadDevelopmentAuth(env)),
    readProspects:async()=>{reads++;return [];} });
  const request={method:'GET',path:'/operations/growth/prospects'};
  for (const token of [undefined,'forged-cloudflare-token',basic('other@example.org',password),
    basic('rishikhosla@hotmail.com','b'.repeat(64))]) {
    assert.equal((await handle({...request,token})).status,401);
  }
  assert.equal(reads,0);
  const token=basic('rishikhosla@hotmail.com',password);
  assert.equal((await handle({...request,token})).status,200);
  for (const method of ['POST','PUT','PATCH','DELETE']) assert.equal((await handle({...request,method,token})).status,405);
  assert.equal(reads,1);
});
