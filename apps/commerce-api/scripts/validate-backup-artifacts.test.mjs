import assert from "node:assert/strict";
import { test } from "node:test";
import { validateBackupBuffer, validateEncryptedBuffer } from "./validate-backup-artifacts.mjs";

test("accepts a PostgreSQL custom-format signature",()=>{const b=Buffer.alloc(32);b.write("PGDMP");assert.equal(validateBackupBuffer(b).sizeBytes,32);});
test("rejects empty and wrong-format dumps",()=>{assert.throws(()=>validateBackupBuffer(Buffer.alloc(0)),/missing or too small/);assert.throws(()=>validateBackupBuffer(Buffer.alloc(32)),/not a PostgreSQL/);});
test("accepts an OpenSSL salted encrypted envelope",()=>{const b=Buffer.alloc(48);b.write("Salted__");assert.equal(validateEncryptedBuffer(b).sizeBytes,48);});
test("rejects unencrypted output",()=>{assert.throws(()=>validateEncryptedBuffer(Buffer.alloc(48)),/expected OpenSSL/);});
