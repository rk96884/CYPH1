import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../src/pages/private-operations/[slug].astro',import.meta.url),'utf8');
const html=process.env.OPERATIONS_UI_HTML?await readFile(process.env.OPERATIONS_UI_HTML,'utf8'):source;
const match=html.match(/<script\s+([^>]*data-return-decisions[^>]*)>([\s\S]*?)<\/script>/);
assert.ok(match);assert.doesNotMatch(match[1],/\bsrc=/);new vm.Script(match[2]);
function fixture(){
  class Element{
    children=[];listeners={};dataset={};attributes={};value='';hidden=false;disabled=false;_text='';
    constructor(tag='div'){this.tag=tag;}
    get textContent(){return this._text;}set textContent(value){this._text=value;this.children=[];}
    append(...elements){this.children.push(...elements);}
    getAttribute(key){return key==='data-api'?'https://ops.test':this.attributes[key];}
    setAttribute(key,value){this.attributes[key]=value;}removeAttribute(key){delete this.attributes[key];}
    querySelector(selector){return this.querySelectorAll(selector)[0];}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.tag===selector?[child]:[]),...child.querySelectorAll(selector)]);}
    addEventListener(name,fn){this.listeners[name]=fn;}dispatchEvent(event){return this.listeners[event.type]?.(event);}
    reportValidity(){return true;}focus(){this.focused=true;}
  }
  const ids=['#returns','.ops','#return-choice','#return-summary','#return-items','#return-quantities','#return-approve','#return-reject','#return-amount','#return-receipt','#return-reason','#return-error','#returns-message','#returns-refresh','label[for="return-amount"]'];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
  for(const id of ['#return-approve','#return-reject'])elements[id].append(new Element('button'));
  let records=[{id:'r1',reference:'RET-ABC123',orderId:'o1',status:'requested',version:1,category:'customer_choice',currency:'GBP',approvedRefundMinor:null,items:[{orderItemId:'i1',requestedQuantity:2,approvedQuantity:null,receivedQuantity:0}]}];
  const requests=[];let failure;let postStatus=200;let uuid=0;let gate;let readGate;
  const context=vm.createContext({document:{querySelector:id=>elements[id],createElement:tag=>new Element(tag)},CustomEvent:class{constructor(type){this.type=type;}},crypto:{randomUUID:()=>`key-${++uuid}`},fetch:async(url,options)=>{
    requests.push({url,options});
    if(options.method==='POST'){
      if(gate)await gate;
      if(failure)throw new Error('uncertain');
      if(postStatus>=400)return {ok:false,status:postStatus};
      const body=JSON.parse(options.body);const action=url.split('/').at(-1);
      records=records.map(record=>({...record,status:action==='approve'?'approved':'rejected',version:2,approvedRefundMinor:action==='approve'?body.approvedRefundMinor:null}));
      return {ok:true,status:200};
    }
    const snapshot=structuredClone(records);if(readGate){const waiting=readGate;readGate=undefined;await waiting;}
    return {ok:true,status:200,json:async()=>({returns:snapshot})};
  }});
  vm.runInContext(match[2],context);
  return {elements,requests,load:async()=>{elements['#returns'].dispatchEvent({type:'operations-order-loaded',detail:{id:'o1',data:{items:[{id:'i1',name_snapshot:'<untrusted item>'}]}}});await vm.runInContext('refresh()',context);},refresh:()=>vm.runInContext('refresh()',context),submit:action=>elements[`#return-${action}`].listeners.submit({preventDefault(){}}),fail:value=>failure=value,status:value=>postStatus=value,gate:value=>gate=value,gateRead:value=>readGate=value,records:value=>records=value};
}
test('returns show controlled identifiers, quantities and currency without HTML injection',async()=>{
  const f=fixture();await f.load();assert.match(f.elements['#return-summary'].textContent,/RET-ABC123.*customer_choice.*requested.*version 1.*GBP/);
  assert.match(f.elements['#return-items'].children[0].textContent,/<untrusted item>.*requested 2/);
  assert.equal(f.elements['#return-approve'].hidden,false);assert.equal(f.elements['#return-amount'].value,'');
});
test('approval sends explicit minor units, version and quantities; uses credentialed protected route only',async()=>{
  const f=fixture();await f.load();f.elements['#return-amount'].value='50';await f.submit('approve');
  const posts=f.requests.filter(request=>request.options.method==='POST');assert.equal(posts.length,1);
  assert.equal(posts[0].url,'https://ops.test/operations/orders/o1/returns/r1/approve');assert.equal(posts[0].options.credentials,'include');
  assert.deepEqual(JSON.parse(posts[0].options.body),{expectedVersion:1,approvedRefundMinor:50,receiptRequired:true,items:[{orderItemId:'i1',quantity:2}]});
  assert.equal(f.elements['#return-approve'].hidden,true);assert.match(f.elements['#returns-message'].textContent,/No refund was issued/);
  assert.ok(f.requests.every(request=>request.url.includes('/returns')));
});
test('zero decision and explicit receipt waiver remain controlled',async()=>{
  const f=fixture();await f.load();f.elements['#return-amount'].value='0';f.elements['#return-receipt'].value='operator_waiver';await f.submit('approve');
  const body=JSON.parse(f.requests.find(request=>request.options.method==='POST').options.body);
  assert.equal(body.approvedRefundMinor,0);assert.equal(body.receiptRequired,false);assert.equal(body.receiptWaiverReason,'operator_waiver');
});
test('rejection sends only controlled reason and version',async()=>{
  const f=fixture();await f.load();await f.submit('reject');
  assert.deepEqual(JSON.parse(f.requests.find(request=>request.options.method==='POST').options.body),{expectedVersion:1,reason:'not_approved'});
  assert.equal(f.elements['#return-reject'].hidden,true);
});
test('invalid money, quantity and reason cannot submit decisions',async()=>{
  for(const value of ['', '-1', '0.50', '9007199254740992']){const f=fixture();await f.load();f.elements['#return-amount'].value=value;await f.submit('approve');assert.equal(f.requests.filter(request=>request.options.method==='POST').length,0);}
  for(const quantity of ['0','3','0.5']){const f=fixture();await f.load();f.elements['#return-amount'].value='0';f.elements['#return-quantities'].querySelector('input').value=quantity;await f.submit('approve');assert.equal(f.requests.filter(request=>request.options.method==='POST').length,0);}
  const f=fixture();await f.load();f.elements['#return-reason'].value='narrative';await f.submit('reject');assert.equal(f.requests.filter(request=>request.options.method==='POST').length,0);
});
test('uncertain outcome locks edits and replays original command key and body',async()=>{
  const f=fixture();await f.load();f.fail(true);await f.submit('reject');
  assert.equal(f.elements['#return-reason'].disabled,true);assert.equal(f.elements['#return-approve'].querySelector('button').disabled,true);
  f.fail(false);await f.submit('reject');const posts=f.requests.filter(request=>request.options.method==='POST');
  assert.equal(posts.length,2);assert.equal(posts[0].options.headers['Idempotency-Key'],posts[1].options.headers['Idempotency-Key']);assert.equal(posts[0].options.body,posts[1].options.body);
});
test('permission and stale conflicts are useful and refresh authoritative state',async()=>{
  for(const status of [403,409]){const f=fixture();await f.load();f.status(status);await f.submit('reject');assert.match(f.elements['#return-error'].textContent,status===403?/permission/:/changed.*Reload/);assert.equal(f.requests.at(-1).options.method,undefined);}
});
test('duplicate submissions while busy cannot send a second decision',async()=>{
  const f=fixture();await f.load();let release;f.gate(new Promise(resolve=>release=resolve));const pending=f.submit('reject');await f.submit('reject');assert.equal(f.requests.filter(request=>request.options.method==='POST').length,1);release();await pending;
});
test('a pending decision cannot publish its result into a newly loaded order',async()=>{
  const f=fixture();await f.load();let release;f.gate(new Promise(resolve=>release=resolve));const pending=f.submit('reject');
  f.elements['#returns'].dispatchEvent({type:'operations-order-loading'});
  f.elements['#returns'].dispatchEvent({type:'operations-order-loaded',detail:{id:'o2',data:{items:[]}}});
  release();await pending;assert.equal(f.elements['#returns-message'].textContent,'');
  assert.equal(f.elements['#returns-refresh'].disabled,false);assert.ok(f.requests.at(-1).url.includes('/orders/o2/returns'));
});
test('terminal and approved returns expose no decision forms',async()=>{
  for(const status of ['approved','received','closed','cancelled','rejected']){const f=fixture();f.records([{id:'r1',reference:'RET-ABC',status,version:2,category:'other',currency:'GBP',approvedRefundMinor:0,items:[]}]);await f.load();assert.equal(f.elements['#return-approve'].hidden,true);await f.submit('reject');assert.equal(f.requests.filter(request=>request.options.method==='POST').length,0);}
});
test('loading another order locks decisions and ignores delayed old reads',async()=>{
  const f=fixture();await f.load();f.elements['#returns'].dispatchEvent({type:'operations-order-loading'});await f.submit('reject');assert.equal(f.requests.filter(request=>request.options.method==='POST').length,0);
  await f.load();let release;f.gateRead(new Promise(resolve=>release=resolve));const old=f.refresh();
  f.records([{id:'r1',reference:'RET-ABC',status:'approved',version:2,category:'other',currency:'GBP',approvedRefundMinor:0,items:[]}]);
  await f.refresh();release();await old;assert.equal(f.elements['#return-approve'].hidden,true);
});

const rehearsal=await readFile(new URL('../docs/operations/returns-phase-2-staging-console.js',import.meta.url),'utf8');
function rehearsalFixture({api='https://operations-staging.cyph1.co.uk',permission=true}={}){
  const orderId='4ffb876a-8a9a-4003-a2a8-f98b3963787c';const itemId='dcffdd62-7385-4128-b249-4b52a8879fa7';
  const records=[];const timeline=[];const commands=new Map();const storage=new Map();const requests=[];let counter=0;
  const details={order:{id:orderId,orderNumber:'CYPH-T-4FFB876A8A9A',currency:'GBP',status:'paid',fulfilmentStatus:'unfulfilled'},items:[{id:itemId,name_snapshot:'INTEGRATION TEST FIXTURE — NOT FOR SALE',quantity:1}],payments:[{status:'captured'}],refunds:[],fulfilments:[],timeline};
  const context=vm.createContext({document:{querySelector:()=>({getAttribute:()=>api})},sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},crypto:{randomUUID:()=>`key-${++counter}`},confirm:()=>true,console:{table(){},log(){},error(){}},fetch:async(url,options)=>{
    requests.push({url,options});let status=200;let data;
    if(!options.method)data=url.endsWith('/returns')?{returns:records}:details;
    else{
      const body=JSON.parse(options.body);const key=options.headers['Idempotency-Key'];
      if(!permission){status=403;data={message:'Permission denied.'};}
      else if(!Object.keys(body).length){status=400;data={code:'invalid_request'};}
      else if(commands.has(key)){({status,data}=commands.get(key));}
      else if(url.endsWith('/returns')){
        data={id:`r${counter}`,reference:`RET-${counter.toString(16).toUpperCase().padStart(16,'0')}`,version:1,status:'requested',approvedRefundMinor:null,currency:'GBP',receivedAt:null,closedAt:null};records.push(data);status=201;timeline.push({action:'return.requested',summary:{orderId}});commands.set(key,{status,data:structuredClone(data)});
      }else{
        const action=url.split('/').at(-1);const id=url.split('/').at(-2);const record=records.find(row=>row.id===id);
        if(record.version!==body.expectedVersion){status=409;data={code:'conflict',message:'The return changed. Reload it before acting.'};}
        else{record.status=action==='approve'?'approved':'rejected';record.version=2;record.approvedRefundMinor=action==='approve'?body.approvedRefundMinor:null;data=record;timeline.push({action:action==='approve'?'return.approved':'return.rejected',summary:{orderId}});commands.set(key,{status,data:structuredClone(data)});}
      }
    }
    const snapshot=structuredClone(data);return {status,headers:{get:()=> 'application/json'},json:async()=>snapshot};
  }});
  return {run:()=>vm.runInContext(rehearsal,context),requests,records,storage};
}
test('staging console script uses synthetic guards, replay and stale checks with no money endpoint',async()=>{
  const f=rehearsalFixture();await f.run();assert.deepEqual(f.records.map(record=>record.status),['rejected','approved']);assert.equal(f.records[1].approvedRefundMinor,0);
  assert.equal(JSON.parse([...f.storage.values()][0]).result,'PASS');assert.ok(f.requests.every(request=>request.options.credentials==='include'));
  assert.ok(f.requests.every(request=>!request.url.includes('/refunds')&&!request.url.includes('/capture')&&!request.url.includes('/close')&&!request.url.includes('/receive')));
  await assert.rejects(f.run(),/active return/);
});
test('staging console rejects wrong origin or missing grants before lifecycle writes',async()=>{
  const wrong=rehearsalFixture({api:'https://production.example'});await assert.rejects(wrong.run(),/Unexpected API/);assert.equal(wrong.requests.length,0);
  const denied=rehearsalFixture({permission:false});await assert.rejects(denied.run(),/Permission\/validation/);assert.equal(denied.records.length,0);
});
