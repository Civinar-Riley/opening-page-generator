/* 配置页渲染与交互（renderConfig + renderBlockBody 区块编辑器） */
import { $, $$, esc, toast, confirmModal } from '../utils.js';
import { BLOCK_DEFS, BLOCK_ORDER, COMP_LIB, THEME_PRESETS, BLOCK_PRESETS } from '../defs.js';
import { Project } from '../project.js';
import { UI } from './core.js';
import { bindListEditor, detectFonts } from './shared.js';
import { collectSearchMatches, replaceAllInProject, replaceAllInString } from '../search.js';

/* ---------- 配置页 ---------- */
export function renderConfig(){
  const p=Project.cur,col=$('#configCol');
  col.innerHTML='';

  /* 主题卡片 */
  const themeCard=document.createElement('div');themeCard.className='card';
  themeCard.innerHTML=`<h3>🎨 主题风格 <span class="hint">点预设一键套用，下方可微调</span></h3>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${THEME_PRESETS.map((t,i)=>`<button type="button" class="btn ghost small" data-preset="${i}"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${t.theme.primary};margin-right:4px;vertical-align:-1px"></span>${t.name}</button>`).join('')}</div>
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
      <div><label>字体</label>
        <select id="fontPicker">
          <option value="">系统默认</option>
        </select>
        <input type="text" id="fontCustomInput" value="${esc(p.theme.fontName)}" placeholder="输入字体名称" style="margin-top:4px;display:none">
      </div>
    </div>
    <label class="inline-check"><input type="checkbox" data-bind="theme.followTavern" ${p.theme.followTavern?'checked':''}>跟随酒馆主题（文字色读取酒馆变量 --SmartThemeBodyColor）</label>
  `;
  col.appendChild(themeCard);

  /* 字体检测与选择 */
  const fontPicker=$('#fontPicker',col);
  const fontCustomInput=$('#fontCustomInput',col);
  const detected=detectFonts();
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
      UI.debouncedPreview();Project.saveDebounced();
    }
  });
  fontCustomInput.addEventListener('input',()=>{
    p.theme.fontName=fontCustomInput.value;
    UI.debouncedPreview();Project.saveDebounced();
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
  const expandedSet=new Set([0]);
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
    /* 保存当前展开状态；首次重建（blockList 为空）默认展开第一个区块 */
    expandedSet.clear();
    blockList.querySelectorAll('.block').forEach((el,i)=>{if(!el.classList.contains('collapsed'))expandedSet.add(i)});
    if(!expandedSet.size)expandedSet.add(0);
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
          <span class="ord"><button data-cp="${i}" title="复制本区块" style="color:var(--acc)">⧉</button><button data-mv="up" data-i="${i}" title="上移">↑</button><button data-mv="down" data-i="${i}" title="下移">↓</button><button data-bdel="${i}" title="删除该区块" style="color:var(--err)">✕</button></span>
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

    let matches=[];  /* {blockIdx, path, field, subIdx?, subField?} */
    let curIdx=-1;   /* 当前定位在 matches 中的下标 */

    /* 收集全部匹配项（纯函数在 search.js，可测） */
    const collectMatches=()=>{
      matches=collectSearchMatches(Project.cur.blocks,Project.cur.statusbar,findInp.value);
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
      /* 定位当前匹配项：展开对应区块并滚动（状态栏字段则跳到状态栏页签的可视定位） */
      const m=matches[curIdx];
      if(m.blockIdx>=0){
        renderBlocks();
        /* add 须在 renderBlocks 之后：其内部会先 clear expandedSet 再按 DOM 重读，提前 add 会被清掉 */
        expandedSet.add(m.blockIdx);
        const blockEls=blockList.querySelectorAll('.block');
        const target=blockEls[m.blockIdx];
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
      const b=Project.cur.blocks[m.blockIdx];
      const kw=findInp.value.trim();
      const repl=replInp.value;
      if(!kw)return;
      const getTarget=()=>{
        if(m.parent==='characters')return b.characters[m.subIdx];
        if(m.parent==='images')return b.images[m.subIdx];
        if(m.parent==='tracks')return b.tracks[m.subIdx];
        if(m.parent==='groups.items'){const[gi,ii]=String(m.subIdx).split('.');return b.groups[+gi].items[+ii]}
        if(m.parent==='groups')return b.groups[m.subIdx];
        if(m.parent==='statusbar')return Project.cur.statusbar.fields[m.sbIdx];
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
      /* 状态栏字段被替换后必须重渲染状态栏页：其输入框仍显示旧值，用户再编辑会把旧文本写回（静默撤销替换） */
      if(m.parent==='statusbar')UI.renderStatus();
      updateUI();
    };

    replaceOneBtn.addEventListener('click',replaceCurrent);

    /* 替换全部 */
    replaceAllBtn.addEventListener('click',async()=>{
      const kw=findInp.value.trim();
      const repl=replInp.value;
      if(!kw||!matches.length)return;
      if(!await confirmModal(`确定替换全部 ${matches.length} 处匹配？`))return;
      const hasSb=matches.some(x=>x.parent==='statusbar');
      const count=replaceAllInProject(Project.cur,kw,repl);
      renderBlocks();UI.renderExport();UI.refreshPreview();Project.save();Project.saveSnapshot();
      if(hasSb)UI.renderStatus();
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
      if(!await confirmModal('确定删除该区块？删除后可通过底部「添加区块」重新添加。'))return;
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
    macroCard.innerHTML=`<h3>🔮 宏预览替换 <span class="hint">仅影响预览，导出代码保留原始宏</span></h3><div id="macroRows"></div><button class="btn ghost small" id="addMacro">＋ 添加宏</button>`;
    const rows=$('#macroRows',macroCard);
    Project.cur.macros.forEach((m,i)=>{
      const r=document.createElement('div');r.className='macro-row';
      r.innerHTML=`<input type="text" data-mk="${i}" value="${esc(m.k)}" placeholder="宏名(如char)"><div style="display:flex;gap:6px;flex:1;min-width:0"><input type="text" data-mv2="${i}" value="${esc(m.v)}" placeholder="预览替换值" style="flex:1;min-width:0"></div><button data-del="${i}">✕</button>`;
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
      const key=bind.split('.')[1];
      Project.cur.theme[key]=e.target.type==='checkbox'?e.target.checked:e.target.value;
      this.debouncedPreview();Project.saveDebounced();
    });
    /* 主题预设一键套用（closest：点中预设按钮内的色点 span 也能命中） */
    col.addEventListener('click',e=>{
      /* 先判 btn 再取值：btn 为 null 时 pi 若经 && 短路得 null，会漏过 ===undefined 守卫
         （null!==undefined 且 +null=0 命中预设 0）——任意点击都会误套用首个预设并整页重渲染 */
      const btn=e.target.closest('[data-preset]');
      if(!btn)return;
      const pi=btn.dataset.preset;
      if(pi===undefined||!THEME_PRESETS[+pi])return;
      const t=THEME_PRESETS[+pi].theme;
      Object.keys(t).forEach(k=>{Project.cur.theme[k]=t[k]});
      /* 主题也进导出产物：同步重渲染导出页，防止复制到过期内容 */
      UI.renderConfig();UI.refreshPreview();UI.renderExport();Project.save();
      toast('已套用预设：'+THEME_PRESETS[+pi].name);
    });
  }

  /* 实时预览面板（配置页右侧 + 预览页共用渲染） */
  this.mountPreview($('#livePreviewSlot'));
  if($('#pagePreview .preview-col'))this.mountPreview($('#pagePreview .preview-col'));
}

/* ---------- 区块编辑器 ---------- */
export function renderBlockBody(container,b,i){
  const p=Project.cur;
  const bind=(key,label,type='text',extra='')=>`<div><label>${label}</label><input type="${type}" data-bkey="${i}.${key}" value="${esc(b[key]??'')}" ${extra}></div>`;
  const area=(key,label,ph='')=>`<div><label>${label}</label><textarea data-bkey="${i}.${key}" placeholder="${ph}">${esc(b[key]??'')}</textarea></div>`;
  const chk=(key,label)=>`<label class="inline-check"><input type="checkbox" data-bchk="${i}.${key}" ${b[key]?'checked':''}>${label}</label>`;
  let html='';
  switch(b.type){
    case 'welcome':{
      const presets=BLOCK_PRESETS.welcome||[];
      html=(presets.length?`<div style="margin:0 0 8px"><label>📋 套用预设</label><select data-gpreset="welcome"><option value="">选择预设模板…</option>${presets.map((p,pi)=>`<option value="${pi}">${esc(p.name)}</option>`).join('')}</select></div>`:'')
        +bind('title','主标题（支持 {{char}} 等宏）')+bind('subtitle','副标题')+`<div><label>标题装饰风格</label><select data-bkey="${i}.decoStyle">
          <option value="none"${b.decoStyle==='none'?' selected':''}>无</option>
          <option value="ornate"${b.decoStyle==='ornate'?' selected':''}>华丽辉光</option>
          <option value="glitch"${b.decoStyle==='glitch'?' selected':''}>故障风</option>
          <option value="underline"${b.decoStyle==='underline'?' selected':''}>荧光下划线</option>
          <option value="boxed"${b.decoStyle==='boxed'?' selected':''}>描边线框</option>
          <option value="double"${b.decoStyle==='double'?' selected':''}>双线夹注</option>
          <option value="brackets"${b.decoStyle==='brackets'?' selected':''}>书名括角『』</option>
          <option value="stamp"${b.decoStyle==='stamp'?' selected':''}>印章</option>
          <option value="ribbon"${b.decoStyle==='ribbon'?' selected':''}>丝带</option>
          <option value="gradient"${b.decoStyle==='gradient'?' selected':''}>渐变文字</option>
        </select></div>`;
      break;
    }
    case 'decor':
      html=`<div class="row2"><div><label>边框样式</label><select data-bkey="${i}.borderStyle">
          ${[['none','无边框'],['solid','实线'],['double','双线'],['dashed','虚线'],['dotted','点线'],['groove','浮雕凹槽'],['ridge','浮雕凸脊'],['inset','内嵌凹线'],['outset','外凸浮线']].map(([v,l])=>`<option value="${v}"${b.borderStyle===v?' selected':''}>${l} (${v})</option>`).join('')}
        </select></div><div><label>装饰花纹</label><select data-bkey="${i}.pattern">
          ${[['none','无'],['stars','星芒 ✦'],['lines','分隔线 ◆'],['moons','月相 ☽'],['petals','花瓣 ❀'],['notes','音符 ♪'],['hearts','爱心 ♡'],['waves','波浪 〰'],['diamonds','菱形阵 ◇'],['custom','自定义字符']].map(([v,l])=>`<option value="${v}"${b.pattern===v?' selected':''}>${l}</option>`).join('')}
        </select></div></div>
        ${bind('patternText','自定义花纹字符（选「自定义字符」时生效）')}
        <div><label>背景类型</label><select data-bkey="${i}.bgType">
          <option value="gradient"${b.bgType==='gradient'?' selected':''}>渐变</option><option value="solid"${b.bgType==='solid'?' selected':''}>纯色</option><option value="image"${b.bgType==='image'?' selected':''}>图片</option><option value="noise"${b.bgType==='noise'?' selected':''}>噪点渐变</option>
        </select></div>
        ${bind('bgColor','背景色 1','color')}${bind('bgColor2','背景色 2（渐变用）','color')}${bind('bgImage','背景图片 URL')}`;
      break;
    case 'profile':{
      const bp=b;
      if(!Array.isArray(bp.characters)||!bp.characters.length)bp.characters=[{name:'',desc:'',tags:'',avatar:''}];
      const build=()=>{
        let h=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:0 0 8px">📌 角色信息直接填写即可（支持宏），可添加多个角色，每个角色渲染为一张简介卡；角色超过 2 个时自动折叠——仅显示名字列表，点击名字展开完整卡片（预览与导出一致）。</div>`;
        bp.characters.forEach((ch,ci)=>{
          h+=`<div style="border:1px dashed var(--line);border-radius:8px;padding:8px 10px;margin:8px 0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
              <strong style="font-size:12px;color:var(--acc)">角色 ${ci+1}</strong><span style="flex:1"></span>
              ${bp.characters.length>1?`<button type="button" class="btn danger small" data-chardel="${ci}">删除</button>`:''}
            </div>
            <div class="row2">
              <div><label>名字（支持宏）</label><input data-charf="${ci}.name" value="${esc(ch.name)}"></div>
              <div><label>立绘/头像图片 URL</label><input data-charf="${ci}.avatar" value="${esc(ch.avatar)}" placeholder="https://..."></div>
            </div>
            <div><label>标签（逗号分隔，支持宏）</label><input data-charf="${ci}.tags" value="${esc(ch.tags)}" placeholder="标签1,标签2"></div>
            <div><label>简介（支持宏）</label></div>
            <div><textarea data-charf="${ci}.desc" placeholder="角色简介…">${esc(ch.desc)}</textarea></div>
          </div>`;
        });
        h+=`<button type="button" class="btn ghost small" data-charadd="1" style="margin:2px 0 10px">＋ 添加角色</button>`;
        h+=`<div class="row2">${chk('showAvatar','显示立绘/头像')}${chk('avatarRound','头像圆形（否则矩形立绘）')}</div>
          <div class="row2">${chk('showName','显示名字')}${chk('showDesc','显示简介')}</div>
          ${chk('showTags','显示标签')}`;
        container.innerHTML=h;
      };
      build();
      bindListEditor(container,bp.characters,{
        delAttr:'chardel',addAttr:'charadd',fieldAttr:'charf',build,
        confirmMsg:'确定删除该角色？',
        createItem:()=>({name:'{{char}}',desc:'',tags:'',avatar:''}),
        afterDel:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterAdd:()=>{Project.save();Project.saveSnapshot()},
        afterInput:()=>{UI.debouncedPreview();Project.saveDebounced()}
      });
      break;
    }
    case 'disclaimer':
      html=`<div><label>样式</label><select data-bkey="${i}.style"><option value="collapse"${b.style==='collapse'?' selected':''}>可折叠</option><option value="plain"${b.style==='plain'?' selected':''}>小字直显</option></select></div>${area('text','声明文本（支持宏）')}`;
      break;
    case 'quote':{
      const presets=BLOCK_PRESETS.quote||[];
      html=(presets.length?`<div style="margin:0 0 8px"><label>📋 套用预设</label><select data-gpreset="quote"><option value="">选择预设模板…</option>${presets.map((p,pi)=>`<option value="${pi}">${esc(p.name)}</option>`).join('')}</select></div>`:'')
        +`${area('text','引言文本（支持宏）')}${bind('source','署名（可选，显示为「—— xxx」)')}`;
      break;
    }
    case 'gallery':{
      if(!Array.isArray(b.images))b.images=[];
      const build=()=>{
        let h=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 图片加载失败会自动隐藏；点击图片可全屏放大预览（点空白处或 Esc 关闭），导出后同样有效。</div>
          <div class="row2"><div><label>每行列数</label><select data-bkey="${i}.cols">
          ${['2','3','4'].map(c=>`<option value="${c}"${String(b.cols)===c?' selected':''}>${c} 列</option>`).join('')}</select></div><div></div></div>`;
        b.images.forEach((im,gi)=>{
          h+=`<div style="display:grid;grid-template-columns:1fr 110px 30px;gap:6px;margin:4px 0;align-items:center">
            <input data-glf="${gi}.url" value="${esc(im.url)}" placeholder="图片 URL https://...">
            <input data-glf="${gi}.cap" value="${esc(im.cap??'')}" placeholder="说明(可选)">
            <button type="button" data-gldel="${gi}" style="background:none;border:none;color:var(--err);font-size:14px">✕</button></div>`;
        });
        h+=`<button type="button" class="btn ghost small" data-gladd="1" style="margin-top:6px">＋ 添加图片</button>`;
        container.innerHTML=h;
      };
      build();
      bindListEditor(container,b.images,{
        delAttr:'gldel',addAttr:'gladd',fieldAttr:'glf',build,
        confirmMsg:'删除该图片？',
        createItem:()=>({url:'',cap:''}),
        afterDel:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterAdd:()=>{Project.save();Project.saveSnapshot()},
        afterInput:()=>{UI.debouncedPreview();Project.saveDebounced()}
      });
      break;
    }
    case 'author':
      html=`<div><label>样式</label><select data-bkey="${i}.style"><option value="collapse"${b.style==='collapse'?' selected':''}>可折叠</option><option value="plain"${b.style==='plain'?' selected':''}>直显</option></select></div>${area('text','内容（支持宏，可换行）')}`;
      break;
    case 'divider':
      html=`<div><label>样式</label><select data-bkey="${i}.style">
          <option value="diamond"${b.style==='diamond'?' selected':''}>菱形渐变线 ◆</option>
          <option value="dots"${b.style==='dots'?' selected':''}>星点 ✦ ✦ ✦</option>
          <option value="flowers"${b.style==='flowers'?' selected':''}>花朵线 ❀</option>
          <option value="wave"${b.style==='wave'?' selected':''}>波浪线 〰</option>
          <option value="gradient-thick"${b.style==='gradient-thick'?' selected':''}>粗渐变条</option>
          <option value="plain"${b.style==='plain'||!b.style?' selected':''}>纯渐变线</option>
        </select></div>
        ${bind('text','中间文字（可选，留空则使用默认符号）')}`;
      break;
    case 'greetings':
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 酒馆运行时以<strong>角色卡当前开场白</strong>（<code>getCharacter('current').first_messages</code>）为准实时渲染——卡里删掉的开场白立即从列表消失；点击跳转时自动把新增开场白同步进聊天第 0 楼再切换。选项显示<strong>标题 + 描述预览</strong>：默认自动提取（首行作标题），配置标题库世界书后按「序号|标题|描述」覆盖。</div>
        ${area('placeholderList','预览占位列表（每行一个，可用 ｜ 分隔标题与描述）')}
        <div class="row2">
          <div><label>标题库世界书名（可选）</label><input data-bkey="${i}.titleWb" value="${esc(b.titleWb||'')}" placeholder="留空则自动提取"></div>
          <div><label>标题库条目名 (comment)</label><input data-bkey="${i}.titleEntry" value="${esc(b.titleEntry||'开场白标题库')}"></div>
        </div>
        <div style="font-size:11px;color:var(--txt2);margin:4px 0">标题库条目内容每行格式：<code>序号|标题|描述</code>，序号从 1 开始（对应第 1 个开场白）。</div>
        <div><label>选项风格</label><select data-bkey="${i}.cardStyle">
          <option value="card"${b.cardStyle!=='list'?' selected':''}>卡片式（底色块 + 边框 + 悬浮位移）</option>
          <option value="list"${b.cardStyle==='list'?' selected':''}>列表式（左侧竖线 + 紧凑行）</option>
        </select></div>
        <div><label>点击行为</label><select data-bkey="${i}.clickAction">
          <option value="go"${b.clickAction!=='insert'&&b.clickAction!=='send'&&b.clickAction!=='button'?' selected':''}>点击选项 → 切换到对应开场白（推荐，直接跳转 swipe 分支）</option>
          <option value="insert"${b.clickAction==='insert'?' selected':''}>点击选项 → 填入输入框（/setinput）</option>
          <option value="send"${b.clickAction==='send'?' selected':''}>选中后点按钮 → 直接发送（/send）</option>
          <option value="button"${b.clickAction==='button'?' selected':''}>页内列表 + 注入酒馆按钮（输入序号快速跳转，极简页适用）</option>
        </select></div>
        ${bind('buttonText','按钮文字（发送模式发送钮 / 按钮模式注册钮名）')}`;
      break;
    case 'clockbar':
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 实时时钟栏：导出后由酒馆的 <code>{{weekday}}</code> <code>{{isotime}}</code> 宏动态显示当前时间。内容支持宏与内联 HTML（可用上方 🧚 图标选择器插入 FA 动效图标）。</div>
        ${area('text','栏内容（支持宏 + HTML）')}
        <div class="row2">
          <div><label>文字颜色</label><input type="color" data-bkey="${i}.color" value="${esc(b.color||'#87CEEB')}"></div>
          <div><label>字号 (px)</label><input type="number" data-bkey="${i}.size" value="${+b.size||15}" min="10" max="28"></div>
        </div>
        <div class="row2">
          <div><label>对齐</label><select data-bkey="${i}.align">
            <option value="center"${b.align==='center'?' selected':''}>居中</option>
            <option value="left"${b.align==='left'?' selected':''}>左对齐</option>
          </select></div>
          <div style="display:flex;align-items:end;padding-bottom:4px"><label class="inline-check"><input type="checkbox" data-bchk="${i}.glow" ${b.glow?'checked':''}>辉光效果</label></div>
        </div>`;
      break;
    case 'randomevent':{
      const presets=BLOCK_PRESETS.randomevent||[];
      /* 行内容导出不转义（允许富文本），与自由 HTML 同属自伤型风险，含脚本时提示 */
      const evScript=/<script/i.test(b.lines||'');
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 每行一条随机内容。「整组随机」导出时自动包装为酒馆的 <code>{{random::…}}</code> 宏——玩家每次打开/刷新开场白都会看到不同内容，营造「活」的世感。行内也可自己写宏。<br>⚠️ 行内避免使用 <code>::</code>（双冒号），导出会自动替换为兼容字符。</div>
        ${evScript?`<div style="font-size:11px;color:var(--err);margin:2px 0">⚠️ 行内容含脚本：预览与酒馆导出中以完整权限运行（与页面同源，可访问本地数据），勿粘贴不可信来源的代码</div>`:''}
        ${chk('showTitle','显示标题')}${b.showTitle?bind('title','标题'):''}
        ${presets.length?`<div style="margin:6px 0"><label>📋 套用预设</label><select data-gpreset="randomevent"><option value="">选择预设模板…</option>${presets.map((p,pi)=>`<option value="${pi}">${esc(p.name)}</option>`).join('')}</select></div>`:''}
        ${area('lines','随机内容（每行一条）')}
        <div><label>抽取模式</label><select data-bkey="${i}.pickMode">
          <option value="one"${b.pickMode==='one'||b.pickMode!=='line'&&b.pickMode!=='shuffle'?' selected':''}>整组随机：每次只显示其中一行（推荐做氛围/事件）</option>
          <option value="line"${b.pickMode==='line'?' selected':''}>全部显示：所有行都渲染（各行内的宏独立随机）</option>
          <option value="shuffle"${b.pickMode==='shuffle'?' selected':''}>全部随机排序：预览时打乱顺序（导出为固定顺序，酒馆宏无法整组乱序）</option>
        </select></div>`;
      break;
    }
    case 'dice':{
      const presets=BLOCK_PRESETS.dice||[];
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 导出为酒馆 <code>{{roll::表达式}}</code> 宏，骰子语法：<code>1d20</code>、<code>2d6+3</code>、<code>d100</code>。预览中点「↻ 刷新」可重掷。</div>
        ${presets.length?`<div style="margin:0 0 8px"><label>📋 套用预设</label><select data-gpreset="dice"><option value="">选择预设模板…</option>${presets.map((p,pi)=>`<option value="${pi}">${esc(p.name)}</option>`).join('')}</select></div>`:''}
        ${bind('label','判定名称')}
        ${bind('expr','骰子表达式','text','placeholder="1d20"')}
        <div><label>样式</label><select data-bkey="${i}.style">
          <option value="card"${b.style!=='plain'&&b.style!=='poker'&&b.style!=='rpg'?' selected':''}>卡片式（大数字展示）</option>
          <option value="plain"${b.style==='plain'?' selected':''}>胶囊式（紧凑小标签）</option>
          <option value="poker"${b.style==='poker'?' selected':''}>扑克牌（竖向卡片）</option>
          <option value="rpg"${b.style==='rpg'?' selected':''}>RPG 风（深色面板）</option>
        </select></div>`;
      break;
    }
    case 'countdown':
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 实时倒计时：导出后按<strong>访问者设备的本地时间</strong>每秒刷新；目标时间已过则显示完成文案。</div>
        ${bind('title','标题（可选）')}
        <div class="row2">
          <div><label>目标时间</label><input type="datetime-local" data-bkey="${i}.target" value="${esc(b.target||'')}"></div>
          <div><label>完成文案</label><input data-bkey="${i}.doneText" value="${esc(b.doneText||'')}" placeholder="时间到！"></div>
        </div>`;
      break;
    case 'timeline':
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 每行一个节点，格式：<code>标题|描述|状态</code>。状态：<code>done</code> 已完成（金色实心）、<code>current</code> 进行中（呼吸辉光）、<code>lock</code> 未解锁（半透明，默认）。</div>
        <div class="row2">${chk('showTitle','显示标题')}${b.showTitle?bind('title','标题'):'<div></div>'}</div>
        ${area('nodes','节点列表（每行一条）')}`;
      break;
    case 'freehtml':
      /* 含脚本时提示完整权限运行风险（自伤型：与酒馆真实环境一致） */
      const hasScript=/<script/i.test(b.html||'');
      html=`<div><label>自由 HTML（支持宏；可用 AI 助手生成）</label></div>
        ${hasScript?`<div style="font-size:11px;color:var(--err);margin:2px 0">⚠️ 内容含脚本：预览与酒馆导出中以完整权限运行（与页面同源，可访问本地数据），勿粘贴不可信来源的代码</div>`:''}
        <div><textarea data-bkey="${i}.html" style="min-height:140px;font-family:Consolas,monospace" placeholder="<div>自定义内容…</div>">${esc(b.html)}</textarea></div>
        <div style="margin-top:8px"><label>🧺 组件库（点击追加到内容末尾）</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${COMP_LIB.map((c,ci)=>`<button type="button" class="btn ghost small" data-comp="${ci}">${c.icon} ${c.name}</button>`).join('')}</div>
        </div>`;
      container.addEventListener('click',e=>{
        const ci=e.target.dataset.comp;
        if(ci===undefined||!COMP_LIB[+ci])return;
        const c=COMP_LIB[+ci];
        b.html=(b.html&&b.html.trim()?b.html.replace(/\s*$/,'')+'\n\n':'')+c.html+'\n';
        const ta=container.querySelector('textarea');
        if(ta)ta.value=b.html;
        UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot();
        toast('已插入组件：'+c.name);
      });
      break;
    case 'bgm':{
      if(!Array.isArray(b.tracks))b.tracks=[];
      const build=()=>{
        let h=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 音频播放器，支持 MP3 格式。🔁 亮起=循环播放当前曲目，暗色=播完自动切下一首。</div>
          ${bind('title','播放器标题')}
          <div class="row2">
            <div><label>音量 (0-100)</label><input type="number" min="0" max="100" data-bkey="${i}.volume" value="${+b.volume===0?0:(+b.volume||50)}"></div>
            <div><label>循环播放</label> <input type="checkbox" data-bchk="${i}.loop"${b.loop?' checked':''}></div>
          </div>
          <div><label>显示标题</label> <input type="checkbox" data-bchk="${i}.showTitle"${b.showTitle?' checked':''}></div>
          <div><label>酒馆命令集成</label> <input type="checkbox" data-bchk="${i}.useTavernCmd"${b.useTavernCmd?' checked':''}></div>
          <div style="margin-top:8px"><label>曲目列表</label></div>`;
        b.tracks.forEach((t,ti)=>{
          h+=`<div style="display:grid;grid-template-columns:120px 1fr 30px;gap:6px;margin:4px 0;align-items:center">
            <input data-bf="${ti}.name" value="${esc(t.name)}" placeholder="曲名">
            <input data-bf="${ti}.url" value="${esc(t.url)}" placeholder="音频 URL">
            <button type="button" data-btdel="${ti}" style="background:none;border:none;color:var(--err);font-size:14px">✕</button></div>`;
        });
        h+=`<button type="button" class="btn ghost small" data-btadd="1" style="margin-top:6px">＋ 添加曲目</button>`;
        container.innerHTML=h;
      };
      build();
      bindListEditor(container,b.tracks,{
        delAttr:'btdel',addAttr:'btadd',fieldAttr:'bf',build,
        confirmMsg:'删除该曲目？',
        createItem:()=>({name:'',url:''}),
        afterDel:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterAdd:()=>{UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot()},
        afterInput:()=>{UI.debouncedPreview();Project.saveDebounced()}
      });
      break;
    }
    case 'fx':{
      const effects=[['meteor','流星'],['bubble','气泡'],['note','音符'],['ember','余烬'],['fog','雾气'],['snow','雪花'],['firefly','萤火'],['petal','花瓣'],['star','星尘'],['rain','雨滴']];
      html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 粒子动效背景，自动遵循系统「减少动效」偏好设置。</div>
        <div><label>动效类型</label><select data-bkey="${i}.effect">
          ${effects.map(([k,v])=>`<option value="${k}"${b.effect===k?' selected':''}>${v}</option>`).join('')}
        </select></div>
        <div class="row2">
          <div><label>粒子数量 (5-100)</label><input type="number" min="5" max="100" data-bkey="${i}.count" value="${+b.count||30}"></div>
          <div><label>速度 (0.2-3)</label><input type="number" min="0.2" max="3" step="0.1" data-bkey="${i}.speed" value="${+b.speed||1}"></div>
        </div>
        <div><label>透明度 (0.1-1)</label><input type="number" min="0.1" max="1" step="0.1" data-bkey="${i}.opacity" value="${+b.opacity||0.8}"></div>`;
      break;
    }
    case 'qa':{
      if(!Array.isArray(b.groups))b.groups=[];
      const build=()=>{
        let h=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 问答折叠区：分组展示 Q&A，点击展开/收起，支持展开动画。默认全部折叠。</div>`;
        h+=`<div class="row2">${bind('title','区块标题')}${chk('showTitle','显示标题')}</div>`;
        h+=`<div style="margin-top:8px"><label>分组与问答</label></div>`;
        b.groups.forEach((grp,gi)=>{
          h+=`<div style="border:1px dashed var(--line);border-radius:8px;padding:8px 10px;margin:8px 0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <input data-qgf="${gi}.name" value="${esc(grp.name||'')}" placeholder="分组标题（可选）" style="flex:1">
              <span style="font-size:11px;color:var(--txt2)">组 #${gi+1}</span>
              <button type="button" class="btn danger small" data-qgdel="${gi}">删除组</button>
            </div>`;
          (Array.isArray(grp.items)?grp.items:[]).forEach((item,ii)=>{
            h+=`<div style="display:grid;grid-template-columns:1fr 1fr 30px;gap:6px;margin:4px 0;align-items:start">
              <input data-qif="${gi}.${ii}.q" value="${esc(item.q||'')}" placeholder="问题">
              <input data-qif="${gi}.${ii}.a" value="${esc(item.a||'')}" placeholder="回答">
              <button type="button" data-qidel="${gi}.${ii}" style="background:none;border:none;color:var(--err);font-size:14px">✕</button></div>`;
          });
          h+=`<button type="button" class="btn ghost small" data-qiadd="${gi}" style="margin-top:4px">＋ 添加问答</button></div>`;
        });
        h+=`<button type="button" class="btn ghost small" data-qgadd="1" style="margin-top:4px">＋ 添加分组</button>`;
        container.innerHTML=h;
      };
      build();
      container.addEventListener('click',async e=>{
        if(e.target.dataset.qgadd){
          b.groups.push({name:'',items:[{q:'',a:''}]});build();UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot();
        }
        if(e.target.dataset.qgdel!==undefined){
          b.groups.splice(+e.target.dataset.qgdel,1);build();UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot();
        }
        if(e.target.dataset.qiadd!==undefined){
          const gi=+e.target.dataset.qiadd;
          if(!Array.isArray(b.groups[gi].items))b.groups[gi].items=[];
          b.groups[gi].items.push({q:'',a:''});build();UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot();
        }
        if(e.target.dataset.qidel){
          const[gi,ii]=e.target.dataset.qidel.split('.');
          b.groups[+gi].items.splice(+ii,1);build();UI.debouncedPreview();UI.renderExport();Project.save();Project.saveSnapshot();
        }
      });
      container.addEventListener('input',e=>{
        const gf=e.target.dataset.qgf;
        if(gf!==undefined){const[gi,k]=gf.split('.');b.groups[+gi][k]=e.target.value;UI.debouncedPreview();Project.saveDebounced()}
        const qif=e.target.dataset.qif;
        if(qif!==undefined){const[gi,ii,k]=qif.split('.');b.groups[+gi].items[+ii][k]=e.target.value;UI.debouncedPreview();Project.saveDebounced()}
      });
      break;
    }
  }
  if(html)container.innerHTML=html;
  /* 预设模板下拉框 */
  container.addEventListener('change',e=>{
    const gp=e.target.dataset.gpreset;
    if(gp===undefined||!BLOCK_PRESETS[gp])return;
    const pi=+e.target.value;
    if(isNaN(pi)||!BLOCK_PRESETS[gp][pi])return;
    const preset=BLOCK_PRESETS[gp][pi];
    Object.keys(preset.data).forEach(k=>{Project.cur.blocks[i][k]=preset.data[k]});
    UI.renderConfig();UI.renderExport();UI.refreshPreview();Project.save();Project.saveSnapshot();
    toast('已套用预设：'+preset.name);
  });
  container.addEventListener('input',e=>{
    const bk=e.target.dataset.bkey;
    if(bk!==undefined){
      const[a,c]=bk.split('.');
      /* number 型输入按数值入库（合法 0 保留），避免下游直接比较时踩字符串坑 */
      const v=e.target.type==='number'?(e.target.value!==''&&Number.isFinite(+e.target.value)?+e.target.value:e.target.value):e.target.value;
      Project.cur.blocks[+a][c]=v;
      this.debouncedPreview();Project.saveDebounced();
    }
  });
  container.addEventListener('change',e=>{
    const bc=e.target.dataset.bchk;
    if(bc!==undefined){const[a,c]=bc.split('.');Project.cur.blocks[+a][c]=e.target.checked;this.debouncedPreview();Project.saveDebounced();if(c==='showTitle')UI.renderConfig()}
  });
}
