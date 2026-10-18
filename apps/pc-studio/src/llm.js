'use strict';
const fs=require('node:fs');
const path=require('node:path');
const key=()=>process.env.LLM_API_KEY||process.env.OPENAI_API_KEY||'';
const configured=()=>Boolean(key()&&process.env.LLM_MODEL);
const SYSTEM=fs.readFileSync(path.join(__dirname,'../docs/SYSTEM_PROMPT.md'),'utf8');
function fencedJSON(s){
  const text=String(s||'').trim().replace(/^\x60+json\s*/i,'').replace(/\x60+$/,'');
  const first=text.indexOf('{'),last=text.lastIndexOf('}');
  if(first<0||last<=first)throw Error('模型没有返回有效JSON');
  return JSON.parse(text.slice(first,last+1));
}
function checkText(s,allowProduct=''){
  const v=String(s||'');
  if(v.length>500)throw Error('生成文本过长，未纳入受控稿件');
  if(/全国第一|全球第一|唯一|最强|最好|永久|100%|补贴|免费赠|元|直降|吊打|碾压|秒杀|完胜|绝对|第一名/.test(v))throw Error('模型返回营销风险表述');
  const stripped=v.replaceAll(allowProduct,'');
  if(/\d/.test(stripped))throw Error('模型自由文本包含未经证据关联的数字');
  if(/保证|承诺|搭载|全面超越|领先|跑分|实测|自用|亲测|我买了|我用了|体验了一周/.test(stripped))
    throw Error('模型返回未验证产品或用户经历陈述');
  return v.trim();
}
async function generateScaffold(task,strategy) {
  if(!configured())return null;
  const base=(process.env.LLM_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');
  if(!/^https:\/\//.test(base) && !/^http:\/\/127\.0\.0\.1(?::\d+)?/.test(base))
    throw Error('拒绝不安全的模型服务地址');
  const needed=strategy.selected.length;
  const payload={
    model:process.env.LLM_MODEL,
    temperature:0.55,
    messages:[
      {role:'system',content:SYSTEM+'\n你只允许组织没有具体产品事实的文字衔接。全部产品事实由服务端在生成后逐字插入，不能在自由文本里描述设备性能、参数、价格、优惠或品牌对比。返回严格JSON。'},
      {role:'user',content:JSON.stringify({
        task:{product:task.product,audience:task.audience,scene:task.scene,stage:task.stage,
          objective:task.objective,platform:task.platform,customization:task.instructions},
        evidenceTopics:strategy.selected.map(x=>x.topic),
        responseSchema:{title:'一句场景标题（可含完整产品型号，但不能有其它数字）',
          intro:'只讲人群问题，不做产品事实陈述',bridges:Array(needed).fill('某一事实的重要性解释，不做产品事实陈述'),
          closing:'理性选购提醒，不要出现具体数字',cta:'适合该平台和购买阶段的行动引导',tags:'平台标签（可为空）'}
      })}
    ]
  };
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try {
    const res=await fetch(base+'/chat/completions',{method:'POST',signal:controller.signal,
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+key()},body:JSON.stringify(payload)});
    if(!res.ok)throw Error('模型服务返回 '+res.status);
    const body=await res.json();
    const output=fencedJSON(body.choices?.[0]?.message?.content);
    const fields=['title','intro','closing','cta','tags'];
    for(const f of fields)output[f]=checkText(output[f]||'',task.product);
    if(!Array.isArray(output.bridges)||output.bridges.length!==needed)throw Error('模型衔接段数量与证据数量不一致');
    output.bridges=output.bridges.map(x=>checkText(x,task.product));
    if(!output.title||!output.intro||!output.cta)throw Error('模型生成的结构不完整');
    return {data:output,model:process.env.LLM_MODEL};
  }finally{clearTimeout(timer);}
}
function mergeScaffold(task,strategy,proposal){
  const p=proposal.data,fs=strategy.selected;
  const paragraphs=fs.map((f,i)=>(p.bridges[i]?p.bridges[i]+'\n':'')+'【'+f.topic+'】'+f.quote);
  const body=task.platform==='门店海报'
    ?paragraphs.slice(0,3).join('\n')
    :paragraphs.join('\n\n')+'\n\n具体销售版本、功能适用范围与价格请以官网及门店核实结果为准。';
  const fullText=['# '+p.title,p.intro,body,'**行动引导**：'+p.cta,p.tags].filter(Boolean).join('\n\n');
  return {title:p.title,intro:p.intro,body,cta:p.cta,tags:p.tags,
    fullText,platform:task.platform,engine:'LLM语言策划+本地证据锁定'};
}
module.exports={configured,generateScaffold,mergeScaffold};
