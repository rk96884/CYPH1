import { createHash } from "node:crypto";
import { qualifyProspect } from "./qualification.mjs";

const dims = ["relevance", "ukAudience", "engagement", "brandFit", "feasibility"];

export function canonicalSource(input) {
  if (typeof input !== "string" || input.length > 2048) throw new Error("Source URL is missing or too long");
  let url;
  try { url = new URL(input); } catch { throw new Error("Invalid source URL"); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      hostname === "localhost" || hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") || hostname.endsWith(".internal") ||
      /^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(hostname) ||
      hostname.includes(":") || !hostname.includes(".")) {
    throw new Error("A public HTTPS source URL is required");
  }
  url.hash = "";
  url.searchParams.sort();
  return url.toString();
}

export function prepareResearchBatch(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Research batch must be an object");
  if (!Array.isArray(value.prospects) || value.prospects.length === 0 || value.prospects.length > 25) {
    throw new RangeError("Batch must contain 1 to 25 prospects");
  }
  const keys = new Set();
  return value.prospects.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new TypeError("Invalid prospect at " + index);
    const sourceUrl = canonicalSource(item.sourceUrl);
    const evidence = {};
    for (const dimension of dims) {
      const entry = item.evidence?.[dimension];
      if (entry === undefined) continue;
      if (!entry || !Number.isInteger(entry.rating) || entry.rating < 0 || entry.rating > 5 ||
          typeof entry.note !== "string" || !entry.note.trim() || entry.note.length > 1000) {
        throw new TypeError("Invalid evidence for " + dimension);
      }
      evidence[dimension] = {
        rating: entry.rating,
        note: entry.note.trim(),
        sourceUrl: canonicalSource(entry.sourceUrl)
      };
    }
    if (Object.keys(evidence).length === 0) throw new Error("At least one verified evidence dimension is required");
    const qualified = qualifyProspect({ ...item, sourceUrl, evidence });
    const key = createHash("sha256").update(sourceUrl).digest("hex");
    const identity = qualified.channel + ":" + key;
    if (keys.has(identity)) throw new Error("Duplicate prospect source in batch");
    keys.add(identity);
    return {
      channel: qualified.channel,
      name: qualified.name,
      sourceUrl,
      checkedAt: qualified.sourceCheckedAt,
      sourceKey: key,
      score: qualified.score,
      confidence: qualified.confidence,
      evidence: Object.entries(evidence).map(([dimension, row]) => ({ dimension, ...row }))
    };
  });
}

/** The caller supplies a restricted, growth-only PostgreSQL connection. */
export async function ingestResearch(client, entries, actor = "manual-research-import") {
  if (!Array.isArray(entries) || !entries.length || entries.length > 25) throw new RangeError("Invalid prepared batch");
  if (!/^[a-zA-Z0-9:_-]{3,80}$/.test(actor)) throw new Error("Invalid audit actor");
  await client.query("BEGIN");
  try {
    const started = await client.query(
      "INSERT INTO growth.research_runs (source_kind,status,started_at,items_examined) VALUES ('manual','running',now(),$1) RETURNING id",
      [entries.length]
    );
    const runId = started.rows[0].id;
    let inserted = 0, skipped = 0;
    for (const p of entries) {
      // Immutable review decisions: an existing source is always skipped.
      const result = await client.query(`
        INSERT INTO growth.prospects
          (channel,display_name,source_url,source_checked_at,source_key,
           review_status,qualification_score,qualification_confidence,research_run_id)
        VALUES ($1,$2,$3,$4,$5,'research_only',$6,$7,$8)
        ON CONFLICT (channel,source_key) DO NOTHING RETURNING id
      `, [p.channel,p.name,p.sourceUrl,p.checkedAt,p.sourceKey,p.score,p.confidence,runId]);
      if (!result.rows.length) { skipped++; continue; }
      const id = result.rows[0].id;
      for (const evidence of p.evidence) {
        await client.query(`
          INSERT INTO growth.prospect_evidence
            (prospect_id,dimension,rating,source_url,evidence_note,checked_at)
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [id,evidence.dimension,evidence.rating,evidence.sourceUrl,evidence.note,p.checkedAt]);
      }
      await client.query(`
        INSERT INTO growth.audit_log (actor_id,action,target_type,target_id,details)
        VALUES ($1,'research.import','prospect',$2,$3::jsonb)
      `, [actor,id,JSON.stringify({ source: "manual", runId, score: p.score, evidenceCount: p.evidence.length })]);
      inserted++;
    }
    await client.query("UPDATE growth.research_runs SET status='completed',completed_at=now() WHERE id=$1", [runId]);
    await client.query("COMMIT");
    return { runId, inserted, skipped, outreachEnabled: false };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
