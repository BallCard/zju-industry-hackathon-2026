'use strict';
const fs=require('node:fs');
const path=require('node:path');
function findCredentialFile() {
  let base=__dirname;
  while (true) {
    const candidate=path.join(base,'ima_skill','ima.txt');
    if(fs.existsSync(candidate))return candidate;
    const parent=path.dirname(base);
    if(parent===base)break;
    base=parent;
  }
  return path.resolve(__dirname,'../../ima_skill/ima.txt');
}
const DEFAULT=findCredentialFile();
function clean(x){return String(x||'').trim().replace(/^["']/,'').replace(/["']$/,'').trim();}
function parseCredentials(raw){
  const lines=String(raw||'').replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  let clientid='',apikey='';
  function valueFrom(line){const m=line.match(/[:：=]\s*(.*)$/);return clean(m?.[1]||'');}
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(/(?:api[\s_-]*key|apikey|接口密钥|API密钥)/i.test(line)){
      const v=valueFrom(line);apikey=v||clean(lines[i+1]||'');
    }else if(/(?:client[\s_-]*id|clientid|客户端标识|客户端ID)/i.test(line)){
      const v=valueFrom(line);clientid=v||clean(lines[i+1]||'');
    }
  }
  if(!clientid||!apikey) {
    // Accept standard two-line env-style files only if both are clearly labeled.
    throw Error('ima.txt 需要包含 Client ID 与 API Key 的明确标签和对应值');
  }
  if(!/^[\x21-\x7E]{8,250}$/.test(clientid)||!/^[\x21-\x7E]{12,250}$/.test(apikey))
    throw Error('ima.txt 字段格式不符合预期：已拒绝加载，未输出任何凭证内容');
  return {clientid,apikey};
}
function loadCredentials(){
  if(process.env.IMA_OPENAPI_CLIENTID&&process.env.IMA_OPENAPI_APIKEY)return {ok:true,method:'environment'};
  const filename=process.env.IMA_CREDENTIALS_FILE||DEFAULT;
  if(!fs.existsSync(filename))return {ok:false,method:'not-configured'};
  const stat=fs.statSync(filename);if(!stat.isFile()||stat.size>16384)throw Error('凭证文件不存在或超出允许大小');
  const parsed=parseCredentials(fs.readFileSync(filename,'utf8'));
  if(!process.env.IMA_OPENAPI_CLIENTID)process.env.IMA_OPENAPI_CLIENTID=parsed.clientid;
  if(!process.env.IMA_OPENAPI_APIKEY)process.env.IMA_OPENAPI_APIKEY=parsed.apikey;
  return {ok:true,method:'local-private-file'};
}
module.exports={loadCredentials,parseCredentials};
