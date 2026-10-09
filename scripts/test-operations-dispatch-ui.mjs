import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../src/components/ManualFulfilmentPanel.astro',import.meta.url),'utf8');
const html=process.env.OPERATIONS_UI_HTML?await readFile(process.env.OPERATIONS_UI_HTML,'utf8'):source;
const script=[...html.matchAll(/<script[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)].find(match=>match[1].includes("const packing=")&&match[1].includes("loadPacking()"))[1];
new vm.Script(script);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 class Element{
  hidden=false;disabled=false;checked=false;value='';textContent='';children=[];listeners={};attributes={};valid=true;
  addEventListener(name,listener){this.listeners[name]=listener;}
  dispatchEvent(event){this.listeners[event.type]?.(event);}
  append(child){this.children.push(child);}
  replaceChildren(){this.children=[];}
  querySelectorAll(){return this.inputs??[];}
  getAttribute(name){return name==='data-api'?'https://ops.example':this.attributes[name];}
  reportValidity(){return this.valid;}
  reset(){elements['#dispatch-handover'].checked=false;}
 }
 const ids=['.ops','#packing','#packing-information','#packing-message','#manual-dispatch','#dispatch-fields','#dispatch-submit','#dispatch-edit','#dispatch-review','#dispatch-message','#packing-refresh','#packing-state','#packing-address','#packing-items','#packing-shipments','#dispatch-handover'];
 ids.push('#collection-booking','#collection-booking-details','#collection-review-history','#collection-review-fields','#collection-review-form','#collection-review-action','#collection-alternative','#collection-review-message');
 const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
 elements['#collection-alternative'].inputs=['name','address','postalCode','locationId','customerAuthorisationReference'].map(name=>Object.assign(new Element(),{name}));
 let response={orderId:'o1',orderNumber:'SYNTHETIC-1',orderStatus:'paid',fulfilmentStatus:'processing',captured:true,eligible:true,dispatchEnabled:true,address:{recipientName:'Synthetic Customer',line1:'1 Test Street',locality:'London',postalCode:'TEST',countryCode:'GB'},items:[{name:'Synthetic item',sku:'TEST',quantity:1}],shipments:[{id:'f1',status:'accepted'}]};
 let deny=false,fail=false,posts=0,postStatus=200,defer;const requests=[],events=[];
 const values={carrier:'Carrier',service:'Service',trackingReference:'REF',trackingUrl:'https://carrier.example/track'};
 const context=vm.createContext({document:{querySelector:id=>elements[id],createElement:()=>new Element()},FormData:class{get(key){return key==='handoverConfirmed'?(elements['#dispatch-handover'].checked?'on':null):values[key];}},crypto:{randomUUID:()=> 'stable-key'},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},fetch:async(url,options)=>{
  requests.push({url,options});
  if(options.method==='POST'){posts++;if(fail)throw new Error('Network uncertain');if(defer)await defer;
    if(postStatus>=400)return{ok:false,status:postStatus,json:async()=>({message:'Dispatch refused.'})};
    response={...response,eligible:false,fulfilmentStatus:'dispatched',shipments:[{id:'f1',status:'dispatched',carrier:'Carrier',reference:'REF'}]};
    return{ok:true,status:200,json:async()=>({status:'dispatched',dispatchedAt:'2026-10-07T12:00:00Z'})};
  }
  return{ok:!deny,status:deny?403:200,json:async()=>response};
 }});
 vm.runInContext(script,context);
 elements['#packing'].addEventListener('operations-dispatch-recorded',event=>events.push(event));
 return{elements,requests,events,values,
  load:async(id='o1')=>{elements['#packing'].dispatchEvent({type:'operations-order-loaded',detail:{id}});await flush();},
  clear:()=>elements['#packing'].dispatchEvent({type:'operations-order-loading'}),
  submit:()=>elements['#manual-dispatch'].listeners.submit({preventDefault(){}}),
  confirm:()=>{elements['#dispatch-handover'].checked=true;},
  state:change=>{response={...response,...change};},deny:()=>{deny=true;},fail:()=>{fail=true;},postStatus:value=>{postStatus=value;},defer:value=>{defer=value;},posts:()=>posts,
 };
}
test('packing read renders bounded text, no-store request and current state',async()=>{
 const f=fixture();await f.load();assert.match(f.elements['#packing-address'].textContent,/Synthetic Customer/);assert.match(f.elements['#packing-state'].textContent,/captured/);assert.equal(f.requests[0].options.cache,'no-store');assert.equal(f.elements['#dispatch-submit'].disabled,false);
});
test('permission denial never renders restricted data',async()=>{
 const f=fixture();f.deny();await f.load();assert.equal(f.elements['#packing-information'].hidden,true);assert.equal(f.elements['#packing-address'].textContent,'');assert.equal(f.elements['#dispatch-submit'].disabled,true);
});
test('switching order clears address, handover and staged details immediately',async()=>{
 const f=fixture();await f.load();f.confirm();await f.submit();f.clear();assert.equal(f.elements['#packing-address'].textContent,'');assert.equal(f.elements['#dispatch-review'].textContent,'');assert.equal(f.elements['#dispatch-handover'].checked,false);assert.equal(f.elements['#dispatch-submit'].disabled,true);
});
test('invalid form cannot stage or submit dispatch',async()=>{
 const f=fixture();await f.load();f.elements['#manual-dispatch'].valid=false;await f.submit();assert.equal(f.posts(),0);assert.equal(f.elements['#dispatch-review'].textContent,'');
});
test('review step performs no mutation; confirmation sends explicit handover and stable payload',async()=>{
 const f=fixture();await f.load();f.confirm();await f.submit();assert.equal(f.posts(),0);assert.equal(f.elements['#dispatch-fields'].disabled,true);assert.match(f.elements['#dispatch-review'].textContent,/Physical handover confirmed/);
 await f.submit();assert.equal(f.posts(),1);const request=f.requests.find(r=>r.options.method==='POST');assert.equal(JSON.parse(request.options.body).handoverConfirmed,true);assert.equal(request.options.headers['Idempotency-Key'],'stable-key');assert.equal(f.events.length,1);assert.equal(f.elements['#dispatch-submit'].disabled,true);
});
test('disabled runtime and ineligible fulfilment disable dispatch',async()=>{
 for(const state of [{eligible:false},{dispatchEnabled:false}]){const f=fixture();f.state(state);await f.load();await f.submit();assert.equal(f.posts(),0);assert.equal(f.elements['#dispatch-submit'].disabled,true);}
});
test('uncertain network outcome preserves exact command across reload and retry',async()=>{
 const f=fixture();await f.load();f.confirm();await f.submit();f.fail();await f.submit();f.values.carrier='Changed';await f.submit();const posts=f.requests.filter(r=>r.options.method==='POST');assert.equal(posts.length,2);assert.deepEqual(posts[0].options,posts[1].options);assert.match(f.elements['#dispatch-review'].textContent,/Previous dispatch outcome/);
});
test('busy form rejects a concurrent click',async()=>{
 const f=fixture();await f.load();f.confirm();await f.submit();let release;f.defer(new Promise(resolve=>{release=resolve;}));const first=f.submit();await f.submit();assert.equal(f.posts(),1);release();await first;
});
test('confirmed validation refusal permits correction without a retained pending command',async()=>{
 const f=fixture();await f.load();f.confirm();await f.submit();f.postStatus(400);await f.submit();assert.equal(f.elements['#dispatch-fields'].disabled,false);assert.match(f.elements['#dispatch-message'].textContent,/Dispatch refused/);
});


test('operations shows requested, authorised and historical location IDs without HTML interpretation',async()=>{
 const f=fixture(),point={name:'Synthetic point',address:'Test address',postalCode:'SW1A 1AA',locationId:'REQUESTED-ID'};
 f.state({collectionReviewEnabled:true,collection:{requested:point,current:{...point,locationId:'CURRENT-ID'},status:'matched',version:1,email:'synthetic@example.invalid',phone:'+447700900123',parcelSize:'Medium',contents:'Test fixture',currency:'GBP',declaredValueMinor:100,history:[{version:1,status:'matched',point:{...point,locationId:'HISTORY-ID'}}]}});
 await f.load();assert.equal(f.elements['#collection-booking'].hidden,false);assert.match(f.elements['#collection-booking-details'].textContent,/InPost location ID: REQUESTED-ID/);assert.match(f.elements['#collection-booking-details'].textContent,/InPost location ID: CURRENT-ID/);assert.match(f.elements['#collection-review-history'].children[0].textContent,/HISTORY-ID/);
 f.elements['#collection-review-action'].value='approve-alternative';f.elements['#collection-review-action'].dispatchEvent({type:'change'});
 for(const input of f.elements['#collection-alternative'].inputs){assert.equal(input.required,input.name!=='locationId');assert.equal(input.disabled,false);}
 f.clear();assert.equal(f.elements['#collection-booking-details'].textContent,'');assert.equal(f.elements['#collection-review-history'].children.length,0);
});
