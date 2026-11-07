/* 导出页渲染（付梓台：审读 → 钤印 → 发付）——分段切换三种格式，共用一个产物查看器 */
import { $, $$, esc, copyText, download, highlightCode, toast } from '../utils.js';
import { Project } from '../project.js';
import { Gen } from '../gen/index.js';
import { hasBridge, openCardWriter } from './extBridge.js';

export function renderExport(){
  const p=Project.cur,col=$('#exportCol');col.innerHTML='';
  /* 单次构建：fencedFullDoc 与 regexScript.replaceString 都是同一文档的再包装，复用字符串。
     围栏必须走 Gen.fencedFullDoc——正文含 ``` 时会升级四反引号长围栏，手拼三反引号会提前闭合 */
  const fullDoc=Gen.buildFullDoc(p);
  const fenced=Gen.fencedFullDoc(p);
  const audit=Gen.auditFullDoc(fullDoc);
  const compat=Gen.auditCompat(p);
  /* 预览截断：超长文档只高亮前 2 万字符（防切在 emoji 代理对中间），复制/下载始终为完整内容 */
  const hlDoc=s=>{
    if(s.length<=20000)return highlightCode(s);
    let t=s.slice(0,20000);
    if(/[\uD800-\uDBFF]$/.test(t))t=t.slice(0,-1);
    return highlightCode(t)+'\n…（预览截断，完整内容以复制/下载为准）';
  };
  const blockers=audit.problems.filter(x=>x.level==='阻断');
  /* 导出自检：阻断级问题阻止复制/下载（产物固定，报告只算一次） */
  const guard=()=>{if(blockers.length){toast('自检未通过：'+blockers[0].msg);return false}return true};

  /* ── 头部：工程徽章 + 体积预警 + 审读钤印 ── */
  /* 工程数据体积：localStorage 约 5MB 上限的显式预警（导出即备份的场景下最容易看到） */
  const dataKB=(JSON.stringify(p).length/1024).toFixed(0);
  const sizeCls=dataKB>1024?' err':dataKB>512?' warn':'';
  const sizeHint=dataKB>1024?'超 1MB——接近浏览器存储上限，建议拆分工程或精简图片/HTML':dataKB>512?'偏大，注意增长':'';
  const head=document.createElement('div');head.className='exp-head';
  head.innerHTML=`<span class="t">📤 导出</span>
    <span class="exp-chip">📄 ${esc(p.name||'未命名工程')}</span>
    <span class="exp-chip${sizeCls}" ${sizeHint?`title="${esc(sizeHint)}"`:''}>📦 ${dataKB} KB${sizeHint?' ⚠':''}</span>
    ${blockers.length
      ?`<span class="exp-seal bad" title="存在阻断级问题，复制/下载会被拦截，详见底部付印审读">✗ ${blockers.length} 项阻断</span>`
      :`<span class="exp-seal ok" title="导出自检通过${audit.problems.length?`，另有 ${audit.problems.length} 条提示见底部付印审读`:''}">✓ 钤印 · 审读通过</span>`}`;
  col.appendChild(head);

  /* ── 统计行 + 一键备份（v1.29）：只读当前工程实时算数；备份走 Project.exportAll（逐工程剔 Key） ── */
  const enN=p.blocks.filter(b=>b.enabled).length;
  const greetB=p.blocks.find(b=>b.enabled&&b.type==='greetings');
  const greetN=greetB&&Array.isArray(greetB.entries)?greetB.entries.length:0;
  let imgN=0;
  p.blocks.forEach(b=>{
    if(!b||!b.enabled)return;
    if(b.type==='gallery'&&Array.isArray(b.images))imgN+=b.images.filter(x=>x&&x.url).length;
    if(b.type==='comic'){if(b.cover)imgN++;if(Array.isArray(b.pages))imgN+=b.pages.filter(x=>x&&x.url).length}
    if(b.type==='profile'&&Array.isArray(b.characters))imgN+=b.characters.filter(c=>c&&c.avatar).length;
  });
  if(p.theme&&p.theme.bg&&p.theme.bg.type==='image'&&p.theme.bg.image)imgN++;
  const upd=(p.updatedAt||p.createdAt||'').slice(0,10);
  const stats=document.createElement('div');stats.className='card export-box';
  stats.innerHTML=`<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--txt2)">
    <span style="font-weight:700;color:var(--txt)">📊 统计</span>
    <span>区块 ${enN}/${p.blocks.length}</span><span>开场白 ${greetN} 条</span><span>图片 ${imgN} 张</span>
    <span>产物 ${(fullDoc.length/1024).toFixed(0)} KB</span><span>最近修改 ${esc(upd)||'—'}</span>
    <button type="button" class="btn ghost small" id="backupAll" title="全部工程合并为一个 JSON（剔除 API Key），可经「导入工程」整包还原">💾 一键备份全部工程</button>
  </div>`;
  $('#backupAll',stats).onclick=()=>Project.exportAll();
  col.appendChild(stats);

  /* ── 格式分段切换 ── */
  const seg=document.createElement('div');seg.className='seg exp-seg';
  seg.innerHTML=`
    <button type="button" data-fmt="doc" class="active">① 开场白版</button>
    <button type="button" data-fmt="rx">② 标记 + 正则</button>
    <button type="button" data-fmt="bh">③ 返回开场页</button>`;
  col.appendChild(seg);

  /* ── ① 开场白版 ── */
  const p1=document.createElement('div');p1.className='card export-box exp-panel active';p1.dataset.fmt='doc';
  p1.innerHTML=`<h3>① 开场白版 <span class="hint">整段贴进 first_mes 或 alternate_greetings，保留 \`\`\` 围栏与 body 标签</span></h3>
    <div class="exp-note">⚠️ 酒馆助手只渲染「位于 <code>\`\`\`</code> 代码块内且同时含 <code>&lt;body&gt;</code> 与 <code>&lt;/body&gt;</code> 标签」的代码，因此导出的是完整 HTML 文档而非组件片段——请整段复制，不要删除围栏或 body 标签（正文自带 <code>\`\`\`</code> 时已自动升级四反引号长围栏）。</div>
    <div class="exp-note">⚠️ 最关键的一句：<strong>原生酒馆不执行完整 HTML</strong>——本页依赖酒馆助手（TavernHelper）的 iframe 渲染路径，没装酒馆助手时整段只会被当作纯代码块展示。
    <details style="margin-top:4px"><summary style="cursor:pointer;font-size:12px;color:var(--txt2)">各环境降级对照（点开）</summary>
      <div style="font-size:12px;color:var(--txt2);margin-top:6px;line-height:1.9">
        <strong style="color:var(--txt)">有酒馆助手</strong>：完整体验——开场白列表与切换、BGM 接续播放、标题库覆盖、返回开场页脚本、年龄闸门「离开」。<br>
        <strong style="color:var(--txt)">仅正则、无酒馆助手</strong>：页面正常渲染，但——开场白列表可见而点击无效（切换/填入/按钮全依赖 API）；BGM 回落各楼独立播放、刷新不接续；标题库回落「首行作标题」自动提取；年龄闸门「离开」不退出。<br>
        <strong style="color:var(--txt)">原生酒馆（纯文本）</strong>：整段 HTML 被当作代码块展示原文，不渲染。<br>
        ⚠️ 酒馆用户设置「在响应中显示标签」开启时，正则插入的 HTML 可能被转义为纯文本显示（该开关行为待真机核实，遇到此现象先关闭它重试）；消息 HTML 会经 DOMPurify 清洗——<code>&lt;style&gt;</code> 被限定作用域到楼层内、<code>&lt;custom-style&gt;</code> 标签被放行（酒馆 1.19 源码核对）。
      </div>
    </details></div>
    <div class="export-actions">
      <button type="button" class="btn small" id="exp1CopyFenced">📋 复制（带围栏，推荐）</button>
      <button type="button" class="btn ghost small" id="exp1CopyRaw">📋 复制 HTML 文档</button>
      <button type="button" class="btn ghost small" id="exp1Dl">💾 下载 .html</button>
      <button type="button" class="btn ghost small" id="exp1Peek" title="在浏览器新标签页打开最终成品——贴进酒馆前的最后一眼">👁 新窗看产物</button>
      ${hasBridge()?'<button type="button" class="btn small" id="exp1ToCard" title="经酒馆接口直写当前酒馆里的角色卡">📤 写入角色卡…</button>':''}
    </div>`;
  $('#exp1CopyFenced',p1).onclick=()=>{if(guard())copyText(fenced)};
  $('#exp1CopyRaw',p1).onclick=()=>{if(guard())copyText(fullDoc)};
  $('#exp1Dl',p1).onclick=()=>{if(guard())download(`${p.name}-开场白版.html`,fullDoc)};
  $('#exp1Peek',p1).onclick=()=>{
    if(!guard())return;
    const u=URL.createObjectURL(new Blob([fullDoc],{type:'text/html'}));
    const w=window.open(u,'_blank');
    if(!w)toast('浏览器拦截了新窗口，请允许本页弹出');
    setTimeout(()=>URL.revokeObjectURL(u),60000);
  };
  const toCardBtn=$('#exp1ToCard',p1);
  if(toCardBtn){
    /* 写卡时按所选卡重建文档：把卡的真实开场白烘焙进 greetings 区块静态列表
       （Gen.greetSnapshotLines 转占位行），替代编辑器占位文本；无 greetings 区块则不传 */
    const hasGreet=p.blocks.some(b=>b.enabled&&b.type==='greetings');
    const rebuildGreet=hasGreet?texts=>{
      const list=Gen.greetSnapshotLines(texts,(p.blocks.find(b=>b.enabled&&b.type==='greetings')||{}).excludedTags);
      if(!list)return null;
      const clone={...p,blocks:p.blocks.map(b=>b.enabled&&b.type==='greetings'?{...b,placeholderList:list}:b)};
      return Gen.fencedFullDoc(clone);
    }:null;
    toCardBtn.onclick=()=>{if(guard())openCardWriter(fenced,rebuildGreet)};
  }
  col.appendChild(p1);

  /* ── ② 标记 + 正则脚本版 ── */
  const rxOpts=()=>({
    placement:$('#rxPlacement').value.split(',').map(x=>+x),
    runOnEdit:$('#rxRunOnEdit').checked,
    maxDepth:$('#rxMaxDepth').value===''?null:Math.max(0,+$('#rxMaxDepth').value||0),
  });
  const rxJson=()=>JSON.stringify(Gen.regexScript(p,rxOpts()),null,2);
  /* ② 查看器预览：replaceString 即整份页面文档（常超 2 万字符），原样展示会把 placement 等
     选项字段全部挤出截断线——预览版把该字段缩略为字符数说明，完整 JSON 以复制/下载为准 */
  const rxPreview=()=>{
    const o=Gen.regexScript(p,rxOpts());
    return JSON.stringify({...o,replaceString:`（…完整页面文档 ${o.replaceString.length.toLocaleString()} 字符，随 JSON 下载，此处省略…）`},null,2);
  };
  const p2=document.createElement('div');p2.className='card export-box exp-panel';p2.dataset.fmt='rx';
  p2.innerHTML=`<h3>② 标记 + 正则 <span class="hint">把「标记」贴进开场白/世界书，正则脚本导入酒馆后把标记替换为页面</span></h3>
    <div class="exp-opts">
      <div><label>标记文本（正则查找目标，避免与正文重复）</label><input id="markerInput" value="${esc(p.marker||'【开场页】')}"></div>
      <div><label>替换生效位置（placement）</label><select id="rxPlacement">
        <option value="2" selected>AI 输出（开场白正文，默认）</option>
        <option value="1">用户输入</option>
        <option value="1,2">用户输入 + AI 输出</option>
      </select></div>
      <div><label class="inline-check"><input type="checkbox" id="rxRunOnEdit" checked>编辑消息时也重新渲染（runOnEdit）</label></div>
      <div><label>渲染楼层限制 maxDepth（留空=全部楼层；0=仅最后一楼，防 AI 复读标记时旧楼重复渲染）</label><input type="number" min="0" id="rxMaxDepth" placeholder="不限"></div>
    </div>
    <div class="exp-steps">使用：① 酒馆 → 扩展 → 正则（Regex）→ 导入下载的 JSON 并启用　② 把标记文本贴进开场白或世界书条目　③ 渲染时正则把标记替换为完整页面代码围栏，由酒馆助手渲染为 iframe。</div>
    <div class="export-actions">
      <button type="button" class="btn small" id="markerCopy">📋 复制标记</button>
      <button type="button" class="btn small" id="rxCopyJson">📋 复制脚本 JSON</button>
      <button type="button" class="btn ghost small" id="rxDownload">💾 下载正则脚本 .json</button>
    </div>`;
  const saveMarker=()=>{p.marker=$('#markerInput').value.trim()||'【开场页】';Project.save()};
  $('#markerCopy',p2).onclick=()=>copyText($('#markerInput').value.trim()||'【开场页】');
  $('#rxCopyJson',p2).onclick=()=>copyText(rxJson());
  $('#rxDownload',p2).onclick=()=>{saveMarker();download(`regex-开场页-${p.name}.json`,rxJson())};
  $('#markerInput',p2).addEventListener('change',()=>{saveMarker();renderViewer(true)});
  ['#rxPlacement','#rxRunOnEdit','#rxMaxDepth'].forEach(s=>$(s,p2).addEventListener('change',()=>renderViewer(true)));
  col.appendChild(p2);

  /* ── ③ 返回开场页脚本 ── */
  /* 内置模板外置于 slots/back-home.json（插槽式，换文件重建即换，契约见 slots/README.md）；
     v1.29 起工程 backHome 配置经下方表单烘焙进脚本 CFG（文案/颜色/图片/出现时机），全默认=模板原样透传 */
  const bhName=Gen.backHomeScript(p).name;
  const p3=document.createElement('div');p3.className='card export-box exp-panel';p3.dataset.fmt='bh';
  p3.innerHTML=`<h3>③ 返回开场页 <span class="hint">酒馆助手角色脚本：切到其它开场白后，第 0 楼末尾出现「返回开场页」按钮</span></h3>
    <div class="exp-opts">
      <div><label>按钮样式</label><select id="bhMode">
        <option value="text" ${p.backHome.mode!=='img'?'selected':''}>文字按钮</option>
        <option value="img" ${p.backHome.mode==='img'?'selected':''}>图片按钮</option>
      </select></div>
      <div><label>按钮文案（图片模式下作 alt）</label><input id="bhText" value="${esc(p.backHome.text)}"></div>
      <div><label>按钮图片 URL（图片模式用）</label><input id="bhImg" value="${esc(p.backHome.img)}" placeholder="https://…"></div>
      <div><label>主色（六位 hex，留空=模板默认）</label><input id="bhPrimary" value="${esc(p.backHome.primary)}" placeholder="#6e63bf"></div>
      <div><label>强调色（六位 hex，留空=模板默认）</label><input id="bhAccent" value="${esc(p.backHome.accent)}" placeholder="#e8c47c"></div>
      <div><label>出现时机：第几张 swipe 起出现（1=所有非首页 swipe）</label><input type="number" min="1" id="bhFromSwipe" value="${+p.backHome.fromSwipe||1}"></div>
    </div>
    <div class="exp-note">内置模板：<strong>${esc(bhName)}</strong>（<code>slots/back-home.json</code>——替换该文件后重新构建即生效，契约见 <code>slots/README.md</code>）。以上配置生成时烘焙进脚本，全部默认则与模板逐字一致。</div>
    <div class="exp-steps">使用：① 酒馆助手 → 角色脚本 → 导入本 JSON 并启用　② 第 0 楼开场白 swipe 到第 <span id="bhFswEcho">${+p.backHome.fromSwipe||1}</span> 张及以后时，正文末尾自动出现返回按钮，点击即切回开场页并顺带停掉联动音轨；开场页本身（第 0 张）不会出现按钮。原理：swipe 切换会整体销毁楼层 iframe，返回按钮只能由不随楼层销毁的角色脚本注入。</div>
    <div class="export-actions">
      <button type="button" class="btn small" id="bhCopy">📋 复制脚本 JSON</button>
      <button type="button" class="btn ghost small" id="bhDownload">💾 下载角色脚本 .json</button>
    </div>`;
  const bhJson=()=>JSON.stringify(Gen.backHomeScript(p),null,2);
  const bhSync=()=>{
    p.backHome.mode=$('#bhMode',p3).value;
    p.backHome.text=$('#bhText',p3).value.trim()||'← 返回开场页';
    p.backHome.img=$('#bhImg',p3).value.trim();
    p.backHome.primary=$('#bhPrimary',p3).value.trim();
    p.backHome.accent=$('#bhAccent',p3).value.trim();
    p.backHome.fromSwipe=Math.max(1,Math.floor(+$('#bhFromSwipe',p3).value)||1);
    Project.save();
    $('#bhFswEcho',p3).textContent=p.backHome.fromSwipe;
    renderViewer(true);
  };
  ['#bhMode','#bhText','#bhImg','#bhPrimary','#bhAccent','#bhFromSwipe'].forEach(s=>$(s,p3).addEventListener('change',bhSync));
  $('#bhCopy',p3).onclick=()=>copyText(bhJson());
  $('#bhDownload',p3).onclick=()=>download(`backhome-开场页-${p.name}.json`,bhJson());
  col.appendChild(p3);

  /* ── 共用产物查看器：显示当前格式的真实产物（① 围栏文档 / ② 正则 JSON / ③ 角色 JSON） ── */
  let fmt='doc';
  const SOURCES={
    doc:{t:'① 开场白版 · 代码围栏文档',get:()=>fenced},
    rx:{t:'② 正则脚本 JSON',get:rxPreview,full:()=>rxJson().length,abridged:true},
    bh:{t:'③ 返回开场页 · 角色脚本 JSON',get:bhJson},
  };
  const viewer=document.createElement('div');viewer.className='exp-code';
  viewer.innerHTML=`<div class="exp-code-bar"><span class="t">产物预览</span><span id="expCodeMeta"></span></div><pre></pre>`;
  const pre=$('pre',viewer),meta=$('#expCodeMeta',viewer);
  const renderViewer=swap=>{
    const s=SOURCES[fmt],src=s.get();
    pre.innerHTML=hlDoc(src);
    const fullLen=(s.full?s.full():src.length).toLocaleString();
    meta.textContent=`${s.t} · 完整 ${fullLen} 字符${s.abridged?' · 预览省略 replaceString':src.length>20000?' · 前 2 万':''}`;
    if(swap){viewer.classList.remove('swap');void viewer.offsetWidth;viewer.classList.add('swap')}
  };
  col.appendChild(viewer);
  seg.addEventListener('click',e=>{
    const b=e.target.closest('button[data-fmt]');
    if(!b||b.dataset.fmt===fmt)return;
    fmt=b.dataset.fmt;
    $$('button',seg).forEach(x=>x.classList.toggle('active',x===b));
    $$('.exp-panel',col).forEach(x=>x.classList.toggle('active',x.dataset.fmt===fmt));
    renderViewer(true);
  });
  renderViewer(false);

  /* ── 付印审读：导出自检 + 兼容审查合并逐条列（提示级避坑清单不阻断导出） ── */
  const total=audit.problems.length+compat.items.length;
  const lvRow=x=>`<div class="exp-audit-item"><span class="exp-lv ${x.level==='阻断'?'bad':'warn'}">${x.level}</span><span>${esc(x.msg)}</span></div>`;
  const auditSec=document.createElement('details');auditSec.className='exp-audit';
  if(blockers.length)auditSec.open=true;
  auditSec.innerHTML=`<summary><span class="arr">▶</span>📋 付印审读 <span class="hint">导出自检 + 兼容审查，发卡前逐条核对</span>
    <span class="exp-chip ${blockers.length?'err':'ok'}">${blockers.length?`✗ ${blockers.length} 项阻断`:'✓ 无阻断'}${total?` · ${total} 条提示`:''}</span></summary>
    <div class="exp-audit-body">
      ${audit.problems.length?`<h5>产物自检</h5>${audit.problems.map(lvRow).join('')}`:''}
      ${compat.items.length?`<h5>兼容审查</h5>${compat.items.map(lvRow).join('')}`:''}
      ${!total?'<div class="exp-audit-item"><span class="exp-lv ok">通过</span><span>未发现已知坑位，可以发卡。</span></div>':''}
    </div>`;
  col.appendChild(auditSec);
}
