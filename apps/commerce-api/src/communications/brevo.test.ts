import test from "node:test";
import assert from "node:assert/strict";
import { BrevoCommunicationProvider } from "./brevo.js";
import { CommunicationFailure } from "./failure.js";
import { loadCommunicationConfig } from "./config.js";
import { TransactionalCommunicationConsumer, type CommunicationRepository } from "./service.js";
import { renderTransactionalMessage } from "./templates.js";
const config={apiKey:"synthetic-test-credential",fromAddress:"orders@example.test",fromName:"CYPH/1",replyTo:"support@example.test"};
const context={deliveryId:"d1",claimToken:"token",template:"order-confirmation" as const,deduplicationKey:"order-confirmation:o1",recipient:"buyer@example.test",orderNumber:"SYNTHETIC",currency:"GBP"};
const message=renderTransactionalMessage(context);
const environment={NODE_ENV:"production",COMMUNICATIONS_ENABLED:"true",COMMUNICATION_PROVIDER:"brevo",COMMUNICATIONS_LIVE_SEND_ENABLED:"true",BREVO_API_KEY:config.apiKey,TRANSACTIONAL_FROM_ADDRESS:config.fromAddress,TRANSACTIONAL_FROM_NAME:config.fromName,TRANSACTIONAL_REPLY_TO_ADDRESS:config.replyTo};
const transport=(response:Response):typeof fetch=>async()=>response;
const failure=(kind:string)=> (error:unknown)=>error instanceof CommunicationFailure&&error.kind===kind&&!error.message.includes(config.apiKey)&&!error.message.includes(context.recipient);
test("communications are disabled by default; credential alone does not enable sends",()=>{
  assert.equal(loadCommunicationConfig({}).enabled,false);assert.equal(loadCommunicationConfig({BREVO_API_KEY:config.apiKey}).enabled,false);
  assert.equal(loadCommunicationConfig(environment).brevo?.replyTo,config.replyTo);
});
test("configuration fails closed for missing approval, invalid flags/sender and production test provider",()=>{
  for(const change of [{COMMUNICATIONS_ENABLED:"yes"},{COMMUNICATION_PROVIDER:"unknown"},{COMMUNICATIONS_LIVE_SEND_ENABLED:"false"},{NODE_ENV:"development"},{BREVO_API_KEY:""},{BREVO_API_KEY:"bad\nkey"},{TRANSACTIONAL_FROM_ADDRESS:"bad"},{TRANSACTIONAL_REPLY_TO_ADDRESS:"bad\n@example.test"},{TRANSACTIONAL_FROM_NAME:""},{COMMUNICATION_PROVIDER:"manual-test"}]) assert.throws(()=>loadCommunicationConfig({...environment,...change}));
  assert.throws(()=>loadCommunicationConfig({COMMUNICATIONS_ENABLED:"true"}));
  assert.throws(()=>loadCommunicationConfig({["PUBLIC_"+"BREVO_API_KEY"]:"synthetic"}));
  assert.equal(loadCommunicationConfig({NODE_ENV:"test",COMMUNICATION_PROVIDER:"manual-test",COMMUNICATIONS_ENABLED:"true"}).enabled,true);
});
test("Brevo request includes application HTML/text, From, Reply-To and stable UUID identity only",async()=>{
  const requests:RequestInit[]=[];
  const provider=new BrevoCommunicationProvider(config,async(url,init)=>{assert.equal(url,"https://api.brevo.com/v3/smtp/email");requests.push(init!);return Response.json({messageId:"<synthetic-message>"},{status:201});});
  assert.equal((await provider.send(message)).providerReference,"<synthetic-message>");await provider.send(message);
  const body=JSON.parse(requests[0]!.body as string);
  assert.deepEqual(body.sender,{email:config.fromAddress,name:config.fromName});assert.deepEqual(body.replyTo,{email:config.replyTo});
  assert.equal(body.htmlContent,message.html);assert.equal(body.textContent,message.text);assert.deepEqual(body.to,[{email:context.recipient}]);
  assert.match(body.headers.idempotencyKey,/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(requests[0]!.body,requests[1]!.body);assert.equal(requests[0]!.redirect,"error");
  assert.equal(body.templateId,undefined);assert.equal(body.listIds,undefined);assert.equal(body.attributes,undefined);
});
for(const status of [400,401,403,404,422]) test(`definite ${status} rejection is permanent and leaks no body`,async()=>{
  await assert.rejects(()=>new BrevoCommunicationProvider(config,transport(new Response(config.apiKey+context.recipient,{status}))).send(message),failure("permanent"));
});
test("429 rejection permits bounded retry",async()=>{
  await assert.rejects(()=>new BrevoCommunicationProvider(config,transport(new Response("private provider body",{status:429}))).send(message),failure("retryable"));
});
for(const status of [302,408,409,500,502,503]) test(`uncertain ${status} is not a definite failure`,async()=>{
  await assert.rejects(()=>new BrevoCommunicationProvider(config,transport(new Response("private provider body",{status}))).send(message),failure("ambiguous"));
});
test("network and malformed/oversized/missing-reference responses are ambiguous",async()=>{
  const broken:typeof fetch=async()=>{throw new Error(config.apiKey+context.recipient);};
  await assert.rejects(()=>new BrevoCommunicationProvider(config,broken).send(message),failure("ambiguous"));
  for(const body of ["not JSON","{}",JSON.stringify({messageId:"bad\nreference"}),"x".repeat(9000)]) await assert.rejects(()=>new BrevoCommunicationProvider(config,transport(new Response(body,{status:201}))).send(message),failure("ambiguous"));
});
test("timeout aborts transport and remains bounded even if transport ignores abort",async()=>{
  let signal:AbortSignal|undefined;
  const hanging:typeof fetch=async(_url,init)=>{signal=init!.signal as AbortSignal;return new Promise<Response>(()=>{});};
  await assert.rejects(()=>new BrevoCommunicationProvider(config,hanging,5).send(message),failure("ambiguous"));assert.equal(signal?.aborted,true);
});
function repository() {
  let claimed=false;const calls:string[]=[];
  const repo:CommunicationRepository={claimNext:async()=>{if(claimed)return undefined;claimed=true;return context;},beginSend:async()=>{calls.push("begin");},markSent:async()=>{calls.push("sent");},markReview:async()=>{calls.push("review");},markFailed:async(_id,_code,_token,permanent)=>{calls.push(permanent?"permanent":"retry");}};
  return {repo,calls};
}
test("uncertain sends and accepted-send persistence failures go to review and are not resent",async()=>{
  for(const persistenceFailure of [false,true]){
    const {repo,calls}=repository();let sends=0;
    if(persistenceFailure)repo.markSent=async()=>{throw new Error("database unavailable");};
    const provider={key:"synthetic",send:async()=>{sends++;if(!persistenceFailure)throw new CommunicationFailure("ambiguous","provider_timeout");return {providerReference:"synthetic",acceptedAt:new Date().toISOString()};}};
    const consumer=new TransactionalCommunicationConsumer(true,repo,provider);
    assert.equal((await consumer.consumeOne()).outcome,"manual_review");assert.equal((await consumer.consumeOne()).outcome,"empty");assert.equal(sends,1);assert.deepEqual(calls,["begin","review"]);
  }
});
test("definite retryable and permanent failures remain distinct",async()=>{
  for(const kind of ["retryable","permanent"] as const){const {repo,calls}=repository();const consumer=new TransactionalCommunicationConsumer(true,repo,{key:"synthetic",send:async()=>{throw new CommunicationFailure(kind,"provider_rejected");}});assert.equal((await consumer.consumeOne()).outcome,"failed");assert.deepEqual(calls,["begin",kind==="permanent"?"permanent":"retry"]);}
});
test("lost pre-send claim never calls provider",async()=>{
  const {repo}=repository();repo.beginSend=async()=>{throw new Error("claim lost");};let sends=0;
  await new TransactionalCommunicationConsumer(true,repo,{key:"synthetic",send:async()=>{sends++;return {providerReference:"x",acceptedAt:"now"};}}).consumeOne();assert.equal(sends,0);
});
test("shared tracking permits HTTPS only and preserves carrier/reference without inventing URLs",()=>{
  for(const trackingUrl of [undefined,"http://carrier.example/track","javascript:bad"]){const rendered=renderTransactionalMessage({...context,template:"dispatch",trackingCarrier:"Neutral carrier",trackingReference:"REF",...(trackingUrl?{trackingUrl}:{})});assert.match(rendered.text,/Neutral carrier/);assert.match(rendered.text,/REF/);assert.doesNotMatch(rendered.html,/Track your delivery<\/a>/);}
  assert.match(renderTransactionalMessage({...context,template:"dispatch",trackingUrl:"https://carrier.example/track"}).html,/Track your delivery<\/a>/);
});
