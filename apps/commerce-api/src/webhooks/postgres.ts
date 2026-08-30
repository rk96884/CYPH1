import pg from "pg";
import type { TransactionClient, TransactionRunner } from "./processor.js";

export class PostgresTransactionRunner implements TransactionRunner {
  constructor(private readonly pool: pg.Pool) {}

  async transaction<Result>(work: (client: TransactionClient) => Promise<Result>): Promise<Result> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
