'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const KB=path.resolve(__dirname,'../data/kb');
const previousRoot=process.env.LOCAL_KB_ROOT;
delete process.env.LOCAL_KB_ROOT;
const catalog=require('../backend/src/catalog');
if(previousRoot===undefined)delete process.env.LOCAL_KB_ROOT;else process.env.LOCAL_KB_ROOT=previousRoot;
const {generateTask}=require('../backend/src/agent');

function inventory(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const filename=path.join(dir,entry.name);
    return entry.isDirectory()?inventory(filename):[path.relative(KB,filename).split(path.sep).join('/')];
  });
}

test('bundled knowledge base preserves every file in the original SHA256 manifest',()=>{
  const manifestName='全库文件清单_SHA256.csv';
  const rows=catalog.csvRows(fs.readFileSync(path.join(KB,manifestName),'utf8'));
  assert.equal(rows.length,1521);
  const expected=[manifestName];
  for(const row of rows){
    const filename=path.resolve(KB,row['相对路径']);
    assert.ok(filename.startsWith(KB+path.sep),'manifest paths stay within the knowledge base');
    const bytes=fs.readFileSync(filename);
    assert.equal(bytes.length,Number(row['字节数']),row['相对路径']);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),row.SHA256,row['相对路径']);
    expected.push(row['相对路径']);
  }
  assert.deepEqual(inventory(KB).sort(),expected.sort());
});

test('default discovery selects the bundled data and all ten model image indexes',()=>{
  assert.equal(catalog.KB_ROOT,KB);
  const models=catalog.safeCatalog();
  assert.equal(models.length,10);
  for(const model of models){
    const evidence=catalog.localEvidence(model.name);
    assert.equal(evidence.mode,'local');
    assert.ok(evidence.facts.length>=4,model.name);
    assert.ok(evidence.pictures.length>0,model.name);
    for(const image of evidence.pictures){
      assert.equal(image.model,model.name);
      assert.equal(image.origin,'local');
      const filename=catalog.localImageById(model.name,image.id);
      assert.ok(filename.startsWith(KB+path.sep));
      assert.ok(fs.statSync(filename).isFile());
    }
  }
});

test('all bundled models generate audited local copy without ima or LLM calls',async()=>{
  for(const model of catalog.safeCatalog()){
    const result=await generateTask({mode:'local',drafting:'rules',product:model.name,
      audience:'准备到店看机的用户',stage:'了解阶段',scene:'门店到访',platform:'门店海报',
      objective:'根据已核验资料引导实机体验',instructions:''});
    assert.equal(result.ok,true,model.name+': '+(result.error||''));
    assert.equal(result.mode,'local');
    assert.equal(result.audit.status,'passed');
    assert.ok(result.images.length>0,model.name);
    assert.ok(result.facts.every(fact=>fact.sourceType==='local'));
  }
});
