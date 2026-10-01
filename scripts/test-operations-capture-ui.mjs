import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../src/pages/private-operations/[slug].astro',import.meta.url),'utf8');
const html=process.env.OPERATIONS_UI_HTML?await readFile(process.env.OPERATIONS_UI_HTML,'utf8'):source;
const inline=html.match(/<script\s+([^>]*type="module"[^>]*)>([\s\S]*?)<\/script>/);
assert.ok(inline,'Operations script must remain inline');
assert.doesNotMatch(inline[1],/\bsrc=/);
assert.match(source,/<script is:inline type="module">/);
const script=inline[2];
new vm.Script(script); // Exercise browser JavaScript directly, without TypeScript transpilation.
function fixture(){
  class Element {
    hidden=false;disabled=false;value='0.50';attributes={};_text='';dataset={};listeners={};button;description;children=[];
    get textContent(){return this._text;}set textContent(value){this._text=value;this.children=[];}
    constructor(form=false){if(form){this.button=new Element();this.description=new Element();}}
    getAttribute(name){return name==='data-api'?'https://ops.test':this.attributes[name];}setAttribute(name,value){this.attributes[name]=value;}removeAttribute(name){delete this.attributes[name];if(name==='hidden')this.hidden=false;}focus(){this.focused=true;}append(child){this.children.push(child);}reportValidity(){return true;}
    querySelector(selector){return selector==='button'?this.button:selector==='p'?this.description:undefined;}
    addEventListener(name,fn){this.listeners[name]=fn;}
  }
  const elements=Object.fromEntries(['.ops','#message','#search','#results','#details','#summary','#timeline','#capture','#reconcile-capture','#refund','#amount','#refund-message','#refund-warning','#refund-amount-error','#export'].map(id=>[id,new Element(['#capture','#reconcile-capture','#refund'].includes(id))]));
  elements['#details'].hidden=true;
  elements['#details-title']=new Element();
  elements['#details'].querySelector=selector=>selector==='#details-title'?elements['#details-title']:undefined;
  let command,status='pending_payment',payment='authorised',failGet=false,postResult={status:'completed',outcome:'capture_reconciled',message:'Capture reconciled — provider capture already existed.'};
  let refunds=[];let currency='GBP';let responseStatus=200;let malformed=false;let failPost=false;let afterPost=()=>{};const requests=[];
  const context=vm.createContext({HTMLElement:Element,HTMLButtonElement:Element,document:{querySelector:id=>elements[id],createElement:()=>new Element()},FormData:class{get(name){return name==='reason'?'customer_request':'TEST';}},crypto:{randomUUID:()=> 'original-ui-key'},fetch:async(url,options)=>{
    requests.push({url,options});
    if(options.method==='POST'){if(failPost)throw new Error('network timeout');afterPost();return {ok:responseStatus<400,status:responseStatus,json:async()=>{if(malformed)throw new Error('invalid JSON');return postResult;}};}
    if(failGet)throw new Error('load failed');
    if(url.includes('?q='))return {ok:true,json:async()=>({orders:[{id:'o1',orderNumber:'TEST',status}]})};
    return {ok:true,json:async()=>({order:{orderNumber:'TEST',status,currency,totalMinor:1000},refunds,payments:[{status:payment}],captureCommand:command,timeline:[]})};
  }});
  vm.runInContext(script,context);
  return {elements,requests,search:()=>elements['#search'].listeners.submit({preventDefault(){},currentTarget:elements['#search']}),choose:()=>elements['#results'].children[0].listeners.click(),onPost:fn=>{afterPost=fn;},load:()=>vm.runInContext("load('o1')",context),submit:(id)=>elements[id].listeners.submit({preventDefault(){},currentTarget:elements[id]}),
    command:value=>{command=value;},paid:()=>{status='paid';payment='captured';},failGet:()=>{failGet=true;},failPost:()=>{failPost=true;},result:value=>{postResult=value;},refunds:value=>{refunds=value;},currency:value=>{currency=value;},responseStatus:value=>{responseStatus=value;},malformed:()=>{malformed=true;}};
}
test('existing unresolved commands show Reconcile and hide ordinary Capture',async()=>{
  for(const status of ['reserved','resolution_required','failed','pending']){const f=fixture();f.command({status});await f.load();assert.equal(f.elements['#capture'].hidden,true);assert.equal(f.elements['#reconcile-capture'].hidden,false);await f.submit('#reconcile-capture');const post=f.requests.find(r=>r.options.method==='POST');assert.equal(post.url,'https://ops.test/operations/orders/o1/capture/reconcile');assert.deepEqual(Object.keys(post.options.headers),[]);assert.match(f.elements['#message'].textContent,/provider capture already existed/);}
});
test('successful command hides capture controls; uncaptured order offers ordinary capture',async()=>{
  const f=fixture();await f.load();assert.equal(f.elements['#capture'].button.disabled,false);assert.equal(f.elements['#reconcile-capture'].hidden,true);
  assert.equal(f.elements['#details'].hidden,false);assert.equal(f.elements['#details-title'].focused,true);
  assert.match(f.elements['#summary'].textContent,/TEST/);
  f.command({status:'completed'});f.paid();await f.load();assert.equal(f.elements['#capture'].hidden,true);assert.equal(f.elements['#reconcile-capture'].hidden,true);
});
test('unknown POST and failed reload keep both buttons disabled',async()=>{
  const f=fixture();await f.load();f.failPost();f.failGet();await f.submit('#capture');assert.equal(f.elements['#capture'].button.disabled,true);assert.equal(f.elements['#reconcile-capture'].button.disabled,true);
});
test('repeat ordinary submit reuses its key after network error and confirmed no local command',async()=>{
  const f=fixture();await f.load();f.failPost();await f.submit('#capture');await f.submit('#capture');const posts=f.requests.filter(r=>r.options.method==='POST');assert.equal(posts.length,2);assert.equal(posts[0].options.headers['Idempotency-Key'],posts[1].options.headers['Idempotency-Key']);
});
test('resolution outcome stays explicit and does not re-enable capture',async()=>{
  const f=fixture();f.command({status:'resolution_required'});f.result({status:'resolution_required',outcome:'manual_resolution_required',message:'Safe automatic replay cannot be established; manual resolution required.'});await f.load();await f.submit('#reconcile-capture');assert.match(f.elements['#message'].textContent,/manual resolution required/);assert.equal(f.elements['#capture'].hidden,true);
});

test('pending capture is announced neutrally and remains lookup-only after reload',async()=>{
  const f=fixture();await f.load();f.onPost(()=>f.command({status:'pending'}));
  f.result({status:'pending',message:'Capture submitted — awaiting provider confirmation.'});
  await f.submit('#capture');assert.match(f.elements['#message'].textContent,/awaiting provider confirmation/);
  assert.equal(f.elements['#message'].dataset.state,'');assert.equal(f.elements['#capture'].hidden,true);
  assert.match(f.elements['#reconcile-capture'].description.textContent,/awaiting provider confirmation/);
  assert.equal(f.elements['#reconcile-capture'].hidden,false);
});
test('reconciliation refreshes search row and timeline from authoritative order response',async()=>{
  const f=fixture();f.command({status:'pending'});await f.search();await f.choose();
  assert.match(f.elements['#results'].children[0].textContent,/pending_payment/);
  f.onPost(()=>{f.paid();f.command({status:'completed'});});await f.submit('#reconcile-capture');
  assert.match(f.elements['#results'].children[0].textContent,/TEST — paid$/);
  assert.match(f.elements['#summary'].textContent,/paid/);assert.doesNotMatch(f.elements['#summary'].textContent,/pending_payment/);
  assert.equal(f.requests.at(-1).url,'https://ops.test/operations/orders/o1');
});
test('successful operation response cannot invent paid status before authoritative refresh',async()=>{
  const f=fixture();f.command({status:'pending'});await f.search();await f.choose();await f.submit('#reconcile-capture');
  assert.match(f.elements['#results'].children[0].textContent,/pending_payment/);assert.match(f.elements['#summary'].textContent,/pending_payment/);
});


test('refund converts GBP exactly and distinguishes pending from completed submissions',async()=>{
  for(const status of ['pending','completed']){
    const f=fixture();f.result({status});await f.load();await f.submit('#refund');
    const post=f.requests.find(r=>r.options.method==='POST');assert.equal(post.url,'https://ops.test/operations/orders/o1/refunds');
    assert.deepEqual(JSON.parse(post.options.body),{amountMinor:50,reason:'customer_request'});
    assert.equal(post.options.headers['Idempotency-Key'],'original-ui-key');assert.equal(post.options.credentials,'include');
    assert.equal(f.elements['#refund-message'].textContent,status==='pending'?'Refund submitted — awaiting provider confirmation.':'Refund submitted.');
    assert.equal(f.elements['#refund'].button.disabled,false);
  }
});
test('invalid refund amounts are announced inline and never sent',async()=>{
  for(const value of ['', '0','0.00','-1','abc','0.001','1e2','Infinity','9007199254740992']){
    const f=fixture();await f.load();f.elements['#amount'].value=value;await f.submit('#refund');
    assert.equal(f.requests.filter(r=>r.options.method==='POST').length,0);
    assert.equal(f.elements['#refund-amount-error'].textContent,'Enter a valid refund amount.');
    assert.equal(f.elements['#amount'].attributes['aria-invalid'],'true');assert.equal(f.elements['#amount'].focused,true);
    f.elements['#amount'].listeners.input();assert.equal(f.elements['#refund-amount-error'].textContent,'');
  }
});
test('existing unresolved refund disables submission and visibly explains uncertainty',async()=>{
  const f=fixture();f.refunds([{status:'completed'},{status:'resolution_required'}]);await f.load();
  assert.equal(f.elements['#refund'].button.disabled,true);assert.equal(f.elements['#refund-warning'].hidden,false);
  assert.match(f.elements['#refund-message'].textContent,/previous refund requires resolution/);
  await f.submit('#refund');assert.equal(f.requests.filter(r=>r.options.method==='POST').length,0);
  f.refunds([{status:'completed'}]);await f.load();
  assert.equal(f.elements['#refund'].button.disabled,false);assert.equal(f.elements['#refund-warning'].hidden,true);assert.equal(f.elements['#refund-message'].textContent,'');
});
test('refund reports only recognised balance and permission failures',async()=>{
  for(const [status,result,message] of [
    [409,{code:'conflict',message:'Refund amount exceeds the unreserved payment balance.'},'Refund amount exceeds the remaining refundable balance.'],
    [409,{code:'conflict',message:'The provider no longer reports enough refundable value.'},'Refund amount exceeds the remaining refundable balance.'],
    [403,{},'You do not have permission to issue this refund.'],[401,{},'You do not have permission to issue this refund.'],
    [409,{code:'conflict',message:'The idempotency key was used for a different request.'},'Refund unavailable. Check the order status and refund details.'],
  ]){const f=fixture();await f.load();f.responseStatus(status);f.result(result);await f.submit('#refund');assert.equal(f.elements['#refund-message'].textContent,message);}
});
test('refund provider and network failures remain cautious and do not expose diagnostics',async()=>{
  for(const network of [false,true]){
    const f=fixture();await f.load();f.responseStatus(502);f.result({message:'secret-provider-text',providerDiagnostic:{detail:'Authorization API-key customer@example.test'}});if(network)f.failPost();
    await f.submit('#refund');assert.equal(f.elements['#refund-message'].textContent,'The refund could not be confirmed. Check the order status before trying again.');
    assert.doesNotMatch(f.elements['#refund-message'].textContent,/secret|Authorization|API-key|customer@example/);
  }
});
test('refund failure refreshes resolution state; failed refresh keeps submission locked',async()=>{
  const f=fixture();await f.load();f.responseStatus(502);f.onPost(()=>f.refunds([{status:'resolution_required'}]));await f.submit('#refund');
  assert.equal(f.elements['#refund'].button.disabled,true);assert.match(f.elements['#refund-message'].textContent,/previous refund requires resolution/);
  const g=fixture();await g.load();g.failPost();g.failGet();await g.submit('#refund');assert.equal(g.elements['#refund'].button.disabled,true);assert.match(g.elements['#refund-message'].textContent,/Reload the order/);
});
test('unknown or non-GBP order data cannot enable currency refund controls',async()=>{
  const f=fixture();f.refunds(undefined);await f.load();await f.submit('#refund');assert.equal(f.elements['#refund'].button.disabled,true);assert.equal(f.requests.filter(r=>r.options.method==='POST').length,0);
  const g=fixture();g.currency('EUR');await g.load();assert.equal(g.elements['#refund'].button.disabled,true);assert.match(g.elements['#refund-message'].textContent,/GBP orders only/);
});
test('refund messages have accessible announcements and control associations',()=>{
  assert.match(source,/id="refund-message" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(source,/id="refund-amount-error" role="alert"/);
  assert.match(source,/aria-describedby="refund-amount-error refund-message"/);
  assert.match(source,/aria-describedby="refund-warning refund-message"/);
  assert.match(source,/Refund requires resolution/);assert.match(source,/The provider outcome is uncertain/);
});
