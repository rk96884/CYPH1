import pg from "pg";
import {
  orderFulfilmentStatusFor, inpostCollectionMethod, inpostParcelForQuantity, normaliseCollectionPoint,
  transitionFulfilment,
  type CreateFulfilmentRequest,
  type FulfilmentProviderEvent,
  type FulfilmentStatus,
} from "../../../../packages/commerce-core/src/index.js";
import { FulfilmentError, type FulfilmentRepository } from "./service.js";

import { fulfilmentAddress, ManualDispatchError, type PackingInformation, type ManualDispatchCommand, type ManualDispatchResult } from "./manual-dispatch.js";

import {readCollectionReview,type CollectionReviewCommand} from "./collection-review.js";

export class PostgresFulfilmentRepository implements FulfilmentRepository {
  constructor(private readonly pool: pg.Pool) {}

  async reservePaidOrder(orderId: string, provider: string, idempotencyKey: string, correlationId: string) {
    return this.transaction(async (client) => {
      const orderResult = await client.query(`
        SELECT o.id, o.order_number, o.status, o.fulfilment_status, o.delivery_address_snapshot,
               EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'captured') AS captured
          FROM orders o WHERE o.id = $1 FOR UPDATE`, [orderId]);
      if (orderResult.rowCount !== 1) throw new FulfilmentError("not_found", "The order was not found.");
      const order = orderResult.rows[0];
      if (order.status !== "paid" || order.captured !== true) {
        throw new FulfilmentError("not_paid", "Only an order with a verified captured payment can be fulfilled.");
      }
      const linesResult = await client.query(`
        SELECT COALESCE(p.fulfilment_sku, oi.sku_snapshot) AS sku, oi.quantity
          FROM order_items oi JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1 ORDER BY oi.created_at`, [orderId]);
      const request: CreateFulfilmentRequest = Object.freeze({
        idempotencyKey, orderId: order.id, orderNumber: order.order_number,
        deliveryAddress: fulfilmentAddress(order.delivery_address_snapshot),
        lines: Object.freeze(linesResult.rows.map((line) => Object.freeze({ sku: line.sku, quantity: line.quantity }))),
      });
      const inserted = await client.query(`
        INSERT INTO fulfilments (order_id, provider, status, idempotency_key, request_snapshot)
        VALUES ($1, $2, 'created', $3, $4::jsonb)
        ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [orderId, provider, idempotencyKey, JSON.stringify(request)]);
      if (inserted.rowCount !== 1) {
        const existing = await client.query("SELECT id, provider_reference, status FROM fulfilments WHERE idempotency_key = $1 FOR UPDATE", [idempotencyKey]);
        if (existing.rows[0].status === "failed" && !existing.rows[0].provider_reference) {
          await client.query("UPDATE fulfilments SET status='created', failure_code=NULL WHERE id=$1", [existing.rows[0].id]);
          await client.query("UPDATE orders SET fulfilment_status='queued' WHERE id=$1", [orderId]);
          await this.audit(client, "fulfilment", existing.rows[0].id, "fulfilment.retry_reserved", correlationId, { orderId });
          return Object.freeze({ outcome: "reserved" as const, fulfilmentId: existing.rows[0].id, request });
        }
        return Object.freeze({ outcome: "duplicate" as const, fulfilmentId: existing.rows[0].id, request, ...(existing.rows[0].provider_reference ? { providerReference: existing.rows[0].provider_reference } : {}) });
      }
      await client.query("UPDATE orders SET fulfilment_status = 'queued' WHERE id = $1", [orderId]);
      await this.audit(client, "fulfilment", inserted.rows[0].id, "fulfilment.reserved", correlationId, { orderId });
      return Object.freeze({ outcome: "reserved" as const, fulfilmentId: inserted.rows[0].id, request });
    });
  }

  async confirmProviderCreation(input: Readonly<{ fulfilmentId: string; providerReference: string; status: "queued" | "accepted"; correlationId: string }>) {
    await this.transaction(async (client) => {
      const result = await client.query(`UPDATE fulfilments SET provider_reference = $2, status = $3
        WHERE id = $1 AND status = 'created' RETURNING order_id`, [input.fulfilmentId, input.providerReference, input.status]);
      if (result.rowCount !== 1) throw new Error("Fulfilment reservation was not available.");
      await client.query("UPDATE orders SET fulfilment_status = $2 WHERE id = $1", [result.rows[0].order_id, orderFulfilmentStatusFor(input.status)]);
      await this.audit(client, "fulfilment", input.fulfilmentId, "fulfilment.created", input.correlationId, { providerReference: input.providerReference });
    });
  }

  async failProviderCreation(fulfilmentId: string, failureCode: string, correlationId: string) {
    await this.transaction(async (client) => {
      const result = await client.query("UPDATE fulfilments SET status = 'failed', failure_code = $2 WHERE id = $1 AND status = 'created' RETURNING order_id", [fulfilmentId, failureCode]);
      if (result.rowCount === 1) {
        await client.query("UPDATE orders SET fulfilment_status = 'manual_review' WHERE id = $1", [result.rows[0].order_id]);
        await this.audit(client, "fulfilment", fulfilmentId, "fulfilment.failed", correlationId, { failureCode });
      }
    });
  }

  async getFulfilment(providerReference: string) {
    const result = await this.pool.query("SELECT status FROM fulfilments WHERE provider_reference = $1", [providerReference]);
    return result.rowCount === 1 ? Object.freeze({ status: result.rows[0].status as FulfilmentStatus }) : undefined;
  }

  async applyProviderEvent(provider: string, event: FulfilmentProviderEvent, correlationId: string) {
    return this.transaction(client => this.applyEvent(client, provider, event, correlationId));
  }

  // Shared atomic state/event/outbox writer for adapter events and manual commands.
  private async applyEvent(client: pg.PoolClient, provider: string, event: FulfilmentProviderEvent, correlationId: string, operatorId?: string) {
      const fulfilmentResult = await client.query("SELECT id, order_id, status FROM fulfilments WHERE provider = $1 AND provider_reference = $2 FOR UPDATE", [provider, event.providerReference]);
      if (fulfilmentResult.rowCount !== 1) throw new FulfilmentError("not_found", "The fulfilment reference was not found.");
      const fulfilment = fulfilmentResult.rows[0];
      const receipt = await client.query(`INSERT INTO fulfilment_events
        (provider, provider_event_id, fulfilment_id, target_status, correlation_id, payload)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb) ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id`,
      [provider, event.eventId, fulfilment.id, event.status, correlationId, JSON.stringify(event)]);
      if (receipt.rowCount !== 1) return "duplicate" as const;
      const transition = transitionFulfilment(fulfilment.status, event.status);
      if (transition.outcome !== "applied") {
        await client.query("UPDATE fulfilment_events SET processing_status = $2, processed_at = now() WHERE id = $1", [receipt.rows[0].id, transition.outcome]);
        if (transition.outcome === "requires_review") await client.query("UPDATE orders SET fulfilment_status = 'manual_review' WHERE id = $1", [fulfilment.order_id]);
        return transition.outcome;
      }
      await client.query(`UPDATE fulfilments SET status = $2, tracking_carrier = COALESCE($3, tracking_carrier),
        tracking_reference = COALESCE($4, tracking_reference), failure_code = COALESCE($5, failure_code), tracking_service = COALESCE($6, tracking_service), tracking_url = COALESCE($7, tracking_url),
        dispatched_at = CASE WHEN $2 = 'dispatched' THEN COALESCE(dispatched_at, now()) ELSE dispatched_at END,
        delivered_at = CASE WHEN $2 = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
        cancelled_at = CASE WHEN $2 = 'cancelled' THEN COALESCE(cancelled_at, now()) ELSE cancelled_at END,
        returned_at = CASE WHEN $2 = 'returned' THEN COALESCE(returned_at, now()) ELSE returned_at END WHERE id = $1`,
      [fulfilment.id, transition.status, event.trackingCarrier ?? null, event.trackingReference ?? null, event.failureCode ?? null, event.trackingService ?? null, event.trackingUrl ?? null]);
      const orderStatus = transition.status === "failed" ? "manual_review" : orderFulfilmentStatusFor(transition.status);
      await client.query("UPDATE orders SET fulfilment_status = $2 WHERE id = $1", [fulfilment.order_id, orderStatus]);
      await client.query("UPDATE fulfilment_events SET processing_status = 'processed', processed_at = now() WHERE id = $1", [receipt.rows[0].id]);
      await client.query(`INSERT INTO outbox_events (event_key, event_type, aggregate_type, aggregate_id, payload)
        VALUES ($1, $2, 'fulfilment', $3, $4::jsonb) ON CONFLICT (event_key) DO NOTHING`,
      [`${provider}:${event.eventId}`, `fulfilment.${transition.status}`, fulfilment.id, JSON.stringify({ orderId: fulfilment.order_id, trackingCarrier: event.trackingCarrier, trackingService: event.trackingService, trackingReference: event.trackingReference, trackingUrl: event.trackingUrl })]);
      if (operatorId) {
        await client.query(`INSERT INTO audit_events(entity_type,entity_id,action,actor_type,actor_id,correlation_id,change_summary)
          VALUES('fulfilment',$1,'fulfilment.dispatched','operator',$2,$3,$4::jsonb)`,
          [fulfilment.id, operatorId, correlationId, JSON.stringify({ orderId: fulfilment.order_id, fulfilmentId: fulfilment.id, state: "dispatched", carrier: event.trackingCarrier, service: event.trackingService, handoverConfirmed: true, eventId: event.eventId })]);
      } else await this.audit(client, "fulfilment", fulfilment.id, `fulfilment.${transition.status}`, correlationId, { eventId: event.eventId });
      return "applied" as const;
  }


  async packingInformation(orderId: string, operatorId: string): Promise<PackingInformation | undefined> {
    const result = await this.pool.query(`SELECT o.id,o.order_number,o.status,o.fulfilment_status,o.delivery_address_snapshot,o.shipping_method_snapshot,o.shipping_rate_snapshot,o.subtotal_minor,o.tax_minor,o.currency,c.email_display,
      EXISTS(SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.status='captured' AND p.amount_minor=o.total_minor AND p.currency=o.currency) AS captured,
      EXISTS(SELECT 1 FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.order_id=o.id AND r.status IN ('created','pending','completed','resolution_required')) AS refund_blocked,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('name',name_snapshot,'sku',sku_snapshot,'quantity',quantity) ORDER BY created_at,id) FROM order_items WHERE order_id=o.id),'[]'::jsonb) AS items,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'provider',provider,'status',status,'carrier',tracking_carrier,'service',tracking_service,'reference',tracking_reference,'trackingUrl',tracking_url,'dispatchedAt',dispatched_at) ORDER BY created_at,id) FROM fulfilments WHERE order_id=o.id),'[]'::jsonb) AS shipments
      FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=$1`, [orderId]);
    if (!result.rowCount) return undefined;
    const row = result.rows[0];
    if (row.status !== "paid" || !row.captured) throw new ManualDispatchError("conflict", "Packing requires a paid order with a captured payment.");
    await this.pool.query(`INSERT INTO audit_events(entity_type,entity_id,action,actor_type,actor_id,correlation_id,change_summary)
      VALUES('order',$1,'fulfilment.packing_viewed','operator',$2,gen_random_uuid(),'{}'::jsonb)`, [orderId,operatorId]);
    const shipments: PackingInformation["shipments"] = row.shipments;
    const isCollection=row.shipping_method_snapshot?.key===inpostCollectionMethod;
    const review=isCollection ? await readCollectionReview(this.pool,orderId) : undefined;
    const history=isCollection ? (await this.pool.query("SELECT version,status,collection_point,customer_authorisation_reference,reason,operator_id,created_at FROM inpost_collection_reviews WHERE order_id=$1 ORDER BY version",[orderId])).rows.map(entry=>({version:Number(entry.version),status:String(entry.status),point:entry.collection_point,customerAuthorisationReference:entry.customer_authorisation_reference,reason:String(entry.reason),operatorId:String(entry.operator_id),createdAt:new Date(entry.created_at).toISOString()})) : [];
    const requested=isCollection ? normaliseCollectionPoint(row.delivery_address_snapshot.collectionPoint) : undefined;
    return { orderId: row.id, orderNumber: row.order_number, orderStatus: row.status, fulfilmentStatus: row.fulfilment_status,
      ...(requested ? {collection:{requested,current:review?.point ?? requested,version:review?.version ?? 0,status:review?.status ?? "pending",email:row.email_display,phone:String(row.delivery_address_snapshot.phone ?? ""),parcelSize:row.shipping_rate_snapshot?.inpostParcel?.parcelSize ?? inpostParcelForQuantity(row.items.reduce((sum:number,item:{quantity:number})=>sum+Number(item.quantity),0)).parcelSize,contents:"IPL hair-removal device",declaredValueMinor:Number(row.subtotal_minor)+Number(row.tax_minor),currency:row.currency,history}} : {}),
      captured: row.captured, eligible: (!isCollection || review?.status==="matched") && !row.refund_blocked && row.fulfilment_status === "processing" && shipments.length === 1 &&
        shipments[0]!.status === "accepted" && ["manual-live","manual-test"].includes(shipments[0]!.provider),
      address: fulfilmentAddress(row.delivery_address_snapshot), items: row.items, shipments };
  }

  async reviewCollection(command:CollectionReviewCommand) {
    return this.transaction(async client=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[command.idempotencyKey]);
      const otherCommand=await client.query("SELECT idempotency_key FROM operator_commands WHERE idempotency_key=$1",[command.idempotencyKey]);
      if(otherCommand.rowCount) throw new ManualDispatchError("conflict","Review key belongs to another operator command.");
      const replay=await client.query("SELECT order_id,request_fingerprint,version,status,collection_point FROM inpost_collection_reviews WHERE idempotency_key=$1",[command.idempotencyKey]);
      if(replay.rowCount){const row=replay.rows[0];if(row.order_id!==command.orderId || row.request_fingerprint!==command.fingerprint) throw new ManualDispatchError("conflict","Review key belongs to another command.");return {version:Number(row.version),status:row.status as "matched"|"unavailable",point:row.collection_point};}
      const result=await client.query("SELECT status,fulfilment_status,shipping_method_snapshot,delivery_address_snapshot,total_minor,currency FROM orders WHERE id=$1 FOR UPDATE",[command.orderId]);
      const order=result.rows[0];
      if(!order || order.status!=="paid" || !["processing","manual_review"].includes(order.fulfilment_status) || order.shipping_method_snapshot?.key!==inpostCollectionMethod) throw new ManualDispatchError("conflict","Only an undispatched paid InPost order can be reviewed.");
      const payments=await client.query("SELECT id FROM payments WHERE order_id=$1 AND status='captured' AND amount_minor=$2 AND currency=$3",[command.orderId,order.total_minor,order.currency]);
      if(payments.rowCount!==1) throw new ManualDispatchError("conflict","A captured payment is required.");
      const shipments=await client.query("SELECT id FROM fulfilments WHERE order_id=$1 AND status='accepted' AND provider IN ('manual-test','manual-live')",[command.orderId]);
      if(shipments.rowCount!==1) throw new ManualDispatchError("conflict","An accepted manual fulfilment is required.");
      const refunds=await client.query("SELECT r.id FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.order_id=$1 AND r.status IN ('created','pending','completed','resolution_required')",[command.orderId]);
      if(refunds.rowCount) throw new ManualDispatchError("conflict","Refund issues must be resolved independently.");
      const previous=await readCollectionReview(client,command.orderId);
      if(order.fulfilment_status==="manual_review" && previous?.status!=="unavailable") throw new ManualDispatchError("conflict","Other manual-review issues must be resolved independently.");
      if((previous?.version ?? 0)!==command.expectedVersion) throw new ManualDispatchError("conflict","Collection review changed; reload before continuing.");
      const point=command.point ?? previous?.point ?? normaliseCollectionPoint(order.delivery_address_snapshot.collectionPoint);
      const status=command.action==="unavailable" ? "unavailable" as const : "matched" as const;
      const version=command.expectedVersion+1;
      await client.query("INSERT INTO inpost_collection_reviews(order_id,version,status,collection_point,customer_authorisation_reference,reason,operator_id,idempotency_key,request_fingerprint) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)",[command.orderId,version,status,JSON.stringify(point),command.customerAuthorisationReference ?? null,command.reason,command.operatorId,command.idempotencyKey,command.fingerprint]);
      await client.query("UPDATE orders SET fulfilment_status=$2 WHERE id=$1",[command.orderId,status==="unavailable" ? "manual_review" : "processing"]);
      await client.query("INSERT INTO audit_events(entity_type,entity_id,action,actor_type,actor_id,correlation_id,change_summary) VALUES('order',$1,'fulfilment.collection_review','operator',$2,$3,$4::jsonb)",[command.orderId,command.operatorId,command.correlationId,JSON.stringify({version,status,action:command.action,customerAuthorised:!!command.customerAuthorisationReference})]);
      return {version,status,point};
    });
  }

  async dispatchManual(command: ManualDispatchCommand, provider: string): Promise<ManualDispatchResult> {
    try {
      return await this.transaction(async client => {
        // Same key is serialised across all operator commands; different keys
        // are additionally serialised by payment, order and fulfilment locks.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [command.idempotencyKey]);
        const otherReview=await client.query("SELECT idempotency_key FROM inpost_collection_reviews WHERE idempotency_key=$1",[command.idempotencyKey]);
        if(otherReview.rowCount) throw new ManualDispatchError("conflict","Dispatch key belongs to a collection review.");
        const replay = await client.query("SELECT request_fingerprint,status,result FROM operator_commands WHERE idempotency_key=$1", [command.idempotencyKey]);
        if (replay.rowCount) {
          if (replay.rows[0].request_fingerprint !== command.fingerprint || replay.rows[0].status !== "completed") throw new ManualDispatchError("conflict", "Idempotency key belongs to a different or unfinished command.");
          return replay.rows[0].result as ManualDispatchResult;
        }
        // Match payment/refund lock order. NOWAIT on the order avoids waiting
        // on a workflow which holds the order while it requests a payment lock.
        const payments = await client.query("SELECT id,status,amount_minor,currency FROM payments WHERE order_id=$1 ORDER BY id FOR UPDATE", [command.orderId]);
        const orders = await client.query("SELECT id,status,fulfilment_status,total_minor,currency,shipping_method_snapshot FROM orders WHERE id=$1 FOR UPDATE NOWAIT", [command.orderId]);
        if (!orders.rowCount) throw new ManualDispatchError("not_found", "Order not found.");
        const order = orders.rows[0];
        if(order.shipping_method_snapshot?.key===inpostCollectionMethod){
          const review=await readCollectionReview(client,command.orderId);
          if(review?.status!=="matched" || command.carrier.toLowerCase()!=="inpost") throw new ManualDispatchError("conflict","InPost collection requires a matched authorised point and actual InPost shipment details.");
        }
        const captured = payments.rows.filter(payment => payment.status === "captured");
        if (order.status !== "paid" || captured.length !== 1 || Number(captured[0].amount_minor) !== Number(order.total_minor) || captured[0].currency !== order.currency ||
            payments.rows.some(payment => ["partially_refunded","refunded","resolution_required","dispute_opened","dispute_resolved"].includes(payment.status))) throw new ManualDispatchError("conflict", "Dispatch requires an eligible paid order and verified captured payment.");
        const refunds = await client.query(`SELECT r.id FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.order_id=$1
          AND r.status IN ('created','pending','completed','resolution_required') LIMIT 1`, [command.orderId]);
        if (refunds.rowCount) throw new ManualDispatchError("conflict", "Refund activity blocks dispatch. Review the order.");
        const fulfilments = await client.query("SELECT id,provider,provider_reference,status FROM fulfilments WHERE order_id=$1 ORDER BY id FOR UPDATE", [command.orderId]);
        const selected = fulfilments.rows[0];
        if (order.fulfilment_status !== "processing" || fulfilments.rowCount !== 1 || !selected || selected.id !== command.fulfilmentId ||
            !selected.provider_reference || selected.provider !== provider || !["manual-live","manual-test"].includes(selected.provider) ||
            transitionFulfilment(selected.status, "dispatched").outcome !== "applied") throw new ManualDispatchError("conflict", "An accepted manual fulfilment is required. Reload and review.");
        await client.query(`INSERT INTO operator_commands(idempotency_key,command_type,target_type,target_id,operator_id,request_fingerprint)
          VALUES($1,'fulfilment.dispatch','order',$2,$3,$4)`, [command.idempotencyKey,command.orderId,command.operatorId,command.fingerprint]);
        const outcome = await this.applyEvent(client, selected.provider, {
          eventId: `manual-dispatch:${selected.id}`, providerReference: selected.provider_reference, status: "dispatched",
          trackingCarrier: command.carrier, trackingService: command.service, trackingReference: command.trackingReference,
          ...(command.trackingUrl ? { trackingUrl: command.trackingUrl } : {}),
        }, command.correlationId, command.operatorId);
        if (outcome !== "applied") throw new ManualDispatchError("conflict", "Dispatch was already recorded. Reload and review.");
        const saved = await client.query("SELECT dispatched_at FROM fulfilments WHERE id=$1", [selected.id]);
        const result: ManualDispatchResult = { orderId: command.orderId, fulfilmentId: selected.id, status: "dispatched", dispatchedAt: saved.rows[0].dispatched_at.toISOString() };
        await client.query("UPDATE operator_commands SET status='completed',result=$2::jsonb WHERE idempotency_key=$1", [command.idempotencyKey,JSON.stringify(result)]);
        return result;
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && ["55P03","40P01","40001"].includes(String(error.code))) throw new ManualDispatchError("conflict", "Order is busy. Reload and review before retrying.");
      throw error;
    }
  }

  private async audit(client: pg.PoolClient, entityType: string, entityId: string, action: string, correlationId: string, summary: Record<string, unknown>) {
    await client.query(`INSERT INTO audit_events (entity_type, entity_id, action, actor_type, correlation_id, change_summary)
      VALUES ($1, $2, $3, 'system', $4, $5::jsonb)`, [entityType, entityId, action, correlationId, JSON.stringify(summary)]);
  }
  private async transaction<Result>(work: (client: pg.PoolClient) => Promise<Result>): Promise<Result> {
    const client = await this.pool.connect();
    try { await client.query("BEGIN"); const result = await work(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
}
