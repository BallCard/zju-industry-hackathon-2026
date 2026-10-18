'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {generateTask}=require('../src/agent');
const {localEvidence}=require('../src/catalog');
const base={product:'HUAWEI MateBook 14（鸿蒙版）',audience:'大学新生',
  stage:'比较阶段',scene:'开学季',platform:'小红书',
  objective:'给到店看机提供信息',instructions:'侧重轻薄与续航'};
const HAS_LOCAL_EVIDENCE=Boolean(localEvidence(base.product).facts);
test('explicit local choice remains local even when ima credentials exist',{skip:!HAS_LOCAL_EVIDENCE?'requires authorized local KB':false},async()=>{
  const oldClient=process.env.IMA_OPENAPI_CLIENTID,oldKey=process.env.IMA_OPENAPI_APIKEY;
  try{
    process.env.IMA_OPENAPI_CLIENTID='fake';
    process.env.IMA_OPENAPI_APIKEY='test';
    const r=await generateTask({...base,mode:'local',drafting:'rules'});
    assert.equal(r.ok,true,r.error);
    assert.equal(r.mode,'local');
    assert.match(r.kbName,/本地演示/);
    assert.ok(r.facts.every(f=>f.sourceType==='local'));
    assert.ok(r.images.every(i=>i.origin==='local'));
    assert.ok(r.trace.some(step=>step.step==='知识库检索'));
  }finally{
    if(oldClient===undefined)delete process.env.IMA_OPENAPI_CLIENTID;else process.env.IMA_OPENAPI_CLIENTID=oldClient;
    if(oldKey===undefined)delete process.env.IMA_OPENAPI_APIKEY;else process.env.IMA_OPENAPI_APIKEY=oldKey;
  }
});
test('missing data mode defaults to local, never pretends ima',{skip:!HAS_LOCAL_EVIDENCE?'requires authorized local KB':false},async()=>{
  const r=await generateTask({...base,mode:undefined,drafting:'rules'});
  assert.equal(r.ok,true,r.error);
  assert.equal(r.task.mode,'local');
  assert.equal(r.mode,'local');
});
test('invalid data mode explicitly rejected',async()=>{
  const r=await generateTask({...base,mode:'auto',drafting:'rules'});
  assert.equal(r.ok,false);
  assert.match(r.error,/未知数据源/);
});
test('local edit instruction changes fact priorities while keeping source',{skip:!HAS_LOCAL_EVIDENCE?'requires authorized local KB':false},async()=>{
  const a=await generateTask({...base,scene:'职场办公',audience:'差旅办公者',instructions:'侧重接口',mode:'local',drafting:'rules'});
  const b=await generateTask({...base,scene:'职场办公',audience:'差旅办公者',instructions:'删掉接口，侧重轻薄',mode:'local',drafting:'rules'});
  assert.ok(a.ok&&b.ok);
  assert.equal(a.facts[0].topic,'接口');
  assert.ok(!b.facts.some(f=>f.topic==='接口'));
  assert.ok(b.images.every(x=>x.origin==='local'));
});
