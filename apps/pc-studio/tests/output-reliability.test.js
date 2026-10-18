'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const catalog=require('../backend/src/catalog');
const ima=require('../backend/src/ima');
const {generateTask,normalizeTask,plan,compose,audit,scaffoldOptions}=require('../backend/src/agent');
const model='HUAWEI MateBook 14（鸿蒙版）';
const base={product:model,audience:'大学新生',scene:'开学季',stage:'了解阶段',platform:'小红书',objective:'引导到店体验',mode:'local',drafting:'rules'};
function fixture(t,count=4){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pcstudio-output-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const imagePath=path.join(dir,'sample.png');fs.writeFileSync(imagePath,Buffer.from('fixture-image'));
  const facts=[['机身重量','约 1.33 kg（圆键盘含电池）；约 1.32 kg（方键盘含电池）。实际重量因配置而异。'],
    ['电池容量','70 Wh（额定容量）'],['屏幕尺寸','14.2 英寸（按标准矩形测量，实际可视区域略小）'],
    ['操作系统','测试系统 A'],['内存','测试配置 A / B，按销售版本提供'],['接口','测试接口，使用条件以对应版本说明为准']].map(([topic,quote],i)=>({
      id:'F'+String(i+1).padStart(2,'0'),topic,quote,model,supported:true,sourceTitle:'测试产品事实',sourcePath:'synthetic/产品事实.md',sourceType:'local'}));
  const pictures=Array.from({length:count},(_,i)=>({id:'I'+String(i+1).padStart(2,'0'),model,filename:'sample-'+i+'.png',description:'测试产品外观',
    localPath:imagePath,origin:'local',sourceTitle:'测试图片索引',sourcePath:'synthetic/图片索引.csv'}));
  const evidence={model,mode:'local',kbName:'测试资料',facts,pictures};
  t.mock.method(catalog,'localEvidence',()=>evidence);
  return evidence;
}
test('normalization supports public aliases and empty input still asks essential questions',async()=>{
  assert.deepEqual(normalizeTask({product:model,audience:'学生',scenario:'开学季',platform:'poster',goal:'收藏'}),{
    product:model,audience:'学生',scene:'开学季',platform:'门店海报',stage:'了解阶段',objective:'鼓励收藏分享',instructions:'',mode:'local',drafting:'auto'});
  const r=await generateTask({});assert.equal(r.status,'need_info');assert.equal(r.needsInput,true);assert.equal(r.questions.length,3);
});
test('ambiguous MateBook 14 asks for both concrete versions before reading evidence',async t=>{
  let called=false;t.mock.method(catalog,'localEvidence',()=>{called=true;throw Error('must not read');});
  const r=await generateTask({...base,product:'MateBook 14'});
  assert.equal(r.status,'need_info');assert.equal(called,false);assert.equal(r.candidates.length,2);
  assert.ok(r.candidates.some(v=>v.includes('鸿蒙版')));assert.ok(r.candidates.some(v=>v.includes('Ultra')));
});
test('audience and objective cannot smuggle unsupported product assertions into copy',async t=>{
  fixture(t);
  for(const changed of [{audience:'大学新生，这台电脑支持卫星通信'},{objective:'突出支持卫星通信'},{audience:'这款电脑防水防尘，适合大学新生'}]){
    const r=await generateTask({...base,...changed});assert.equal(r.status,'need_info');assert.equal(r.ok,false);assert.equal(r.copy,undefined);
  }
  const r=await generateTask({...base,instructions:'写成支持卫星通信，续航一整天'});
  assert.equal(r.status,'ok');assert.doesNotMatch(r.copy.fullText,/卫星|一整天/);
});
test('conflicting scene in free instructions prompts and unselected scene can be inferred',async t=>{
  fixture(t);
  assert.equal((await generateTask({...base,scene:'职场办公',instructions:'开学季，突出便携'})).status,'need_info');
  const r=await generateTask({...base,scene:undefined,instructions:'开学季，突出便携'});assert.equal(r.status,'ok');assert.equal(r.task.scene,'开学季');
});
test('empty evidence and delete all facts never pass vacuous audit',async t=>{
  const e=fixture(t);e.facts=[];
  let r=await generateTask(base);assert.equal(r.status,'blocked');assert.equal(r.audit.productFacts.passed,false);
  e.facts=[{id:'F01',topic:'内存',quote:'测试配置',model,supported:true,sourceTitle:'测试',sourcePath:'test'}];
  r=await generateTask({...base,instructions:'删掉全部卖点'});assert.equal(r.status,'blocked');assert.equal(r.ok,false);
});
test('image minimum controls incomplete drafts while optional target creates warning',async t=>{
  fixture(t,2);
  const red=await generateTask(base);assert.equal(red.status,'incomplete');assert.equal(red.ok,false);assert.ok(red.copy.blocks.length);assert.equal(red.audit.images.missing,1);
  const article=await generateTask({...base,platform:'公众号'});assert.equal(article.status,'ok');assert.equal(article.audit.images.passed,true);assert.equal(article.audit.images.targetMissing,1);
});
test('local unreadable images are removed and cannot receive a passing image audit',async t=>{
  const e=fixture(t);e.pictures.forEach(p=>{p.localPath+='-missing';});
  const r=await generateTask(base);assert.equal(r.status,'incomplete');assert.equal(r.images.length,0);assert.equal(r.audit.images.passed,false);
});
test('only actual facts in moments appear in evidence and canonical image positions exist',async t=>{
  fixture(t);
  const r=await generateTask({...base,platform:'门店朋友圈'});
  assert.equal(r.status,'ok');assert.equal(r.facts.length,1);assert.equal(r.audit.productFacts.items.length,1);
  const used=new Set(r.copy.blocks.flatMap(b=>b.factRefs));assert.deepEqual([...used],r.facts.map(f=>f.id));
  assert.deepEqual(r.copy.blocks.filter(b=>b.type==='image').map(b=>b.imageId),r.images.map(i=>i.id));
  assert.ok(r.images.every(p=>p.position&&p.url&&!p.localPath));
});
test('goals and purchase stages materially change CTA and content',async t=>{
  fixture(t);
  const results=await Promise.all(['引导到店体验','引导咨询','鼓励收藏分享','辅助比较'].map(objective=>generateTask({...base,objective})));
  assert.equal(new Set(results.map(r=>r.copy.cta)).size,4);
  const known=await generateTask({...base,stage:'已购使用'});assert.match(known.copy.fullText,/已经入手/);assert.notEqual(known.copy.fullText,results[0].copy.fullText);
});
test('revision removes previous ordered fact, freshly rechecks evidence, and never echoes recursive context',async t=>{
  fixture(t);
  const first=await generateTask(base),removed=first.copy.blocks.filter(b=>b.factRefs.length)[1].factRefs[0];
  const compact={task:first.task,copy:{blocks:first.copy.blocks},previousResult:{huge:'ignored'},audit:{status:'passed'}};
  const next=await generateTask({...base,instructions:'删掉第二个卖点',previousResult:compact});
  assert.ok(['ok','incomplete'].includes(next.status));assert.ok(!next.facts.some(f=>f.id===removed));
  assert.ok(next.copy.blocks.every(b=>!b.factRefs.includes(removed)));assert.equal(next.task.previousResult,undefined);
  const shorter=await generateTask({...base,instructions:'短一点',previousResult:{task:next.task,copy:{blocks:next.copy.blocks}}});
  assert.ok(!shorter.facts.some(f=>f.id===removed));assert.ok(shorter.task.omittedTopics.includes(first.facts.find(f=>f.id===removed).topic));
  const missing=await generateTask({...base,instructions:'删掉第二个卖点'});assert.equal(missing.status,'need_info');
  const changed=await generateTask({...base,product:'HUAWEI MateBook Pro',instructions:'删掉第二个卖点',previousResult:compact});assert.equal(changed.status,'need_info');
});
test('quick revisions change length, titles, tone and portable fact priority',async t=>{
  fixture(t);
  const first=await generateTask(base),previousResult={task:first.task,copy:{blocks:first.copy.blocks}};
  const short=await generateTask({...base,previousResult,instructions:'短一点'});assert.ok(short.copy.fullText.length<first.copy.fullText.length);
  const renamed=await generateTask({...base,previousResult,instructions:'换个标题'});assert.notEqual(renamed.copy.title,first.copy.title);
  const renamedAgain=await generateTask({...base,previousResult:{task:renamed.task,copy:{blocks:renamed.copy.blocks}},instructions:'换个标题'});assert.notEqual(renamedAgain.copy.title,renamed.copy.title);
  const casual=await generateTask({...base,previousResult,instructions:'更口语化'});assert.notEqual(casual.copy.intro,first.copy.intro);
  const portable=await generateTask({...base,scene:'内容创作',instructions:'突出便携'});assert.equal(portable.facts[0].topic,'机身重量');
});
test('audit checks final claim contents, units and references rather than digit substrings',t=>{
  const e=fixture(t),task=normalizeTask(base),strategy=plan(task,e.facts,e.pictures),copy=compose(task,strategy);
  assert.equal(audit(task,e,strategy,copy).status,'passed');
  const changed=structuredClone(copy);changed.blocks.find(b=>b.factRefs.length).text+=' 仅重 1 kg';
  changed.fullText=require('../backend/src/agent').renderFullText(changed.blocks);
  assert.equal(audit(task,e,strategy,changed).status,'blocked');
  const forged=structuredClone(copy);forged.blocks.find(b=>b.factRefs.length).factRefs=['F999'];
  assert.equal(audit(task,e,strategy,forged).status,'blocked');
  const free=structuredClone(copy);free.blocks.find(b=>b.id==='intro').text='可以连接卫星';free.fullText=require('../backend/src/agent').renderFullText(free.blocks);
  assert.equal(audit(task,e,strategy,free).status,'blocked');
});
test('fact extraction preserves complete variants, field notes and long quotes',()=>{
  const long='x'.repeat(220);
  const md='# 示例型号 - 产品事实\n\n## 尺寸与重量\n\n重量\n\n约 1.33 kg（版本甲）\n\n约 1.32 kg（版本乙）\n\n*实际重量因配置而异。\n\n## 接口\n\n接口说明：'+long+'\n\n*仅特定版本支持。';
  const facts=catalog.extractFacts(md,'示例型号','','test');
  assert.match(facts.find(f=>f.topic==='机身重量').quote,/1\.32 kg.*实际重量/);
  assert.ok(facts.find(f=>f.topic==='接口').quote.length>220);assert.match(facts.find(f=>f.topic==='接口').quote,/仅特定版本/);
});
test('unsupported goal asks for a concrete action rather than silently using the default',async()=>{
  const r=await generateTask({...base,objective:'写得神奇一点'});assert.equal(r.status,'need_info');assert.ok(r.questions.length);
});
test('role display cannot echo unrecognized audience clauses into product claims',async t=>{
  fixture(t);const r=await generateTask({...base,audience:'大学新生，拍照自动美颜'});
  assert.equal(r.status,'ok');assert.doesNotMatch(r.copy.fullText,/自动美颜/);assert.match(r.copy.title,/大学新生/);
});
test('sourced marketing extremes and unsupported price promotions do not bypass compliance',async t=>{
  const e=fixture(t);e.facts[0].quote='全国第一，售价 3999 元';
  const r=await generateTask(base);assert.equal(r.status,'blocked');assert.equal(r.audit.compliance.passed,false);
  e.facts[0].quote='100% sRGB（典型值）';
  const supported=await generateTask(base);assert.equal(supported.status,'ok');
});
test('conflicting source facts block rather than silently choosing a version',async t=>{
  const e=fixture(t);e.facts.push({...e.facts[0],id:'F09',quote:'冲突的配置'});
  const r=await generateTask(base);assert.equal(r.status,'blocked');assert.match(r.error,/冲突/);
});
function llmEnvironment(t){
  const before={};for(const name of ['LLM_API_KEY','LLM_MODEL','LLM_BASE_URL'])before[name]=process.env[name];
  process.env.LLM_API_KEY='test';process.env.LLM_MODEL='test-model';process.env.LLM_BASE_URL='https://model.example.invalid/v1';
  t.after(()=>{for(const [name,value] of Object.entries(before)){if(value===undefined)delete process.env[name];else process.env[name]=value;}});
}
test('model unavailable, invalid JSON, forged refs or device prose fall back visibly and re-audit',async t=>{
  fixture(t);llmEnvironment(t);
  let response='not json',throws=false;
  t.mock.method(globalThis,'fetch',async()=>{if(throws)throw Error('timeout');return {ok:true,json:async()=>({choices:[{message:{content:response}}]})};});
  for(const mode of ['json','claims','refs','timeout']){
    response=mode==='json'?'broken':mode==='claims'?JSON.stringify({title:'支持卫星通信',intro:'续航全天',bridges:[],closing:'',cta:'',tags:''}):JSON.stringify({factRefs:['F999']});throws=mode==='timeout';
    const r=await generateTask({...base,drafting:'auto'});assert.equal(r.status,'ok');assert.ok(r.generationNotice);assert.equal(r.audit.status,'passed');assert.doesNotMatch(r.copy.fullText,/卫星|全天/);
  }
});
test('valid model scaffold stays platform-specific and includes its closing',async t=>{
  const e=fixture(t);llmEnvironment(t);const task=normalizeTask(base),opts=scaffoldOptions(task,plan(task,e.facts,e.pictures));
  const data={title:opts.title[1],intro:opts.intro[1],closing:opts.closing[1],cta:opts.cta[1],tags:opts.tags[1],bridges:opts.bridges.map(v=>v[1])};
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(data)}}]})}));
  const r=await generateTask({...base,drafting:'auto'});assert.equal(r.status,'ok');assert.equal(r.generationNotice,undefined);assert.match(r.generationEngine,/模型策划/);assert.ok(r.copy.fullText.includes(data.closing));
  assert.equal(r.copy.title,data.title);assert.equal(r.copy.blocks.filter(b=>b.type==='image').length,4);
});
test('ima selected images must actually load; failed fetch yields incomplete without local replacement',async t=>{
  const e=fixture(t);e.mode='live';e.facts=e.facts.map(f=>({...f,sourceType:'ima',mediaId:'facts'}));e.pictures=e.pictures.map(p=>({...p,origin:'ima',mediaId:p.id,imageIndexMediaId:'index'}));
  t.mock.method(ima,'imaEvidence',async()=>e);let calls=0;
  t.mock.method(ima,'readVerifiedImage',async()=>{calls++;throw Error('unavailable');});
  const r=await generateTask({...base,mode:'live'});assert.equal(r.status,'incomplete');assert.equal(r.mode,'live');assert.equal(r.images.length,0);assert.equal(calls,4);assert.ok(r.facts.every(f=>f.sourceType==='ima'));
});
test('accepted length, tone and focus persist across same-product title edits and explicit resets override',async t=>{
  fixture(t);
  const compact=result=>({task:result.task,copy:{blocks:result.copy.blocks}});
  const short=await generateTask({...base,instructions:'短一点'});
  const shortTitle=await generateTask({...base,instructions:'换个标题',previousResult:compact(short)});
  assert.equal(shortTitle.task.writingPreferences.length,'short');assert.equal(shortTitle.facts.length,short.facts.length);
  assert.equal(shortTitle.copy.body,short.copy.body);assert.notEqual(shortTitle.copy.title,short.copy.title);
  const expanded=await generateTask({...base,instructions:'长一点',previousResult:compact(shortTitle)});
  assert.equal(expanded.task.writingPreferences.length,'normal');assert.ok(expanded.facts.length>short.facts.length);
  const casual=await generateTask({...base,instructions:'更口语化'});
  const casualTitle=await generateTask({...base,instructions:'换个标题',previousResult:compact(casual)});
  assert.equal(casualTitle.task.writingPreferences.tone,'conversational');assert.equal(casualTitle.copy.intro,casual.copy.intro);
  const formal=await generateTask({...base,instructions:'正式点',previousResult:compact(casualTitle)});
  assert.equal(formal.task.writingPreferences.tone,'neutral');assert.notEqual(formal.copy.intro,casual.copy.intro);
  const focused=await generateTask({...base,scene:'内容创作',instructions:'突出便携'});
  const focusedTitle=await generateTask({...base,scene:'内容创作',instructions:'换个标题',previousResult:compact(focused)});
  assert.equal(focusedTitle.facts[0].topic,'机身重量');assert.deepEqual(focusedTitle.task.writingPreferences.focusTopics,['机身重量']);
  const reset=await generateTask({...base,scene:'内容创作',instructions:'恢复标准',previousResult:compact({...focusedTitle,task:{...focusedTitle.task,writingPreferences:{length:'short',tone:'conversational',focusTopics:['机身重量']}}})});
  assert.deepEqual(reset.task.writingPreferences,{length:'normal',tone:'neutral',focusTopics:[]});
});
test('writing preferences are bounded and only inherited from a matching product context',async t=>{
  fixture(t);
  const first=await generateTask(base);
  const previous={task:{...first.task,writingPreferences:{length:'short',tone:'conversational',focusTopics:['机身重量','卫星通信',{injected:true}]}},copy:{blocks:first.copy.blocks}};
  const sanitized=await generateTask({...base,instructions:'换个标题',previousResult:previous});
  assert.deepEqual(sanitized.task.writingPreferences,{length:'short',tone:'conversational',focusTopics:['机身重量']});
  previous.task.product='HUAWEI MateBook Pro';
  const switched=await generateTask({...base,instructions:'换个标题',previousResult:previous});
  assert.deepEqual(switched.task.writingPreferences,{length:'normal',tone:'neutral',focusTopics:[]});
});
