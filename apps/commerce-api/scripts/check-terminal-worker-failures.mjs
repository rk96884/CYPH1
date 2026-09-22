import pg from "pg";

export const terminalFailureSummary = async (pool) => {
  const result = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM outbox_events
        WHERE aggregate_type='payment' AND event_type='payment.paid'
          AND processing_status='failed' AND last_error_code='retry_exhausted') AS fulfilment_count,
      (SELECT count(*)::int FROM communication_deliveries
        WHERE status='failed' AND last_error_code='retry_exhausted') AS communication_count,
      LEAST(
        (SELECT min(created_at) FROM outbox_events
          WHERE aggregate_type='payment' AND event_type='payment.paid'
            AND processing_status='failed' AND last_error_code='retry_exhausted'),
        (SELECT min(created_at) FROM communication_deliveries
          WHERE status='failed' AND last_error_code='retry_exhausted')
      ) AS oldest_created_at
  `);
  const row=result.rows[0];
  return Object.freeze({
    fulfilmentCount:Number(row.fulfilment_count),
    communicationCount:Number(row.communication_count),
    oldestCreatedAt:row.oldest_created_at ? new Date(row.oldest_created_at) : undefined,
  });
};

export const formatTerminalFailureSummary = (summary, now=new Date()) => {
  const lines=[
    `Fulfilment terminal failures: ${summary.fulfilmentCount}`,
    `Communication terminal failures: ${summary.communicationCount}`,
  ];
  if(summary.oldestCreatedAt){
    const age=Math.max(0,Math.floor((now.getTime()-summary.oldestCreatedAt.getTime())/60000));
    lines.push(`Oldest outstanding failure age: ${age} minutes`);
  }
  return lines;
};

const direct=process.argv[1] && new URL(import.meta.url).pathname.replace(/^\/(.:\/)/,"$1").replaceAll("%20"," ")===process.argv[1].replaceAll("\\","/");
if(direct){
  if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const ssl=process.env.DATABASE_SSL==="true" ? {rejectUnauthorized:false} : undefined;
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl});
  try{
    const summary=await terminalFailureSummary(pool);
    for(const line of formatTerminalFailureSummary(summary)) console.log(line);
    if(summary.fulfilmentCount>0||summary.communicationCount>0){
      console.error("Terminal worker failures detected; authorised operational investigation is required.");
      process.exitCode=1;
    }
  } finally { await pool.end(); }
}
