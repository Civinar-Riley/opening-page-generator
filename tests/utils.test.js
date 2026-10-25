/* 工具函数单元测试（esc / uid / highlightCode / 对比度 / API Key 加解密） */
import { describe, it, expect } from 'vitest';
import { esc, uid, highlightCode, hexLuma, contrastRatio } from '../src/js/utils.js';

describe('hexLuma / contrastRatio 对比度（v1.24 主题警示用）',()=>{
  it('WCAG 锚点值：黑 0 / 白 1 / 黑白对比 21:1',()=>{
    expect(hexLuma('#000000')).toBe(0);
    expect(hexLuma('#ffffff')).toBe(1);
    expect(contrastRatio('#000000','#ffffff')).toBeCloseTo(21,5);
  });
  it('已知色对落在标准区间（WCAG 计算样例）',()=>{
    expect(contrastRatio('#767676','#ffffff')).toBeGreaterThan(4.4);
    expect(contrastRatio('#767676','#ffffff')).toBeLessThan(4.6);
    expect(contrastRatio('#f0f0f5','#1a1a2e')).toBeGreaterThan(10);
  });
  it('大小写与短写/非法输入：非 6 位 hex 返回 null 让调用方跳过警示',()=>{
    expect(hexLuma('#ABCDEF')).toBe(hexLuma('#abcdef'));
    expect(hexLuma('red')).toBeNull();
    expect(hexLuma('')).toBeNull();
    expect(hexLuma(null)).toBeNull();
    expect(contrastRatio('rgba(0,0,0,.5)','#fff')).toBeNull();
  });
});

describe('esc HTML 转义',()=>{
  it('转义 < > & " 四类字符',()=>{
    expect(esc('<div class="a">&</div>')).toBe('&lt;div class=&quot;a&quot;&gt;&amp;&lt;/div&gt;');
  });
  it('转义单引号（属性上下文防御）',()=>{
    expect(esc("it's")).toBe('it&#39;s');
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

describe('highlightCode 导出代码高亮',()=>{
  it('标签名高亮',()=>{
    expect(highlightCode('<div>')).toContain("&lt;<span class='hl-tag'>div</span>");
  });
  it('JS 比较符 a<b 不误伤为标签',()=>{
    expect(highlightCode('a<b')).not.toContain('hl-tag');
  });
  it('属性名与字符串高亮',()=>{
    const h=highlightCode('<div class="x">');
    expect(h).toContain("<span class='hl-attr'>class</span>");
    expect(h).toContain("<span class='hl-str'>\"x\"</span>");
  });
  it('换行分隔的多个标签全部高亮（含闭合标签前的边界）',()=>{
    const h=highlightCode('<b>\n<i>x</i>\n</b>');
    expect((h.match(/hl-tag/g)||[]).length).toBe(3);
  });
});
