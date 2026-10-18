'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ORIGIN='http://127.0.0.1:'+(process.env.PORT||8765);
const jobs=[
 {id:'student_xhs',product:'HUAWEI MateBook 14（鸿蒙版）',audience:'大一新生',scene:'开学季',stage:'了解阶段',platform:'小红书',objective:'帮助用户理清选机需求',instructions:'侧重轻薄携带'},
 {id:'office_mp',product:'HUAWEI MateBook 14（鸿蒙版）',audience:'经常出差的职场用户',scene:'职场办公',stage:'比较阶段',platform:'公众号',objective:'帮助比较通勤和接口需求',instructions:'侧重电池和接口'},
 {id:'creator_wechat',product:'HUAWEI MateBook 14 酷睿 Ultra',audience:'设计创作者',scene:'内容创作',stage:'比较阶段',platform:'门店朋友圈',objective:'引导体验屏幕与核对兼容性',instructions:'侧重屏幕分辨率'},
 {id:'poster',product:'HUAWEI MateBook 14（鸿蒙版）',audience:'附近看机用户',scene:'门店到访',stage:'临门决策',platform:'门店海报',objective:'到店体验',instructions:''}
];
(async()=>{
 const status=await(await fetch(ORIGIN+'/api/ima-check')).json();
 console.log('CONNECTED:',status.connected,'KB:',status.kbName);
 if(!status.connected)throw Error('未连通组委会ima知识库');
 const records=[];
 for(const job of jobs){
  const res=await fetch(ORIGIN+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...job,mode:'live'})});
  const data=await res.json();
  const entry={job:job.id,ok:data.ok,mode:data.mode,kbName:data.kbName,
    product:job.product,scene:job.scene,platform:job.platform,
    audit:data.audit?.status,factTopics:data.facts?.map(f=>f.topic)||[],
    imgFilenames:data.images?.map(i=>i.filename)||[],
    realIMASource:data.facts?.every(f=>f.sourceType==='ima'&&f.mediaId) &&
      data.images?.every(i=>i.origin==='ima'&&i.mediaId&&i.imageIndexMediaId),
    warning:data.warning||'',error:data.error||'',timestamp:new Date().toISOString()};
  if(data.ok&&data.images?.length){
    const img=data.images[0];
    const u=ORIGIN+'/api/ima-image?model='+encodeURIComponent(job.product)+'&mediaId='+encodeURIComponent(img.mediaId);
    const r=await fetch(u);
    const bytes=Buffer.from(await r.arrayBuffer());
    entry.imageProxy={status:r.status,mime:r.headers.get('content-type'),validPicture:
      r.ok&&/^image\//.test(r.headers.get('content-type')||'')&&bytes.length>2000,byteCount:bytes.length};
  }
  console.log(JSON.stringify(entry));records.push(entry);
 }
 const dir=path.resolve(__dirname,'../test-output');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'ima-live-verification.json'),JSON.stringify(records,null,2),'utf8');
 if(records.some(x=>!x.ok||x.audit!=='passed'||!x.realIMASource||!x.imageProxy?.validPicture))process.exitCode=1;
})().catch(e=>{console.log('LIVE ACCEPTANCE FAILED:',e.message);process.exitCode=1;});
