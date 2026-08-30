/* 工具函数单元测试（esc / uid / API Key 加解密） */
import { describe, it, expect } from 'vitest';
import { esc, uid, encryptApiKey, decryptApiKey } from '../src/js/utils.js';

describe('esc HTML 转义',()=>{
  it('转义 < > & " 四类字符',()=>{
    expect(esc('<div class="a">&</div>')).toBe('&lt;div class=&quot;a&quot;&gt;&amp;&lt;/div&gt;');
  });
  it('null / undefined 转空串',()=>{
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
  it('普通文本原样保留',()=>{
    expect(esc('普通文本 123')).toBe('普通文本 123');
  });
});

describe('uid 唯一性',()=>{
  it('批量生成不重复',()=>{
    const s=new Set(Array.from({length:2000},uid));
    expect(s.size).toBe(2000);
  });
});

describe('API Key AES-GCM 加解密',()=>{
  it('加解密往返还原明文',async()=>{
    const enc=await encryptApiKey('sk-secret-123','口令abc');
    const obj=JSON.parse(enc);
    expect(obj.salt).toBeDefined();
    expect(obj.iv).toBeDefined();
    expect(obj.ct).toBeDefined();
    expect(await decryptApiKey(enc,'口令abc')).toBe('sk-secret-123');
  });
  it('错误口令解密返回 null',async()=>{
    const enc=await encryptApiKey('sk-secret','right');
    expect(await decryptApiKey(enc,'wrong')).toBeNull();
  });
  it('损坏密文返回 null（不抛异常）',async()=>{
    expect(await decryptApiKey('not-json','x')).toBeNull();
  });
  it('随机盐导致同一明文密文不同',async()=>{
    const a=await encryptApiKey('same','pw');
    const b=await encryptApiKey('same','pw');
    expect(a).not.toBe(b);
  });
});
