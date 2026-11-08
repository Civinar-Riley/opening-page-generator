/* 角色卡导入（v1.30）：PNG(tEXt chara/ccv3) / JSON / CHARX(zip 内 card.json) 三路解析，
   V1/V2/V3 卡归一，导入计划生成与工程应用。纯函数无 DOM——UI 接线在 project.js 的 openCardImport。
   解析器只读不校验 CRC（浏览器 zlib 场景自产自销，卡文件损坏时 JSON.parse 自然报错）。 */
import { Gen } from './gen/index.js';

/* base64 → 字节（卡内嵌的 chara/ccv3 是 base64 JSON） */
function b64ToBytes(s){
  const bin=atob(s.replace(/\s+/g,''));
  const out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
}

/* PNG：遍历 chunk 找 tEXt，取 chara（V2）或 ccv3（V3）。结构损坏/超长防呆直接抛错 */
function parsePngCard(buf){
  const u=new Uint8Array(buf),dv=new DataView(buf);
  const SIG=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
  for(let i=0;i<8;i++)if(u[i]!==SIG[i])throw new Error('不是 PNG 文件');
  const td=new TextDecoder();
  let off=8;
  const texts={};
  while(off+8<=u.length){
    const len=dv.getUint32(off);
    if(len>u.length)throw new Error('PNG 结构损坏');
    const type=td.decode(u.subarray(off+4,off+8));
    if(type==='tEXt'){
      const d=u.subarray(off+8,off+8+len);
      const z=d.indexOf(0);
      if(z>0)texts[td.decode(d.subarray(0,z))]=td.decode(d.subarray(z+1));
    }
    if(type==='IEND')break;
    off+=12+len;
  }
  const raw=texts.chara||texts.ccv3;
  if(!raw)throw new Error('PNG 里没有角色卡数据（tEXt chara / ccv3）——普通图片无法导入');
  return JSON.parse(td.decode(b64ToBytes(raw)));
}

/* zip：读中央目录按文件名取条目。method 0 直接切片，method 8 走原生 DecompressionStream('deflate-raw')
   （酒馆助手内置库无 zip 库——见 reference/notes/上游对照，独立版也不引第三方依赖） */
async function readZipEntry(buf,nameRe){
  const u=new Uint8Array(buf),dv=new DataView(buf),td=new TextDecoder();
  let e=-1;
  for(let i=u.length-22;i>=Math.max(0,u.length-22-65536);i--){
    if(u[i]===0x50&&u[i+1]===0x4b&&u[i+2]===0x05&&u[i+3]===0x06){e=i;break}
  }
  if(e<0)throw new Error('不是有效的 zip（CHARX）文件');
  const cnt=dv.getUint16(e+10,true),cdOff=dv.getUint32(e+16,true);
  let p=cdOff,found=null;
  for(let n=0;n<cnt&&p+46<=u.length;n++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),
      nlen=dv.getUint16(p+28,true),elen=dv.getUint16(p+30,true),clen=dv.getUint16(p+32,true),
      lho=dv.getUint32(p+42,true);
    const nm=td.decode(u.subarray(p+46,p+46+nlen));
    if(nameRe.test(nm)&&!found)found={method,csize,lho,nm};
    p+=46+nlen+elen+clen;
  }
  if(!found)return null;
  const nlen2=dv.getUint16(found.lho+26,true),elen2=dv.getUint16(found.lho+28,true);
  const dstart=found.lho+30+nlen2+elen2;
  const data=u.subarray(dstart,dstart+found.csize);
  if(found.method===0)return data;
  if(found.method===8)return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  throw new Error('CHARX 条目压缩方式不支持（method '+found.method+'）');
}

async function parseCharxCard(buf){
  const raw=await readZipEntry(buf,/^(\.\/)?card\.json$/i)
    ||await readZipEntry(buf,/card\.p?json$/i)||await readZipEntry(buf,/\.json$/i);
  if(!raw)throw new Error('CHARX 里没有 card.json');
  return JSON.parse(new TextDecoder().decode(raw));
}

/* V1（扁平）/ V2 / V3（spec + data 包裹）→ 统一形状。
   character_book 不收集：那是角色设定世界书，装卡时酒馆自动读取，工具不搬运——
   开场白标题库草稿（titleBookDraft）与设定条目是两回事，由用户在开场白区块手动维护 */
function normalizeCard(raw){
  if(!raw||typeof raw!=='object')throw new Error('角色卡数据为空');
  const d=(raw.spec==='chara_card_v2'||raw.spec==='chara_card_v3')&&raw.data&&typeof raw.data==='object'?raw.data:raw;
  const warn=[];
  const name=String(d.name||'').trim();
  const firstMes=String(d.first_mes??d.firstMes??'');
  const alt=Array.isArray(d.alternate_greetings)?d.alternate_greetings.map(String):[];
  const description=String(d.description??'');
  const tags=Array.isArray(d.tags)?d.tags.map(String):[];
  if(!name)warn.push('卡内没有角色名，工程名将用「导入工程」');
  if(!firstMes&&!alt.length)warn.push('卡内没有开场白文本（first_mes / alternate_greetings）');
  return {name,description,firstMes,altGreetings:alt,tags,warnings:warn};
}

/** 解析角色卡文件（按魔数分流：PNG / zip(CHARX) / JSON 文本）
 * @param {File} file
 * @returns {Promise<{name:string,description:string,firstMes:string,altGreetings:string[],tags:string[],warnings:string[]}>}
 */
export async function parseCardFile(file){
  const buf=await file.arrayBuffer();
  const u=new Uint8Array(buf);
  if(u[0]===0x89&&u[1]===0x50)return normalizeCard(parsePngCard(buf));
  if(u[0]===0x50&&u[1]===0x4b)return normalizeCard(await parseCharxCard(buf));
  try{return normalizeCard(JSON.parse(new TextDecoder().decode(u)))}
  catch(e){throw new Error('无法识别的角色卡文件——支持酒馆卡 PNG / JSON / CHARX')}
}

/** 生成导入计划（预览表数据）：只列卡里实际有内容的项
 * @returns {{name:string,items:{id:string,label:string,detail:string}[]}}
 */
export function buildPlan(card){
  const altN=card.altGreetings.length;
  const items=[];
  if(card.firstMes||altN)items.push({id:'greet',label:'💌 开场白选择区',detail:altN?`主开场白 + ${altN} 条备用开场白 → 预览占位列表`:'主开场白（first_mes）→ 预览占位列表'});
  if(card.description)items.push({id:'desc',label:'👤 角色简介区',detail:`description ${card.description.length} 字${card.tags.length?` + tags ${card.tags.length} 个`:''}`});
  return {name:card.name,items};
}

/** 把勾选的计划应用到工程（p 已 defaultProject+normalize；启用的区块置 enabled）
 * @returns {string} 结果摘要（toast 用） */
export function applyImportPlan(p,card,ids){
  const got=new Set(ids);
  const done=[];
  const g=p.blocks.find(b=>b.type==='greetings');
  if(got.has('greet')&&g&&(card.firstMes||card.altGreetings.length)){
    g.enabled=true;
    const list=Gen.greetSnapshotLines([card.firstMes,...card.altGreetings]);
    if(list)g.placeholderList=list;
    done.push('开场白列表');
  }
  if(got.has('desc')){
    const pr=p.blocks.find(b=>b.type==='profile');
    if(pr){
      pr.enabled=true;
      pr.characters=[{name:card.name||'{{char}}',desc:card.description,tags:card.tags.join(','),avatar:'',avatarMode:'manual'}];
      done.push('角色简介');
    }
  }
  return '已导入：'+(done.join('、')||'（未勾选任何项）');
}

/** 组装 V2 卡 JSON（「同时创建进酒馆」用：只带回导入了的文本字段，头像/扩展不动） */
export function toV2Card(card){
  return {spec:'chara_card_v2',data:{name:card.name,description:card.description,first_mes:card.firstMes,alternate_greetings:[...card.altGreetings],tags:[...card.tags]}};
}
