import pg from "pg";
import type { CommunicationRepository } from "./service.js";

export class PostgresCommunicationRepository implements CommunicationRepository {
  constructor(private readonly pool: pg.Pool) {}
  async claimNext() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const retry = await client.query(`SELECT d.id delivery_id,d.template_key,d.deduplication_key,o.order_number,o.currency,o.total_minor,c.email_display,
        f.tracking_carrier,f.tracking_reference,r.amount_minor refund_minor FROM communication_deliveries d JOIN orders o ON o.id=d.order_id JOIN customers c ON c.id=d.customer_id
        JOIN outbox_events e ON e.id=d.source_event_id LEFT JOIN fulfilments f ON e.aggregate_type='fulfilment' AND f.id=e.aggregate_id LEFT JOIN refunds r ON e.aggregate_type='refund' AND r.id=e.aggregate_id
        WHERE d.status='failed' AND d.available_at<=now() ORDER BY d.available_at FOR UPDATE OF d SKIP LOCKED LIMIT 1`);
      if(retry.rowCount===1){const row=retry.rows[0];await client.query("UPDATE communication_deliveries SET status='processing',attempt_count=attempt_count+1,updated_at=now() WHERE id=$1",[row.delivery_id]);await client.query("COMMIT");return Object.freeze({deliveryId:row.delivery_id,template:row.template_key,deduplicationKey:row.deduplication_key,recipient:row.email_display,orderNumber:row.order_number,currency:row.currency,totalMinor:Number(row.total_minor),...(row.refund_minor===null?{}:{refundMinor:Number(row.refund_minor)}),...(row.tracking_carrier?{trackingCarrier:row.tracking_carrier}:{}),...(row.tracking_reference?{trackingReference:row.tracking_reference}:{})});}
      const source = await client.query(`SELECT e.id source_event_id,e.event_type,e.aggregate_id,e.payload,o.id order_id,o.order_number,o.currency,o.total_minor,o.customer_id,c.email_display,
        f.tracking_carrier,f.tracking_reference,r.amount_minor refund_minor
        FROM outbox_events e JOIN orders o ON o.id=(e.payload->>'orderId')::uuid JOIN customers c ON c.id=o.customer_id
        LEFT JOIN fulfilments f ON e.aggregate_type='fulfilment' AND f.id=e.aggregate_id
        LEFT JOIN refunds r ON e.aggregate_type='refund' AND r.id=e.aggregate_id
        WHERE e.event_type IN ('payment.paid','payment.cancelled','fulfilment.dispatched','fulfilment.cancelled','refund.completed')
        AND NOT EXISTS (SELECT 1 FROM communication_deliveries d WHERE d.deduplication_key=CASE
          WHEN e.event_type='payment.paid' THEN 'order-confirmation:'||o.id WHEN e.event_type='fulfilment.dispatched' THEN 'dispatch:'||e.aggregate_id
          WHEN e.event_type IN ('payment.cancelled','fulfilment.cancelled') THEN 'cancellation:'||o.id ELSE 'refund:'||e.aggregate_id END)
        ORDER BY e.created_at FOR UPDATE OF e SKIP LOCKED LIMIT 1`);
      if (source.rowCount !== 1) { await client.query("COMMIT"); return undefined; }
      const row=source.rows[0];
      const template=row.event_type==='payment.paid'?'order-confirmation':row.event_type==='fulfilment.dispatched'?'dispatch':row.event_type==='refund.completed'?'refund':'cancellation';
      const deduplicationKey=template==='order-confirmation'?`order-confirmation:${row.order_id}`:template==='dispatch'?`dispatch:${row.aggregate_id}`:template==='refund'?`refund:${row.aggregate_id}`:`cancellation:${row.order_id}`;
      const inserted=await client.query(`INSERT INTO communication_deliveries(source_event_id,order_id,customer_id,template_key,deduplication_key,status,attempt_count)
        VALUES($1,$2,$3,$4,$5,'processing',1) ON CONFLICT(deduplication_key) DO NOTHING RETURNING id`,[row.source_event_id,row.order_id,row.customer_id,template,deduplicationKey]);
      await client.query("COMMIT");
      if(inserted.rowCount!==1)return undefined;
      return Object.freeze({deliveryId:inserted.rows[0].id,template,deduplicationKey,recipient:row.email_display,orderNumber:row.order_number,currency:row.currency,totalMinor:Number(row.total_minor),
        ...(row.refund_minor===null?{}:{refundMinor:Number(row.refund_minor)}),...(row.tracking_carrier?{trackingCarrier:row.tracking_carrier}:{}),...(row.tracking_reference?{trackingReference:row.tracking_reference}:{})});
    } catch(error){await client.query("ROLLBACK");throw error;} finally {client.release();}
  }
  async markSent(id:string,provider:string,reference:string){await this.pool.query("UPDATE communication_deliveries SET status='sent',provider=$2,provider_reference=$3,sent_at=now(),updated_at=now(),last_error_code=NULL WHERE id=$1",[id,provider,reference]);}
  async markFailed(id:string,errorCode:string){await this.pool.query("UPDATE communication_deliveries SET status='failed',last_error_code=$2,available_at=now()+interval '5 minutes',updated_at=now() WHERE id=$1",[id,errorCode]);}
}
