/* 全局搜索替换纯函数单元测试（collectSearchMatches / replaceAllInString / replaceAllInProject） */
import { describe, it, expect } from 'vitest';
import { collectSearchMatches, replaceAllInString, replaceAllInProject } from '../src/js/search.js';

const sampleBlocks=()=>[
  {type:'welcome',title:'欢迎来到酒馆',subtitle:'旅程开始'},
  {type:'quote',text:'愿风指引你 {{char}}',source:'某诗人'},
  {type:'profile',characters:[{name:'林晚晴',desc:'剑修',tags:'剑,侠客',avatar:'a.jpg'}]},
  {type:'gallery',images:[{url:'https://x/img1.png',cap:'第一章插图'}]},
  {type:'bgm',tracks:[{name:'风之歌',url:'https://x/song.mp3'}]},
  {type:'qa',groups:[{name:'世界观',items:[{q:'酒馆在哪',a:'山脚'}]}]},
];

describe('collectSearchMatches 匹配收集',()=>{
  it('空关键词返回空数组',()=>{
    expect(collectSearchMatches(sampleBlocks(),'  ')).toEqual([]);
  });
  it('匹配区块顶层字段',()=>{
    const m=collectSearchMatches(sampleBlocks(),'酒馆');
    expect(m.length).toBeGreaterThanOrEqual(1);
    expect(m[0].field).toBe('title');
    expect(m[0].path).toContain('区块 #1');
  });
  it('大小写不敏感匹配',()=>{
    const m=collectSearchMatches([{type:'welcome',title:'Hello World'}],'hello');
    expect(m).toHaveLength(1);
  });
  it('匹配角色子项',()=>{
    const m=collectSearchMatches(sampleBlocks(),'剑修');
    expect(m).toHaveLength(1);
    expect(m[0].parent).toBe('characters');
    expect(m[0].subIdx).toBe(0);
    expect(m[0].subField).toBe('desc');
  });
  it('匹配图片子项',()=>{
    const m=collectSearchMatches(sampleBlocks(),'img1');
    expect(m).toHaveLength(1);
    expect(m[0].parent).toBe('images');
  });
  it('匹配曲目子项',()=>{
    const m=collectSearchMatches(sampleBlocks(),'风之歌');
    expect(m).toHaveLength(1);
    expect(m[0].parent).toBe('tracks');
  });
  it('匹配 QA 组名与问答条目',()=>{
    const m=collectSearchMatches(sampleBlocks(),'世界观');
    expect(m.some(x=>x.parent==='groups')).toBe(true);
    const q=collectSearchMatches(sampleBlocks(),'山脚');
    expect(q.some(x=>x.parent==='groups.items')).toBe(true);
    expect(q[0].subIdx).toBe('0.0');
  });
  it('非字符串字段不误匹配',()=>{
    const m=collectSearchMatches([{type:'dice',count:30}],'30');
    expect(m).toHaveLength(0);
  });
  it('v1.9+ 区块的标量文案字段可匹配（回归：eyebrow/leaveText/logo/hint/cover/cards/excludedTags 漏扫）',()=>{
    const blocks=[
      {type:'welcome',eyebrow:'STORY OPENING'},
      {type:'gate',leaveText:'不，我未满18岁并离开',logo:'CHARACTER CARD'},
      {type:'egg',hint:'✦ 诱饵'},
      {type:'blurreveal',hint:'点击显示'},
      {type:'comic',cover:'https://x/cover.png'},
      {type:'gacha',cards:'SSR｜命运之刃｜传闻'},
      {type:'greetings',excludedTags:'status,设定',entries:[{cover:'https://x/mycover.png',audio:'https://x/a.mp3'}]},
    ];
    const m=collectSearchMatches(blocks,'命运之刃');
    expect(m).toHaveLength(1);
    expect(m[0].field).toBe('cards');
    expect(collectSearchMatches(blocks,'opening')).toHaveLength(1);
    expect(collectSearchMatches(blocks,'未满18岁')).toHaveLength(1);
    expect(collectSearchMatches(blocks,'character card')).toHaveLength(1);
    expect(collectSearchMatches(blocks,'诱饵')).toHaveLength(1);
    expect(collectSearchMatches(blocks,'点击显示')).toHaveLength(1);
    expect(collectSearchMatches(blocks,'cover.png')).toHaveLength(2); /* comic 顶层 cover + greetings 项封面 */
    const en=collectSearchMatches(blocks,'a.mp3');
    expect(en).toHaveLength(1);
    expect(en[0].parent).toBe('entries');
    expect(en[0].subField).toBe('audio');
    expect(collectSearchMatches(blocks,'设定')).toHaveLength(1); /* excludedTags */
  });
  it('开场白项（entries）子项匹配带定位信息',()=>{
    const m=collectSearchMatches([{type:'greetings',entries:[{cover:'https://x/g1.png',audio:''},{cover:'',audio:''}]}],'g1.png');
    expect(m).toHaveLength(1);
    expect(m[0].parent).toBe('entries');
    expect(m[0].subIdx).toBe(0);
    expect(m[0].path).toContain('开场白项 1');
  });
});

describe('replaceAllInString 字面替换',()=>{
  it('普通替换计数正确',()=>{
    expect(replaceAllInString('a-b-a','a','X')).toBe('X-b-X');
  });
  it('正则元字符按字面匹配（. 不匹配任意字符）',()=>{
    expect(replaceAllInString('a.b','a.b','X')).toBe('X');   /* a.b 原样匹配 */
    expect(replaceAllInString('axb','a.b','X')).toBe('axb'); /* 不应被 . 通配 */
  });
  it('$& 不作为替换模式（字面输出）',()=>{
    expect(replaceAllInString('abc','a','$&')).toBe('$&bc');
  });
  it('非字符串原样返回',()=>{
    expect(replaceAllInString(42,'a','b')).toBe(42);
  });
});

describe('replaceAllInProject 工程级替换',()=>{
  it('替换全部字段并返回次数',()=>{
    const p={blocks:sampleBlocks()};
    const count=replaceAllInProject(p,'林','森');
    expect(count).toBe(1); /* 仅角色 name 含「林」 */
    expect(p.blocks[2].characters[0].name).toBe('森晚晴');
  });
  it('无匹配返回 0 且不改数据',()=>{
    const p={blocks:[{type:'welcome',title:'你好'}]};
    expect(replaceAllInProject(p,'不存在','X')).toBe(0);
    expect(p.blocks[0].title).toBe('你好');
  });
  it('替换覆盖新字段与开场白项（与 collectSearchMatches 同一份字段全集）',()=>{
    const p={blocks:[
      {type:'gate',leaveText:'离开这里',logo:''},
      {type:'comic',cover:'https://old/cd.png',pages:[{url:'https://old/1.png',cap:''}]},
      {type:'gacha',cards:'SSR｜命运之刃'},
      {type:'greetings',entries:[{cover:'https://old/g1.png',audio:''}],excludedTags:'old,设定'},
    ]};
    const count=replaceAllInProject(p,'old','new');
    expect(count).toBe(4);
    expect(p.blocks[1].cover).toBe('https://new/cd.png');
    expect(p.blocks[1].pages[0].url).toBe('https://new/1.png');
    expect(p.blocks[3].entries[0].cover).toBe('https://new/g1.png');
    expect(p.blocks[3].excludedTags).toBe('new,设定');
  });
});
/* v1.30.1 回归：titleBookDraft 是可编辑用户内容字段，纳入搜索与替换 */
describe('titleBookDraft 纳入搜索替换',()=>{
  it('collectSearchMatches 命中标题库草稿',()=>{
    const m=collectSearchMatches([{type:'greetings',titleBookDraft:'壹｜星陨之夜｜流星坠落时'}],'星陨');
    expect(m).toHaveLength(1);
    expect(m[0].field).toBe('titleBookDraft');
  });
  it('replaceAllInProject 覆盖标题库草稿',()=>{
    const p={blocks:[{type:'greetings',titleBookDraft:'壹｜星陨之夜｜流星坠落时'}]};
    expect(replaceAllInProject(p,'星陨','月沉')).toBe(1);
    expect(p.blocks[0].titleBookDraft).toBe('壹｜月沉之夜｜流星坠落时');
  });
});
/* v1.32 回归：entries[].title（封面/音轨绑定标题）是可编辑用户内容，纳入搜索与替换 */
describe('开场白项绑定标题（entries.title）纳入搜索替换',()=>{
  it('collectSearchMatches 命中绑定标题并带定位',()=>{
    const m=collectSearchMatches([{type:'greetings',entries:[{title:'雨夜邂逅',cover:'',audio:''}]}],'雨夜');
    expect(m).toHaveLength(1);
    expect(m[0].parent).toBe('entries');
    expect(m[0].subField).toBe('title');
    expect(m[0].path).toContain('开场白项 1');
  });
  it('replaceAllInProject 覆盖绑定标题',()=>{
    const p={blocks:[{type:'greetings',entries:[{title:'雨夜邂逅',cover:'https://old/c.png',audio:''}]}]};
    expect(replaceAllInProject(p,'雨夜','雪夜')).toBe(1);
    expect(p.blocks[0].entries[0].title).toBe('雪夜邂逅');
  });
});
/* v1.32.3 回归：工程级字段（正则标记 / 自定义宏 k/v）纳入搜索替换——此前只遍历 blocks */
describe('工程级字段（marker/macros）纳入搜索替换',()=>{
  it('collectSearchMatches 传整个工程命中 marker 与宏，blockIdx=-1 标记工程级',()=>{
    const proj={marker:'【艾莉丝上场】',macros:[{k:'艾莉丝',v:'艾莉丝的招呼'},{k:'user',v:'{{user}}'}],blocks:[]};
    const m=collectSearchMatches(proj,'艾莉丝');
    expect(m).toHaveLength(3);
    expect(m[0]).toMatchObject({blockIdx:-1,subField:'marker',path:'正则标记（导出页）'});
    expect(m.filter(x=>x.parent==='macros')).toHaveLength(2);
  });
  it('仍兼容直接传区块数组（旧调用形状）',()=>{
    expect(collectSearchMatches([{type:'welcome',title:'你好'}],'你好')).toHaveLength(1);
  });
  it('replaceAllInProject 覆盖 marker 与宏 k/v，计数合并',()=>{
    const p={marker:'【艾莉丝】',macros:[{k:'艾莉丝',v:'艾莉丝的招呼'}],blocks:[{type:'welcome',title:'{{艾莉丝}}欢迎'}]};
    expect(replaceAllInProject(p,'艾莉丝','雪乃')).toBe(4);
    expect(p.marker).toBe('【雪乃】');
    expect(p.macros[0]).toEqual({k:'雪乃',v:'雪乃的招呼'});
    expect(p.blocks[0].title).toBe('{{雪乃}}欢迎');
  });
});
