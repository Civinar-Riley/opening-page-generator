/* 状态栏生成页渲染与交互（renderStatus + 预览三方法） */
import { $, $$, esc, toast, copyText, download, confirmModal, promptModal } from '../utils.js';
import { Project } from '../project.js';
import { UI } from './core.js';
import { bindListDrag, sbImportModal } from './shared.js';
import { setDeep } from '../search.js';
import { defaultConfig as sbDefault, STATUS_PRESETS, BEAUTY_PRESETS, ACTION_DIRECTIONS, parseSampleText, buildEntryContent, buildFindRegex, applyStatusRegex, buildRegexScript, buildSampleText, buildPreviewDoc, buildUsageText, loadUserPresets, saveUserPresets, loadBeautyPresets, saveBeautyPresets } from '../statusbar.js';

export function renderStatus(){
  const p=Project.cur;
  if(!p.statusbar||typeof p.statusbar!=='object')p.statusbar=sbDefault();
  if(!p.statusbar.style||typeof p.statusbar.style!=='object')p.statusbar.style={};/* 兜底：防绕过 normalize 的旧数据 s.style.panelShadow 直接赋值报错 */
  const sb=p.statusbar,col=$('#statusCol'),pvCol=$('#statusPreviewCol');
  col.innerHTML='';pvCol.innerHTML='';
  const isBlock=sb.mode==='block';
  /* 预览防抖 / 整页重渲染（事件委托块内外都可能用到，必须声明在 renderStatus 顶层） */
  const refresh=()=>{UI.debouncedSbPreview();refreshExportCard()};
  const rerender=()=>{UI.renderStatus()};
  /* 导出卡就地刷新（B8：编辑配置后 pre 展示与复制/下载保持同源）；300ms 防抖随预览节流 */
  let exTm=null;
  const refreshExportCard=()=>{clearTimeout(exTm);exTm=setTimeout(()=>UI.refreshStatusExportCard(),300)};

  /* ---- ① 基础设置卡 ---- */
  const c1=document.createElement('div');c1.className='card sbpg-card';
  const beautyPresets=loadBeautyPresets();
  c1.innerHTML=`<h3><span class="sbpg-no">壹</span>基础设置<span class="sbpg-en">Base</span><span class="hint">自定义字段 → 生成 世界书条目 + 正则美化 + 开场白后缀 三件套</span></h3>
    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--line)">
      <span style="font-size:11px;color:var(--txt2)">美化预设：</span>
      ${BEAUTY_PRESETS.map((bp,i)=>`<button type="button" class="btn ghost small" data-sbact="beauty-b.${i}" title="套用美化组合（布局+标题+行动选项）"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${bp.dot};margin-right:4px;vertical-align:-1px"></span>${esc(bp.name)}</button>`).join('')}
      ${beautyPresets.map((bp,i)=>`<button type="button" class="btn ghost small" data-sbact="beauty-u.${i}" title="我的美化预设">🧩 ${esc(bp.name)}</button><button type="button" class="btn danger small" data-sbact="beauty-del.${i}" title="删除该美化预设" style="padding:2px 6px">✕</button>`).join('')}
      <button type="button" class="btn ghost small" data-sbact="beauty-save" title="把当前布局/标题/行动选项/自定义 CSS 存为美化预设">💾 存为美化预设</button>
    </div>
    <div class="row3">
      <div><label>生成模式</label><select data-sb="mode">
        <option value="lines"${!isBlock?' selected':''}>行式（字段逐行，正则逐字段捕获）</option>
        <option value="block"${isBlock?' selected':''}>标签块（&lt;标签&gt; 包裹，动态渲染，字段增删自适应）</option>
      </select></div>
      <div><label>美化布局</label><select data-sb="layout">
        <option value="cards"${sb.layout==='cards'?' selected':''}>卡片风（渐变面板·悬浮卡片）</option>
        <option value="grid"${sb.layout==='grid'?' selected':''}>紧凑网格（简洁键值）</option>
        <option value="opening"${sb.layout==='opening'?' selected':''}>开场页风（双线边框·花饰）</option>
        <option value="terminal"${sb.layout==='terminal'?' selected':''}>终端黑绿（等宽·扫描线）</option>
        <option value="glass"${sb.layout==='glass'?' selected':''}>玻璃态（毛玻璃·大圆角）</option>
        <option value="editorial"${sb.layout==='editorial'?' selected':''}>杂志排版（衬线·多栏）</option>
      </select></div>
      <div><label>美化面板标题</label><input data-sb="title" value="${esc(sb.title||'')}"></div>
    </div>
    ${isBlock?`<div class="row2"><div><label>包裹标签名</label><input data-sb="tag" value="${esc(sb.tag||'')}"></div><div></div></div>`:''}
    <div class="row2">
      <div><label class="inline-check" style="margin:0"><input type="checkbox" data-sbchk="actions"${sb.actions?' checked':''}> 行动选项（AI 每楼生成，点击选项填入输入框，两种模式通用）</label></div>
      <div><label>选项数量</label><input type="number" min="2" max="8" data-sb="actionCount" value="${+sb.actionCount||4}"${sb.actions?'':' disabled'}></div>
    </div>
    ${sb.actions?`<div><label>行动方向（点击选用/移除，顺序=选项顺序；可组合，也可在下方手动输入自定义）</label>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin:4px 0">${ACTION_DIRECTIONS.map(d=>{
        const on=String(sb.actionStyles||'').split(',').map(x=>x.trim()).includes(d.k);
        return `<button type="button" class="btn ghost small" data-sbact="adir.${esc(d.k)}" title="${esc(d.d)}"${on?' style="border-color:var(--acc);color:var(--acc)"':''}>${esc(d.k)}</button>`;
      }).join('')}</div>
      <input data-sb="actionStyles" value="${esc(sb.actionStyles??'')}" placeholder="或手动输入自定义方向，英文逗号分割"></div>
    <div style="font-size:11px;color:var(--txt2);margin:4px 0">选项以「行动选项：」开头、短横线列表逐条输出，美化面板渲染为可点击按钮；所选方向的定义会写入世界书供 AI 理解。</div>`:''}
    <div style="margin-top:8px"><label>自定义 CSS（追加在美化样式之后，可微调布局/配色；勿包含 &lt;/style&gt;）</label><textarea data-sb="extraCss" style="min-height:70px;font-family:Consolas,monospace;font-size:12px" placeholder=".opg-sb-item{border-radius:14px}">${esc(sb.extraCss||'')}</textarea></div>`;
  col.appendChild(c1);
  c1.dataset.sbfold='c1';
  c1.insertAdjacentHTML('beforeend',"<button type='button' class='sbpg-fold' data-sbact='fold.c1' title='折叠/展开'>▾</button>");

  /* ---- 🎨 样式统筹卡（分级覆盖，留空跟随工程主题色；extraCss 仍是最后优先级） ---- */
  const sst=sb.style||{};
  const cs=document.createElement('div');cs.className='card sbpg-card';
  cs.innerHTML=`<h3><span class="sbpg-no">🎨</span>样式统筹<span class="sbpg-en">Style</span><span class="hint">留空=跟随工程主题色；自定义 CSS 仍是最后优先级</span></h3>
    <div class="row2">
      <div><label>面板文字色（覆盖标签/值/行动选项）</label><div style="display:flex;gap:6px"><input type="color" data-sbs="style.panelTextColor" value="${esc(sst.panelTextColor||'#f0f0f5')}" style="flex:1"><button type="button" class="btn ghost small" data-sbact="style-reset-panelTextColor">重置</button></div></div>
      <div><label>标签颜色</label><div style="display:flex;gap:6px"><input type="color" data-sbs="style.labelColor" value="${esc(sst.labelColor||'#7c6cf0')}" style="flex:1"><button type="button" class="btn ghost small" data-sbact="style-reset-labelColor">重置</button></div></div>
    </div>
    <div class="row2">
      <div><label>值文本颜色</label><div style="display:flex;gap:6px"><input type="color" data-sbs="style.valueColor" value="${esc(sst.valueColor||'#f0f0f5')}" style="flex:1"><button type="button" class="btn ghost small" data-sbact="style-reset-valueColor">重置</button></div></div>
      <div><label>标签字体</label><input data-sbs="style.labelFont" value="${esc(sst.labelFont||'')}" placeholder="如：楷体"></div>
    </div>
    <div class="row2">
      <div><label>值字体</label><input data-sbs="style.valueFont" value="${esc(sst.valueFont||'')}" placeholder="如：霞鹜文楷"></div>
      <div></div>
    </div>
    <div class="row3">
      <div><label>面板背景</label><select data-sbs="style.panelBg">
        <option value="follow"${sst.panelBg==='follow'?' selected':''}>跟随布局（渐变光晕）</option>
        <option value="transparent"${sst.panelBg==='transparent'?' selected':''}>透明</option>
        <option value="solid"${sst.panelBg==='solid'?' selected':''}>纯色</option>
        <option value="gradient"${sst.panelBg==='gradient'?' selected':''}>渐变</option>
        <option value="image"${sst.panelBg==='image'?' selected':''}>图片 URL</option>
      </select></div>
      <div><label>背景色 1 / 纯色</label><input type="color" data-sbs="style.panelBgColor" value="${esc(sst.panelBgColor||'#12141d')}"></div>
      <div><label>背景色 2（渐变用）</label><input type="color" data-sbs="style.panelBgColor2" value="${esc(sst.panelBgColor2||'#1b1e2e')}"></div>
    </div>
    <div class="row2">
      <div><label>背景图 URL（图片模式，自动叠深色遮罩保证可读）</label><input data-sbs="style.panelBgImage" value="${esc(sst.panelBgImage||'')}" placeholder="https://..."></div>
      <div style="display:flex;align-items:end;padding-bottom:4px"><label class="inline-check"><input type="checkbox" data-sbchk="panelShadow"${sst.panelShadow!==false?' checked':''}> 面板阴影</label></div>
    </div>
    <div class="row2" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)">
      <div><label>行动选项文字色</label><div style="display:flex;gap:6px"><input type="color" data-sbs="style.actionOptColor" value="${esc(sst.actionOptColor||'#f0f0f5')}" style="flex:1"><button type="button" class="btn ghost small" data-sbact="style-reset-actionOptColor">重置</button></div></div>
      <div><label>行动选项背景色</label><div style="display:flex;gap:6px"><input type="color" data-sbs="style.actionOptBg" value="${esc(sst.actionOptBg||'#0f0f19')}" style="flex:1"><button type="button" class="btn ghost small" data-sbact="style-reset-actionOptBg">重置</button></div></div>
    </div>
    <div class="row2">
      <div><label>行动选项边框色</label><div style="display:flex;gap:6px"><input type="color" data-sbs="style.actionOptBorder" value="${esc(sst.actionOptBorder||'#7c6cf0')}" style="flex:1"><button type="button" class="btn ghost small" data-sbact="style-reset-actionOptBorder">重置</button></div></div>
      <div></div>
    </div>`;
  col.appendChild(cs);
  cs.dataset.sbfold='cs';
  cs.insertAdjacentHTML('beforeend',"<button type='button' class='sbpg-fold' data-sbact='fold.cs' title='折叠/展开'>▾</button>");

  /* ---- ①½ 布局微调卡 ---- */
  const lc=sb.layoutConfig||{};
  const lcCard=document.createElement('div');lcCard.className='card sbpg-card';
  lcCard.innerHTML=`<h3><span class="sbpg-no">📐</span>布局微调<span class="sbpg-en">Layout</span><span class="hint">自由组合列数、间距、边框、圆角等视觉参数</span></h3>
    <div class="row2">
      <div><label>字段列数</label><select data-sblc="columns">
        <option value="1"${lc.columns===1?' selected':''}>单列</option>
        <option value="2"${(!lc.columns||lc.columns===2)?' selected':''}>双列（默认）</option>
        <option value="3"${lc.columns===3?' selected':''}>三列</option>
      </select></div>
      <div><label>间距</label><select data-sblc="gap">
        <option value="4"${lc.gap===4?' selected':''}>紧凑(4px)</option>
        <option value="8"${(!lc.gap||lc.gap===8)?' selected':''}>标准(8px)</option>
        <option value="12"${lc.gap===12?' selected':''}>宽松(12px)</option>
        <option value="16"${lc.gap===16?' selected':''}>超宽(16px)</option>
      </select></div>
    </div>
    <div class="row2">
      <div><label>边框样式</label><select data-sblc="borderStyle">
        <option value="none"${lc.borderStyle==='none'?' selected':''}>无</option>
        <option value="solid"${(!lc.borderStyle||lc.borderStyle==='solid')?' selected':''}>实线</option>
        <option value="double"${lc.borderStyle==='double'?' selected':''}>双线</option>
        <option value="dashed"${lc.borderStyle==='dashed'?' selected':''}>虚线</option>
      </select></div>
      <div><label>边框宽度</label><input type="number" min="1" max="3" data-sblc="borderWidth" value="${+lc.borderWidth||1}"></div>
    </div>
    <div class="row2">
      <div><label>圆角</label><input type="number" min="0" max="24" data-sblc="borderRadius" value="${+lc.borderRadius||12}"></div>
      <div><label>标题栏样式</label><select data-sblc="headerStyle">
        <option value="standard"${(!lc.headerStyle||lc.headerStyle==='standard')?' selected':''}>标准</option>
        <option value="centered"${lc.headerStyle==='centered'?' selected':''}>居中</option>
        <option value="minimal"${lc.headerStyle==='minimal'?' selected':''}>极简</option>
        <option value="underline"${lc.headerStyle==='underline'?' selected':''}>下划线</option>
      </select></div>
    </div>
    <div class="row2">
      <div><label>行动选项位置</label><select data-sblc="actionPosition">
        <option value="bottom"${(!lc.actionPosition||lc.actionPosition==='bottom')?' selected':''}>底部</option>
        <option value="inline"${lc.actionPosition==='inline'?' selected':''}>内嵌</option>
      </select></div>
      <div></div>
    </div>`;
  col.appendChild(lcCard);
  lcCard.dataset.sbfold='lc';
  lcCard.insertAdjacentHTML('beforeend',"<button type='button' class='sbpg-fold' data-sbact='fold.lc' title='折叠/展开'>▾</button>");

  /* ---- ② 字段卡 ---- */
  const c2=document.createElement('div');c2.className='card sbpg-card';
  const userPresets=loadUserPresets();
  const presetOpts=STATUS_PRESETS.map((ps,i)=>`<option value="b:${i}">⭐ ${esc(ps.name)}</option>`).join('')
    +userPresets.map((ps,i)=>`<option value="u:${i}">🧩 ${esc(ps.name)}</option>`).join('');
  c2.innerHTML=`<h3><span class="sbpg-no">贰</span>状态栏字段<span class="sbpg-en">Fields</span><span class="hint">顺序即输出与捕获顺序，⠿ 可拖拽排序；「渲染样式」：心声=值用引号包裹并斜体渲染，进度条=值填 N/M 或 N% 自动渲染动画进度条</span></h3>
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center">
      <select id="sbPresetSel" style="flex:1;min-width:180px"><option value="">📋 套用字段预设…</option>${presetOpts}</select>
      <button type="button" class="btn ghost small" data-sbact="preset-save">💾 存为预设</button>
      <button type="button" class="btn ghost small" data-sbact="preset-del" ${userPresets.length?'':'disabled'}>🗑 删除我的预设</button>
      <button type="button" class="btn ghost small" data-sbact="import">📥 从示例文本导入</button>
    </div>
    <input type="text" id="sbFieldSearch" placeholder="🔍 搜索字段名…" style="width:100%;padding:6px 10px;font-size:12px;background:var(--panel2);border:1px solid var(--line);border-radius:6px;box-sizing:border-box;margin-bottom:6px">
    <div class="sbf-head"><span></span><span>字段名</span><span>示例值</span><span>填写规则（面板内悬浮显示）</span><span>渲染样式</span><span style="text-align:right">操作</span></div>
    <div id="sbFieldList"></div>
    <button type="button" class="btn ghost small" data-sbact="field-add" style="margin-top:4px">＋ 添加字段</button>`;
  col.appendChild(c2);
  c2.dataset.sbfold='f';
  c2.insertAdjacentHTML('beforeend',"<button type='button' class='sbpg-fold' data-sbact='fold.f' title='折叠/展开'>▾</button>");
  const fieldList=$('#sbFieldList',c2);
  const sbFieldSearch=$('#sbFieldSearch',c2);
  const RENDER_TIP='渲染样式：普通=键值行；心声=要求 AI 用引号包裹值，斜体渲染（适合心理活动）；进度条=值填 N/M 或 N%，渲染为动画进度条';
  const buildFields=()=>{
    fieldList.innerHTML='';
    const kw=(sbFieldSearch.value||'').trim().toLowerCase();
    sb.fields.forEach((f,i)=>{
      const d=document.createElement('div');d.className='sbf-row';
      d.style.cssText='display:grid;grid-template-columns:14px 100px 1fr 1fr 66px 118px;gap:6px;margin:4px 0;align-items:center';
      if(kw&&!f.name.toLowerCase().includes(kw))d.style.display='none';
      d.innerHTML=`<span class="drag-handle" title="拖动排序（触屏长按）" style="cursor:grab;color:var(--txt3);text-align:center;user-select:none">⠿</span>
        <input data-sbf="${i}.name" value="${esc(f.name)}" placeholder="字段名">
        <input data-sbf="${i}.sample" value="${esc(f.sample??'')}" placeholder="示例值">
        <input data-sbf="${i}.hint" value="${esc(f.hint??'')}" placeholder="填写规则（进世界书，面板内悬浮显示）">
        <select data-sbr="${i}" title="${RENDER_TIP}">
          <option value="normal"${(f.render||'normal')==='normal'?' selected':''}>普通</option>
          <option value="quote"${f.render==='quote'?' selected':''}>心声</option>
          <option value="progress"${f.render==='progress'?' selected':''}>进度条</option>
        </select>
        <span class="ord" style="justify-content:flex-end">
          <button type="button" data-sbact="field-copy.${i}" title="复制此字段">⧉</button>
          <button type="button" data-sbact="field-up.${i}" title="上移" ${i===0?'disabled':''}>↑</button>
          <button type="button" data-sbact="field-down.${i}" title="下移" ${i===sb.fields.length-1?' disabled':''}>↓</button>
          <button type="button" data-sbact="field-del.${i}" title="删除">✕</button>
        </span>`;
      fieldList.appendChild(d);
    });
  };
  buildFields();
  bindListDrag(fieldList,{itemSel:'.sbf-row',handleSel:'.drag-handle',onSwap:(a,b)=>{
    const arr=sb.fields;const[m]=arr.splice(a,1);arr.splice(b,0,m);
    buildFields();refresh();Project.save();Project.saveSnapshot();
  }});
  sbFieldSearch.addEventListener('input',()=>buildFields());
  /* 套用字段预设：内置（b:索引）/ 我的（u:索引） */
  $('#sbPresetSel',c2).addEventListener('change',function(){
    const v=this.value;
    this.value='';/* 无论成功与否都复位，避免「显示已选但未生效」的错觉 */
    if(!v)return;
    const[t,i]=v.split(':');
    const src=t==='b'?STATUS_PRESETS[+i]:loadUserPresets()[+i];
    if(!src||!Array.isArray(src.fields)){toast('预设不存在');return}
    sb.fields=src.fields.map(f=>({...JSON.parse(JSON.stringify(f)),render:f.render||(f.quote?'quote':'normal')}));
    rerender();Project.save();Project.saveSnapshot();
    toast('已套用字段预设：'+src.name);
  });

  /* ---- ③ 全局规则卡 ---- */
  const c3=document.createElement('div');c3.className='card sbpg-card';
  c3.innerHTML=`<h3><span class="sbpg-no">叁</span>全局规则<span class="sbpg-en">Rules</span><span class="hint">写入世界书条目，每行一条；至少保留「严格格式」与「值中不得含 &lt;&gt;」两条</span></h3>
    <textarea data-sb="rules" style="min-height:90px" placeholder="每行一条规则">${esc((sb.rules||[]).join('\n'))}</textarea>`;
  col.appendChild(c3);
  c3.dataset.sbfold='r';
  c3.insertAdjacentHTML('beforeend',"<button type='button' class='sbpg-fold' data-sbact='fold.r' title='折叠/展开'>▾</button>");

  /* ---- ④ 世界书设置卡 ---- */
  const c4=document.createElement('div');c4.className='card sbpg-card';
  c4.innerHTML=`<h3><span class="sbpg-no">肆</span>世界书设置<span class="sbpg-en">World Book</span><span class="hint">蓝灯常驻 + @D 深度插入（AI 每楼都能看到格式指令）</span></h3>
    <div class="row3">
      <div><label>条目名 (comment)</label><input data-sb="entryComment" value="${esc(sb.entryComment||'')}"></div>
      <div><label>插入深度 (0-4)</label><input type="number" min="0" max="4" data-sb="depth" value="${+sb.depth||0}"></div>
      <div><label>插入角色 (role)</label><select data-sb="role">
        <option value="0"${+sb.role===0?' selected':''}>系统 (system，推荐)</option>
        <option value="1"${+sb.role===1?' selected':''}>用户 (user)</option>
        <option value="2"${+sb.role===2?' selected':''}>AI (assistant)</option>
      </select></div>
    </div>
    <div class="row3">
      <div><label>插入顺序 (order)</label><input type="number" data-sb="order" value="${+sb.order||999}"></div>
      <div></div>
      <div></div>
    </div>`;
  col.appendChild(c4);
  c4.dataset.sbfold='w';
  c4.insertAdjacentHTML('beforeend',"<button type='button' class='sbpg-fold' data-sbact='fold.w' title='折叠/展开'>▾</button>");

  /* ---- ⑤ 预览卡（复用开场页预览框架：工具条 + 居中舞台 + 内容自适应高度） ---- */
  const pv=document.createElement('div');pv.className='card sbpg-card';
  pv.innerHTML=`<h3><span class="sbpg-no">伍</span>预览<span class="sbpg-en">Preview</span><span class="hint">示例正文 + 字段示例值渲染；面板内 ⚙ 可调字号/布局，↻ 重掷</span></h3>
    <div class="preview-wrap" style="min-height:420px">
      <div class="preview-toolbar">
        <div class="seg" id="sbDevSeg">
          <button type="button" data-v="mobile"${this._sbPreviewMode==='mobile'?' class="active"':''}>📱 手机</button>
          <button type="button" data-v="pc"${this._sbPreviewMode==='pc'?' class="active"':''}>🖥 PC</button>
        </div>
        <div class="seg" id="sbBgSeg">
          <button type="button" data-bg="dark"${(this._sbPreviewBg||'dark')==='dark'?' class="active"':''}>🌙 暗底</button>
          <button type="button" data-bg="light"${this._sbPreviewBg==='light'?' class="active"':''}>☀️ 亮底</button>
        </div>
        <span style="flex:1"></span>
        <button type="button" class="btn ghost small" id="sbBtnRefresh">↻ 刷新</button>
      </div>
      <div class="preview-stage" id="sbStage" style="padding:6px"><iframe id="sbPreviewFrame" sandbox="allow-scripts allow-same-origin" style="border:none;min-height:300px;background:transparent"></iframe></div>
    </div>`;
  pvCol.appendChild(pv);
  pv.dataset.sbfold='p';
  pv.insertAdjacentHTML('beforeend',"<button type='button' class='sbpg-fold' data-sbact='fold.p' title='折叠/展开'>▾</button>");
  $('#sbDevSeg',pv).addEventListener('click',e=>{
    const v=e.target.dataset.v;if(!v)return;
    this._sbPreviewMode=v;
    $$('#sbDevSeg button',pv).forEach(b=>b.classList.toggle('active',b.dataset.v===v));
    const f=$('#sbPreviewFrame',pv);
    f.style.width=v==='mobile'?'430px':'100%';
    this.fitPreviewHeight(f,true);
  });
  $('#sbBgSeg',pv).addEventListener('click',e=>{
    const bg=e.target.dataset.bg;if(!bg)return;
    this._sbPreviewBg=bg;
    $$('#sbBgSeg button',pv).forEach(b=>b.classList.toggle('active',b.dataset.bg===bg));
    this.applySbStageBg();
  });
  $('#sbBtnRefresh',pv).addEventListener('click',()=>{this._lastSbPreviewKey='';this.refreshStatusPreview(true)});
  $('#sbPreviewFrame',pv).addEventListener('load',()=>this.fitPreviewHeight($('#sbPreviewFrame',pv),true));

  /* ---- ⑥ 导出卡 ---- */
  const ex=document.createElement('div');ex.className='card sbpg-card';
  const rxJson=()=>buildRegexScript(sb,p.theme,{placement:this._sbPlacement||[2],runOnEdit:this._sbRunOnEdit!==false,projectName:p.name});
  /* 控件初始状态跟随内存值：整页重渲染后显示与下载 JSON 保持一致 */
  const sbPl=JSON.stringify(this._sbPlacement||[2]);
  const rxPreview=rxJson().replaceString;
  const roleText=['系统','用户','AI'][+(sb.role||0)]||'系统';
  ex.innerHTML=`<h3><span class="sbpg-no">陆</span>生成三件套<span class="sbpg-en">Export</span><span class="hint">修改任何配置后这里实时更新，重新复制/下载导入即可</span></h3>
    <div style="border:1px dashed var(--line);border-radius:8px;padding:10px;margin-bottom:10px">
      <strong style="font-size:13px">① 世界书条目（推荐手动创建）</strong>
      <div style="font-size:12px;color:var(--txt2);margin:4px 0">角色卡 → 世界书 → 打开绑定的世界书（没有就新建一个并在角色卡绑定）→ 新建条目：勾选「常驻(蓝灯)」、插入位置 @D 深度 <b class="sbex-dep">${+sb.depth||0}</b>、角色 <b class="sbex-role">${roleText}</b>、顺序 <b class="sbex-ord">${+sb.order||999}</b>、勾选防递归 → 把下方条目文案整段粘贴进条目内容。</div>
      <div style="display:flex;gap:6px;margin:6px 0"><button type="button" class="btn small" data-sbact="copy-entry">📋 复制条目文案</button></div>
      <pre class="sbex-entry" style="max-height:200px;overflow:auto">${esc(buildEntryContent(sb))}</pre>
    </div>
    <div style="border:1px dashed var(--line);border-radius:8px;padding:10px;margin-bottom:10px">
      <strong style="font-size:13px">② 正则美化脚本</strong>
      <div class="row2" style="margin:6px 0">
        <div><label>生效位置（placement）</label><select id="sbPlacement">
          <option value="2"${sbPl==='[2]'?' selected':''}>AI 输出（默认）</option>
          <option value="1"${sbPl==='[1]'?' selected':''}>用户输入</option>
          <option value="1,2"${sbPl==='[1,2]'?' selected':''}>用户输入 + AI 输出</option>
        </select></div>
        <div style="display:flex;align-items:end;padding-bottom:4px"><label class="inline-check"><input type="checkbox" id="sbRunOnEdit"${this._sbRunOnEdit!==false?' checked':''}>编辑消息时也重新渲染（runOnEdit）</label></div>
      </div>
      <div style="font-size:12px;color:var(--txt2);margin:4px 0">酒馆 → 扩展 → 正则(Regex) → 导入 JSON。仅影响显示（markdownOnly），AI 上下文保留原文。</div>
      <div style="display:flex;gap:6px;margin:6px 0"><button type="button" class="btn small" data-sbact="copy-regex">📋 复制正则 JSON</button><button type="button" class="btn ghost small" data-sbact="dl-regex">💾 下载正则 .json</button></div>
      <pre class="sbex-regex" style="max-height:200px;overflow:auto">findRegex: ${esc('/'+buildFindRegex(sb)+'/')}\n\n${esc(rxPreview.slice(0,600))}${rxPreview.length>600?'…（完整内容以下载/复制为准）':''}</pre>
    </div>
    <div style="border:1px dashed var(--line);border-radius:8px;padding:10px;margin-bottom:10px">
      <strong style="font-size:13px">②⁺ 正则测试沙盒</strong>
      <div style="font-size:12px;color:var(--txt2);margin:4px 0">粘贴真实 AI 输出文本，实时验证正则是否命中各字段（与导出的 findRegex 同源，命中结果按 $n 注入美化文档）。文本仅本次会话内存有效，不落库。</div>
      <textarea data-sbsbx="1" rows="5" placeholder="把 AI 实际输出的状态栏文本粘到这里，例如：&#10;角色名称：林晚晴&#10;当前时间：周五傍晚&#10;地点：天台咖啡馆…" style="width:100%;box-sizing:border-box;font-family:inherit">${esc(UI._sbSandboxText||'')}</textarea>
      <pre id="sbSbxOut" style="max-height:200px;overflow:auto"></pre>
    </div>
    <div style="border:1px dashed var(--line);border-radius:8px;padding:10px;margin-bottom:10px">
      <strong style="font-size:13px">③ 开场白后缀（纯文字状态栏）</strong>
      <div style="font-size:12px;color:var(--txt2);margin:4px 0">粘贴到 first_mes / alternate_greetings 正文末尾——第一楼即显示美化状态栏。</div>
      <div style="display:flex;gap:10px;margin:6px 0;align-items:center">
        <button type="button" class="btn small" data-sbact="copy-suffix">📋 复制纯文字状态栏</button>
        <label class="inline-check"><input type="checkbox" data-sbchk="commentHeader">附加 HTML 注释说明头</label>
      </div>
      <pre class="sbex-sample" style="max-height:160px;overflow:auto">${esc(buildSampleText(sb))}</pre>
    </div>
    <div style="border:1px dashed var(--line);border-radius:8px;padding:10px">
      <strong style="font-size:13px">④ 使用说明</strong>
      <div style="display:flex;gap:6px;margin:6px 0"><button type="button" class="btn ghost small" data-sbact="copy-usage">📋 复制完整使用说明</button><span style="align-self:center;font-size:12px;color:var(--txt2)">发卡时附上，玩家照做即可</span></div>
    </div>`;
  col.appendChild(ex);
  ex.dataset.sbfold='e';
  ex.insertAdjacentHTML('beforeend',"<button type='button' class='sbpg-fold' data-sbact='fold.e' title='折叠/展开'>▾</button>");

  /* 正则测试沙盒：只更新结果区不重渲染整页（文本仅会话内存，不落库不进快照） */
  const updateSbx=()=>{
    const out=$('#sbSbxOut');if(!out)return;
    const text=UI._sbSandboxText||'';
    if(!text.trim()){out.innerHTML='<span style="color:var(--txt2)">（未输入文本）</span>';return}
    /* 现读 Project.cur：col 监听器只挂一次，闭包捕获的 sb/p 在切换工程后指向旧工程（沙盒会用错字段测正则） */
    const cur=Project.cur,csb=cur.statusbar;
    if(!csb||typeof csb!=='object')return;
    const r=applyStatusRegex(text,csb,{theme:cur.theme});
    if(r.error){out.innerHTML='<span style="color:var(--danger,#e07070)">✗ '+esc(r.error)+'</span>';return}
    if(!r.hit){out.innerHTML='<span style="color:var(--txt2)">✗ 未命中——粘贴文本与 findRegex 不匹配（检查字段名/引号/标签块格式是否与条目文案一致）</span>';return}
    const gs=r.groups.map(g=>'#'+g.n+' '+g.name+'：'+String(g.value).slice(0,200)).join('\n');
    out.textContent=gs+'\n\n—— 替换结果（完整美化文档，$n 已注入实际捕获值）——\n'+r.replaced.slice(0,600)+(r.replaced.length>600?'…（完整内容以预览/下载为准）':'');
  };
  updateSbx();

  /* 卡片折叠状态恢复（记忆于 localStorage） */
  const foldMap={c1,cs,f:c2,r:c3,w:c4,p:pv,e:ex};
  let foldState={};
  try{foldState=JSON.parse(localStorage.getItem('openingPageGen_v1_sbFold')||'{}')}catch(e){}
  Object.keys(foldState).forEach(k=>{
    if(!foldState[k])return;
    const el=foldMap[k];if(!el)return;
    el.classList.add('sbpg-folded');
    const b=el.querySelector('.sbpg-fold');if(b)b.textContent='▸';
  });
  $('#sbPlacement',ex).addEventListener('change',function(){
    UI._sbPlacement=this.value.split(',').map(x=>+x);
    UI.renderStatus();
  });
  $('#sbRunOnEdit',ex).addEventListener('change',function(){
    UI._sbRunOnEdit=this.checked;
  });

  /* 事件委托（col 跨渲染复用，只挂一次；refresh/rerender 已提升到函数顶部）
     委托根为 #pageStatus：预览/导出卡现居右列 statusPreviewCol，事件需跨两列冒泡 */
  const bindRoot=$('#pageStatus');
  if(!bindRoot.dataset.sbBound){
    bindRoot.dataset.sbBound='1';
    bindRoot.addEventListener('input',e=>{
      const p=Project.cur,s=p.statusbar;
      /* 正则测试沙盒：仅内存草稿，不落库不进快照 */
      if(e.target.dataset.sbsbx!==undefined){UI._sbSandboxText=e.target.value;updateSbx();return}
      /* 布局微调：layoutConfig 子字段（数值字段直转 number，合法的 0 不再被 || 吞成字符串） */
      const sblc=e.target.dataset.sblc;
      if(sblc!==undefined){
        if(!s.layoutConfig||typeof s.layoutConfig!=='object')s.layoutConfig={};
        const v=e.target.value;
        s.layoutConfig[sblc]=v==='true'?true:v==='false'?false:(v!==''&&Number.isFinite(+v)?+v:v);
        refresh();Project.saveDebounced();return;
      }
      const sb=e.target.dataset.sb;
      if(sb!==undefined){
        /* mode 由 change 处理器全权处理（input 处理器对 mode 提前返回，不会污染快照）；快照统一在改值后打 */
        if(sb==='mode')return;
        if(sb==='rules')s.rules=e.target.value.split('\n');
        else if(sb==='depth'||sb==='order'||sb==='actionCount')s[sb]=+e.target.value||0;
        else if(sb==='role')s.role=+e.target.value||0;
        else s[sb]=e.target.value;
        /* 手动编辑行动方向时，同步方向 chips 高亮 */
        if(sb==='actionStyles'){
          const cur=String(e.target.value).split(',').map(x=>x.trim());
          col.querySelectorAll('[data-sbact^="adir."]').forEach(b=>{
            const on=cur.includes(b.dataset.sbact.slice(5));
            b.style.borderColor=on?'var(--acc)':'';
            b.style.color=on?'var(--acc)':'';
          });
        }
        refresh();Project.saveDebounced();
        return;
      }
      /* 样式统筹：style.xxx 两层路径 */
      const sbs=e.target.dataset.sbs;
      if(sbs!==undefined){
        setDeep(p.statusbar,sbs,e.target.value);
        refresh();Project.saveDebounced();
        return;
      }
      const f=e.target.dataset.sbf;
      if(f!==undefined){
        const[i,k]=f.split('.');
        const p=Project.cur;
        const fld=p.statusbar.fields[+i];
        if(fld){
          fld[k]=e.target.value;
          /* 重名字段会让行式正则捕获错位，及时提醒 */
          if(k==='name'&&p.statusbar.fields.some((x,xi)=>xi!==+i&&x.name.trim()===fld.name.trim()&&fld.name.trim()))
            toast('⚠️ 存在重名字段「'+fld.name.trim()+'」，行式正则可能匹配异常，建议改名');
          refresh();Project.saveDebounced();
        }
      }
    });
    bindRoot.addEventListener('change',e=>{
      const p=Project.cur,s=p.statusbar;
      /* 布局微调：layoutConfig 子字段（数值字段直转 number，合法的 0 不再被 || 吞成字符串） */
      const sblc=e.target.dataset.sblc;
      if(sblc!==undefined){
        if(!s.layoutConfig||typeof s.layoutConfig!=='object')s.layoutConfig={};
        const v=e.target.value;
        s.layoutConfig[sblc]=v==='true'?true:v==='false'?false:(v!==''&&Number.isFinite(+v)?+v:v);
        refresh();Project.saveDebounced();return;
      }
      /* 模式下拉切换需整页重渲染（显示/隐藏标签块专属配置） */
      if(e.target.dataset.sb==='mode'){s.mode=e.target.value;rerender();Project.save();Project.saveSnapshot();return}
      /* 渲染样式下拉（普通/心声/进度条） */
      const sr=e.target.dataset.sbr;
      if(sr!==undefined){
        const f=s.fields[+sr];
        if(f){f.render=e.target.value;f.quote=f.render==='quote';refresh();Project.saveDebounced();Project.saveSnapshot()}
        return;
      }
      /* 样式统筹 select 的 change 兜底（部分浏览器 select 不触发 input） */
      const sbs2=e.target.dataset.sbs;
      if(sbs2!==undefined){
        setDeep(s,sbs2,e.target.value);
        refresh();Project.saveDebounced();return;
      }
      /* data-sb 的 change 兜底（同 data-sbs 道理：select 可能不发 input；mode 已在上方单独处理） */
      const sb2=e.target.dataset.sb;
      if(sb2!==undefined){
        if(sb2==='rules')s.rules=e.target.value.split('\n');
        else if(sb2==='depth'||sb2==='order'||sb2==='actionCount')s[sb2]=+e.target.value||0;
        else if(sb2==='role')s.role=+e.target.value||0;
        else s[sb2]=e.target.value;
        refresh();Project.saveDebounced();return;
      }
      const c=e.target.dataset.sbchk;
      if(c===undefined)return;
      if(c==='actions'){s.actions=e.target.checked;rerender();Project.save();Project.saveSnapshot()}
      else if(c==='panelShadow'){s.style.panelShadow=e.target.checked;refresh();Project.saveDebounced()}
      else if(c==='commentHeader'){/* 只影响复制，不落库 */}
      else if(c.startsWith('quote.')){
        const i=+c.split('.')[1];
        if(s.fields[i]){s.fields[i].quote=e.target.checked;s.fields[i].render=s.fields[i].quote?'quote':'normal';refresh();Project.saveDebounced()}
      }
    });
    bindRoot.addEventListener('click',async e=>{
      const act=e.target.closest('[data-sbact]')?.dataset.sbact;
      if(act===undefined)return;
      const p=Project.cur,s=p.statusbar;
      const [key,arg]=act.split('.');
      /* 卡片折叠切换（纯 UI 状态，不进快照） */
      if(key==='fold'){
        /* 实时按标记查询：闭包捕获的元素引用在重渲染后会失效 */
        const el=col.querySelector('[data-sbfold="'+arg+'"]');if(!el)return;
        const folded=el.classList.toggle('sbpg-folded');
        e.target.textContent=folded?'▸':'▾';
        let st={};try{st=JSON.parse(localStorage.getItem('openingPageGen_v1_sbFold')||'{}')}catch(_){}
        st[arg]=folded;
        try{localStorage.setItem('openingPageGen_v1_sbFold',JSON.stringify(st))}catch(_){}
        return;
      }
      /* 行动方向 chips：点击选用/移除（追加到末尾，顺序=组合顺序），与输入框双向同步 */
      if(key==='adir'){
        const cur=String(s.actionStyles||'').split(',').map(x=>x.trim()).filter(Boolean);
        const i=cur.indexOf(arg);
        if(i>=0)cur.splice(i,1);else cur.push(arg);
        s.actionStyles=cur.join(',');
        const inp=col.querySelector('[data-sb="actionStyles"]');
        if(inp)inp.value=s.actionStyles;
        e.target.style.borderColor=cur.includes(arg)?'var(--acc)':'';
        e.target.style.color=cur.includes(arg)?'var(--acc)':'';
        refresh();Project.saveDebounced();return;
      }
      /* 样式统筹：恢复「跟随主题」 */
      if(key==='style-reset-panelTextColor'){s.style.panelTextColor='';rerender();Project.save();return}
      if(key==='style-reset-labelColor'){s.style.labelColor='';rerender();Project.save();return}
      if(key==='style-reset-valueColor'){s.style.valueColor='';rerender();Project.save();return}
      if(key==='style-reset-actionOptColor'){s.style.actionOptColor='';rerender();Project.save();return}
      if(key==='style-reset-actionOptBg'){s.style.actionOptBg='';rerender();Project.save();return}
      if(key==='style-reset-actionOptBorder'){s.style.actionOptBorder='';rerender();Project.save();return}
      /* 美化预设：内置 b:索引 / 我的 u:索引 / 保存 / 删除 */
      if(key==='beauty-b'||key==='beauty-u'){
        const src=key==='beauty-b'?BEAUTY_PRESETS[+arg]:loadBeautyPresets()[+arg];
        if(!src||!src.patch){toast('美化预设不存在');return}
        Object.keys(src.patch).forEach(k=>{s[k]=src.patch[k]});
        rerender();Project.save();Project.saveSnapshot();
        toast('已套用美化预设：'+src.name);
        return;
      }
      if(key==='beauty-save'){
        const name=await promptModal('美化预设名称：',s.layout==='cards'?'夜宴酒牌':(s.layout==='opening'?'手稿扉页':'我的美化'));
        if(name===null||!name.trim())return;
        const list=loadBeautyPresets();
        list.unshift({name:name.trim(),dot:({cards:'#b8956a',grid:'#00e5ff',opening:'#d9a856'})[s.layout]||'#8b7cf0',
          /* patch 含布局与样式全部维度（与内置 BEAUTY_PRESETS 口径一致）：否则套用时残留上个预设的 layoutConfig/style */
          patch:JSON.parse(JSON.stringify({layout:s.layout,title:s.title,actions:s.actions,actionCount:s.actionCount,actionStyles:s.actionStyles,extraCss:s.extraCss,layoutConfig:s.layoutConfig,style:s.style}))});
        saveBeautyPresets(list);
        rerender();toast('已存为美化预设：'+name.trim());
        return;
      }
      if(key==='beauty-del'){
        const list=loadBeautyPresets();
        if(!list[+arg]){toast('预设不存在');return}
        if(!await confirmModal(`确定删除美化预设「${list[+arg].name}」？`))return;
        list.splice(+arg,1);saveBeautyPresets(list);rerender();toast('已删除');
        return;
      }
      if(key==='field-add'){
        /* 自动避让重名 */
        let nm='新字段',k=1;
        while(s.fields.some(f=>f.name===nm))nm='新字段'+(++k);
        s.fields.push({name:nm,sample:'',hint:'',quote:false,render:'normal'});
        rerender();Project.save();Project.saveSnapshot();return;
      }
      if(key==='field-copy'){
        const clone=JSON.parse(JSON.stringify(s.fields[+arg]||{}));
        clone.name=(clone.name||'字段')+' 副本';
        s.fields.splice(+arg+1,0,clone);
        rerender();Project.save();Project.saveSnapshot();return;
      }
      if(key==='field-del'){
        s.fields.splice(+arg,1);
        rerender();Project.save();Project.saveSnapshot();return;
      }
      if(key==='field-up'&&+arg>0){[s.fields[+arg-1],s.fields[+arg]]=[s.fields[+arg],s.fields[+arg-1]];rerender();Project.save();Project.saveSnapshot();return}
      if(key==='field-down'&&+arg<s.fields.length-1){[s.fields[+arg],s.fields[+arg+1]]=[s.fields[+arg+1],s.fields[+arg]];rerender();Project.save();Project.saveSnapshot();return}
      if(key==='preset-save'){
        const name=await promptModal('预设名称：',s.title||'我的状态栏字段');
        if(name===null||!name.trim())return;
        const list=loadUserPresets();
        list.unshift({name:name.trim(),fields:JSON.parse(JSON.stringify(s.fields))});
        saveUserPresets(list);
        rerender();toast('已存为字段预设：'+name.trim());
        return;
      }
      if(key==='preset-del'){
        const list=loadUserPresets();
        if(!list.length){toast('还没有「我的预设」');return}
        /* 下拉选中项在 change 后立即复位（避免「显示已选但未生效」），故这里恒删最新保存的一个 */
        const idx=0;
        const name=list[idx]?.name||'';
        if(!await confirmModal(`确定删除预设「${name}」？`))return;
        list.splice(idx,1);saveUserPresets(list);rerender();toast('已删除：'+name);
        return;
      }
      if(key==='import'){
        const text=await sbImportModal();
        if(text===null)return;
        const parsed=parseSampleText(text);
        if(!parsed.fields.length){toast('未能从文本中解析出字段（需「字段：值」格式）');return}
        s.fields=parsed.fields;
        if(parsed.mode==='block'){s.mode='block';s.tag=parsed.tag}
        rerender();Project.save();Project.saveSnapshot();
        toast(`已导入 ${parsed.fields.length} 个字段${parsed.mode==='block'?'（标签块模式：<'+parsed.tag+'>）':''}`);
        return;
      }
      if(key==='copy-entry'){copyText(buildEntryContent(s));return}
      if(key==='copy-regex'){copyText(JSON.stringify(rxJson(),null,2));return}
      if(key==='dl-regex'){download(`regex-状态栏.json`,JSON.stringify(rxJson(),null,2));toast('正则脚本已下载');return}
      if(key==='copy-suffix'){
        const withComment=col.querySelector('[data-sbchk="commentHeader"]')?.checked;
        copyText(buildSampleText(s,{commentHeader:!!withComment}));return;
      }
      if(key==='copy-usage'){copyText(buildUsageText(s));toast('使用说明已复制');return}
    });
  }

  this.applySbStageBg();
  this.refreshStatusPreview(true);
}

/* 预览舞台底色（暗/亮）：面板配色跟工程主题色，这里只看不同底色下的观感 */
export function applySbStageBg(){
  const stage=$('#sbStage');
  if(stage)stage.style.background=(this._sbPreviewBg==='light')?'#e8e8ee':'#0a0b0f';
}
export function refreshStatusPreview(force){
  const p=Project.cur;
  if(!p||!p.statusbar)return;
  const frame=$('#sbPreviewFrame');if(!frame)return;
  frame.style.width=this._sbPreviewMode==='mobile'?'430px':'100%';
  let doc;
  try{doc=buildPreviewDoc(p.statusbar,p.theme)}
  catch(e){
    frame.srcdoc=`<!DOCTYPE html><html><body style="background:#14161c;color:#e06c5c;font:13px/1.7 sans-serif;padding:16px;white-space:pre-wrap">⚠️ 状态栏预览生成失败：${esc(e.message)}</body></html>`;
    return;
  }
  const key=doc+'\u0000'+this._sbPreviewMode;
  if(!force&&key===this._lastSbPreviewKey)return;
  this._lastSbPreviewKey=key;
  frame.srcdoc=doc;
}
export function debouncedSbPreview(){clearTimeout(this.sbPreviewDebounce);this.sbPreviewDebounce=setTimeout(()=>this.refreshStatusPreview(),300)}

/* 导出卡就地刷新：重建三段 pre 与深度/角色/顺序提示（与复制/下载同一数据源，展示永不陈旧） */
export function refreshStatusExportCard(){
  const p=Project.cur;
  if(!p||!p.statusbar)return;
  const ex=$('.sbex-entry')?$('.sbex-entry').closest('.sbpg-card'):null;
  if(!ex)return;
  const sb=p.statusbar;
  const roleText=['系统','用户','AI'][+(sb.role||0)]||'系统';
  const rx=buildRegexScript(sb,p.theme,{placement:this._sbPlacement||[2],runOnEdit:this._sbRunOnEdit!==false,projectName:p.name});
  const entry=$('.sbex-entry',ex);if(entry)entry.textContent=buildEntryContent(sb);
  const regex=$('.sbex-regex',ex);
  if(regex){const rp=rx.replaceString;regex.textContent='findRegex: /'+buildFindRegex(sb)+'/\\n\\n'+rp.slice(0,600)+(rp.length>600?'…（完整内容以下载/复制为准）':'')}
  const sample=$('.sbex-sample',ex);if(sample)sample.textContent=buildSampleText(sb);
  const dep=$('.sbex-dep',ex);if(dep)dep.textContent=+sb.depth||0;
  const role=$('.sbex-role',ex);if(role)role.textContent=roleText;
  const ord=$('.sbex-ord',ex);if(ord)ord.textContent=+sb.order||999;
}