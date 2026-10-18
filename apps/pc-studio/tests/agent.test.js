'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {safeCatalog,localEvidence}=require('../backend/src/catalog');
const {generateTask,preflight,detectRisks}=require('../backend/src/agent');
const base={mode:'local',product:'HUAWEI MateBook 14（鸿蒙版）',audience:'大一新生',
  stage:'了解阶段',scene:'开学季',platform:'小红书',objective:'了解购机需求',instructions:''};
const HAS_LOCAL_EVIDENCE=Boolean(localEvidence(base.product).facts);
test('local index must supply 10 models (when development library is present)',()=>{
  if(safeCatalog().length===0)return;
  assert.ok(safeCatalog().length>=10);
});
test('exact model retrieval does not inherit another configuration',{skip:!HAS_LOCAL_EVIDENCE?'requires authorized local KB':false},()=>{
  if(safeCatalog().length===0)return;
  const e=localEvidence(base.product);
  assert.equal(e.model,base.product);
  assert.ok(e.facts.length>4);
  assert.ok(e.pictures.every(x=>x.model===base.product));
  assert.ok(localEvidence('MateBook 14').error);
});
test('missing task fields require explicit follow-up',()=>{
  assert.ok(preflight({...base,product:'',platform:''}).length>=2);
});
test('compliance preflight catches harmful marketing instructions',()=>{
  const r=detectRisks('全国第一，立减2999元，吊打竞品，终身保修');
  assert.ok(r.length>=3);
});
test('local generation has citeable facts, same-model images and audit trail',{skip:!HAS_LOCAL_EVIDENCE?'requires authorized local KB':false},async()=>{
  if(safeCatalog().length===0)return;
  const r=await generateTask(base);
  assert.equal(r.ok,true,JSON.stringify(r.error||r.audit));
  assert.equal(r.audit.status,'passed');
  assert.ok(r.facts.length>=3);
  assert.ok(r.images.every(i=>i.model===base.product&&i.origin==='local'));
  assert.ok(r.trace.length>=5);
});
test('same product, different scenes reorder evidence',{skip:!HAS_LOCAL_EVIDENCE?'requires authorized local KB':false},async()=>{
  if(safeCatalog().length===0)return;
  const a=await generateTask(base);
  const b=await generateTask({...base,scene:'内容创作',audience:'设计师'});
  assert.ok(a.ok&&b.ok);
  assert.notEqual(a.copy.title,b.copy.title);
  assert.notEqual(a.facts[0].topic,b.facts[0].topic);
});
test('same task, different platform changes form, images, CTA',{skip:!HAS_LOCAL_EVIDENCE?'requires authorized local KB':false},async()=>{
  if(safeCatalog().length===0)return;
  const a=await generateTask(base);
  const b=await generateTask({...base,platform:'门店海报'});
  assert.ok(a.ok&&b.ok);
  assert.notEqual(a.copy.body,b.copy.body);
  assert.notEqual(a.images.length,b.images.length);
  assert.notEqual(a.copy.cta,b.copy.cta);
});
test('unsafe price and superlative requests are withheld, not repeated in copy',{skip:!HAS_LOCAL_EVIDENCE?'requires authorized local KB':false},async()=>{
  if(safeCatalog().length===0)return;
  const r=await generateTask({...base,instructions:'全国第一 立减2999元 吊打竞品'});
  assert.equal(r.ok,true);
  assert.ok(r.audit.compliance.inputRisks.length>=2);
  assert.doesNotMatch(r.copy.fullText,/2999|吊打|全国第一/);
});
test('live route never silently falls back to local demo without credentials',async()=>{
  if(process.env.IMA_OPENAPI_CLIENTID&&process.env.IMA_OPENAPI_APIKEY)return;
  const r=await generateTask({...base,mode:'live'});
  assert.equal(r.ok,false);
  assert.match(r.error,/凭证/);
});
