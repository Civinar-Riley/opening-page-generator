import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { UI_THEMES } from '../src/js/defs.js';

const css=readFileSync(new URL('../src/css/tool.css',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=>({selector:m[1].trim(),body:m[2]}));
const rule=selector=>rules.find(r=>r.selector===selector)?.body||'';
const tokens=selector=>Object.fromEntries([...rule(selector).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
const root=tokens(':root');
const added=UI_THEMES.filter(t=>['velvet','moonstone'].includes(t.id));
function luminance(hex){
  const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
function contrast(a,b){
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

describe('工具主题契约',()=>{
  it('保留原有五套并追加两套深色主题，标识与名称唯一',()=>{
    expect(UI_THEMES).toEqual([
      {id:'bronze',name:'暖铜金'},{id:'star',name:'星夜'},{id:'blueprint',name:'蓝图'},
      {id:'crt',name:'磷光'},{id:'abyss',name:'深海'},{id:'velvet',name:'绯幕'},{id:'moonstone',name:'月岩'},
    ]);
    expect(new Set(UI_THEMES.map(t=>t.id)).size).toBe(UI_THEMES.length);
    expect(new Set(UI_THEMES.map(t=>t.name)).size).toBe(UI_THEMES.length);
    expect(Object.keys(root).length).toBeGreaterThan(20);
  });
  it.each(UI_THEMES.filter(t=>t.id!=='bronze'))('$name 显式覆盖所有根令牌',({id})=>{
    const own=tokens(`html[data-theme='${id}']`);
    expect(Object.keys(own).sort()).toEqual(Object.keys(root).sort());
    Object.values(own).forEach(value=>expect(value).not.toBe(''));
    expect(own['--star-c']).toBeTruthy();
  });
  it('主题 CSS 与注册表一致，默认暖铜金无需属性选择器',()=>{
    const ids=[...css.matchAll(/html\[data-theme='([^']+)'\]\s*\{/g)].map(m=>m[1]);
    expect(ids.sort()).toEqual(UI_THEMES.filter(t=>t.id!=='bronze').map(t=>t.id).sort());
  });
  it.each(added)('$name 的三层底色均为深色',({id})=>{
    const t=tokens(`html[data-theme='${id}']`);
    ['--bg','--panel','--panel2'].forEach(key=>expect(luminance(t[key]),key).toBeLessThan(.05));
    expect(rule(`html[data-theme='${id}']`)).toMatch(/color-scheme:\s*dark/);
  });
  it.each(added)('$name 文字、强调色和状态色在各层底色上达到 4.5:1',({id})=>{
    const t=tokens(`html[data-theme='${id}']`);
    for(const fg of ['--txt','--txt2','--txt3','--acc','--ok','--warn','--err']){
      for(const bg of ['--bg','--panel','--panel2'])expect(contrast(t[fg],t[bg]),`${fg} / ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it.each(added)('$name 主按钮默认与悬停文字达到 4.5:1',({id})=>{
    const t=tokens(`html[data-theme='${id}']`);
    expect(contrast('#1a1a1a',t['--acc'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff',t['--acc2'])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(added)('$name 背景纹理不遮挡内容或接管点击',({id})=>{
    const selector=`html[data-theme='${id}']`;
    const texture=rule(`${selector} body::before`);
    expect(texture).toMatch(/pointer-events:\s*none/);
    expect(texture).toMatch(/z-index:\s*0/);
    expect(texture).not.toMatch(/animation:/);
    for(const target of ['#topbar','#tabs','#main']){
      expect(rules.some(r=>r.selector.split(',').map(s=>s.trim()).includes(`${selector} ${target}`)&&/position:\s*relative/.test(r.body)&&/z-index:\s*1/.test(r.body))).toBe(true);
    }
  });
});
