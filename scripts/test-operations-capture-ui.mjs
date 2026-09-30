import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const source=await readFile(new URL('../src/pages/private-operations/[slug].astro',import.meta.url),'utf8');
const script=ts.transpile(source.match(/<script>([\s\S]*?)<\/script>/)[1],{target:ts.ScriptTarget.ES2022});
function fixture(){
  class Element {
    hidden=false;disabled=false;textContent='';dataset={};listeners={};button;
    constructor(form=false){if(form)this.button=new Element();}
    getAttribute(){return 'https://ops.test';}setAttribute(){}removeAttribute(){}focus(){}append(){}
    querySelector(selector){return selector==='button'?this.button:undefined;}
    addEventListener(name,fn){this.listeners[name]=fn;}
  }
  const elements=Object.fromEntries(['.ops','#message','#search','#results','#details','#summary','#timeline','#capture','#reconcile-capture','#refund','#export'].map(id=>[id,new Element(['#capture','#reconcile-capture'].includes(id))]));
  let command,status='pending_payment',payment='authorised',failGet=false,postResult={status:'completed',outcome:'capture_reconciled',message:'Capture reconciled — provider capture already existed.'};
  let failPost=false;const requests=[];
  const context=vm.createContext({HTMLElement:Element,HTMLButtonElement:Element,document:{querySelector:id=>elements[id]},crypto:{randomUUID:()=> 'original-ui-key'},fetch:async(url,options)=>{
    requests.push({url,options});
    if(options.method==='POST'){if(failPost)throw new Error('network timeout');return {ok:true,json:async()=>postResult};}
    if(failGet)throw new Error('load failed');
    return {ok:true,json:async()=>({order:{orderNumber:'TEST',status,currency:'GBP',totalMinor:1000},payments:[{status:payment}],captureCommand:command,timeline:[]})};
  }});
  vm.runInContext(script,context);
  return {elements,requests,load:()=>vm.runInContext("load('o1')",context),submit:(id)=>elements[id].listeners.submit({preventDefault(){},currentTarget:elements[id]}),
    command:value=>{command=value;},paid:()=>{status='paid';payment='captured';},failGet:()=>{failGet=true;},failPost:()=>{failPost=true;},result:value=>{postResult=value;}};
}
test('existing unresolved commands show Reconcile and hide ordinary Capture',async()=>{
  for(const status of ['reserved','resolution_required','failed']){const f=fixture();f.command({status});await f.load();assert.equal(f.elements['#capture'].hidden,true);assert.equal(f.elements['#reconcile-capture'].hidden,false);await f.submit('#reconcile-capture');const post=f.requests.find(r=>r.options.method==='POST');assert.equal(post.url,'https://ops.test/operations/orders/o1/capture/reconcile');assert.deepEqual(Object.keys(post.options.headers),[]);assert.match(f.elements['#message'].textContent,/provider capture already existed/);}
});
test('successful command hides capture controls; uncaptured order offers ordinary capture',async()=>{
  const f=fixture();await f.load();assert.equal(f.elements['#capture'].button.disabled,false);assert.equal(f.elements['#reconcile-capture'].hidden,true);
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
