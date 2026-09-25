/* 宏替换引擎单元测试 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Macros } from '../src/js/macros.js';

beforeEach(()=>{Macros.vars={};Macros.resetCache()});

describe('自定义宏与内置宏',()=>{
  it('替换自定义宏',()=>{
    expect(Macros.apply('你好 {{char}}',[{k:'char',v:'艾莉丝'}])).toBe('你好 艾莉丝');
  });
  it('宏名大小写不敏感',()=>{
    expect(Macros.apply('你好 {{CHAR}}',[{k:'char',v:'艾莉丝'}])).toBe('你好 艾莉丝');
  });
  it('未知宏保留原文',()=>{
    expect(Macros.apply('{{unknown_x}}')).toBe('{{unknown_x}}');
  });
  it('weekday 输出星期X',()=>{
    expect(Macros.apply('{{weekday}}')).toMatch(/^星期[日一二三四五六]$/);
  });
  it('time 输出 HH:MM',()=>{
    expect(Macros.apply('{{time}}')).toMatch(/^\d{2}:\d{2}$/);
  });
  it('date 输出 YYYY-MM-DD',()=>{
    expect(Macros.apply('{{date}}')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('随机宏',()=>{
  it('random 双冒号语法取列表之一',()=>{
    for(let i=0;i<30;i++){
      expect(['红','蓝']).toContain(Macros.apply('{{random::红::蓝}}'));
    }
  });
  it('pick 别名可用',()=>{
    expect(['a','b','c']).toContain(Macros.apply('{{pick::a::b::c}}'));
  });
  it('random 单冒号+逗号旧版语法 {{random:a,b}}',()=>{
    for(let i=0;i<30;i++){
      expect(['红','蓝']).toContain(Macros.apply('{{random:红,蓝}}'));
    }
  });
  it('random 单冒号头 + 双冒号列表混用',()=>{
    for(let i=0;i<30;i++){
      expect(['a','b']).toContain(Macros.apply('{{random:a::b}}'));
    }
  });
  it('pick 单冒号+逗号旧版语法',()=>{
    expect(['a','b']).toContain(Macros.apply('{{pick:a,b}}'));
  });
  it('空选项被过滤',()=>{
    for(let i=0;i<20;i++){
      expect(['a','b']).toContain(Macros.apply('{{random::a::::b}}'));
    }
  });
  it('选项内含一层花括号可正常替换',()=>{
    for(let i=0;i<20;i++){
      expect(['a{b}','c']).toContain(Macros.apply('{{random::a{b}::c}}'));
    }
  });
  it('选项内花括号 + 双冒号分隔混用',()=>{
    for(let i=0;i<20;i++){
      expect(['{x}伤','{y}伤']).toContain(Macros.apply('{{random::{x}伤::{y}伤}}'));
    }
  });
});

describe('掷骰宏',()=>{
  it('roll 表达式 2d6+3 落在合法区间',()=>{
    for(let i=0;i<50;i++){
      const r=+Macros.apply('{{roll::2d6+3}}');
      expect(r).toBeGreaterThanOrEqual(5);
      expect(r).toBeLessThanOrEqual(15);
    }
  });
  it('roll 空格旧版 {{roll 100}} 落在 1..100',()=>{
    for(let i=0;i<50;i++){
      const r=+Macros.apply('{{roll 100}}');
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(100);
    }
  });
  it('roll 单冒号表达式 {{roll:2d6+3}}',()=>{
    for(let i=0;i<50;i++){
      const r=+Macros.apply('{{roll:2d6+3}}');
      expect(r).toBeGreaterThanOrEqual(5);
      expect(r).toBeLessThanOrEqual(15);
    }
  });
  it('roll 单冒号旧版 {{roll:100}} 落在 1..100',()=>{
    for(let i=0;i<50;i++){
      const r=+Macros.apply('{{roll:100}}');
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(100);
    }
  });
});

describe('变量池 setvar/getvar',()=>{
  it('setvar 后 getvar 读回',()=>{
    expect(Macros.apply('{{setvar::gold::99}}{{getvar::gold}}')).toBe('99');
  });
  it('setvar 空格语法',()=>{
    expect(Macros.apply('{{setvar hp 42}}{{getvar::hp}}')).toBe('42');
  });
  it('getvar 未定义返回空串',()=>{
    expect(Macros.apply('[{{getvar::nope}}]')).toBe('[]');
  });
  it('vars 跨调用共享（预览级）',()=>{
    Macros.apply('{{setvar::k::v1}}');
    expect(Macros.apply('{{getvar::k}}')).toBe('v1');
  });
});

describe('dice / pickOne / splitArgs',()=>{
  it('dice 1d20 区间 [1,20]',()=>{
    for(let i=0;i<100;i++){
      const r=Macros.dice('1d20');
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(20);
    }
  });
  it('dice d100 区间 [1,100]',()=>{
    const r=Macros.dice('d100');
    expect(r).toBeGreaterThanOrEqual(1);
    expect(r).toBeLessThanOrEqual(100);
  });
  it('dice 非法表达式返回 null',()=>{
    expect(Macros.dice('abc')).toBeNull();
  });
  it('dice 面数上限 1000（极端表达式钳制）',()=>{
    const r=Macros.dice('1d99999999');
    expect(r).toBeGreaterThanOrEqual(1);
    expect(r).toBeLessThanOrEqual(1000);
  });
  it('splitArgs 按双冒号拆分并去除空白',()=>{
    expect(Macros.splitArgs(' a :: b ::c ')).toEqual(['a','b','c']);
  });
  it('pickOne 双冒号分隔',()=>{
    expect(['a','b','c']).toContain(Macros.pickOne('a::b::c'));
  });
  it('pickOne 逗号分隔',()=>{
    expect(['a','b','c']).toContain(Macros.pickOne('a,b,c'));
  });
});

describe('预览随机结果缓存',()=>{
  beforeEach(()=>{Macros.resetCache()});
  it('缓存期内同一随机宏结果稳定（编辑时预览不闪变）',()=>{
    const a=Macros.apply('{{random::红::蓝}}');
    for(let i=0;i<10;i++)expect(Macros.apply('{{random::红::蓝}}')).toBe(a);
  });
  it('roll 同理稳定',()=>{
    const a=Macros.apply('{{roll::2d6+3}}');
    for(let i=0;i<10;i++)expect(Macros.apply('{{roll::2d6+3}}')).toBe(a);
  });
  it('resetCache 后重新抽取，结果仍在列表内',()=>{
    Macros.apply('{{random::红::蓝}}');
    Macros.resetCache();
    expect(['红','蓝']).toContain(Macros.apply('{{random::红::蓝}}'));
  });
});
