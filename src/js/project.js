/* 工程管理：存储 / 迁移 / 模板 */
import { esc, toast, uid, download, confirmModal, promptModal } from './utils.js';
import { BLOCK_DEFS, BLOCK_ORDER, BUILTIN_TEMPLATES, defaultProject } from './defs.js';
import { defaultConfig as defaultStatusbar, migrateStatusbarSamples } from './statusbar.js';

/**
 * 工程对象（localStorage 持久化单元，id 同时作为生成组件的容器前缀）
 * @typedef {Object} ProjectData
 * @property {string} id - 唯一 id（容器前缀 opg-{id}）
 * @property {string} name - 工程名
 * @property {string} createdAt - 创建时间（ISO）
 * @property {string} marker - 正则脚本标记文本
 * @property {import('./defs.js').ThemeConfig} theme - 主题配置
 * @property {import('./defs.js').Block[]} blocks - 区块列表（数组顺序即渲染顺序）
 * @property {import('./defs.js').Macro[]} macros - 自定义宏
 * @property {{baseURL:string,apiKey:string,model:string,models:string[]}} ai - AI 助手配置
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
  _history:[],_historyIdx:-1,MAX_HISTORY:20,
  /** 保存当前快照（区块列表 + 状态栏配置，深拷贝），超过 MAX_HISTORY 步时丢弃最早的；新操作会截断 redo 链 */
  saveSnapshot(){
    if(!this.cur)return;
    /* 截断 redo 链 */
    this._history=this._history.slice(0,this._historyIdx+1);
    this._history.push(JSON.parse(JSON.stringify({blocks:this.cur.blocks,statusbar:this.cur.statusbar})));
    if(this._history.length>this.MAX_HISTORY)this._history.shift();
    this._historyIdx=this._history.length-1;
  },
  /** 从快照恢复（区块 + 状态栏；旧快照无 statusbar 时保持现状，向后兼容） */
  _restore(s){
    if(!s)return;
    this.cur.blocks=JSON.parse(JSON.stringify(s.blocks||[]));
    if(s.statusbar)this.cur.statusbar=JSON.parse(JSON.stringify(s.statusbar));
  },
  /** 撤销一步；无可撤销时返回 false。恢复后触发整个界面重渲染 */
  undo(){
    if(this._historyIdx<=0)return false;
    this._historyIdx--;
    this._restore(this._history[this._historyIdx]);
    _ui.renderAll();
    this.saveDebounced();
    return true;
  },
  /** 重做一步；无可重做时返回 false。恢复后触发整个界面重渲染 */
  redo(){
    if(this._historyIdx>=this._history.length-1)return false;
    this._historyIdx++;
    this._restore(this._history[this._historyIdx]);
    _ui.renderAll();
    this.saveDebounced();
    return true;
  },
  /** 清空并重建历史栈：切换/新建/导入/复制/删除工程后必须调用，
   *  否则上一工程的历史快照会被恢复进当前工程（跨工程数据污染） */
  resetHistory(){
    this._history=[];this._historyIdx=-1;
    this.saveSnapshot();
  },

  load(){
    let raw=null;
    /* localStorage 本身可能被浏览器禁用（隐私模式/权限策略）： getItem 直抛会杀死启动 */
    try{raw=localStorage.getItem(this.LS_KEY)}catch(e){}
    try{this.list=JSON.parse(raw||'[]')}catch(e){this.list=[]}
    if(!Array.isArray(this.list))this.list=[];
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
    this.save();
    this.saveSnapshot();
  },
  /* 深度规范化：补齐工程/区块任意缺失字段，保证旧数据、导入数据、残缺数据都能渲染 */
  normalize(p){
    const def=defaultProject(p.name||'');
    if(!p.marker)p.marker=def.marker;
    if(!p.theme||typeof p.theme!=='object')p.theme={};
    Object.keys(def.theme).forEach(k=>{if(p.theme[k]===undefined)p.theme[k]=def.theme[k]});
    if(!Array.isArray(p.macros))p.macros=[{k:'char',v:'{{char}}'},{k:'user',v:'{{user}}'}];
    if(!p.ai||typeof p.ai!=='object')p.ai={};
    delete p.ai.keyMode;delete p.ai.keyEnc; /* 旧版加密/不保存模式已移除，清理残留字段 */
    ['baseURL','apiKey','model','models'].forEach(k=>{if(p.ai[k]===undefined)p.ai[k]=def.ai[k]});
    if(!p.preview||typeof p.preview!=='object')p.preview={};
    ['mode','theme'].forEach(k=>{if(p.preview[k]===undefined)p.preview[k]=def.preview[k]});
    /* 纯文本状态栏生成器配置 */
    if(!p.statusbar||typeof p.statusbar!=='object')p.statusbar={};
    const sdef=defaultStatusbar();
    ['mode','tag','title','entryComment','depth','role','order','actions','actionCount','actionStyles','layout','layoutConfig','extraCss'].forEach(k=>{
      if(p.statusbar[k]===undefined)p.statusbar[k]=sdef[k];
    });
    /* 样式统筹子对象 */
    if(!p.statusbar.style||typeof p.statusbar.style!=='object')p.statusbar.style={};
    Object.keys(sdef.style).forEach(k=>{if(p.statusbar.style[k]===undefined)p.statusbar.style[k]=sdef.style[k]});
    if(!Array.isArray(p.statusbar.rules))p.statusbar.rules=sdef.rules.slice();
    if(!Array.isArray(p.statusbar.fields)||!p.statusbar.fields.length)p.statusbar.fields=JSON.parse(JSON.stringify(sdef.fields));
    p.statusbar.fields=p.statusbar.fields.filter(f=>f&&typeof f==='object');/* 同上：剔除损坏项 */
    p.statusbar.fields.forEach(f=>{
      if(typeof f.name!=='string')f.name='';
      if(typeof f.sample!=='string')f.sample='';
      if(f.hint===undefined)f.hint='';
      if(f.quote===undefined)f.quote=false;
      /* 渲染样式：render 优先；旧数据只有 quote 布尔时映射 */
      if(f.render===undefined)f.render=f.quote?'quote':'normal';
    });
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
    });
  },
  /* 旧版工程结构迁移：角色简介区从「世界书拉取+占位值」迁移为「手动多角色」；
     开场白点击行为 insert（旧默认）迁移为 go（切换到对应开场白）。
     注意：旧字段转换必须先于 normalize —— normalize 会给缺 characters 的
     profile 注入默认值，若后跑会使旧占位迁移分支永远无法命中 */
  migrate(p){
    (p.blocks||[]).forEach(b=>{
      if(b.type==='greetings'&&(b.clickAction==='insert'||!b.clickAction))b.clickAction='go';
      if(b.type==='profile'&&!Array.isArray(b.characters)){
        b.characters=[{name:b.placeholderName||'{{char}}',desc:b.placeholderDesc||'',tags:b.placeholderTags||'',avatar:b.avatarUrl||''}];
        ['placeholderName','placeholderDesc','placeholderTags','avatarUrl','wbName','wbEntryComment','avatarFromWb'].forEach(k=>delete b[k]);
      }
    });
    this.normalize(p);
    migrateStatusbarSamples(p.statusbar); /* 旧版默认示例值 → 原创示例值 */
    p.blocks=(p.blocks||[]).filter(b=>BLOCK_DEFS[b.type]);
  },
  save(){
    try{
      localStorage.setItem(this.LS_KEY,JSON.stringify(this.list));
      localStorage.setItem(this.LS_CUR,this.cur?.id||'');
    }catch(e){
      /* 配额超限（多为超大图片/HTML 内容）：提示但不中断界面 */
      clearTimeout(this._qTip);
      this._qTip=setTimeout(()=>toast('⚠️ 保存失败：浏览器存储空间不足，请精简图片/HTML 内容或删除旧工程'),200);
    }
  },
  /* 高频输入路径用防抖保存，避免每次按键全量序列化所有工程 */
  _svT:null,
  saveDebounced(){clearTimeout(this._svT);this._svT=setTimeout(()=>this.save(),600)},
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
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;display:flex;align-items:center;justify-content:center';
    const box=document.createElement('div');
    box.style.cssText='background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px;width:min(480px,92vw);max-height:80vh;overflow:auto';
    let rows=`<div style="font-weight:700;margin-bottom:10px">📄 新建工程</div>
      <button type="button" class="btn ghost small" data-new="blank" style="width:100%;text-align:left;margin:4px 0">空白工程（默认区块布局）</button>
      <button type="button" class="btn ghost small" data-new="sample" style="width:100%;text-align:left;margin:4px 0">示例工程</button>`;
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
        this.normalize(p); /* 补齐后续新增的配置节（如 statusbar） */
        this.list.push(p);this.cur=p;this.save();this.resetHistory();_ui.renderAll();toast('已创建工程');
        return;
      }
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
  /* 导出为可分享文件：剔除 API Key 等敏感字段，防止明文 Key / 加密密文随文件外泄 */
  exportData(){
    const clean=JSON.parse(JSON.stringify(this.cur));
    if(clean.ai&&typeof clean.ai==='object'){delete clean.ai.apiKey;delete clean.ai.keyEnc}
    return clean;
  },
  exportProject(){
    download(`${this.cur.name}.opg.json`,JSON.stringify(this.exportData(),null,2));toast('工程已导出（不含 API Key）')
  },
  importProject(input){
    const f=input.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const p=JSON.parse(r.result);
        if(!p.blocks||!p.theme)throw 0;
        p.id=uid();p.name=p.name||'导入工程';this.migrate(p);this.list.push(p);this.cur=p;this.save();this.resetHistory();_ui.renderAll();toast('工程已导入');
      }catch(e){toast('导入失败：不是有效的工程文件')}
      input.value='';
    };
    r.readAsText(f);
  },
};

export {Project, setUI};

