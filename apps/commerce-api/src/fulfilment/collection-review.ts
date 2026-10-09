import {createHash,randomUUID} from "node:crypto";
import type pg from "pg";
import {normaliseCollectionPoint,type CollectionPoint} from "../../../../packages/commerce-core/src/index.js";
import {ManualDispatchError} from "./manual-dispatch.js";
export type CollectionReview = Readonly<{version:number; status:"matched"|"unavailable"; point:CollectionPoint}>;
export type CollectionReviewCommand = Readonly<{orderId:string; operatorId:string; idempotencyKey:string; fingerprint:string; correlationId:string; expectedVersion:number; action:"confirm-match"|"unavailable"|"approve-alternative"; reason:string; point?:CollectionPoint; customerAuthorisationReference?:string}>;
export const collectionReviewCommand = (orderId:string,body:unknown,operatorId:string,idempotencyKey:string):CollectionReviewCommand => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId) || !operatorId.trim() || operatorId.length>254 || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(idempotencyKey)) throw new ManualDispatchError("invalid_request","Valid review identifiers are required.");
  if (!body || typeof body!=="object" || Array.isArray(body)) throw new ManualDispatchError("invalid_request","Collection review is required.");
  const value=body as Record<string,unknown>;
  if (Object.keys(value).some(key=>!["expectedVersion","action","reason","point","customerAuthorisationReference","matchedInSend"].includes(key)) || !Number.isSafeInteger(value.expectedVersion) || Number(value.expectedVersion)<0 || !["confirm-match","unavailable","approve-alternative"].includes(String(value.action))) throw new ManualDispatchError("invalid_request","Invalid collection review.");
  const text=(entry:unknown,max:number):string=>{if(typeof entry!=="string" || !entry.trim() || entry.length>max || /[\u0000-\u001f\u007f]/.test(entry)) throw new ManualDispatchError("invalid_request","Record a review reason and customer authorisation where required."); return entry.trim();};
  const action=value.action as CollectionReviewCommand["action"];
  if (action!=="unavailable" && value.matchedInSend!==true) throw new ManualDispatchError("invalid_request","Confirm the point was matched in InPost Send.");
  if(action!=="approve-alternative" && (value.point!==undefined || value.customerAuthorisationReference!==undefined)) throw new ManualDispatchError("invalid_request","Only an authorised alternative can change the collection point.");
  let point:CollectionPoint|undefined;let customerAuthorisationReference:string|undefined;
  if(action==="approve-alternative") {try{point=normaliseCollectionPoint(value.point);}catch{throw new ManualDispatchError("invalid_request","Complete the alternative collection point.");}customerAuthorisationReference=text(value.customerAuthorisationReference,200);}
  const command={orderId:orderId.toLowerCase(),operatorId,expectedVersion:Number(value.expectedVersion),action,reason:text(value.reason,500),...(point?{point}:{}),...(customerAuthorisationReference?{customerAuthorisationReference}:{})};
  return {...command,idempotencyKey,fingerprint:createHash("sha256").update(JSON.stringify(command)).digest("hex"),correlationId:randomUUID()};
};
export const readCollectionReview = async (client:Pick<pg.Pool,"query">|Pick<pg.PoolClient,"query">,orderId:string):Promise<CollectionReview|undefined> => {
  const result=await client.query("SELECT version,status,collection_point FROM inpost_collection_reviews WHERE order_id=$1 ORDER BY version DESC LIMIT 1",[orderId]);
  return result.rowCount ? {version:Number(result.rows[0].version),status:result.rows[0].status,point:result.rows[0].collection_point} : undefined;
};
