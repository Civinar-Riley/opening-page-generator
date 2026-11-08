/* 配置页渲染与交互（renderConfig：主题/宏/区块列表/搜索替换；区块编辑表单见 blockEditors.js） */
import { $, $$, esc, toast, confirmModal, contrastRatio } from '../utils.js';
import { BLOCK_DEFS, BLOCK_ORDER, THEME_PRESETS } from '../defs.js';
import { Project } from '../project.js';
import { UI } from './core.js';
import { detectFonts } from './shared.js';
import { collectSearchMatches, replaceAllInProject, replaceAllInString } from '../search.js';
import { THEME_SKINS, themeSkin, themePresetPatch, themePresetMatches, themeTexture } from '../themes.js';

/* 页面区块展开状态（索引制，按工程隔离）：showTitle/闸门主题/预设/组件插入等
   触发的整页重渲染不再跳回「第一个区块展开」；换工程时重置 */
let cfgOpen=new Set([0]),cfgOpenProj=null;

/* 预设套用统一入口：对象字段深拷贝写入——直接赋引用会让 THEME_PRESETS 常量
   被后续微调污染（bg 等对象字段尤其危险），全部预设/试穿写入必须走这里 */
function applyPresetTheme(t){
  Object.keys(t).forEach(k=>{Project.cur.theme[k]=t[k]&&typeof t[k]==='object'?JSON.parse(JSON.stringify(t[k])):t[k]});
}
/* 悬停试穿的卡片跟踪（模块级：col 上的委托监听跨重渲染存续） */
let tryCard=null,tryT=null;

/* 选中态标识：与某套预设全字段一致 → 高亮该套并显示名称；套过但已偏离 → 「已自定义（基于 X）」。
   颜色/圆角/动效等输入即时刷新（binder 挂钩），无需整卡重渲染 */
function presetStatusHtml(){
  const t=Project.cur.theme;
  const matchedIdx=THEME_PRESETS.findIndex(x=>themePresetMatches(t,x.theme));
  if(matchedIdx>=0)return `<span class="thstat">当前预设：<b>${esc(THEME_PRESETS[matchedIdx].name)}</b></span>`;
  if(t.presetRef&&THEME_PRESETS.some(x=>x.name===t.presetRef))return `<span class="thstat thstat-mod">已自定义（基于 ${esc(t.presetRef)}）— Ctrl+Z 可回退套用前状态</span>`;
  return '';
}
function updatePresetStatus(){
  const t=Project.cur.theme;
  const matchedIdx=THEME_PRESETS.findIndex(x=>themePresetMatches(t,x.theme));
  document.querySelectorAll('.thpg .thp').forEach((el,i)=>{
    el.classList.toggle('thp-sel',i===matchedIdx);
    el.setAttribute('aria-pressed',String(i===matchedIdx));
    const nm=el.querySelector('.thp-name');
    if(nm)nm.textContent=THEME_PRESETS[i].name+(i===matchedIdx?' ✓':'');
  });
  const slot=document.querySelector('.thstat-slot');
  if(slot)slot.innerHTML=presetStatusHtml();
}

/* 对比度警示：背景归主题后工具首次知道底色——文字/强调色对背景低于 WCAG 阈值时提示
   （不阻止保存）。颜色输入走 updateContrastWarn 即时刷新，无需整卡重渲染 */
function contrastWarnHtml(){
  const t=Project.cur.theme,bg=t.bg&&typeof t.bg==='object'?t.bg:{};
  const base=bg.type==='image'?'#0e0e14':(bg.color||'');
  const cT=contrastRatio(t.textColor,base),cA=contrastRatio(t.accent,base);
  const w=[];
  if(cT!==null&&cT<4.5)w.push(`文字色 ${cT.toFixed(1)}:1`);
  if(cA!==null&&cA<3)w.push(`强调色 ${cA.toFixed(1)}:1`);
  return w.length?`<div class="thwarn">⚠️ 对背景对比度偏低（${w.join('、')}；建议文字 ≥ 4.5:1、强调色 ≥ 3:1）——正文在当前底色上可能难以阅读</div>`:'';
}
function updateContrastWarn(){const slot=document.querySelector('.thwarn-slot');if(slot)slot.innerHTML=contrastWarnHtml()}

/* ---------- 配置页 ---------- */
export function renderConfig(){
  const p=Project.cur,col=$('#configCol');
  if(cfgOpenProj!==p){cfgOpen=new Set([0]);cfgOpenProj=p}
  else{
    /* 整页重渲染前从旧 DOM 抢救展开状态——下方 col.innerHTML='' 后 renderBlocks
       拿到的是新建空列表，无法再从 DOM 读回（修复：改选项后跳回第一个区块展开） */
    const oldBlocks=col.querySelectorAll('.block');
    if(oldBlocks.length){
      cfgOpen.clear();
      oldBlocks.forEach((el,i)=>{if(!el.classList.contains('collapsed'))cfgOpen.add(i)});
    }
  }
  col.innerHTML='';
  const expandedSet=cfgOpen; /* 模块级持久状态：跨整页重渲染保留展开位置 */

  /* 主题卡片（v1.24 重排：预设试穿 → 背景 → 配色 → 字体 → 动效 → 高级跟随）。
     背景自本版起归主题所有（原装饰区职责上收）；试穿只动预览覆写不落数据，见 tryPreview */
  const pbg=p.theme.bg&&typeof p.theme.bg==='object'?p.theme.bg:{type:'gradient',color:'#1a1a2e',color2:'#2d1b3d'};
  const pbgType=pbg.type||'gradient';
  /* 选中态初始渲染走 updatePresetStatus（见模块级函数）；这里只铺卡面与状态槽 */
  const presetGrid=`<div class="thpg">${THEME_PRESETS.map((t,i)=>{
    const b=t.theme.bg||{},skin=themeSkin(t.theme),texture=themeTexture(t.theme);
    const bg=b.type==='solid'?b.color:`linear-gradient(160deg,${b.color||'#1a1a2e'},${b.color2||'#2d1b3d'})`;
    return `<button type="button" class="thp" data-preset="${i}" data-skin="${skin}" title="${esc(t.caption?t.caption+'；悬停试穿，点击套用':'悬停试穿，点击套用')}" aria-pressed="false"
      style="--tbg:${texture?texture+',':''}${bg};--tp:${t.theme.primary};--ta:${t.theme.accent};--tt:${t.theme.textColor};--tr:${Math.min(22,t.theme.radius||0)}px;--tf:${esc(THEME_SKINS[skin].font)}">
      <span class="thp-demo">${t.folio?`<span class="thp-folio">${esc(t.folio)}</span>`:''}<span class="thp-title">${esc(t.specimen||'标题字')}</span><span class="thp-line"></span><span class="thp-text">${t.caption?esc(t.caption):'正文示意 Aa'}</span><span class="thp-pill">${t.caption?'翻开此页':'按钮'}</span></span>
      <span class="thp-name">${esc(t.name)}</span>
    </button>`;
  }).join('')}</div><div class="thstat-slot" style="min-height:16px;margin-bottom:4px"></div>`;
  /* 背景字段随类型切换（bg.type 变更经 binder 入库后重渲染本卡换字段集） */
  let bgFields='';
  if(pbgType==='image')bgFields=`<div><label>背景图片 URL</label><input data-bind="theme.bg.image" value="${esc(pbg.image||'')}" placeholder="https://…"></div>`;
  else{
    bgFields=`<div><label>${pbgType==='solid'?'背景色':'背景色 1'}</label><input type="color" data-bind="theme.bg.color" value="${esc(pbg.color||'#1a1a2e')}"></div>`;
    if(pbgType!=='solid')bgFields+=`<div><label>背景色 2（${pbgType==='noise'?'噪点渐变':'渐变'}用）</label><input type="color" data-bind="theme.bg.color2" value="${esc(pbg.color2||'#2d1b3d')}"></div>`;
  }
  /* 对比度警示槽：即时更新走 updateContrastWarn（binder 挂钩），槽空时 CSS 隐藏 */
  const themeCard=document.createElement('div');themeCard.className='card';
  themeCard.innerHTML=`<h3>🎨 主题风格 <span class="hint">预设悬停试穿、点击套用；分组微调随时可撤销（Ctrl+Z）</span></h3>
    ${presetGrid}
    <div class="thgrp">背景</div>
    <div class="row2"><div><label>背景类型</label><select data-bind="theme.bg.type">
      ${[['gradient','渐变'],['solid','纯色'],['image','图片'],['noise','噪点渐变']].map(([v,l])=>`<option value="${v}"${pbgType===v?' selected':''}>${l}</option>`).join('')}
    </select></div>${bgFields}</div>
    <div class="thgrp">配色</div>
    <div class="row2">
      <div><label>主色</label><input type="color" data-bind="theme.primary" value="${esc(p.theme.primary)}"></div>
      <div><label>强调色（标题/边框）</label><input type="color" data-bind="theme.accent" value="${esc(p.theme.accent)}"></div>
    </div>
    <div class="row2">
      <div><label>文字颜色</label><input type="color" data-bind="theme.textColor" value="${esc(p.theme.textColor)}"></div>
      <div><label>圆角 (px)</label><input type="number" data-bind="theme.radius" value="${esc(p.theme.radius)}" min="0" max="40"></div>
    </div>
    <div class="row2">
      <div><label>标题对齐</label>
        <select data-bind="theme.titleAlign">
          <option value="center"${p.theme.titleAlign==='center'?' selected':''}>居中</option>
          <option value="left"${p.theme.titleAlign==='left'?' selected':''}>左对齐</option>
        </select></div>
      <div><label>动效档位</label>
        <select data-bind="theme.motion">
          <option value="full"${p.theme.motion!=='soft'&&p.theme.motion!=='off'?' selected':''}>华丽（入场错峰 + 全部动效）</option>
          <option value="soft"${p.theme.motion==='soft'?' selected':''}>轻盈（只淡入、更快）</option>
          <option value="off"${p.theme.motion==='off'?' selected':''}>关闭（纯静态）</option>
        </select></div>
    </div>
    <div><label>主题材质 / 版式</label><select data-bind="theme.skin">
      ${Object.entries(THEME_SKINS).map(([v,s])=>`<option value="${v}"${themeSkin(p.theme)===v?' selected':''}>${esc(s.name)}</option>`).join('')}
    </select></div>
    <div style="font-size:11px;color:var(--txt2);margin-top:4px">材质只改底纹与版式，不改区块内容；选「经典」可关闭。套用预设包含字体，原有装饰花纹与标题装饰仍由区块管理。</div>
    <div class="thwarn-slot"></div>
    <div class="thgrp">字体</div>
    <div class="row2">
      <div><label>正文字体</label>
        <select id="fontPicker">
          <option value="">系统默认</option>
        </select>
        <input type="text" id="fontCustomInput" value="${esc(p.theme.fontName)}" placeholder="输入字体名称" style="margin-top:4px;display:none">
      </div>
      <div><label>标题字体（留空跟随正文）</label><input data-bind="theme.headingFont" value="${esc(p.theme.headingFont||'')}" placeholder="如 Noto Serif SC，仅作用于标题位"></div>
    </div>
    <div style="font-size:11px;color:var(--txt2);margin-top:4px">字体检测的是本机已装字体；读者机器未装该字体时回落系统默认，导出前建议选常见字体或接受回落。</div>
    <details class="thadv">
      <summary>高级 · 跟随酒馆主题</summary>
      <div style="font-size:11px;color:var(--txt2);margin:8px 0 2px">仅酒馆真机生效：勾选后对应颜色在酒馆内读取该用户酒馆的 SmartTheme 变量，未生效时回落到本卡手动设置的值；预览显示的始终是手动值，不代表酒馆内的最终效果。</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px">
        <label class="inline-check"><input type="checkbox" data-bind="theme.follow.text" ${(p.theme.follow&&p.theme.follow.text)||p.theme.followTavern?'checked':''}>正文色</label>
        <label class="inline-check"><input type="checkbox" data-bind="theme.follow.quote" ${(p.theme.follow&&p.theme.follow.quote)?'checked':''}>引用色</label>
        <label class="inline-check"><input type="checkbox" data-bind="theme.follow.font" ${(p.theme.follow&&p.theme.follow.font)?'checked':''}>字体</label>
        <label class="inline-check"><input type="checkbox" data-bind="theme.follow.em" ${(p.theme.follow&&p.theme.follow.em)?'checked':''}>强调色（斜体）</label>
      </div>
    </details>
  `;
  col.appendChild(themeCard);
  updatePresetStatus();updateContrastWarn();

  /* 字体检测与选择 */
  const fontPicker=$('#fontPicker',col);
  const fontCustomInput=$('#fontCustomInput',col);
  /* detectFonts 返回会话缓存本体：拷贝后再 unshift 自定义项，不污染跨工程候选 */
  const detected=[...detectFonts()];
  if(p.theme.fontName&&!detected.includes(p.theme.fontName)){
    detected.unshift(p.theme.fontName);
  }
  fontPicker.innerHTML=`<option value="">系统默认</option>`+detected.map(f=>`<option value="${esc(f)}"${p.theme.fontName===f?' selected':''}>${esc(f)}</option>`).join('')+`<option value="__custom__">${p.theme.fontName&&!detected.includes(p.theme.fontName)?'当前: '+esc(p.theme.fontName):'自定义…'}</option>`;
  if(p.theme.fontName&&!detected.includes(p.theme.fontName)){
    fontPicker.value='__custom__';fontCustomInput.style.display='';fontCustomInput.value=p.theme.fontName;
  }else{
    fontCustomInput.style.display='none';
  }
  fontPicker.addEventListener('change',()=>{
    if(fontPicker.value==='__custom__'){fontCustomInput.style.display='';fontCustomInput.focus()}
    else{
      p.theme.fontName=fontPicker.value;
      fontCustomInput.style.display='none';
      updatePresetStatus();UI.debouncedPreview();Project.saveDebounced();
    }
  });
  fontCustomInput.addEventListener('input',()=>{
    p.theme.fontName=fontCustomInput.value;
    updatePresetStatus();UI.debouncedPreview();Project.saveDebounced();
  });

  /* 区块卡片 */
  const blockCard=document.createElement('div');blockCard.className='card';
  blockCard.innerHTML=`<h3>🧱 页面区块 <span class="hint">点击标题展开/收起，拖拽 ⠿ 调整顺序（触屏长按把手），✕ 删除，底部可添加区块</span></h3>`;
  /* 区块搜索框 */
  const searchWrap=document.createElement('div');
  searchWrap.style.cssText='display:flex;gap:6px;margin-bottom:8px';
  const searchBox=document.createElement('input');
  searchBox.type='text';searchBox.id='blockSearch';
  searchBox.placeholder='🔍 搜索区块名称...';
  searchBox.style.cssText='flex:1;padding:6px 10px;font-size:12px;background:var(--panel2);border:1px solid var(--line);border-radius:6px;box-sizing:border-box';
  const searchReplaceBtn=document.createElement('button');
  searchReplaceBtn.type='button';searchReplaceBtn.className='btn ghost small';
  searchReplaceBtn.textContent='🔄 搜索替换';
  searchReplaceBtn.style.cssText='flex-shrink:0;font-size:11px';
  searchWrap.appendChild(searchBox);searchWrap.appendChild(searchReplaceBtn);
  blockCard.appendChild(searchWrap);
  const blockList=document.createElement('div');blockCard.appendChild(blockList);col.appendChild(blockCard);
  /* 页面区块卡折叠（记忆于 localStorage） */
  blockCard.insertAdjacentHTML('beforeend',"<button type='button' class='sbpg-fold' title='折叠/展开'>▾</button>");
  const bfBtn=blockCard.querySelector('.sbpg-fold');
  try{
    if(JSON.parse(localStorage.getItem('openingPageGen_v1_pageFold')||'{}').blocks){
      blockCard.classList.add('sbpg-folded');bfBtn.textContent='▸';
    }
  }catch(e){}
  bfBtn.addEventListener('click',()=>{
    const folded=blockCard.classList.toggle('sbpg-folded');
    bfBtn.textContent=folded?'▸':'▾';
    try{localStorage.setItem('openingPageGen_v1_pageFold',JSON.stringify({blocks:folded}))}catch(e){}
  });

  /* 添加区块栏：所有类型均可重复添加 */
  const addBar=document.createElement('div');
  addBar.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-top:4px';
  addBar.innerHTML=`<span style="font-size:12px;color:var(--txt2);align-self:center;width:100%">＋ 添加区块（可重复添加同类）：</span>`+
    BLOCK_ORDER.map(t=>`<button type="button" class="btn ghost small" data-addblk="${t}">${BLOCK_DEFS[t].icon}${BLOCK_DEFS[t].name}</button>`).join('');
  blockCard.appendChild(addBar);
  addBar.addEventListener('click',e=>{
    const t=e.target.dataset.addblk;if(!t||!BLOCK_DEFS[t])return;
    const newIdx=Project.cur.blocks.length;
    Project.cur.blocks.push({type:t,enabled:true,...BLOCK_DEFS[t].create()});
    renderBlocks();UI.renderExport();UI.refreshPreview();Project.save();Project.saveSnapshot();
    /* 自动展开新块并滚动到底部 */
    const lastEl=blockList.lastElementChild;
    if(lastEl){
      lastEl.classList.remove('collapsed');
      expandedSet.add(newIdx);
      lastEl.scrollIntoView({behavior:'smooth',block:'center'});
    }
    toast('已添加：'+BLOCK_DEFS[t].name);
  });

  /* 桌面拖拽排序（mouse 事件改为拖拽实现，松开即落位） */
  let dragIdx=-1;
  blockList.addEventListener('dragstart',e=>{
    const t=e.target.closest('.block');if(!t)return;
    dragIdx=[...blockList.children].indexOf(t);
    t.style.opacity='.45';
    try{e.dataTransfer.setData('text/plain','')}catch(_){}
    e.dataTransfer.effectAllowed='move';
  });
  blockList.addEventListener('dragover',e=>{
    if(dragIdx<0)return;e.preventDefault();
    blockList.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
    const t=e.target.closest('.block');
    if(t&&[...blockList.children].indexOf(t)!==dragIdx)t.classList.add('drag-over');
  });
  blockList.addEventListener('drop',e=>{
    if(dragIdx<0)return;e.preventDefault();
    blockList.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
    const t=e.target.closest('.block');
    if(t){
      const to=[...blockList.children].indexOf(t),arr=Project.cur.blocks;
      if(to>-1&&to!==dragIdx){
        const[m]=arr.splice(dragIdx,1);arr.splice(to,0,m);
        renderBlocks();this.renderExport();this.refreshPreview();Project.save();Project.saveSnapshot();
      }
    }
    dragIdx=-1;
  });
  blockList.addEventListener('dragend',()=>{
    blockList.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
    blockList.querySelectorAll('[draggable]').forEach(el=>{el.removeAttribute('draggable');el.style.opacity=''});
    dragIdx=-1;
  });

  /* 触屏长按拖拽（替代原生 drag，避免拖拽与滚动冲突） */
  let tDragIdx=-1,tTimer=null,tActive=false,tStartX=0,tStartY=0;
  const T_LONG_PRESS=350,T_MOVE_CANCEL=12;
  blockList.addEventListener('touchstart',e=>{
    const handle=e.target.closest('.drag-handle');if(!handle)return;
    const block=handle.closest('.block');if(!block)return;
    const t=e.touches[0];
    tStartX=t.clientX;tStartY=t.clientY;
    tDragIdx=[...blockList.children].indexOf(block);
    tActive=false;
    clearTimeout(tTimer);
    tTimer=setTimeout(()=>{
      tActive=true;
      block.style.opacity='.45';
      if(navigator.vibrate)navigator.vibrate(30);
    },T_LONG_PRESS);
  },{passive:true});
  blockList.addEventListener('touchmove',e=>{
    if(!tActive){
      /* 未激活前移动 → 视为滚动取消长按 */
      const t=e.touches[0];
      if(Math.abs(t.clientX-tStartX)>T_MOVE_CANCEL||Math.abs(t.clientY-tStartY)>T_MOVE_CANCEL)clearTimeout(tTimer);
      return;
    }
    e.preventDefault();
    const el=document.elementFromPoint(e.touches[0].clientX,e.touches[0].clientY);
    const t=el&&el.closest?el.closest('.block'):null;
    blockList.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
    if(t&&[...blockList.children].indexOf(t)!==tDragIdx)t.classList.add('drag-over');
  },{passive:false});
  blockList.addEventListener('touchend',e=>{
    clearTimeout(tTimer);
    if(!tActive){tDragIdx=-1;return}
    if(e.cancelable)e.preventDefault(); /* 阻止合成 click 触发折叠 */
    const over=blockList.querySelector('.drag-over');
    blockList.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
    blockList.querySelectorAll('.block').forEach(x=>{x.style.opacity=''});
    if(over){
      const to=[...blockList.children].indexOf(over),arr=Project.cur.blocks;
      if(to>-1&&to!==tDragIdx){
        const[m]=arr.splice(tDragIdx,1);arr.splice(to,0,m);
        renderBlocks();UI.renderExport();UI.refreshPreview();Project.save();Project.saveSnapshot();
      }
    }
    tDragIdx=-1;tActive=false;
  },{passive:false});
  blockList.addEventListener('touchcancel',()=>{
    clearTimeout(tTimer);
    blockList.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
    blockList.querySelectorAll('.block').forEach(x=>{x.style.opacity=''});
    tDragIdx=-1;tActive=false;
  });

  const renderBlocks=()=>{
    /* 有旧 DOM 时按 DOM 同步展开状态；blockList 为空（首次构建）保留初始 {0}，
       用户手动全部收起后保持收起，不再强制弹开第一个区块 */
    if(blockList.children.length){
      expandedSet.clear();
      blockList.querySelectorAll('.block').forEach((el,i)=>{if(!el.classList.contains('collapsed'))expandedSet.add(i)});
    }
    blockList.innerHTML='';
    /* 统计同类型数量用于序号角标 */
    const typeCount={};
    Project.cur.blocks.forEach(b=>{typeCount[b.type]=(typeCount[b.type]||0)+1});
    const typeIdx={};
    const keyword=(searchBox.value||'').trim().toLowerCase();
    Project.cur.blocks.forEach((b,i)=>{
      const def=BLOCK_DEFS[b.type]||{icon:'?',name:'未知区块（'+b.type+'）'};
      typeIdx[b.type]=(typeIdx[b.type]||0)+1;
      const seq=typeCount[b.type]>1?` <span class="block-seq">#${typeIdx[b.type]}</span>`:'';
      const el=document.createElement('div');
      el.className='block'+(b.enabled?'':' disabled')+(expandedSet.has(i)?'':' collapsed');
      el.dataset.bname=def.name.toLowerCase();
      el.innerHTML=`<div class="block-head">
          <span class="drag-handle" title="长按拖动排序">⠿</span>
          <span class="arrow">▸</span>
          <label class="inline-check" style="margin:0"><input type="checkbox" data-block-en="${i}" ${b.enabled?'checked':''}></label>
          <span class="btitle">${def.icon} ${def.name}${seq}</span>
          <span class="ord"><button type="button" data-cp="${i}" title="复制本区块" style="color:var(--acc)">⧉</button><button type="button" data-mv="up" data-i="${i}" title="上移">↑</button><button type="button" data-mv="down" data-i="${i}" title="下移">↓</button><button type="button" data-bdel="${i}" title="删除该区块" style="color:var(--err)">✕</button></span>
        </div><div class="block-body"></div>`;
      this.renderBlockBody(el.querySelector('.block-body'),b,i);
      /* 点击 label/按钮/把手不触发折叠 */
      el.querySelector('.block-head').onclick=e=>{if(e.target.tagName==='INPUT'||e.target.closest('button')||e.target.closest('label'))return;el.classList.toggle('collapsed')};
      /* 桌面把手 mousedown 启用 draggable 防误触 */
      const handle=el.querySelector('.drag-handle');
      handle.addEventListener('mousedown',e=>{e.stopPropagation();el.setAttribute('draggable','true')});
      el.addEventListener('mouseup',()=>el.removeAttribute('draggable'));
      el.addEventListener('dragend',()=>el.removeAttribute('draggable'));
      /* 搜索过滤 */
      if(keyword&&!def.name.toLowerCase().includes(keyword)){
        el.style.display='none';
      }
      blockList.appendChild(el);
    });
  };
  renderBlocks();
  /* 搜索仅做可见性过滤（不重建 DOM，与全局替换的 renderBlocks 不同） */
  searchBox.addEventListener('input',()=>{
    const kw=(searchBox.value||'').trim().toLowerCase();
    $$('.block',blockList).forEach(el=>{el.style.display=(!kw||(el.dataset.bname||'').includes(kw))?'':'none'});
  });

  /* ---- 全局搜索替换 ---- */
  searchReplaceBtn.addEventListener('click',async()=>{
    const ov=document.createElement('div');
    /* opg-ov：自绘弹层统一标记（core.js 的 Ctrl+Z/Esc 守卫借此识别「有弹层打开」） */
    ov.className='opg-ov';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483647;display:flex;align-items:center;justify-content:center';
    const box=document.createElement('div');
    box.style.cssText='background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px;width:min(520px,92vw);max-height:80vh;overflow:auto';
    box.innerHTML=`<div style="font-weight:700;margin-bottom:10px">🔍 全局搜索替换</div>
      <div><label>查找</label><input id="gsrFind" style="width:100%;padding:6px 10px;font-size:12px;background:var(--panel2);border:1px solid var(--line);border-radius:6px;box-sizing:border-box"></div>
      <div style="margin-top:8px"><label>替换为</label><input id="gsrReplace" style="width:100%;padding:6px 10px;font-size:12px;background:var(--panel2);border:1px solid var(--line);border-radius:6px;box-sizing:border-box"></div>
      <div style="display:flex;align-items:center;gap:8px;margin:10px 0 6px;font-size:12px;color:var(--txt2)">
        <span id="gsrInfo">输入查找关键词后自动扫描</span>
        <span style="flex:1"></span>
        <button type="button" class="btn ghost small" id="gsrPrev" disabled style="font-size:11px;padding:2px 8px">◀ 上一个</button>
        <span id="gsrPos" style="min-width:60px;text-align:center"></span>
        <button type="button" class="btn ghost small" id="gsrNext" disabled style="font-size:11px;padding:2px 8px">下一个 ▶</button>
      </div>
      <div style="text-align:right;margin-top:12px;display:flex;justify-content:flex-end;gap:8px">
        <button type="button" class="btn ghost small" data-gsr-close>取消</button>
        <button type="button" class="btn small" id="gsrReplaceOne" disabled>替换当前</button>
        <button type="button" class="btn small" id="gsrReplaceAll" disabled>替换全部</button>
      </div>`;
    ov.appendChild(box);document.body.appendChild(ov);
    const findInp=box.querySelector('#gsrFind');
    const replInp=box.querySelector('#gsrReplace');
    const infoEl=box.querySelector('#gsrInfo');
    const posEl=box.querySelector('#gsrPos');
    const prevBtn=box.querySelector('#gsrPrev');
    const nextBtn=box.querySelector('#gsrNext');
    const replaceOneBtn=box.querySelector('#gsrReplaceOne');
    const replaceAllBtn=box.querySelector('#gsrReplaceAll');

    let matches=[];  /* {blockIdx, path, field, subIdx?, subField?}；blockIdx<0 为工程级字段（marker/macros） */
    let curIdx=-1;   /* 当前定位在 matches 中的下标 */

    /* 收集全部匹配项（纯函数在 search.js，可测；传整个工程，marker/macros 等工程级字段一并扫描） */
    const collectMatches=()=>{
      matches=collectSearchMatches(Project.cur,findInp.value);
    };

    /* 更新 UI 状态 */
    const updateUI=()=>{
      const n=matches.length;
      if(n===0){
        infoEl.textContent=findInp.value.trim()?'无匹配':'输入查找关键词后自动扫描';
        posEl.textContent='';
        prevBtn.disabled=nextBtn.disabled=true;
        replaceOneBtn.disabled=replaceAllBtn.disabled=true;
        curIdx=-1;
        return;
      }
      infoEl.textContent=`共 ${n} 处匹配`;
      prevBtn.disabled=nextBtn.disabled=false;
      replaceOneBtn.disabled=replaceAllBtn.disabled=false;
      if(curIdx<0)curIdx=0;
      posEl.textContent=`${curIdx+1} / ${n}`;
      prevBtn.disabled=curIdx<=0;
      nextBtn.disabled=curIdx>=n-1;
      /* 定位当前匹配项：展开对应区块并滚动到可视位置。
         导航/输入关键词不再全量重建区块列表（重建曾让逐条定位与逐字输入都卡在整页 DOM 重建上）：
         弹窗打开期间 .opg-ov 遮罩挡住结构操作、Ctrl+Z 被 modalOpen 守卫拦下，blockIdx 不会漂移；
         数据真正变更的替换路径（replaceCurrent/replaceAll）自行 renderBlocks 后再进这里 */
      const m=matches[curIdx];
      if(m.blockIdx>=0){
        expandedSet.add(m.blockIdx);
        const target=blockList.querySelectorAll('.block')[m.blockIdx];
        if(target){
          target.classList.remove('collapsed');
          target.scrollIntoView({behavior:'smooth',block:'center'});
          /* 短暂闪烁 */
          target.style.transition='outline 0.2s';
          target.style.outline='2px solid var(--acc)';
          setTimeout(()=>{target.style.outline=''},1200);
        }
      }
    };

    findInp.addEventListener('input',()=>{
      collectMatches();curIdx=-1;updateUI();
    });
    prevBtn.addEventListener('click',()=>{if(curIdx>0){curIdx--;updateUI()}});
    nextBtn.addEventListener('click',()=>{if(curIdx<matches.length-1){curIdx++;updateUI()}});

    /* 替换当前 */
    const replaceCurrent=async()=>{
      if(curIdx<0||curIdx>=matches.length)return;
      const m=matches[curIdx];
      const b=m.blockIdx>=0?Project.cur.blocks[m.blockIdx]:null;
      const kw=findInp.value.trim();
      const repl=replInp.value;
      if(!kw)return;
      const getTarget=()=>{
        if(m.blockIdx<0)return m.parent==='macros'?Project.cur.macros[m.subIdx]:Project.cur;
        if(m.parent==='characters')return b.characters[m.subIdx];
        if(m.parent==='images')return b.images[m.subIdx];
        if(m.parent==='pages')return b.pages[m.subIdx];
        if(m.parent==='entries')return b.entries[m.subIdx];
        if(m.parent==='tracks')return b.tracks[m.subIdx];
        if(m.parent==='groups.items'){const[gi,ii]=String(m.subIdx).split('.');return b.groups[+gi].items[+ii]}
        if(m.parent==='groups')return b.groups[m.subIdx];
        return b;
      };
      const target=getTarget();
      if(target&&typeof target[m.subField]==='string'){
        /* 字面替换（不展开 $&/$1 等替换模式） */
        target[m.subField]=replaceAllInString(target[m.subField],kw,repl);
      }
      collectMatches();
      if(curIdx>=matches.length)curIdx=matches.length-1;
      renderBlocks();UI.renderExport();UI.refreshPreview();Project.save();Project.saveSnapshot();
      updateUI();
    };

    replaceOneBtn.addEventListener('click',replaceCurrent);

    /* 替换全部 */
    replaceAllBtn.addEventListener('click',async()=>{
      const kw=findInp.value.trim();
      const repl=replInp.value;
      if(!kw||!matches.length)return;
      if(!await confirmModal(`确定替换全部 ${matches.length} 处匹配？`))return;
      const count=replaceAllInProject(Project.cur,kw,repl);
      renderBlocks();UI.renderExport();UI.refreshPreview();Project.save();Project.saveSnapshot();
      toast(`已替换 ${count} 处`);
      ov.remove();
    });

    /* 关闭 */
    ov.addEventListener('click',e=>{if(e.target===ov||e.target.dataset.gsrClose!==undefined)ov.remove()});
  });

  blockList.addEventListener('change',e=>{
    const en=e.target.dataset.blockEn;
    if(en!==undefined){Project.cur.blocks[+en].enabled=e.target.checked;renderBlocks();this.renderExport();this.refreshPreview();Project.save();Project.saveSnapshot()}
  });
  blockList.addEventListener('click',async e=>{
    const bd=e.target.dataset.bdel;
    if(bd!==undefined){
      const pSnap=Project.cur; /* 确认弹窗无焦点陷阱，期间可经键盘切工程：切换后中止防跨工程误删 */
      if(!await confirmModal('确定删除该区块？删除后可通过底部「添加区块」重新添加。'))return;
      if(Project.cur!==pSnap){toast('工程已切换，已取消删除');return}
      Project.cur.blocks.splice(+bd,1);
      renderBlocks();UI.renderExport();UI.refreshPreview();Project.save();Project.saveSnapshot();
      return;
    }
    const cp=e.target.dataset&&e.target.dataset.cp;
    if(cp!==undefined){
      const i=+cp;
      const clone=JSON.parse(JSON.stringify(Project.cur.blocks[i]));
      Project.cur.blocks.splice(i+1,0,clone);
      renderBlocks();this.renderExport();this.refreshPreview();Project.save();Project.saveSnapshot();
      return;
    }
    const mv=e.target.dataset&&e.target.dataset.mv;
    if(!mv)return;
    const i=+e.target.dataset.i,j=mv==='up'?i-1:i+1;
    const arr=Project.cur.blocks;
    if(j<0||j>=arr.length)return;
    [arr[i],arr[j]]=[arr[j],arr[i]];
    renderBlocks();this.renderExport();this.refreshPreview();Project.save();Project.saveSnapshot();
  });

  /* 宏卡片 */
  const macroCard=document.createElement('div');macroCard.className='card';
  const renderMacros=()=>{
    macroCard.innerHTML=`<h3>🔮 宏预览替换 <span class="hint">仅影响预览，导出代码保留原始宏</span></h3><div id="macroRows"></div><button type="button" class="btn ghost small" id="addMacro">＋ 添加宏</button>`;
    const rows=$('#macroRows',macroCard);
    Project.cur.macros.forEach((m,i)=>{
      const r=document.createElement('div');r.className='macro-row';
      r.innerHTML=`<input type="text" data-mk="${i}" value="${esc(m.k)}" placeholder="宏名(如char)"><div style="display:flex;gap:6px;flex:1;min-width:0"><input type="text" data-mv2="${i}" value="${esc(m.v)}" placeholder="预览替换值" style="flex:1;min-width:0"></div><button type="button" data-del="${i}">✕</button>`;
      rows.appendChild(r);
    });
  };
  renderMacros();
  macroCard.addEventListener('click',e=>{
    if(e.target.id==='addMacro'){Project.cur.macros.push({k:'',v:''});renderMacros();Project.save()}
    const del=e.target.dataset.del;
    if(del!==undefined){Project.cur.macros.splice(+del,1);renderMacros();this.refreshPreview();Project.save()}
  });
  macroCard.addEventListener('input',e=>{
    const mk=e.target.dataset.mk,mv=e.target.dataset.mv2;
    if(mk!==undefined)Project.cur.macros[+mk].k=e.target.value;
    if(mv!==undefined)Project.cur.macros[+mv].v=e.target.value;
    this.debouncedPreview();Project.saveDebounced();
  });
  col.appendChild(macroCard);

  /* 通用绑定（主题字段）——col 本体跨渲染复用，只挂一次避免监听器累积 */
  if(!col.dataset.themeBound){
    col.dataset.themeBound='1';
    col.addEventListener('input',e=>{
      const bind=e.target.dataset.bind;
      if(!bind||!bind.startsWith('theme.'))return;
      /* 支持两层路径（theme.follow.xxx / theme.bg.xxx）：逐层下钻，中间节点缺失时补空对象 */
      const keys=bind.split('.').slice(1);
      let obj=Project.cur.theme;
      while(keys.length>1){const k=keys.shift();if(!obj[k]||typeof obj[k]!=='object')obj[k]={};obj=obj[k]}
      obj[keys[0]]=e.target.type==='checkbox'?e.target.checked:e.target.value;
      /* follow.text 与旧布尔 followTavern 保持同值（旧版工程文件兼容） */
      if(bind==='theme.follow.text')Project.cur.theme.followTavern=obj[keys[0]];
      /* 背景类型切换换字段集：入库后重渲染本卡（重渲染会销毁触发元素，值须先读完毕） */
      if(bind==='theme.bg.type'){Project.saveDebounced();UI.renderConfig()}
      /* 主题可微调字段的即时反馈：对比度警示 + 预设选中态/已自定义标识 */
      if(/^theme\.(primary|accent|textColor|radius|titleAlign|motion|skin|headingFont|bg\.)/.test(bind)){updateContrastWarn();updatePresetStatus()}
      this.debouncedPreview();Project.saveDebounced();
    });
    /* 悬停试穿：只覆写预览构建的 theme 拷贝（UI.previewThemeOverride），工程数据不动——
       undo/重渲染/换工程天然安全。enter 防抖 120ms 防飞掠重建风暴；leave 立即还原 */
    col.addEventListener('mouseover',e=>{
      const card=e.target.closest('[data-preset]');
      if(!card||card===tryCard)return;
      const pi=+card.dataset.preset;
      if(!THEME_PRESETS[pi])return;
      clearTimeout(tryT);tryCard=card;
      tryT=setTimeout(()=>UI.tryPreview(themePresetPatch(THEME_PRESETS[pi].theme)),120);
    });
    col.addEventListener('mouseout',e=>{
      if(!tryCard)return;
      const card=e.target.closest('[data-preset]');
      if(!card||card!==tryCard)return;
      if(card.contains(e.relatedTarget))return; /* 卡内子元素间移动不算离开 */
      clearTimeout(tryT);tryCard=null;
      UI.tryPreview(null);
    });
    /* 主题预设一键套用（closest：点中试穿卡内任意子元素都能命中）。
       试穿只动预览覆写、数据仍为原值，此处直接落盘即可；主题自 v1.24 进撤销栈 */
    col.addEventListener('click',e=>{
      const btn=e.target.closest('[data-preset]');
      if(!btn)return;
      const pi=btn.dataset.preset;
      if(pi===undefined||!THEME_PRESETS[+pi])return;
      clearTimeout(tryT);tryCard=null;
      UI.previewThemeOverride=null;
      const tp=THEME_PRESETS[+pi];
      applyPresetTheme(themePresetPatch(tp.theme));
      Project.cur.theme.presetRef=tp.name;
      Project.saveSnapshot();Project.save();
      UI.renderConfig();UI.refreshPreview();UI.renderExport();
      toast('已套用预设：'+tp.name);
    });
  }

  /* 实时预览面板（配置页右侧 + 预览页共用渲染）；两 slot 的 iframe id 必须不同（DOM 唯一性） */
  this.mountPreview($('#livePreviewSlot'),'previewFrameLive');
  if($('#pagePreview .preview-col'))this.mountPreview($('#pagePreview .preview-col'),'previewFrame');
}
