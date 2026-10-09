import pg from "pg";
import { randomUUID } from "node:crypto";
import { defaultCommunicationAutomaticRetryLimit, defaultCommunicationClaimLeaseSeconds, type CommunicationRepository } from "./service.js";

export class PostgresCommunicationRepository implements CommunicationRepository {
  private async orderItems(client: pg.PoolClient, orderId: string) {
    const result = await client.query<{ name_snapshot: string; quantity: number; line_total_minor: string }>(
      "SELECT name_snapshot,quantity,line_total_minor FROM order_items WHERE order_id=$1 ORDER BY id", [orderId],
    );
    return result.rows.map((item) => ({ name: item.name_snapshot, quantity: Number(item.quantity), lineTotalMinor: Number(item.line_total_minor) }));
  }
  constructor(private readonly pool: pg.Pool, private readonly automaticRetryLimit=defaultCommunicationAutomaticRetryLimit, private readonly claimLeaseSeconds=defaultCommunicationClaimLeaseSeconds) {
    if(!Number.isSafeInteger(automaticRetryLimit)||automaticRetryLimit<1||automaticRetryLimit>10)throw new Error("Communication automatic retry limit must be between 1 and 10.");
    if(!Number.isSafeInteger(claimLeaseSeconds)||claimLeaseSeconds<30||claimLeaseSeconds>3600)throw new Error("Communication claim lease must be between 30 and 3600 seconds.");
  }
  async claimNext() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const claimToken = randomUUID();
      await client.query(`UPDATE communication_deliveries SET status='manual_review',last_error_code='stale_send_uncertain',claim_token=NULL,processing_started_at=NULL,updated_at=now()
        WHERE status='processing' AND send_started_at IS NOT NULL AND processing_started_at<=now()-($1*interval '1 second')`,[this.claimLeaseSeconds]);
      await client.query(`UPDATE communication_deliveries SET status='failed',terminal_failure=true,last_error_code='retry_exhausted',claim_token=NULL,processing_started_at=NULL,updated_at=now()
        WHERE status='processing' AND attempt_count >= $1 AND processing_started_at <= now()-($2*interval '1 second')`,[this.automaticRetryLimit,this.claimLeaseSeconds]);
      const retry = await client.query(`SELECT d.id delivery_id,d.template_key,d.deduplication_key,o.id order_id,o.order_number,o.currency,o.total_minor,o.delivery_minor,o.shipping_country_code,o.created_at,o.shipping_method_snapshot,o.delivery_address_snapshot,(SELECT collection_point FROM inpost_collection_reviews WHERE order_id=o.id ORDER BY version DESC LIMIT 1) AS approved_collection_point,c.email_display,
        f.tracking_carrier,f.tracking_reference,e.payload->>'trackingUrl' tracking_url,r.amount_minor refund_minor FROM communication_deliveries d JOIN orders o ON o.id=d.order_id JOIN customers c ON c.id=d.customer_id
        JOIN outbox_events e ON e.id=d.source_event_id LEFT JOIN fulfilments f ON e.aggregate_type='fulfilment' AND f.id=e.aggregate_id LEFT JOIN refunds r ON e.aggregate_type='refund' AND r.id=e.aggregate_id
        WHERE ((d.status='failed' AND NOT d.terminal_failure AND d.attempt_count<$1) OR (d.status='processing' AND d.send_started_at IS NULL AND d.attempt_count<$1 AND d.processing_started_at<=now()-($2*interval '1 second')))
          AND d.available_at<=now() ORDER BY d.available_at FOR UPDATE OF d SKIP LOCKED LIMIT 1`,[this.automaticRetryLimit,this.claimLeaseSeconds]);
      if(retry.rowCount===1){const row=retry.rows[0];const items=await this.orderItems(client,row.order_id);await client.query("UPDATE communication_deliveries SET status='processing',attempt_count=attempt_count+1,processing_started_at=now(),claim_token=$2,send_started_at=NULL,updated_at=now() WHERE id=$1",[row.delivery_id,claimToken]);await client.query("COMMIT");return Object.freeze({deliveryId:row.delivery_id,claimToken,items,template:row.template_key,deduplicationKey:row.deduplication_key,recipient:row.email_display,orderNumber:row.order_number,currency:row.currency,totalMinor:Number(row.total_minor),deliveryMinor:Number(row.delivery_minor),...((row.template_key === "dispatch" || row.event_type === "fulfilment.dispatched") && row.approved_collection_point ? {collectionPoint:row.approved_collection_point} : row.delivery_address_snapshot?.collectionPoint ? {collectionPoint:row.delivery_address_snapshot.collectionPoint} : {}),...(row.shipping_country_code?{shippingCountryCode:String(row.shipping_country_code)}:{}),orderPlacedAt:new Date(row.created_at).toISOString(),...(row.shipping_method_snapshot?.name?{deliveryMethod:String(row.shipping_method_snapshot.name)}:{}),...(row.refund_minor===null?{}:{refundMinor:Number(row.refund_minor)}),...(row.tracking_carrier?{trackingCarrier:row.tracking_carrier}:{}),...(row.tracking_reference?{trackingReference:row.tracking_reference}:{}),...(typeof row.tracking_url === "string"?{trackingUrl:row.tracking_url}:{})});}
      const source = await client.query(`SELECT e.id source_event_id,e.event_type,e.aggregate_id,e.payload,o.id order_id,o.order_number,o.currency,o.total_minor,o.delivery_minor,o.shipping_country_code,o.created_at,o.shipping_method_snapshot,o.delivery_address_snapshot,(SELECT collection_point FROM inpost_collection_reviews WHERE order_id=o.id ORDER BY version DESC LIMIT 1) AS approved_collection_point,o.customer_id,c.email_display,
        f.tracking_carrier,f.tracking_reference,e.payload->>'trackingUrl' tracking_url,r.amount_minor refund_minor
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
      const items = await this.orderItems(client, row.order_id);
      const template=row.event_type==='payment.paid'?'order-confirmation':row.event_type==='fulfilment.dispatched'?'dispatch':row.event_type==='refund.completed'?'refund':'cancellation';
      const deduplicationKey=template==='order-confirmation'?`order-confirmation:${row.order_id}`:template==='dispatch'?`dispatch:${row.aggregate_id}`:template==='refund'?`refund:${row.aggregate_id}`:`cancellation:${row.order_id}`;
      const inserted=await client.query(`INSERT INTO communication_deliveries(source_event_id,order_id,customer_id,template_key,deduplication_key,status,attempt_count,processing_started_at,claim_token)
        VALUES($1,$2,$3,$4,$5,'processing',1,now(),$6) ON CONFLICT(deduplication_key) DO NOTHING RETURNING id`,[row.source_event_id,row.order_id,row.customer_id,template,deduplicationKey,claimToken]);
      await client.query("COMMIT");
      if(inserted.rowCount!==1)return undefined;
      return Object.freeze({deliveryId:inserted.rows[0].id,claimToken,template,deduplicationKey,recipient:row.email_display,orderNumber:row.order_number,currency:row.currency,items,totalMinor:Number(row.total_minor),deliveryMinor:Number(row.delivery_minor),...((row.template_key === "dispatch" || row.event_type === "fulfilment.dispatched") && row.approved_collection_point ? {collectionPoint:row.approved_collection_point} : row.delivery_address_snapshot?.collectionPoint ? {collectionPoint:row.delivery_address_snapshot.collectionPoint} : {}),...(row.shipping_country_code?{shippingCountryCode:String(row.shipping_country_code)}:{}),orderPlacedAt:new Date(row.created_at).toISOString(),...(row.shipping_method_snapshot?.name?{deliveryMethod:String(row.shipping_method_snapshot.name)}:{}),
        ...(row.refund_minor===null?{}:{refundMinor:Number(row.refund_minor)}),...(row.tracking_carrier?{trackingCarrier:row.tracking_carrier}:{}),...(row.tracking_reference?{trackingReference:row.tracking_reference}:{}),...(typeof row.tracking_url === "string"?{trackingUrl:row.tracking_url}:{})});
    } catch(error){await client.query("ROLLBACK");throw error;} finally {client.release();}
  }
  private async fenced(sql: string, values: unknown[]) {
    const result = await this.pool.query(sql, values);
    if (result.rowCount !== 1) throw new Error("communication_claim_lost");
  }
  async beginSend(id: string, token: string) {
    await this.fenced(`UPDATE communication_deliveries SET send_started_at=now(),updated_at=now()
      WHERE id=$1 AND claim_token=$2 AND status='processing' AND send_started_at IS NULL
      AND processing_started_at>now()-($3*interval '1 second')`,[id,token,this.claimLeaseSeconds]);
  }
  async markSent(id:string,provider:string,reference:string,token:string) {
    await this.fenced(`UPDATE communication_deliveries SET status='sent',provider=$3,provider_reference=$4,sent_at=now(),updated_at=now(),last_error_code=NULL,processing_started_at=NULL,claim_token=NULL
      WHERE id=$1 AND claim_token=$2 AND status='processing' AND send_started_at IS NOT NULL
      AND processing_started_at>now()-($5*interval '1 second')`,[id,token,provider,reference,this.claimLeaseSeconds]);
  }
  async markFailed(id:string,code:string,token:string,permanent=false) {
    await this.fenced(`UPDATE communication_deliveries SET status='failed',last_error_code=$3,terminal_failure=($4 OR attempt_count >= $5),
      available_at=now()+interval '5 minutes',updated_at=now(),processing_started_at=NULL,claim_token=NULL,send_started_at=NULL
      WHERE id=$1 AND claim_token=$2 AND status='processing' AND processing_started_at>now()-($6*interval '1 second')`,
      [id,token,code,permanent,this.automaticRetryLimit,this.claimLeaseSeconds]);
  }
  async markReview(id:string,code:string,token:string,acceptance?:Readonly<{provider:string;reference:string}>) {
    await this.fenced(`UPDATE communication_deliveries SET status='manual_review',last_error_code=$3,provider=COALESCE($4,provider),provider_reference=COALESCE($5,provider_reference),updated_at=now(),processing_started_at=NULL,claim_token=NULL
      WHERE id=$1 AND claim_token=$2 AND status='processing'`,[id,token,code,acceptance?.provider??null,acceptance?.reference??null]);
  }
}
