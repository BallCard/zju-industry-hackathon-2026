'use strict';
const catalog=require('./catalog');
const manifestNames=new Set(require('../../data/models.json').map(model=>model.name));
const bounded=value=>typeof value==='string'?value.trim().slice(0,2000):'';
function briefText(input){return [bounded(input.request),bounded(input.brief)].filter(Boolean).join('；').slice(0,2000);}
function inferBrief(brief){
  const {SCENES}=require('./agent');
  const audience=[[/大学新生|大一|准大学/,'大学新生'],[/学生|开学|校园/,'学生群体'],[/设计|摄影|创作|剪辑|视频/,'内容创作者'],
    [/企业|采购|团队/,'企业采购人员'],[/差旅|出差|通勤/,'差旅办公人群'],[/办公|职场|白领|上班/,'办公人群'],
    [/程序员|开发|工程师/,'软件开发者'],[/家用|家庭|父母|老人/,'家庭用户']].find(([pattern])=>pattern.test(brief))?.[1]||'';
  const scene=Object.keys(SCENES).find(name=>brief.includes(name))||
    (audience==='学生群体'||audience==='大学新生'?'开学季':audience==='内容创作者'?'内容创作':audience==='企业采购人员'?'企业采购':audience==='家庭用户'?'家庭换新':audience?'职场办公':'');
  const platform=[[/小红书|xiaohongshu/i,'小红书'],[/公众号|wechat_article/i,'公众号'],[/朋友圈|moments/i,'门店朋友圈'],[/海报|poster/i,'门店海报']].find(([pattern])=>pattern.test(brief))?.[1]||'';
  const objective=[[/到店|看机|体验/,'引导到店体验'],[/收藏|分享/,'鼓励收藏分享'],[/比较|对比|选购|选机|推荐/,'辅助比较'],[/咨询|私信/,'引导咨询']].find(([pattern])=>pattern.test(brief))?.[1]||'';
  return {audience,scene,platform,objective};
}
// Ranking is a needs-to-evidence heuristic, not a claim of performance or suitability.
function recommendModels(task,brief,suggested=[]){
  const {SCENES}=require('./agent');
  const models=catalog.safeCatalog().filter(model=>manifestNames.has(model.name));
  const validNames=new Set(models.map(model=>model.name));
  const preferred=[...new Set((Array.isArray(suggested)?suggested:[]).filter(name=>typeof name==='string'&&validNames.has(name)))];
  const needs=brief+' '+task.audience+' '+task.scene+' '+task.instructions;
  const topics=[...new Set([
    ...(/系统|鸿蒙|Windows|兼容/i.test(needs)?['操作系统']:[]),
    ...(/便携|轻薄|携带|差旅|通勤/.test(needs)?['机身重量']:[]),
    ...(/大屏|屏幕|设计|创作|剪辑/.test(needs)?['屏幕尺寸','屏幕类型','屏幕分辨率']:[]),
    ...(/接口|外设/.test(needs)?['接口']:[]),...(/续航|电池/.test(needs)?['电池容量']:[]),
    ...(SCENES[task.scene]?.focus||['操作系统','屏幕尺寸','机身重量'])])];
  return models.map((model,index)=>{
    const known=catalog.resolveModel(model.name);
    const facts=(known?.facts||[]).filter(fact=>fact.model===model.name&&fact.supported===true&&fact.sourcePath);
    const selected=topics.map(topic=>facts.find(fact=>fact.topic===topic)).filter(Boolean).slice(0,3);
    let score=selected.length;
    const os=facts.find(fact=>fact.topic==='操作系统')?.quote||'';
    if(/Windows/i.test(needs)&&/Windows/i.test(os))score+=20;
    if(/鸿蒙|HarmonyOS/i.test(needs)&&/HarmonyOS|鸿蒙/i.test(os))score+=20;
    const weight=/(\d+(?:\.\d+)?)\s*(kg|g)\b/i.exec(facts.find(fact=>fact.topic==='机身重量')?.quote||'');
    if(/便携|轻薄|携带|差旅|通勤/.test(needs)&&weight){
      const kg=Number(weight[1])/(weight[2].toLowerCase()==='g'?1000:1);score+=Math.max(0,3-kg);
    }
    const size=/(\d+(?:\.\d+)?)\s*英寸/.exec(facts.find(fact=>fact.topic==='屏幕尺寸')?.quote||'');
    if(/大屏/.test(needs)&&size)score+=Number(size[1])/10;
    if(preferred.includes(model.name))score+=30-preferred.indexOf(model.name);
    return {index,score,name:model.name,
      reason:selected.length?'按需求中的'+selected.map(fact=>fact.topic).join('、')+'提供资料核对候选；不代表已确认软件兼容、预算或具体销售配置。':'产品目录中的候选；当前没有本地事实可供核对，需获取对应型号资料后确认。',
      highlights:selected.length?selected.map(fact=>'【'+fact.topic+'】'+fact.quote):['目录分类：'+model.system+'（不是配置或性能依据）'],
      sources:selected.map(fact=>({topic:fact.topic,sourceTitle:fact.sourceTitle,sourcePath:fact.sourcePath,sourceType:'local',conditions:fact.conditions||''}))};
  }).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,3).map(({index,score,...candidate})=>candidate);
}
module.exports={briefText,inferBrief,recommendModels};
