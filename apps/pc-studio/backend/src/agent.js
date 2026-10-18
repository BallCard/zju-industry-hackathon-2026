'use strict';
const fs=require('node:fs');
const catalog=require('./catalog');
const ima=require('./ima');
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
const PLATFORMS={
  '公众号':{images:3,minImages:2,tone:'解释充分，分段阅读',structure:'场景→事实→选购判断→行动',cta:'带着需求到店体验'},
  '小红书':{images:4,minImages:3,tone:'短句、自然，不伪装亲测',structure:'共鸣标题→场景→清单→建议→话题',cta:'收藏清单，带着需求到店体验'},
  '门店朋友圈':{images:2,minImages:1,tone:'简短，聚焦一个核心卖点',structure:'场景→一个重点→咨询',cta:'私信咨询具体版本'},
  '门店海报':{images:1,minImages:1,tone:'简练，最多三个卖点',structure:'主标题→副标题→事实→行动',cta:'到店体验'}
};
const STAGES=['了解阶段','比较阶段','临门决策','已购使用'];
const OBJECTIVES=['引导到店体验','引导咨询','鼓励收藏分享','辅助比较'];
const platformAliases={wechat_article:'公众号',wechat:'公众号',xiaohongshu:'小红书',moments:'门店朋友圈',poster:'门店海报','朋友圈':'门店朋友圈','海报':'门店海报'};
const signals=[['机身重量',/轻薄|重量|便携|随身|携带/],['电池容量',/续航|电池|充电/],['屏幕尺寸',/大屏|尺寸/],['屏幕分辨率',/分辨率|画质|清晰/],['屏幕类型',/屏幕|OLED|显示/],['接口',/接口|HDMI|USB|外设/],['操作系统',/系统|鸿蒙|Windows|兼容/],['处理器',/CPU|处理器|算力|性能/],['内存',/内存|多任务/],['存储',/硬盘|容量|存储/]];
const riskPatterns=[
  {name:'绝对化宣传',re:/全国第一|全球第一|业界第一|最(强|好|薄|快|轻|佳|高|低|优)|唯一|首个|百分之百|100%|永久|永不|绝对|零风险|无敌/g},
  {name:'虚构优惠或价格',re:/([¥￥]\s*\d+|\d+\s*元|直降|补贴|返现|免单|最低价|限时优惠|五折|赠品|包邮)/g},
  {name:'无依据竞品对比',re:/吊打|碾压|秒杀|苹果不行|联想不行|完胜|优于所有|比竞品都/g},
  {name:'捏造销量/评价/承诺',re:/销量第一|万人好评|用户一致好评|保修终身|保证不卡|续航一整天|实测证明/g}
];
const text=(value,max=600)=>typeof value==='string'?value.trim().slice(0,max):'';
function objectiveKind(value){
  const s=text(value);
  if(!s)return OBJECTIVES[0];
  if(/收藏|分享|种草/.test(s))return OBJECTIVES[2];
  if(/比较|对比|选购|选机|购机需求|辅助/.test(s))return OBJECTIVES[3];
  if(/到店|看机|体验/.test(s))return OBJECTIVES[0];
  if(/咨询|沟通|私信|提问|了解/.test(s))return OBJECTIVES[1];
  return '';
}
function instructionScenes(value){
  return Object.keys(SCENES).filter(scene=>String(value||'').includes(scene));
}
function normalizeTask(input={}){
  const raw=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const platform=text(raw.platform,60);
  const stage=text(raw.stage,40)||'了解阶段';
  const instruction=[text(raw.instructions||raw.instruction||raw.extra),...(Array.isArray(raw.constraints)?raw.constraints.map(x=>text(x,100)):[])].filter(Boolean).join('；').slice(0,600);
  return {product:text(raw.product,150),audience:text(raw.audience,120),
    scene:text(raw.scene||raw.scenario,60)||instructionScenes(instruction)[0]||'职场办公',platform:platformAliases[platform]||platform,
    stage:({'决策阶段':'临门决策','已购阶段':'已购使用'})[stage]||stage,
    objective:objectiveKind(raw.objective||raw.goal),instructions:instruction,
    mode:text(raw.mode,20)||'local',drafting:text(raw.drafting,20)||'auto'};
}
function preflight(input){
  const task=normalizeTask(input),questions=[];
  if(!task.product)questions.push('请选择具体产品型号及版本');
  if(!task.audience||!audienceLabel(task.audience))questions.push('请补充明确的目标人群，例如大学新生、差旅办公人群、创作者或家庭用户');
  if(!SCENES[task.scene])questions.push('请选择使用场景');
  if(!PLATFORMS[task.platform])questions.push('请选择发布位置：公众号、小红书、朋友圈或海报');
  if(!STAGES.includes(task.stage))questions.push('请选择了解、比较、临门决策或已购使用阶段');
  if(!task.objective)questions.push('请明确内容目标：到店体验、咨询、收藏分享或辅助比较');
  return questions;
}
function detectRisks(str){
  return riskPatterns.flatMap(rule=>{const found=String(str||'').match(rule.re);return found?[{type:rule.name,examples:[...new Set(found)].slice(0,5)}]:[];});
}
function audienceLabel(value){
  const source=text(value);
  const roles=[[/大一|大学新生|准大学/,'大学新生'],[/家长/,'学生家长'],[/学生|校园|同学|应届|毕业生/,'学生群体'],
    [/设计|摄影|创作|剪辑|视频|插画|自媒体/,'内容创作者'],[/企业|采购|团队|\bIT\b/i,'企业采购人员'],
    [/差旅|出差|通勤/,'差旅办公人群'],[/职场|办公|白领|上班|员工/,'办公人群'],[/教师|老师/,'教师'],
    [/程序员|开发|工程师/,'软件开发者'],[/家庭|家用|父母|老人|长辈/,'家庭用户'],[/门店|附近|看机|购机|潜在|顾客|消费者|用户|小白/,'选购电脑的用户']];
  return roles.find(([pattern])=>pattern.test(source))?.[1]||'';
}
function containsAssertion(value){
  return /这款|这台|本款|该产品|本产品|防水|防尘|支持|搭载|配备|拥有|具备|卫星|保证|实测|续航|售价|补贴|销量|好评|(?:重|薄|内存|屏幕|电池|性能).{0,8}\d|(?:能|可以).{0,8}(?:通信|联网|运行|续航)|\d+(?:\.\d+)?\s*(?:kg|GB|TB|Wh|小时|元|英寸)/i.test(text(value))||detectRisks(value).length>0;
}
function boundedWritingPreferences(value){
  const prefs=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return {length:prefs.length==='short'?'short':'normal',tone:prefs.tone==='conversational'?'conversational':'neutral',
    focusTopics:Array.isArray(prefs.focusTopics)?[...new Set(prefs.focusTopics.filter(topic=>signals.some(([known])=>known===topic)))].slice(0,signals.length):[]};
}
function mergeWritingPreferences(instruction,previous){
  const prefs=boundedWritingPreferences(/恢复标准|恢复默认写法/.test(instruction)?null:previous);
  // Apply explicit length/tone choices in their written order; title-only edits preserve prior choices.
  for(const match of instruction.matchAll(/短一点|精简|简短|长一点|详细一点|展开一点|恢复标准|恢复正常长度|标准长度/g))
    prefs.length=/短一点|精简|简短/.test(match[0])?'short':'normal';
  for(const match of instruction.matchAll(/更口语化|口语一点|口语化|自然一点|更正式|正式一点|正式点|专业一点|恢复正式/g))
    prefs.tone=/口语|自然一点/.test(match[0])?'conversational':'neutral';
  const requested=signals.filter(([,rx])=>rx.test(instruction)&&!new RegExp('(?:删除|删掉|不要|去掉|移除).{0,5}(?:'+rx.source+')','i').test(instruction)).map(([topic])=>topic);
  if(/取消侧重|恢复默认重点/.test(instruction))prefs.focusTopics=[];
  else if(requested.length)prefs.focusTopics=/再加|同时|兼顾|也突出/.test(instruction)?[...new Set([...prefs.focusTopics,...requested])]:requested;
  return prefs;
}
function writingPreferences(task){return task.writingPreferences?boundedWritingPreferences(task.writingPreferences):mergeWritingPreferences(task.instructions||'');}
function projectPrevious(input,task){
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  if(catalog.resolveModel(input.task?.product)?.name!==task.product)return null;
  if(!Array.isArray(input.copy?.blocks)||input.copy.blocks.length>100)return null;
  const blocks=input.copy.blocks.map(b=>({id:text(b?.id,80),type:text(b?.type,20),role:text(b?.role,30),
    text:text(b?.text,600),factRefs:Array.isArray(b?.factRefs)?b.factRefs.filter(id=>typeof id==='string'&&/^F\d{1,4}$/.test(id)).slice(0,10):[]}));
  return {blocks,writingPreferences:boundedWritingPreferences(input.task?.writingPreferences),omittedTopics:Array.isArray(input.task?.omittedTopics)?input.task.omittedTopics.filter(topic=>signals.some(([known])=>known===topic)):[]};
}
function ordinalRemoval(instruction){
  const match=/(?:删除|删掉|去掉|移除)第([一二三四五六七八九十]|\d+)个?(?:卖点|事实|参数)/.exec(instruction);
  if(!match)return null;
  return /^\d+$/.test(match[1])?Number(match[1]):'一二三四五六七八九十'.indexOf(match[1])+1;
}
function plan(task,facts,images,removedIds=[]){
  const scene=SCENES[task.scene],platform=PLATFORMS[task.platform],intent=task.instructions;
  const priorities=scene.focus.map((topic,rank)=>({topic,score:20-rank*3,reason:'与'+task.scene+'需求相关'}));
  const removeTopics=[...(task.omittedTopics||[]),...signals.filter(([,rx])=>new RegExp('(?:删除|删掉|不要|去掉|移除).{0,5}(?:'+rx.source+')','i').test(intent)).map(([topic])=>topic)];
  const removeAll=/(?:删除|删掉|去掉|移除|不要)(?:所有|全部)(?:的)?(?:卖点|事实|参数)/.test(intent);
  const preferences=writingPreferences(task),short=preferences.length==='short';
  const limit=task.platform==='门店朋友圈'?1:task.platform==='门店海报'?3:short?3:5;
  const selected=(removeAll?[]:facts).filter(f=>!removeTopics.includes(f.topic)&&!removedIds.includes(f.id)).map((f,index)=>{
    const pref=priorities.find(p=>p.topic===f.topic);
    const stageAdj=task.stage==='比较阶段'&&['屏幕分辨率','内存','处理器','接口'].includes(f.topic)?4:0;
    const goalAdj=task.objective==='辅助比较'&&['操作系统','内存','接口'].includes(f.topic)?3:0;
    const intentAdj=preferences.focusTopics.includes(f.topic)&&!removeTopics.includes(f.topic)?15:0;
    return {...f,score:(pref?.score||2)+stageAdj+goalAdj+intentAdj-index*.005,
      rationale:intentAdj?'按你的要求突出此项':(pref?.reason||'补充选购核查维度')};
  }).sort((a,b)=>b.score-a.score).slice(0,limit);
  const imageScore=image=>{
    const label=(image.description||'')+' '+(image.filename||'');
    const cue={'开学季':/轻薄|机身|键盘|协同|便携/,'职场办公':/接口|商务|办公|侧面|键盘/,
      '内容创作':/屏幕|创作|色彩|显示|OLED|触控/,'家庭换新':/外观|主视觉|配色|桌面/,
      '企业采购':/接口|性能|外观|主视觉/,'门店到访':/主视觉|正面|外观|配色/,
      '新品首发':/主视觉|外观|配色|屏幕/,'节日营销':/外观|配色|主视觉/}[task.scene];
    return (cue.test(label)?10:0)+(/主视觉|正面|产品展示|外观/.test(label)?4:0)+(selected.some(f=>f.topic.startsWith('屏幕'))&&/屏幕|OLED/.test(label)?3:0);
  };
  const excludedTopics=[...removeTopics,...facts.filter(f=>removedIds.includes(f.id)).map(f=>f.topic)];
  const pictures=images.filter(p=>!signals.some(([topic,rx])=>excludedTopics.includes(topic)&&rx.test(p.description||'')))
    .sort((a,b)=>imageScore(b)-imageScore(a)).slice(0,platform.images).map(p=>({...p,score:imageScore(p),why:'用于当前型号的图文展示'}));
  return {scene,platform,priorities,selected,pictures,short,
    strategyExplanation:'围绕'+scene.pain+'，优先展示'+(selected.map(f=>f.topic).join('、')||'可核实的信息')+'；按'+task.platform+'的阅读方式组织，并用于'+task.objective+'。',
    imageShortfall:Math.max(0,platform.images-pictures.length)};
}
const factText=f=>'【'+f.topic+'】'+f.quote;
function scaffoldOptions(task,strategy){
  const s=strategy.scene,model=task.product,who=audienceLabel(task.audience),conversational=writingPreferences(task).tone==='conversational';
  const stageText={
    '了解阶段':'先列出日常最常用的任务，再决定哪些信息值得重点看。',
    '比较阶段':'比较电脑时，把相同维度放在一起核对，也别漏掉系统和软件适用条件。',
    '临门决策':'决定前，带上常用软件和外设清单，向门店逐项确认对应销售版本。',
    '已购使用':'已经入手的话，可先对照以下资料确认自己的版本；涉及使用方法，请继续查阅对应官方说明。'
  }[task.stage];
  const goalCta={
    '引导到店体验':task.stage==='已购使用'?'有使用疑问，可带着具体版本到店咨询官方使用指引。':'带着常用软件与外设清单，到店确认对应版本并实际体验。',
    '引导咨询':task.stage==='已购使用'?'把具体版本和遇到的问题发来，咨询对应官方说明。':'把常用任务和需要连接的外设告诉我们，先咨询适合核对的版本。',
    '鼓励收藏分享':task.stage==='已购使用'?'收藏这份版本核对清单，查阅时也请确认官方说明是否更新。':'收藏这份清单，也可以分享给正在选电脑的朋友，一起核对需求。',
    '辅助比较':task.stage==='已购使用'?'对照自己的销售版本逐项核实，功能和使用条件以对应官方说明为准。':'把候选电脑的同类信息放在一起核对，再确认软件、外设与实际销售版本。'
  }[task.objective];
  const cta=task.platform==='小红书'?'💬 '+goalCta:task.platform==='门店朋友圈'?'欢迎私信，'+goalCta:task.platform==='门店海报'?'选机咨询｜'+goalCta:'你可以'+goalCta;
  const titles=task.platform==='小红书'?[who+'选电脑，先从需求清单开始｜'+model,model+'怎么选？给'+who+'的核对清单','给'+who+'的选机笔记：'+model]:
    task.platform==='公众号'?[s.hook+'｜'+model,who+'的'+task.scene+'选机指南｜'+model,'从日常需求出发，了解'+model]:
    task.platform==='门店朋友圈'?[who+'看机提醒｜'+model,'选机先看一个重点｜'+model,model+'，到店前可以先看这些']:
    [model+'｜'+task.scene+'选机参考',model+'｜从日常需求出发',model+'｜给'+who+'的选机清单'];
  const lead=conversational?'给'+who+'选电脑，先想想每天用它做什么，再对照下面的资料慢慢看。':
    task.platform==='门店海报'?who+' · '+task.scene:
    task.platform==='门店朋友圈'?s.hook+'。':
    task.platform==='小红书'?'📌 '+s.hook+'。先想清楚自己的用途，再核对具体版本。':
    '面向'+who+'，我们从'+s.pain+'出发，整理值得核对的产品资料。';
  const topicAdvice={
    '电池容量':'电池容量不能直接代表实际续航；续航还与使用任务、设置和环境有关，应以对应版本的官方说明及实际使用为准。',
    '机身重量':'是否适合日常携带，建议结合自己的通勤方式和随身物品到店感受。',
    '操作系统':'选购前，先核对常用软件与对应系统版本是否兼容。',
    '屏幕尺寸':'屏幕是否适合自己的阅读和工作习惯，可以带着常用内容现场查看。',
    '屏幕分辨率':'显示参数是核对维度之一，实际观看感受建议现场确认。',
    '屏幕类型':'不同人的观看习惯不同，选购前可以现场查看常用内容。',
    '接口':'把需要连接的外设列出来，再核对接口类型及适用条件。',
    '内存':'先列出常用软件，再向门店核对适合的销售配置。',
    '存储':'盘点常用文件与素材的保存需求，再核对存储配置。',
    '处理器':'涉及特定软件时，先确认兼容性与对应销售配置。'
  };
  const closing='资料仅对应上述型号；配置、系统版本和功能适用条件请以对应销售版本及官方最新说明为准。';
  return {title:titles,intro:[lead,s.hook+'。'+(conversational?'先把用途想清楚，再看具体版本。':'先明确用途，再核对资料与具体配置。')],
    stage:[stageText],closing:[closing,'购机前请核对具体销售版本、配置差异及功能适用范围；相关信息以官方最新说明为准。'],
    cta:[cta,task.platform==='门店朋友圈'?'欢迎私信。'+cta:task.platform==='门店海报'?'选机咨询｜'+cta:'下一步：'+cta],
    tags:task.platform==='小红书'?['#华为MateBook #电脑选购 #'+task.scene+' #选机清单','#华为笔记本 #选购参考 #'+task.scene]:[''],
    bridges:strategy.selected.map(f=>[topicAdvice[f.topic]||'按自己的日常任务核对对应配置。','选购时，可以把'+f.topic+'加入核对清单。']),
    headings:task.platform==='公众号'?['从资料中核对产品','把参数放回实际需求']:task.platform==='小红书'?['先看这些资料','选购前再确认']:[],
    advice:[task.scene==='企业采购'?'企业采购前请安排软件、账号策略和外设组合的试点验证。':task.scene==='内容创作'?'涉及创作软件和文件格式时，先确认软件、插件和外设的兼容情况。':'涉及特定软件或外设时，请向门店确认对应销售版本是否适用。']};
}
function renderFullText(blocks){
  return blocks.filter(b=>b.type!=='image').map(b=>b.type==='heading'?'#'.repeat(b.level||2)+' '+b.text:b.text).join('\n\n');
}
function compose(task,strategy,proposal=null,previous=null){
  const opts=scaffoldOptions(task,strategy),chosen=proposal?.data;
  if(chosen){
    for(const key of ['title','intro','closing','cta','tags'])if(!opts[key].includes(chosen[key]))throw Error('模型文字未匹配已核实的写作选项');
    if(!Array.isArray(chosen.bridges)||chosen.bridges.length!==strategy.selected.length||chosen.bridges.some((v,i)=>!opts.bridges[i].includes(v)))throw Error('模型事实衔接未通过校验');
  }
  let title=chosen?.title||opts.title[0];
  if(/换.{0,3}标题|换个标题/.test(task.instructions)){
    const old=previous?.blocks.find(b=>b.role==='title'||b.id==='title')?.text||opts.title[0];
    title=opts.title[(Math.max(0,opts.title.indexOf(old))+1)%opts.title.length];
  }
  const intro=chosen?.intro||opts.intro[0],cta=chosen?.cta||opts.cta[0],tags=chosen?.tags??opts.tags[0],closing=chosen?.closing||opts.closing[0];
  const blocks=[],bodyParts=[];
  const addText=(id,value,role='body',factRefs=[])=>blocks.push({id,type:'text',role,text:value,factRefs});
  const addImage=index=>{const image=strategy.pictures[index];if(image)blocks.push({id:'image-'+image.id,type:'image',role:'image',text:image.description||'产品图片',factRefs:[],imageId:image.id});};
  blocks.push({id:'title',type:'heading',level:1,role:'title',text:title,factRefs:[]});
  addImage(0);addText('intro',intro,'intro');
  if(task.platform!=='门店海报')addText('stage',opts.stage[0],'advice');
  if(opts.headings[0])blocks.push({id:'facts-heading',type:'heading',level:2,role:'body',text:opts.headings[0],factRefs:[]});
  strategy.selected.forEach((fact,index)=>{
    const value=factText(fact);addText('fact-'+fact.id,value,'fact',[fact.id]);bodyParts.push(value);
    if(!strategy.short&&task.platform!=='门店海报'&&task.platform!=='门店朋友圈'){
      const bridge=chosen?.bridges[index]||opts.bridges[index][0];addText('advice-'+fact.id,bridge,'advice');bodyParts.push(bridge);
    }
    if(index===0)addImage(1);
    if(index===Math.ceil(strategy.selected.length/2))addImage(2);
  });
  // If a short draft has fewer facts, every available image still receives a real position.
  const used=new Set(blocks.filter(b=>b.type==='image').map(b=>b.imageId));
  strategy.pictures.forEach((p,index)=>{if(!used.has(p.id))addImage(index);});
  if(opts.headings[1])blocks.push({id:'advice-heading',type:'heading',level:2,role:'body',text:opts.headings[1],factRefs:[]});
  if(task.platform!=='门店海报'&&task.platform!=='门店朋友圈')addText('selection-advice',opts.advice[0],'advice');
  if(strategy.selected.some(f=>f.topic==='电池容量')&&(strategy.short||task.platform==='门店海报'||task.platform==='门店朋友圈'))
    addText('battery-condition',opts.bridges[strategy.selected.findIndex(f=>f.topic==='电池容量')][0],'advice');
  addText('closing',closing,'closing');addText('cta',cta,'cta');if(tags)addText('tags',tags,'tags');
  return {title,intro,body:bodyParts.join('\n\n'),cta,tags,closing,platform:task.platform,blocks,fullText:renderFullText(blocks)};
}
function imageReadable(image,evidence){
  if(image.model!==evidence.model||image.origin!==(evidence.mode==='live'?'ima':'local'))return false;
  if(evidence.mode==='live')return Boolean(image.verified&&image.mediaId&&image.imageIndexMediaId);
  try {fs.accessSync(image.localPath,fs.constants.R_OK);return fs.statSync(image.localPath).isFile()&&fs.statSync(image.localPath).size>0&&Boolean(image.sourcePath);}catch{return false;}
}
function audit(task,evidence,strategy,copy){
  const issues=[],blocks=copy.blocks||[],usedIds=[...new Set(blocks.flatMap(b=>b.factRefs||[]))];
  const add=(code,message,blockId,severity='error')=>issues.push({code,message,...(blockId?{blockId}:{}),severity});
  if(!usedIds.length)add('NO_FACTS','正文没有可核实的产品事实，无法生成合格文案');
  const factMatches=usedIds.map(id=>{
    const f=strategy.selected.find(f=>f.id===id),original=evidence.facts.find(f=>f.id===id);
    const passed=Boolean(f&&original&&f.supported===true&&f.model===evidence.model&&original.model===evidence.model&&f.quote===original.quote&&f.sourceTitle===original.sourceTitle&&(f.sourcePath||f.mediaId));
    if(!passed)add('UNSUPPORTED_FACT','正文中的事实未找到同型号原始依据：'+id);
    return {id,topic:f?.topic||'',passed,sourceTitle:f?.sourceTitle||'',sourceType:f?.sourceType||'',quote:f?.quote||''};
  });
  const options=scaffoldOptions(task,strategy),allowed=new Set(['title','intro','stage','closing','cta','tags','headings','advice'].flatMap(k=>options[k]).concat(options.bridges.flat()));
  for(const b of blocks){
    if(!['text','heading','image'].includes(b.type)){add('INVALID_BLOCK','存在无法识别的内容块',b.id);continue;}
    if(b.type==='image')continue;
    if((b.factRefs||[]).length){
      const f=strategy.selected.find(f=>f.id===b.factRefs[0]);
      if(b.factRefs.length!==1||!f||b.text!==factText(f))add('MODIFIED_CLAIM','事实内容、单位或限定条件与原始资料不一致',b.id);
    }else if(!allowed.has(b.text))add('UNVERIFIED_CLAIM','这段文字未通过产品声明检查',b.id);
  }
  if(copy.fullText!==renderFullText(blocks))add('TEXT_MISMATCH','正文与内容块不一致');
  const sourceRiskText=blocks.filter(b=>(b.factRefs||[]).length).map(b=>b.text.replace(/100%\s*(?:sRGB|DCI-P3|Adobe\s*RGB|P3)/gi,'verified color gamut')).join('\n');
  const outputRisks=[...detectRisks(sourceRiskText),...detectRisks(blocks.filter(b=>b.type!=='image'&&!(b.factRefs||[]).length).map(b=>b.text).join('\n'))];
  if(outputRisks.length)add('COMPLIANCE','文案存在需要处理的营销表述');
  const pictureMatches=blocks.filter(b=>b.type==='image').map(b=>{
    const p=strategy.pictures.find(p=>p.id===b.imageId),passed=Boolean(p&&imageReadable(p,evidence));
    if(!passed)add('INVALID_IMAGE','图片型号、来源或可读取性未通过检查',b.id);
    return {id:b.imageId,filename:p?.filename||'',passed,mediaId:p?.mediaId||'',sourceTitle:p?.sourceTitle||'',origin:p?.origin||''};
  });
  const imageCount=new Set(pictureMatches.filter(p=>p.passed).map(p=>p.id)).size;
  const missing=Math.max(0,strategy.platform.minImages-imageCount),targetMissing=Math.max(0,strategy.platform.images-imageCount);
  if(missing)add('MISSING_IMAGES','还缺'+missing+'张可用的同型号图片，当前为草稿',null,'incomplete');
  else if(targetMissing)add('IMAGE_TARGET','已满足最低配图要求；还可补充'+targetMissing+'张图片',null,'warning');
  const blocked=issues.some(i=>i.severity==='error'),status=blocked?'blocked':missing?'incomplete':'passed';
  const inputRisks=detectRisks(task.instructions);
  return {status,productFacts:{passed:factMatches.length>0&&factMatches.every(f=>f.passed)&&!issues.some(i=>['MODIFIED_CLAIM','UNVERIFIED_CLAIM','TEXT_MISMATCH','INVALID_BLOCK'].includes(i.code)),items:factMatches},
    images:{passed:!missing&&pictureMatches.every(p=>p.passed),items:pictureMatches,minimum:strategy.platform.minImages,target:strategy.platform.images,missing,targetMissing},
    completeness:{passed:!missing,imageCount,minimum:strategy.platform.minImages},
    compliance:{passed:!outputRisks.length,outputRisks,inputRisks,discardedInputInstructions:inputRisks.length?'补充要求中的风险表述未写入正文':''},
    issues,unknowns:[...issues.filter(i=>i.severity!=='error').map(i=>i.message),'售价、库存和促销权益未核验，请向官方或门店确认']};
}
function failure(status,error,extra={}){
  return {status,ok:false,needsInput:status==='need_info',questions:[],candidates:[],...(error?{error}:{}),...extra};
}
async function verifyPictures(strategy,evidence,trace){
  const available=[];let failed=0;
  for(const image of strategy.pictures){
    try{
      if(evidence.mode==='live')await ima.readVerifiedImage(evidence.model,image.mediaId);
      else if(!imageReadable(image,evidence))throw Error('图片无法读取');
      available.push({...image,verified:true});
    }catch{failed++;}
  }
  strategy.pictures=available;strategy.imageShortfall=Math.max(0,strategy.platform.images-available.length);
  if(failed)trace.push({step:'图片读取',status:'部分图片不可用',note:failed+'张图片读取失败，已从稿件移除'});
}
async function generateTask(input={}){
  const raw=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const task=normalizeTask(raw),start=Date.now();
  if(!['local','live'].includes(task.mode))return failure('blocked','未知数据源模式，必须明确选择本地资料或ima在线资料');
  const questions=preflight(raw);
  const mentionedScenes=instructionScenes(task.instructions);
  if(mentionedScenes.length>1||mentionedScenes.some(scene=>scene!==task.scene))questions.push('补充要求与所选场景不一致，请确认本次使用场景后重试');
  if(containsAssertion(raw.audience))questions.push('目标人群中包含产品声明，请只填写受众；产品能力需要知识库依据');
  if(containsAssertion(raw.objective||raw.goal))questions.push('内容目标中包含未经核实的产品声明，请改为到店、咨询、收藏分享或辅助比较');
  if(questions.length)return failure('need_info',null,{questions,trace:[{step:'需求理解',status:'需要补充输入'}]});
  const exact=catalog.resolveModel(task.product);
  if(!exact){const candidates=catalog.modelCandidates(task.product);return failure('need_info',null,{questions:[candidates.length?'请确认具体型号与版本，相近型号不能混用资料':'未找到该型号，请从产品列表选择具体版本'],candidates,trace:[{step:'型号确认',status:'需要确认'}]});}
  task.product=exact.name;
  const previous=projectPrevious(raw.previousResult,task),ordinal=ordinalRemoval(task.instructions);
  if(ordinal!==null&&!previous)return failure('need_info',null,{questions:['请先生成当前产品的文案，再指定要删除的第几个卖点'],trace:[{step:'修改要求',status:'需要上一稿'}]});
  task.writingPreferences=mergeWritingPreferences(task.instructions,previous?.writingPreferences);
  const trace=[{step:'需求理解',status:'完成',note:task.audience+' / '+task.scene+' / '+task.stage+' / '+task.objective}];
  let evidence;
  try{evidence=task.mode==='live'?await ima.imaEvidence(task.product):catalog.localEvidence(task.product);}
  catch(e){const quota=task.mode==='live'&&/220021|次数已达上限/.test(e.message);
    return failure('blocked',quota?'ima资料读取额度已达到平台上限（220021）。可以手动选择本地资料继续；在线模式不会自动替换数据源。':e.message,
      {sourceMode:task.mode,quotaLimited:quota,trace:[...trace,{step:'资料检索',status:'失败，已停止'}]});}
  if(evidence.error)return failure('blocked',evidence.error,{trace});
  if(evidence.model!==task.product)return failure('blocked','资料型号与当前产品不一致，已停止生成',{trace});
  const conflict=evidence.facts.some((f,index)=>evidence.facts.some((other,i)=>i!==index&&f.topic===other.topic&&f.quote!==other.quote));
  if(conflict)return failure('blocked','同一型号的资料存在冲突，请人工确认后重试',{trace});
  const removed=[];
  if(ordinal!==null){
    const priorFacts=previous.blocks.filter(b=>b.factRefs.length),target=priorFacts[ordinal-1];
    if(!target||target.factRefs.some(id=>!evidence.facts.some(f=>f.id===id)))return failure('need_info',null,{questions:['上一稿中没有可确认的对应卖点，请重新选择要删除的内容'],trace});
    removed.push(...target.factRefs);
  }
  trace.push({step:'知识库检索',status:'完成',note:evidence.facts.length+'条事实 / '+evidence.pictures.length+'张图片'});
  task.omittedTopics=[...new Set([...(previous?.omittedTopics||[]),...removed.map(id=>evidence.facts.find(f=>f.id===id)?.topic).filter(Boolean),
    ...signals.filter(([,rx])=>new RegExp('(?:删除|删掉|不要|去掉|移除).{0,5}(?:'+rx.source+')','i').test(task.instructions)).map(([topic])=>topic)])];
  const strategy=plan(task,evidence.facts,evidence.pictures,removed);
  trace.push({step:'文案组织',status:'完成',note:strategy.strategyExplanation});
  // Empty evidence must fail before any model or image calls.
  if(!strategy.selected.length){const copy=compose(task,strategy),result=audit(task,evidence,strategy,copy);return failure('blocked','没有可用于正文的产品事实，请保留至少一个有依据的卖点',{audit:result,trace});}
  await verifyPictures(strategy,evidence,trace);
  let copy=compose(task,strategy,null,previous),engine='基础写作 + 知识库事实',generationNotice;
  const llm=require('./llm');
  if(task.drafting!=='rules'&&llm.configured()){
    try{
      const proposal=await llm.generateScaffold(task,strategy);
      const candidate=llm.mergeScaffold(task,strategy,proposal,previous);
      if(audit(task,evidence,strategy,candidate).status==='blocked')throw Error('模型稿未通过事实核验');
      copy=candidate;engine='模型策划 + 证据填入（'+proposal.model+'）';
    }catch{
      generationNotice={message:'已使用基础写作生成',reason:'模型服务未返回可验证的完整稿件，已切换基础写作并重新核验'};
      trace.push({step:'语言模型',status:'已使用基础写作',note:generationNotice.reason});
    }
  }
  const result=audit(task,evidence,strategy,copy);
  trace.push({step:'图文生成',status:'完成',note:engine});trace.push({step:'事实与图片检查',status:result.status,note:result.issues.map(i=>i.message).join('；')});
  if(result.status==='blocked')return failure('blocked','事实或合规检查未通过，请调整需求后重试',{audit:result,trace});
  const usedIds=new Set(copy.blocks.flatMap(b=>b.factRefs||[]));
  const images=strategy.pictures.map(p=>{const index=copy.blocks.findIndex(b=>b.imageId===p.id);return {...p,localPath:undefined,
    position:index===1?'标题下方':'第'+(copy.blocks.slice(0,index).filter(b=>b.type==='text').length)+'段后',
    url:evidence.mode==='live'?'/api/ima-image?model='+encodeURIComponent(task.product)+'&mediaId='+encodeURIComponent(p.mediaId):'/api/local-image?model='+encodeURIComponent(task.product)+'&id='+encodeURIComponent(p.id)};});
  const status=result.status==='incomplete'?'incomplete':'ok';
  return {status,ok:status==='ok',needsInput:false,questions:[],candidates:[],mode:evidence.mode,kbName:evidence.kbName,warning:evidence.warning,
    task,scene:{audience:task.audience,scene:task.scene,pain:strategy.scene.pain,stage:task.stage,objective:task.objective,platform:task.platform},
    strategy:{explanation:strategy.strategyExplanation,priorities:strategy.priorities,platform:strategy.platform,
      selected:strategy.selected.filter(f=>usedIds.has(f.id)).map(f=>({id:f.id,topic:f.topic,score:f.score,rationale:f.rationale}))},
    facts:strategy.selected.filter(f=>usedIds.has(f.id)),images,generationEngine:engine,...(generationNotice?{generationNotice}:{}),copy,audit:result,trace,
    meta:{durationMs:Date.now()-start,generatedAt:new Date().toISOString(),traceVersion:'2.0'}};
}
module.exports={generateTask,normalizeTask,preflight,detectRisks,PLATFORMS,SCENES,STAGES,OBJECTIVES,plan,compose,audit,scaffoldOptions,renderFullText};
