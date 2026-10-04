/* 导出页渲染 */
import { $, esc, copyText, download, highlightCode, toast } from '../utils.js';
import { Project } from '../project.js';
import { Gen } from '../gen/index.js';
import { hasBridge, openCardWriter } from './extBridge.js';

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
      ${hasBridge()?'<button class="btn small" id="exp1ToCard" title="经酒馆接口直写当前酒馆里的角色卡">📤 写入角色卡…</button>':''}
    </div><pre></pre>`;
  $('pre',box1).innerHTML=hlDoc(fenced);
  $('#exp1CopyFenced',box1).onclick=()=>{if(guard())copyText(fenced)};
  $('#exp1CopyRaw',box1).onclick=()=>{if(guard())copyText(fullDoc)};
  $('#exp1Dl',box1).onclick=()=>{if(guard())download(`${p.name}-开场白版.html`,fullDoc)};
  const toCardBtn=$('#exp1ToCard',box1);
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
      <div style="margin-top:4px"><label>渲染楼层限制 maxDepth（留空=全部楼层；0=仅最后一楼，防 AI 复读标记时旧楼重复渲染）</label><input type="number" min="0" id="rxMaxDepth" placeholder="不限"></div>
    </div>
    <div style="font-size:12px;color:var(--txt2);margin:10px 0 4px">使用：酒馆 → 扩展 → 正则（Regex）→ 导入下载的 JSON → 把上面的标记文本贴进开场白或世界书条目。渲染时正则会把标记替换为完整页面代码围栏（由酒馆助手渲染为 iframe）。</div>
    <pre></pre>`;
  const rxOpts=()=>({
    placement:$('#rxPlacement',rx).value.split(',').map(x=>+x),
    runOnEdit:$('#rxRunOnEdit',rx).checked,
    maxDepth:$('#rxMaxDepth',rx).value===''?null:Math.max(0,+$('#rxMaxDepth',rx).value||0),
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

  /* ③ 返回开场页脚本：生成可直接导入酒馆助手的角色脚本 JSON（非首页注入返回按钮）
     配置持久化在 p.backHome（仿 p.marker），保证切页后输入不丢 */
  const bhx=document.createElement('div');bhx.className='card export-box';
  const bhCfg=p.backHome||{};
  bhx.innerHTML=`<h3>③ 返回开场页脚本 <span class="hint">酒馆助手角色脚本：切到其它开场白后，第0楼末尾出现「返回开场页」按钮</span></h3>
    <div class="row2">
      <div><label>按钮样式</label><select id="bhMode">
        <option value="text">文字按钮（套用工程主题色）</option>
        <option value="img">图片按钮（图床直链）</option>
      </select></div>
      <div><label>按钮文字（图片模式作 alt）</label><input id="bhText" value="${esc(bhCfg.text||'← 返回开场页')}"></div>
    </div>
    <div class="row2">
      <div><label>图片直链 URL（仅图片模式，https 开头；留空自动回退文字按钮）</label><input id="bhImg" value="${esc(bhCfg.img||'')}" placeholder="https://…"></div>
      <div style="display:flex;align-items:flex-end;gap:8px">
        <button class="btn small" id="bhCopy">📋 复制脚本 JSON</button>
        <button class="btn small" id="bhDownload">💾 下载角色脚本 .json</button>
      </div>
    </div>
    <div style="font-size:12px;color:var(--txt2);margin:10px 0 4px">使用：酒馆 → 扩展 → 酒馆助手 → 角色脚本 → 导入本 JSON 并启用。之后把第 0 楼开场白 swipe 到第 2 张及以后时，正文末尾自动出现返回按钮，点击即回到开场页；开场页本身（第 0 张）不会出现按钮，点返回会顺带停掉开场白联动音轨。原理上按钮必须由独立角色脚本注入（swipe 切换会销毁楼层 iframe，开场页自己的脚本活不到那时候）。</div>
    <pre></pre>`;
  const bhJson=()=>JSON.stringify(Gen.backHomeScript(p),null,2);
  const bhRefresh=()=>{$('pre',bhx).innerHTML=hlDoc(bhJson())};
  const bhMode=$('#bhMode',bhx),bhText=$('#bhText',bhx),bhImg=$('#bhImg',bhx);
  bhMode.value=bhCfg.mode==='img'?'img':'text';
  const bhSyncImg=()=>{bhImg.parentElement.style.display=bhMode.value==='img'?'':'none'};
  bhSyncImg();
  const bhPersist=()=>{
    p.backHome={mode:bhMode.value,text:bhText.value,img:bhImg.value.trim()};
    Project.save();
    bhRefresh();
  };
  bhMode.addEventListener('change',()=>{bhSyncImg();bhPersist()});
  bhText.addEventListener('change',bhPersist);
  bhImg.addEventListener('change',bhPersist);
  $('#bhCopy',bhx).onclick=()=>copyText(bhJson());
  $('#bhDownload',bhx).onclick=()=>download(`backhome-开场页-${p.name}.json`,bhJson());
  bhRefresh();
  col.appendChild(bhx);
}