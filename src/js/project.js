/* 工程管理：存储 / 迁移 / 模板 */
import { esc, toast, uid, download, confirmModal, promptModal } from './utils.js';
import { BLOCK_DEFS, BLOCK_ORDER, BUILTIN_TEMPLATES, defaultProject, SCHEMA_VERSION } from './defs.js';
import { parseCardFile, buildPlan, applyImportPlan, toV2Card } from './cardImport.js';

/**
 * 工程对象（localStorage 持久化单元，id 同时作为生成组件的容器前缀）
 * @typedef {Object} ProjectData
 * @property {string} id - 唯一 id（容器前缀 opg-{id}）
 * @property {string} name - 工程名
 * @property {string} createdAt - 创建时间（ISO）
 * @property {number} schemaVersion - 工程数据 schema 版本（migrate 分段迁移锚点）
 * @property {string|null} updatedAt - 最近修改时间（save 触碰；null=从未编辑，展示回落 createdAt）
 * @property {{mode:string,text:string,img:string,primary:string,accent:string,fromSwipe:number}} backHome - 返回开场页脚本配置（空串=模板默认）
 * @property {string} marker - 正则脚本标记文本
 * @property {import('./defs.js').ThemeConfig} theme - 主题配置
 * @property {import('./defs.js').Block[]} blocks - 区块列表（数组顺序即渲染顺序）
 * @property {import('./defs.js').Macro[]} macros - 自定义宏
 * @property {{baseURL:string,apiKey:string,model:string,models:string[],rememberKey:boolean}} ai - AI 助手配置（rememberKey=false 时 Key 仅存会话内存，不落盘）
 * @property {{mode:string,theme:string}} preview - 预览面板状态
 */

let _ui;
function setUI(ui){ _ui = ui; }

const Project={
  LS_KEY:'openingPageGen_v1_projects',
  LS_CUR:'openingPageGen_v1_current',
  TPL_KEY:'openingPageGen_v1_templates',
  /** @type {ProjectData[]} */
  list:[],
  /** @type {ProjectData|null} */
  cur:null,
  /** @type {ProjectData[]} */
  templates:[],
  /* ---- 撤销/重做历史栈 ---- */
  /* 快照以 JSON 字符串存储：去重直接比字符串，每次输入省一次 stringify + 一次 parse（大工程逐键输入的热路径） */
  _history:[],_historyIdx:-1,MAX_HISTORY:20,_inputBatch:false,
  /** 保存区块快照；默认结束输入批次，mergeInput 仅供 saveDebounced 合并连续输入 */
  saveSnapshot(mergeInput=false){
    const merge=mergeInput&&this._inputBatch;
    if(!mergeInput)this._inputBatch=false;
    if(!this.cur)return;
    const json=JSON.stringify({blocks:this.cur.blocks,theme:this.cur.theme});
    /* 无区块与主题变化的保存不占历史，也不能截断 redo 或开启输入合并 */
    if(json===this._history[this._historyIdx])return;
    this._history=this._history.slice(0,this._historyIdx+1);
    if(merge&&this._historyIdx>0)this._history[this._historyIdx]=json;
    else this._history.push(json);
    if(this._history.length>this.MAX_HISTORY)this._history.shift();
    this._historyIdx=this._history.length-1;
    this._inputBatch=mergeInput;
  },
  /** 从快照恢复（区块列表 + 主题；v1.24 起主题进撤销栈——主题卡此前是撤销盲区） */
  _restore(raw){
    if(!raw)return;
    /* 兼容对象形态快照（测试/旧调用方直接塞对象） */
    const s=typeof raw==='string'?JSON.parse(raw):JSON.parse(JSON.stringify(raw));
    this.cur.blocks=s.blocks||[];
    /* 旧格式快照（无 theme 键）保持当前主题不动 */
    if(s.theme)this.cur.theme=s.theme;
  },
  /** 撤销一步；无可撤销时返回 false。恢复后触发整个界面重渲染 */
  undo(){
    this._inputBatch=false;
    if(this._historyIdx<=0)return false;
    this._historyIdx--;
    this._restore(this._history[this._historyIdx]);
    _ui.renderAll();
    this.saveDebounced(false);
    return true;
  },
  /** 重做一步；无可重做时返回 false。恢复后触发整个界面重渲染 */
  redo(){
    this._inputBatch=false;
    if(this._historyIdx>=this._history.length-1)return false;
    this._historyIdx++;
    this._restore(this._history[this._historyIdx]);
    _ui.renderAll();
    this.saveDebounced(false);
    return true;
  },
  /** 清空并重建历史栈：切换/新建/导入/复制/删除工程后必须调用，
   *  否则上一工程的历史快照会被恢复进当前工程（跨工程数据污染） */
  resetHistory(){
    this._history=[];this._historyIdx=-1;
    this.saveSnapshot();
  },

  /* 分键存储（v1.27）：每个工程独占 openingPageGen_v1_proj_<id>，索引键存 id 顺序。
     旧版整表单键（LS_KEY）每次保存都要序列化全部工程，工程多/含大图时既慢又更快撞配额 */
  LS_INDEX:'openingPageGen_v1_projIndex',
  LS_PROJ:'openingPageGen_v1_proj_',
  /** 已落盘快照（id → JSON）：save 只写有变化的工程，未变的不重复 setItem */
  _written:new Map(),
  /** 读取工程列表：优先分键格式；无索引时读旧整表单键（迁移在随后的 save 中完成） */
  _readList(){
    /* localStorage 本身可能被浏览器禁用（隐私模式/权限策略）： getItem 直抛会杀死启动 */
    let idx=null;
    try{idx=JSON.parse(localStorage.getItem(this.LS_INDEX)||'null')}catch(e){}
    if(Array.isArray(idx)){
      this._legacy=false;
      return idx.map(id=>{
        try{return JSON.parse(localStorage.getItem(this.LS_PROJ+id)||'null')}
        catch(e){console.error('[工程] 损坏数据已跳过：'+id,e);return null}
      }).filter(p=>p&&typeof p==='object');
    }
    let raw=null;
    try{raw=localStorage.getItem(this.LS_KEY)}catch(e){}
    this._legacy=raw!=null;
    let list;
    try{list=JSON.parse(raw||'[]')}catch(e){list=[]}
    return Array.isArray(list)?list:[];
  },
  load(){
    this._written=new Map();this._writtenIdx=undefined;this._legacyStuck=false;this._lastCur=null;
    this.list=this._readList();
    /* 单工程损坏只剔除该工程并告警，不让一条坏数据拖死整个应用启动 */
    this.list=this.list.filter(p=>{
      try{this.migrate(p);return true}
      catch(e){console.error('[工程] 损坏数据已跳过：'+(p&&p.name||'?'),e);return false}
    });
    if(!this.list.length)this.list=[defaultProject('示例工程')];
    try{this.templates=JSON.parse(localStorage.getItem(this.TPL_KEY)||'[]')}catch(e){this.templates=[]}
    this.templates.forEach(t=>{
      try{this.migrate(t)}catch(e){console.error('[模板] 损坏数据已跳过',e)}
    });
    this.templates=this.templates.filter(t=>t&&typeof t==='object'&&Array.isArray(t.blocks));
    let curId=null;
    try{curId=localStorage.getItem(this.LS_CUR)}catch(e){}
    this.cur=this.list.find(p=>p.id===curId)||this.list[0];
    this._loading=true;this.save();this._loading=false;
    this.resetHistory();
  },
  /* 深度规范化：补齐工程/区块任意缺失字段，保证旧数据、导入数据、残缺数据都能渲染 */
  normalize(p){
    const def=defaultProject(p.name||'');
    if(!p.marker)p.marker=def.marker;
    if(!p.theme||typeof p.theme!=='object')p.theme={};
    /* 旧工程的 followTavern 布尔映射为新四路跟随开关的 text 项（必须在通用合并前，
       否则会被 def.theme.follow 的全 false 默认值覆盖导致跟随静默失效） */
    if(!p.theme.follow&&p.theme.followTavern)p.theme.follow={text:true,quote:false,font:false,em:false};
    delete p.theme.followTavern; /* 映射完成后清理死字段，避免每个工程都带着 */
    Object.keys(def.theme).forEach(k=>{if(p.theme[k]===undefined)p.theme[k]=def.theme[k]});
    if(!Array.isArray(p.macros))p.macros=[{k:'char',v:'{{char}}'},{k:'user',v:'{{user}}'}];
    if(!p.ai||typeof p.ai!=='object')p.ai={};
    delete p.ai.keyMode;delete p.ai.keyEnc; /* 旧版加密/不保存模式已移除，清理残留字段 */
    ['baseURL','apiKey','model','models','rememberKey'].forEach(k=>{if(p.ai[k]===undefined)p.ai[k]=def.ai[k]});
    if(!p.preview||typeof p.preview!=='object')p.preview={};
    ['mode','theme'].forEach(k=>{if(p.preview[k]===undefined)p.preview[k]=def.preview[k]});
    if(p.schemaVersion===undefined)p.schemaVersion=def.schemaVersion; /* 直调 normalize 的路径（模板/测试）补锚点；载入路径已由 migrate 先行升版 */
    /* 返回开场页脚本配置（v1.29）：子字段白名单补齐，fromSwipe 非法值回落 1 */
    if(!p.backHome||typeof p.backHome!=='object')p.backHome={};
    ['mode','text','img','primary','accent'].forEach(k=>{if(p.backHome[k]===undefined)p.backHome[k]=def.backHome[k]});
    const bfsw=+p.backHome.fromSwipe;if(!Number.isFinite(bfsw)||bfsw<1)p.backHome.fromSwipe=1;
    if(p.updatedAt===undefined)p.updatedAt=null;
    delete p.statusbar; /* 状态栏生成器已移除，清理旧存档/导入数据中的残留节点 */
    delete p.mvu; /* MVU 状态栏生成器已拆分为独立工具，清理旧存档残留节点 */
    if(!Array.isArray(p.blocks))p.blocks=[];
    /* 剔除损坏项：null/非对象条目会让下方 some/forEach 读 .type 时直接崩（启动路径无兜底） */
    p.blocks=p.blocks.filter(b=>b&&typeof b==='object');
    BLOCK_ORDER.forEach(t=>{
      if(!p.blocks.some(b=>b.type===t))p.blocks.push({type:t,enabled:false,...BLOCK_DEFS[t].create()});
    });
    p.blocks.forEach(b=>{
      const d=BLOCK_DEFS[b.type];
      if(!d)return;
      const proto=d.create();
      Object.keys(proto).forEach(k=>{if(b[k]===undefined)b[k]=proto[k]});
      if(b.type==='profile'&&!Array.isArray(b.characters))b.characters=[{name:'{{char}}',desc:'',tags:'',avatar:''}];
      if(b.type==='gallery'&&!Array.isArray(b.images))b.images=[];
      if(b.type==='greetings'&&!Array.isArray(b.entries))b.entries=[];
    });
  },
  /* 背景上收（v1.24）：theme.bg 归主题所有，旧数据/官方模板里 decor 的 bg 字段
     搬进 theme.bg 后从区块上剔除。上收源精确复刻 gen 旧行为——只看首个 decor 且
     仅在其启用时生效（未启用时旧渲染走扁平兜底）；缺失时补旧兜底色。
     必须先于 normalize 调用，否则 def.theme.bg 默认值会抢先填充导致旧背景丢失 */
  _hoistBg(p){
    if(!p.theme||typeof p.theme!=='object')p.theme={};
    if(p.theme.bg===undefined){
      const d=(p.blocks||[]).find(b=>b&&b.type==='decor');
      p.theme.bg=(d&&d.enabled&&d.bgType)
        ?{type:d.bgType,color:d.bgColor,color2:d.bgColor2,image:d.bgImage}
        :{type:'solid',color:'#14141e'};
    }
    (p.blocks||[]).forEach(b=>{if(b&&b.type==='decor')['bgType','bgColor','bgColor2','bgImage'].forEach(k=>delete b[k])});
  },
  /* 旧版工程结构迁移：角色简介区从「世界书拉取+占位值」迁移为「手动多角色」；
     无版本字段无法区分旧默认与主动选择，开场白点击行为仅在缺失时补 go。
     注意：旧字段转换必须先于 normalize —— normalize 会给缺 characters 的
     profile 注入默认值，若后跑会使旧占位迁移分支永远无法命中 */
  migrate(p){
    /* 版本锚点（v1.29）：缺字段视为 v1。v1→v2 无破坏性重排（引入锚点与 backHome/updatedAt，补齐交 normalize）；
       后续破坏性变换在此按 v 分段追加——常规新增字段优先走 normalize 白名单，不必次次升版本 */
    const v=+p.schemaVersion||1;
    if(v<SCHEMA_VERSION)console.info('[工程] schema v'+v+' → v'+SCHEMA_VERSION+'：'+(p.name||'?'));
    p.schemaVersion=SCHEMA_VERSION;
    this._hoistBg(p);
    (p.blocks||[]).forEach(b=>{
      if(b.type==='greetings'&&!b.clickAction)b.clickAction='go';
      if(b.type==='profile'&&!Array.isArray(b.characters)){
        b.characters=[{name:b.placeholderName||'{{char}}',desc:b.placeholderDesc||'',tags:b.placeholderTags||'',avatar:b.avatarUrl||''}];
        ['placeholderName','placeholderDesc','placeholderTags','avatarUrl','wbName','wbEntryComment','avatarFromWb'].forEach(k=>delete b[k]);
      }
    });
    this.normalize(p);
    p.blocks=(p.blocks||[]).filter(b=>BLOCK_DEFS[b.type]);
  },
  save(){
    /* 工厂重置后 reload 前的空窗期：任何触发保存的操作会把内存旧数据写回，直接短路 */
    if(this._resetting)return;
    if(this.cur&&!this._loading)this.cur.updatedAt=new Date().toISOString(); /* 统计行「最近修改」数据源；载入/迁移落盘不算修改 */
    /* 只序列化「当前 + 上次保存时的当前（切工程前的未落盘输入）+ 从未落盘的」工程，其余沿用已写快照 */
    const jsons=new Map();
    this.list.forEach(p=>{
      if(!p.id)p.id=uid();
      if(p===this.cur||p===this._lastCur||!this._written.has(p.id))jsons.set(p.id,JSON.stringify(p));
    });
    const kb=()=>(this.list.reduce((n,p)=>n+(jsons.get(p.id)??this._written.get(p.id)??'').length,0)/1024).toFixed(0);
    try{
      if(this._legacy&&!this._legacyStuck)this._migrateLegacy(jsons);
      else if(this._legacyStuck)localStorage.setItem(this.LS_KEY,JSON.stringify(this.list));
      else this._writeSplit(jsons);
      localStorage.setItem(this.LS_CUR,this.cur?.id||'');
      this._lastCur=this.cur;
    }catch(e){
      /* 配额超限（超大图片/HTML）或隐私模式禁写：显式报错 + 强提示（数据仅存内存，关闭即失） */
      clearTimeout(this._qTip);
      const size=kb(),big=this._biggest();
      console.error('[Project] localStorage 写入失败（工程数据约 '+size+' KB）:',e);
      this._qTip=setTimeout(()=>toast('⚠️ 保存失败（数据约 '+size+' KB，仅存于内存，关闭页面即丢失）'+(big?'——占用最大：'+big:'')+'。请精简内容或立即「导出工程」备份',8000),200);
    }
  },
  /** 分键写入：只 setItem 内容有变化的工程；索引变化才重写；已移出列表的工程删键 */
  _writeSplit(jsons){
    /* 缓存自愈：存储被外部改动（另一标签页/手动清空/重置）时索引对不上，作废缓存全量重写 */
    if(this._writtenIdx!==undefined&&localStorage.getItem(this.LS_INDEX)!==this._writtenIdx){
      this._written=new Map();this._writtenIdx=undefined;
      this.list.forEach(p=>{if(!jsons.has(p.id))jsons.set(p.id,JSON.stringify(p))});
    }
    jsons.forEach((json,id)=>{
      if(this._written.get(id)===json)return;
      localStorage.setItem(this.LS_PROJ+id,json);this._written.set(id,json);
    });
    const ids=this.list.map(p=>p.id),idxJson=JSON.stringify(ids);
    if(idxJson!==this._writtenIdx){localStorage.setItem(this.LS_INDEX,idxJson);this._writtenIdx=idxJson}
    [...this._written.keys()].forEach(id=>{
      if(ids.includes(id))return;
      try{localStorage.removeItem(this.LS_PROJ+id)}catch(e){}
      this._written.delete(id);
    });
  },
  /** 旧整表单键 → 分键：先写新键再删旧键；新旧并存撞配额时回滚新键，本会话继续沿用旧格式（数据不丢） */
  _migrateLegacy(jsons){
    try{
      this._writeSplit(jsons);
      localStorage.removeItem(this.LS_KEY);
      this._legacy=false;
    }catch(e){
      [...this._written.keys()].forEach(id=>{try{localStorage.removeItem(this.LS_PROJ+id)}catch(_){}});
      try{localStorage.removeItem(this.LS_INDEX)}catch(_){}
      this._written=new Map();this._writtenIdx=undefined;this._legacyStuck=true;
      console.error('[Project] 分键迁移空间不足，本会话沿用旧存储格式',e);
      localStorage.setItem(this.LS_KEY,JSON.stringify(this.list));
    }
  },
  /** 保存失败时定位占用：当前工程里体积最大的区块（多为内嵌 base64 图片 / 大段自由 HTML） */
  _biggest(){
    const p=this.cur;if(!p||!Array.isArray(p.blocks))return '';
    let best=null,max=0;
    p.blocks.forEach((b,i)=>{const n=JSON.stringify(b).length;if(n>max){max=n;best={b,i}}});
    if(!best||max<20*1024)return '';
    const d=BLOCK_DEFS[best.b.type];
    return `第 ${best.i+1} 个区块「${d?d.name:best.b.type}」约 ${(max/1024).toFixed(0)} KB`;
  },
  /* 区块输入立即入历史，避免紧接结构操作时丢失中间态；仅全工程落盘延迟 600ms */
  _svT:null,
  _resetting:false,
  saveDebounced(recordHistory=true){
    if(this._resetting)return;
    /* undo/redo 只落盘，不能把重渲染时的字段补齐当成新输入 */
    if(recordHistory)this.saveSnapshot(true);
    clearTimeout(this._svT);
    this._svT=setTimeout(()=>{this._svT=null;this._inputBatch=false;this.save()},600);
  },
  select(id){
    this.cur=this.list.find(p=>p.id===id)||this.list[0];
    this.save();this.resetHistory();_ui.renderAll();
  },

  /* ---------- 模板 ---------- */
  saveTemplates(){
    try{localStorage.setItem(this.TPL_KEY,JSON.stringify(this.templates))}
    catch(e){toast('⚠️ 模板保存失败：存储空间不足')}
  },
  saveAsTemplate(){
    const t=JSON.parse(JSON.stringify(this.cur));
    t.id=uid();t.createdAt=new Date().toISOString();
    this.templates.push(t);
    if(this.templates.length>30)this.templates.shift();
    this.saveTemplates();
    toast('已存为模板：'+t.name);
  },
  createFromTemplate(t,name){
    const p=JSON.parse(JSON.stringify(t));
    p.id=uid();p.name=name||t.name;p.createdAt=new Date().toISOString();
    this.migrate(p);
    this.list.push(p);this.cur=p;this.save();this.resetHistory();_ui.renderAll();
    toast('已从模板创建：'+p.name);
  },

  newProject(){
    const ov=document.createElement('div');
    ov.className='opg-ov'; /* 自绘弹层统一标记：core.js 的 Ctrl+Z/Esc 守卫借此识别「有弹层打开」 */
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;display:flex;align-items:center;justify-content:center';
    const box=document.createElement('div');
    box.style.cssText='background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px;width:min(480px,92vw);max-height:80vh;overflow:auto';
    let rows=`<div style="font-weight:700;margin-bottom:10px">📄 新建工程</div>
      <button type="button" class="btn ghost small" data-new="blank" style="width:100%;text-align:left;margin:4px 0">空白工程（默认区块布局）</button>
      <button type="button" class="btn ghost small" data-new="sample" style="width:100%;text-align:left;margin:4px 0">示例工程</button>
      <button type="button" class="btn ghost small" data-new="cardimport" style="width:100%;text-align:left;margin:4px 0">📥 从角色卡导入（PNG / JSON / CHARX → 反向生成工程）</button>`;
    if(BUILTIN_TEMPLATES.length)rows+=`<div style="font-size:12px;color:var(--txt2);margin:10px 0 4px">官方模板（一键套用完整布局）</div>`+
      BUILTIN_TEMPLATES.map((t,i)=>`<button type="button" class="btn ghost small" data-new="bt:${i}" style="width:100%;text-align:left;margin:4px 0">⭐ ${esc(t.name)}</button>`).join('');
    if(this.templates.length)rows+=`<div style="font-size:12px;color:var(--txt2);margin:10px 0 4px">我的模板（点击以模板创建，✕ 删除模板）</div>`;
    this.templates.forEach((t,i)=>{
      rows+=`<div style="display:flex;gap:6px;margin:4px 0"><button type="button" class="btn ghost small" data-new="${i}" style="flex:1;text-align:left">🧩 ${esc(t.name)}</button><button type="button" class="btn danger small" data-tdel="${i}">✕</button></div>`;
    });
    rows+=`<div style="text-align:right;margin-top:12px"><button type="button" class="btn ghost small" data-close>取消</button></div>`;
    box.innerHTML=rows;ov.appendChild(box);document.body.appendChild(ov);
    ov.addEventListener('click',async e=>{
      if(e.target===ov||e.target.dataset.close!==undefined){ov.remove();return}
      const td=e.target.dataset.tdel;
      if(td!==undefined){this.templates.splice(+td,1);this.saveTemplates();ov.remove();this.newProject();return}
      const nv=e.target.dataset.new;
      if(nv===undefined)return;
      if(nv==='blank'||nv==='sample'){
        ov.remove();
        const p=defaultProject(nv==='blank'?'新工程':'示例工程');
        this.normalize(p); /* 补齐后续新增的配置节 */
        this.list.push(p);this.cur=p;this.save();this.resetHistory();_ui.renderAll();toast('已创建工程');
        return;
      }
      if(nv==='cardimport'){ov.remove();this.openCardImport();return}
      /* 官方模板：bt:索引 */
      if(String(nv).startsWith('bt:')){
        const t=BUILTIN_TEMPLATES[+String(nv).slice(3)];
        if(!t)return;
        ov.remove();
        const name=await promptModal('工程名称：',t.name);
        if(name===null)return;
        const p=this.builtinTemplateProject(t,name.trim()||t.name);
        this.list.push(p);this.cur=p;this.save();this.resetHistory();_ui.renderAll();
        toast('已从官方模板创建：'+p.name);
        return;
      }
      const t=this.templates[+nv];
      if(!t)return;
      ov.remove();/* 先关弹窗再询问名称：取消命名时遮罩不应残留（与官方模板分支一致） */
      const name=await promptModal('工程名称：',t.name);
      if(name===null)return;
      this.createFromTemplate(t,name.trim()||t.name);
    });
  },
  /* 官方模板 → 完整工程对象（补齐 id/时间/预览等运行字段后再 normalize） */
  builtinTemplateProject(t,name){
    const p={
      id:uid(),name:name||t.name,createdAt:new Date().toISOString(),
      marker:'【开场页】',
      theme:JSON.parse(JSON.stringify(t.theme||{})),
      blocks:JSON.parse(JSON.stringify(t.blocks||[])),
      macros:JSON.parse(JSON.stringify(t.macros||[{k:'char',v:'{{char}}'},{k:'user',v:'{{user}}'}])),
      ai:{baseURL:'https://api.openai.com/v1',apiKey:'',model:'',models:[]},
      preview:{mode:'mobile',theme:'dark'},
    };
    /* 模板 decor 自带的背景字段上收进 theme.bg（与旧工程 migrate 同一条路），必须先于 normalize */
    this._hoistBg(p);
    this.normalize(p);
    return p;
  },

  duplicateProject(){
    const p=JSON.parse(JSON.stringify(this.cur));p.id=uid();p.name=p.name+' 副本';p.createdAt=new Date().toISOString();
    this.list.push(p);this.cur=p;this.save();this.resetHistory();_ui.renderAll();toast('已复制工程');
  },
  async renameProject(){
    const name=await promptModal('新名称：',this.cur.name);if(name===null||!name.trim())return;
    this.cur.name=name.trim();this.save();_ui.renderAll();
  },
  async deleteProject(){
    if(this.list.length<=1){toast('至少保留一个工程');return}
    if(!await confirmModal(`确定删除工程「${this.cur.name}」？此操作不可撤销。`))return;
    this.list=this.list.filter(p=>p.id!==this.cur.id);this.cur=this.list[0];this.save();this.resetHistory();_ui.renderAll();toast('已删除');
  },
  /* 导出为可分享文件：剔除 API Key 等敏感字段，防止明文 Key / 加密密钥随文件外泄 */
  exportData(p=this.cur){
    const clean=JSON.parse(JSON.stringify(p));
    if(clean.ai&&typeof clean.ai==='object'){delete clean.ai.apiKey;delete clean.ai.keyEnc}
    return clean;
  },
  /** 一键备份全部工程为一个 JSON（v1.29）：逐个走 exportData 剔 Key；备份文件可经「导入工程」整包还原 */
  exportAll(){
    download(`opening-page-generator-全部工程备份-${new Date().toISOString().slice(0,10)}.json`,
      JSON.stringify({type:'opg-backup',schemaVersion:SCHEMA_VERSION,exportedAt:new Date().toISOString(),
        projects:this.list.map(x=>this.exportData(x))},null,2));
    toast('已备份 '+this.list.length+' 个工程（不含 API Key）');
  },
  importProject(input){
    const f=input.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const d=JSON.parse(r.result);
        if(d&&d.type==='opg-backup'&&Array.isArray(d.projects)){
          /* 整包备份还原：逐个迁移入列，坏条目跳过不拖死整包；导入后落在最后一个有效工程上 */
          let ok=0;
          d.projects.forEach(x=>{
            try{
              if(!x.blocks||!x.theme)return;
              const c=JSON.parse(JSON.stringify(x));
              c.id=uid();c.name=c.name||'导入工程';this.migrate(c);this.list.push(c);ok++;
              this.cur=c;
            }catch(e){}
          });
          if(!ok)throw 0;
          this.save();this.resetHistory();_ui.renderAll();
          toast('备份已导入：'+ok+' 个工程'+(d.projects.length-ok?`，${d.projects.length-ok} 个无效已跳过`:''));
        }else{
          const p=d;
          if(!p.blocks||!p.theme)throw 0;
          p.id=uid();p.name=p.name||'导入工程';this.migrate(p);this.list.push(p);this.cur=p;this.save();this.resetHistory();_ui.renderAll();toast('工程已导入');
        }
      }catch(e){toast('导入失败：不是有效的工程文件')}
      input.value='';
    };
    /* 读取失败（文件不可读/拖入目录等）不提示会让文件选择器「卡死」——同文件重选不触发 change */
    r.onerror=()=>{toast('读取文件失败：文件不可读');input.value=''};
    r.readAsText(f);
  },
  /* 角色卡导入（v1.30）：选文件 → 本地解析 → 勾选映射计划 → 应用为新建工程。
     有酒馆环境（window.createOrReplaceCharacter 可用）时可勾选同时直建角色卡（待真机验证项） */
  openCardImport(){
    const ov=document.createElement('div');
    ov.className='opg-ov'; /* 自绘弹层统一标记：core.js 的 Ctrl+Z/Esc 守卫借此识别「有弹层打开」 */
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;display:flex;align-items:center;justify-content:center';
    const box=document.createElement('div');
    box.style.cssText='background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px;width:min(520px,92vw);max-height:84vh;overflow:auto';
    ov.appendChild(box);document.body.appendChild(ov);
    const close=()=>ov.remove();
    const home=()=>{
      box.innerHTML=`<div style="font-weight:700;margin-bottom:10px">📥 从角色卡导入</div>
        <input type="file" id="ciFile" accept=".png,.json,.charx,image/png,application/json" style="width:100%;font-size:12px">
        <div style="font-size:12px;color:var(--txt2);margin:8px 0">支持酒馆角色卡 PNG（tEXt chara / ccv3）/ JSON / CHARX，V1 / V2 / V3 自动识别；解析纯本地进行。</div>
        <div id="ciMsg" style="font-size:12px;min-height:16px"></div>
        <div style="text-align:right;margin-top:10px"><button type="button" class="btn ghost small" data-close>取消</button></div>`;
    };
    home();
    ov.addEventListener('click',e=>{
      if(e.target===ov||e.target.dataset.close!==undefined)close();
    });
    const plan=card=>{
      const plan=buildPlan(card);
      const inTavern=typeof window.createOrReplaceCharacter==='function';
      box.innerHTML=`<div style="font-weight:700;margin-bottom:4px">📥 导入「${esc(card.name||'导入工程')}」</div>
        <div style="font-size:12px;color:var(--txt2);margin-bottom:8px">勾选要导入的内容，确认后生成新工程：</div>
        ${plan.items.map(it=>`<label style="display:flex;gap:8px;align-items:flex-start;padding:7px 8px;border:1px solid var(--line);border-radius:8px;margin:5px 0;cursor:pointer">
          <input type="checkbox" data-pid="${it.id}" checked style="margin-top:3px">
          <span style="flex:1"><strong style="font-size:13px">${esc(it.label)}</strong><br><span style="font-size:12px;color:var(--txt2)">${esc(it.detail)}</span></span>
        </label>`).join('')}
        ${card.warnings.length?`<div style="font-size:12px;color:var(--txt2);margin:6px 0">⚠️ ${esc(card.warnings.join('；'))}</div>`:''}
        ${inTavern?`<label class="inline-check" style="margin:6px 0"><input type="checkbox" id="ciTavern">同时把这张卡创建进酒馆（createOrReplaceCharacter）</label>`:''}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
          <button type="button" class="btn ghost small" data-back>← 重选文件</button>
          <button type="button" class="btn small" data-confirm>✓ 生成工程</button>
        </div>`;
      box.querySelector('[data-back]').onclick=home;
      box.querySelector('[data-confirm]').onclick=()=>{
        const ids=[...box.querySelectorAll('input[data-pid]:checked')].map(x=>x.dataset.pid);
        const name=(plan.name||'导入工程')+'（导入）';
        const p=defaultProject(name);
        this.normalize(p);
        const sum=applyImportPlan(p,card,ids);
        this.list.push(p);this.cur=p;this.save();this.resetHistory();_ui.renderAll();
        close();toast(sum);
        if(box.querySelector('#ciTavern')&&box.querySelector('#ciTavern').checked){
          /* Promise 兼容 + try/catch（TAVERN_API 运行环境规则 3/4）；覆盖同名卡由酒馆原生语义决定 */
          Promise.resolve(window.createOrReplaceCharacter(card.name||name,toV2Card(card).data))
            .then(()=>toast('已创建酒馆角色卡：'+(card.name||name)))
            .catch(err=>toast('⚠️ 酒馆建卡失败：'+(err&&err.message||err)));
        }
      };
    };
    box.addEventListener('change',async e=>{
      if(e.target.id!=='ciFile')return;
      const f=e.target.files[0];if(!f)return;
      const msg=box.querySelector('#ciMsg');
      msg.style.color='var(--txt2)';msg.textContent='⏳ 解析中…';
      try{const card=await parseCardFile(f);msg.textContent='';plan(card)}
      catch(err){msg.style.color='var(--err)';msg.textContent='❌ '+(err&&err.message||err)}
    });
  },
};

export {Project, setUI};

