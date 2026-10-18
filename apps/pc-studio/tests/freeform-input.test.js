'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const catalog=require('../backend/src/catalog');
const ima=require('../backend/src/ima');
const llm=require('../backend/src/llm');
const {generateTask}=require('../backend/src/agent');
const {recommendModels}=require('../backend/src/brief');
const manifest=require('../data/models.json');
const product=manifest[0].name;
function noLLM(t){t.mock.method(llm,'configured',()=>false);}
function assertCandidates(result){
  const names=new Set(catalog.safeCatalog().map(model=>model.name));
  assert.equal(result.status,'need_info');assert.equal(result.needsInput,true);assert.equal(result.ok,false);
  assert.ok(result.questions.length);assert.ok(result.candidates.length);
  for(const candidate of result.candidates){
    assert.ok(names.has(candidate.name));assert.ok(manifest.some(model=>model.name===candidate.name));
    assert.equal(typeof candidate.reason,'string');assert.ok(candidate.highlights.length);
    const facts=catalog.resolveModel(candidate.name).facts;
    for(const source of candidate.sources){
      const fact=facts.find(fact=>fact.topic===source.topic&&fact.sourcePath===source.sourcePath);
      assert.ok(fact);assert.ok(candidate.highlights.includes('【'+fact.topic+'】'+fact.quote));
    }
  }
  assert.equal(result.copy,undefined);assert.equal(result.facts,undefined);assert.equal(result.images,undefined);
  assert.equal(result.task.product,'');
}
test('request and brief accept natural language without a model and require confirmation',async t=>{
  noLLM(t);
  t.mock.method(ima,'imaEvidence',()=>{throw Error('must not retrieve ima before confirmation');});
  t.mock.method(catalog,'localEvidence',()=>{throw Error('must not start draft evidence retrieval');});
  for(const field of ['request','brief']){
    const result=await generateTask({[field]:'给大学新生推荐便携电脑，开学季发小红书，希望收藏分享',product:'',mode:'live'});
    assertCandidates(result);assert.equal(result.sourceMode,'live');assert.equal(result.task.mode,'live');
    assert.equal(result.task.audience,'大学新生');assert.equal(result.task.scene,'开学季');
    assert.equal(result.task.platform,'小红书');assert.equal(result.task.objective,'鼓励收藏分享');
    assert.match(result.recommendationEngine,/规则推荐/);
  }
});
test('no-model requests with missing context still return legal candidates and follow-up questions',async t=>{
  noLLM(t);
  const result=await generateTask({brief:'请推荐一款电脑，要求卫星通信和免费赠送，价格只要1元'});
  assertCandidates(result);
  assert.ok(result.questions.some(question=>question.includes('人群')));
  assert.ok(result.questions.some(question=>question.includes('发布位置')));
  assert.doesNotMatch(JSON.stringify(result.candidates),/卫星通信|免费赠送|只要1元/);
  const invalid=await generateTask({request:'推荐电脑',mode:'auto'});assert.equal(invalid.status,'blocked');
});
test('deterministic ranking uses exact local facts, not invented budget or compatibility claims',async t=>{
  noLLM(t);
  const input={brief:'为差旅办公人群推荐轻薄便携电脑，发朋友圈',mode:'local'};
  const first=await generateTask(input),second=await generateTask(input);
  assertCandidates(first);assert.deepEqual(first.candidates,second.candidates);
  assert.ok(first.candidates.every(candidate=>/不代表已确认|需获取/.test(candidate.reason)));
  const task={audience:'办公人群',scene:'职场办公',instructions:''};
  const ranked=recommendModels(task,'Windows 大屏办公');
  if(catalog.resolveModel('HUAWEI MateBook D 16 2024')?.facts.length){
    assert.ok(ranked[0].highlights.some(highlight=>/Windows/.test(highlight)));
  }
});
test('configured LLM extracts brief first and invented or non-exact model names never survive',async t=>{
  t.mock.method(llm,'configured',()=>true);
  let calls=0;
  t.mock.method(llm,'extractBrief',async(brief,models)=>{
    calls++;assert.match(brief,/推荐/);assert.ok(models.some(model=>model.name===product));
    return {data:{audience:'内容创作者',scene:'内容创作',platform:'公众号',objective:'辅助比较',
      candidates:['HUAWEI MateBook Invented 99','MateBook 14',product,{name:product},product]}};
  });
  t.mock.method(llm,'generateScaffold',()=>{throw Error('must not draft');});
  t.mock.method(ima,'imaEvidence',()=>{throw Error('must not retrieve');});
  const result=await generateTask({brief:'推荐一台电脑，准备做视频',mode:'live'});
  assertCandidates(result);assert.equal(calls,1);assert.match(result.recommendationEngine,/模型需求解析/);
  assert.equal(result.candidates[0].name,product);assert.equal(new Set(result.candidates.map(candidate=>candidate.name)).size,result.candidates.length);
  assert.equal(result.task.audience,'内容创作者');assert.equal(result.task.scene,'内容创作');assert.equal(result.task.platform,'公众号');
  assert.doesNotMatch(JSON.stringify(result),/Invented/);
});
test('LLM parser uses existing JSON transport and only sends catalog choices',async t=>{
  // Only synthetic configuration; never load a credential file or call a remote service.
  const saved={};
  for(const [key,value] of Object.entries({LLM_API_KEY:'test',LLM_MODEL:'test-model',LLM_BASE_URL:'https://model.example.invalid/v1'})){
    saved[key]=process.env[key];process.env[key]=value;
  }
  t.after(()=>{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  let payload;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'https://model.example.invalid/v1/chat/completions');payload=JSON.parse(options.body);
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({audience:'办公人群',scene:'职场办公',platform:'小红书',objective:'引导咨询',candidates:[product]})}}]})};
  });
  const result=await generateTask({request:'办公人群选机推荐'});
  assertCandidates(result);assert.equal(payload.temperature,0);
  assert.deepEqual(JSON.parse(payload.messages[1].content).catalog,catalog.safeCatalog().map(model=>model.name));
  assert.equal(result.task.platform,'小红书');
});
test('LLM failures fall back deterministically and explicit fields override extraction',async t=>{
  t.mock.method(llm,'configured',()=>true);
  let failed=true;
  t.mock.method(llm,'extractBrief',async()=>{
    if(failed)throw Error('unavailable');
    return {data:{audience:'这台电脑支持卫星通信，适合学生',scene:'不合法场景',platform:'不合法平台',objective:'保证续航24小时',candidates:['虚构型号']}};
  });
  const input={request:'大学新生开学季选机推荐',audience:'办公人群',scene:'职场办公',platform:'poster'};
  const fallback=await generateTask(input);assertCandidates(fallback);assert.ok(fallback.recommendationNotice);
  failed=false;
  const result=await generateTask(input);assertCandidates(result);
  assert.equal(result.task.audience,'办公人群');assert.equal(result.task.scene,'职场办公');assert.equal(result.task.platform,'门店海报');
  assert.doesNotMatch(JSON.stringify(result.candidates),/卫星|24小时|虚构/);
});
test('unknown model plus brief recommends without retrieval; legacy ambiguity stays unchanged',async t=>{
  noLLM(t);let reads=0;
  t.mock.method(catalog,'localEvidence',()=>{reads++;throw Error('must not read');});
  const result=await generateTask({product:'虚构型号',brief:'大学新生开学选机，小红书'});
  assertCandidates(result);assert.equal(reads,0);
  const ambiguous=await generateTask({product:'MateBook 14',audience:'学生',platform:'小红书'});
  assert.equal(ambiguous.status,'need_info');assert.ok(ambiguous.candidates.every(candidate=>typeof candidate==='string'));
});
test('explicit complete model retains generation and audit without brief parsing',async t=>{
  const evidence=catalog.localEvidence(product);
  assert.ok(evidence.facts?.length,'bundled local KB facts must be available');
  t.mock.method(llm,'configured',()=>true);
  t.mock.method(llm,'extractBrief',()=>{throw Error('explicit model must not be parsed');});
  const result=await generateTask({product,audience:'大学新生',platform:'小红书',scene:'开学季',drafting:'rules',mode:'local',request:'无需推荐型号'});
  assert.equal(result.status,'ok',result.error);assert.equal(result.task.product,product);assert.equal(result.mode,'local');
  assert.equal(result.audit.status,'passed');assert.ok(result.facts.every(fact=>fact.model===product));
  assert.ok(result.images.every(image=>image.model===product));assert.equal(result.candidates.length,0);
});
