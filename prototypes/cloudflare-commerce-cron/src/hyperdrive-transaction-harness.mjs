/**
 * Test-only PostgreSQL transaction harness. Importing this module does nothing.
 * Caller must inject an explicitly provided pg-like client: NO connection setup.
 * The disposable table must be provisioned outside this module.
 */
export async function claimOne(client) {
  await client.query("BEGIN");
  try {
    const result = await client.query(
      "SELECT id FROM cyph1_hyperdrive_probe_jobs WHERE status = $1 ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1",
      ["pending"],
    );
    if (result.rows.length === 0) {
      await client.query("COMMIT");
      return null;
    }
    const id = result.rows[0].id;
    await client.query(
      "UPDATE cyph1_hyperdrive_probe_jobs SET status = $1 WHERE id = $2",
      ["claimed", id],
    );
    await client.query("COMMIT");
    return id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

/**
 * No default exported scheduled handler, no fetch endpoint, no database URL.
 * The harness is intentionally unusable as a deployed Worker on its own.
 */
