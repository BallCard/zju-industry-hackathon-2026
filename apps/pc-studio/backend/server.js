'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {URL}=require('node:url');
// Credentials are loaded only into the server process; never served or logged.
const {loadCredentials}=require('./src/credentials');
try{loadCredentials();}catch(e){console.error('ima凭证配置失败：'+e.message);}
const {generateTask,SCENES,PLATFORMS,STAGES}=require('./src/agent');
const llm=require('./src/llm');
const {safeCatalog,localImageById,KB_ROOT}=require('./src/catalog');
const {credentialsPresent,connectionStatus,readVerifiedImage}=require('./src/ima');
// Keep the existing /public/* URLs while serving only the frontend directory.
const FRONTEND=path.join(__dirname,'../frontend');
const HOST=process.env.HOST||'127.0.0.1';
const PORT=Number(process.env.PORT||8765);
// Local development remains the default even when ima credentials exist.
const DEFAULT_DATA_MODE=process.env.DEFAULT_DATA_MODE==='live'?'live':'local';
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
function json(res,code,value){
  const text=JSON.stringify(value);res.writeHead(code,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(text);
}
async function body(req){
  let size=0,chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;if(size>256000)throw Error('请求内容过大');
    chunks.push(chunk);
  }
  let value;
  try {value=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
  catch {const error=Error('请求格式不正确，请重新提交');error.httpStatus=400;throw error;}
  if(!value||typeof value!=='object'||Array.isArray(value)){
    const error=Error('请提交一个包含写作需求的对象');error.httpStatus=400;throw error;
  }
  return value;
}
function file(res,filename){
  const ext=path.extname(filename).toLowerCase();
  if(!MIME[ext])return json(res,404,{error:'不支持文件类型'});
  fs.readFile(filename,(error,data)=>{
    if(error)return json(res,404,{error:'文件不存在'});
    res.writeHead(200,{'Content-Type':MIME[ext], 'Content-Security-Policy':
    "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'",
    'X-Content-Type-Options':'nosniff'});res.end(data);
  });
}
function handler(req,res){
  (async()=>{
    const u=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&u.pathname==='/api/health')return json(res,200,{
      ok:true,version:'1.2.0',localKbAvailable:fs.existsSync(KB_ROOT),
      localModelCount:safeCatalog().length,imaConfigured:credentialsPresent(),defaultMode:DEFAULT_DATA_MODE});
    if(req.method==='GET'&&u.pathname==='/api/options')return json(res,200,{
      models:safeCatalog(),scenes:Object.keys(SCENES),platforms:Object.keys(PLATFORMS),stages:STAGES,
      liveConfigured:credentialsPresent(),defaultMode:DEFAULT_DATA_MODE,
      objectives:['引导到店体验','引导咨询','鼓励收藏分享','辅助比较'],
      inputUnderstanding:{llmConfigured:llm.configured(),method:llm.configured()?'llm':'local',
        notice:llm.configured()?'已启用大模型需求理解；型号与推荐依据仍由知识库校验。':'未配置大模型，当前使用本地需求解析与知识库推荐。'},
      sourcePolicy:'local用于研发，live仅使用指定ima共享知识库；互不伪装或自动混用'});
    if(req.method==='GET'&&u.pathname==='/api/ima-check')return json(res,200,await connectionStatus());
    if(req.method==='POST'&&u.pathname==='/api/generate')return json(res,200,await generateTask(await body(req)));
    if(req.method==='POST'&&u.pathname==='/api/compare'){
      const data=await body(req);const base=data.task||{};
      const first=await generateTask({...base,...(data.first||{})});
      const second=await generateTask({...base,...(data.second||{})});
      return json(res,200,{ok:first.ok&&second.ok,first,second,
        changed:{scene:first.scene?.scene!==second.scene?.scene,
          platform:first.scene?.platform!==second.scene?.platform,
          titles:first.copy?.title!==second.copy?.title,
          topFact:first.facts?.[0]?.topic!==second.facts?.[0]?.topic,
          imageCount:first.images?.length!==second.images?.length}});
    }
    if(req.method==='GET'&&u.pathname==='/api/local-image'){
      const found=localImageById(u.searchParams.get('model'),u.searchParams.get('id'));
      if(!found)return json(res,404,{error:'图片不存在或型号不匹配'});
      return file(res,found);
    }
    if(req.method==='GET'&&u.pathname==='/api/ima-image'){
      const model=u.searchParams.get('model')||'',mediaId=u.searchParams.get('mediaId')||'';
      if(model.length>150||mediaId.length>300)return json(res,400,{error:'资源参数不合法'});
      const img=await readVerifiedImage(model,mediaId);
      res.writeHead(200,{'Content-Type':img.mime,'Cache-Control':'private,max-age=90',
        'X-Content-Type-Options':'nosniff'});
      return res.end(img.bytes);
    }
    if(req.method==='GET'&&(u.pathname==='/'||u.pathname.startsWith('/public/'))) {
      const rel=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice('/public/'.length));
      const candidate=path.resolve(FRONTEND,rel);
      if(candidate!==path.join(FRONTEND,'index.html')&&!candidate.startsWith(FRONTEND+path.sep))
        return json(res,403,{error:'拒绝访问'});
      return file(res,candidate);
    }
    return json(res,404,{error:'未找到路由'});
  })().catch(e=>{
    const code=e.httpStatus||(e.message==='请求内容过大'?413:500);
    return json(res,code,{status:'blocked',ok:false,needsInput:false,
      error:code<500?e.message:'服务暂时未能完成，请稍后重试',trace:[]});
  });
}
const server=http.createServer(handler);
if(require.main===module){
  server.on('error',error=>{
    console.error(error.code==='EADDRINUSE'?'端口 '+PORT+' 已被占用，请停止旧服务或更换 PORT。':'服务启动失败：'+error.message);
    process.exitCode=1;
  });
  server.listen(PORT,HOST,()=>console.log('PC Studio listening on http://'+HOST+':'+PORT));
}
module.exports={server};
