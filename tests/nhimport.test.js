/* nhentai 导入核心库单元测试（纯函数，不打真实网络） */
import { describe, it, expect } from 'vitest';
import { parseApiJson, parseGalleryHtml, buildPageUrls, parsePageExpr, applyPageFilter, extractGalleryId } from '../scripts/nh-lib.mjs';

describe('nh-lib parseApiJson',()=>{
  it('API JSON → mediaId + 每页扩展名映射（j/p/g → jpg/png/gif），页码从 1 起',()=>{
    const g=parseApiJson({media_id:'9',images:{pages:[{t:'j',w:1280,h:1810},{t:'p',w:1280,h:1810},{t:'g',w:500,h:500}]}});
    expect(g.mediaId).toBe('9');
    expect(g.total).toBe(3);
    expect(g.pages).toEqual([{page:1,ext:'jpg'},{page:2,ext:'png'},{page:3,ext:'gif'}]);
  });
  it('未知扩展名类型回退 jpg；结构不符（缺 media_id/空 pages/非对象）返回 null',()=>{
    expect(parseApiJson({media_id:'1',images:{pages:[{t:'x'}]}}).pages[0].ext).toBe('jpg');
    expect(parseApiJson({images:{pages:[{t:'j'}]}})).toBeNull();
    expect(parseApiJson({media_id:'1',images:{pages:[]}})).toBeNull();
    expect(parseApiJson(null)).toBeNull();
    expect(parseApiJson('str')).toBeNull();
  });
});

describe('nh-lib parseGalleryHtml',()=>{
  const HTML=`<html><head><meta property="og:image" content="https://t7.nhentai.net/galleries/99/cover.jpg"></head>
  <body><div class="container gallerythubs">
  <a href="/g/1/2/"><img src="https://t2.nhentai.net/galleries/99/2t.png"></a>
  <a href="/g/1/1/"><img src="https://t3.nhentai.net/galleries/99/1t.jpg"></a>
  <a href="/g/1/1/"><img src="https://t3.nhentai.net/galleries/99/1t.jpg"></a>
  <a href="/g/1/3/"><img src="https://t.nhentai.net/galleries/99/3t.gif"></a>
  </div></body></html>`;
  it('og:image 取 media_id；缩略图序列按页升序去重；cover 不混入',()=>{
    const g=parseGalleryHtml(HTML);
    expect(g.mediaId).toBe('99');
    expect(g.total).toBe(3);
    expect(g.pages).toEqual([{page:1,ext:'jpg'},{page:2,ext:'png'},{page:3,ext:'gif'}]);
  });
  it('无 og:image 时回落缩略图里的 media_id；解析不出返回 null',()=>{
    const g=parseGalleryHtml('<img src="https://t2.nhentai.net/galleries/42/1t.jpg">');
    expect(g.mediaId).toBe('42');
    expect(parseGalleryHtml('<p>nothing</p>')).toBeNull();
    expect(parseGalleryHtml('')).toBeNull();
  });
});

describe('nh-lib buildPageUrls',()=>{
  it('大图 i. 域 + 缩略图 t. 域（t 后缀），与入参同序',()=>{
    const {urls,thumbs}=buildPageUrls('9',[{page:1,ext:'jpg'},{page:2,ext:'png'}]);
    expect(urls).toEqual(['https://i.nhentai.net/galleries/9/1.jpg','https://i.nhentai.net/galleries/9/2.png']);
    expect(thumbs).toEqual(['https://t.nhentai.net/galleries/9/1t.jpg','https://t.nhentai.net/galleries/9/2t.png']);
  });
  it('ext 缺省回退 jpg；空入参返回空数组',()=>{
    expect(buildPageUrls('1',[{page:3}]).urls[0]).toBe('https://i.nhentai.net/galleries/1/3.jpg');
    expect(buildPageUrls('1',[])).toEqual({urls:[],thumbs:[]});
  });
});

describe('nh-lib parsePageExpr',()=>{
  it('范围与单页混合；多分隔符；去重升序',()=>{
    expect(parsePageExpr('1-3,5')).toEqual([1,2,3,5]);
    expect(parsePageExpr('2,1-2,7')).toEqual([1,2,7]);
    expect(parsePageExpr('1～3 5')).toEqual([1,2,3,5]);
  });
  it('a>b 交换；越界钳制到 1..max',()=>{
    expect(parsePageExpr('3-1')).toEqual([1,2,3]);
    expect(parsePageExpr('13-99',14)).toEqual([13,14]);
    expect(parsePageExpr('0-2',14)).toEqual([1,2]);
  });
  it('空/无效返回 null',()=>{
    expect(parsePageExpr('')).toBeNull();
    expect(parsePageExpr('abc,def')).toBeNull();
    expect(parsePageExpr(null)).toBeNull();
  });
});

describe('nh-lib applyPageFilter',()=>{
  it('默认全量；skip-last 去尾（广告页场景）',()=>{
    expect(applyPageFilter(5,{})).toEqual([1,2,3,4,5]);
    expect(applyPageFilter(20,{skipLast:3})).toEqual([...Array(17).keys()].map(i=>i+1));
  });
  it('pages 表达式优先于 skipLast；越界钳制',()=>{
    expect(applyPageFilter(20,{skipLast:3,pages:'1-2, 19-99'})).toEqual([1,2,19,20]);
  });
  it('保护：skip-last 不小于总页数 → 空；小数/字符串数字宽容',()=>{
    expect(applyPageFilter(5,{skipLast:9})).toEqual([]);
    expect(applyPageFilter('20',{skipLast:'2.7'})).toEqual([...Array(18).keys()].map(i=>i+1));
  });
});

describe('nh-lib extractGalleryId',()=>{
  it('完整链接 / 带路径噪音 / 纯数字；无效返回 null',()=>{
    expect(extractGalleryId('https://nhentai.net/g/123456/')).toBe('123456');
    expect(extractGalleryId('https://nhentai.net/g/123456/?x=1')).toBe('123456');
    expect(extractGalleryId(' 789 ')).toBe('789');
    expect(extractGalleryId('https://example.com/a')).toBeNull();
    expect(extractGalleryId('')).toBeNull();
  });
});
