/* nhentai 画廊导入：本地 CLI + 127.0.0.1 微服务双模式（零依赖，Node 18+）。
   纯函数在 nh-lib.mjs；本文件只做抓取编排 / 参数解析 / 剪贴板 / HTTP 服务。
   用法：
     npm run nh       -- <画廊URL|ID> [--skip-last N] [--pages 1-20,25]   单次导出直链到剪贴板
     npm run nh-serve                                                     常驻本地服务（工具「漫画导入」页的前端后端）
   请求纪律：单画廊最多 2 个上游请求（API + HTML 各一），无重试轰炸。 */
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseApiJson, parseGalleryHtml, buildPageUrls, applyPageFilter, extractGalleryId } from './nh-lib.mjs';

const VERSION=JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)),'..','package.json'),'utf8')).version;
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const HOST='127.0.0.1';
const DEFAULT_PORT=8765;

/** 带超时 GET；返回 {status,text}；网络错误抛出带原因的 Error */
async function get(url,timeout=15000){
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),timeout);
  try{
    const res=await fetch(url,{signal:ctl.signal,headers:{'User-Agent':UA,'Referer':'https://nhentai.net/','Accept':'text/html,application/json,*/*'}});
    return {status:res.status,text:await res.text()};
  }catch(e){
    throw new Error(e.name==='AbortError'?'请求超时（15s）——检查网络或代理（Node fetch 默认不走系统代理，可设 NODE_USE_ENV_PROXY=1 或开 TUN 模式）':'网络请求失败：'+e.message);
  }finally{clearTimeout(timer)}
}

/** 抓取画廊：API 优先（结构化最稳），403/非 JSON 回落解析 HTML；单画廊最多 2 个上游请求 */
export async function fetchGallery(input){
  const id=extractGalleryId(input);
  if(!id)throw new Error('无法识别画廊 ID——请给 nhentai.net/g/数字/ 完整链接或纯数字 ID');
  let apiErr='';
  try{
    const r=await get(`https://nhentai.net/api/gallery/${id}`);
    if(r.status===200){
      try{
        const g=parseApiJson(JSON.parse(r.text));
        if(g)return {...g,id,source:'api'};
      }catch(_){/* 非 JSON（如 CF 挑战页）走回落 */}
    }
    apiErr=`API 返回 HTTP ${r.status}`;
  }catch(e){apiErr=e.message}
  /* 回落：画廊 HTML 页（og:image + 缩略图序列） */
  let htmlErr='';
  try{
    const r=await get(`https://nhentai.net/g/${id}/`);
    if(r.status===200){
      const g=parseGalleryHtml(r.text);
      if(g)return {...g,id,source:'html'};
      htmlErr='页面解析不到图片数据（结构可能变化或被防护拦截）';
    }else htmlErr=`页面返回 HTTP ${r.status}`;
  }catch(e){htmlErr=e.message}
  throw new Error(`抓取失败——${apiErr}；回落解析也失败：${htmlErr}。若浏览器能打开而脚本不能，多为 Cloudflare 拦截：先在浏览器访问一次 nhentai 过验证后重试，或改用手动粘贴直链。`);
}

/** URL 列表写入系统剪贴板；返回 null 成功，失败返回提示标记 */
function toClipboard(list){
  const cmd=process.platform==='win32'?'clip':process.platform==='darwin'?'pbcopy':'xclip';
  const args=process.platform==='linux'?['-selection','clipboard']:[];
  try{
    const r=spawnSync(cmd,args,{input:list,shell:process.platform==='win32'});
    if(r.error||r.status!==0)return 'clipboard';
    return null;
  }catch(_){return 'clipboard'}
}

const USAGE=`nhentai 画廊导入（v${VERSION}）
用法：
  node scripts/nh-import.mjs <画廊URL|ID> [--skip-last N] [--pages 1-20,25]
  node scripts/nh-import.mjs --serve          启动本地服务（工具「漫画导入」页使用）
示例：
  npm run nh -- https://nhentai.net/g/123456/ --skip-last 3   全本去掉末尾 3 页广告
  npm run nh -- 123456 --pages 1-20                            只要 1-20 页`;

async function cli(argv){
  let input='',skipLast=0,pages=null;
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a==='--skip-last')skipLast=argv[++i];
    else if(a==='--pages')pages=argv[++i];
    else if(a==='-h'||a==='--help'){console.log(USAGE);return}
    else input=a;
  }
  if(!input){console.log(USAGE);process.exitCode=1;return}
  const g=await fetchGallery(input);
  const picked=applyPageFilter(g.total,{skipLast,pages});
  const sel=g.pages.filter(p=>picked.includes(p.page));
  const {urls}=buildPageUrls(g.mediaId,sel);
  const list=urls.join('\n');
  console.log(`画廊 ${g.id}（media_id ${g.mediaId}，来源 ${g.source}）：全本 ${g.total} 页 → 选取 ${urls.length} 页\n`);
  console.log(list);
  const fail=toClipboard(list);
  console.log(fail?'\n⚠️ 写剪贴板失败，请从上方输出手动复制':'\n✓ 已复制到剪贴板——回工具「批量导入」框 Ctrl+V 即可');
}

/** 本地服务：只绑 127.0.0.1；GET /api/status 探活、/api/gallery?url= 抓全本（筛选交给工具结果区交互） */
export async function serve(){
  const port=+process.env.NH_PORT||DEFAULT_PORT;
  const server=http.createServer(async (req,res)=>{
    const head={'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'};
    const send=(code,obj)=>{res.writeHead(code,head);res.end(JSON.stringify(obj))};
    const u=new URL(req.url,`http://${HOST}`);
    try{
      if(u.pathname==='/api/status')return send(200,{ok:true,version:VERSION});
      if(u.pathname==='/api/gallery'){
        const g=await fetchGallery(u.searchParams.get('url')||'');
        const {urls,thumbs}=buildPageUrls(g.mediaId,g.pages);
        return send(200,{ok:true,id:g.id,mediaId:g.mediaId,total:g.total,source:g.source,urls,thumbs});
      }
      send(404,{ok:false,error:'not found'});
    }catch(e){send(200,{ok:false,error:e.message})}
  });
  server.on('error',e=>{
    if(e.code==='EADDRINUSE')console.error(`端口 ${port} 被占用——服务可能已在运行；否则用 NH_PORT=其他端口 换端口启动。`);
    else console.error('服务启动失败：'+e.message);
    process.exit(1);
  });
  server.listen(port,HOST,()=>{
    console.log(`✓ nhentai 导入服务已启动：http://${HOST}:${port}（v${VERSION}）`);
    console.log('  保持本窗口开着；回到工具「📚 漫画导入」页即可抓取。Ctrl+C 退出。');
  });
}

const arg=process.argv[2];
if(arg==='--serve'||arg==='-s')serve();
else if(arg!==undefined||process.argv.length>2)cli(process.argv.slice(2)).catch(e=>{console.error('✗ '+e.message);process.exit(1)});
else{console.log(USAGE)}
