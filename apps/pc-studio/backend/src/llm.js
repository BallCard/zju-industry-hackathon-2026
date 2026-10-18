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
async function generateScaffold(task,strategy){
  if(!configured())throw Error('模型尚未配置');
  const base=(process.env.LLM_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');
  const url=new URL(base);
  if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&url.hostname==='127.0.0.1')))
    throw Error('拒绝不安全的模型服务地址');
  const options=require('./agent').scaffoldOptions(task,strategy);
  const payload={model:process.env.LLM_MODEL,temperature:0.55,messages:[
    {role:'system',content:SYSTEM+'\n本次仅选择适合当前任务的写作方案。产品事实在服务端逐字填入。必须从 allowedChoices 对应字段选择完整原句，不能新增文字或产品声明。bridges 每项从相同序号的备选中选一句。返回严格 JSON，字段为 title、intro、bridges、closing、cta、tags。'},
    {role:'user',content:JSON.stringify({task:{product:task.product,audience:task.audience,scene:task.scene,stage:task.stage,
      objective:task.objective,platform:task.platform},evidenceTopics:strategy.selected.map(f=>f.topic),
      allowedChoices:Object.fromEntries(['title','intro','bridges','closing','cta','tags'].map(k=>[k,options[k]]))})}
  ]};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(base+'/chat/completions',{method:'POST',signal:controller.signal,redirect:'error',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+key()},body:JSON.stringify(payload)});
    if(!response.ok)throw Error('模型服务返回 '+response.status);
    const body=await response.json(),data=fencedJSON(body.choices?.[0]?.message?.content);
    for(const field of ['title','intro','closing','cta','tags'])if(!options[field].includes(data[field]))throw Error('模型内容不在可核验写作选项中');
    if(!Array.isArray(data.bridges)||data.bridges.length!==options.bridges.length||data.bridges.some((v,i)=>!options.bridges[i].includes(v)))throw Error('模型事实衔接不完整或无法核实');
    return {data,model:process.env.LLM_MODEL};
  }finally{clearTimeout(timer);}
}
function mergeScaffold(task,strategy,proposal,previous=null){return require('./agent').compose(task,strategy,proposal,previous);}
module.exports={configured,generateScaffold,mergeScaffold};
