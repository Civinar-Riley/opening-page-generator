/* 主题材质仅接受枚举；未知/缺失值保留旧版观感（classic），不能从 presetRef 推断以免旧工程被换肤。 */
const THEME_SKINS={
  classic:{name:'经典（无附加材质）',font:'"Segoe UI","Microsoft YaHei",sans-serif'},
  nebula:{name:'紫夜星穹',font:'"Noto Serif SC","Songti SC","SimSun",serif'},
  royal:{name:'王室藏书票',font:'"Noto Serif SC","Songti SC","SimSun",serif'},
  festival:{name:'狐火夜祭',font:'"KaiTi","STKaiti","Kaiti SC",serif'},
  cyber:{name:'义体检修终端',font:'"Bahnschrift","DIN Alternate","Microsoft YaHei",sans-serif'},
  abyss:{name:'深渊潮汐',font:'"Noto Serif SC","Songti SC","SimSun",serif'},
  archive:{name:'旧档案卷宗',font:'"Courier New","SimSun",monospace'},
};
const themeSkin=t=>typeof t?.skin==='string'&&Object.hasOwn(THEME_SKINS,t.skin)?t.skin:'classic';
/* 标题字体栈：标题字 → 正文字 → 皮肤字体；预置 headingFont 常与皮肤首选同名，
   去重后 computed font-family 不会出现两遍（保序，用户标题字优先）。 */
function themeFontStack(skin,heading,bodyFont){
  const clean=v=>String(v||'').replace(/[<>"\\]/g,'').trim();
  const h=clean(heading),b=clean(bodyFont);
  const list=(h?[`"${h}"`]:[]).concat(b?[`"${b}"`]:[]).concat(THEME_SKINS[skin].font.split(',').map(s=>s.trim()));
  const seen=new Set();
  return list.filter(f=>{const k=f.replace(/^["']|["']$/g,'').toLowerCase();if(!k||seen.has(k))return false;seen.add(k);return true}).join(',');
}
/* 所有预设（含紫夜）都先复位三项新字段再覆盖：试穿/套用任一预设都不会继承上一套的材质与字体。 */
const themePresetPatch=t=>({skin:'classic',fontName:'',headingFont:'',...t});
const THEME_FIELDS=['primary','accent','textColor','radius','titleAlign','motion','fontName','headingFont'];
function themePresetMatches(a,b){
  const target=themePresetPatch(b);
  return themeSkin(a)===themeSkin(target)&&THEME_FIELDS.every(k=>String(a[k]??'')===String(target[k]??''))&&JSON.stringify(a.bg||null)===JSON.stringify(target.bg||null);
}
/* 同一材质供试穿卡和产物使用；只叠低透明度渐变，不抢装饰区/噪点层的伪元素。 */
function themeTexture(t){
  const p=/^#[\da-f]{6}$/i.test(t.primary)?t.primary:'#7c6cf0',a=/^#[\da-f]{6}$/i.test(t.accent)?t.accent:'#e8c47c';
  switch(themeSkin(t)){
    case 'nebula':return `repeating-conic-gradient(from 0deg at 86% -6%,${a}0c 0deg .6deg,transparent .6deg 12deg),repeating-linear-gradient(30deg,${p}05 0 1px,transparent 1px 54px),radial-gradient(ellipse at 10% 0,${p}1c,transparent 60%)`;
    case 'royal':return `repeating-linear-gradient(45deg,${a}05 0 1px,transparent 1px 22px),repeating-linear-gradient(-45deg,${a}05 0 1px,transparent 1px 22px),radial-gradient(ellipse at 50% 0,${p}18,transparent 62%)`;
    case 'festival':return `radial-gradient(ellipse at 100% 0,${a}14,transparent 48%),repeating-linear-gradient(90deg,${p}06 0 1px,transparent 1px 8px)`;
    case 'cyber':return `repeating-linear-gradient(0deg,${p}08 0 1px,transparent 1px 28px),repeating-linear-gradient(90deg,${p}08 0 1px,transparent 1px 28px),linear-gradient(120deg,transparent 65%,${a}07)`;
    case 'abyss':return `repeating-radial-gradient(ellipse at 100% 0,transparent 0 38px,${a}09 39px 40px,transparent 41px 70px),radial-gradient(ellipse at 0 10%,${p}16,transparent 62%)`;
    case 'archive':return `repeating-linear-gradient(0deg,transparent 0 27px,${a}08 27px 28px),linear-gradient(90deg,${p}09,transparent 32%)`;
    default:return '';
  }
}
export { THEME_SKINS, themeSkin, themePresetPatch, themePresetMatches, themeTexture, themeFontStack };
