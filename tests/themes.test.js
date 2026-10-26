/* 页面主题：纯函数、生成物与存量工程回归，不依赖浏览器/酒馆 API。 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { THEME_PRESETS, BUILTIN_TEMPLATES, defaultProject } from '../src/js/defs.js';
import { THEME_SKINS, themeSkin, themePresetPatch, themePresetMatches, themeTexture } from '../src/js/themes.js';
import { Gen } from '../src/js/gen/index.js';
import { Project, setUI } from '../src/js/project.js';
import { contrastRatio } from '../src/js/utils.js';

const clone=x=>JSON.parse(JSON.stringify(x));
const purple=THEME_PRESETS[0],redesigned=THEME_PRESETS.slice(1),all=THEME_PRESETS;
const skins=['nebula','royal','festival','cyber','abyss','archive'];
/* 兼容基线：紫夜原配色 + 显式 classic（旧工程的实际渲染路径），与重构后的预设对象区分开 */
const classicPurple=()=>({...clone(purple.theme),skin:'classic',headingFont:''});
const fixture=theme=>{
  const p=defaultProject('主题回归');p.id='themefixture';
  if(theme)Object.assign(p.theme,clone(themePresetPatch(theme)));
  return p;
};
const classicFixture=()=>fixture(classicPurple());
const style=html=>html.match(/<style>\n([\s\S]*?)\n<\/style>/)[1];
const cssOf=(p,isPreview=false)=>style(Gen.build(p,{isPreview}));
const invalidSkins=[undefined,null,'','missing','__proto__','constructor','toString','ROYAL','royal;}',0,false,[],['royal'],{}, {toString:'royal'}];

describe('页面预设与材质纯函数',()=>{
  it('紫夜幻金保留原配色/圆角/对齐/动效/背景，只新增材质与标题字体',()=>{
    expect(purple.name).toBe('紫夜幻金');
    expect(purple.theme).toMatchObject({primary:'#7c6cf0',accent:'#e8c47c',textColor:'#f0f0f5',radius:12,titleAlign:'center',motion:'full',bg:{type:'gradient',color:'#161228',color2:'#261b42'}});
    expect(purple.theme.skin).toBe('nebula');
    expect(purple.theme.headingFont).toBeTruthy();
    expect(purple.theme.fontName).toBe('');
    expect(purple.caption).toBeTruthy();expect(purple.specimen).toBeTruthy();expect(purple.folio).toBeTruthy();
  });
  it('六套预设名称保持不变，全部六套各有独立皮肤与标题字体',()=>{
    expect(THEME_PRESETS.map(t=>t.name)).toEqual(['紫夜幻金','荆棘王室','狐火缘日','蓝电义体','渊语回廊','档案机']);
    expect(Object.keys(THEME_SKINS)).toEqual(['classic',...skins]);
    expect(all.map(t=>t.theme.skin)).toEqual(skins);
    all.forEach(t=>{
      expect(t.caption).toBeTruthy();expect(t.specimen).toBeTruthy();expect(t.folio).toBeTruthy();
      expect(t.theme.headingFont).toBeTruthy();expect(THEME_SKINS[t.theme.skin].font).toBeTruthy();
    });
    expect(defaultProject('t').theme.skin).toBe('classic');
  });
  it.each(THEME_PRESETS)('$name 两端底色：正文和强调均 ≥4.5:1，主色 ≥3:1',({theme:t})=>{
    /* 强调色也用于小字号标签，采用比界面警示 3:1 更严格的文字阈值。 */
    for(const bg of [t.bg.color,t.bg.color2]){
      expect(bg).toMatch(/^#[\da-f]{6}$/i);
      for(const [field,min] of [['textColor',4.5],['accent',4.5],['primary',3]]){
        expect(contrastRatio(t[field],bg),`${field} ${t[field]} / ${bg}`).toBeGreaterThanOrEqual(min);
      }
    }
  });
  it.each(Object.keys(THEME_SKINS))('合法 skin=%s 原样解析',skin=>{
    expect(themeSkin({skin})).toBe(skin);
  });
  it.each(invalidSkins.map(skin=>[skin]))('未知或非字符串 skin=%j 安全回落经典',skin=>{
    const theme={skin,primary:'#123456',accent:'#abcdef'};
    expect(themeSkin(theme)).toBe('classic');
    expect(themeTexture(theme)).toBe('');
  });
  it('缺失主题对象安全回落经典，不从 presetRef 猜测皮肤',()=>{
    expect(themeSkin()).toBe('classic');expect(themeSkin(null)).toBe('classic');
    redesigned.forEach(t=>expect(themeSkin({presetRef:t.name})).toBe('classic'));
  });
  it.each(THEME_PRESETS)('$name patch 不改预设输入且可重复应用',({theme})=>{
    const input=clone(theme);Object.freeze(input.bg);Object.freeze(input);
    const patch=themePresetPatch(input);
    expect(patch).not.toBe(input);
    expect(input).toEqual(theme);
    expect(themePresetPatch(patch)).toEqual(patch);
    expect(patch.skin).toBe(theme.skin||'classic');
    expect(patch.fontName).toBe(theme.fontName||'');
    expect(patch.headingFont).toBe(theme.headingFont||'');
  });
  it.each(THEME_PRESETS)('$name 匹配完整主题、兼容数字字符串与缺省空字体',({theme})=>{
    const current=clone(themePresetPatch(theme));current.radius=String(current.radius);
    expect(themePresetMatches(current,theme)).toBe(true);
    current.presetRef='其它名称';
    expect(themePresetMatches(current,theme)).toBe(true);
    if(!theme.skin)expect(themePresetMatches(clone(theme),theme)).toBe(true);
  });
  it.each(['skin','fontName','headingFont'])('%s 自定义立即偏离，改回原值恢复匹配',field=>{
    const target=redesigned[0].theme,current=clone(themePresetPatch(target));
    current[field]=field==='skin'?'classic':'Custom Fixture Font';
    expect(themePresetMatches(current,target)).toBe(false);
    current[field]=themePresetPatch(target)[field];
    expect(themePresetMatches(current,target)).toBe(true);
  });
  it.each(['primary','accent','textColor','radius','titleAlign','motion','bg'])('%s 偏离不能仅凭 presetRef 误判匹配',field=>{
    const target=redesigned[0].theme,current={...clone(target),presetRef:redesigned[0].name};
    current[field]=field==='bg'?{...current.bg,color2:'#000000'}:'different';
    expect(themePresetMatches(current,target)).toBe(false);
  });
  it('相同配色下六套主题仍有六种不同纹理，而非只换色；经典没有附加纹理',()=>{
    const textures=skins.map(skin=>themeTexture({skin,primary:'#123456',accent:'#abcdef'}));
    expect(new Set(textures).size).toBe(6);
    const signatures=['repeating-conic-gradient(from 0deg at 86% -6%','repeating-linear-gradient(45deg','radial-gradient(ellipse at 100% 0','transparent 1px 28px','repeating-radial-gradient','transparent 0 27px'];
    textures.forEach((texture,i)=>{
      expect(texture).toContain(signatures[i]);
      expect(texture).not.toMatch(/url\(|<|>|@import/);
      expect(themeTexture({skin:skins[i],primary:'#123456',accent:'#abcdef'})).toBe(texture);
    });
    expect(themeTexture({skin:'classic'})).toBe('');
  });
  it.each(skins)('%s 纹理颜色只接受六位 hex，畸形输入回落且不改源对象',skin=>{
    const t={skin,primary:'</style><img src=x>',accent:'url(https://example.test/)'};
    const before=clone(t),texture=themeTexture(t);
    expect(texture).toBe(themeTexture({skin,primary:'#7c6cf0',accent:'#e8c47c'}));
    expect(t).toEqual(before);
  });
});

describe('Gen 页面主题生成回归',()=>{
  it.each([
    [false,'cbe57a1d74fc452a482d4199a65f1730830fffaadda345cd59428b159e50e595'],
    [true,'fd544bceee1899c5b3ebd49d94045e04830f2124cf85d979d155e8e5fc0d32b0'],
  ])('紫夜旧 CSS 字节快照不变（经典兼容路径，自定义字体=%s）',(customFont,hash)=>{
    /* 基线来自重设计前 HEAD:src/js/gen/css.js，固定 id 与默认核心区块；不是新旧入口自比。
       锁的是旧工程实际走的 classic 路径，而非重构后的紫夜预设（后者已有 nebula 材质）。 */
    const p=classicFixture();
    if(customFont)Object.assign(p.theme,{fontName:'Custom Body',headingFont:'Custom Heading'});
    for(const preview of [false,true])expect(createHash('sha256').update(cssOf(p,preview)).digest('hex')).toBe(hash);
    expect(cssOf(p)).not.toContain('theme-skin:');
  });
  it.each(invalidSkins.map(skin=>[skin]))('未知 skin=%j 生成结果与 classic 完全一致（含字体回落）',skin=>{
    const p=classicFixture();Object.assign(p.theme,{fontName:'Custom Body',headingFont:'Custom Heading'});
    const expected=cssOf(p);p.theme.skin=skin;
    expect(cssOf(p)).toBe(expected);expect(cssOf(p,true)).toBe(expected);
  });
  it.each(THEME_PRESETS)('$name 预览、组件导出和完整文档的 CSS 完全一致',({theme})=>{
    const p=fixture(theme),before=clone(p),preview=cssOf(p,true);
    expect(cssOf(p)).toBe(preview);
    expect(style(Gen.buildFullDoc(p))).toBe(preview);
    expect(Gen.auditFullDoc(Gen.buildFullDoc(p)).ok).toBe(true);
    expect(p).toEqual(before);
  });
  it.each(all)('$name 只输出自身材质、标题字体回落和容器隔离样式',({theme})=>{
    const p=fixture(theme),css=cssOf(p),px=Gen.prefix(p);
    expect(css).toContain(`.${px}-wrap{background:${themeTexture(theme)},linear-gradient(160deg, ${theme.bg.color}, ${theme.bg.color2})}`);
    expect(css).toContain(`font-family:"${theme.headingFont}",${THEME_SKINS[theme.skin].font.split(',').slice(1).join(',')}`);
    expect(css).not.toContain(`"${theme.headingFont}","${theme.headingFont}"`);
    expect(css.match(/theme-skin:/g)).toHaveLength(1);
    const extra=css.split(`/* theme-skin:${theme.skin} */`)[1];
    expect(extra).toBeTruthy();
    for(const m of extra.matchAll(/([^{}]+)\{[^{}]*\}/g)){
      for(const selector of m[1].trim().split(','))expect(selector.startsWith(`.${px}-wrap`),selector).toBe(true);
    }
    expect(extra).not.toMatch(/-gate|-gcurcover|-rbody|freehtml|@import|url\(/);
  });
  it.each(all)('$name 材质与装饰花纹/噪点并存，封面墙与普通列表实例隔离',({theme})=>{
    const p=fixture(theme),px=Gen.prefix(p);
    p.theme.bg.type='noise';
    p.blocks=[
      {type:'decor',enabled:true,pattern:'stars',borderStyle:'double',topGlow:true},
      {type:'greetings',enabled:true,cardStyle:'wall',placeholderList:'封面｜说明'},
      {type:'greetings',enabled:true,cardStyle:'card',placeholderList:'列表｜说明'},
    ];
    const css=cssOf(p),extra=css.split(`/* theme-skin:${theme.skin} */`)[1];
    expect(css).toContain(`.${px}-wrap::before{content:"`);
    expect(css).toContain('feTurbulence');expect(css).toContain('pointer-events:none;border-radius:inherit');
    expect(css).toContain(`border-top:2px solid ${theme.accent}`);
    expect(css).toContain(`.${px}-bk1{display:contents}`);expect(css).toContain(`.${px}-bk2{display:contents}`);
    expect(extra).toContain(`.${px}-wrap .${px}-bk1 .${px}-gitem{padding:0;border:1px solid ${theme.primary}55}`);
    expect(extra).not.toContain(`.${px}-bk2 .${px}-gitem{padding:0`);
    expect(extra).not.toContain(`.${px}-wrap::before`);expect(extra).not.toContain(`.${px}-wrap::after`);
  });
  it.each(THEME_PRESETS)('$name 内容宏保持预览替换/导出原样双轨',({theme})=>{
    const p=fixture(theme),px=Gen.prefix(p);p.macros=[{k:'char',v:'测试角色'},{k:'user',v:'测试读者'}];
    p.blocks=[
      {type:'welcome',enabled:true,title:'{{char}}的世界',subtitle:'欢迎{{user}}',decoStyle:'none'},
      {type:'profile',enabled:true,showName:true,showDesc:true,characters:[{name:'{{char}}',desc:'你好{{user}}'}]},
      {type:'greetings',enabled:true,cardStyle:'card',placeholderList:'{{char}}｜{{user}}的开场'},
    ];
    const preview=Gen.build(p,{isPreview:true}),exported=Gen.build(p,{isPreview:false});
    expect(preview).toContain(`class="${px}-title">测试角色的世界`);
    expect(preview).toContain('你好测试读者');expect(preview).toContain('测试读者的开场');
    expect(preview).not.toContain('{{char}}');expect(preview).not.toContain('{{user}}');
    expect(exported).toContain(`class="${px}-title">{{char}}的世界`);
    expect(exported).toContain('你好{{user}}');expect(exported).toContain('{{user}}的开场');
    expect(style(preview)).toBe(style(exported));
  });
  it.each(Object.keys(THEME_SKINS))('%s 的数字 0/字符串 0 圆角不再被默认 12 吞掉',skin=>{
    const p=fixture(purple.theme);p.theme.skin=skin;
    for(const radius of [0,'0']){
      p.theme.radius=radius;
      for(const preview of [false,true]){
        const css=cssOf(p,preview);
        expect(css).toMatch(/-wrap\{max-width:[^}]*border-radius:0px/);
        expect(css).toMatch(/-profile\{position:relative[^}]*border-radius:0px/);
        expect(css).not.toContain('border-radius:px');
      }
    }
  });
  it.each([[-8,0],[99,40],['bad',12],[Infinity,12],[undefined,12]])('圆角 %s 仍被安全钳制/回落到 %s',(radius,expected)=>{
    const p=fixture(purple.theme);p.theme.radius=radius;
    expect(cssOf(p)).toContain(`border-radius:${expected}px;overflow:hidden;position:relative`);
  });
  it.each(redesigned)('$name 切回紫夜复位材质与自定义字体，生成物无残留',({theme})=>{
    const p=fixture(theme);Object.assign(p.theme,{fontName:'Custom Body',headingFont:'Custom Heading'});
    Object.assign(p.theme,clone(themePresetPatch(purple.theme)));
    expect(p.theme).toMatchObject({skin:'nebula',fontName:'',headingFont:'Noto Serif SC'});
    expect(p.theme).not.toEqual(purple.theme); /* 预设对象不被写入 */
    expect(themePresetMatches(p.theme,purple.theme)).toBe(true);
    expect(cssOf(p)).toBe(cssOf(fixture(purple.theme)));
    expect(cssOf(p)).not.toContain('Custom');expect(cssOf(p)).toContain('theme-skin:nebula');
  });
  it.each([...redesigned,purple])('$name 手动关闭材质不改配色、正文或字体设置',({theme})=>{
    const p=fixture(theme),before=clone(p);p.theme.skin='classic';
    expect(cssOf(p)).not.toContain('theme-skin:');expect(cssOf(p)).not.toContain(themeTexture(theme));
    expect(p.theme).toEqual({...before.theme,skin:'classic'});expect(p.blocks).toEqual(before.blocks);
  });
});

describe('主题迁移、保存与撤销',()=>{
  let original;
  beforeEach(()=>{
    original={...Project};vi.useFakeTimers();
    const storage=new Map();
    vi.stubGlobal('localStorage',{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))});
    const p=fixture();Project.migrate(p);
    Project.list=[p];Project.cur=p;Project.templates=[];Project._svT=null;Project._resetting=false;
    setUI({renderAll(){}});Project.resetHistory();
  });
  afterEach(()=>{
    vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();Object.assign(Project,original);setUI(undefined);
  });
  it.each(THEME_PRESETS)('$name 的无 skin 存量工程不按 presetRef 自动换肤，迁移幂等',({name,theme})=>{
    const p=fixture(theme);delete p.theme.skin;p.theme.presetRef=name;
    p.theme.fontName='Legacy Body';p.theme.headingFont='Legacy Heading';
    const before=clone(p.theme),css=cssOf(p);
    Project.migrate(p);
    expect(p.theme).toEqual({...before,skin:'classic'});
    expect(cssOf(p)).toBe(css);expect(cssOf(p)).not.toContain('theme-skin:');
    const once=clone(p);Project.migrate(p);expect(p).toEqual(once);
  });
  it('旧荆棘配色及 decor 背景上收不触发新王室皮肤或新字体',()=>{
    const p={name:'旧荆棘',theme:{primary:'#8c1f3f',accent:'#e8a2b8',textColor:'#fbeef2',radius:4,titleAlign:'center',motion:'full',presetRef:'荆棘王室'},blocks:[{type:'decor',enabled:true,bgType:'gradient',bgColor:'#1e0b12',bgColor2:'#371420',bgImage:'',pattern:'stars'}]};
    Project.migrate(p);
    expect(p.theme).toMatchObject({skin:'classic',fontName:'',headingFont:'',primary:'#8c1f3f',accent:'#e8a2b8',radius:4,bg:{type:'gradient',color:'#1e0b12',color2:'#371420'}});
    expect(p.blocks[0].bgColor).toBeUndefined();expect(p.blocks[0].pattern).toBe('stars');
    expect(cssOf(p)).not.toContain('theme-skin:');expect(themePresetMatches(p.theme,redesigned[0].theme)).toBe(false);
  });
  it('官方布局模板未指定皮肤时也继续使用经典路径',()=>{
    BUILTIN_TEMPLATES.forEach(t=>expect(Project.builtinTemplateProject(t,'模板回归').theme.skin,t.name).toBe('classic'));
  });
  it.each(THEME_PRESETS)('$name 的 skin/字体/零圆角经过工程导出和存储重载不丢失',({name,theme})=>{
    Object.assign(Project.cur.theme,clone(themePresetPatch(theme)),{presetRef:name});
    const expected=clone(Project.cur.theme),css=cssOf(Project.cur);
    const exported=Project.exportData();Project.migrate(exported);
    expect(exported.theme).toEqual(expected);expect(cssOf(exported)).toBe(css);
    Project.save();Project.load();
    expect(Project.cur.theme).toEqual(expected);expect(cssOf(Project.cur)).toBe(css);
    expect(JSON.parse(localStorage.getItem(Project.LS_KEY))[0].theme).toEqual(expected);
  });
  it('六套主题依次套用后切回紫夜，undo/redo 完整恢复材质与两类字体',()=>{
    const states=[clone(Project.cur.theme)];
    for(const t of [...redesigned,purple]){
      Object.assign(Project.cur.theme,clone(themePresetPatch(t.theme)),{presetRef:t.name});
      Project.saveSnapshot();states.push(clone(Project.cur.theme));
    }
    expect(Project.cur.theme).toMatchObject({skin:'nebula',fontName:'',headingFont:'Noto Serif SC'});
    for(let i=states.length-2;i>=0;i--){expect(Project.undo()).toBe(true);expect(Project.cur.theme).toEqual(states[i])}
    expect(Project.undo()).toBe(false);
    for(let i=1;i<states.length;i++){expect(Project.redo()).toBe(true);expect(Project.cur.theme).toEqual(states[i])}
    expect(Project.redo()).toBe(false);vi.advanceTimersByTime(600);
    expect(JSON.parse(localStorage.getItem(Project.LS_KEY))[0].theme).toEqual(states.at(-1));
  });
});
