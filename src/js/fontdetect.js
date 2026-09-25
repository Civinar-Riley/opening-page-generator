/* 字体检测纯逻辑：判定与清单可测（ctx 由调用方注入，边界保持 DOM 访问） */

/* 待检测字体清单（工具主题字体的常见候选） */
export const COMMON_FONTS=['微软雅黑','黑体','宋体','楷体','仿宋','等线','思源黑体','思源宋体','霞鹜文楷','华文行楷','华文宋体','华文黑体','方正姚体','方正舒体','Arial','Verdana','Georgia','Times New Roman','Courier New','Impact','Trebuchet MS','Palatino Linotype','Lucida Console'];
/* 兜底字体：任一 base 下宽度不同即视为「该字体存在」 */
export const BASE_FONTS=['monospace','sans-serif','serif'];
export const FONT_TEST_STR='测试FontabAB012';

/* 单个字体是否存在：在任一 base 字体下，指定字体渲染宽度与纯 base 不同，则判定存在。
 * @param {CanvasRenderingContext2D} ctx - 注入的 canvas 2d 上下文（测试可 mock）
 */
export function fontExists(ctx,font,baseFonts=BASE_FONTS){
  for(const base of baseFonts){
    ctx.font=`72px "${font}",${base}`;const w1=ctx.measureText(FONT_TEST_STR).width;
    ctx.font=`72px ${base}`;const w2=ctx.measureText(FONT_TEST_STR).width;
    if(w1!==w2)return true;
  }
  return false;
}

/* 过滤出系统中实际存在的字体（会读取 ctx，无副作用缓存——缓存由调用方负责） */
export function detectAvailableFonts(ctx,fonts=COMMON_FONTS){
  return fonts.filter(f=>fontExists(ctx,f));
}