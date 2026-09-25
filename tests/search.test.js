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
});
