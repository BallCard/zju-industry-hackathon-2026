'use strict';
const {csvRows,extractFacts,resolveModel}=require('./catalog');
const DEFAULT_KB='任德耀新建华为PC知识库';
const BASE=(process.env.IMA_API_BASE||'https://ima.qq.com').replace(/\/$/,'');
const KB_NAME=process.env.IMA_KB_NAME||DEFAULT_KB;
const IMAGE_CACHE=new Map();
const credentialsPresent=()=>Boolean(process.env.IMA_OPENAPI_CLIENTID&&process.env.IMA_OPENAPI_APIKEY);
const normalize=s=>String(s||'').toLowerCase().replace(/[\s（）()··\-—_]/g,'');
const imgRegex=/\.(png|jpg|jpeg|webp)$/i;
const allowedCalls=new Set(['search_knowledge_base','get_knowledge_list','search_knowledge','get_media_info','get_knowledge_base']);
async function request(endpoint,payload){
  if(!credentialsPresent())throw Error('未配置 ima 接口凭证（Client ID 与 API Key）');
  if(!allowedCalls.has(endpoint))throw Error('拒绝调用非白名单ima接口');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetch(BASE+'/openapi/wiki/v1/'+endpoint,{method:'POST',
      signal:controller.signal,redirect:'error',
      headers:{'content-type':'application/json',
        'ima-openapi-clientid':process.env.IMA_OPENAPI_CLIENTID,
        'ima-openapi-apikey':process.env.IMA_OPENAPI_APIKEY},
      body:JSON.stringify(payload)});
    if(!res.ok)throw Error('ima接口 '+endpoint+' HTTP '+res.status);
    const j=await res.json();
    if(j.code!==undefined&&Number(j.code)!==0)
      throw Error('ima接口 '+endpoint+' 返回错误码 '+Number(j.code));
    return j.data||j;
  }finally{clearTimeout(timer);}
}
async function discoverKB(){
  if(process.env.IMA_KB_ID)return {id:process.env.IMA_KB_ID,name:KB_NAME,source:'configured-id'};
  const data=await request('search_knowledge_base',{query:KB_NAME,cursor:'',limit:20});
  const row=(data.info_list||[]).find(x=>(x.kb_name||x.name)===KB_NAME);
  if(!row||!(row.kb_id||row.id))
    throw Error('当前账号找不到赛题指定共享知识库；需要使用加入该库的同一账号获取凭证');
  return {id:row.kb_id||row.id,name:row.kb_name||row.name,source:'ima-search'};
}
async function children(kbId,folderId){
  const all=[];let cursor='';let pages=0;
  do{
    const body={knowledge_base_id:kbId,cursor,limit:50};
    if(folderId)body.folder_id=folderId;
    const data=await request('get_knowledge_list',body);
    all.push(...(data.knowledge_list||[]));cursor=data.next_cursor||'';pages++;
    if(data.is_end!==false)break;
  }while(cursor&&pages<20);
  return all;
}
async function targetFolder(kb,model){
  const known=resolveModel(model);
  if(!known)throw Error('请输入准确型号与系统版本，不能从名称相近产品推断参数。');
  const paths=[kb.name,'P1-产品参数库',known.system,known.folder];
  let folderId=null;
  const visited=[];
  for(const segment of paths){
    const result=await children(kb.id,folderId);
    const matched=result.find(x=>x.title===segment && (x.media_type===99||String(x.media_id||'').startsWith('folder_')));
    if(!matched)throw Error('ima指定共享库未找到准确产品目录：'+segment);
    folderId=matched.media_id;visited.push(segment);
  }
  return {id:folderId,path:visited,known};
}
function safeURL(input){
  let u;try{u=new URL(input);}catch{throw Error('ima媒体资源地址不合法');}
  if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('ima媒体地址不符合安全约束');
  const host=u.hostname.toLowerCase();
  if(host!=='ima.qq.com'&&host!=='mp.weixin.qq.com'&&!host.endsWith('.myqcloud.com'))
    throw Error('ima媒体地址不属于允许的来源域名');
  return u;
}
async function getMediaBytes(mediaId,expected='text'){
  const info=await request('get_media_info',{media_id:mediaId});
  if(!info.url_info?.url)throw Error('ima媒体未返回可读取的原文URL');
  const u=safeURL(info.url_info.url);
  const headers={};
  for(const [name,value] of Object.entries(info.url_info.headers||{}))
    if(/^[A-Za-z0-9-]+$/.test(name)&&typeof value==='string')headers[name]=value;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const res=await fetch(u,{headers,signal:controller.signal,redirect:'error'});
    if(!res.ok)throw Error('ima媒体读取 HTTP '+res.status);
    const mime=(res.headers.get('content-type')||'').split(';')[0].toLowerCase();
    if(expected==='image'&&!/^image\/(png|jpeg|webp)$/.test(mime))
      throw Error('ima媒体并非允许的产品图片');
    if(expected==='text'&&!/^(text\/(plain|markdown|csv)|application\/(json|octet-stream))$/.test(mime))
      throw Error('ima媒体不是可读取的文本事实');
    const sizeLimit=expected==='image'?12*1024*1024:4*1024*1024;
    const bytes=Buffer.from(await res.arrayBuffer());
    if(bytes.length>sizeLimit)throw Error('ima媒体超过读取大小上限');
    return {bytes,mime};
  }finally{clearTimeout(timer);}
}
async function mediaText(id){return (await getMediaBytes(id,'text')).bytes.toString('utf8').replace(/^\uFEFF/,'');}
function readIndex(csv,expectedModel){
  const rows=csvRows(csv);
  return rows.filter(row=>(!row['产品型号']||row['产品型号']===expectedModel)&&row['文件名']&&imgRegex.test(row['文件名']))
    .map(row=>({filename:row['文件名'],description:row['官网图片说明']||row['画面说明']||'华为PC产品图片',
      sourceUrl:row['来源页面']||row['商品页URL']||'',model:expectedModel,
      width:Number(row['宽度']||0),height:Number(row['高度']||0)}));
}
async function imaEvidence(model){
  const kb=await discoverKB();
  const folder=await targetFolder(kb,model);
  const direct=await children(kb.id,folder.id);
  const fact=direct.find(x=>x.title==='产品事实.md'&&x.media_type!==99);
  const imageIndex=direct.find(x=>x.title==='图片索引.csv'&&x.media_type!==99);
  if(!fact)throw Error('该产品的ima目录没有产品事实.md，禁止改用无依据内容');
  let md;
  try{md=await mediaText(fact.media_id);}catch(e){throw Error('ima产品事实读取失败：'+e.message);}
  const title=md.split(/\r?\n/)[0].replace(/^#\s*/,'').replace(/\s*-\s*产品事实\s*$/,'').trim();
  if(normalize(title)!==normalize(model))
    throw Error('ima产品事实文档的型号标题与请求型号不一致；已停止生成');
  const facts=extractFacts(md,model,'','ima://'+fact.media_id)
    .map((f,i)=>({...f,id:'F'+String(i+1).padStart(2,'0'),
      sourceType:'ima',sourceTitle:folder.path.slice(-1)[0]+'/产品事实.md',mediaId:fact.media_id}));
  if(!facts.length)throw Error('ima文档不包含可验证的结构化事实');
  let directIndexes=[];
  if(imageIndex){try{directIndexes=readIndex(await mediaText(imageIndex.media_id),model);}catch(e){/* optional image index unavailable; use verified subfolder indexes */}}
  const pics=[];
  const sources=[];
  const subfolders=direct.filter(x=>x.media_type===99&&(x.title==='images'||x.title==='商城款式图片'));
  for(const dir of subfolders){
    const files=await children(kb.id,dir.media_id);
    const subIndex=files.find(x=>x.title==='图片索引.csv');
    const indexes=[...directIndexes];let verifiedSubIndex=null;
    if(subIndex){
      try{indexes.push(...readIndex(await mediaText(subIndex.media_id),model));
        verifiedSubIndex=subIndex;
        sources.push({title:subIndex.title,mediaId:subIndex.media_id,type:'image-index'});
      }catch(e){/* do not use a missing or unreadable index */}
    }
    for(const img of files){
      if(!imgRegex.test(img.title||'')||img.media_type===99)continue;
      const record=indexes.find(x=>x.filename===img.title);
      if(!record)continue;
      if(pics.some(p=>p.filename===record.filename))continue;
      const pic={...record,id:'I'+String(pics.length+1).padStart(2,'0'),
        origin:'ima',mediaId:img.media_id,
        sourceTitle:folder.path.join('/')+'/'+dir.title+'/'+img.title,
        imageIndexMediaId:(verifiedSubIndex||(directIndexes.length?imageIndex:null))?.media_id||'',
        originalUrl:'',localPath:undefined};
      pics.push(pic);
      IMAGE_CACHE.set(model+'|'+img.media_id,{model,filename:img.title});
    }
  }
  return {mode:'live',model,kbName:kb.name,kbDiscoveredBy:kb.source,
    facts,pictures:pics,retrieved:[{title:'产品事实.md',mediaId:fact.media_id,type:'facts'},...sources],
    warning:pics.length?'':'目前ima中未匹配到此型号的可核查图片文件，无法按平台要求配齐图片。'};
}
async function readVerifiedImage(model,mediaId){
  if(!IMAGE_CACHE.has(model+'|'+mediaId))throw Error('图片尚未经过该型号的ima索引与目录校验');
  const result=await getMediaBytes(mediaId,'image');
  return {bytes:result.bytes,mime:result.mime};
}
async function connectionStatus(){
  if(!credentialsPresent())return {configured:false,connected:false,kbName:KB_NAME,reason:'未配置ima凭证'};
  try{const kb=await discoverKB();return {configured:true,connected:true,kbName:kb.name,discovery:kb.source,
    mediaQuota:'unchecked',note:'知识库可找到；此检查不读取资料，不代表get_media_info额度已经恢复'};}
  catch(e){return {configured:true,connected:false,kbName:KB_NAME,reason:e.message};}
}
module.exports={credentialsPresent,discoverKB,imaEvidence,connectionStatus,request,readVerifiedImage};
