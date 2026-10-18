'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function check(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const filename=path.join(directory,entry.name);
    if(entry.isDirectory())check(filename);
    else if(entry.name.endsWith('.js')){
      const result=spawnSync(process.execPath,['--check',filename],{stdio:'inherit'});
      if(result.status!==0)process.exit(result.status||1);
    }
  }
}
for(const directory of ['backend','frontend','scripts','tests'])check(path.join(root,directory));
console.log('JavaScript syntax checks passed.');
