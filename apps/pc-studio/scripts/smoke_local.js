'use strict';
const assert=require('node:assert/strict');
const ROOT=process.env.SMOKE_URL||'http://127.0.0.1:8765';
(async()=>{
  const health=await(await fetch(ROOT+'/api/health')).json();
  const opts=await(await fetch(ROOT+'/api/options')).json();
  assert.equal(health.ok,true);
  assert.equal(health.defaultMode,'local');
  assert.equal(opts.defaultMode,'local');
  assert.ok(opts.models.length>=10);
  const job={product:'HUAWEI MateBook 14（鸿蒙版）',audience:'大一新生',stage:'了解阶段',
    scene:'开学季',platform:'小红书',objective:'引导到店体验',instructions:'侧重屏幕'};
  const r=await(await fetch(ROOT+'/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(job)})).json();
  assert.equal(r.ok,true,r.error);
  assert.equal(r.mode,'local');
  assert.equal(r.audit.status,'passed');
  assert.ok(r.facts.every(f=>f.sourceType==='local'));
  assert.ok(r.images.every(x=>x.origin==='local'));
  const first=r.images[0];
  const img=await fetch(ROOT+'/api/local-image?model='+encodeURIComponent(job.product)+'&id='+encodeURIComponent(first.id));
  const bytes=Buffer.from(await img.arrayBuffer());
  assert.equal(img.status,200);
  assert.match(img.headers.get('content-type'),/^image\//);
  assert.ok(bytes.length>2000);
  const status={server:health.ok,imaCredentialsStored:health.imaConfigured,
    defaultMode:health.defaultMode,generatedMode:r.mode,modelCount:opts.models.length,
    facts:r.facts.length,images:r.images.length,imageBytes:bytes.length,
    audited:r.audit.status};
  console.log(JSON.stringify(status,null,2));
})().catch(e=>{console.error('SMOKE FAILED',e.message);process.exitCode=1;});
