'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const APP=path.resolve(__dirname,'..');
const ROOT=path.resolve(APP,'../..');
const dockerfile=fs.readFileSync(path.join(ROOT,'Dockerfile'),'utf8');

// This checks repository paths and the copied runtime, not a Docker engine build.
test('Docker and ModelScope deployment files are discoverable at repository root',()=>{
  for(const name of ['Dockerfile','.dockerignore','ms_deploy.json']){
    assert.ok(fs.statSync(path.join(ROOT,name)).isFile(),name);
  }
  assert.equal(fs.existsSync(path.join(APP,'Dockerfile')),false);
  assert.equal(fs.existsSync(path.join(APP,'ms_deploy.json')),false);
  const deploy=JSON.parse(fs.readFileSync(path.join(ROOT,'ms_deploy.json'),'utf8'));
  assert.equal(deploy.sdk_type,'docker');
  assert.equal(deploy.port,7860);
  const ignore=fs.readFileSync(path.join(ROOT,'.dockerignore'),'utf8');
  assert.match(ignore,/^!apps\/pc-studio\/data\/models\.json\s*$/m);
  assert.doesNotMatch(ignore,/^!apps\/pc-studio\/data\/kb\//m);
  assert.match(dockerfile,/^EXPOSE 7860\s*$/m);
  assert.match(dockerfile,/^ENV .*HOST=0\.0\.0\.0/m);
  assert.match(dockerfile,/^CMD \["node","backend\/server\.js"\]\s*$/m);
});

test('root-context COPY paths produce a working standalone HTTP runtime',t=>{
  const copies=[...dockerfile.matchAll(/^COPY\s+(\S+)\s+(\S+)\s*$/gm)];
  assert.deepEqual(copies.map(match=>match[1]),[
    'apps/pc-studio/package.json',
    'apps/pc-studio/backend',
    'apps/pc-studio/frontend',
    'apps/pc-studio/data/models.json',
    'apps/pc-studio/docs/SYSTEM_PROMPT.md'
  ]);
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'pc-studio-root-copy-'));
  t.after(()=>fs.rmSync(scratch,{recursive:true,force:true}));
  for(const [,source,destination] of copies){
    const from=path.join(ROOT,source);
    const target=path.resolve(scratch,destination);
    assert.ok(target===scratch||target.startsWith(scratch+path.sep));
    if(fs.statSync(from).isDirectory()){
      fs.cpSync(from,target,{recursive:true});
    }else{
      const filename=destination.endsWith('/')?path.join(target,path.basename(from)):target;
      fs.mkdirSync(path.dirname(filename),{recursive:true});
      fs.copyFileSync(from,filename);
    }
  }
  const probe=`
    const assert=require('node:assert/strict');
    const fs=require('node:fs');
    const {once}=require('node:events');
    const {server}=require('./backend/server');
    (async()=>{
      server.listen(0,'127.0.0.1');
      await once(server,'listening');
      const origin='http://127.0.0.1:'+server.address().port;
      try{
        for(const [route,filename] of [
          ['/','frontend/index.html'],
          ['/public/app.js','frontend/app.js'],
          ['/public/style.css','frontend/style.css']
        ]){
          const response=await fetch(origin+route);
          assert.equal(response.status,200,route);
          assert.equal(await response.text(),fs.readFileSync(filename,'utf8'));
        }
        const health=await(await fetch(origin+'/api/health')).json();
        assert.equal(health.ok,true);
        assert.equal(health.localKbAvailable,false);
        assert.equal(health.imaConfigured,false);
        const manifest=JSON.parse(fs.readFileSync('data/models.json','utf8'));
        const options=await(await fetch(origin+'/api/options')).json();
        assert.equal(health.localModelCount,manifest.length);
        assert.equal(options.models.length,manifest.length);
        assert.ok(options.models.every(model=>model.factCount===0&&model.imageCount===0));
        assert.equal(typeof require('./backend/src/llm').generateScaffold,'function');
        const response=await fetch(origin+'/api/generate',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({mode:'local',drafting:'rules',product:options.models[0].name,
            audience:'准备到店看机的用户',stage:'了解阶段',scene:'门店到访',platform:'门店海报',
            objective:'根据已核验资料引导实机体验',instructions:''})
        });
        const result=await response.json();
        assert.equal(result.ok,false);
        assert.match(result.error,/缺少该精确型号的本地演示证据/);
        for(const route of ['/backend/server.js','/docs/SYSTEM_PROMPT.md','/.env']){
          const response=await fetch(origin+route);
          assert.equal(response.status,404,route);
          await response.text();
        }
        console.log(JSON.stringify({ok:true,models:manifest.length}));
      }finally{
        server.closeAllConnections();
        await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
      }
    })().catch(error=>{console.error(error);process.exitCode=1;});
  `;
  const result=spawnSync(process.execPath,['-e',probe],{
    cwd:scratch,
    encoding:'utf8',
    timeout:20000,
    env:{...process.env,
      NODE_ENV:'production',
      DEFAULT_DATA_MODE:'local',
      LOCAL_KB_ROOT:path.join(scratch,'missing-kb'),
      IMA_CREDENTIALS_FILE:path.join(scratch,'missing-credentials.txt'),
      IMA_OPENAPI_CLIENTID:'',
      IMA_OPENAPI_APIKEY:'',
      LLM_API_KEY:'',
      OPENAI_API_KEY:'',
      LLM_MODEL:''
    }
  });
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  const report=JSON.parse(result.stdout.trim());
  assert.equal(report.ok,true);
  assert.equal(report.models,JSON.parse(fs.readFileSync(path.join(APP,'data/models.json'),'utf8')).length);
});
