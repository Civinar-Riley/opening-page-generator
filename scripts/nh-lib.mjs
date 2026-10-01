/* nhentai 画廊导入核心库：解析 / 直链构造 / 页码过滤纯函数（零依赖，无 Node 内置模块，
   供 CLI（nh-import.mjs）、vitest、工具 UI（esbuild bundle）三方安全 import）。
   直链规律：大图 https://i.nhentai.net/galleries/{media_id}/{页}.{jpg|png|gif}（页码从 1 起），
   缩略图同结构域为 t{n}.nhentai.net 且文件名带 t 后缀。v2 API（/api/v2/galleries/{id}）不可用时
   解析画廊 HTML：og:image meta 给出 media_id，gallerythubs 缩略图序列给出每页扩展名。 */

const EXT_MAP={j:'jpg',p:'png',g:'gif'};

/** API JSON（/api/v2/galleries/{id} 响应；兼容旧版 /api/gallery/{id} 结构）→ {mediaId,total,pages:[{page,ext}]}；
    结构不符返回 null。v2 形状：pages[].{number,path}（扩展名在 path 尾段，直链文件名与 path 一致）；
    旧版形状：images.pages[].{t,w,h}（t 码 j/p/g）——上游 2026-10 起 403 弃用旧端点，保留解析仅作兼容 */
export function parseApiJson(json){
  if(!json||typeof json!=='object')return null;
  const mediaId=String(json.media_id??'');
  const v2=Array.isArray(json.pages)?json.pages:null;
  const legacy=v2?null:(json.images&&Array.isArray(json.images.pages)?json.images.pages:null);
  const arr=v2||legacy;
  if(!mediaId||!arr||!arr.length)return null;
  const pages=arr.map((x,i)=>{
    if(v2){
      const m=String((x&&x.path)||'').match(/\.(\w{2,5})$/);
      const num=+x.number;
      return {page:(Number.isFinite(num)&&num>0)?num:i+1,ext:m?m[1].toLowerCase():'jpg'};
    }
    return {page:i+1,ext:EXT_MAP[x&&x.t]||'jpg'};
  });
  return {mediaId,total:pages.length,pages};
}

/** 画廊 HTML → {mediaId,total,pages:[{page,ext}]}（og:image 取 media_id；缩略图取每页扩展名，按页升序去重）；解析不出返回 null */
export function parseGalleryHtml(html){
  const text=String(html||'');
  const og=text.match(/<meta[^>]+property=["']og:image["'][^>]*>/i);
  let mediaId='';
  if(og){
    const m=og[0].match(/galleries\/(\d+)/);
    if(m)mediaId=m[1];
  }
  /* 缩略图：t{n}.nhentai.net/galleries/{media_id}/{page}t.{ext}；页码从 1 起，cover（无页码）天然不匹配 */
  const re=/t\d*\.nhentai\.net\/galleries\/(\d+)\/(\d+)t\.(\w{2,5})/g;
  const seen=new Set(),pages=[];
  let m;
  while((m=re.exec(text))){
    if(!mediaId)mediaId=m[1];
    const pg=+m[2];
    if(seen.has(pg))continue;
    seen.add(pg);
    pages.push({page:pg,ext:m[3].toLowerCase()});
  }
  if(!mediaId||!pages.length)return null;
  pages.sort((a,b)=>a.page-b.page);
  /* 页码理论上应连续从 1 起；若有缺口按现有页序保留（rescue：本地页码重排会错位直链，宁可原样） */
  return {mediaId,total:pages.length,pages};
}

/** 直链构造：入参 pages=[{page,ext}]，返回 {urls:[大图],thumbs:[缩略图]}（与入参同序） */
export function buildPageUrls(mediaId,pages){
  const urls=[],thumbs=[];
  (pages||[]).forEach(p=>{
    const ext=p.ext||'jpg',n=p.page;
    urls.push(`https://i.nhentai.net/galleries/${mediaId}/${n}.${ext}`);
    thumbs.push(`https://t.nhentai.net/galleries/${mediaId}/${n}t.${ext}`);
  });
  return {urls,thumbs};
}

/** 从用户输入提取画廊 ID：完整 URL / 纯数字；无效返回 null */
export function extractGalleryId(input){
  const s=String(input||'').trim();
  let m=s.match(/nhentai\.net\/g\/(\d+)/i);
  if(m)return m[1];
  if(/^\d+$/.test(s))return s;
  return null;
}

/** 页码表达式 '1-20,25' → 去重升序页码数组（a-b 支持 a>b 交换，越界钳制 1..max）；无有效内容返回 null */
export function parsePageExpr(str,max=Infinity){
  const s=String(str??'').trim();
  if(!s)return null;
  const out=new Set();
  for(const part of s.split(/[,，、\s]+/)){
    if(!part)continue;
    const m=part.match(/^(\d+)(?:\s*[-~～]\s*(\d+))?$/);
    if(!m)continue;
    let a=+m[1],b=m[2]!==undefined?+m[2]:a;
    if(b<a){const t=a;a=b;b=t}
    for(let i=Math.max(1,a);i<=Math.min(max,b);i++)out.add(i);
  }
  return out.size?[...out].sort((x,y)=>x-y):null;
}

/** CLI 页码过滤：pages 表达式优先；否则 1..total 全量再去掉末尾 skipLast 页（专治末尾广告页）；返回页码数组 */
export function applyPageFilter(total,{skipLast=0,pages=null}={}){
  const n=Math.max(0,Math.floor(+total||0));
  const expr=parsePageExpr(pages,n);
  if(expr)return expr;
  const skip=Math.max(0,Math.floor(+skipLast||0));
  const keep=n-skip;
  const out=[];
  for(let i=1;i<=Math.max(0,keep);i++)out.push(i);
  return out;
}
