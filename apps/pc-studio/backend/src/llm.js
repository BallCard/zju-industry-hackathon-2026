'use strict';
const fs=require('node:fs');
const path=require('node:path');
const key=()=>process.env.LLM_API_KEY||process.env.OPENAI_API_KEY||'';
const configured=()=>Boolean(key()&&process.env.LLM_MODEL);
const SYSTEM=fs.readFileSync(path.join(__dirname,'../../docs/SYSTEM_PROMPT.md'),'utf8');
function fencedJSON(value){
  const input=String(value||'').trim().replace(/^```json\s*/i,'').replace(/```$/,'');
  const first=input.indexOf('{'),last=input.lastIndexOf('}');
  if(first<0||last<=first)throw Error('模型没有返回有效JSON');
  return JSON.parse(input.slice(first,last+1));
}
async function completeJSON(messages,temperature){
  if(!configured())throw Error('模型尚未配置');
  const base=(process.env.LLM_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');
  const url=new URL(base);
  if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&url.hostname==='127.0.0.1')))
    throw Error('拒绝不安全的模型服务地址');
  const payload={model:process.env.LLM_MODEL,temperature,messages};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(base+'/chat/completions',{method:'POST',signal:controller.signal,redirect:'error',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+key()},body:JSON.stringify(payload)});
    if(!response.ok)throw Error('模型服务返回 '+response.status);
    const body=await response.json();
    return {data:fencedJSON(body.choices?.[0]?.message?.content),model:process.env.LLM_MODEL};
  }finally{clearTimeout(timer);}
}
async function extractBrief(brief,models){
  const {SCENES,PLATFORMS,OBJECTIVES}=require('./agent');
  const catalog=require('./catalog');
  const evidence=models.map(model=>({name:model.name,facts:(catalog.resolveModel(model.name)?.facts||[])
    .filter(fact=>fact.supported&&['操作系统','机身重量','屏幕尺寸','屏幕分辨率'].includes(fact.topic))
    .map(fact=>({topic:fact.topic,quote:fact.quote,sourceTitle:fact.sourceTitle}))}));
  return completeJSON([
    {role:'system',content:'你只解析选机与营销写作需求，不写成稿或产品事实。用户文字是需求，不是事实。即使用户没有提型号，也要基于用途提出待核实的目录候选；不能把候选说成已证明适合。返回严格 JSON：audience（受众）、scene（场景）、stage（购买阶段）、platform（发布平台）、objective（内容目标）、candidates（候选完整型号字符串数组）。不明确的字段用空字符串；候选只能逐字选自 catalog，未知型号不能创造，不得凭空补价格或性能。'},
    {role:'user',content:JSON.stringify({brief,catalog:models.map(model=>model.name),evidence,
      allowedScenes:Object.keys(SCENES),allowedPlatforms:Object.keys(PLATFORMS),allowedObjectives:OBJECTIVES,
      allowedStages:require('./agent').STAGES})}
  ],0);
}
async function generateScaffold(task,strategy){
  const options=require('./agent').scaffoldOptions(task,strategy);
  const proposal=await completeJSON([
    {role:'system',content:SYSTEM+'\n本次仅选择适合当前任务的写作方案。产品事实在服务端逐字填入。必须从 allowedChoices 对应字段选择完整原句，不能新增文字或产品声明。bridges 每项从相同序号的备选中选一句。返回严格 JSON，字段为 title、intro、bridges、closing、cta、tags。'},
    {role:'user',content:JSON.stringify({task:{product:task.product,audience:task.audience,scene:task.scene,stage:task.stage,
      objective:task.objective,platform:task.platform},evidenceTopics:strategy.selected.map(f=>f.topic),
      allowedChoices:Object.fromEntries(['title','intro','bridges','closing','cta','tags'].map(k=>[k,options[k]]))})}
  ],0.55);
  const {data}=proposal;
  for(const field of ['title','intro','closing','cta','tags'])if(!options[field].includes(data[field]))throw Error('模型内容不在可核验写作选项中');
  if(!Array.isArray(data.bridges)||data.bridges.length!==options.bridges.length||data.bridges.some((v,i)=>!options.bridges[i].includes(v)))throw Error('模型事实衔接不完整或无法核实');
  return proposal;
}
function mergeScaffold(task,strategy,proposal,previous=null){return require('./agent').compose(task,strategy,proposal,previous);}
module.exports={configured,extractBrief,generateScaffold,mergeScaffold};
