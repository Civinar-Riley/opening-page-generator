/* 组件库硬约束扫描 + 新增能力单元测试 */
import { describe, it, expect } from 'vitest';
import { COMP_LIB } from '../src/js/defs.js';
import { Gen } from '../src/js/gen/index.js';
import { Macros } from '../src/js/macros.js';
import { defaultProject } from '../src/js/defs.js';

const SCRIPT_OK=new Set(['音乐播放器','交互计数器','点击切换消息']); /* 既有/重构特例：自带 IIFE 脚本（局部作用域、opg- 类名隔离、data-bound 防重绑） */

describe('COMP_LIB 组件库硬约束',()=>{
  it('全部组件有 cat 且分类合法',()=>{
    const cats=new Set(['text','info','role','tech','fx','fantasy','fun']);
    expect(COMP_LIB.length).toBeGreaterThanOrEqual(55);
    COMP_LIB.forEach(c=>{
      expect(cats.has(c.cat),c.name+' 缺少合法分类').toBe(true);
      expect(c.icon).toBeTruthy();
      expect(c.name).toBeTruthy();
    });
  });
  it('无 id 选择器、无全局选择器；script 仅音乐播放器特例',()=>{
    COMP_LIB.forEach(c=>{
      /* 允许 opg- 前缀 id（CSS 交互组件如多标签页/求签需要；多次插入同组件会共享状态，为已知取舍） */
      const ids=c.html.match(/id=["']([^"']*)/g)||[];
      expect(ids.every(x=>x.slice(4).startsWith('opg-')),c.name+' 含非 opg- 前缀 id').toBe(true);
      if(/<script/i.test(c.html))expect(SCRIPT_OK.has(c.name),c.name+' 含 script（不在特例表）').toBe(true);
    });
  });
  it('无 document/global 污染型全局函数定义（window.xxx=）',()=>{
    COMP_LIB.forEach(c=>{
      if(SCRIPT_OK.has(c.name))return;
      expect(/window\.\w+\s*=/.test(c.html),c.name+' 定义了全局函数').toBe(false);
    });
  });
});

describe('random_nr 不重复随机',()=>{
  it('相邻两次结果不同（多候选）',()=>{
    let dup=true;
    for(let i=0;i<20&&dup;i++){
      const a=Macros.pickOneNr('t:x','a::b::c');
      const b=Macros.pickOneNr('t:x','a::b::c');
      dup=a===b;
    }
    expect(dup).toBe(false);
  });
  it('单候选恒返回该值',()=>{
    expect(Macros.pickOneNr('t:y','only')).toBe('only');
  });
  it('{{random_nr::}} 宏可被 apply 识别',()=>{
    const out=Macros.apply('你好 {{random_nr::甲::乙::丙}}',[{k:'char',v:'x'}]);
    console.log('random_nr out:',JSON.stringify(out));
    expect(['你好 甲','你好 乙','你好 丙']).toContain(out);
  });
});

describe('auditCompat http 图片警告',()=>{
  it('gallery/profile 自由 HTML 的 http 图片判提示',()=>{
    const p=defaultProject('t');
    const g=p.blocks.find(b=>b.type==='gallery');
    g.enabled=true;g.images=[{url:'http://x/a.png',cap:''}];
    expect(Gen.auditCompat(p).items.some(x=>/http:\/\//.test(x.msg)&&/混合内容/.test(x.msg))).toBe(true);
    const pr=p.blocks.find(b=>b.type==='profile');
    pr.enabled=true;pr.characters=[{name:'a',desc:'',tags:'',avatar:'https://y/b.png',avatarMode:'manual'}];
    expect(Gen.auditCompat(p).items.filter(x=>/混合内容/.test(x.msg))).toHaveLength(1); /* https 不再新增 */
  });
});
