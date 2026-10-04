/* nhentai 画廊导入：本地 CLI + 127.0.0.1 微服务双模式（零依赖，Node 18+）。
   纯函数在 nh-lib.mjs；本文件只做抓取编排 / 参数解析 / 剪贴板 / HTTP 服务。
   用法：
     npm run nh       -- <画廊URL|ID> [--skip-last N] [--pages 1-20,25]   单次导出直链到剪贴板
     npm run nh-serve                                                     常驻本地服务（工具「漫画导入」页的前端后端）
   请求纪律：单画廊最多 2 个上游请求（API + HTML 各一），无重试轰炸。 */
import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseApiJson, parseGalleryHtml, buildPageUrls, applyPageFilter, extractGalleryId, parseProxyUrl } from './nh-lib.mjs';

const VERSION=JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)),'..','package.json'),'utf8')).version;
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const UA_HEADERS={'User-Agent':UA,'Referer':'https://nhentai.net/','Accept':'text/html,application/json,*/*'};
const HOST='127.0.0.1';
const DEFAULT_PORT=8765;

/** chunked 传输编码解码（代理隧道手工响应读取用）：按行读十六进制长度取块，0 长度即结束 */
function dechunk(buf){
  const out=[];let i=0;
  while(i<buf.length){
    const j=buf.indexOf('\r\n',i);
    if(j<0)break;
    const size=parseInt(buf.slice(i,j).toString('latin1'),16);
    if(!Number.isFinite(size)||size===0)break;
    out.push(buf.slice(j+2,j+2+size));
    i=j+2+size+2;
  }
  return Buffer.concat(out);
}

/** 经 HTTP 代理的 CONNECT 隧道 GET（零依赖，Node 18+）：net 连代理 → CONNECT 目标:443 →
    tls 包隧道 → https.request(createConnection) 收响应。proxy 为 parseProxyUrl 结果。
    仅支持 https 目标（本文件两处上游均为 https）。错误按阶段给可读原因 */
function proxyGet(url,{timeout=15000,headers={}}={},proxy){
  return new Promise((resolve,reject)=>{
    const target=new URL(url);
    if(target.protocol!=='https:'){reject(new Error('代理隧道仅支持 https 目标'));return}
    const host=target.hostname;
    let socket,tlsSocket;
    const fail=e=>{
      clearTimeout(timer);
      try{tlsSocket?.destroy()}catch(_){/* 已销毁 */}
      try{socket?.destroy()}catch(_){/* 已销毁 */}
      reject(e);
    };
    const timer=setTimeout(()=>fail(new Error('请求超时（'+(timeout/1000)+'s）——代理或网络无响应')),timeout);
    socket=net.connect({host:proxy.host,port:proxy.port});
    socket.on('error',e=>fail(new Error('代理连不上（'+proxy.host+':'+proxy.port+'）：'+e.message)));
    socket.once('connect',()=>{
      socket.write('CONNECT '+host+':'+(target.port||443)+' HTTP/1.1\r\nHost: '+host+':'+(target.port||443)+'\r\n\r\n');
    });
    let head='';
    const onProxyData=buf=>{
      head+=buf.toString('latin1');
      if(!head.includes('\r\n\r\n'))return; /* CONNECT 应答头未完，继续攒 */
      socket.off('data',onProxyData);
      if(!/^HTTP\/1\.[01] 200/.test(head))return fail(new Error('代理拒绝 CONNECT 隧道：'+head.split('\r\n')[0]));
      tlsSocket=tls.connect({socket,servername:host},()=>{
        /* 手工实现 HTTP 请求（不走 ClientRequest/Agent）：预连 socket 经 Agent 封装在实测中
           无响应（握手正常但请求挂起），手工写最稳。Connection: close → 服务端回完即断，
           读到 close 拆头尾即可；chunked 需解码。目标均为 nhentai 两个固定端点，无重定向场景 */
        const path=target.pathname+target.search;
        const hs=Object.entries(headers).map(([k,v])=>k+': '+v).join('\r\n');
        tlsSocket.write('GET '+path+' HTTP/1.1\r\nHost: '+target.host+'\r\n'+hs+'\r\nConnection: close\r\n\r\n');
        let raw=Buffer.alloc(0);
        let settled=false;
        const finish=(err,res)=>{
          if(settled)return;settled=true;
          clearTimeout(timer);
          try{tlsSocket?.destroy()}catch(_){/* 已销毁 */}
          try{socket?.destroy()}catch(_){/* 已销毁 */}
          err?reject(err):resolve(res);
        };
        tlsSocket.on('data',c=>{raw=Buffer.concat([raw,c])});
        tlsSocket.on('close',()=>{
          const idx=raw.indexOf('\r\n\r\n');
          if(idx<0)return finish(new Error('代理隧道响应不完整（未收到完整响应头）'));
          const headText=raw.slice(0,idx).toString('latin1');
          const status=+(/^HTTP\/1\.[01] (\d{3})/.exec(headText)?.[1]||0);
          let body=raw.slice(idx+4);
          const header={};
          for(const l of headText.split('\r\n').slice(1)){const i=l.indexOf(':');if(i>0)header[l.slice(0,i).trim().toLowerCase()]=l.slice(i+1).trim()}
          if((header['transfer-encoding']||'').includes('chunked'))body=dechunk(body);
          finish(null,{status,text:body.toString('utf8')});
        });
        tlsSocket.on('error',e=>finish(new Error('代理隧道内 TLS/请求失败：'+e.message)));
      });
      tlsSocket.on('error',e=>fail(new Error('代理隧道内 TLS/请求失败：'+e.message)));
    };
    socket.on('data',onProxyData);
  });
}

/** 带超时 GET；proxy 非空走 CONNECT 隧道，留空走全局 fetch（环境变量代理在
    NODE_USE_ENV_PROXY=1 时生效）；返回 {status,text}；网络错误抛出带原因的 Error */
async function get(url,timeout=15000,proxy=null){
  if(proxy)return proxyGet(url,{timeout,headers:UA_HEADERS},proxy);
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),timeout);
  try{
    const res=await fetch(url,{signal:ctl.signal,headers:UA_HEADERS});
    return {status:res.status,text:await res.text()};
  }catch(e){
    throw new Error(e.name==='AbortError'?'请求超时（15s）——检查网络或代理（Node fetch 默认不走系统代理，可设 NODE_USE_ENV_PROXY=1、开 TUN 模式，或在工具页「抓取代理」里填代理地址）':'网络请求失败：'+e.message);
  }finally{clearTimeout(timer)}
}

/** 抓取画廊：v2 API 优先（2026-10 起旧版 /api/gallery 已 403 弃用），403/非 JSON 回落解析 HTML；
    单画廊最多 2 个上游请求。HTML 页对脚本请求被 Cloudflare 拦截（403），仅作兜底尝试 */
export async function fetchGallery(input,{proxy=null}={}){
  const id=extractGalleryId(input);
  if(!id)throw new Error('无法识别画廊 ID——请给 nhentai.net/g/数字/ 完整链接或纯数字 ID');
  let apiErr='';
  try{
    const r=await get(`https://nhentai.net/api/v2/galleries/${id}`,15000,proxy);
    if(r.status===200){
      try{
        const g=parseApiJson(JSON.parse(r.text));
        if(g)return {...g,id,source:'api'};
      }catch(_){/* 非 JSON（如 CF 挑战页）走回落 */}
    }
    apiErr=r.status===404?'API 返回 HTTP 404（画廊不存在或已下架）':`API 返回 HTTP ${r.status}`;
  }catch(e){apiErr=e.message}
  /* 回落：画廊 HTML 页（og:image + 缩略图序列） */
  let htmlErr='';
  try{
    const r=await get(`https://nhentai.net/g/${id}/`,15000,proxy);
    if(r.status===200){
      const g=parseGalleryHtml(r.text);
      if(g)return {...g,id,source:'html'};
      htmlErr='页面解析不到图片数据（结构可能变化或被防护拦截）';
    }else htmlErr=`页面返回 HTTP ${r.status}`;
  }catch(e){htmlErr=e.message}
  throw new Error(`抓取失败——${apiErr}；回落解析也失败：${htmlErr}。脚本流量被 Cloudflare 拦截时浏览器能打开也没用：在工具页「抓取代理」里填本机代理地址（如 Clash 默认 http://127.0.0.1:7890），或改用手动粘贴直链（F12 看图片地址，规律 i.nhentai.net/galleries/{media_id}/{页}.{jpg|png|gif}）。`);
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
  node scripts/nh-import.mjs <画廊URL|ID> [--skip-last N] [--pages 1-20,25] [--proxy http://127.0.0.1:7890]
  node scripts/nh-import.mjs --serve          启动本地服务（工具「漫画导入」页使用）
  --proxy   出网走指定 HTTP 代理（CONNECT 隧道）；CLI 不带 --proxy 时跟随环境变量 NODE_USE_ENV_PROXY/HTTP_PROXY
示例：
  npm run nh -- https://nhentai.net/g/123456/ --skip-last 3   全本去掉末尾 3 页广告
  npm run nh -- 123456 --pages 1-20 --proxy http://127.0.0.1:7890   走本机 Clash 代理`;

async function cli(argv){
  let input='',skipLast=0,pages=null,proxy=null;
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a==='--skip-last')skipLast=argv[++i];
    else if(a==='--pages')pages=argv[++i];
    else if(a==='--proxy'){
      proxy=parseProxyUrl(argv[++i]);
      if(!proxy){console.error('✗ --proxy 格式不对（要 http://host:port，如 http://127.0.0.1:7890）');process.exitCode=1;return}
    }
    else if(a==='-h'||a==='--help'){console.log(USAGE);return}
    else input=a;
  }
  if(!input){console.log(USAGE);process.exitCode=1;return}
  const g=await fetchGallery(input,{proxy});
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
    /* PNA（专用网络访问）：公网部署的工具页 fetch 本机服务属 public→local，Chrome 要求
       预检应答带 Access-Control-Allow-Private-Network: true 才放行——否则会莫名「未连接」 */
    if(req.method==='OPTIONS'){
      res.writeHead(204,{
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Methods':'GET,OPTIONS',
        'Access-Control-Allow-Headers':'*',
        'Access-Control-Allow-Private-Network':'true',
        'Access-Control-Max-Age':'86400',
      });
      return res.end();
    }
    const head={'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Private-Network':'true','Cache-Control':'no-store'};
    const send=(code,obj)=>{res.writeHead(code,head);res.end(JSON.stringify(obj))};
    const u=new URL(req.url,`http://${HOST}`);
    try{
      if(u.pathname==='/api/status')return send(200,{ok:true,version:VERSION});
      if(u.pathname==='/api/shutdown'){ /* 停止按钮：仅本机可达（服务只绑 127.0.0.1），退出服务进程 */
        send(200,{ok:true,bye:true});
        setTimeout(()=>process.exit(0),100);
        return;
      }
      if(u.pathname==='/api/gallery'){
        /* proxy 参数：工具页「抓取代理」传入，按次生效无需重启服务；目标 URL 由画廊 ID 构造，
           代理只影响本服务对 nhentai 固定域的出网，无 SSRF 放大 */
        const rawProxy=u.searchParams.get('proxy');
        let proxy=null;
        if(rawProxy){
          proxy=parseProxyUrl(rawProxy);
          if(!proxy)return send(200,{ok:false,error:'代理地址格式不对（要 http://host:port，如 http://127.0.0.1:7890）——本次抓取已中止，修正后重试'});
        }
        const g=await fetchGallery(u.searchParams.get('url')||'',{proxy});
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
