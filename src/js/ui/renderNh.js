/* 漫画导入页（nhentai 本地服务前端）：服务探活 → 抓取全本 → 缩略图勾选（全选/反选/页码/去尾）→ 写入漫画区块。
   一次构建 + 局部刷新：抓取结果是昂贵的异步产物，不能被页签切换/重渲染冲掉（区别于 renderAI 的全量重建）；
   工程切换等 renderAll 只重刷目标下拉。抓取能力来自本机辅助服务（npm run nh-serve，127.0.0.1），浏览器直连
   nhentai 会被 CORS 拦截，故本页不直接请求外部站点。 */
import { $, esc, toast, confirmModal } from '../utils.js';
import { BLOCK_DEFS } from '../defs.js';
import { parsePageExpr } from '../../../scripts/nh-lib.mjs';
import { Project } from '../project.js';
import { UI } from './core.js';

const SERVICE_KEY='openingPageGen_v1_nhService';
const DEF_ADDR='http://127.0.0.1:8765';
/* 会话级抓取结果（模块级：页签切换不丢） */
const st={total:0,urls:[],thumbs:[],source:''};

const getAddr=()=>{try{return localStorage.getItem(SERVICE_KEY)||DEF_ADDR}catch(e){return DEF_ADDR}};
const setAddr=v=>{try{localStorage.setItem(SERVICE_KEY,v)}catch(e){}};

/** 服务探活（3s 超时）：更新状态点、提示文案与启动/停止按钮可见性 */
async function probe(){
  const dot=$('#nhDot'),hint=$('#nhSvcHint'),addr=$('#nhAddr').value.trim().replace(/\/+$/,'');
  if(!dot)return;
  dot.className='status-dot status-warn';
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),3000);
  let ok=false,ver='';
  try{
    const res=await fetch(addr+'/api/status',{signal:ctl.signal});
    const j=await res.json();
    if(j&&j.ok){ok=true;ver=j.version||''}
  }catch(e){/* 未连接 */}
  finally{clearTimeout(timer)}
  if(ok){
    dot.className='status-dot status-ok';
    hint.textContent=`已连接（服务 v${ver}）`;
  }else{
    dot.className='status-dot status-err';
    hint.textContent='未连接——点「🚀 一键启动服务」唤起（首次需先跑一次 npm run nh-install），或手动 npm run nh-serve';
  }
  const btnStart=$('#nhStart'),btnStop=$('#nhStop');
  if(btnStart)btnStart.style.display=ok?'none':'';
  if(btnStop)btnStop.style.display=ok?'':'none';
  return ok;
}

/** 一键唤起服务：触发 opg-nh:// 协议（npm run nh-install 注册）→ 轮询探活；返回是否成功 */
async function ensureService(){
  if(await probe())return true;
  try{location.href='opg-nh://start'}catch(e){/* 协议未注册时浏览器静默 */}
  for(let i=0;i<5;i++){
    await new Promise(r=>setTimeout(r,800));
    if(await probe())return true;
  }
  toast('未能唤起服务——先在工具目录跑一次 npm run nh-install 注册一键启动，或手动 npm run nh-serve');
  return false;
}

/** 抓取结果网格（全选初始）；勾选状态以 DOM checkbox 为单一事实源 */
function renderGrid(){
  const grid=$('#nhGrid');
  grid.innerHTML=st.urls.map((u,i)=>`<label class="nh-card"><input type="checkbox" checked data-nhpg="${i+1}"><img loading="lazy" src="${esc(st.thumbs[i]||u)}" alt=""><span class="nh-pg">P${i+1}</span></label>`).join('');
  updateCount();
  $('#nhResultCard').style.display='';
  $('#nhTotal').textContent=st.total;
  $('#nhSrc').textContent=st.source==='api'?'API':'页面解析';
}
function checkedPages(){
  return [...$('#nhGrid').querySelectorAll('input:checked')].map(x=>+x.dataset.nhpg).sort((a,b)=>a-b);
}
function updateCount(){
  $('#nhCount').textContent=`已选 ${checkedPages().length} / ${st.total} 页`;
}
function setChecked(fn){ /* fn(page,el) → boolean；统一改勾选并刷新计数 */
  $('#nhGrid').querySelectorAll('input[data-nhpg]').forEach(el=>{el.checked=fn(+el.dataset.nhpg,el)});
  updateCount();
}

/** 目标下拉：列出当前工程全部 comic 区块（含停用标注）；无则显示创建按钮 */
function refreshTargets(){
  const sel=$('#nhTarget'),mk=$('#nhMk');
  if(!sel)return;
  const comics=Project.cur.blocks.map((b,i)=>({b,i})).filter(x=>x.b.type==='comic');
  sel.innerHTML=comics.length
    ?comics.map(x=>`<option value="${x.i}">区块 #${x.i+1} · ${esc(x.b.title||'未命名')}${x.b.enabled?'':'（已停用）'}</option>`).join('')
    :'<option value="">（本工程还没有漫画阅读器区块）</option>';
  mk.style.display=comics.length?'none':'';
}

export function renderNh(){
  const col=$('#nhCol');
  if(!col.dataset.built){
    col.innerHTML=`
    <div class="card">
      <h3>📚 漫画导入 <span class="status-dot" id="nhDot"></span><span class="nh-svchint" id="nhSvcHint">检查中…</span>
        <button type="button" class="btn small" id="nhStart" style="display:none">🚀 一键启动服务</button>
        <button type="button" class="btn ghost small" id="nhStop" style="display:none">⏹ 停止服务</button></h3>
      <p class="nh-hint">通过<strong>本机辅助服务</strong>抓取 nhentai 画廊的页面直链（浏览器直连会被跨域拦截，故服务只监听本机 127.0.0.1）。未连接时点 <strong>🚀 一键启动服务</strong>（首次使用先跑一次 <code>npm run nh-install</code> 注册协议，之后浏览器会询问一次是否打开）；也可手动 <code>npm run nh-serve</code>，或单次命令 <code>npm run nh -- 画廊链接 --skip-last 3</code> 直接导出到剪贴板。抓到全本后在下方<strong>勾选要的页</strong>（末尾广告页直接取消勾选），一键写入漫画阅读器区块。</p>
      <div class="row2"><div><label>服务地址</label><input id="nhAddr" value="${esc(getAddr())}"></div>
      <div style="display:flex;align-items:flex-end"><button type="button" class="btn ghost small" id="nhProbe">检查连接</button></div></div>
      <div class="row2"><div><label>画廊链接或 ID</label><input id="nhUrl" placeholder="https://nhentai.net/g/123456/ 或 123456"></div>
      <div style="display:flex;align-items:flex-end"><button type="button" class="btn" id="nhFetch">🌐 抓取页面</button></div></div>
    </div>
    <div class="card" id="nhResultCard" style="display:none">
      <h3>抓取结果（<span id="nhTotal">0</span> 页 · 来源 <span id="nhSrc"></span>）</h3>
      <div class="nh-toolbar">
        <button type="button" class="btn ghost small" id="nhAll">☑ 全选</button>
        <button type="button" class="btn ghost small" id="nhNone">☐ 全不选</button>
        <button type="button" class="btn ghost small" id="nhInv">⇄ 反选</button>
        <input id="nhRange" placeholder="页码 1-20,25" style="width:110px">
        <button type="button" class="btn ghost small" id="nhRangeBtn">按页码选</button>
        <input id="nhTail" type="number" min="0" value="3" style="width:60px">
        <button type="button" class="btn ghost small" id="nhTailBtn">去尾 N 页</button>
        <label class="inline-check"><input type="checkbox" id="nhShowImg" checked>预览图</label>
        <span id="nhCount" style="margin-left:auto;font-size:12px;color:var(--txt2)"></span>
      </div>
      <div class="nh-grid" id="nhGrid"></div>
      <div class="row2"><div><label>应用到区块</label><select id="nhTarget"></select></div>
      <div style="display:flex;align-items:flex-end;gap:6px"><button type="button" class="btn" id="nhApply">📥 应用到所选区块</button><button type="button" class="btn ghost small" id="nhCopy">复制 URL 列表</button></div></div>
      <button type="button" class="btn ghost small" id="nhMk" style="display:none;margin-top:6px">＋ 创建漫画阅读器区块</button>
    </div>`;
    /* 事件绑定（构建一次，全部挂在此处） */
    $('#nhAddr',col).addEventListener('change',function(){setAddr(this.value.trim().replace(/\/+$/,'')||DEF_ADDR);probe()});
    $('#nhProbe',col).onclick=()=>probe();
    $('#nhStart',col).onclick=async function(){
      this.disabled=true;
      try{await ensureService()}finally{this.disabled=false}
    };
    $('#nhStop',col).onclick=async function(){
      const addr=$('#nhAddr',col).value.trim().replace(/\/+$/,'');
      try{await fetch(addr+'/api/shutdown');toast('服务已停止')}
      catch(e){toast('停止失败：'+e.message)}
      /* 服务端 100ms 延迟退出，立即探活会误报仍在线 */
      setTimeout(probe,500);
    };
    $('#nhFetch',col).onclick=async function(){
      const q=$('#nhUrl',col).value.trim();
      if(!q){toast('先填画廊链接或 ID');return}
      /* grab 抛 service-unreachable 表示连接不上服务（网络层），与服务返回的业务错误区分开 */
      const grab=async()=>{
        const addr=$('#nhAddr',col).value.trim().replace(/\/+$/,'');
        let res;
        try{res=await fetch(addr+'/api/gallery?url='+encodeURIComponent(q))}
        catch(e){throw new Error('service-unreachable')}
        const j=await res.json();
        if(!j.ok)throw new Error(j.error||'服务返回异常');
        st.total=j.total;st.urls=j.urls;st.thumbs=j.thumbs;st.source=j.source;
        renderGrid();
      };
      this.disabled=true;const old=this.textContent;this.textContent='⏳ 抓取中…';
      try{
        try{await grab()}
        catch(e){
          if(e.message!=='service-unreachable')throw e;
          /* 服务未连接：自动一键唤起（opg-nh:// 协议）后重试一次 */
          if(!await ensureService())throw new Error('服务未能启动——先跑一次 npm run nh-install 注册一键启动，或手动 npm run nh-serve');
          await grab();
        }
      }catch(e){toast('抓取失败：'+e.message)}
      finally{
        probe();
        this.disabled=false;this.textContent=old;
      }
    };
    $('#nhGrid',col).addEventListener('change',e=>{if(e.target.dataset.nhpg!==undefined)updateCount()});
    $('#nhAll',col).onclick=()=>setChecked(()=>true);
    $('#nhNone',col).onclick=()=>setChecked(()=>false);
    $('#nhInv',col).onclick=()=>setChecked((pg,el)=>!el.checked);
    $('#nhRangeBtn',col).onclick=()=>{
      const set=parsePageExpr($('#nhRange',col).value,st.total);
      if(!set){toast('页码表达式没解析出有效页（示例：1-20,25）');return}
      setChecked(pg=>set.includes(pg));
    };
    $('#nhTailBtn',col).onclick=()=>{
      const n=Math.max(0,Math.min(st.total,Math.floor(+$('#nhTail',col).value||0)));
      const from=st.total-n+1;
      setChecked(pg=>pg<from);
    };
    $('#nhShowImg',col).addEventListener('change',function(){$('#nhGrid',col).classList.toggle('noimg',!this.checked)});
    $('#nhCopy',col).onclick=async()=>{
      const list=checkedPages().map(pg=>st.urls[pg-1]).join('\n');
      if(!list){toast('没有勾选任何页');return}
      try{await navigator.clipboard.writeText(list);toast(`已复制 ${checkedPages().length} 条直链`)}
      catch(e){toast('复制失败（'+e.message+'）——可用命令行 npm run nh 走剪贴板')}
    };
    $('#nhMk',col).onclick=()=>{
      const p2=Project.cur;
      const blk={type:'comic',enabled:true,...BLOCK_DEFS.comic.create()};
      p2.blocks.push(blk);
      UI.renderConfig();UI.refreshPreview();Project.save();Project.saveSnapshot();refreshTargets();
      $('#nhTarget',col).value=String(p2.blocks.length-1);
      toast('已创建并选中漫画阅读器区块');
    };
    $('#nhApply',col).onclick=async()=>{
      const p2=Project.cur,idx=+($('#nhTarget',col).value);
      const blk=p2.blocks[idx];
      if(!blk||blk.type!=='comic'){toast('请先选择目标区块（或创建一个）');return}
      const pages=checkedPages();
      if(!pages.length){toast('没有勾选任何页');return}
      if(Project.cur!==p2){toast('⚠️ 已切换工程，请重新操作');return}
      const oldN=Array.isArray(blk.pages)?blk.pages.filter(x=>x.url).length:0;
      if(oldN&&!await confirmModal(`将把「区块 #${idx+1} · ${blk.title||'未命名'}」现有 ${oldN} 页替换为勾选的 ${pages.length} 页（原页与说明清空），确定？`))return;
      Project.saveSnapshot();
      blk.pages=pages.map(pg=>({url:st.urls[pg-1],cap:''}));
      UI.renderConfig();UI.refreshPreview();Project.save();
      toast(`已写入 ${pages.length} 页到区块 #${idx+1}`);
    };
    col.dataset.built='1';
    probe();
  }
  /* 每次刷新（含切工程/撤销重做后的 renderAll）：重刷目标下拉，抓取结果保留 */
  refreshTargets();
}
