/* 导出页渲染 */
import { $, esc, copyText, download, highlightCode, toast } from '../utils.js';
import { Project } from '../project.js';
import { Gen } from '../gen/index.js';

export function renderExport(){
  const p=Project.cur,col=$('#exportCol');col.innerHTML='';
  /* 单次构建：fencedFullDoc 与 regexScript.replaceString 都是同一文档的再包装，复用字符串。
     围栏必须走 Gen.fencedFullDoc——正文含 ``` 时会升级四反引号长围栏，手拼三反引号会提前闭合 */
  const fullDoc=Gen.buildFullDoc(p);
  const fenced=Gen.fencedFullDoc(p);
  /* 预览截断：超长文档只高亮前 2 万字符（防切在 emoji 代理对中间），复制/下载始终为完整内容 */
  const hlDoc=s=>{
    if(s.length<=20000)return highlightCode(s);
    s=s.slice(0,20000);
    if(/[\uD800-\uDBFF]$/.test(s))s=s.slice(0,-1);
    return highlightCode(s)+'\n…（预览截断，完整内容以复制/下载为准）';
  };

  /* ① 开场白版：完整 HTML 文档 + ``` 围栏（酒馆助手只渲染「代码块内 + 含 <body></body>」的代码） */
  /* 导出自检：单次构建后跑 auditFullDoc，阻断级问题阻止复制/下载（产物固定，报告只算一次） */
  const audit=Gen.auditFullDoc(fullDoc);
  const auditLine=audit.ok
    ?`<div style="font-size:12px;color:var(--ok,#7fc97f);margin:4px 0">✓ 自检通过${audit.problems.length?`（${audit.problems.length} 条提示）`:''}</div>`
    :`<div style="font-size:12px;color:var(--danger,#e07070);margin:4px 0">✗ 自检未通过（${audit.problems.filter(x=>x.level==='阻断').length} 项阻断）：${esc(audit.problems.map(x=>x.msg).join('；'))}</div>`;
  const auditHints=audit.problems.filter(x=>x.level==='提示');
  const guard=()=>{const b=audit.problems.find(x=>x.level==='阻断');if(b){toast('自检未通过：'+b.msg);return false}return true};
  const box1=document.createElement('div');box1.className='card export-box';
  box1.innerHTML=`<h3>① 开场白版 <span class="hint">整段贴进 first_mes 或 alternate_greetings，保留 \`\`\` 围栏与 body 标签</span></h3>
    <div style="font-size:12px;color:var(--txt2);margin:6px 0">⚠️ 酒馆助手只渲染「位于 <code>\`\`\`</code> 代码块内且同时含 <code>&lt;body&gt;</code> 与 <code>&lt;/body&gt;</code> 标签」的代码，因此这里导出的是完整 HTML 文档而非组件片段——请整段复制，不要删除围栏或 body 标签。</div>
    ${auditLine}${auditHints.length?`<div style="font-size:12px;color:var(--txt2);margin:4px 0">提示：${esc(auditHints.map(x=>x.msg).join('；'))}</div>`:''}
    <div class="export-actions">
      <button class="btn small" id="exp1CopyFenced">📋 复制（带代码围栏，推荐）</button>
      <button class="btn ghost small" id="exp1CopyRaw">📋 复制 HTML 文档</button>
      <button class="btn ghost small" id="exp1Dl">💾 下载 .html</button>
    </div><pre></pre>`;
  $('pre',box1).innerHTML=hlDoc(fenced);
  $('#exp1CopyFenced',box1).onclick=()=>{if(guard())copyText(fenced)};
  $('#exp1CopyRaw',box1).onclick=()=>{if(guard())copyText(fullDoc)};
  $('#exp1Dl',box1).onclick=()=>{if(guard())download(`${p.name}-开场白版.html`,fullDoc)};
  col.appendChild(box1);

  /* ④ 兼容审查报告：与 ① 导出自检并列（提示级避坑清单，不阻断复制/下载；报告只算一次） */
  const compat=Gen.auditCompat(p);
  if(compat.items.length){
    const cc=document.createElement('div');cc.className='card export-box';
    cc.innerHTML=`<h3>⚠️ 兼容审查报告 <span class="hint">提示级避坑清单，不阻断导出，逐条核对即可</span></h3>
      ${compat.items.map(x=>`<div style="font-size:12px;color:var(--txt2);margin:4px 0">• ${esc(x.msg)}</div>`).join('')}`;
    col.appendChild(cc);
  }

  /* ② 标记 + 正则脚本版：生成可直接导入酒馆的正则 JSON */
  const rx=document.createElement('div');rx.className='card export-box';
  rx.innerHTML=`<h3>② 标记 + 正则脚本版 <span class="hint">把「标记」贴进开场白/世界书，导入生成的正则脚本即可渲染</span></h3>
    <div class="row2">
      <div><label>标记文本（正则查找目标，避免与正文重复）</label><input id="markerInput" value="${esc(p.marker||'【开场页】')}"></div>
      <div style="display:flex;align-items:flex-end;gap:8px">
        <button class="btn small" id="markerCopy">📋 复制标记</button>
        <button class="btn small" id="rxDownload">💾 下载正则脚本 .json</button>
      </div>
    </div>
    <div class="row2">
      <div><label>替换生效位置（placement）</label><select id="rxPlacement">
        <option value="2" selected>AI 输出（开场白正文，默认）</option>
        <option value="1">用户输入</option>
        <option value="1,2">用户输入 + AI 输出</option>
      </select></div>
      <div style="display:flex;align-items:end;padding-bottom:4px"><label class="inline-check"><input type="checkbox" id="rxRunOnEdit" checked>编辑消息时也重新渲染（runOnEdit）</label></div>
    </div>
    <div style="font-size:12px;color:var(--txt2);margin:10px 0 4px">使用：酒馆 → 扩展 → 正则（Regex）→ 导入下载的 JSON → 把上面的标记文本贴进开场白或世界书条目。渲染时正则会把标记替换为完整页面代码围栏（由酒馆助手渲染为 iframe）。</div>
    <pre></pre>`;
  const rxOpts=()=>({
    placement:$('#rxPlacement',rx).value.split(',').map(x=>+x),
    runOnEdit:$('#rxRunOnEdit',rx).checked,
  });
  /* replaceString 与 marker/placement/runOnEdit 无关（仅在下载时读取），pre 只渲染一次 */
  $('pre',rx).innerHTML=hlDoc(fenced);
  $('#markerCopy',rx).onclick=()=>copyText($('#markerInput',rx).value.trim()||'【开场页】');
  $('#rxDownload',rx).onclick=()=>{
    p.marker=$('#markerInput',rx).value.trim()||'【开场页】';
    Project.save();
    download(`regex-开场页-${p.name}.json`,JSON.stringify(Gen.regexScript(p,rxOpts()),null,2));
  };
  $('#markerInput',rx).addEventListener('change',e=>{
    p.marker=e.target.value.trim()||'【开场页】';
    Project.save();
  });
  col.appendChild(rx);
}