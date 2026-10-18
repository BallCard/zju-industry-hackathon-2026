'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {once}=require('node:events');
const APP=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(APP,'data/models.json'),'utf8'));
const savedEnv=new Map();
const originalCwd=process.cwd();
let server,origin,scratch;

before(async()=>{
  scratch=fs.mkdtempSync(path.join(os.tmpdir(),'pc-studio-http-'));
  // Exercise an explicitly missing KB and credentials, from an unrelated cwd.
  const overrides={
    LOCAL_KB_ROOT:path.join(scratch,'missing-kb'),
    IMA_CREDENTIALS_FILE:path.join(scratch,'missing-credentials.txt'),
    IMA_OPENAPI_CLIENTID:'',
    IMA_OPENAPI_APIKEY:'',
    DEFAULT_DATA_MODE:'local'
  };
  for(const [key,value] of Object.entries(overrides)){
    savedEnv.set(key,process.env[key]);
    process.env[key]=value;
  }
  process.chdir(scratch);
  ({server}=require('../backend/server'));
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  origin='http://127.0.0.1:'+server.address().port;
});

after(async()=>{
  try{
    if(server?.listening){
      const closed=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
      server.closeAllConnections();
      await closed;
    }
  }finally{
    process.chdir(originalCwd);
    for(const [key,value] of savedEnv){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
    if(scratch)fs.rmSync(scratch,{recursive:true,force:true});
  }
});

test('backend serves the frontend page and its existing asset URLs',async()=>{
  const page=await fetch(origin+'/');
  assert.equal(page.status,200);
  assert.match(page.headers.get('content-type'),/^text\/html/);
  const html=await page.text();
  assert.equal(html,fs.readFileSync(path.join(APP,'frontend/index.html'),'utf8'));
  assert.match(html,/href="\/public\/style\.css"/);
  assert.match(html,/src="\/public\/app\.js"/);
  for(const [name,mime] of [['app.js',/^application\/javascript/],['style.css',/^text\/css/]]){
    const response=await fetch(origin+'/public/'+name);
    assert.equal(response.status,200,name);
    assert.match(response.headers.get('content-type'),mime);
    assert.equal(await response.text(),fs.readFileSync(path.join(APP,'frontend',name),'utf8'));
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  }
});

test('API loads the model manifest when the configured KB is missing and no credentials exist',async()=>{
  const health=await(await fetch(origin+'/api/health')).json();
  assert.equal(health.ok,true);
  assert.equal(health.defaultMode,'local');
  assert.equal(health.localKbAvailable,false);
  assert.equal(health.imaConfigured,false);
  assert.equal(health.localModelCount,manifest.length);
  const options=await(await fetch(origin+'/api/options')).json();
  assert.deepEqual(options.models.map(model=>model.name),manifest.map(model=>model.name));
  assert.ok(options.models.every(model=>model.factCount===0&&model.imageCount===0));
  assert.equal(options.scenes.length,8);
  assert.equal(options.platforms.length,4);
  const connection=await(await fetch(origin+'/api/ima-check')).json();
  assert.equal(connection.configured,false);
  assert.equal(connection.connected,false);
});

test('generate and compare APIs preserve follow-up validation',async()=>{
  const post=async route=>(await fetch(origin+route,{
    method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
  })).json();
  const result=await post('/api/generate');
  assert.equal(result.ok,false);
  assert.equal(result.status,'need_info');
  assert.equal(result.needsInput,true);
  for(const field of ['产品','人群','发布位置'])assert.ok(result.questions.some(question=>question.includes(field)),field);
  const comparison=await post('/api/compare');
  assert.equal(comparison.ok,false);
  assert.equal(comparison.first.needsInput,true);
  assert.equal(comparison.second.needsInput,true);
});

test('static routes cannot expose backend, shared data or private files',async()=>{
  for(const route of ['/backend/server.js','/backend/src/credentials.js','/data/models.json',
    '/docs/SYSTEM_PROMPT.md','/data/kb/README.md','/.env','/public/server.js']){
    const response=await fetch(origin+route);
    assert.equal(response.status,404,route);
    await response.text();
  }
  for(const target of ['backend/server.js','data/models.json','data/kb/README.md','docs/SYSTEM_PROMPT.md']){
    const response=await fetch(origin+'/public/..%2F'+target.replaceAll('/','%2F'));
    assert.equal(response.status,403,target);
    await response.text();
  }
});

test('relocated LLM module still loads its shared system prompt',()=>{
  const llm=require('../backend/src/llm');
  assert.equal(typeof llm.generateScaffold,'function');
  assert.equal(typeof llm.mergeScaffold,'function');
});
