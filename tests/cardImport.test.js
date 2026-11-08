/* 角色卡导入单元测试：PNG tEXt / JSON V1-V3 / CHARX(zip) 解析 + 导入计划生成与应用 */
import { describe, it, expect } from 'vitest';
import { parseCardFile, buildPlan, applyImportPlan, toV2Card } from '../src/js/cardImport.js';
import { defaultProject, BLOCK_DEFS } from '../src/js/defs.js';
import { Project } from '../src/js/project.js';

/* ---- 测试夹具 ---- */
const PNG_SIG=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];

function chunk(type,data){ /* PNG chunk：len + type + data（CRC 置零——解析器不校验） */
  const out=new Uint8Array(12+data.length);
  new DataView(out.buffer).setUint32(0,data.length);
  for(let i=0;i<4;i++)out[4+i]=type.charCodeAt(i);
  out.set(data,8);
  return out;
}
function pngWithText(keyword,value){
  const kw=new TextEncoder().encode(keyword),val=new TextEncoder().encode(value);
  const t=new Uint8Array(kw.length+1+val.length);
  t.set(kw,0);t[kw.length]=0;t.set(val,kw.length+1);
  return new Blob([Uint8Array.from(PNG_SIG),chunk('tEXt',t),chunk('IEND',new Uint8Array(0))]);
}
/* 最小 zip（单文件，store-only）：本地头 + 数据 + 中央目录 + EOCD，字段自洽即可（解析器不校验 CRC） */
function makeZipStored(name,bytes){
  const enc=new TextEncoder(),nb=enc.encode(name);
  const crc=0xdeadbeef>>>0; /* 占位：解析器不读 */
  const lh=new Uint8Array(30+nb.length);
  const lv=new DataView(lh.buffer);
  lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0,true);lv.setUint16(8,0,true);
  lv.setUint32(14,crc,true);lv.setUint32(18,bytes.length,true);lv.setUint32(22,bytes.length,true);
  lv.setUint16(26,nb.length,true);lv.setUint16(28,0,true);lh.set(nb,30);
  const ch=new Uint8Array(46+nb.length);
  const cv=new DataView(ch.buffer);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
  cv.setUint16(10,0,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);
  cv.setUint16(28,nb.length,true);cv.setUint16(42,0,true);ch.set(nb,46); /* 本地头在 zip 开头，偏移 0 */
  const eocd=new Uint8Array(22);
  const ev=new DataView(eocd.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,1,true);ev.setUint16(10,1,true);
  ev.setUint32(12,ch.length,true);ev.setUint32(16,30+nb.length+bytes.length,true);
  return new Blob([lh,bytes,ch,eocd]);
}
const fileOf=blob=>new File([blob],'card.png',{type:'image/png'});

const V2={
  spec:'chara_card_v2',
  data:{name:'艾莉丝',description:'银发的图书管理员。',first_mes:'你好，欢迎来到图书馆。\n今天想读点什么？',alternate_greetings:['雨夜的敲门声。'],tags:['图书员','温柔'],
    character_book:{entries:[{comment:'馆规',content:'保持安静。'},{name:'藏书',content:'三楼是禁区。'},{keys:['禁书'],content:'不可翻阅。'}]}},
};

describe('parseCardFile 解析',()=>{
  it('PNG tEXt chara：V2 卡归一（data 包裹 + 世界书 comment/name/keys 三形态取标题）',async()=>{
    const card=await parseCardFile(fileOf(pngWithText('chara',btoa(unescape(encodeURIComponent(JSON.stringify(V2)))))));
    expect(card.name).toBe('艾莉丝');
    expect(card.firstMes).toContain('图书馆');
    expect(card.altGreetings).toEqual(['雨夜的敲门声。']);
    expect(card.bookEntries).toEqual([{title:'馆规',content:'保持安静。'},{title:'藏书',content:'三楼是禁区。'},{title:'禁书',content:'不可翻阅。'}]);
    expect(card.warnings).toEqual([]);
  });
  it('PNG 无卡数据时给出可读错误',async()=>{
    await expect(parseCardFile(fileOf(pngWithText('other','x')))).rejects.toThrow(/没有角色卡数据/);
  });
  it('JSON V1 扁平结构：无 spec 直接读根字段',async()=>{
    const blob=new Blob([JSON.stringify({name:'V1卡',description:'旧版',first_mes:'hi'})]);
    const card=await parseCardFile(new File([blob],'card.json',{type:'application/json'}));
    expect(card.name).toBe('V1卡');
    expect(card.description).toBe('旧版');
  });
  it('JSON V3：世界书在 data.extensions.character_book；缺角色名写入 warnings',async()=>{
    const v3={spec:'chara_card_v3',data:{description:'无名的存在',first_mes:'……',extensions:{character_book:{entries:[{comment:'注',content:'内容'}]}}}};
    const blob=new Blob([JSON.stringify(v3)]);
    const card=await parseCardFile(new File([blob],'card.json',{type:'application/json'}));
    expect(card.name).toBe('');
    expect(card.bookEntries).toEqual([{title:'注',content:'内容'}]);
    expect(card.warnings.join()).toContain('角色名');
  });
  it('CHARX：zip 内 card.json（store-only）',async()=>{
    const blob=makeZipStored('card.json',new TextEncoder().encode(JSON.stringify(V2)));
    const card=await parseCardFile(new File([blob],'card.charx'));
    expect(card.name).toBe('艾莉丝');
    expect(card.bookEntries.length).toBe(3);
  });
  it('CHARX：deflate 条目走 DecompressionStream 解出',async()=>{
    const raw=new TextEncoder().encode(JSON.stringify(V2));
    const comp=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    /* 用压缩字节重建 zip（method 8）：复用 makeZipStored 的结构但改 method 与 csize 语义——直接手拼 */
    const enc=new TextEncoder(),nb=enc.encode('card.json');
    const lh=new Uint8Array(30+nb.length),lv=new DataView(lh.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(8,8,true);lv.setUint32(18,comp.length,true);lv.setUint32(22,raw.length,true);
    lv.setUint16(26,nb.length,true);lh.set(nb,30);
    const ch=new Uint8Array(46+nb.length),cv=new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(10,8,true);cv.setUint32(20,comp.length,true);cv.setUint32(24,raw.length,true);
    cv.setUint16(28,nb.length,true);cv.setUint16(42,0,true);ch.set(nb,46);
    const eocd=new Uint8Array(22),ev=new DataView(eocd.buffer);
    ev.setUint32(0,0x06054b50,true);ev.setUint16(8,1,true);ev.setUint16(10,1,true);
    ev.setUint32(12,ch.length,true);ev.setUint32(16,30+nb.length+comp.length,true); /* 数据区是压缩后字节 */
    const card=await parseCardFile(new File([new Blob([lh,comp,ch,eocd])],'card.charx'));
    expect(card.name).toBe('艾莉丝');
  });
  it('非卡文件给出可读错误',async()=>{
    const blob=new Blob(['这不是卡']);
    await expect(parseCardFile(new File([blob],'x.txt'))).rejects.toThrow(/无法识别的角色卡文件/);
  });
});

describe('buildPlan 计划生成',()=>{
  it('按卡内容列项：全有→三项；精简卡→只列开场白',()=>{
    const full=buildPlan(await0(V2));
    expect(full.items.map(x=>x.id)).toEqual(['greet','desc','book']);
    const slim=buildPlan({name:'s',description:'',firstMes:'hi',altGreetings:[],tags:[],bookEntries:[],warnings:[]});
    expect(slim.items.map(x=>x.id)).toEqual(['greet']);
  });
});
/* 小桥：buildPlan 收归一后的卡；测试里直接喂同形状对象 */
function await0(x){return {name:x.data.name,description:x.data.description,firstMes:x.data.first_mes,altGreetings:x.data.alternate_greetings,tags:x.data.tags,bookEntries:x.data.character_book.entries.map(e=>({title:e.comment??e.name??(e.keys?e.keys.join('、'):''),content:e.content})),warnings:[]}}

describe('applyImportPlan 工程应用',()=>{
  it('勾选全部：占位列表/角色简介/标题库草稿按映射落位，区块启用',()=>{
    const p=defaultProject('t');
    p.blocks.find(b=>b.type==='profile').enabled=false; /* profile 是核心区块默认启用，先关掉才验证「导入开启」 */
    applyImportPlan(p,await0(V2),['greet','desc','book']);
    const g=p.blocks.find(b=>b.type==='greetings'),pr=p.blocks.find(b=>b.type==='profile');
    expect(g.enabled).toBe(true);
    expect(g.placeholderList.split('\n').length).toBe(2); /* 主 + 1 备用 */
    expect(g.placeholderList.split('\n')[0]).toContain('你好，欢迎来到图书馆');
    expect(pr.enabled).toBe(true);
    expect(pr.characters[0]).toEqual({name:'艾莉丝',desc:'银发的图书管理员。',tags:'图书员,温柔',avatar:'',avatarMode:'manual'});
    expect(g.titleBookDraft).toBe('0|馆规|保持安静。\n1|藏书|三楼是禁区。\n2|禁书|不可翻阅。');
  });
  it('只勾 greet：简介与草稿不动',()=>{
    const p=defaultProject('t');
    p.blocks.find(b=>b.type==='profile').enabled=false;
    applyImportPlan(p,await0(V2),['greet']);
    const g=p.blocks.find(b=>b.type==='greetings'),pr=p.blocks.find(b=>b.type==='profile');
    expect(g.enabled).toBe(true);
    expect(pr.enabled).toBe(false);
    expect(g.titleBookDraft).toBe('');
    expect(pr.characters[0].name).toBe('{{char}}');
  });
  it('newProject 的 greetings create() 带 titleBookDraft 字段（normalize 白名单传播）',()=>{
    expect(BLOCK_DEFS.greetings.create().titleBookDraft).toBe('');
    const p=defaultProject('t');
    const g=p.blocks.find(b=>b.type==='greetings');
    delete g.titleBookDraft;
    Project.normalize(p); /* 模拟旧工程：normalize 补齐 */
    expect(g.titleBookDraft).toBe('');
  });
});

describe('toV2Card 组装',()=>{
  it('输出 spec+data 形状，alternate_greetings 拷贝不共享引用',()=>{
    const card=await0(V2);
    const v2=toV2Card(card);
    expect(v2.spec).toBe('chara_card_v2');
    expect(v2.data.first_mes).toContain('图书馆');
    v2.data.alternate_greetings.push('x');
    expect(card.altGreetings.length).toBe(1);
  });
});
