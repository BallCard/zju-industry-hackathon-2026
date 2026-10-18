'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {generateTask}=require('../backend/src/agent');
const llm=require('../backend/src/llm');
const html=fs.readFileSync(path.join(__dirname,'../frontend/index.html'),'utf8');
const script=fs.readFileSync(path.join(__dirname,'../frontend/app.js'),'utf8');
function client(){
  const elements=new Map();
  class Element{
    constructor(id){this.value='';this.hidden=false;this.tagName=/^(mode|platform|scene|stage|objective)$/.test(id)?'SELECT':'INPUT';this.options=[];this.selectedOptions=[];this.dataset={};this.listeners={};this.classList={add(){},remove(){},toggle(){}};}
    set innerHTML(value){this.markup=value;}get innerHTML(){return this.markup||'';}
    setAttribute(){}removeAttribute(){}focus(){}scrollIntoView(){}
    add(option){this.options.push(option);}replaceChildren(...options){this.options=options;this.value=options[0]?.value||'';}
    addEventListener(type,handler){this.listeners[type]=handler;}
    querySelector(){return get('child');}
    querySelectorAll(selector){return selector==='[data-candidate]'?[...this.innerHTML.matchAll(/data-candidate="([^"]*)"/g)].map((match,index)=>{const e=get('candidate-'+index);e.dataset.candidate=match[1];return e;}):[];}
  }
  function get(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);}
  for(const match of html.matchAll(/\bid="([^"]+)"/g))get(match[1]);
  const context=vm.createContext({document:{getElementById:get,querySelectorAll:()=>[]},window:{matchMedia:()=>({matches:false})},
    Option:function(text,value){this.textContent=text;this.value=value;},setTimeout:()=>1,clearTimeout(){},console,
    runBackend:async payload=>generateTask(JSON.parse(JSON.stringify(payload)))});
  const run=code=>vm.runInContext(code,context);
  run(script.replace(/\ninit\(\);\s*$/,'\n'));
  run("fillTask({mode:'local',scene:'职场办公',stage:'了解阶段',platform:'小红书',objective:'引导到店体验'}); api=async(url,payload)=>{globalThis.sent=payload;return await runBackend(payload);};");
  return {get,run,context};
}
test('actual UI and backend complete a request-only recommendation and candidate-confirmation round trip',async t=>{
  t.mock.method(llm,'configured',()=>false);
  const ui=client();ui.get('request').value='给大学新生推荐轻便的华为电脑，开学季发布公众号，鼓励收藏分享';
  await ui.run('generate()');
  assert.equal(ui.context.sent.product,'');
  assert.equal(ui.context.sent.scene,undefined,'untouched default must not defeat parsed scene');
  assert.equal(ui.context.sent.platform,undefined,'untouched default must not defeat requested channel');
  assert.equal(ui.get('audience').value,'大学新生');
  assert.equal(ui.get('scene').value,'开学季');
  assert.equal(ui.get('platform').value,'公众号');
  assert.match(ui.get('result-notice').innerHTML,/未配置大模型/);
  assert.match(ui.get('result-notice').innerHTML,/选型依据/);
  ui.get('candidate-0').listeners.click();
  const product=ui.get('product').value;assert.ok(product);
  await ui.run('generate()');
  assert.ok(['ok','incomplete'].includes(ui.run('state.result.status')));
  assert.equal(ui.run('state.result.task.product'),product);
  assert.equal(ui.run('state.result.task.scene'),'开学季');
  assert.equal(ui.run('state.result.task.platform'),'公众号');
  assert.equal(ui.get('request').value,'给大学新生推荐轻便的华为电脑，开学季发布公众号，鼓励收藏分享');
  assert.equal(ui.run('state.versions.length'),1);
  await ui.run("generate('短一点')");
  assert.equal(ui.run('state.result.task.writingPreferences.length'),'short');
  assert.equal(ui.run('state.versions.length'),2);
  ui.get('request').value='现在帮出差办公的人选机';ui.get('request').listeners.input();
  assert.equal(ui.get('product').value,'','a new free-form task must not reuse the previously confirmed product');
});
