/* UI 渲染与启动 */
import { $, $$, esc, toast, copyText, download, confirmModal, encryptApiKey, decryptApiKey } from './utils.js';
import { BLOCK_DEFS, BLOCK_ORDER, COMP_LIB, THEME_PRESETS, BLOCK_PRESETS } from './defs.js';
import { Project } from './project.js';
import { Gen } from './gen/index.js';
import { Macros } from './macros.js';

/* ================================================================
 * 通用列表编辑器：统一「添加 / 删除（带确认）/ 字段输入」事件委托，
 * 供 角色列表 / 图片列表 / 曲目列表 等单层可编辑列表复用
 * ================================================================ */
/**
 * @param {HTMLElement} container - 列表容器（事件委托挂载点）
 * @param {Array<object>} items - 绑定的数据数组（原地修改）
 * @param {object} opts
 * @param {string} opts.delAttr - 删除按钮 dataset 键，值为条目索引（如 chardel → data-chardel）
 * @param {string} opts.addAttr - 添加按钮 dataset 键（如 charadd → data-charadd）
 * @param {string} opts.fieldAttr - 字段输入 dataset 键，值格式 "索引.字段名"（如 charf → data-charf）
 * @param {Function} opts.build - 重建容器 HTML（增删后调用）
 * @param {string} [opts.confirmMsg] - 删除确认文案；缺省则不弹确认
 * @param {Function} opts.createItem - 新条目工厂函数
 * @param {Function} [opts.afterDel] - 删除后回调（build 之后）
 * @param {Function} [opts.afterAdd] - 添加后回调（build 之后）
 * @param {Function} [opts.afterInput] - 字段输入后回调
 */
function bindListEditor(container,items,{delAttr,addAttr,fieldAttr,build,confirmMsg,createItem,afterDel,afterAdd,afterInput}){
  container.addEventListener('click',async e=>{
    const d=e.target.dataset[delAttr];
    if(d!==undefined){
      if(confirmMsg&&!await confirmModal(confirmMsg))return;
      items.splice(+d,1);
      build();
      if(afterDel)afterDel();
      return;
    }
    if(e.target.dataset[addAttr]){
      items.push(createItem());
      build();
      if(afterAdd)afterAdd();
    }
  });
  container.addEventListener('input',e=>{
    const f=e.target.dataset[fieldAttr];
    if(f===undefined)return;
    const[idx,k]=f.split('.');
    if(!items[+idx])return;
    items[+idx][k]=e.target.value;
    if(afterInput)afterInput();
  });
}

/* 导出代码简易语法高亮：标签 / 属性 / 双引号字符串（纯正则，无外部依赖） */
function highlightCode(src){
  let s=src.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  /* 1. 字符串先占位，避免后续规则误伤 */
  const strs=[];
  s=s.replace(/"[^"\n]*"/g,m=>{strs.push("<span class='hl-str'>"+m+"</span>");return '\u0000'+(strs.length-1)+'\u0000'});
  /* 2. 标签名（排除 JS 比较符 a<b 场景：&lt; 前不能是标识符/右括号） */
  s=s.replace(/(?<![a-zA-Z0-9_$)\]}])(&lt;\/?)([a-zA-Z][\w-]*)/g,"$1<span class='hl-tag'>$2</span>");
  /* 3. 属性名（= 后紧跟字符串占位符才算属性，避免误伤 JS 赋值） */
  s=s.replace(/([\w-]+)(=\u0000)/g,"<span class='hl-attr'>$1</span>$2");
  /* 4. 还原字符串 */
  s=s.replace(/\u0000(\d+)\u0000/g,(_,i)=>strs[+i]);
  return s;
}

const UI={
  previewDebounce:null,
  _lastPreviewKey:'',

  renderAll(){
    Macros.vars={};
    this.renderProjectSelect();
    this.renderConfig();
    /* 各页隔离渲染：单页异常不影响其他页与预览 */
    try{this.renderExport()}catch(e){console.error('[导出页] 渲染失败',e);toast('导出页渲染失败：'+e.message)}
    try{this.renderAI()}catch(e){console.error('[AI页] 渲染失败',e);toast('AI 页渲染失败：'+e.message)}
    this.renderHelp();
    this.refreshPreview();
  },

  renderProjectSelect(){
    const sel=$('#projectSelect');sel.innerHTML='';
    Project.list.forEach(p=>{
      const o=document.createElement('option');o.value=p.id;o.textContent=p.name;
      if(p.id===Project.cur.id)o.selected=true;sel.appendChild(o);
    });
    sel.onchange=e=>Project.select(e.target.value);
  },

  /* ---------- 配置页 ---------- */
  renderConfig(){
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
        <div><label>圆角 (px)</label><input type="number" data-bind="theme.radius" value="${p.theme.radius}" min="0" max="40"></div>
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
    const COMMON_FONTS=['微软雅黑','黑体','宋体','楷体','仿宋','等线','思源黑体','思源宋体','霞鹜文楷','华文行楷','华文宋体','华文黑体','方正姚体','方正舒体','Arial','Verdana','Georgia','Times New Roman','Courier New','Impact','Trebuchet MS','Palatino Linotype','Lucida Console'];
    const baseFonts=['monospace','sans-serif','serif'];
    const testStr='测试FontabAB012';
    const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');
    function fontExists(f){
      for(const base of baseFonts){
        ctx.font=`72px "${f}",${base}`;const w1=ctx.measureText(testStr).width;
        ctx.font=`72px ${base}`;const w2=ctx.measureText(testStr).width;
        if(w1!==w2)return true;
      }
      return false;
    }
    const detected=COMMON_FONTS.filter(f=>fontExists(f));
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
      /* 自动展开新区块并滚动到可视区域 */
      const lastEl=blockList.lastElementChild;
      if(lastEl){
        lastEl.classList.remove('collapsed');
        expandedSet.add(newIdx);
        lastEl.scrollIntoView({behavior:'smooth',block:'center'});
      }
      toast('已添加：'+BLOCK_DEFS[t].name);
    });

    /* 拖拽排序：⠿ 把手触发，松开落点即交换顺序 */
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

    /* 触屏拖拽：长按 ⠿ 把手开始拖动，手指移动高亮落点，松手完成排序（桌面拖拽不受影响） */
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
        /* 长按前滑动 → 视为滚动意图，取消拖拽计时 */
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
      if(e.cancelable)e.preventDefault(); /* 抑制合成 click，避免拖完误触发折叠 */
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
      /* 保存当前展开状态 */
      expandedSet.clear();
      blockList.querySelectorAll('.block').forEach((el,i)=>{if(!el.classList.contains('collapsed'))expandedSet.add(i)});
      blockList.innerHTML='';
      /* 统计同类型区块数量，用于序号标签 */
      const typeCount={};
      Project.cur.blocks.forEach(b=>{typeCount[b.type]=(typeCount[b.type]||0)+1});
      const typeIdx={};
      const keyword=(searchBox.value||'').trim().toLowerCase();
      Project.cur.blocks.forEach((b,i)=>{
        const def=BLOCK_DEFS[b.type]||{icon:'❓',name:'未知区块（'+b.type+'）'};
        typeIdx[b.type]=(typeIdx[b.type]||0)+1;
        const seq=typeCount[b.type]>1?` <span class="block-seq">#${typeIdx[b.type]}</span>`:'';
        const el=document.createElement('div');
        el.className='block'+(b.enabled?'':' disabled')+(expandedSet.has(i)?'':' collapsed');
        el.innerHTML=`<div class="block-head">
            <span class="drag-handle" title="拖动调整顺序">⠿</span>
            <span class="arrow">▼</span>
            <label class="inline-check" style="margin:0"><input type="checkbox" data-block-en="${i}" ${b.enabled?'checked':''}></label>
            <span class="btitle">${def.icon} ${def.name}${seq}</span>
            <span class="ord"><button data-cp="${i}" title="复制此区块" style="color:var(--acc)">⧉</button><button data-mv="up" data-i="${i}" title="上移">↑</button><button data-mv="down" data-i="${i}" title="下移">↓</button><button data-bdel="${i}" title="删除此区块" style="color:var(--err)">✕</button></span>
          </div><div class="block-body"></div>`;
        this.renderBlockBody(el.querySelector('.block-body'),b,i);
        /* 点击 label/输入框/按钮不触发展开收起 */
        el.querySelector('.block-head').onclick=e=>{if(e.target.tagName==='INPUT'||e.target.closest('button')||e.target.closest('label'))return;el.classList.toggle('collapsed')};
        /* ⠿ 把手触发拖拽 */
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
    searchBox.addEventListener('input',()=>renderBlocks());

    /* ---- 全局搜索替换 ---- */
    const TEXT_FIELDS=['title','subtitle','text','html','lines','desc','source','label','expr','placeholderList','buttonText','titleEntry','titleWb','name','cap','url'];
    searchReplaceBtn.addEventListener('click',async()=>{
      const ov=document.createElement('div');
      ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483647;display:flex;align-items:center;justify-content:center';
      const box=document.createElement('div');
      box.style.cssText='background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px;width:min(520px,92vw);max-height:80vh;overflow:auto';
      box.innerHTML=`<div style="font-weight:700;margin-bottom:10px">🔄 全局搜索替换</div>
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
      let curIdx=-1;   /* 当前定位的 matches 索引 */

      /* 收集所有匹配项 */
      const collectMatches=()=>{
        const kw=findInp.value.trim();
        if(!kw){matches=[];return}
        const lkw=kw.toLowerCase();
        matches=[];
        Project.cur.blocks.forEach((b,bi)=>{
          TEXT_FIELDS.forEach(k=>{
            if(typeof b[k]==='string'&&b[k].toLowerCase().includes(lkw))
              matches.push({blockIdx:bi,path:`区块 #${bi+1}`,field:k,subIdx:-1,subField:k});
          });
          if(Array.isArray(b.characters))b.characters.forEach((ch,ci)=>{
            ['name','desc','tags','avatar'].forEach(k=>{
              if(typeof ch[k]==='string'&&ch[k].toLowerCase().includes(lkw))
                matches.push({blockIdx:bi,path:`区块 #${bi+1} → 角色 ${ci+1}`,field:k,subIdx:ci,subField:k,parent:'characters'});
            });
          });
          if(Array.isArray(b.images))b.images.forEach((im,ii)=>{
            ['url','cap'].forEach(k=>{
              if(typeof im[k]==='string'&&im[k].toLowerCase().includes(lkw))
                matches.push({blockIdx:bi,path:`区块 #${bi+1} → 图片 ${ii+1}`,field:k,subIdx:ii,subField:k,parent:'images'});
            });
          });
          if(Array.isArray(b.tracks))b.tracks.forEach((tr,ti)=>{
            ['name','url'].forEach(k=>{
              if(typeof tr[k]==='string'&&tr[k].toLowerCase().includes(lkw))
                matches.push({blockIdx:bi,path:`区块 #${bi+1} → 曲目 ${ti+1}`,field:k,subIdx:ti,subField:k,parent:'tracks'});
            });
          });
          if(Array.isArray(b.groups))b.groups.forEach((grp,gi)=>{
            if(typeof grp.name==='string'&&grp.name.toLowerCase().includes(lkw))
              matches.push({blockIdx:bi,path:`区块 #${bi+1} → QA组 ${gi+1}`,field:'name',subIdx:gi,subField:'name',parent:'groups'});
            (Array.isArray(grp.items)?grp.items:[]).forEach((item,ii)=>{
              ['q','a'].forEach(k=>{
                if(typeof item[k]==='string'&&item[k].toLowerCase().includes(lkw))
                  matches.push({blockIdx:bi,path:`区块 #${bi+1} → QA组 ${gi+1} #${ii+1}`,field:k,subIdx:`${gi}.${ii}`,subField:k,parent:'groups.items'});
              });
            });
          });
        });
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
        /* 定位到匹配项：展开对应区块并滚动 */
        const m=matches[curIdx];
        expandedSet.add(m.blockIdx);
        renderBlocks();
        const blockEls=blockList.querySelectorAll('.block');
        const target=blockEls[m.blockIdx];
        if(target){
          target.classList.remove('collapsed');
          target.scrollIntoView({behavior:'smooth',block:'center'});
          /* 高亮闪烁 */
          target.style.transition='outline 0.2s';
          target.style.outline='2px solid var(--acc)';
          setTimeout(()=>{target.style.outline=''},1200);
        }
      };

      findInp.addEventListener('input',()=>{
        collectMatches();curIdx=-1;updateUI();
      });
      prevBtn.addEventListener('click',()=>{if(curIdx>0){curIdx--;updateUI()}});
      nextBtn.addEventListener('click',()=>{if(curIdx<matches.length-1){curIdx++;updateUI()}});

      /* 替换单个 */
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
          return b;
        };
        const target=getTarget();
        if(target&&typeof target[m.subField]==='string'){
          /* 函数替换器：替换串按字面量处理，$&/$1 等不被解释为正则替换模式 */
          target[m.subField]=target[m.subField].replace(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),()=>repl);
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
        const replaceIn=(str)=>{
          if(typeof str!=='string')return str;
          return str.replace(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),()=>repl);
        };
        Project.cur.blocks.forEach(b=>{
          TEXT_FIELDS.forEach(k=>{if(typeof b[k]==='string')b[k]=replaceIn(b[k])});
          if(Array.isArray(b.characters))b.characters.forEach(ch=>{
            ['name','desc','tags','avatar'].forEach(k=>{if(typeof ch[k]==='string')ch[k]=replaceIn(ch[k])});
          });
          if(Array.isArray(b.images))b.images.forEach(im=>{
            ['url','cap'].forEach(k=>{if(typeof im[k]==='string')im[k]=replaceIn(im[k])});
          });
          if(Array.isArray(b.tracks))b.tracks.forEach(tr=>{
            ['name','url'].forEach(k=>{if(typeof tr[k]==='string')tr[k]=replaceIn(tr[k])});
          });
          if(Array.isArray(b.groups))b.groups.forEach(grp=>{
            if(typeof grp.name==='string')grp.name=replaceIn(grp.name);
            (Array.isArray(grp.items)?grp.items:[]).forEach(item=>{
              ['q','a'].forEach(k=>{if(typeof item[k]==='string')item[k]=replaceIn(item[k])});
            });
          });
        });
        const count=matches.length;
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
        if(!await confirmModal('确定删除该区块？（可通过底部「＋ 添加区块」重新添加）'))return;
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
      /* 主题预设一键套用 */
      col.addEventListener('click',e=>{
        const pi=e.target.dataset.preset;
        if(pi===undefined||!THEME_PRESETS[+pi])return;
        const t=THEME_PRESETS[+pi].theme;
        Object.keys(t).forEach(k=>{Project.cur.theme[k]=t[k]});
        UI.renderConfig();UI.refreshPreview();Project.save();
        toast('已套用预设：'+THEME_PRESETS[+pi].name);
      });
    }

    /* 实时预览面板（配置页右侧 + 预览页共用渲染） */
    this.mountPreview($('#livePreviewSlot'));
    if($('#pagePreview .preview-col'))this.mountPreview($('#pagePreview .preview-col'));
  },

  renderBlockBody(container,b,i){
    const p=Project.cur;
    const bind=(key,label,type='text',extra='')=>`<div><label>${label}</label>${type==='text'?`<input type="text" data-bkey="${i}.${key}" value="${esc(b[key]??'')}" ${extra}>`:`<input type="${type}" data-bkey="${i}.${key}" value="${esc(b[key]??'')}" ${extra}>`}</div>`;
    const area=(key,label,ph='')=>`<div><label>${label}</label><textarea data-bkey="${i}.${key}" placeholder="${ph}">${esc(b[key]??'')}</textarea></div>`;
    const chk=(key,label)=>`<label class="inline-check"><input type="checkbox" data-bchk="${i}.${key}" ${b[key]?'checked':''}>${label}</label>`;
    const get=k=>e=>{const[a,c]=e.target.dataset.bkey.split('.');Project.cur.blocks[+a][c]=e.target.value;UI.debouncedPreview();Project.save()};
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
          afterDel:()=>{UI.debouncedPreview();UI.renderExport();Project.save()},
          afterAdd:()=>{Project.save()},
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
          afterDel:()=>{UI.debouncedPreview();UI.renderExport();Project.save()},
          afterAdd:()=>{Project.save()},
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
          ${area('placeholderList','预览占位列表（每行一个，可用 ｜ 分隔标题与描述）','',true)}
          <div class="row2">
            <div><label>标题库世界书名（可选）</label><input data-bkey="${i}.titleWb" value="${esc(b.titleWb||'')}" placeholder="留空则自动提取"></div>
            <div><label>标题库条目名 (comment)</label><input data-bkey="${i}.titleEntry" value="${esc(b.titleEntry||'开场白标题库')}"></div>
          </div>
          <div><label>选项风格</label><select data-bkey="${i}.cardStyle">
            <option value="card"${b.cardStyle!=='list'?' selected':''}>卡片式（底色块 + 边框 + 悬浮位移）</option>
            <option value="list"${b.cardStyle==='list'?' selected':''}>列表式（左侧竖线 + 紧凑行）</option>
          </select></div>
          <div><label>点击行为</label><select data-bkey="${i}.clickAction">
            <option value="go"${b.clickAction!=='insert'&&b.clickAction!=='send'?' selected':''}>点击选项 → 切换到对应开场白（推荐，直接跳转 swipe 分支）</option>
            <option value="insert"${b.clickAction==='insert'?' selected':''}>点击选项 → 填入输入框（/setinput）</option>
            <option value="send"${b.clickAction==='send'?' selected':''}>选中后点按钮 → 直接发送（/send）</option>
          </select></div>
          ${bind('buttonText','发送模式按钮文字')}`;
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
        html=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 每行一条随机内容。导出时自动包装为酒馆的 <code>{{random::…}}</code> 宏——玩家每次打开/刷新开场白都会看到不同内容，营造「活」的世感。行内也可自己写宏。<br>⚠️ 行内避免使用 <code>::</code>（双冒号），导出会自动替换为兼容字符。</div>
          ${chk('showTitle','显示标题')}${b.showTitle?bind('title','标题'):''}
          ${presets.length?`<div style="margin:6px 0"><label>📋 套用预设</label><select data-gpreset="randomevent"><option value="">选择预设模板…</option>${presets.map((p,pi)=>`<option value="${pi}">${esc(p.name)}</option>`).join('')}</select></div>`:''}
          ${area('lines','随机内容（每行一条）')}
          <div><label>抽取模式</label><select data-bkey="${i}.pickMode">
            <option value="one"${b.pickMode==='one'||b.pickMode!=='line'&&b.pickMode!=='shuffle'?' selected':''}>整组随机：每次只显示其中一行（推荐做氛围/事件）</option>
            <option value="line"${b.pickMode==='line'?' selected':''}>全部显示：所有行都渲染（各行内的宏独立随机）</option>
            <option value="shuffle"${b.pickMode==='shuffle'?' selected':''}>全部随机排序：显示所有行但每次顺序打乱</option>
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
      case 'freehtml':
        html=`<div><label>自由 HTML（支持宏；可用 AI 助手生成）</label></div>
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
          UI.debouncedPreview();Project.save();
          toast('已插入组件：'+c.name);
        });
        break;
      case 'bgm':{
        if(!Array.isArray(b.tracks))b.tracks=[];
        const build=()=>{
          let h=`<div style="font-size:11px;color:var(--txt2);background:var(--panel2);border-radius:6px;padding:8px;margin:6px 0">📌 音频播放器，支持 MP3 格式。🔁 亮起=循环播放当前曲目，暗色=播完自动切下一首。</div>
            ${bind('title','播放器标题')}
            <div class="row2">
              <div><label>音量 (0-100)</label><input type="number" min="0" max="100" data-bkey="${i}.volume" value="${+b.volume||50}"></div>
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
          afterDel:()=>{UI.debouncedPreview();Project.save()},
          afterAdd:()=>{UI.debouncedPreview();Project.save()},
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
            b.groups.push({name:'',items:[{q:'',a:''}]});build();UI.debouncedPreview();UI.renderExport();Project.save();
          }
          if(e.target.dataset.qgdel!==undefined){
            b.groups.splice(+e.target.dataset.qgdel,1);build();UI.debouncedPreview();UI.renderExport();Project.save();
          }
          if(e.target.dataset.qiadd!==undefined){
            const gi=+e.target.dataset.qiadd;
            if(!Array.isArray(b.groups[gi].items))b.groups[gi].items=[];
            b.groups[gi].items.push({q:'',a:''});build();UI.debouncedPreview();UI.renderExport();Project.save();
          }
          if(e.target.dataset.qidel){
            const[gi,ii]=e.target.dataset.qidel.split('.');
            b.groups[+gi].items.splice(+ii,1);build();UI.debouncedPreview();UI.renderExport();Project.save();
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
      if(bk!==undefined){const[a,c]=bk.split('.');Project.cur.blocks[+a][c]=e.target.value;this.debouncedPreview();Project.saveDebounced()}
    });
    container.addEventListener('change',e=>{
      const bc=e.target.dataset.bchk;
      if(bc!==undefined){const[a,c]=bc.split('.');Project.cur.blocks[+a][c]=e.target.checked;this.debouncedPreview();Project.saveDebounced()}
    });
  },

  /* ---------- 预览 ---------- */
  mountPreview(slot){
    if(!slot||slot.dataset.mounted)return;
    slot.dataset.mounted='1';
    slot.innerHTML=`<div id="previewWrap">
      <div id="previewToolbar">
        <div class="seg" id="segDevice">
          <button data-v="mobile">📱 手机</button><button data-v="pc">🖥 PC</button>
        </div>
        <div class="seg" id="segTheme">
          <button data-v="dark">🌙 暗色</button><button data-v="light">☀️ 亮色</button>
        </div>
        <span style="flex:1"></span>
        <button class="btn ghost small" id="btnRefresh">↻ 刷新（重掷随机宏）</button>
      </div>
      <div id="previewStage"><iframe id="previewFrame" sandbox="allow-scripts allow-same-origin"></iframe></div>
    </div>`;
    $('#segDevice',slot).addEventListener('click',e=>{if(e.target.dataset.v){Project.cur.preview.mode=e.target.dataset.v;this.refreshPreview();Project.save()}});
    $('#segTheme',slot).addEventListener('click',e=>{if(e.target.dataset.v){Project.cur.preview.theme=e.target.dataset.v;this.refreshPreview();Project.save()}});
    $('#btnRefresh',slot).addEventListener('click',()=>{this._lastPreviewKey='';this.refreshPreview()});
    $('#previewFrame',slot).addEventListener('load',()=>this.fitPreviewHeight($('#previewFrame',slot)));
  },

  fitPreviewHeight(frame){
    if(!frame)return;
    if(frame._previewRO){frame._previewRO.disconnect();frame._previewRO=null}
    if(!window.matchMedia('(max-width:900px)').matches){frame.style.height='';return}
    const doc=frame.contentDocument;
    if(!doc||!doc.body)return;
    const measure=()=>{
      if(!window.matchMedia('(max-width:900px)').matches){frame.style.height='';return}
      frame.style.height=Math.max(doc.documentElement.scrollHeight,doc.body.scrollHeight)+'px';
    };
    frame._previewRO=new ResizeObserver(measure);
    frame._previewRO.observe(doc.body);
    measure();
  },

  refreshPreview(){
    const p=Project.cur;if(!p)return;
    /* 只刷新当前活动页的预览，避免不可见 iframe 的重复重建开销 */
    const pg=$('.page.active');if(!pg)return;
    const frame=$('#previewFrame',pg);if(!frame)return;
    $$('#segDevice button',pg).forEach(b=>b.classList.toggle('active',b.dataset.v===p.preview.mode));
    $$('#segTheme button',pg).forEach(b=>b.classList.toggle('active',b.dataset.v===p.preview.theme));
    frame.style.width=p.preview.mode==='mobile'?'430px':'100%';
    this.fitPreviewHeight(frame);
    let comp;
    try{comp=Gen.build(p,{isPreview:true})}
    catch(e){
      console.error('[预览] 生成失败',e);
      frame.srcdoc=`<!DOCTYPE html><html><body style="background:#14161c;color:#e06c5c;font:13px/1.7 sans-serif;padding:16px;white-space:pre-wrap">⚠️ 预览生成失败：${esc(e.message)}</body></html>`;
      return;
    }
    /* 增量更新：内容+主题未变则跳过 iframe 重建（完整内容比对，避免长文本尾部改动被漏判） */
    const key=comp+'\u0000'+p.preview.theme;
    if(key===this._lastPreviewKey)return;
    this._lastPreviewKey=key;
    const tavernVars=p.preview.theme==='light'
      ?'--SmartThemeBodyColor:#eee;--SmartThemeQuoteColor:#ccc'
      :'--SmartThemeBodyColor:#2a2a35;--SmartThemeQuoteColor:#666';
    frame.srcdoc=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        :root{${tavernVars}}
        body{margin:0;padding:0;background:${p.preview.theme==='light'?'#f2f2f5':'#14161c'};min-height:100vh}
        .${Gen.prefix(p)}-root{padding:6px}
      </style></head><body>${comp}</body></html>`;
  },
  debouncedPreview(){clearTimeout(this.previewDebounce);this.previewDebounce=setTimeout(()=>this.refreshPreview(),300)},

  /* ---------- 导出页 ---------- */
  renderExport(){
    const p=Project.cur,col=$('#exportCol');col.innerHTML='';
    const comp=Gen.build(p,{isPreview:false});

    const box=(title,desc,content,safeName)=>{
      const d=document.createElement('div');d.className='card export-box';
      d.innerHTML=`<h3>${title} <span class="hint">${desc}</span></h3>
        <div class="export-actions">
          <button class="btn small" data-copy>📋 ${'复制代码'}</button>
          <button class="btn ghost small" data-dl>💾 下载 .html</button>
        </div><pre></pre>`;
      $('pre',d).innerHTML=highlightCode(content);
      $('[data-copy]',d).onclick=()=>copyText(content);
      $('[data-dl]',d).onclick=()=>download(`${p.name}-${safeName}.html`,content);
      col.appendChild(d);
    };

    box('① 开场白版','贴进 first_mes 或 alternate_greetings',comp,'开场白版');

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
      <div style="font-size:12px;color:var(--txt2);margin:10px 0 4px">使用：酒馆 → 扩展 → 正则（Regex）→ 导入下载的 JSON → 把上面的标记文本贴进开场白或世界书条目。渲染时正则会把标记替换为下方代码围栏包裹的完整页面（由酒馆助手渲染为 iframe）。</div>
      <pre></pre>`;
    $('pre',rx).innerHTML=highlightCode(Gen.regexScript(p).replaceString);
    $('#markerCopy',rx).onclick=()=>copyText($('#markerInput',rx).value.trim()||'【开场页】');
    $('#rxDownload',rx).onclick=()=>download(`regex-开场页-${p.name}.json`,JSON.stringify(Gen.regexScript(p),null,2));
    $('#markerInput',rx).addEventListener('change',e=>{
      p.marker=e.target.value.trim()||'【开场页】';
      Project.save();
      const ns=Gen.regexScript(p);
      $('pre',rx).innerHTML=highlightCode(ns.replaceString);
    });
    col.appendChild(rx);
  },

  /* ---------- AI 页 ---------- */
  renderAI(){
    const p=Project.cur,col=$('#aiCol');
    col.innerHTML=`
      <div class="card">
        <h3>🤖 AI 助手（可选）<span class="hint">OpenAI 兼容接口 · 仅本工具内使用，不写入导出代码</span></h3>
        <div class="row3">
          <div><label>API Base URL</label><input id="aiBase" value="${esc(p.ai.baseURL)}" placeholder="https://api.openai.com/v1"></div>
          <div><label>模型名</label><input id="aiModel" value="${esc(p.ai.model)}" placeholder="gpt-4o-mini / glm-4 等"></div>
          <div><label>Key 存储方式</label><select id="aiKeyMode">
            <option value="plain"${p.ai.keyMode!=='encrypted'&&p.ai.keyMode!=='none'?' selected':''}>明文保存</option>
            <option value="encrypted"${p.ai.keyMode==='encrypted'?' selected':''}>加密保存</option>
            <option value="none"${p.ai.keyMode==='none'?' selected':''}>不保存</option>
          </select></div>
        </div>
        <div id="aiKeyRow" style="margin-top:10px;display:flex;gap:12px;align-items:end">
          <div style="flex:2"><label>API Key</label><input id="aiKey" type="password" autocomplete="new-password" value="${p.ai.keyMode==='encrypted'?'（已加密，输入新 Key 则覆盖）':esc(p.ai.apiKey)}" placeholder="sk-..."></div>
          <div id="aiPassphraseRow" style="flex:1;${p.ai.keyMode==='encrypted'?'':'display:none'}"><label>保护密码</label><input id="aiPassphrase" type="password" placeholder="用于加密/解密 Key" autocomplete="new-password"></div>
        </div>
      </div>
      <div class="card">
        <h3>① 生成自由 HTML 区内容</h3>
        <div><label>描述你想要的内容（如：一个带角色好感度进度条的展示栏）</label>
        <textarea id="aiPrompt" style="min-height:70px" placeholder="例：生成一个音乐播放器样式的框，显示角色「正在收听」的歌曲名，带闪烁的音符装饰"></textarea></div>
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn" id="aiGenHtml">✨ 生成（写入自由 HTML 区）</button>
          <span style="align-self:center;font-size:12px;color:var(--txt2)">提示：生成后自动填入「自由 HTML 区」并启用该区块</span>
        </div>
      </div>
      <div class="card">
        <h3>② 主题风格调整</h3>
        <div><label>描述想要的风格（AI 输出配色/风格参数回填主题）</label>
        <textarea id="aiStylePrompt" style="min-height:56px" placeholder="例：赛博朋克霓虹风，紫色和青色为主"></textarea></div>
        <div style="margin-top:10px"><button class="btn" id="aiGenStyle">🎨 生成主题配色</button></div>
      </div>
      <div class="card">
        <h3>输出 <span id="aiStatus" class="status-dot"></span></h3>
        <div id="aiOut">（等待调用）</div>
      </div>`;

    const saveAi=()=>{p.ai.baseURL=$('#aiBase').value.trim();p.ai.model=$('#aiModel').value.trim();p.ai.keyMode=$('#aiKeyMode').value;Project.save()};
    ['aiBase','aiModel'].forEach(id=>$('#'+id,col).addEventListener('input',saveAi));

    /* keyMode 切换：显示/隐藏密码框 */
    $('#aiKeyMode',col).addEventListener('change',function(){
      p.ai.keyMode=this.value;Project.save();
      const passRow=$('#aiPassphraseRow',col);
      if(this.value==='encrypted'){passRow.style.display='';$('#aiKey',col).value='';$('#aiKey',col).placeholder='输入新 Key（覆盖旧 Key）'}
      else if(this.value==='none'){passRow.style.display='none';$('#aiKey',col).value='';$('#aiKey',col).placeholder='不保存，每次粘贴';$('#aiKey',col).disabled=true}
      else{passRow.style.display='none';$('#aiKey',col).disabled=false;$('#aiKey',col).value=esc(p.ai.apiKey);$('#aiKey',col).placeholder='sk-...'}
    });

    /* API Key 保存：根据模式处理 */
    $('#aiKey',col).addEventListener('change',async function(){
      const val=this.value.trim();if(!val)return;
      if(p.ai.keyMode==='encrypted'){
        const pass=$('#aiPassphrase',col).value.trim();
        if(!pass){toast('请先填写保护密码');this.value='';return}
        p.ai.keyEnc=await encryptApiKey(val,pass);
        p.ai.apiKey='';this.value='（已加密存储）';
        toast('Key 已加密保存');Project.save();
      }else if(p.ai.keyMode==='none'){
        p.ai.apiKey='';this.value='';toast('Key 不保存');
      }else{
        p.ai.apiKey=val;Project.save();
      }
    });

    /* 保护密码输入：验证解密 */
    $('#aiPassphrase',col)?.addEventListener('change',async function(){
      const pass=this.value.trim();if(!pass||!p.ai.keyEnc)return;
      const key=await decryptApiKey(p.ai.keyEnc,pass);
      if(key){toast('密码正确，Key 已解密可用');p.ai.apiKey=key}
      else{toast('❌ 密码错误，无法解密 Key');p.ai.apiKey=''}
      Project.save();
    });

    const SYS_HTML=`你是酒馆(SillyTavern)角色卡内嵌HTML组件工程师。只输出一段HTML/CSS代码，规则：
1. 输出一个最外层<div>，内部可含<style>，所有class必须以 "opg-ai-" 前缀命名；
2. 禁止使用全局选择器(如 *、body、html)、禁止 id 选择器、禁止外部资源/脚本依赖；
3. 不使用脚本标签(script标签)；配色和谐，适配暗色背景；
4. 只输出代码本身，不要解释，不要markdown代码块包裹。`;

    const SYS_STYLE=`你是UI配色设计师。根据用户描述输出一行JSON，字段：primary(主色hex)、accent(强调色hex)、textColor(文字色hex)、radius(圆角0-30数字)。只输出JSON，不要其他内容。`;

    async function call(apiSys,user){
      const out=$('#aiOut'),dot=$('#aiStatus');
      let apiKey=p.ai.apiKey;
      /* 加密模式：用保护密码解密 */
      if(p.ai.keyMode==='encrypted'&&p.ai.keyEnc){
        const pass=($('#aiPassphrase',col)?.value||'').trim();
        if(!pass){out.textContent='⚠️ 请先填写保护密码以解密 Key';dot.className='status-dot status-warn';return null}
        apiKey=await decryptApiKey(p.ai.keyEnc,pass);
        if(!apiKey){out.textContent='⚠️ 密码错误，无法解密 Key';dot.className='status-dot status-warn';return null}
      }
      if(!apiKey||!p.ai.baseURL){out.textContent='⚠️ 请先填写 API Base URL 和 Key';dot.className='status-dot status-warn';return null}
      dot.className='status-dot status-ok';out.textContent='';
      /* 超时保护：120 秒无响应自动中止，防止永久挂起 */
      const ac=new AbortController();
      let timer=setTimeout(()=>ac.abort(),120000);
      try{
        const res=await fetch(p.ai.baseURL.replace(/\/$/,'')+'/chat/completions',{
          method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
          body:JSON.stringify({model:p.ai.model||'gpt-4o-mini',stream:true,
            messages:[{role:'system',content:apiSys},{role:'user',content:user}]}),
          signal:ac.signal
        });
        if(!res.ok){throw new Error('HTTP '+res.status+' '+(await res.text()).slice(0,200))}
        const reader=res.body.getReader(),dec=new TextDecoder();let full='',buf='';
        while(true){
          const{done,value}=await reader.read();if(done)break;
          clearTimeout(timer);timer=setTimeout(()=>ac.abort(),120000);
          buf+=dec.decode(value,{stream:true});
          const lines=buf.split('\n');buf=lines.pop();
          for(const line of lines){
            const t=line.trim();if(!t.startsWith('data:'))continue;
            const d=t.slice(5).trim();if(d==='[DONE]')continue;
            try{const j=JSON.parse(d);const delta=j.choices?.[0]?.delta?.content||'';
              if(delta){full+=delta;out.textContent=full;out.scrollTop=out.scrollHeight}}catch(e){}
          }
        }
        dot.className='status-dot status-ok';
        return full;
      }catch(err){
        dot.className='status-dot status-err';
        out.textContent+='\n❌ 调用失败：'+(err.name==='AbortError'?'请求超时（120 秒无响应，已自动中止）':err.message);
        return null;
      }finally{clearTimeout(timer)}
    }

    $('#aiGenHtml',col).onclick=async()=>{
      const q=$('#aiPrompt',col).value.trim();if(!q){toast('请先描述想要的内容');return}
      const r=await call(SYS_HTML,q);if(!r)return;
      let code=r.trim().replace(/^```(html)?\s*/i,'').replace(/```\s*$/,'');
      const fb=p.blocks.find(b=>b.type==='freehtml');
      fb.html=code;fb.enabled=true;
      UI.renderConfig();UI.refreshPreview();Project.save();toast('已写入自由 HTML 区');
    };
    $('#aiGenStyle',col).onclick=async()=>{
      const q=$('#aiStylePrompt',col).value.trim();if(!q){toast('请先描述想要的风格');return}
      const r=await call(SYS_STYLE,q);if(!r)return;
      try{
        const m=r.match(/\{[\s\S]*\}/);const j=JSON.parse(m[0]);
        if(j.primary)p.theme.primary=j.primary;
        if(j.accent)p.theme.accent=j.accent;
        if(j.textColor)p.theme.textColor=j.textColor;
        if(j.radius!==undefined)p.theme.radius=Math.min(30,Math.max(0,+j.radius||12));
        UI.renderConfig();UI.refreshPreview();Project.save();toast('主题已回填');
      }catch(e){toast('AI 输出解析失败，请重试')}
    };
  },

  /* ---------- 说明页 ---------- */
  renderHelp(){
    $('.help-page').innerHTML=`
<h3>📖 使用说明</h3>

<h4>这是什么工具？</h4>
<p>生成可嵌入 SillyTavern（酒馆）角色卡的<strong>开场页组件</strong>——一个单段 HTML/CSS 代码片段，由酒馆助手（TavernHelper）在聊天中渲染。区块包括：欢迎标题、装饰背景、粒子动效、开场引言、动态时钟栏、随机事件区、掷骰判定区、角色简介（多角色）、问答折叠区、图片展示区、音频/BGM 播放区、开场白选择、分隔装饰线、免责声明、作者的话和自由 HTML，共 16 种，均可启用/停用/拖拽排序。</p>

<h4>快速上手</h4>
<ol>
  <li><strong>模板配置</strong>：调整主题配色，展开各区块填写内容、勾选启用、拖拽排序、一键复制区块；顶部搜索框可按名称筛选区块。右侧实时预览。</li>
  <li><strong>预览</strong>：切换 📱手机 / 🖥PC 宽度和 🌙暗色 / ☀️亮色 主题模拟；↻ 刷新会重掷 <code>{{random}}</code> 等随机宏。</li>
  <li><strong>导出</strong>：选择两种嵌入方式之一复制代码，粘贴到酒馆中。</li>
</ol>

<h4>快捷键</h4>
<ul>
  <li><strong>Ctrl+Z</strong>：撤销上一步操作（区块增删/排序/启用切换等，最多 20 步历史）</li>
  <li><strong>Ctrl+Shift+Z</strong>：重做</li>
  <li><strong>Ctrl+S</strong>：立即保存</li>
</ul>
<p>💡 在输入框内按 Ctrl+Z 走浏览器原生文本撤销，与区块级撤销互不干扰。</p>

<h4>搜索与批量替换</h4>
<ul>
  <li><strong>区块搜索</strong>：区块列表顶部搜索框按名称实时筛选区块，清空即恢复全部。</li>
  <li><strong>全局搜索替换</strong>：点「🔄 搜索替换」，输入关键词自动列出全部匹配（覆盖角色/图片/曲目/问答等子项）；用 ◀ ▶ 逐个定位并高亮所在区块，确认后「替换当前」或「替换全部」。误替换可用 Ctrl+Z 撤销。</li>
</ul>

<h4>区块预设</h4>
<p>欢迎标题、开场引言、随机事件、掷骰判定四类区块内置「📋 套用预设」下拉，一键填充常用风格模板（奇幻/赛博/校园/末日等），套用后仍可自由修改。</p>

<h4>区块详细说明</h4>

<h5>✨ 欢迎标题区</h5>
<p>主标题 + 副标题，支持 <code>{{char}}</code> 等宏。装饰风格可选：无、华丽辉光、故障风、荧光下划线、描边线框、双线夹注、书名括角『』、印章、丝带、渐变文字。</p>

<h5>🎨 装饰区</h5>
<p>控制整个开场页的背景和边框。背景类型：渐变、纯色、图片、噪点渐变。边框样式：实线、双线、虚线、点线、浮雕凹槽/凸脊、内嵌/外凸等。装饰花纹：星芒、分隔线、月相、花瓣、音符、爱心、波浪、菱形阵、自定义字符。</p>

<h5>💫 粒子动效区</h5>
<p>纯 JS+DOM 实现的 10 种粒子特效：流星、气泡、音符、余烬、雾气、萤火、花瓣、星辰、雨滴、星光。可调数量、速度、透明度。支持 <code>prefers-reduced-motion</code> 无障碍降级。</p>

<h5>📜 开场引言</h5>
<p>居中引号样式，支持宏。可添加署名（显示为「—— xxx」）。</p>

<h5>🕰️ 动态时钟栏</h5>
<p>实时时钟，支持宏：<code>{{weekday}}</code> 星期、<code>{{isotime}}</code> 时间、<code>{{date}}</code> 日期。默认格式：<code>◆ {{date}} · {{weekday}} · {{isotime}} ◆</code>。可配颜色、字号、对齐、辉光效果。内容支持内联 HTML（如 Font Awesome 图标 <code>&lt;i class="fa-solid fa-satellite-dish fa-spin"&gt;&lt;/i&gt;</code>）。</p>

<h5>🎲 随机事件区</h5>
<p>每行一条内容，三种抽取模式：</p>
<ul>
  <li><strong>整组随机</strong>：每次只显示其中一行，导出自动包装为 <code>{{random::…}}</code> 宏。</li>
  <li><strong>全部显示</strong>：所有行都渲染，各行内的宏独立随机。</li>
  <li><strong>全部随机排序</strong>：显示所有行但每次顺序打乱。</li>
</ul>
<p>⚠️ 行内避免使用 <code>::</code>（双冒号），导出会自动替换为兼容字符。</p>

<h5>🎯 掷骰判定区</h5>
<p>骰子语法：<code>1d20</code>、<code>2d6+3</code>、<code>d100</code>。导出为酒馆 <code>{{roll::表达式}}</code> 宏。四种样式：卡片式（大数字）、胶囊式（紧凑标签）、扑克牌（竖向卡片）、RPG 风（深色面板）。预览中点「↻ 刷新」可重掷。</p>

<h5>👤 角色简介</h5>
<p>支持多角色，手动填写名称、描述、标签、头像 URL。数据内嵌在生成代码里，无需世界书条目。角色超过 2 个时自动折叠为名字列表，点击名字即可展开该角色的完整卡片。</p>

<h5>❓ 问答折叠区</h5>
<p>分组展示 Q&A，标题可点击折叠/展开整个区块，默认折叠。每组可添加多个问答条目，每个问答也可单独展开/收起，带平滑动画和箭头旋转指示。支持宏，适合放置世界观 FAQ、角色 Q&A、新手指引等内容。</p>

<h5>🖼️ 图片展示区</h5>
<p>支持 2/3/4 列网格布局，可添加多张图片（URL + 说明）。点击图片可全屏放大预览，点空白处或 Esc 关闭。</p>

<h5>🎵 音频/BGM 播放区</h5>
<p>支持多曲目列表，可调音量、循环播放。循环模式：🔁 亮 = 循环当前曲目，🔁 暗 = 播完自动下一首。仅支持 MP3 格式。可选配合酒馆 <code>/playmusic</code> 命令。</p>

<h5>📋 开场白选择区</h5>
<p>运行时从 <code>getCharacter().first_messages</code> 动态渲染开场白列表，点击选项可直接切换到对应开场白。三种点击行为：</p>
<ul>
  <li><strong>切换到对应开场白</strong>（推荐）：点击即跳到该开场白。</li>
  <li><strong>填入输入框</strong>：<code>/setinput</code> 命令。</li>
  <li><strong>直接发送</strong>：选中后点按钮 <code>/send</code>。</li>
</ul>
<p>选项卡片显示标题和描述，支持自动提取或标题库世界书覆盖。</p>

<h5>➖ 分隔装饰线</h5>
<p>六种样式：菱形渐变线、星点、花朵线、波浪线、粗渐变条、纯渐变线。支持自定义中间文字。</p>

<h5>⚠️ 免责声明</h5>
<p>支持普通展示或折叠式（<code>&lt;details&gt;</code>）。</p>

<h5>✍️ 作者的话</h5>
<p>普通文本展示，支持宏。</p>

<h5>🧩 自由 HTML 区</h5>
<p>完全自由的 HTML 代码，支持宏。内置组件库可一键插入：进度条、标签组、引言框、信息卡片、音乐播放器、折叠面板、装饰分隔、公告栏、滚动文本框、状态行、AI 加载动画、心跳好感度条、随机台词框、折叠世界观面板。</p>

<h4>嵌入方式</h4>
<ul>
  <li><strong>开场白</strong>：把代码贴进 first_mes 或某条 alternate_greetings，玩家刷到该开场白即显示。</li>
  <li><strong>标记 + 正则</strong>：① 点「下载正则脚本 .json」，在酒馆 扩展 → 正则 → 导入；② 复制「标记文本」（默认 <code>【开场页】</code>）贴进某条开场白或世界书条目。标记文本可自定义。</li>
</ul>

<h4>宏支持（预览模拟）</h4>
<p><code>{{char}}</code> <code>{{user}}</code> <code>{{random::a::b}}</code> <code>{{random:a,b}}</code>（旧版逗号兼容） <code>{{pick::a::b}}</code> <code>{{roll::2d6+3}}</code> <code>{{setvar::k::v}}</code> <code>{{getvar::k}}</code> <code>{{time}}</code> <code>{{isotime}}</code> <code>{{date}}</code> <code>{{isodate}}</code> <code>{{weekday}}</code> 及自定义宏。导出代码中宏原样保留，由酒馆运行时替换。</p>

<h4>数据保存</h4>
<ul>
  <li>所有工程自动保存在浏览器 localStorage（多工程可切换/复制/删除），换浏览器用顶栏「导出/导入工程」迁移。顶栏「💾 保存」按钮可手动立即保存。</li>
  <li><strong>主题预设</strong>：主题风格卡片顶部内置 10 套成品配色（赛博朋克/和风/暗金/水墨等），一键套用后仍可微调。</li>
  <li><strong>我的模板</strong>：顶栏「存为模板」把当前工程保存为模板；「新建」时可选从模板起步。</li>
  <li>AI 助手为可选增强：接 OpenAI 兼容接口，可生成自由 HTML 区内容和主题配色；不填 Key 不影响其他功能。Key 存储支持三种模式：<strong>明文保存</strong>（本地 localStorage）、<strong>加密保存</strong>（AES-GCM 加密，需设保护密码）、<strong>不保存</strong>（每次粘贴）。公用电脑建议选「不保存」。</li>
</ul>

<h4>运行要求</h4>
<ul>
  <li>酒馆需安装<strong>酒馆助手（TavernHelper / JS-slash-runner）</strong>扩展并启用。无 API 环境下组件自动显示占位内容。</li>
  <li>角色简介区为手动填写，数据直接内嵌在生成代码里。图片展示区支持点击全屏放大预览。</li>
</ul>

<div class="author-mark" aria-hidden="true">🐧 西维纳尔·Civinar</div>
<div class="author-sign">————— 🐧 本工具由 <strong>西维纳尔·Civinar</strong> 原创制作 —————</div>`;
  },
};

/* ================================================================
 * 页签切换 + 启动
 * ================================================================ */
$$('#tabs .tab').forEach(t=>t.addEventListener('click',()=>{
  $$('#tabs .tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
  $$('.page').forEach(p=>p.classList.remove('active'));
  $('#'+t.dataset.page).classList.add('active');
  if(t.dataset.page==='pagePreview'){
    /* 隐藏状态下 srcdoc 相同赋值不会触发重载，激活预览页签时换新 iframe 强制渲染 */
    const f=$('#previewFrame',$('#pagePreview'));
    if(f){
      const n=document.createElement('iframe');
      n.id='previewFrame';n.setAttribute('sandbox','allow-scripts allow-same-origin');
      f.replaceWith(n);
      /* 新 iframe 无 srcdoc，必须清空增量 key，否则下方 refreshPreview 会因内容未变而跳过 → 预览页空白 */
      UI._lastPreviewKey='';
    }
  }
  /* 预览只刷活动页，切换页签后统一刷新当前页 */
  UI.refreshPreview();
}));

Project.load();
UI.renderAll();

/* ---- 全局键盘快捷键 ---- */
document.addEventListener('keydown',e=>{
  const tag=document.activeElement?.tagName;
  const inInput=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';
  /* Ctrl+S → 保存 */
  if(e.ctrlKey&&e.key==='s'){
    e.preventDefault();
    Project.save();toast('已保存');
    return;
  }
  /* Ctrl+Z → 撤销（输入框内不拦截，保留浏览器原生文本撤销） */
  if(e.ctrlKey&&!e.shiftKey&&e.key==='z'){
    if(!inInput&&Project.undo()){
      UI.refreshPreview();UI.renderExport();
    }
    return;
  }
  /* Ctrl+Shift+Z → 重做 */
  if(e.ctrlKey&&e.shiftKey&&(e.key==='z'||e.key==='Z')){
    if(!inInput&&Project.redo()){
      UI.refreshPreview();UI.renderExport();
    }
    return;
  }
});

export {UI};

