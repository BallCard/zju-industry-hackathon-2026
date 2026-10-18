'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const llm=require('../backend/src/llm');
const catalog=require('../backend/src/catalog');
const {generateTask}=require('../backend/src/agent');
const request='请给大学新生推荐适合图书馆学习和日常携带的华为电脑，发公众号，邀请到店体验';

test('brief-only recommendation can be confirmed without manually filling any structured field',async t=>{
  t.mock.method(llm,'configured',()=>false);
  const recommendation=await generateTask({request,mode:'local'});
  assert.equal(recommendation.status,'need_info');
  assert.equal(recommendation.parsedTask.product,'');
  assert.equal(recommendation.parsedTask.scene,'开学季');
  assert.equal(recommendation.parsedTask.platform,'公众号');
  assert.equal(recommendation.inputUnderstanding.method,'local');
  assert.match(recommendation.inputUnderstanding.notice,/未配置大模型/);
  const product=recommendation.candidates[0].name;
  const result=await generateTask({request,product,mode:'local',drafting:'rules'});
  assert.ok(['ok','incomplete'].includes(result.status),JSON.stringify(result.questions||result.error));
  assert.equal(result.task.product,product);
  assert.equal(result.task.scene,'开学季');
  assert.equal(result.task.platform,'公众号');
  assert.equal(result.task.request,request);
  assert.ok(result.facts.every(fact=>fact.model===product&&fact.sourceType==='local'));
  assert.ok(result.images.every(image=>image.model===product&&image.origin==='local'));
  const revision=await generateTask({...result.task,instructions:'短一点',drafting:'rules',
    previousResult:{task:result.task,copy:{blocks:result.copy.blocks}}});
  assert.ok(['ok','incomplete'].includes(revision.status));
  assert.equal(revision.task.product,product);
  assert.equal(revision.task.writingPreferences.length,'short');
  assert.ok(revision.copy.fullText.length<result.copy.fullText.length);
});

test('unrecognized reader descriptions remain preferences, never unverified product facts',async t=>{
  t.mock.method(llm,'configured',()=>false);
  const product=catalog.safeCatalog()[0].name;
  const result=await generateTask({request:'为自由职业译者准备办公电脑介绍，发海报',product,
    audience:'自由职业译者',platform:'门店海报',drafting:'rules',mode:'local'});
  assert.ok(['ok','incomplete'].includes(result.status),JSON.stringify(result.questions));
  assert.match(result.copy.fullText,/目标读者/);
  assert.doesNotMatch(result.copy.fullText,/自由职业译者支持|卫星通信/);
});

test('known model plus free-form requirements still receives configured model intent parsing when fields are missing',async t=>{
  t.mock.method(llm,'configured',()=>true);
  let calls=0;
  t.mock.method(llm,'extractBrief',async()=>{calls++;return {data:{audience:'内容创作者',scene:'内容创作',
    platform:'门店海报',stage:'比较阶段',objective:'辅助比较',candidates:[]}};});
  const product=catalog.safeCatalog()[0].name;
  const result=await generateTask({request:'请按视频剪辑需求介绍这台电脑',product,mode:'local',drafting:'rules'});
  assert.equal(calls,1);
  assert.ok(['ok','incomplete'].includes(result.status));
  assert.equal(result.inputUnderstanding.method,'llm');
  assert.equal(result.task.stage,'比较阶段');
  assert.equal(result.task.platform,'门店海报');
});

test('prototype property names in structured enumerations do not bypass input validation',async()=>{
  const product=catalog.safeCatalog()[0].name;
  const result=await generateTask({product,audience:'大学新生',scene:'toString',platform:'constructor',drafting:'rules'});
  assert.equal(result.status,'need_info');
  assert.equal(result.copy,undefined);
});
