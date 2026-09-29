/* 扩展桥纯函数单测（hasBridge/resolveAiChannel 只读 window.parent，node 下 stub 模拟） */
import { describe, it, expect, afterEach } from 'vitest';
import { hasBridge, resolveAiChannel, buildTavernAiPayload, greetSnapshot } from '../src/js/ui/extBridge.js';

afterEach(()=>{delete globalThis.window});

describe('extBridge hasBridge',()=>{
  it('无 window（node 裸环境 ReferenceError）→ false',()=>{
    expect(hasBridge()).toBe(false);
  });
  it('桥不完整（缺方法）→ false；完整 → true',()=>{
    globalThis.window={parent:{}};
    expect(hasBridge()).toBe(false);
    globalThis.window={parent:{__OPG_EXT__:{}}};
    expect(hasBridge()).toBe(false);
    globalThis.window={parent:{__OPG_EXT__:{listCards(){},writeToCard(){}}}};
    expect(hasBridge()).toBe(true);
  });
  it('parent 访问抛错（跨域 SecurityError 模拟）→ false 而非崩溃',()=>{
    Object.defineProperty(globalThis,'window',{configurable:true,get(){throw new Error('SecurityError')}});
    expect(hasBridge()).toBe(false);
  });
});

describe('extBridge resolveAiChannel',()=>{
  it('无桥 / aiAvailable 为 false → custom',()=>{
    expect(resolveAiChannel(undefined)).toBe('custom');
    globalThis.window={parent:{__OPG_EXT__:{aiAvailable:()=>false}}};
    expect(resolveAiChannel(undefined)).toBe('custom');
  });
  it('aiAvailable 为 true → 默认 tavern；显式选择被尊重',()=>{
    globalThis.window={parent:{__OPG_EXT__:{aiAvailable:()=>true}}};
    expect(resolveAiChannel(undefined)).toBe('tavern');
    expect(resolveAiChannel('tavern')).toBe('tavern');
    expect(resolveAiChannel('custom')).toBe('custom');
  });
  it('aiAvailable 非函数 → custom（防宿主半实现）',()=>{
    globalThis.window={parent:{__OPG_EXT__:{aiAvailable:true}}};
    expect(resolveAiChannel(undefined)).toBe('custom');
  });
});

describe('extBridge buildTavernAiPayload',()=>{
  it('ordered_prompts 顺序（system→user）+ should_silence 静默生成',()=>{
    const p=buildTavernAiPayload('SYS-提示','用户需求');
    expect(p.should_silence).toBe(true);
    expect(p.ordered_prompts).toEqual([
      {role:'system',content:'SYS-提示'},
      {role:'user',content:'用户需求'},
    ]);
  });
  it('null/undefined 输入安全转为空串',()=>{
    const p=buildTavernAiPayload(null,undefined);
    expect(p.ordered_prompts[0].content).toBe('');
    expect(p.ordered_prompts[1].content).toBe('');
  });
});

describe('extBridge greetSnapshot 写卡开场白快照',()=>{
  it('firstMes + 备用开场白合并，trim 后滤空白',()=>{
    expect(greetSnapshot({firstMes:' A ',alternateGreetings:['B','','  ','C']})).toEqual(['A','B','C']);
  });
  it('无卡 / 空卡 → 空数组（弹窗回落原占位列表）',()=>{
    expect(greetSnapshot(null)).toEqual([]);
    expect(greetSnapshot(undefined)).toEqual([]);
    expect(greetSnapshot({firstMes:'',alternateGreetings:[]})).toEqual([]);
  });
  it('旧版宿主桥不回 firstMes → 仅备用开场白（向前兼容降级）',()=>{
    expect(greetSnapshot({alternateGreetings:['X']})).toEqual(['X']);
  });
});
