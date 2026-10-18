'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {generateTask}=require('../backend/src/agent');
const dest=path.join(__dirname,'../examples');
const jobs=[
  {name:'01-开学季-小红书',product:'HUAWEI MateBook 14（鸿蒙版）',audience:'大一新生',scene:'开学季',stage:'了解阶段',platform:'小红书',objective:'理清学习与携带需求',instructions:'侧重轻薄与屏幕'},
  {name:'02-差旅办公-公众号',product:'HUAWEI MateBook 14（鸿蒙版）',audience:'经常出差的职场用户',scene:'职场办公',stage:'比较阶段',platform:'公众号',objective:'讲清楚外设接口和办公任务的关系',instructions:'侧重接口和电池'},
  {name:'03-创作-朋友圈',product:'HUAWEI MateBook 14 酷睿 Ultra',audience:'设计师与摄影师',scene:'内容创作',stage:'比较阶段',platform:'门店朋友圈',objective:'鼓励实机体验屏幕与常用软件兼容性',instructions:'侧重屏幕和分辨率'}
];
(async()=>{
  fs.mkdirSync(dest,{recursive:true});
  for(const j of jobs){
    const result=await generateTask({...j,mode:'local',drafting:'rules'});
    if(!result.ok)throw Error(j.name+': '+result.error);
    fs.writeFileSync(path.join(dest,j.name+'.json'),JSON.stringify(result,null,2));
    const summary='# '+j.name+'\n\n> 本次为local开发模式实际运行，非ima官方共享库的验收记录。\n\n'+
      result.copy.fullText+'\n\n## 事实与来源\n'+
      result.facts.map(f=>'- '+f.topic+'：'+f.quote+'｜'+f.sourceTitle).join('\n')+
      '\n\n## 图片出处与位置\n'+
      result.images.map(i=>'- '+i.filename+'：'+i.position+'｜'+i.sourceTitle).join('\n')+
      '\n\n## 核验信息\n'+JSON.stringify({status:result.audit.status,unknowns:result.audit.unknowns},null,2)+'\n';
    fs.writeFileSync(path.join(dest,j.name+'.md'),summary);
    console.log(j.name+' => '+result.audit.status+'; facts='+result.facts.length+'; images='+result.images.length);
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
