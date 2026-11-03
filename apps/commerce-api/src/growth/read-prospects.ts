import pg from "pg";

export type GrowthProspectSummary = Readonly<{
  id: string;
  channel: "creator" | "partner";
  name: string;
  sourceUrl: string;
  checkedAt: string;
  status: string;
  score: number;
  confidence: number;
  evidenceCount: number;
}>;

export type GrowthProspectReader = Readonly<{
  list(channel?: "creator" | "partner"): Promise<readonly GrowthProspectSummary[]>;
}>;

/**
 * Read-only queries against the isolated growth schema.
 * Explicit columns, bounded results, no prospect contact details, no writes.
 */
export class PostgresGrowthProspectReader implements GrowthProspectReader {
  constructor(private readonly pool: Pick<pg.Pool, "query">) {}

  async list(channel?: "creator" | "partner"): Promise<readonly GrowthProspectSummary[]> {
    const result = await this.pool.query(`
      SELECT p.id, p.channel, p.display_name, p.source_url, p.source_checked_at,
             p.review_status, p.qualification_score, p.qualification_confidence,
             COUNT(e.id)::integer AS evidence_count
      FROM growth.prospects p
      LEFT JOIN growth.prospect_evidence e ON e.prospect_id = p.id
      WHERE ($1::text IS NULL OR p.channel = $1)
      GROUP BY p.id
      ORDER BY p.qualification_score DESC, p.source_checked_at DESC, p.id
      LIMIT 100
    `, [channel ?? null]);
    return result.rows.map(row => Object.freeze({
      id: String(row.id),
      channel: row.channel as "creator" | "partner",
      name: String(row.display_name),
      sourceUrl: String(row.source_url),
      checkedAt: new Date(row.source_checked_at).toISOString(),
      status: String(row.review_status),
      score: Number(row.qualification_score),
      confidence: Number(row.qualification_confidence),
      evidenceCount: Number(row.evidence_count),
    }));
  }
}
