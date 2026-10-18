'use strict';
// All facts and images in this fixture are synthetic and are not product claims.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {once}=require('node:events');
let scratch,server,origin;
const saved=new Map();
const product='HUAWEI MateBook 14（鸿蒙版）';
const scarce='HUAWEI MateBook Pro';
const base={product,audience:'大学新生',platform:'小红书',drafting:'rules',mode:'local'};

before(async()=>{
  scratch=fs.mkdtempSync(path.join(os.tmpdir(),'pc-workbench-http-'));
  for(const [name,count] of [[product,4],[scarce,1]]){
    const directory=path.join(scratch,'P1-产品参数库','01-鸿蒙电脑',name);
    fs.mkdirSync(path.join(directory,'images'),{recursive:true});
    fs.writeFileSync(path.join(directory,'产品事实.md'),'# '+name+' - 产品事实\n\n## 操作系统\n合成测试系统字段\n\n## 屏幕\n尺寸\n合成测试尺寸字段\n类型\n合成测试类型字段\n分辨率\n合成测试分辨率字段\n\n## 内存\n合成测试内存字段\n');
    const rows=['文件名,产品型号,来源页面,原始图片URL,官网图片说明,宽度,高度,建议用途'];
    for(let i=0;i<count;i++){
      const filename='fixture-'+i+'.png';
      rows.push([filename,name,'https://example.com/fixture','','合成测试主视觉',1,1,'测试'].join(','));
      fs.writeFileSync(path.join(directory,'images',filename),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6S9sAAAAASUVORK5CYII=','base64'));
    }
    fs.writeFileSync(path.join(directory,'图片索引.csv'),rows.join('\n'));
  }
  const overrides={LOCAL_KB_ROOT:scratch,IMA_CREDENTIALS_FILE:path.join(scratch,'missing.txt'),
    IMA_OPENAPI_CLIENTID:'',IMA_OPENAPI_APIKEY:'',LLM_API_KEY:'',OPENAI_API_KEY:'',LLM_MODEL:'',DEFAULT_DATA_MODE:'local'};
  for(const [key,value] of Object.entries(overrides)){saved.set(key,process.env[key]);process.env[key]=value;}
  ({server}=require('../backend/server'));
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  origin='http://127.0.0.1:'+server.address().port;
});

after(async()=>{
  try{
    if(server?.listening){const closed=once(server,'close');server.close();server.closeAllConnections();await closed;}
  }finally{
    for(const [key,value] of saved){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    if(scratch)fs.rmSync(scratch,{recursive:true,force:true});
  }
});
const post=async(value,route='/api/generate')=>(await fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)})).json();

test('simplified request returns ordered, readable, source-bound output',async()=>{
  const result=await post(base);
  assert.equal(result.status,'ok',result.error);
  assert.equal(result.ok,true);
  assert.ok(result.copy.blocks.some(block=>block.type==='image'));
  assert.ok(result.copy.blocks.some(block=>block.factRefs?.length));
  for(const block of result.copy.blocks){
    for(const id of block.factRefs||[])assert.ok(result.facts.some(fact=>fact.id===id));
    if(block.type==='image')assert.ok(result.images.some(image=>image.id===block.imageId));
  }
  const image=result.images[0];
  const response=await fetch(origin+'/api/local-image?model='+encodeURIComponent(product)+'&id='+encodeURIComponent(image.id));
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/^image\//);
  assert.ok((await response.arrayBuffer()).byteLength>0);
  assert.equal(JSON.stringify(result).includes('localPath'),false);
});

test('insufficient images return a usable incomplete draft',async()=>{
  const result=await post({...base,product:scarce});
  assert.equal(result.status,'incomplete',result.error);
  assert.equal(result.ok,false);
  assert.ok(result.copy.fullText.length>0);
  assert.equal(result.images.length,1);
  assert.ok(result.audit.images.missing>0);
});

test('ambiguity and empty input return follow-up without publishing',async()=>{
  const result=await post({...base,product:'MateBook'});
  assert.equal(result.status,'need_info');
  assert.equal(result.needsInput,true);
  assert.ok(result.candidates.length>=2);
  const empty=await post({});
  assert.equal(empty.status,'need_info');
  assert.equal(empty.ok,false);
});

test('compact revisions do not echo recursive history or trust the old audit',async()=>{
  const first=await post(base);
  const result=await post({...base,instructions:'短一点',previousResult:{
    task:first.task,copy:{blocks:first.copy.blocks},audit:{status:'passed'},
    previousResult:{task:{product:'untrusted'}}
  }});
  assert.equal(result.status,'ok',result.error);
  assert.ok(result.copy.fullText.length<first.copy.fullText.length);
  assert.equal(Object.hasOwn(result.task,'previousResult'),false);
});

test('compare exposes the status and draft of each side',async()=>{
  const result=await post({task:base,first:{},second:{product:scarce}},'/api/compare');
  assert.equal(result.ok,false);
  assert.equal(result.first.status,'ok');
  assert.equal(result.second.status,'incomplete');
  assert.ok(result.second.copy.fullText);
});

test('malformed JSON, null, arrays and oversized requests return actionable errors',async()=>{
  for(const [body,status] of [['{',400],['null',400],['[]',400],['"'+ 'x'.repeat(260000)+'"',413]]){
    const response=await fetch(origin+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body});
    assert.equal(response.status,status);
    const result=await response.json();
    assert.equal(result.status,'blocked');
    assert.equal(result.ok,false);
    assert.ok(result.error.length>0);
  }
});
