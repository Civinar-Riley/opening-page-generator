/* 字体检测纯逻辑单元测试（fontExists / detectAvailableFonts，ctx 用 mock 注入） */
import { describe, it, expect } from 'vitest';
import { fontExists, detectAvailableFonts, BASE_FONTS, FONT_TEST_STR } from '../src/js/fontdetect.js';

/* 构造可控的 mock 2d context：记录每次 measureText 的字体，并按规则返回宽度 */
function makeCtx(widthFor){
  const calls=[];
  return {
    _calls:calls,
    font:'',
    measureText(){
      calls.push(this.font);
      const key=widthFor(this.font);
      return {width:typeof key==='function'?key():key};
    },
  };
}

describe('fontExists 字体存在判定',()=>{
  it('任一 base 下宽度不同 → 存在',()=>{
    /* 带字体名时宽度 100，纯 base 时 50 → 判定存在 */
    const ctx=makeCtx(f=>f.includes('"微软雅黑"')?100:50);
    expect(fontExists(ctx,'微软雅黑')).toBe(true);
  });
  it('所有 base 下宽度一致 → 不存在',()=>{
    const ctx=makeCtx(()=>50);
    expect(fontExists(ctx,'不存在字体XYZ')).toBe(false);
  });
  it('font 属性被正确设置（带引号 + base 兜底）',()=>{
    const ctx=makeCtx(()=>50);
    fontExists(ctx,'楷体',['serif']);
    const allFonts=ctx._calls;
    expect(allFonts[0]).toBe('72px "楷体",serif');
    expect(allFonts[1]).toBe('72px serif');
  });
  it('遍历全部 base（默认 3 个）',()=>{
    const ctx=makeCtx(()=>50);
    fontExists(ctx,'宋体');
    expect(ctx._calls.length).toBe(BASE_FONTS.length*2);
  });
  it('默认测试串非空且含中英文',()=>{
    expect(FONT_TEST_STR).toMatch(/[A-Za-z]/);
    expect(FONT_TEST_STR).toMatch(/[\u4e00-\u9fa5]/);
  });
});

describe('detectAvailableFonts 过滤存在字体',()=>{
  it('只返回判定存在的字体',()=>{
    const ctx=makeCtx(f=>f.includes('"Arial"')||f.includes('"宋体"')?80:40);
    const found=detectAvailableFonts(ctx,['Arial','宋体','不存在的']);
    expect(found).toEqual(['Arial','宋体']);
  });
  it('全部不存在返回空数组',()=>{
    const ctx=makeCtx(()=>40);
    expect(detectAvailableFonts(ctx,['甲','乙'])).toEqual([]);
  });
  it('空清单返回空数组',()=>{
    const ctx=makeCtx(()=>40);
    expect(detectAvailableFonts(ctx,[])).toEqual([]);
  });
});