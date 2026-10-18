'use strict';
// Optional real-browser acceptance: Node 22+, Chrome with --remote-debugging-port=9223.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');
const origin=process.env.SMOKE_URL||'http://127.0.0.1:8765';
const debug=process.env.CHROME_DEBUG_URL||'http://127.0.0.1:9223';
let socket,seq=0;
const pending=new Map();
const errors=[];
function command(method,params={}){
  const id=++seq;
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{pending.delete(id);reject(Error('Browser command timed out: '+method));},15000);
    pending.set(id,{resolve:value=>{clearTimeout(timeout);resolve(value);},reject:error=>{clearTimeout(timeout);reject(error);}});
    socket.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression){
  const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result?.value;
}
async function waitFor(expression){
  const deadline=Date.now()+12000;
  while(Date.now()<deadline){if(await evaluate(expression))return;await delay(80);}
  throw Error('Browser condition timed out: '+expression);
}
async function fill(values){
  await evaluate('('+function(data){
    for(const [id,value] of Object.entries(data)){
      const input=document.getElementById(id);if(!input)throw Error('Missing input '+id);
      input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }.toString()+')('+JSON.stringify(values)+')');
}
async function screenshot(name){
  await evaluate('document.activeElement?.blur();document.querySelector("#toast")?.classList.remove("show")');
  const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  fs.writeFileSync(path.join(__dirname,'../test-output',name+'.png'),Buffer.from(shot.data,'base64'));
}

(async()=>{
  fs.mkdirSync(path.join(__dirname,'../test-output'),{recursive:true});
  const target=await(await fetch(debug+'/json/new?'+encodeURIComponent(origin),{method:'PUT'})).json();
  socket=new WebSocket(target.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id){const request=pending.get(message.id);if(request){pending.delete(message.id);message.error?request.reject(Error(message.error.message)):request.resolve(message.result);}}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
  });
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  await command('Runtime.enable');await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
  await command('Page.navigate',{url:origin});
  await waitFor('document.querySelector("#request") && !document.querySelector("#generate").disabled');
  await fill({product:'HUAWEI MateBook 14（鸿蒙版）',audience:'大学新生',platform:'小红书',scene:'开学季',stage:'了解阶段',objective:'引导到店体验',instructions:''});
  await evaluate('document.querySelector("#generate").click()');
  await waitFor('!document.querySelector("#generate").disabled && document.querySelector("#article").innerText.length>100');
  const previewImages=await evaluate('document.querySelectorAll("#article img").length');
  for(let index=0;index<previewImages;index++){
    await evaluate('document.querySelectorAll("#article img")['+index+'].scrollIntoView({block:"center"})');
    await waitFor('document.querySelectorAll("#article img")['+index+'].complete && document.querySelectorAll("#article img")['+index+'].naturalWidth>0');
  }
  await evaluate('window.scrollTo(0,0)');
  const initial=await evaluate('({text:document.querySelector("#article").innerText,count:document.querySelectorAll("#article img").length,versions:document.querySelector("#version-select").options.length})');
  assert.ok(initial.count>=3);
  assert.ok(initial.versions>=1);
  await screenshot('workbench-1440');
  await evaluate('Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async text=>{window.__copied=text;}}});const makeURL=URL.createObjectURL;URL.createObjectURL=function(blob){window.__exportBlob=blob;return makeURL.call(URL,blob);};');
  await evaluate('document.querySelector("#copy").click()');
  const copied=await evaluate('window.__copied');
  assert.ok(copied.includes('MateBook'));
  assert.doesNotMatch(copied,/durationMs|sourceType|事实审核|决策轨迹/);
  await evaluate('document.querySelector("#export-markdown").click()');
  const markdown=await evaluate('window.__exportBlob.text()');
  assert.match(markdown,/!\[[^\]]*\]\([^)]+\)/);
  assert.match(markdown,/来源/);
  const imageLink=markdown.match(/!\[[^\]]*\]\(([^)]+)\)/)[1];
  assert.equal((await fetch(new URL(imageLink,origin))).status,200,'exported image URL must be readable');

  // Exercise both transport failures and actionable server failures without losing the draft.
  const preserved=await evaluate('document.querySelector("#article").innerText');
  await evaluate('window.__realFetch=window.fetch;window.fetch=async()=>{throw new TypeError("测试网络中断")};document.querySelector("#generate").click()');
  await waitFor('!document.querySelector("#generate").disabled');
  assert.equal(await evaluate('document.querySelector("#article").innerText'),preserved);
  assert.match(await evaluate('document.body.innerText'),/上一版|上一次/);
  assert.match(await evaluate('document.querySelector("#result-notice").innerText'),/写稿服务暂时未连接[\s\S]*无法连接写稿服务/);
  assert.equal(await evaluate('document.querySelector("#source-badge").classList.contains("offline")'),true);
  await evaluate('window.fetch=window.__realFetch');
  await fill({'revision-input':'短一点'});
  await evaluate('window.fetch=async()=>new Response(JSON.stringify({status:"blocked",ok:false,error:"测试服务暂时不可用"}),{status:500,headers:{"Content-Type":"application/json"}});document.querySelector("#revise").click()');
  await waitFor('!document.querySelector("#revise").disabled');
  assert.equal(await evaluate('document.querySelector("#article").innerText'),preserved);
  assert.match(await evaluate('document.body.innerText'),/测试服务暂时不可用/);
  await evaluate('window.fetch=window.__realFetch');

  await fill({'revision-input':'短一点'});
  await evaluate('document.querySelector("#revise").click()');
  await waitFor('!document.querySelector("#revise").disabled && document.querySelector("#version-select").options.length>='+String(initial.versions+1));
  const revised=await evaluate('document.querySelector("#article").innerText');
  assert.ok(revised.length<initial.text.length,'shorter revision should visibly shorten the article');
  assert.equal(await evaluate('document.querySelector("#source-badge").classList.contains("offline")'),false);
  await fill({'revision-input':'换个标题'});
  await evaluate('document.querySelector("#revise").click()');
  await waitFor('!document.querySelector("#revise").disabled && document.querySelector("#version-select").options.length>='+String(initial.versions+2));
  assert.ok((await evaluate('document.querySelector("#article").innerText')).length<initial.text.length,'changing title must retain the shortened style');

  await evaluate('(()=>{const select=document.querySelector("#version-select");select.value=select.options[select.options.length-1].value;select.dispatchEvent(new Event("change",{bubbles:true}));})()');
  await waitFor('document.querySelector("#article").innerText==='+JSON.stringify(initial.text));
  const restored=await evaluate('({product:document.querySelector("#product").value,platform:document.querySelector("#platform").value,scene:document.querySelector("#scene").value,source:document.querySelector("#article-source").textContent,images:document.querySelectorAll("#article img").length})');
  assert.equal(restored.product,'HUAWEI MateBook 14（鸿蒙版）');
  assert.equal(restored.platform,'小红书');assert.equal(restored.scene,'开学季');assert.equal(restored.images,initial.count);

  // Start a different product with insufficient images; the incomplete result stays usable.
  await fill({product:'HUAWEI MateBook D 16 2024',platform:'小红书'});
  await evaluate('document.querySelector("#generate").click()');
  await waitFor('!document.querySelector("#generate").disabled && document.querySelector("#article").innerText.includes("D 16")');
  assert.match(await evaluate('document.querySelector("#result-notice").innerText'),/草稿|缺|配图|图片/);
  assert.ok(await evaluate('!document.querySelector("#export-markdown").disabled'));
  await evaluate('document.querySelector("#copy").click()');
  assert.match(await evaluate('window.__copied'),/草稿/);
  await evaluate('document.querySelector("#export-markdown").click()');
  assert.match(await evaluate('window.__exportBlob.text()'),/草稿/);

  // Failed generation must identify the retained article as the previous version.
  await fill({product:'MateBook 14'});
  await evaluate('document.querySelector("#generate").click()');
  await waitFor('!document.querySelector("#generate").disabled && document.body.innerText.includes("酷睿")');
  assert.match(await evaluate('document.body.innerText'),/上一版|上一次/);

  for(const width of [1024,390]){
    await command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'),'horizontal overflow at '+width);
    await screenshot('workbench-'+width);
  }
  assert.deepEqual(errors,[],'uncaught browser exceptions');
  console.log(JSON.stringify({passed:true,imagePreview:initial.count,revision:true,restore:true,incompleteDraft:true,copy:true,markdown:true,networkFailure:true,serverFailure:true,previousVersionOnFailure:true,widths:[1440,1024,390],browserErrors:errors.length},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(()=>{if(socket)socket.close();});
