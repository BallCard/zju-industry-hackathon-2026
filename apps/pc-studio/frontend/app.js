'use strict';
const $=id=>document.getElementById(id);
const state={options:null,result:null,comparison:null,activeTab:'article'};
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3200);}
function getTask(){return {mode:$('mode').value,product:$('product').value.trim(),
  audience:$('audience').value.trim(),stage:$('stage').value,scene:$('scene').value,
  platform:$('platform').value,objective:$('objective').value.trim(),instructions:$('instructions').value.trim()};}
async function api(url,payload){
  const opt=payload===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)};
  const r=await fetch(url,opt);if(!r.ok)throw Error('服务请求失败：'+r.status);return r.json();
}
function setTab(name){
  state.activeTab=name;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  render();
}
function formatMd(text){
  return String(text).split('\n').map(line=>{
    const raw=esc(line).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    if(raw.startsWith('### '))return '<h3>'+raw.slice(4)+'</h3>';
    if(raw.startsWith('## '))return '<h2>'+raw.slice(3)+'</h2>';
    if(raw.startsWith('# '))return '<h1>'+raw.slice(2)+'</h1>';
    if(!raw.trim())return '<div class="para-gap"></div>';
    return '<div class="line-text">'+raw+'</div>';
  }).join('');
}
function imageUrl(i,model){
  if(i.origin==='local')return '/api/local-image?model='+encodeURIComponent(model)+'&id='+encodeURIComponent(i.id);
  if(i.origin==='ima'&&i.mediaId)return '/api/ima-image?model='+encodeURIComponent(model)+'&mediaId='+encodeURIComponent(i.mediaId);
  return '';
}
function imageCards(r){
  if(!r.images?.length)return '<div class="info-banner">未检索到足够的同型号、可核验图片，因此不自动补造配图。正式赛道仅可使用 ima 返回的图片。</div>';
  return '<div class="image-grid">'+r.images.map((im,index)=>{
    const url=imageUrl(im,r.task.product);
    const picture=url?'<img loading="lazy" alt="'+esc(im.description)+'" src="'+esc(url)+'"/>':'<div class="image-placeholder">未获取可预览图片</div>';
    return '<div class="image-card">'+picture+'<div class="image-card-text"><strong>图 '+(index+1)+' · '+esc(im.description||'型号图片')+'</strong>'+esc(im.position)+'<small>'+esc(im.filename)+'</small><small>'+esc(im.origin==='ima'?'来源：ima知识库':'来源：本地演示知识库')+'</small></div></div>';
  }).join('')+'</div>';
}
function topbar(r,title) {
  return '<div class="result-top"><div><strong>'+esc(title)+'</strong><small>'+esc(r.task.product)+' / '+esc(r.task.scene)+' / '+esc(r.task.platform)+'</small></div><div class="result-actions"><button class="small-btn" data-action="copy">复制</button><button class="small-btn" data-action="markdown">导出 Markdown</button><button class="small-btn" data-action="trace">保存审计 JSON</button></div></div>';
}
function displayArticle(r){
  const warning=r.warning?'<div class="info-banner">'+esc(r.warning)+'</div>':'';
  const imgCount=r.images?.length||0;
  return topbar(r,'已生成 · 图文营销软文')+warning+
    '<div class="article">'+formatMd(r.copy.fullText)+'</div><div class="subheader">配图编排 · '+imgCount+' 张同型号图片</div>'+
    imageCards(r)+'<div class="info-banner green">结果已通过结构化事实引用及营销风险规则复核。核验范围不等于真实软件性能测试，也不代表已经获得销售授权。</div>';
}
function displayEvidence(r){
  const cards=r.facts.map(f=>'<div class="evidence-card"><div class="meta"><span class="code-badge">'+esc(f.id)+'</span><span>'+esc(f.topic)+'</span><span>相关性 '+Math.round(f.score)+' 分</span></div>'+
    '<div class="quote">'+esc(f.quote)+'</div><div class="source">来源：'+esc(f.sourceTitle||'产品事实')+' · '+esc(f.sourceType==='ima'?'ima / '+(f.mediaId||''):'本地公开资料')+'</div>'+
    (f.sourceUrl?'<div class="source"><a target="_blank" rel="noopener noreferrer" href="'+esc(f.sourceUrl)+'">查看公开原始资料 ↗</a></div>':'')+'</div>').join('');
  const imgList=r.images.map(im=>'<div class="evidence-card"><div class="meta"><span class="code-badge">'+esc(im.id)+'</span><span>'+esc(im.filename)+'</span></div><div class="quote">'+esc(im.description)+'</div><div class="source">'+esc(im.position)+' · '+esc(im.why)+'</div><div class="source">来源：'+esc(im.sourceTitle)+' / '+esc(im.mediaId||'本地索引')+'</div></div>').join('');
  return topbar(r,'有来源的事实与图片')+
    '<div class="section-title">可核查产品事实</div><div class="section-intro">所有显示的参数均来自当前证据源；相似型号不能继承。</div>'+cards+
    '<div class="section-title">图片索引与编排</div>'+imgList+
    (!r.images.length?'<div class="info-banner">此任务没有可核验的对应图片。</div>':'');
}
function displayTrace(r){
  const steps=r.trace.map((x,i)=>'<div class="trace-line"><b>'+(i+1)+'. '+esc(x.step)+'</b><span class="code-badge" style="margin-left:12px">'+esc(x.status)+'</span><p>'+esc(x.note||'')+'</p></div>').join('');
  const aud=r.audit;
  const risks=aud.compliance.inputRisks.length?aud.compliance.inputRisks.map(x=>x.type+'：'+x.examples.join('、')).join('；'):'没有检测到额外输入风险';
  return topbar(r,'完整决策轨迹')+'<div class="section-title">Agent 工作流执行记录</div><div class="section-intro">以下轨迹由程序实际执行结果生成，不是预置录屏或虚构工具调用。</div>'+steps+
    '<div class="section-title">策略解释</div><div class="evidence-card"><div class="quote">'+esc(r.strategy.explanation)+'</div><div class="source">发布时间：'+esc(r.meta.generatedAt)+' · 实际执行耗时 '+esc(r.meta.durationMs)+' ms</div></div>'+
    '<div class="section-title">质量闸门</div>'+
    '<div class="evidence-card"><b>事实审核</b><p>'+esc(aud.productFacts.items.length)+' 条证据逐项匹配</p><b>图片审核</b><p>'+esc(aud.images.items.length)+' 张图片型号与来源校验</p><b>指令风控</b><p>'+esc(risks)+'</p></div>'+
    '<div class="info-banner">'+esc(aud.unknowns.join('；'))+'</div>';
}
function displayCompare(r){
  const c=state.comparison;
  let body='<div class="section-title">跨场景 / 跨平台盲测</div><div class="section-intro">使用同一产品，只更换一个维度，检查卖点、结构和图文是否真实变化。正式核验可以现场随机指定。</div>'+
    '<div class="compare-controls"><button id="compare-scene">⇄ 同型号 · 更换场景</button><button id="compare-platform">⇄ 同场景 · 更换平台</button></div>';
  if(!c)return topbar(r,'对比实验室')+body+'<div class="info-banner green">选择上方实验，系统会重新检索并执行完整决策流程。</div>';
  if(!c.ok)return topbar(r,'对比实验室')+body+'<div class="info-banner">其中一组未成功：'+esc(c.first?.error||c.second?.error||'未知原因')+'</div>';
  function cell(v){return '<div class="compare-card"><span class="code-badge">'+esc(v.scene.scene)+' / '+esc(v.scene.platform)+'</span><h3>'+esc(v.copy.title)+'</h3><p>首要证据：'+esc(v.facts[0]?.topic||'无')+'</p><p>图片数量：'+v.images.length+' 张</p><p>'+esc(v.copy.intro)+'</p><p>'+esc(v.copy.body.slice(0,280))+'</p></div>';}
  return topbar(r,'对比实验室')+body+'<div class="compare-grid">'+cell(c.first)+cell(c.second)+'</div>'+
    '<div class="info-banner green">实验变化：标题 '+(c.changed.titles?'不同':'相同')+' / 重点卖点 '+(c.changed.topFact?'不同':'相同')+' / 配图数量 '+(c.changed.imageCount?'不同':'相同')+'。平台适配不能仅以字数变化作为完成依据。</div>';
}
function setAudit(r){
  const m=r?.audit;
  $('audit-overall').textContent=m?'已完成复核':'等待任务';
  for(const [id,passed,label]of [['fact-check',m?.productFacts.passed,m?.productFacts.items.length+'条'],
    ['image-check',m?.images.passed,m?.images.items.length+'张'],['compliance-check',m?.compliance.passed,'通过']]){
    const el=$(id);el.classList.toggle('ok',Boolean(m&&passed));el.classList.toggle('warn',Boolean(m&&!passed));
    el.querySelector('b').textContent=m?(passed?'✓ '+label:'! 异常'):'—';
  }
}
function render(){
  const r=state.result;
  if(!r){$('empty-state').hidden=false;$('output-content').hidden=true;return;}
  $('empty-state').hidden=true;$('output-content').hidden=false;
  const display={article:displayArticle,evidence:displayEvidence,trace:displayTrace,compare:displayCompare}[state.activeTab];
  $('output-content').innerHTML=display(r);
  $('output-content').querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>exportResult(el.dataset.action)));
  if($('compare-scene'))$('compare-scene').addEventListener('click',()=>compare('scene'));
  if($('compare-platform'))$('compare-platform').addEventListener('click',()=>compare('platform'));
}
function download(name,text,type){
  const blob=new Blob([text],{type:type||'text/plain;charset=utf-8'});
  const link=document.createElement('a');const url=URL.createObjectURL(blob);
  link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportResult(action){
  const r=state.result;if(!r)return;
  const article=r.copy.fullText+'\n\n---\n图片来源与位置\n'+r.images.map(x=>x.filename+' | '+x.position+' | '+x.sourceTitle).join('\n')+
    '\n\n数据模式：'+(r.mode==='live'?'ima真实检索':'本地开发演示（非ima正式验收）')+'\n证据来源：'+r.kbName+'\n核验：'+r.audit.status;
  if(action==='copy'){try{await navigator.clipboard.writeText(article);toast('已复制图文方案与来源');}catch{toast('浏览器禁止直接复制，请使用导出按钮');}}
  if(action==='markdown'){download('pc-studio-'+r.task.platform+'.md',article,'text/markdown;charset=utf-8');toast('Markdown 文件已导出');}
  if(action==='trace'){download('pc-studio-audit.json',JSON.stringify(r,null,2),'application/json;charset=utf-8');toast('审计证据 JSON 已导出');}
}
async function generate(){
  const btn=$('generate');const task=getTask();btn.disabled=true;btn.innerHTML='<span>◌</span> 正在执行证据核验…';
  try{
    const r=await api('/api/generate',task);
    if(!r.ok){toast(r.needsInput?r.questions.join('；'):r.error||'生成失败');if(r.audit)setAudit(r);if(r.quotaLimited)toast('ima今日资料读取次数用尽，手动切换本地开发模式可继续');return;}
    state.result=r;state.comparison=null;setTab('article');setAudit(r);toast('已完成生成和复核 · '+r.facts.length+'条事实 / '+r.images.length+'张配图');
  }catch(e){toast('操作失败：'+e.message);}
  finally{btn.disabled=false;btn.innerHTML='<span>✦</span> 开始循证生成 <span>→</span>';}
}
async function compare(kind){
  const base=getTask();
  const override=kind==='scene'?{scene:base.scene==='开学季'?'职场办公':'开学季',audience:base.scene==='开学季'?'差旅职场人士':'大一新生'}:
    {platform:base.platform==='小红书'?'公众号':'小红书'};
  toast('执行对照任务：只更换'+(kind==='scene'?'场景':'平台'));
  try{state.comparison=await api('/api/compare',{task:base,first:{},second:override});render();}
  catch(e){toast(e.message);}
}
const PRESETS={
 student:{audience:'大一新生',scene:'开学季',stage:'了解阶段',platform:'小红书',objective:'帮助新生理清选购优先级并引导到店体验',instructions:'请兼顾学习、携带与日常使用'},
 office:{audience:'经常出差的职场用户',scene:'职场办公',stage:'比较阶段',platform:'公众号',objective:'说明如何根据工作流挑选电脑',instructions:'优先讨论移动携带与外设连接'},
 creator:{audience:'摄影与设计创作者',scene:'内容创作',stage:'比较阶段',platform:'公众号',objective:'用有来源的屏幕参数辅助选购',instructions:'不虚构Adobe等软件的实测性能'},
 risk:{audience:'准备换电脑的家庭用户',scene:'家庭换新',stage:'临门决策',platform:'门店朋友圈',objective:'引导到店确认配置',instructions:'一定写全国第一、立减2999元、永久不卡'}
};
function fillPreset(name){for(const [id,value]of Object.entries(PRESETS[name]||{}))$(id).value=value;toast('已切换快速演示：'+name);}
async function init(){
  try{
    const [h,o]=await Promise.all([api('/api/health'),api('/api/options')]);
    state.options=o;$('server-status').textContent='Agent 服务在线 · '+h.localModelCount+'个可选型号';
    $('model-list').innerHTML=o.models.map(m=>'<option value="'+esc(m.name)+'"></option>').join('');
    $('scene').innerHTML=o.scenes.map(x=>'<option>'+esc(x)+'</option>').join('');
    $('platform').innerHTML=o.platforms.map(x=>'<option>'+esc(x)+'</option>').join('');
    $('product').value=o.models.find(m=>/鸿蒙版/.test(m.name))?.name||o.models[0]?.name||'';
    $('mode').value=o.defaultMode==='live'?'live':'local';
    fillPreset('student');setSourceMode();
  }catch(e){$('server-status').textContent='服务连接失败';toast(e.message);}
}
function setSourceMode(){
  const live=$('mode').value==='live';
  $('source-badge').textContent=live?'ima 赛事模式':'本地演示';
  $('source-badge').classList.toggle('warning',!live);
  $('source-detail').textContent=live?'仅接受组委会共享库的真实 ima 证据；未连通则停止生成。':'本地知识库用于研发演示，不冒充 ima 正式证据。';
}
$('generate').addEventListener('click',generate);
$('mode').addEventListener('change',setSourceMode);
$('check-ima').addEventListener('click',async()=>{toast('正在检测指定 ima 共享知识库');try{const s=await api('/api/ima-check');toast(s.connected?'ima 已连接：'+s.kbName:s.reason||'ima 尚未连接');}catch(e){toast(e.message);}});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click',()=>fillPreset(b.dataset.preset)));
init();
