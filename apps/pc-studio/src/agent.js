'use strict';
const {localEvidence}=require('./catalog');
const {imaEvidence}=require('./ima');
const PLATFORMS={
  '公众号':{images:3,tone:'专业、解释充分',structure:'导语→需求拆解→产品事实→购买建议→行动引导',cta:'咨询门店并根据实际配置体验'},
  '小红书':{images:4,tone:'短句、自然、场景化、不伪装亲测',structure:'共鸣标题→场景困扰→事实清单→选择提示→话题标签',cta:'收藏清单，带着需求到店实际体验'},
  '门店朋友圈':{images:2,tone:'短、真诚、明确到店理由',structure:'一句场景洞察→重点事实→到店咨询',cta:'私信咨询具体版本或预约门店体验'},
  '门店海报':{images:1,tone:'简练、视觉优先、卖点不超三项',structure:'主标题→副标题→三项以内事实→CTA',cta:'到店体验，具体配置以门店为准'}
};
const SCENES={
 '开学季':{who:'准备入学的学生及家长',pain:'兼顾课程任务、携带与校园生活',objective:'帮助用户列出选机优先级',focus:['机身重量','电池容量','屏幕尺寸','操作系统','内存'],hook:'开学选电脑，不必一上来只比参数'},
 '职场办公':{who:'办公及差旅用户',pain:'会议、移动携带与多任务处理',objective:'明确高频办公任务与设备选择条件',focus:['机身重量','接口','电池容量','操作系统','内存'],hook:'每天真正高频的办公任务，决定了电脑该看什么'},
 '内容创作':{who:'设计、摄影及内容创作者',pain:'屏幕表现、素材管理与创作软件兼容',objective:'从创作工作流反推配置需求',focus:['屏幕分辨率','屏幕类型','处理器','内存','接口'],hook:'创作设备怎么选，先把工作流程梳理清楚'},
 '家庭换新':{who:'家庭用户与旧机换新者',pain:'日常易用性、设备迁移与多位家庭成员使用',objective:'降低换机信息成本',focus:['操作系统','屏幕尺寸','存储','接口','机身重量'],hook:'给家里换电脑，常常比只看单一配置复杂'},
 '企业采购':{who:'团队采购与企业IT',pain:'软件兼容、统一部署、接口与售后政策核实',objective:'引导进入兼容性与试点验收流程',focus:['操作系统','接口','内存','存储','处理器'],hook:'批量购机之前，先把真实部署条件列出来'},
 '门店到访':{who:'附近准备看机的用户',pain:'希望快速知道到店值得看什么',objective:'引导一次有目标的实际体验',focus:['屏幕尺寸','机身重量','屏幕类型','接口','操作系统'],hook:'到店不用一口气试遍所有功能'},
 '新品首发':{who:'关注新品的潜在购机者',pain:'想知道新款与自身使用场景的关系',objective:'区分已发布事实与待核实权益',focus:['操作系统','处理器','屏幕类型','屏幕分辨率','电池容量'],hook:'关注新产品，也要先判断它是否契合自己的需求'},
 '节日营销':{who:'送礼及家庭购机人群',pain:'兼顾收礼人的使用习惯与预算',objective:'避免凭空制造促销与优惠',focus:['机身重量','屏幕尺寸','操作系统','电池容量','接口'],hook:'送电脑更重要的是对方实际怎么用'}
};
const STAGES=['了解阶段','比较阶段','临门决策','已购使用'];
const riskPatterns=[
  {name:'绝对化宣传',re:/全国第一|全球第一|业界第一|最(强|好|薄|快|轻|佳|高|低|优)|唯一|首个|百分之百|100%|永久|永不|绝对|零风险|无敌/g},
  {name:'虚构优惠或价格',re:/([¥￥]\s*\d+|\d+\s*元|直降|补贴|返现|免单|最低价|限时优惠|五折|赠品|包邮)/g},
  {name:'无依据竞品对比',re:/吊打|碾压|秒杀|苹果不行|联想不行|完胜|优于所有|比竞品都/g},
  {name:'捏造销量/评价/承诺',re:/销量第一|万人好评|用户一致好评|保修终身|保证不卡|续航一整天|实测证明/g}
];
function preflight(task) {
  const missing=[];
  if(!task.product?.trim())missing.push('需要明确产品型号及版本；相近型号不能混用参数');
  if(!task.audience?.trim())missing.push('请补充目标人群，例如大一新生、差旅职场人');
  if(!SCENES[task.scene])missing.push('请选择明确的营销业务场景');
  if(!PLATFORMS[task.platform])missing.push('请选择公众号、小红书、门店朋友圈或门店海报');
  if(!STAGES.includes(task.stage))missing.push('请补充购买阶段');
  if(!task.objective?.trim())missing.push('请补充内容目标，如引导到店体验或辅助选购');
  return missing;
}
function detectRisks(str) {
  const hits=[];
  for(const rule of riskPatterns){const m=String(str||'').match(rule.re);if(m)hits.push({type:rule.name,examples:[...new Set(m)].slice(0,5)});}
  return hits;
}
function plan(task,facts,images) {
  const s=SCENES[task.scene];const p=PLATFORMS[task.platform];
  const priorities=s.focus.map((topic,rank)=>({topic,score:20-rank*3,reason:'与'+task.scene+'需求相关'}));
  const intent=task.instructions||'';
  const signals=[['机身重量',/轻薄|重量|便携|随身|携带/],['电池容量',/续航|电池|充电/],['屏幕尺寸',/大屏|尺寸/],['屏幕分辨率',/分辨率|画质|清晰/],['屏幕类型',/屏幕|OLED|显示/],['接口',/接口|HDMI|USB|外设/],['操作系统',/系统|鸿蒙|Windows|兼容/],['处理器',/CPU|处理器|算力|性能/],['内存',/内存|多任务/],['存储',/硬盘|容量|存储/]];
  const removeTopics=signals.filter(([topic,rx])=>new RegExp('(删除|删掉|不要|去掉|移除).{0,5}('+rx.source+')').test(intent)).map(([topic])=>topic);
  const selected=facts.filter(f=>!removeTopics.includes(f.topic)).map((f,index)=>{
    const pref=priorities.find(x=>x.topic===f.topic);
    const stageAdj=task.stage==='比较阶段'&&['屏幕分辨率','内存','处理器','接口'].includes(f.topic)?4:0;
    const intentAdj=signals.some(([topic,rx])=>topic===f.topic&&rx.test(intent)&&!removeTopics.includes(topic))?12:0;
    return {...f,score:(pref?.score||2)+stageAdj+intentAdj-index*.005,
      rationale:intentAdj?'用户明确要求侧重此项':(pref?.reason||'补充购机核查维度')};
  }).sort((a,b)=>b.score-a.score).slice(0,task.platform==='门店海报'?3:task.platform==='门店朋友圈'?3:5);
  const imageScore=x=>{
    const text=(x.description||'')+' '+(x.filename||'');
    let score=0;
    const cue={ '开学季':/轻薄|机身|键盘|协同|便携/,
      '职场办公':/接口|商务|办公|侧面|键盘/,
      '内容创作':/屏幕|创作|色彩|显示|OLED|触控/,
      '家庭换新':/外观|主视觉|配色|桌面/,
      '企业采购':/接口|性能|外观|主视觉/,
      '门店到访':/主视觉|正面|外观|配色/,
      '新品首发':/主视觉|外观|配色|屏幕/,
      '节日营销':/外观|配色|主视觉/}[task.scene];
    if(cue?.test(text))score+=10;
    if(/主视觉|正面|产品展示|外观/.test(text))score+=4;
    if(/屏幕|OLED/.test(text)&&selected.some(f=>f.topic.startsWith('屏幕')))score+=3;
    return score;
  };
  const chosen=[...images].sort((a,b)=>imageScore(b)-imageScore(a)).slice(0,p.images);
  const pictures=chosen.map((im,i)=>({
    ...im,position:i===0?'标题下方的主视觉':i===1?'第一个产品事实段落后':i===2?'购买建议段落前':'结尾行动引导前',
    why:i===0?'先展示准确型号的产品形态':'与当前场景的产品事实形成对应',score:imageScore(im)
  }));
  return {scene:s,platform:p,priorities,selected,pictures,
    strategyExplanation:'以“'+s.pain+'”作为内容切入点；围绕'+selected.map(x=>x.topic).join('、')+'排列有来源的事实，再按'+task.platform+'组织内容。',
    imageShortfall:Math.max(0,p.images-pictures.length)};
}
function factText(f){return '【'+f.topic+'】'+f.quote;}
function compose(task,strategy) {
  const s=strategy.scene;
  const f=strategy.selected;
  const display=task.product;
  const lead='面对“'+s.pain+'”这一问题，先判断每天的主要任务，再核对设备的具体版本与配置。';
  const list=f.map((x,i)=>(i+1)+'. '+factText(x)).join('\n');
  const reminder='以上参数依据已检索资料整理，实际配置、系统版本与功能适用条件请以对应销售版本及官方最新信息为准。';
  let title='',intro='',body='',cta='',tags='';
  if(task.platform==='小红书') {
    title=task.audience+'选'+display+'：先看这份需求清单';
    intro='📌 '+s.hook+'。\n'+lead;
    body='### 先想清楚用途\n'+task.audience+'，优先关注：'+strategy.selected.map(x=>x.topic).slice(0,3).join('、')+'。\n\n### 再核对公开资料\n'+list+'\n\n### 选购前还要问\n'+(task.scene==='企业采购'?'企业软件、账号策略和外设是否能完成试点验证？':'具体销售版本能否满足常用软件、接口及外设需求？')+'\n\n'+reminder;
    cta='💬 '+PLATFORMS[task.platform].cta+'，把你的常用场景列出来再比较。';
    tags='#华为MateBook #电脑选购 #'+task.scene.replace(/\s/g,'')+' #选机攻略';
  } else if(task.platform==='公众号') {
    title=s.hook+'｜'+display+'场景化选购指南';
    intro='在'+task.scene+'场景里，同一个产品的卖点顺序未必相同。'+lead;
    body='## 先看实际问题\n'+s.pain+'。因此，本文将重点放在'+f.map(x=>x.topic).slice(0,3).join('、')+'，而不是一味堆砌性能形容词。\n\n## 从资料中核对哪些事实\n'+list+'\n\n## 如何把事实变成选购判断\n'+task.audience+'可把上述信息逐项对照自己的实际工作流；如果涉及特定软件、配置差异或外设组合，应在下单前现场确认。\n\n## 必须保留的条件\n'+reminder;
    cta='建议带着上述核对清单到店体验'+display+'，并向工作人员确认对应SKU与适用功能。';
  } else if(task.platform==='门店朋友圈') {
    title=task.audience+'看机提醒｜'+display;
    intro=s.hook+'。';
    body=f.slice(0,2).map(x=>'• '+factText(x)).join('\n')+'\n'+reminder;
    cta='欢迎私信咨询或到店体验，先核对需求，再看具体版本。';
  } else {
    title=display+'｜'+s.hook;
    intro=task.audience+' · '+task.scene;
    body=f.slice(0,3).map(x=>'◆ '+factText(x)).join('\n')+'\n'+reminder;
    cta='到店体验｜具体配置请以实际销售版本为准';
  }
  return {title,intro,body,cta,tags,platform:task.platform,
    fullText:['# '+title,intro,body,'**行动引导**：'+cta,tags].filter(Boolean).join('\n\n')};
}
function audit(task,evidence,strategy,copy) {
  const inputRisks=detectRisks(task.instructions);
  const outputRisks=detectRisks(copy.fullText);
  const factMatches=strategy.selected.map(f=>({id:f.id,topic:f.topic,
    passed:f.supported===true&&evidence.facts.some(o=>o.quote===f.quote && o.model===evidence.model),
    sourceTitle:f.sourceTitle,sourceType:f.sourceType,quote:f.quote}));
  const pictureMatches=strategy.pictures.map(p=>({id:p.id,filename:p.filename,
    passed:p.model===evidence.model&&p.origin===(evidence.mode==='live'?'ima':'local') &&
      (evidence.mode==='local'?Boolean(p.localPath):Boolean(p.mediaId&&p.imageIndexMediaId)),
    mediaId:p.mediaId||'',sourceTitle:p.sourceTitle,origin:p.origin}));
  const numericValues=(copy.fullText.match(/\d+(?:\.\d+)?/g)||[]);
  const allowedFacts=strategy.selected.map(f=>f.quote).join(' ');
  // Word counts in title or platform tags (e.g. MateBook 14) are also permitted.
  const knownText=allowedFacts+' '+evidence.model;
  const unsupportedNumbers=[...new Set(numericValues)].filter(n=>!knownText.includes(n) && !['1','2','3','4','5'].includes(n));
  const status=factMatches.every(x=>x.passed)&&pictureMatches.every(x=>x.passed)&&outputRisks.length===0&&unsupportedNumbers.length===0?'passed':'blocked';
  return {status,productFacts:{passed:factMatches.every(x=>x.passed),items:factMatches},
    images:{passed:pictureMatches.every(x=>x.passed),items:pictureMatches,missing:strategy.imageShortfall},
    compliance:{passed:outputRisks.length===0,outputRisks,inputRisks,
      discardedInputInstructions:inputRisks.length>0?'含未经证实或违规营销表述的指令未进入生成内容':''},
    unknowns:[...new Set([...(strategy.imageShortfall?['当前资料中缺少'+strategy.imageShortfall+'张该平台建议数量的同型号配图']:[]),
      '真实售价、补贴、库存和促销权益未核验，不应写入稿件',
      ...unsupportedNumbers.map(n=>'待核实数字：'+n)])]};
}
async function generateTask(task) {
  task={...task,product:String(task.product||'').trim(),audience:String(task.audience||'').trim(),
    instructions:String(task.instructions||'').slice(0,600),objective:String(task.objective||'').trim()};
  // Explicitly reject unknown source names; quota exhaustion must never cause silent fallback.
  task.mode=task.mode||'local';
  if(!['local','live'].includes(task.mode))return {ok:false,error:'未知数据源模式，必须明确选择本地开发或ima正式模式'};
  const missing=preflight(task);
  if(missing.length)return {ok:false,needsInput:true,questions:missing,trace:[{step:'场景解析',status:'需要补充输入'}]};
  const start=Date.now();const trace=[{step:'场景解析',status:'完成',note:task.audience+' / '+task.scene+' / '+task.stage}];
  let evidence;
  try {evidence=task.mode==='live'?await imaEvidence(task.product):localEvidence(task.product);}
  catch(e){const quota=task.mode==='live'&&/220021|次数已达上限/.test(e.message);
    return {ok:false,error:quota?'ima资料读取额度已达到平台上限（220021）。可以手动改为本地模式继续开发；正式模式不会假装读到ima资料。':e.message,
      sourceMode:task.mode,quotaLimited:quota,
      trace:[...trace,{step:task.mode==='live'?'ima证据检索':'本地证据检索',status:'失败（已停止，没有跨数据源回退）'}]};}
  if(evidence.error)return {ok:false,error:evidence.error,trace};
  trace.push({step:'知识库检索',status:'完成',note:evidence.kbName+' / '+evidence.facts.length+'条事实 / '+evidence.pictures.length+'张图片'});
  const strategy=plan(task,evidence.facts,evidence.pictures);
  trace.push({step:'场景与平台策略',status:'完成',note:strategy.strategyExplanation});
  let copy=compose(task,strategy);let engine='自研规则式语言组织';
  const llm=require('./llm');
  if(task.drafting!=='rules'&&llm.configured()) {
    try {
      const proposal=await llm.generateScaffold(task,strategy);
      copy=llm.mergeScaffold(task,strategy,proposal);
      engine='LLM语言组织 + 确定性证据锁定（'+proposal.model+'）';
    }catch(e){trace.push({step:'语言模型',status:'受控回退',note:'模型输出未通过受控生成闸门或接口不可用；不纳入无来源营销事实'});}
  }
  trace.push({step:'图文软文生成',status:'完成',note:engine+'；所选事实 '+strategy.selected.length+' 条'});
  const result=audit(task,evidence,strategy,copy);
  trace.push({step:'事实、图片与合规复核',status:result.status,note:result.unknowns.join('；')});
  if(result.status==='blocked')return {ok:false,error:'事实或合规校验未通过，内容未发布。',audit:result,trace};
  return {ok:true,mode:evidence.mode,kbName:evidence.kbName,warning:evidence.warning,
    task,scene:{audience:task.audience,scene:task.scene,pain:strategy.scene.pain,stage:task.stage,objective:task.objective,platform:task.platform},
    strategy:{explanation:strategy.strategyExplanation,priorities:strategy.priorities,platform:strategy.platform,
      selected:strategy.selected.map(x=>({topic:x.topic,score:x.score,rationale:x.rationale,id:x.id}))},
    facts:strategy.selected,images:strategy.pictures.map(p=>({...p,localPath:undefined})),
    generationEngine:engine,copy,audit:result,trace,
    meta:{durationMs:Date.now()-start,generatedAt:new Date().toISOString(),traceVersion:'1.0'}};
}
module.exports={generateTask,preflight,detectRisks,PLATFORMS,SCENES,STAGES,plan,compose,audit};
