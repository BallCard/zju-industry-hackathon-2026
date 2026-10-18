'use strict';
const fs = require('node:fs');
const path = require('node:path');

function findLocalKb() {
  // Discover non-versioned development data from ancestor folders, including Git worktrees.
  let base = __dirname;
  while (true) {
    for (const candidate of [path.join(base, 'data', 'kb'), path.join(base, '华为PC全板块深度知识库_v7')]) {
      if (fs.existsSync(path.join(candidate, 'P1-产品参数库'))) return candidate;
    }
    const parent = path.dirname(base);
    if (parent === base) break;
    base = parent;
  }
  return path.resolve(__dirname, '../../data/kb');
}
const KB_ROOT = process.env.LOCAL_KB_ROOT || findLocalKb();
const CATEGORIES = ['01-鸿蒙电脑', '02-MateBook-Windows'];
const P1 = path.join(KB_ROOT, 'P1-产品参数库');

function csvRows(input) {
  const text = input.replace(/^\uFEFF/, '');
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some(Boolean)) rows.push(row);
      row = []; field = '';
    } else field += c;
  }
  row.push(field); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const header = rows.shift();
  return rows.map(cells => Object.fromEntries(header.map((h, i) => [h, cells[i] || ''])));
}
function sections(md) {
  const out = {};
  for (const part of md.split(/(?=^## )/m)) {
    const match = /^## (.+)\r?\n([\s\S]*)/.exec(part);
    if (match) out[match[1].trim()] = match[2].trim();
  }
  return out;
}
function findLine(section, key) {
  if (!section) return '';
  const lines = section.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const at = lines.findIndex(x => x === key || x === key + '：');
  if (at >= 0 && lines[at + 1] && !lines[at + 1].startsWith('*')) return lines[at + 1];
  return '';
}
function cleanValue(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}
// Keep complete field variants and the notes immediately following them.
function fieldValue(section, key, otherKeys) {
  const lines = String(section || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const start = lines.findIndex(x => x === key || x === key + '：');
  if (start < 0) return '';
  const end = lines.findIndex((x, i) => i > start && otherKeys.includes(x.replace(/：$/, '')));
  return lines.slice(start + 1, end < 0 ? undefined : end).join(' ');
}
function extractFacts(md, model, sourceUrl, relPath) {
  const s = sections(md); const result = [];
  function add(topic, quote) {
    quote = cleanValue(quote);
    if (!quote || quote.length < 3 || result.some(x => x.topic === topic && x.quote === quote)) return;
    result.push({ id:'F' + String(result.length + 1).padStart(2,'0'),
      topic, quote, model, sourceTitle:model + ' - 产品事实',
      sourceUrl, sourcePath:relPath, sourceType:'local', supported:true,
      conditions:(md.match(/^>\s*来源：(.+)$/m)||[])[1]||'' });
  }
  const os = s['操作系统'];
  if (os) add('操作系统', os);
  const screen = s['屏幕'];
  const screenKeys = ['尺寸','类型','屏占比','屏幕比例','分辨率','刷新率','亮度','色域','色准','对比度','可视角度','触摸屏'];
  add('屏幕尺寸', fieldValue(screen, '尺寸', screenKeys));
  add('屏幕类型', fieldValue(screen, '类型', screenKeys));
  add('屏幕分辨率', fieldValue(screen, '分辨率', screenKeys));
  add('机身重量', fieldValue(s['尺寸与重量'], '重量', ['长度','宽度','厚度','重量']));
  const processor = s['处理器'];
  if (processor) {
    const lines=processor.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    add('处理器',lines.filter(x => x !== 'CPU').join(' '));
  }
  add('内存', s['内存']);
  add('存储', s['存储']);
  add('电池容量', fieldValue(s['电池'], '容量', ['材料','容量','额定容量']));
  add('接口',(s['接口'] || '').trim());
  return result;
}
function listLocalModels() {
  if (!fs.existsSync(P1)) return [];
  const output=[];
  for (const category of CATEGORIES) {
    const catDir=path.join(P1,category);
    if(!fs.existsSync(catDir))continue;
    for(const name of fs.readdirSync(catDir)) {
      const dir=path.join(catDir,name);
      if(!fs.statSync(dir).isDirectory())continue;
      const factPath=path.join(dir,'产品事实.md');
      if(!fs.existsSync(factPath))continue;
      const md=fs.readFileSync(factPath,'utf8');
      const title=md.split(/\r?\n/)[0].replace(/^#\s*/,'').replace(/\s*-\s*产品事实\s*$/,'').trim();
      const sourceUrl=(md.match(/^- 产品页：(https?:\/\/\S+)/m)||[])[1]||'';
      const facts=extractFacts(md,title,sourceUrl,path.relative(KB_ROOT,factPath));
      const picturePath=path.join(dir,'图片索引.csv');
      const pictures=[];
      if(fs.existsSync(picturePath))for (const row of csvRows(fs.readFileSync(picturePath,'utf8'))) {
        if(row['产品型号'] !== title)continue;
        const filename=row['文件名'];
        const location=[path.join(dir,'images',filename),path.join(dir,'商城款式图片',filename)].find(x=>fs.existsSync(x));
        if(!location)continue;
        pictures.push({ id:'I'+String(pictures.length+1).padStart(2,'0'), model:title,
          filename, description:row['官网图片说明'], sourceUrl:row['来源页面'],
          originalUrl:row['原始图片URL'], sourceTitle:title+' - 图片索引',
          sourcePath:path.relative(KB_ROOT,picturePath), origin:'local',
          localPath:location, width:Number(row['宽度']||0), height:Number(row['高度']||0)});
      }
      output.push({id:'M'+String(output.length+1).padStart(2,'0'),name:title,folder:name,system:category,sourceUrl,facts,pictures});
    }
  }
  return output;
}
const cached=listLocalModels();
const manifest=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../data/models.json'),'utf8'));
const virtual=manifest.map((m,i)=>({id:'M'+String(i+1).padStart(2,'0'),...m,facts:[],pictures:[]}));
const active=cached.length?cached:virtual;
function safeCatalog() {return active.map(x=>({id:x.id,name:x.name,system:x.system,factCount:x.facts.length,imageCount:x.pictures.length}));}
const modelKey = value => String(value || '').toLowerCase().replace(/^huawei\s*/,'').replace(/[\s（）()·\-—_]/g,'');
function resolveModel(query) {
  const q=modelKey(query);
  if(!q)return null;
  // A folder may omit a version qualifier; it must never resolve an ambiguous model.
  return active.find(x=>modelKey(x.name)===q)||null;
}
function modelCandidates(query) {
  const q=modelKey(query);
  if(!q)return [];
  const exact=resolveModel(query);
  if(exact)return [exact.name];
  return active.filter(x=>modelKey(x.name).startsWith(q)||modelKey(x.folder)===q).map(x=>x.name);
}
function localEvidence(query) {
  const product=resolveModel(query);
  if(!product||!product.facts.length)return {error:'当前缺少该精确型号的本地演示证据；请使用赛事ima模式或配置本地知识库。'};
  return {mode:'local',model:product.name,facts:product.facts,pictures:product.pictures,
    kbName:'华为PC全板块深度知识库_v7（本地演示，非组委会指定 ima 库）',
    warning:'本地演示资料不计作已完成 ima 接口检索；提交比赛前必须切换 live 模式复核。'};
}
function localImageById(model,id) {
  const product=resolveModel(model);
  return product?.pictures.find(p=>p.id===id)?.localPath||null;
}
module.exports={KB_ROOT,safeCatalog,resolveModel,localEvidence,localImageById,csvRows,extractFacts,modelCandidates};
